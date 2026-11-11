import { describe, expect, it } from 'vitest';
import { stripeEntitlement, type StripeLookup } from '../../../supabase/functions/_shared/premiumExpiry';

const NOW = new Date('2026-11-10T12:00:00Z');
const epoch = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const sub = (status: string, endsAt: string) => ({
  status,
  items: { data: [{ current_period_end: epoch(endsAt), price: { id: 'price_plus' } }] },
});

/** Stripe i minnet: kunder per e-post, prenumerationer per kund-id. */
function fakeStripe(data: {
  byEmail?: Record<string, string[]>;
  subscriptions?: Record<string, ReturnType<typeof sub>[]>;
  failFor?: Record<string, unknown>;
}) {
  const calls: string[] = [];
  const stripe: StripeLookup = {
    customers: {
      list: async ({ email }) => {
        calls.push(`customers:${email}`);
        return { data: (data.byEmail?.[email] ?? []).map((id) => ({ id })) };
      },
    },
    subscriptions: {
      list: async ({ customer, status }) => {
        calls.push(`subscriptions:${customer}:${status}`);
        if (data.failFor?.[customer]) throw data.failFor[customer];
        return { data: data.subscriptions?.[customer] ?? [] };
      },
    },
  };
  return { stripe, calls };
}

describe('stripeEntitlement', () => {
  it('hittar en betalande kund via sparat kund-id även när e-posten inte matchar', async () => {
    const { stripe } = fakeStripe({
      byEmail: {},
      subscriptions: { cus_saved: [sub('active', '2026-12-01T00:00:00Z')] },
    });
    const result = await stripeEntitlement(stripe, { email: 'ny-adress@example.test', stripe_customer_id: 'cus_saved' }, NOW);
    expect(result).toEqual({ entitled: true, periodEnd: '2026-12-01T00:00:00.000Z' });
  });

  it('räknar provperiod och förfallen betalning inom perioden som åtkomst', async () => {
    for (const status of ['trialing', 'past_due']) {
      const { stripe } = fakeStripe({
        byEmail: { 'a@example.test': ['cus_a'] },
        subscriptions: { cus_a: [sub(status, '2026-11-20T00:00:00Z')] },
      });
      const result = await stripeEntitlement(stripe, { email: 'a@example.test' }, NOW);
      expect(result.entitled, status).toBe(true);
      expect(result.periodEnd, status).toBe('2026-11-20T00:00:00.000Z');
    }
  });

  it('ger ingen åtkomst för avslutade, obetalda eller utgångna prenumerationer', async () => {
    const { stripe } = fakeStripe({
      byEmail: { 'a@example.test': ['cus_a'] },
      subscriptions: {
        cus_a: [
          sub('canceled', '2026-12-01T00:00:00Z'),
          sub('unpaid', '2026-12-01T00:00:00Z'),
          sub('incomplete', '2026-12-01T00:00:00Z'),
          sub('past_due', '2026-11-01T00:00:00Z'),
        ],
      },
    });
    expect(await stripeEntitlement(stripe, { email: 'a@example.test' }, NOW)).toEqual({ entitled: false, periodEnd: null });
  });

  it('väljer det senaste slutdatumet när flera kunder och prenumerationer finns', async () => {
    const { stripe, calls } = fakeStripe({
      byEmail: { 'a@example.test': ['cus_saved', 'cus_dubblett'] },
      subscriptions: {
        cus_saved: [sub('canceled', '2027-01-01T00:00:00Z'), sub('active', '2026-11-15T00:00:00Z')],
        cus_dubblett: [sub('active', '2026-12-15T00:00:00Z')],
      },
    });
    const result = await stripeEntitlement(stripe, { email: 'a@example.test', stripe_customer_id: 'cus_saved' }, NOW);
    expect(result).toEqual({ entitled: true, periodEnd: '2026-12-15T00:00:00.000Z' });
    // Samma kund via id och e-post frågas bara en gång.
    expect(calls.filter((call) => call.startsWith('subscriptions:cus_saved'))).toHaveLength(1);
  });

  it('går vidare till e-postuppslaget när det sparade kund-id:t är raderat i Stripe', async () => {
    const { stripe } = fakeStripe({
      byEmail: { 'a@example.test': ['cus_ny'] },
      subscriptions: { cus_ny: [sub('active', '2026-12-01T00:00:00Z')] },
      failFor: { cus_raderad: { code: 'resource_missing', statusCode: 404 } },
    });
    const result = await stripeEntitlement(stripe, { email: 'a@example.test', stripe_customer_id: 'cus_raderad' }, NOW);
    expect(result.entitled).toBe(true);
  });

  it('kastar vidare andra Stripe-fel så att ingen nedgraderas på en gissning', async () => {
    const { stripe } = fakeStripe({
      byEmail: { 'a@example.test': ['cus_a'] },
      failFor: { cus_a: Object.assign(new Error('rate limited'), { statusCode: 429 }) },
    });
    await expect(stripeEntitlement(stripe, { email: 'a@example.test' }, NOW)).rejects.toThrow('rate limited');
  });

  it('svarar nej utan att fråga Stripe när profilen varken har e-post eller kund-id', async () => {
    const { stripe, calls } = fakeStripe({});
    expect(await stripeEntitlement(stripe, { email: null, stripe_customer_id: null }, NOW)).toEqual({ entitled: false, periodEnd: null });
    expect(calls).toEqual([]);
  });
});
