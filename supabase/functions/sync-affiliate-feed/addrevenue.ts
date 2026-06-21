import { decodeFeedText, formatSek, normalizeFeedText, parseFeedMoney, slugifyFeedText, type FeedRow } from './csv.ts';

export type FeedAdvertiser = { id: string; slug: string; product_feed_url: string };

const SIGNALS: Record<string, string[]> = {
  bevattning: ['bevattning','vattna','vattenslang','slang','spridare','torka'],
  beskarning: ['beskärning','beskära','sekatör','häck','gren','buske','fruktträd'],
  odling: ['odling','odla','plantera','jord','rabatt','ogräs','skörd'],
  stadning: ['städa','rengöra','borste','sopskyffel','hönshus'],
  tradgardsklader: ['trädgårdshandskar','handskar','trädgårdsarbete','skydd'],
  forvaring: ['korg','förvaring','plantering','skörd','kruka'],
  grasmatta: ['gräsmatta','gräsfrö','så gräs'],
  tradgardsredskap: ['trädgårdsredskap','trädgård','odling','plantera'],
};

function category(row: FeedRow): string {
  const text = normalizeFeedText(`${row.title ?? ''} ${row.description ?? ''} ${row.product_type ?? ''}`);
  if (/(korg|skottkarra)/.test(text)) return 'forvaring';
  if (/(handsk|kladsel|drakt)/.test(text)) return 'tradgardsklader';
  if (/(grasfro|grasmatta)/.test(text)) return 'grasmatta';
  if (/(sekat|beskar|grensag|grensax|hacksax|bagsag|trimma)/.test(text)) return 'beskarning';
  if (/(ogras|planter|spade|grep|kultiv|hacka|kratta|rafsa|fruktplock|rotjarn|fogkrats|skyffel)/.test(text)) return 'odling';
  if (/(borste|sopskyffel|takrann)/.test(text)) return 'stadning';
  if (/(vatt|slang|sprid|bevatt|koppling|kontakt|ventil|sensor|draner)/.test(text)) return 'bevattning';
  return 'tradgardsredskap';
}

export function isRelevantAddRevenue(row: FeedRow, advertiser: string): boolean {
  const text = normalizeFeedText(`${row.title ?? ''} ${row.product_type ?? ''} ${row.description ?? ''}`);
  if (/(jul|christmas|doft|fragrance|vinlada|kamado|grill|pizza|burgar|beer can chicken)/.test(text)) return false;
  if (advertiser === 'by-benson') return /(garden|tradgard|watering|slang|vattn|spade|sekat|sax|kratta|rafsa|grep|ogras|planter|korg|handsk|skottkarra|borste|kultiv|hacka)/.test(text);
  if (advertiser === 'dintradgard') return /(gardena|weibulls|tradgard|bevatt|vattn|slang|sprid|planter|ogras|kratta|rafsa|grasfro|frukt|borste|rotjarn|fogkrats)/.test(text);
  return false;
}

function keywords(name: string, description: string, productCategory: string): string[] {
  const stop = new Set(['alla','andra','bara','basic','deluxe','eller','gardena','med','och','premium','produkt','set','som','storlek','till','under','utan']);
  const words = normalizeFeedText(`${name} ${description}`).split(' ').filter((word) => word.length >= 4 && !stop.has(word));
  return Array.from(new Set([...(SIGNALS[productCategory] ?? []), ...words])).slice(0, 24);
}

export function mapAddRevenueProduct(row: FeedRow, advertiser: FeedAdvertiser, timestamp: string) {
  const name = decodeFeedText(row.title ?? '');
  const description = decodeFeedText(row.description ?? '');
  const productCategory = category(row);
  const price = parseFeedMoney(row.sale_price || row.price);
  const original = parseFeedMoney(row.price);
  const image = row.image_link || null;

  return {
    advertiser_id: advertiser.id,
    external_id: row.id,
    slug: `${advertiser.slug}-${slugifyFeedText(name)}-${row.id}`,
    name,
    description,
    short_description: description.slice(0, 300),
    category: productCategory,
    price: price ? formatSek(price) : null,
    price_original: original > price ? original : null,
    currency: 'SEK',
    in_stock: normalizeFeedText(row.availability || 'in stock') !== 'out of stock',
    image_url: image,
    image_urls: image ? [image] : [],
    product_url: row.original_link || null,
    affiliate_url: row.link || null,
    specs: {
      keywords: keywords(name, description, productCategory),
      source: 'addrevenue',
      brand: decodeFeedText(row.brand ?? ''),
      product_type: decodeFeedText(row.product_type ?? ''),
    },
    is_active: true,
    last_scraped_at: timestamp,
    updated_at: timestamp,
  };
}
