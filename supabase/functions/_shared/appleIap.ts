// Shared by iOS IAP client tests and Deno edge functions. Keep dependency-free.

export const IOS_BUNDLE_ID = "se.honsgarden.app";
export const IOS_APPLE_APP_ID = 6809292574;

export const APPLE_IAP_PRODUCTS = {
  monthly: "se.honsgarden.plus.monthly",
  yearly: "se.honsgarden.plus.yearly",
} as const;

export const APPLE_IAP_PRODUCT_IDS = [
  APPLE_IAP_PRODUCTS.monthly,
  APPLE_IAP_PRODUCTS.yearly,
] as const;

export type AppleIapPlan = keyof typeof APPLE_IAP_PRODUCTS;

export type AppleIapPreference = {
  original_transaction_id: string;
  product_id: string;
  expires_at: string | null;
  environment?: string;
  updated_at: string;
  signed_at?: string;
  transaction_id?: string;
  revoked_at?: string | null;
  verified?: boolean;
};

export function planFromProductId(productId: string): AppleIapPlan | null {
  if (productId === APPLE_IAP_PRODUCTS.monthly) return "monthly";
  if (productId === APPLE_IAP_PRODUCTS.yearly) return "yearly";
  return null;
}

export function isKnownAppleProductId(productId: string): boolean {
  return planFromProductId(productId) !== null;
}

export function readAppleIapPreference(preferences: unknown): AppleIapPreference | null {
  if (!preferences || typeof preferences !== "object") return null;
  const raw = (preferences as Record<string, unknown>).apple_iap;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.original_transaction_id !== "string" || !value.original_transaction_id) return null;
  if (typeof value.product_id !== "string" || !value.product_id) return null;
  return {
    original_transaction_id: value.original_transaction_id,
    product_id: value.product_id,
    expires_at: typeof value.expires_at === "string" ? value.expires_at : null,
    environment: typeof value.environment === "string" ? value.environment : undefined,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : "",
    signed_at: typeof value.signed_at === "string" ? value.signed_at : undefined,
    transaction_id: typeof value.transaction_id === "string" ? value.transaction_id : undefined,
    revoked_at: typeof value.revoked_at === "string" ? value.revoked_at : null,
    verified: value.verified === true,
  };
}

export function isAppleIapActive(
  pref: AppleIapPreference | null,
  now: Date,
  parseTimestamp: (value: string | null | undefined) => Date | null,
): boolean {
  if (!pref) return false;
  if (!pref.verified || pref.revoked_at || !isKnownAppleProductId(pref.product_id)) return false;
  if (!pref.expires_at) return false;
  const date = parseTimestamp(pref.expires_at);
  return !!date && date > now;
}

export function mergeAppleIapPreference(
  preferences: unknown,
  apple: AppleIapPreference | null,
): Record<string, unknown> {
  const base = preferences && typeof preferences === "object"
    ? { ...(preferences as Record<string, unknown>) }
    : {};
  if (apple) base.apple_iap = apple;
  else delete base.apple_iap;
  return base;
}

export type EntitlementSource = "lifetime" | "stripe" | "apple" | "trial" | "free";

export function resolveEntitlement(input: {
  hasLifetime: boolean;
  stripePaid: boolean;
  stripeEnd: string | null;
  applePaid: boolean;
  appleEnd: string | null;
  localTrialActive: boolean;
  localTrialEnd: string | null;
}): {
  subscribed: boolean;
  premium_type: "lifetime" | "paid" | "trial" | "free";
  subscription_end: string | null;
  source: EntitlementSource;
} {
  if (input.hasLifetime) {
    return { subscribed: true, premium_type: "lifetime", subscription_end: null, source: "lifetime" };
  }
  if (input.stripePaid) {
    return {
      subscribed: true,
      premium_type: "paid",
      subscription_end: input.stripeEnd,
      source: "stripe",
    };
  }
  if (input.applePaid) {
    return {
      subscribed: true,
      premium_type: "paid",
      subscription_end: input.appleEnd,
      source: "apple",
    };
  }
  if (input.localTrialActive) {
    return {
      subscribed: true,
      premium_type: "trial",
      subscription_end: input.localTrialEnd,
      source: "trial",
    };
  }
  return { subscribed: false, premium_type: "free", subscription_end: null, source: "free" };
}

export type AppleTransactionPayload = {
  transactionId?: string;
  originalTransactionId?: string;
  bundleId?: string;
  productId?: string;
  expiresDate?: number;
  purchaseDate?: number;
  type?: string;
  appAccountToken?: string;
  environment?: string;
  revocationDate?: number;
  signedDate?: number;
};

export function entitlementFromApplePayload(
  payload: AppleTransactionPayload,
  now = new Date(),
): AppleIapPreference {
  if (payload.bundleId !== IOS_BUNDLE_ID) {
    throw new Error(`Unexpected bundle id: ${payload.bundleId}`);
  }
  if (!payload.productId || !isKnownAppleProductId(payload.productId)) {
    throw new Error("Unknown Apple product");
  }
  if (payload.revocationDate) {
    throw new Error("Apple transaction was revoked");
  }
  if (!payload.originalTransactionId) {
    throw new Error("Apple transaction is missing originalTransactionId");
  }

  const expiresAt = typeof payload.expiresDate === "number"
    ? new Date(payload.expiresDate).toISOString()
    : null;
  if (!expiresAt) throw new Error("Apple subscription is missing expiry");
  if (expiresAt && new Date(expiresAt) <= now) {
    throw new Error("Apple subscription is expired");
  }

  return {
    original_transaction_id: payload.originalTransactionId,
    product_id: payload.productId,
    expires_at: expiresAt,
    environment: payload.environment,
    updated_at: now.toISOString(),
    verified: true,
  };
}

export function pickLatestAppleEntitlement(
  entitlements: AppleIapPreference[],
): AppleIapPreference | null {
  return entitlements
    .slice()
    .sort((a, b) => {
      const aTime = a.expires_at ? new Date(a.expires_at).getTime() : 0;
      const bTime = b.expires_at ? new Date(b.expires_at).getTime() : 0;
      return bTime - aTime;
    })[0] ?? null;
}

export function isIosCheckoutBlocked(
  platformHeader: string | null | undefined,
  bodyPlatform: unknown,
): boolean {
  const header = (platformHeader ?? "").trim().toLowerCase();
  const body = typeof bodyPlatform === "string" ? bodyPlatform.trim().toLowerCase() : "";
  return header === "ios" || body === "ios";
}

export function assertAppleAccountToken(payload: AppleTransactionPayload, userId: string): void {
  if (!payload.appAccountToken || payload.appAccountToken.toLowerCase() !== userId.toLowerCase()) {
    throw new Error("Apple purchase belongs to another account or has no account binding");
  }
}

/** Accept inactive states too, so refunds/expiry cannot leave Premium enabled. */
export function appleStateFromPayload(
  payload: AppleTransactionPayload,
  now = new Date(),
  notification?: { type?: string; signedDate?: number },
): AppleIapPreference {
  if (payload.bundleId !== IOS_BUNDLE_ID) throw new Error("Unexpected Apple bundle");
  if (!payload.productId || !isKnownAppleProductId(payload.productId)) throw new Error("Unknown Apple product");
  if (payload.type !== "Auto-Renewable Subscription") throw new Error("Unexpected Apple purchase type");
  if (!payload.originalTransactionId || !payload.transactionId) throw new Error("Missing Apple transaction ID");
  if (payload.environment !== "Production" && payload.environment !== "Sandbox") throw new Error("Invalid Apple environment");
  const signedDate = notification?.signedDate ?? payload.signedDate;
  if (typeof signedDate !== "number" || !Number.isFinite(signedDate) || signedDate <= 0 || signedDate > now.getTime() + 300000) {
    throw new Error("Invalid Apple signed date");
  }
  if (typeof payload.expiresDate !== "number" || !Number.isFinite(payload.expiresDate) || payload.expiresDate <= 0) {
    throw new Error("Missing Apple expiry");
  }
  const revoked = !!payload.revocationDate || notification?.type === "REFUND" || notification?.type === "REVOKE";
  return {
    original_transaction_id: payload.originalTransactionId,
    transaction_id: payload.transactionId,
    product_id: payload.productId,
    environment: payload.environment,
    expires_at: new Date(payload.expiresDate).toISOString(),
    signed_at: new Date(signedDate).toISOString(),
    revoked_at: revoked ? new Date(payload.revocationDate || signedDate).toISOString() : null,
    verified: true,
    updated_at: now.toISOString(),
  };
}

/** Separate independent trial/gift access from the cached Apple expiry. */
export function independentPremiumExpiry(preferences: unknown, cachedExpiry: string | null | undefined): string | null {
  const apple = readAppleIapPreference(preferences);
  if (!apple?.verified || !apple.expires_at || !cachedExpiry || Date.parse(cachedExpiry) !== Date.parse(apple.expires_at)) return cachedExpiry ?? null;
  const raw = (preferences as { apple_iap: Record<string, unknown> }).apple_iap;
  return typeof raw.previous_premium_expires_at === "string" ? raw.previous_premium_expires_at : null;
}
