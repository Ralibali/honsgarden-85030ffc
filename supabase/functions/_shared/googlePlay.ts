// Server-only Google Play verification. Purchase tokens must never enter logs or profiles.
export const GOOGLE_PACKAGE = "se.auroramedia.honsgarden";
export const GOOGLE_PRODUCT = "honsgarden_plus";
export class InvalidGooglePurchase extends Error {}
export class GoogleUnavailable extends Error {}
export type GoogleState = {
  product_id: string;
  base_plan_id: string;
  state: string;
  expires_at: string;
  active: boolean;
  acknowledged: boolean;
  test: boolean;
  observed_at: string;
};
export async function googleAccountId(userId: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`honsgarden:${userId.toLowerCase()}`),
  );
  return Array.from(
    new Uint8Array(bytes),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function purchaseTokens(body: unknown): string[] {
  const value = body as { purchaseTokens?: unknown };
  if (
    !value || !Array.isArray(value.purchaseTokens) ||
    !value.purchaseTokens.length || value.purchaseTokens.length > 20 ||
    value.purchaseTokens.some((t) =>
      typeof t !== "string" || t.length < 10 || t.length > 4096 || /\s/.test(t)
    )
  ) {
    throw new InvalidGooglePurchase("Invalid purchase list");
  }
  return [...new Set(value.purchaseTokens as string[])];
}
type Purchase = {
  kind?: string;
  subscriptionState?: string;
  acknowledgementState?: string;
  testPurchase?: unknown;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: Array<
    {
      productId?: string;
      expiryTime?: string;
      offerDetails?: { basePlanId?: string };
    }
  >;
};
export async function normalizeGooglePurchase(
  raw: unknown,
  userId: string,
  observedAt: string,
  allowTest = false,
): Promise<GoogleState> {
  const p = raw as Purchase;
  if (
    !p || p.kind !== "androidpublisher#subscriptionPurchaseV2" ||
    p.externalAccountIdentifiers?.obfuscatedExternalAccountId !==
      await googleAccountId(userId)
  ) {
    throw new InvalidGooglePurchase("Purchase account mismatch");
  }
  if (p.testPurchase !== undefined && !allowTest) {
    throw new InvalidGooglePurchase("Test purchases disabled");
  }
  const states = [
    "PENDING",
    "ACTIVE",
    "PAUSED",
    "IN_GRACE_PERIOD",
    "ON_HOLD",
    "CANCELED",
    "EXPIRED",
    "PENDING_PURCHASE_CANCELED",
  ];
  if (!states.some((s) => p.subscriptionState === `SUBSCRIPTION_STATE_${s}`)) {
    throw new InvalidGooglePurchase("Unknown purchase state");
  }
  // This app sells a single auto-renewing product with two base plans.
  // Refuse unexpected multi-product responses instead of granting an unrelated purchase.
  if (!Array.isArray(p.lineItems) || p.lineItems.length !== 1) {
    throw new InvalidGooglePurchase("Unexpected subscription items");
  }
  const item = p.lineItems[0];
  if (
    item.productId !== GOOGLE_PRODUCT ||
    !["monthly", "yearly"].includes(item.offerDetails?.basePlanId ?? "")
  ) {
    throw new InvalidGooglePurchase("Unexpected subscription product");
  }
  const end = Date.parse(item.expiryTime ?? "");
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(end) || !Number.isFinite(observed)) {
    throw new InvalidGooglePurchase("Missing subscription expiry");
  }
  if (
    !["ACKNOWLEDGEMENT_STATE_PENDING", "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"]
      .includes(p.acknowledgementState ?? "")
  ) {
    throw new InvalidGooglePurchase("Missing acknowledgement");
  }
  const active = [
    "SUBSCRIPTION_STATE_ACTIVE",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    "SUBSCRIPTION_STATE_CANCELED",
  ].includes(p.subscriptionState!) && end > observed;
  return {
    product_id: GOOGLE_PRODUCT,
    base_plan_id: item.offerDetails!.basePlanId!,
    state: p.subscriptionState!,
    expires_at: new Date(end).toISOString(),
    active,
    acknowledged:
      p.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    test: p.testPurchase !== undefined,
    observed_at: new Date(observed).toISOString(),
  };
}
export async function fetchGooglePurchase(
  token: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PACKAGE}/purchases/subscriptionsv2/tokens/${
        encodeURIComponent(token)
      }`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
  } catch {
    throw new GoogleUnavailable("Google request unavailable");
  }
  if ([400, 404, 410].includes(response.status)) {
    throw new InvalidGooglePurchase("Purchase not available");
  }
  if (!response.ok) {
    throw new GoogleUnavailable("Google verification unavailable");
  }
  try {
    return await response.json();
  } catch {
    throw new GoogleUnavailable("Invalid Google response");
  }
}
export async function acknowledgeGooglePurchase(
  token: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetcher(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PACKAGE}/purchases/subscriptions/${GOOGLE_PRODUCT}/tokens/${
        encodeURIComponent(token)
      }:acknowledge`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
  } catch {
    throw new GoogleUnavailable("Google acknowledgement unavailable");
  }
  if (!response.ok) {
    throw new GoogleUnavailable("Google acknowledgement unavailable");
  }
}
