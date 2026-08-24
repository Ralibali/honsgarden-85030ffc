import { describe, expect, it } from 'vitest';
import { daysUntil, getPremiumEntryState } from '../premiumEntry';

const now = new Date('2026-08-23T12:00:00.000Z');

describe('getPremiumEntryState', () => {
  it('lets free / eligible users see the free-trial CTA', () => {
    for (const premiumType of [undefined, null, 'free'] as const) {
      const state = getPremiumEntryState({ premiumType });
      expect(state.showFreeTrialCta).toBe(true);
      expect(state.showTrialStatus).toBe(false);
      expect(state.allowPaidCheckout).toBe(true);
      expect(state.showManageSubscription).toBe(false);
    }
  });

  it('never offers a new free trial while an active trial is running', () => {
    const state = getPremiumEntryState({
      premiumType: 'trial',
      subscriptionEnd: '2026-08-27T12:00:00.000Z',
      now,
    });

    expect(state.isTrialing).toBe(true);
    expect(state.hasPlusAccess).toBe(true);
    expect(state.showFreeTrialCta).toBe(false);
    expect(state.showTrialStatus).toBe(true);
    expect(state.showManageSubscription).toBe(true);
    expect(state.allowPaidCheckout).toBe(true);
    expect(state.trialDaysLeft).toBe(4);
  });

  it('treats paid and lifetime as Plus without free-trial CTAs', () => {
    for (const premiumType of ['paid', 'lifetime'] as const) {
      const state = getPremiumEntryState({ premiumType });
      expect(state.showFreeTrialCta).toBe(false);
      expect(state.showTrialStatus).toBe(false);
      expect(state.allowPaidCheckout).toBe(false);
      expect(state.showManageSubscription).toBe(true);
    }
  });
});

describe('daysUntil', () => {
  it('returns remaining calendar days, floored at zero', () => {
    expect(daysUntil('2026-08-26T12:00:00.000Z', now)).toBe(3);
    expect(daysUntil('2026-08-20T12:00:00.000Z', now)).toBe(0);
    expect(daysUntil(null, now)).toBeNull();
  });
});
