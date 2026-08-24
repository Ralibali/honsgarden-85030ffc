import { decodeFeedText, formatSek, normalizeFeedText, parseFeedMoney, slugifyFeedText, type FeedRow } from './csv.ts';

const INCLUDE = ['höns','hönshus','hönsgård','värprede','värp','kyckling','kläck','ruvmaskin','ruvning','äggkläck','fjäderfä','vattenautomat','vattenkopp','foderautomat','värmelampa','värmehink','värmeplatta','lucköppnare','hönsnät','voljär','fågelnät'];
const EXCLUDE = ['kanin','hundfoder','hund ','katt','häst','gris','bilvård','högtryck','kemtvätt','partytält','vedklyv','fordonstvätt'];

export function isRelevantAdtraction(row: FeedRow): boolean {
  const text = `${row.Name ?? ''} ${row.Description ?? ''} ${row.Category ?? ''}`.toLowerCase();
  if (EXCLUDE.some((term) => text.includes(term)) && !/(höns|fjäderfä)/.test(text)) return false;
  return INCLUDE.some((term) => text.includes(term));
}

function category(row: FeedRow): string {
  const text = `${row.Name ?? ''} ${row.Category ?? ''}`.toLowerCase();
  if (/(startset|startpaket)/.test(text)) return 'startset';
  if (/(kläck|ruvmaskin|äggkläck|hygrometer)/.test(text)) return 'klackning';
  if (/värmelampa/.test(text)) return 'vaerme';
  if (/(vattenautomat|vattenkopp|värmehink|värmeplatta)/.test(text)) return 'vatten';
  if (/(foderautomat|foder)/.test(text)) return 'foder';
  if (/(nät|stängsel|voljär|räv)/.test(text)) return 'staengsel';
  if (/(tillskott|kalcium|ostronskal|vitamin|mineral)/.test(text)) return 'tillskott';
  if (/(hönshus|hönsgård|värprede|lucköppnare)/.test(text)) return 'hus';
  return 'redskap';
}

export function mapAdtractionProduct(row: FeedRow, advertiserId: string, timestamp: string) {
  const name = decodeFeedText(row.Name ?? '');
  const description = decodeFeedText(row.Description ?? '');
  const productCategory = category(row);
  const price = parseFeedMoney(row.Price);
  const original = parseFeedMoney(row.OriginalPrice);
  const signalWords = normalizeFeedText(`${name} ${description}`).split(' ').filter((word) => word.length >= 4).slice(0, 20);

  return {
    advertiser_id: advertiserId,
    external_id: row.SKU,
    slug: `${slugifyFeedText(name)}-${slugifyFeedText(row.SKU)}`,
    name,
    description,
    short_description: description.slice(0, 300),
    category: productCategory,
    price: formatSek(price),
    price_original: original > price ? original : null,
    currency: row.Currency || 'SEK',
    in_stock: normalizeFeedText(row.Instock) === 'yes',
    image_url: row.ImageUrl || null,
    image_urls: row.ImageUrl ? [row.ImageUrl] : [],
    product_url: row.ProductUrl || null,
    affiliate_url: row.TrackingUrl || null,
    specs: { keywords: signalWords, source: 'adtraction' },
    is_active: true,
    last_scraped_at: timestamp,
    updated_at: timestamp,
  };
}
