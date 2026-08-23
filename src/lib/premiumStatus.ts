export type PremiumType = 'free' | 'trial' | 'paid' | 'lifetime';

export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const normalized = value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasActiveLocalPremium(
  expiry: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const date = parseTimestamp(expiry);
  return !!date && date > now;
}

/**
 * Expired local premium may be cleared. Never clear a future trial, and never
 * clear a row whose expiry we cannot parse (avoids wiping a valid 7-day grant).
 */
export function shouldClearLocalPremium(input: {
  subscriptionStatus?: string | null;
  premiumExpiresAt?: string | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (hasActiveLocalPremium(input.premiumExpiresAt, now)) return false;
  if (input.premiumExpiresAt && !parseTimestamp(input.premiumExpiresAt)) return false;
  return input.subscriptionStatus === 'premium' || !!input.premiumExpiresAt;
}

export function resolvePremiumType(input: {
  isLifetime?: boolean;
  profileExpiry?: string | null;
  synced?: boolean;
  subscribed?: boolean;
  syncedPremiumType?: PremiumType | null;
  subscriptionEnd?: string | null;
  now?: Date;
}): PremiumType {
  const now = input.now ?? new Date();
  const hasValidProfileExpiry = hasActiveLocalPremium(input.profileExpiry, now);
  const hasValidSyncedExpiry = hasActiveLocalPremium(input.subscriptionEnd, now);

  if (input.isLifetime || input.syncedPremiumType === 'lifetime') return 'lifetime';
  if (input.synced && input.subscribed && input.syncedPremiumType === 'paid' && hasValidSyncedExpiry) {
    return 'paid';
  }
  if (input.synced && input.subscribed && input.syncedPremiumType === 'trial' && (hasValidSyncedExpiry || hasValidProfileExpiry)) {
    return 'trial';
  }
  if (input.synced && input.subscribed && hasValidSyncedExpiry) return 'paid';
  if (hasValidProfileExpiry) return 'trial';
  return 'free';
}
