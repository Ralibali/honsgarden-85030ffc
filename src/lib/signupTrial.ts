import { hasActiveLocalPremium, type PremiumType } from '@/lib/premiumStatus';

/**
 * Real entitlement on this schema: subscription_status + future premium_expires_at.
 * There is no profiles.premium_type column; check-subscription maps this to premium_type=trial.
 */
export function profileHasSignupTrial(input: {
  subscriptionStatus?: string | null;
  premiumExpiresAt?: string | null;
  isLifetime?: boolean | null;
  now?: Date;
}): boolean {
  if (input.isLifetime) return false;
  if (input.subscriptionStatus !== 'premium') return false;
  return hasActiveLocalPremium(input.premiumExpiresAt, input.now ?? new Date());
}

export function isConfirmedSignupTrial(input: {
  premiumType?: PremiumType | string | null;
  subscriptionEnd?: string | null;
  now?: Date;
}): boolean {
  return input.premiumType === 'trial' && hasActiveLocalPremium(input.subscriptionEnd, input.now ?? new Date());
}

export function signupResultToast(input: {
  trialConfirmed: boolean;
  hasReferral?: boolean;
}): { title: string; description: string } {
  if (!input.trialConfirmed) {
    return {
      title: 'Konto skapat!',
      description: 'Logga in för att komma igång med Hönsgården.',
    };
  }

  return {
    title: 'Konto skapat!',
    description: input.hasReferral
      ? 'Du har sju dagars gratis Premium. Värvningsbonusen aktiveras när du börjar använda appen. 🥚'
      : 'Du har fått sju dagars gratis Premium! 🎉',
  };
}
