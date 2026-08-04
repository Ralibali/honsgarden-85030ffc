import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseDelimited } from './csv.ts';
import { isRelevantAddRevenue, mapAddRevenueProduct, type FeedAdvertiser } from './addrevenue.ts';
import { isRelevantAdtraction, mapAdtractionProduct } from './adtraction.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
type Client = ReturnType<typeof createClient>;

async function save(client: Client, advertiser: FeedAdvertiser, records: Record<string, unknown>[], timestamp: string) {
  for (let index = 0; index < records.length; index += 200) {
    const { error } = await client.from('affiliate_products')
      .upsert(records.slice(index, index + 200), { onConflict: 'advertiser_id,external_id' });
    if (error) throw error;
  }
  await client.from('affiliate_products')
    .update({ in_stock: false, updated_at: timestamp })
    .eq('advertiser_id', advertiser.id)
    .lt('last_scraped_at', timestamp);
}

async function sync(client: Client, advertiser: FeedAdvertiser, timestamp: string) {
  const response = await fetch(advertiser.product_feed_url);
  if (!response.ok) throw new Error(`feed ${response.status}`);
  const text = await response.text();
  let records: Record<string, unknown>[];

  if (advertiser.product_feed_url.includes('addrevenue.io')) {
    records = parseDelimited(text, ';')
      .filter((row) => row.id && isRelevantAddRevenue(row, advertiser.slug))
      .map((row) => mapAddRevenueProduct(row, advertiser, timestamp))
      .filter((record) => record.image_url && record.affiliate_url);
  } else {
    records = parseDelimited(text, '\t', "'")
      .filter((row) => row.SKU && isRelevantAdtraction(row))
      .map((row) => mapAdtractionProduct(row, advertiser.id, timestamp));
  }

  await save(client, advertiser, records, timestamp);
  return {
    slug: advertiser.slug,
    matched: records.length,
    in_stock: records.filter((record) => record.in_stock).length,
  };
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  const bearer = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!secret || (bearer !== secret && request.headers.get('x-cron-secret') !== secret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE);
  const timestamp = new Date().toISOString();
  const slug = new URL(request.url).searchParams.get('slug');
  let query = client.from('affiliate_advertisers')
    .select('id, slug, product_feed_url')
    .eq('is_active', true)
    .not('product_feed_url', 'is', null);
  if (slug) query = query.eq('slug', slug);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const summary: Record<string, unknown>[] = [];
  for (const advertiser of data ?? []) {
    try { summary.push(await sync(client, advertiser as FeedAdvertiser, timestamp)); }
    catch (syncError) {
      summary.push({
        slug: advertiser.slug,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, timestamp, summary }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
