import { describe, expect, it } from 'vitest';
import {
  APPLE_IAP_PRODUCTS,
  appleStateFromPayload,
  assertAppleAccountToken,
  independentPremiumExpiry,
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
        verified: true,
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
      bundleId: 'se.honsgarden.app',
      productId: APPLE_IAP_PRODUCTS.monthly,
      originalTransactionId: 'ot-1',
      revocationDate: Date.parse('2026-08-26T00:00:00.000Z'),
    }, now)).toThrow(/revoked/);
    expect(() => entitlementFromApplePayload({
      bundleId: 'se.honsgarden.app',
      productId: 'com.other.app.plus',
      originalTransactionId: 'ot-1',
      expiresDate: Date.parse('2026-09-01T00:00:00.000Z'),
    }, now)).toThrow(/Unknown/);
  });
});

const purchase = {
  bundleId: 'se.honsgarden.app', productId: APPLE_IAP_PRODUCTS.monthly,
  originalTransactionId: 'original', transactionId: 'renewal-1',
  type: 'Auto-Renewable Subscription', environment: 'Production',
  signedDate: now.getTime(), expiresDate: now.getTime() + 86400000,
  appAccountToken: '11111111-1111-4111-8111-111111111111',
};
describe('verified Apple billing states', () => {
  it('requires the signed account to match the signed-in user', () => {
    expect(() => assertAppleAccountToken(purchase, purchase.appAccountToken)).not.toThrow();
    expect(() => assertAppleAccountToken(purchase, 'another-user')).toThrow(/another account/);
    expect(() => assertAppleAccountToken({...purchase, appAccountToken: undefined}, purchase.appAccountToken)).toThrow();
  });
  it.each([
    {bundleId: undefined}, {bundleId: 'another.app'}, {productId: 'another.product'},
    {type: 'Consumable'}, {environment: 'Xcode'}, {transactionId: undefined},
    {signedDate: undefined}, {signedDate: now.getTime() + 600000}, {expiresDate: undefined},
  ])('rejects an incomplete or unrelated transaction: %j', override => {
    expect(() => appleStateFromPayload({...purchase, ...override}, now)).toThrow();
  });
  it('accepts expired state without granting access', () => {
    const state = appleStateFromPayload({...purchase, expiresDate: now.getTime() - 1000}, now);
    expect(isAppleIapActive(state, now, parseTimestamp)).toBe(false);
  });
  it('revokes access on a refund even if the receipt still has future expiry', () => {
    const state = appleStateFromPayload(purchase, now, {type: 'REFUND', signedDate: now.getTime()});
    expect(state.revoked_at).toBe(now.toISOString());
    expect(isAppleIapActive(state, now, parseTimestamp)).toBe(false);
  });
  it('does not trust legacy or forged client metadata', () => {
    const state = appleStateFromPayload(purchase, now);
    expect(isAppleIapActive({...state, verified: undefined}, now, parseTimestamp)).toBe(false);
  });
  it('does not reinterpret cached Apple access as a trial after a refund', () => {
    const state = appleStateFromPayload(purchase, now);
    expect(independentPremiumExpiry({apple_iap: state}, state.expires_at)).toBeNull();
    const gift = new Date(now.getTime() + 60000).toISOString();
    expect(independentPremiumExpiry({apple_iap: {...state, previous_premium_expires_at: gift}}, state.expires_at)).toBe(gift);
    expect(independentPremiumExpiry({apple_iap: state}, gift)).toBe(gift);
  });
});
