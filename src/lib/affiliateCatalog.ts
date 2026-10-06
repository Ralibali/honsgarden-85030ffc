import { AFFILIATE_PRODUCTS } from '@/data/affiliateProducts';
import { ADDREVENUE_PRODUCTS } from '@/data/addRevenueProducts';
import { normalizeAffiliateText, type SmartAffiliateProduct } from '@/lib/smartAffiliate';

/**
 * Pure catalog logic shared by the blog's product engine
 * (useSmartAffiliateCatalog) and scripts/affiliate-coverage.ts.
 */

/** Plockar ut cupa_sku ur en tracking-URL så vi kan matcha mot DB-katalogens external_id. */
export function skuFromTrackingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.match(/cupa_sku=([^&]+)/)?.[1] ?? null;
}

const KEYWORD_STOP = new Set(['alla', 'andra', 'bara', 'deluxe', 'eller', 'gardena', 'med', 'och', 'premium', 'produkt', 'set', 'som', 'till', 'trädgård', 'under', 'utan']);

function generatedKeywords(...values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return normalizeAffiliateText(values.filter(Boolean).join(' '))
    .split(' ')
    .filter((token) => token.length >= 4 && !KEYWORD_STOP.has(token))
    .filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    })
    .slice(0, 24);
}

function legacyCatalog(): SmartAffiliateProduct[] {
  return AFFILIATE_PRODUCTS.map((product) => ({
    ...product,
    externalId: skuFromTrackingUrl(product.trackingUrl) ?? product.id,
    advertiserName: product.advertiser === 'p-lindberg' ? 'P. Lindberg' : 'Bonden.se',
    description: '',
    source: 'static' as const,
  })) as SmartAffiliateProduct[];
}

export const FALLBACK_AFFILIATE_CATALOG: SmartAffiliateProduct[] = [...legacyCatalog(), ...ADDREVENUE_PRODUCTS];

function relationSlug(relation: unknown): string {
  if (Array.isArray(relation)) return (relation[0] as { slug?: string } | undefined)?.slug ?? 'unknown';
  return (relation as { slug?: string } | null)?.slug ?? 'unknown';
}

function relationName(relation: unknown): string | undefined {
  if (Array.isArray(relation)) return (relation[0] as { name?: string } | undefined)?.name;
  return (relation as { name?: string } | null)?.name;
}

export function mapDatabaseProduct(row: Record<string, any>): SmartAffiliateProduct | null {
  const advertiser = relationSlug(row.affiliate_advertisers);
  const specs = row.specs && typeof row.specs === 'object' ? row.specs as Record<string, unknown> : {};
  const specKeywords = Array.isArray(specs.keywords) ? specs.keywords.filter((value): value is string => typeof value === 'string') : [];
  const imageUrl = row.image_url || row.image_urls?.[0] || '';
  const trackingUrl = row.affiliate_url || row.product_url || '';
  if (!row.name || !imageUrl || !trackingUrl) return null;

  return {
    id: String(row.id || `${advertiser}-${row.external_id || row.slug || row.name}`),
    externalId: row.external_id ? String(row.external_id) : undefined,
    advertiser,
    advertiserName: relationName(row.affiliate_advertisers),
    name: String(row.name),
    price: String(row.price || ''),
    priceOriginal: typeof row.price_original === 'number' ? row.price_original : null,
    imageUrl,
    trackingUrl,
    productUrl: row.product_url || undefined,
    description: row.short_description || row.description || '',
    keywords: specKeywords.length > 0 ? specKeywords : generatedKeywords(row.name, row.short_description, row.description, row.category),
    category: String(row.category || specs.category || 'redskap'),
    inStock: row.in_stock !== false,
    source: 'database',
  };
}

function productKey(product: SmartAffiliateProduct): string {
  return `${product.advertiser}:${product.externalId || product.id}`;
}

export function mergeCatalog(databaseProducts: SmartAffiliateProduct[]): SmartAffiliateProduct[] {
  const merged = new Map<string, SmartAffiliateProduct>();
  for (const fallback of FALLBACK_AFFILIATE_CATALOG) merged.set(productKey(fallback), fallback);
  for (const live of databaseProducts) {
    const key = productKey(live);
    const fallback = merged.get(key);
    merged.set(key, {
      ...fallback,
      ...live,
      keywords: live.keywords.length > 0 ? live.keywords : fallback?.keywords ?? [],
      description: live.description || fallback?.description || '',
      imageUrl: live.imageUrl || fallback?.imageUrl || '',
      trackingUrl: live.trackingUrl || fallback?.trackingUrl || '',
    });
  }
  return Array.from(merged.values()).filter((product) => product.inStock !== false && Boolean(product.imageUrl) && Boolean(product.trackingUrl));
}
