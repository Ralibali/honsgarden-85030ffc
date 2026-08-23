export type PremiumType = 'free' | 'trial' | 'paid' | 'lifetime';

export type PremiumEntryInput = {
  premiumType?: PremiumType | null;
  subscriptionEnd?: string | null;
  now?: Date;
};

export type PremiumEntryState = {
  isPaidPremium: boolean;
  isTrialing: boolean;
  hasPlusAccess: boolean;
  showFreeTrialCta: boolean;
  showTrialStatus: boolean;
  showManageSubscription: boolean;
  allowPaidCheckout: boolean;
  trialDaysLeft: number | null;
};

export function daysUntil(end: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!end) return null;
  const expiry = typeof end === 'string' ? new Date(end) : end;
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * CTA-branching for Plus/Premium entry points.
 * Active trial already has Plus access — never offer a new free trial.
 */
export function getPremiumEntryState(input: PremiumEntryInput = {}): PremiumEntryState {
  const premiumType = input.premiumType ?? 'free';
  const isPaidPremium = premiumType === 'paid' || premiumType === 'lifetime';
  const isTrialing = premiumType === 'trial';
  const hasPlusAccess = isPaidPremium || isTrialing;

  return {
    isPaidPremium,
    isTrialing,
    hasPlusAccess,
    showFreeTrialCta: !hasPlusAccess,
    showTrialStatus: isTrialing,
    showManageSubscription: hasPlusAccess,
    allowPaidCheckout: !isPaidPremium,
    trialDaysLeft: isTrialing ? daysUntil(input.subscriptionEnd, input.now) : null,
  };
}
