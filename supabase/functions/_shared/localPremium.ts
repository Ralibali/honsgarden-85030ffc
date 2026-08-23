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
