import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Row = Record<string, string>;

// ── Streaming line reader (för att inte ladda hela CSV:n i minnet) ──
async function* iterLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      yield buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
    }
  }
  if (buf.length) yield buf.replace(/\r$/, '');
}

// CSV-radparser (tab-delim, singlequote-qualifier). Klarar INTE fält med radbrytningar,
// men Adtractions feeds använder dem inte i vår whitelist – fördel: streaming utan stor buffer.
function parseCsvLine(line: string, delim = '\t', q = "'"): string[] {
  const out: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === q) { if (line[i + 1] === q) { field += q; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === q) inQ = true;
      else if (c === delim) { out.push(field); field = ''; }
      else field += c;
    }
  }
  out.push(field);
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&ouml;/g, 'ö').replace(/&Ouml;/g, 'Ö').replace(/&aring;/g, 'å').replace(/&Aring;/g, 'Å')
    .replace(/&auml;/g, 'ä').replace(/&Auml;/g, 'Ä').replace(/&rdquo;/g, '”').replace(/&ldquo;/g, '”')
    .replace(/&deg;/g, '°').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

const INCLUDE = ['höns', 'hönshus', 'hönsgård', 'värprede', 'värp', 'kyckling', 'kläck', 'ruvmaskin',
  'ruvning', 'äggkläck', 'fjäderfä', 'vattenautomat', 'vattenkopp', 'foderautomat', 'värmelampa',
  'värmehink', 'värmeplatta', 'lucköppnare', 'hönsnät', 'voljär', 'fågelnät'];
const EXCLUDE = ['kanin', 'hundfoder', 'hund ', 'katt', 'häst', 'gris', 'bilvård', 'högtryck',
  'kemtvätt', 'partytält', 'vedklyv', 'blåspistol', 'membran', 'fordonstvätt', 'hörselskydd'];

function isPoultry(p: Row): boolean {
  const hay = `${p.Name ?? ''} ${p.Description ?? ''} ${p.Category ?? ''}`.toLowerCase();
  if (EXCLUDE.some((k) => hay.includes(k)) && !(hay.includes('höns') || hay.includes('fjäderfä'))) return false;
  return INCLUDE.some((k) => hay.includes(k));
}

function mapCategory(p: Row): string {
  const h = `${p.Name ?? ''} ${p.Category ?? ''}`.toLowerCase();
  if (/(startset|startpaket)/.test(h)) return 'startset';
  if (/(kläck|ruvmaskin|äggkläck|kläckmaskin|hygrometer|termo)/.test(h)) return 'klackning';
  if (/(värmelampa)/.test(h)) return 'vaerme';
  if (/(vattenautomat|vattenkopp|värmehink|värmeplatta|dricka)/.test(h)) return 'vatten';
  if (/(foderautomat|foder)/.test(h)) return 'foder';
  if (/(nät|stängsel|voljär|räv)/.test(h)) return 'staengsel';
  if (/(tillskott|kalcium|ostronskal|vitamin|mineral)/.test(h)) return 'tillskott';
  if (/(hönshus|hönsgård|värprede|lucköppnare|hus)/.test(h)) return 'hus';
  return 'redskap';
}

const fmtKr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`;

function recordFromRow(p: Row, advertiserId: string, startedAt: string) {
  const price = parseFloat((p.Price || '0').replace(',', '.')) || 0;
  const orig = parseFloat((p.OriginalPrice || '0').replace(',', '.')) || null;
  return {
    advertiser_id: advertiserId,
    external_id: p.SKU,
    name: decodeEntities(p.Name ?? ''),
    short_description: decodeEntities(p.Description ?? '').slice(0, 300),
    category: mapCategory(p),
    price: fmtKr(price),
    price_original: orig && orig > price ? orig : null,
    currency: p.Currency || 'SEK',
    in_stock: (p.Instock || '').toLowerCase() === 'yes',
    image_url: p.ImageUrl || null,
    image_urls: p.ImageUrl ? [p.ImageUrl] : [],
    product_url: p.ProductUrl || null,
    affiliate_url: p.TrackingUrl || null,
    is_active: true,
    last_scraped_at: startedAt,
  };
}

async function syncAdvertiser(
  supabase: ReturnType<typeof createClient>,
  adv: { id: string; slug: string; product_feed_url: string },
  startedAt: string,
) {
  const resp = await fetch(adv.product_feed_url);
  if (!resp.ok || !resp.body) return { slug: adv.slug, error: `feed ${resp.status}` };

  // Bara CSV-streaming stöds här (XML kräver hela dokumentet → out-of-memory).
  const lines = iterLines(resp.body);
  const firstLine = (await lines.next()).value as string | undefined;
  if (!firstLine) return { slug: adv.slug, error: 'tomt svar' };
  if (firstLine.trimStart().startsWith('<')) {
    return { slug: adv.slug, error: 'XML-feed stöds ej (minne)' };
  }
  const header = parseCsvLine(firstLine);

  let matched = 0;
  let inStock = 0;
  const batch: ReturnType<typeof recordFromRow>[] = [];
  const BATCH = 200;

  const flush = async () => {
    if (!batch.length) return;
    const { error } = await supabase
      .from('affiliate_products')
      .upsert(batch, { onConflict: 'advertiser_id,external_id' });
    if (error) throw error;
    batch.length = 0;
  };

  for await (const line of lines) {
    if (!line) continue;
    const cols = parseCsvLine(line);
    const row: Row = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']));
    if (!isPoultry(row) || !row.SKU) continue;
    const rec = recordFromRow(row, adv.id, startedAt);
    matched++;
    if (rec.in_stock) inStock++;
    batch.push(rec);
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  // Markera försvunna produkter som slut i lager
  await supabase
    .from('affiliate_products')
    .update({ in_stock: false })
    .eq('advertiser_id', adv.id)
    .lt('last_scraped_at', startedAt);

  return { slug: adv.slug, matched, in_stock: inStock };
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const slugFilter = url.searchParams.get('slug');

  let q = supabase
    .from('affiliate_advertisers')
    .select('id, slug, product_feed_url')
    .eq('is_active', true)
    .not('product_feed_url', 'is', null);
  if (slugFilter) q = q.eq('slug', slugFilter);

  const { data: advertisers, error: advErr } = await q;
  if (advErr) return new Response(JSON.stringify({ error: advErr.message }), { status: 500 });

  const summary: Record<string, unknown>[] = [];
  for (const adv of advertisers ?? []) {
    try {
      // deno-lint-ignore no-explicit-any
      summary.push(await syncAdvertiser(supabase, adv as any, startedAt));
    } catch (e) {
      summary.push({ slug: (adv as { slug: string }).slug, error: String((e as Error).message) });
    }
  }

  return new Response(JSON.stringify({ ok: true, startedAt, summary }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
