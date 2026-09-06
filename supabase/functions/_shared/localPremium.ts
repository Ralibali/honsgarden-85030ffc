// Shared by check-subscription (Deno) and vitest. Keep this file dependency-free.

export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const normalized = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasActiveLocalPremium(
  expiry: string | null | undefined,
  now: Date,
): boolean {
  const date = parseTimestamp(expiry);
  return !!date && date > now;
}

export function shouldClearLocalPremium(
  subscriptionStatus: string | null | undefined,
  premiumExpiresAt: string | null | undefined,
  now: Date,
): boolean {
  if (hasActiveLocalPremium(premiumExpiresAt, now)) return false;
  if (premiumExpiresAt && !parseTimestamp(premiumExpiresAt)) return false;
  return subscriptionStatus === "premium" || !!premiumExpiresAt;
}

const SIGNUP_TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Trial window is created_at + 7 days so a late repair does not extend past the promised period. */
export function signupTrialEndFromCreatedAt(
  createdAt: string | null | undefined,
): string | null {
  const created = parseTimestamp(createdAt);
  if (!created) return null;
  return new Date(created.getTime() + SIGNUP_TRIAL_MS).toISOString();
}

/**
 * Repair a missing 7-day signup trial for a never-paid new account.
 * Does not re-grant after a parseable (used/expired) expiry, Stripe customer, Apple IAP, or lifetime.
 */
export function shouldGrantSignupTrial(input: {
  isLifetime?: boolean;
  stripeCustomerId?: string | null;
  applePaid?: boolean;
  premiumExpiresAt?: string | null;
  userCreatedAt?: string | null;
  now?: Date;
}): { grant: true; expiresAt: string } | { grant: false } {
  const now = input.now ?? new Date();
  if (input.isLifetime) return { grant: false };
  if (input.applePaid) return { grant: false };
  if (input.stripeCustomerId) return { grant: false };
  if (hasActiveLocalPremium(input.premiumExpiresAt, now)) return { grant: false };

  const existingExpiry = parseTimestamp(input.premiumExpiresAt);
  if (existingExpiry) return { grant: false };

  const expiresAt = signupTrialEndFromCreatedAt(input.userCreatedAt);
  if (!expiresAt) return { grant: false };
  const end = parseTimestamp(expiresAt);
  if (!end || end <= now) return { grant: false };
  return { grant: true, expiresAt };
}
