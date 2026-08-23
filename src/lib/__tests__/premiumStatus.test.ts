import { describe, expect, it } from 'vitest';
import {
  hasActiveLocalPremium,
  parseTimestamp,
  resolvePremiumType,
  shouldClearLocalPremium,
} from '@/lib/premiumStatus';

const now = new Date('2026-08-23T17:10:00.000Z');
const inSevenDays = '2026-08-30T17:04:08.2697+00:00';
const postgresStyle = '2026-08-30 17:04:08.2697+00';
const expired = '2026-08-20T12:00:00.000Z';

describe('parseTimestamp', () => {
  it('accepts ISO and Postgres-style timestamptz', () => {
    expect(parseTimestamp(inSevenDays)?.toISOString()).toBe('2026-08-30T17:04:08.269Z');
    expect(parseTimestamp(postgresStyle)?.getTime()).toBeGreaterThan(now.getTime());
    expect(parseTimestamp('2026-08-30T17:04:08.2697+00')?.getTime()).toBeGreaterThan(now.getTime());
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp('not-a-date')).toBeNull();
  });
});

describe('hasActiveLocalPremium', () => {
  it('is true only for a parseable future expiry', () => {
    expect(hasActiveLocalPremium(inSevenDays, now)).toBe(true);
    expect(hasActiveLocalPremium(postgresStyle, now)).toBe(true);
    expect(hasActiveLocalPremium(expired, now)).toBe(false);
    expect(hasActiveLocalPremium(null, now)).toBe(false);
  });
});

describe('shouldClearLocalPremium', () => {
  it('never clears an active 7-day signup trial', () => {
    expect(shouldClearLocalPremium({
      subscriptionStatus: 'premium',
      premiumExpiresAt: postgresStyle,
      now,
    })).toBe(false);
  });

  it('never clears an unparseable expiry (avoid wiping a valid grant)', () => {
    expect(shouldClearLocalPremium({
      subscriptionStatus: 'premium',
      premiumExpiresAt: 'not-a-date',
      now,
    })).toBe(false);
  });

  it('clears expired or already-null leftover premium', () => {
    expect(shouldClearLocalPremium({
      subscriptionStatus: 'premium',
      premiumExpiresAt: expired,
      now,
    })).toBe(true);
    expect(shouldClearLocalPremium({
      subscriptionStatus: 'premium',
      premiumExpiresAt: null,
      now,
    })).toBe(true);
  });
});

describe('resolvePremiumType', () => {
  it('treats a local future expiry as trial even when Stripe sync failed', () => {
    expect(resolvePremiumType({
      profileExpiry: postgresStyle,
      synced: false,
      subscribed: false,
      now,
    })).toBe('trial');
  });

  it('treats a local future expiry as trial when sync returns free', () => {
    expect(resolvePremiumType({
      profileExpiry: inSevenDays,
      synced: true,
      subscribed: false,
      syncedPremiumType: 'free',
      now,
    })).toBe('trial');
  });

  it('keeps Stripe paid / lifetime ahead of local trial', () => {
    expect(resolvePremiumType({
      isLifetime: true,
      profileExpiry: inSevenDays,
      now,
    })).toBe('lifetime');
    expect(resolvePremiumType({
      profileExpiry: inSevenDays,
      synced: true,
      subscribed: true,
      syncedPremiumType: 'paid',
      subscriptionEnd: '2026-09-23T00:00:00.000Z',
      now,
    })).toBe('paid');
  });

  it('is free when there is no local or synced entitlement', () => {
    expect(resolvePremiumType({
      profileExpiry: null,
      synced: true,
      subscribed: false,
      syncedPremiumType: 'free',
      now,
    })).toBe('free');
  });
});
