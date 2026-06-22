// Quantity-based price tiers for a säljlista.
// A tier covers [min_qty .. max_qty] kartor with a given price per karta.
// max_qty = null means "no upper limit" (typically the last tier, e.g. 11+).

export type PriceTier = {
  min_qty: number;
  max_qty: number | null;
  price_per_pack: number;
};

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sanitize a raw value (jsonb from DB or user input) into a clean, sorted
 * list of tiers. Invalid entries are dropped; negatives are clamped to 0.
 */
export function normalizeTiers(raw: unknown): PriceTier[] {
  if (!Array.isArray(raw)) return [];
  const tiers: PriceTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const minRaw = (item as any).min_qty;
    const maxRaw = (item as any).max_qty;
    const priceRaw = (item as any).price_per_pack;
    const min = Math.max(1, Math.floor(toNum(minRaw) || 1));
    const max =
      maxRaw === null || maxRaw === undefined || maxRaw === ''
        ? null
        : Math.max(min, Math.floor(toNum(maxRaw)));
    const price = Math.max(0, toNum(priceRaw));
    if (price <= 0) continue;
    tiers.push({ min_qty: min, max_qty: max, price_per_pack: price });
  }
  tiers.sort((a, b) => a.min_qty - b.min_qty);
  return tiers;
}

/**
 * Return the price per karta for a given quantity. Falls back to `fallback`
 * when no tier matches (or when the tier list is empty).
 */
export function getPricePerPack(
  qty: number,
  tiers: PriceTier[],
  fallback: number,
): number {
  if (!tiers.length) return fallback;
  const q = Math.max(1, Math.floor(qty || 1));
  // Walk from highest min_qty down so 11+ wins over 6-10 etc.
  for (let i = tiers.length - 1; i >= 0; i--) {
    const t = tiers[i];
    if (q >= t.min_qty && (t.max_qty === null || q <= t.max_qty)) {
      return t.price_per_pack;
    }
  }
  return fallback;
}

/** Total amount in kronor for `qty` kartor. */
export function getOrderTotal(
  qty: number,
  tiers: PriceTier[],
  fallback: number,
): number {
  const q = Math.max(1, Math.floor(qty || 1));
  return Math.round(q * getPricePerPack(q, tiers, fallback));
}

/** Human label for a tier, e.g. "1–5 kartor" or "11+ kartor". */
export function formatTierRange(tier: PriceTier): string {
  if (tier.max_qty === null) return `${tier.min_qty}+ kartor`;
  if (tier.max_qty === tier.min_qty) return `${tier.min_qty} kartor`;
  return `${tier.min_qty}–${tier.max_qty} kartor`;
}
