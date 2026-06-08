import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Row = Record<string, string>;

// ── CSV-parser (tab-delim, single-quote-qualifier, klarar radbrytningar i fält) ──
function parseCsv(text: string, delim = '\t', q = "'"): Row[] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { if (row.length || field.length) { pushField(); records.push(row); row = []; } };
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === q) { if (text[i + 1] === q) { field += q; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === q) { inQ = true; i++; continue; }
    if (c === delim) { pushField(); i++; continue; }
    if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); i++; continue; }
    field += c; i++;
  }
  pushRow();
  const [head, ...rest] = records;
  if (!head) return [];
  return rest.map((cols) => Object.fromEntries(head.map((h, idx) => [h, cols[idx] ?? ''])) as Row);
}

// ── XML-parser (tar bort nästlade <Extras> så produktens <Name> inte krockar) ──
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
}
function xmlTag(block: string, t: string): string {
  const m = block.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));
  return m ? decodeXml(m[1]) : '';
}
function parseXml(xml: string): Row[] {
  return xml.split('<product>').slice(1).map((raw) => {
    const block = raw.split('</product>')[0].replace(/<Extras>[\s\S]*?<\/Extras>/g, '');
    return {
      SKU: xmlTag(block, 'SKU'), Name: xmlTag(block, 'Name'), Description: xmlTag(block, 'Description'),
      Category: xmlTag(block, 'Category'), Price: xmlTag(block, 'Price'), Currency: xmlTag(block, 'Currency'),
      Instock: xmlTag(block, 'Instock'), ProductUrl: xmlTag(block, 'ProductUrl'), ImageUrl: xmlTag(block, 'ImageUrl'),
      TrackingUrl: xmlTag(block, 'TrackingUrl'), OriginalPrice: xmlTag(block, 'OriginalPrice'), Ean: xmlTag(block, 'Ean'),
    } as Row;
  });
}

function parseFeed(text: string): Row[] {
  const t = text.trimStart();
  return (t.startsWith('<?xml') || t.startsWith('<productFeed') || t.startsWith('<product'))
    ? parseXml(text)
    : parseCsv(text);
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
  const hay = `${p.Name} ${p.Description} ${p.Category}`.toLowerCase();
  if (EXCLUDE.some((k) => hay.includes(k)) && !(hay.includes('höns') || hay.includes('fjäderfä'))) return false;
  return INCLUDE.some((k) => hay.includes(k));
}

function mapCategory(p: Row): string {
  const h = `${p.Name} ${p.Category}`.toLowerCase();
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

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const startedAt = new Date().toISOString();

  const { data: advertisers, error: advErr } = await supabase
    .from('affiliate_advertisers')
    .select('id, slug, product_feed_url')
    .eq('is_active', true)
    .not('product_feed_url', 'is', null);
  if (advErr) return new Response(JSON.stringify({ error: advErr.message }), { status: 500 });

  const summary: Record<string, unknown>[] = [];

  for (const adv of advertisers ?? []) {
    try {
      const resp = await fetch(adv.product_feed_url as string);
      if (!resp.ok) { summary.push({ slug: adv.slug, error: `feed ${resp.status}` }); continue; }
      const text = await resp.text();
      const rows = parseFeed(text).filter(isPoultry);

      const records = rows.map((p) => {
        const price = parseFloat((p.Price || '0').replace(',', '.')) || 0;
        const orig = parseFloat((p.OriginalPrice || '0').replace(',', '.')) || null;
        return {
          advertiser_id: adv.id,
          external_id: p.SKU,
          name: decodeEntities(p.Name),
          short_description: decodeEntities(p.Description).slice(0, 300),
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
      });

      for (let i = 0; i < records.length; i += 500) {
        const { error } = await supabase
          .from('affiliate_products')
          .upsert(records.slice(i, i + 500), { onConflict: 'advertiser_id,external_id' });
        if (error) throw error;
      }

      // Allt som inte fanns i denna körning → markera slut (göms i frontend)
      await supabase
        .from('affiliate_products')
        .update({ in_stock: false })
        .eq('advertiser_id', adv.id)
        .lt('last_scraped_at', startedAt);

      summary.push({
        slug: adv.slug,
        matched: records.length,
        in_stock: records.filter((r) => r.in_stock).length,
      });
    } catch (e) {
      summary.push({ slug: adv.slug, error: String((e as Error).message) });
    }
  }

  return new Response(JSON.stringify({ ok: true, startedAt, summary }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
