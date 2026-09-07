// Dependency-free rules shared by checkout, status checks and webhook handling.
export const LEGACY_PLUS_PRICE_IDS = ['price_1T3joGHzffTezY82dRQc7GTO', 'price_1T3jwRHzffTezY829aWQVXZr'];
type BillingSubscription = {
  status: string;
  current_period_end?: number;
  items?: { data: Array<{ current_period_end?: number; price?: { id?: string } }> };
};
export function plusPriceIds(monthly?: string, yearly?: string): string[] {
  return [...LEGACY_PLUS_PRICE_IDS, monthly, yearly].filter((id): id is string => !!id);
}
export function isPlusSubscription(subscription: BillingSubscription, prices: string[]): boolean {
  return !!subscription.items?.data.some(item => !!item.price?.id && prices.includes(item.price.id));
}
export function stripePeriodEnd(subscription: BillingSubscription): string | null {
  const ends = (subscription.items?.data ?? []).map(item => item.current_period_end).filter((end): end is number => typeof end === 'number' && Number.isFinite(end));
  const end = ends.length ? Math.max(...ends) : subscription.current_period_end;
  return typeof end === 'number' && Number.isFinite(end) && end > 0 ? new Date(end * 1000).toISOString() : null;
}
export function stripeAccessActive(subscription: BillingSubscription, now = new Date()): boolean {
  if (subscription.status === 'active' || subscription.status === 'trialing') return true;
  const end = stripePeriodEnd(subscription);
  return subscription.status === 'past_due' && !!end && new Date(end) > now;
}
