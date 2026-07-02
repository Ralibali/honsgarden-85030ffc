/**
 * Kända legacy-priser (19 kr/mån, 149 kr/år) från tidigare prissättning.
 * Används för att visa "gamla priset gäller för alltid"-meddelandet till
 * användare som prenumererar på ett av dessa priser. Nya priser (39/299 kr)
 * konfigureras via STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY.
 */
export const LEGACY_PRICE_IDS: readonly string[] = [
  'price_1T3joGHzffTezY82dRQc7GTO', // 19 kr / månad (legacy)
  'price_1T3jwRHzffTezY829aWQVXZr', // 149 kr / år (legacy)
];

export function isLegacyPriceId(priceId?: string | null): boolean {
  return !!priceId && LEGACY_PRICE_IDS.includes(priceId);
}
