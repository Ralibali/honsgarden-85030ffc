import { decodeFeedText, formatSek, normalizeFeedText, parseFeedMoney, slugifyFeedText, type FeedRow } from './csv.ts';
import { isRelevantAdtraction, poultryCategory } from './adtraction.ts';

/**
 * Awin "Create-a-Feed" CSV (comma, double quotes, usually gzip). The feed URL
 * stored in affiliate_advertisers holds the placeholder {AWIN_API_KEY}; the
 * real key lives only in the AWIN_API_KEY function secret.
 */
export const AWIN_API_KEY_PLACEHOLDER = '{AWIN_API_KEY}';

export function isAwinFeedUrl(url: string): boolean {
  return url.includes('productdata.awin.com');
}

export function resolveAwinFeedUrl(url: string, apiKey: string | undefined): string {
  if (!url.includes(AWIN_API_KEY_PLACEHOLDER)) return url;
  if (!apiKey) throw new Error('AWIN_API_KEY saknas');
  return url.replace(AWIN_API_KEY_PLACEHOLDER, encodeURIComponent(apiKey));
}

function asPoultryRow(row: FeedRow): FeedRow {
  return {
    Name: row.product_name ?? '',
    Description: row.description || row.product_short_description || '',
    Category: [row.merchant_category, row.category_name].filter(Boolean).join(' '),
  };
}

/** Same poultry relevance rules as the Adtraction feeds. */
export function isRelevantAwin(row: FeedRow): boolean {
  return Boolean(row.aw_deep_link) && isRelevantAdtraction(asPoultryRow(row));
}

function inStock(row: FeedRow): boolean {
  const flag = normalizeFeedText(row.in_stock ?? '');
  if (flag) return ['1', 'yes', 'true', 'in stock', 'instock'].includes(flag);
  const quantity = Number.parseInt(row.stock_quantity ?? '', 10);
  return Number.isFinite(quantity) ? quantity > 0 : true;
}

export function mapAwinProduct(row: FeedRow, advertiserId: string, timestamp: string) {
  const name = decodeFeedText(row.product_name ?? '');
  const description = decodeFeedText(row.description || row.product_short_description || '');
  const externalId = row.aw_product_id || row.merchant_product_id;
  const price = parseFeedMoney(row.search_price || row.store_price || row.display_price);
  const original = parseFeedMoney(row.rrp_price);
  const image = row.merchant_image_url || row.aw_image_url || null;
  const signalWords = normalizeFeedText(`${name} ${description}`).split(' ').filter((word) => word.length >= 4).slice(0, 20);

  return {
    advertiser_id: advertiserId,
    external_id: externalId,
    slug: `${slugifyFeedText(name)}-${slugifyFeedText(externalId)}`,
    name,
    description,
    short_description: description.slice(0, 300),
    category: poultryCategory(asPoultryRow(row)),
    price: formatSek(price),
    price_original: original > price ? original : null,
    currency: row.currency || 'SEK',
    in_stock: inStock(row),
    image_url: image,
    image_urls: image ? [image] : [],
    product_url: row.merchant_deep_link || null,
    affiliate_url: row.aw_deep_link || null,
    specs: { keywords: signalWords, source: 'awin', merchant: decodeFeedText(row.merchant_name ?? ''), merchant_id: row.merchant_id ?? '' },
    is_active: true,
    last_scraped_at: timestamp,
    updated_at: timestamp,
  };
}

/** Decompresses gzip feeds (Awin's default) and returns text. */
export async function readFeedText(response: Response): Promise<string> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  return new TextDecoder().decode(bytes);
}
