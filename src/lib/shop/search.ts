/** Local relevance for the small shop catalog; no query logging or remote index. */
export interface SearchProduct {
  name: string;
  category: string | null;
  description: string;
  price_ore: number;
  featured: boolean;
  sort_order: number | null;
}

export type ShopSort = 'featured' | 'price_asc' | 'price_desc' | 'newest';

export function normalizeShopText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const SYNONYMS = [
  ['honsfoder', 'foder'],
  ['rede', 'varprede'],
  ['vattenautomat', 'vattenbehallare'],
] as const;

function alternatives(token: string): readonly string[] {
  return SYNONYMS.find((group) => group.some((word) => word === token)) ?? [token];
}

function matchQuality(field: string, token: string): number {
  const words = field.split(' ');
  let best = 0;
  for (const alias of alternatives(token)) {
    if (words.includes(alias)) best = Math.max(best, alias === token ? 3 : 2);
    else if (words.some((word) => word.startsWith(alias))) best = Math.max(best, 1);
    // Swedish compounds: "kartong" matches "äggkartong", "foder" matches "kycklingfoder".
    else if (words.some((word) => word.includes(alias))) best = Math.max(best, 0.5);
  }
  return best;
}

/** Every query token must match. Name outranks category, then description. */
export function shopRelevance(product: SearchProduct, query: string): number {
  const normalized = normalizeShopText(query);
  if (!normalized) return 0;
  const fields = [product.name, product.category ?? '', product.description].map(normalizeShopText);
  let weakestField = 3;
  let quality = 0;
  for (const token of new Set(normalized.split(' '))) {
    const fieldIndex = fields.findIndex((field) => matchQuality(field, token) > 0);
    if (fieldIndex < 0) return 0;
    weakestField = Math.max(weakestField === 3 ? fieldIndex : weakestField, fieldIndex);
    quality += matchQuality(fields[fieldIndex], token);
  }
  const exactName = fields[0] === normalized;
  return (3 - weakestField) * 1000 + (exactName ? 500 : 0) + Math.min(quality, 99);
}

function compareProducts(a: SearchProduct, b: SearchProduct, sort: ShopSort): number {
  switch (sort) {
    case 'price_asc': return a.price_ore - b.price_ore;
    case 'price_desc': return b.price_ore - a.price_ore;
    case 'newest': return (b.sort_order ?? 0) - (a.sort_order ?? 0);
    default: return Number(b.featured) - Number(a.featured) || (a.sort_order ?? 0) - (b.sort_order ?? 0);
  }
}

export function searchShopProducts<T extends SearchProduct>(
  products: readonly T[], query = '', category = 'all', sort: ShopSort = 'featured',
): T[] {
  const hasQuery = normalizeShopText(query).length > 0;
  return products.map((product, index) => ({ product, index, score: shopRelevance(product, query) }))
    .filter(({ product, score }) => (category === 'all' || product.category === category) && (!hasQuery || score > 0))
    .sort((a, b) => (hasQuery && sort === 'featured' ? b.score - a.score : 0)
      || compareProducts(a.product, b.product, sort) || a.index - b.index)
    .map(({ product }) => product);
}

/** Suggestions come only from the current catalog, never invented products. */
export function shopSearchSuggestions(products: readonly SearchProduct[], category = 'all'): string[] {
  const selected = products.filter((p) => category === 'all' || p.category === category);
  return [...new Set(selected.map((p) => p.name))].slice(0, 3);
}