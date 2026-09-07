import { describe, expect, it } from 'vitest';
import { isPlusSubscription, plusPriceIds, stripeAccessActive, stripePeriodEnd } from '../../../supabase/functions/_shared/stripeBilling';
const now = new Date('2026-09-01T00:00:00Z');
const future = Date.parse('2026-10-01T00:00:00Z') / 1000;
describe('Stripe Plus billing', () => {
  it('reads the subscription item period used by the Basil API', () => {
    expect(stripePeriodEnd({status:'active',items:{data:[{current_period_end:future}]}})).toBe('2026-10-01T00:00:00.000Z');
  });
  it('supports older subscription payloads', () => {
    expect(stripePeriodEnd({status:'active',current_period_end:future})).toBe('2026-10-01T00:00:00.000Z');
  });
  it('does not grant Plus for another product in the same Stripe account', () => {
    const prices=plusPriceIds('price_month','price_year');
    expect(isPlusSubscription({status:'active',items:{data:[{price:{id:'unrelated'}}]}},prices)).toBe(false);
    expect(isPlusSubscription({status:'active',items:{data:[{price:{id:'price_month'}}]}},prices)).toBe(true);
  });
  it('limits past-due access to the current period', () => {
    expect(stripeAccessActive({status:'past_due',current_period_end:future},now)).toBe(true);
    expect(stripeAccessActive({status:'past_due',current_period_end:1},now)).toBe(false);
    expect(stripeAccessActive({status:'past_due'},now)).toBe(false);
    expect(stripeAccessActive({status:'canceled',current_period_end:future},now)).toBe(false);
  });
});
