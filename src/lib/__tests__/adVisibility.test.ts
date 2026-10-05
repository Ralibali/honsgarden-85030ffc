import { describe, expect, it } from 'vitest';
import { shouldShowAds } from '@/lib/adVisibility';

describe('shouldShowAds', () => {
  it('shows ads to signed-out visitors and free accounts', () => {
    expect(shouldShowAds({ loading: false, premiumResolved: true, isPremium: false })).toBe(true);
  });

  it('never shows ads to Plus customers', () => {
    expect(shouldShowAds({ loading: false, premiumResolved: true, isPremium: true })).toBe(false);
  });

  it('waits for auth and the Plus check so paying customers never see a flash of ads', () => {
    expect(shouldShowAds({ loading: true, premiumResolved: true, isPremium: false })).toBe(false);
    expect(shouldShowAds({ loading: false, premiumResolved: false, isPremium: false })).toBe(false);
  });
});
