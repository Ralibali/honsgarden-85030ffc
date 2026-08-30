import { describe, it, expect } from 'vitest';
import {
  PLANS,
  CAPABILITIES,
  capabilitiesForPremiumType,
  hasCapability,
  getFlaggedCapabilities,
  formatPlanPrice,
  PLUS_YEARLY_MONTHLY_EQUIVALENT_SEK,
} from '../entitlements';

describe('canonical plan catalog (frozen public pricing)', () => {
  it('keeps current public prices: free 0, plus 39/mån, 299/år', () => {
    expect(PLANS.free.priceSek).toBe(0);
    expect(PLANS.plus_monthly.priceSek).toBe(39);
    expect(PLANS.plus_monthly.billing).toBe('monthly');
    expect(PLANS.plus_yearly.priceSek).toBe(299);
    expect(PLANS.plus_yearly.billing).toBe('yearly');
  });

  it('has no public lifetime plan (grandfathered only, never launched)', () => {
    expect(Object.keys(PLANS)).not.toContain('lifetime');
    expect(Object.values(PLANS).map((p) => p.billing)).not.toContain('lifetime');
  });

  it('computes yearly/monthly equivalent instead of hardcoding it', () => {
    expect(PLUS_YEARLY_MONTHLY_EQUIVALENT_SEK).toBeCloseTo(24.92, 2);
  });

  it('formats display prices in SEK', () => {
    expect(formatPlanPrice(PLANS.free)).toBe('0 kr');
    expect(formatPlanPrice(PLANS.plus_monthly)).toBe('39 kr/mån');
    expect(formatPlanPrice(PLANS.plus_yearly)).toBe('299 kr/år');
  });
});

describe('capability mapping', () => {
  it('grants all plus capabilities to paid, trial and grandfathered lifetime', () => {
    for (const type of ['paid', 'trial', 'lifetime'] as const) {
      const caps = capabilitiesForPremiumType(type);
      for (const cap of ['hen_limit', 'agda_access', 'advanced_analytics', 'advanced_reminders', 'reports', 'hatch_tracking', 'seller_features'] as const) {
        expect(caps.has(cap), `${type} should have ${cap}`).toBe(true);
      }
    }
  });

  it('grants nothing to free/unknown', () => {
    expect(capabilitiesForPremiumType('free').size).toBe(0);
    expect(capabilitiesForPremiumType(null).size).toBe(0);
    expect(capabilitiesForPremiumType(undefined).size).toBe(0);
  });

  it('never auto-grants future_* capabilities to any tier', () => {
    for (const type of ['free', 'trial', 'paid', 'lifetime'] as const) {
      expect(capabilitiesForPremiumType(type).has('future_native_entitlements')).toBe(false);
      expect(capabilitiesForPremiumType(type).has('future_beta_features')).toBe(false);
    }
  });
});

describe('hasCapability adapter', () => {
  it('accepts a raw premium type', () => {
    expect(hasCapability('paid', 'agda_access')).toBe(true);
    expect(hasCapability('free', 'agda_access')).toBe(false);
  });

  it('accepts a UserProfile-shaped subject', () => {
    expect(hasCapability({ premium_type: 'trial' }, 'seller_features')).toBe(true);
    expect(hasCapability({ premium_type: 'free' }, 'seller_features')).toBe(false);
    expect(hasCapability(null, 'reports')).toBe(false);
  });

  it('grandfathered lifetime keeps full access', () => {
    expect(hasCapability({ premium_type: 'lifetime' }, 'advanced_analytics')).toBe(true);
  });
});

describe('feature flags', () => {
  it('flags are opt-in and empty by default', () => {
    expect(getFlaggedCapabilities().size).toBe(0);
  });

  it('capability list is stable and complete', () => {
    expect(CAPABILITIES).toHaveLength(9);
    expect(new Set(CAPABILITIES).size).toBe(9);
  });
});
