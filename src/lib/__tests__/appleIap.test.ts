import { describe, expect, it } from 'vitest';
import {
  APPLE_IAP_PRODUCTS,
  entitlementFromApplePayload,
  isAppleIapActive,
  isIosCheckoutBlocked,
  isKnownAppleProductId,
  mergeAppleIapPreference,
  pickLatestAppleEntitlement,
  planFromProductId,
  readAppleIapPreference,
  resolveEntitlement,
} from '../../../supabase/functions/_shared/appleIap';
import { parseTimestamp } from '../../../supabase/functions/_shared/localPremium';

const now = new Date('2026-08-27T12:00:00.000Z');

describe('Apple IAP product ids', () => {
  it('maps monthly and yearly Plus products and rejects unknowns', () => {
    expect(planFromProductId(APPLE_IAP_PRODUCTS.monthly)).toBe('monthly');
    expect(planFromProductId(APPLE_IAP_PRODUCTS.yearly)).toBe('yearly');
    expect(isKnownAppleProductId('price_stripe')).toBe(false);
  });
});

describe('isIosCheckoutBlocked', () => {
  it('blocks Stripe checkout when the Capacitor iOS platform is present', () => {
    expect(isIosCheckoutBlocked('ios', undefined)).toBe(true);
    expect(isIosCheckoutBlocked(null, 'ios')).toBe(true);
    expect(isIosCheckoutBlocked('web', 'monthly')).toBe(false);
  });
});

describe('resolveEntitlement', () => {
  it('keeps Stripe web Plus as paid when there is no Apple purchase', () => {
    const result = resolveEntitlement({
      hasLifetime: false,
      stripePaid: true,
      stripeEnd: '2026-09-27T12:00:00.000Z',
      applePaid: false,
      appleEnd: null,
      localTrialActive: true,
      localTrialEnd: '2026-08-30T12:00:00.000Z',
    });
    expect(result).toMatchObject({
      subscribed: true,
      premium_type: 'paid',
      source: 'stripe',
      subscription_end: '2026-09-27T12:00:00.000Z',
    });
  });

  it('treats a live Apple subscription as paid so it is not shown as a trial', () => {
    const result = resolveEntitlement({
      hasLifetime: false,
      stripePaid: false,
      stripeEnd: null,
      applePaid: true,
      appleEnd: '2026-09-27T12:00:00.000Z',
      localTrialActive: true,
      localTrialEnd: '2026-08-30T12:00:00.000Z',
    });
    expect(result.source).toBe('apple');
    expect(result.premium_type).toBe('paid');
  });
});

describe('apple IAP preference helpers', () => {
  it('round-trips the preference blob without dropping other keys', () => {
    const merged = mergeAppleIapPreference(
      { weekly_report_email: true },
      {
        original_transaction_id: '100000',
        product_id: APPLE_IAP_PRODUCTS.yearly,
        expires_at: '2026-09-27T12:00:00.000Z',
        updated_at: now.toISOString(),
      },
    );
    expect(merged.weekly_report_email).toBe(true);
    const read = readAppleIapPreference(merged);
    expect(isAppleIapActive(read, now, parseTimestamp)).toBe(true);
  });
});

describe('Apple transaction payload rules', () => {
  it('accepts a matching Plus transaction and picks the later expiry', () => {
    const monthly = entitlementFromApplePayload({
      bundleId: 'se.honsgarden.app',
      productId: APPLE_IAP_PRODUCTS.monthly,
      originalTransactionId: 'ot-1',
      expiresDate: Date.parse('2026-09-01T00:00:00.000Z'),
    }, now);
    const yearly = entitlementFromApplePayload({
      bundleId: 'se.honsgarden.app',
      productId: APPLE_IAP_PRODUCTS.yearly,
      originalTransactionId: 'ot-2',
      expiresDate: Date.parse('2027-08-27T00:00:00.000Z'),
    }, now);
    expect(pickLatestAppleEntitlement([monthly, yearly])?.product_id).toBe(APPLE_IAP_PRODUCTS.yearly);
  });

  it('rejects revoked or unknown products', () => {
    expect(() => entitlementFromApplePayload({
      productId: APPLE_IAP_PRODUCTS.monthly,
      originalTransactionId: 'ot-1',
      revocationDate: Date.parse('2026-08-26T00:00:00.000Z'),
    }, now)).toThrow(/revoked/);
    expect(() => entitlementFromApplePayload({
      productId: 'com.other.app.plus',
      originalTransactionId: 'ot-1',
      expiresDate: Date.parse('2026-09-01T00:00:00.000Z'),
    }, now)).toThrow(/Unknown/);
  });
});
