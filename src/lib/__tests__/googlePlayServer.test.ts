import { describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
vi.stubGlobal("crypto", webcrypto);
vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });
import {
  acknowledgeGooglePurchase,
  fetchGooglePurchase,
  googleAccountId,
  GoogleUnavailable,
  InvalidGooglePurchase,
  normalizeGooglePurchase,
  purchaseTokens,
} from "../../../supabase/functions/_shared/googlePlay";
import { independentPremiumExpiry } from "../../../supabase/functions/_shared/appleIap";
const user = "11111111-1111-4111-8111-111111111111";
const now = "2026-09-28T10:00:00.000Z", end = "2026-10-28T10:00:00.000Z";
async function purchase() {
  return {
    kind: "androidpublisher#subscriptionPurchaseV2",
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    externalAccountIdentifiers: {
      obfuscatedExternalAccountId: await googleAccountId(user),
    },
    lineItems: [{
      productId: "honsgarden_plus",
      expiryTime: end,
      offerDetails: { basePlanId: "monthly" },
    }],
  };
}
describe("Google Play server verification", () => {
  it("accepts a bound known active product but leaves acknowledgement pending", async () =>
    expect(await normalizeGooglePurchase(await purchase(), user, now))
      .toMatchObject({ active: true, acknowledged: false, expires_at: end }));
  it("rejects a different account", async () =>
    expect(normalizeGooglePurchase(await purchase(), "different-user", now))
      .rejects.toBeInstanceOf(InvalidGooglePurchase));
  it("rejects missing account binding", async () =>
    expect(
      normalizeGooglePurchase(
        { ...await purchase(), externalAccountIdentifiers: {} },
        user,
        now,
      ),
    ).rejects.toThrow());
  it("rejects an unrelated product and unknown base plan", async () => {
    for (
      const line of [{
        productId: "other",
        expiryTime: end,
        offerDetails: { basePlanId: "monthly" },
      }, {
        productId: "honsgarden_plus",
        expiryTime: end,
        offerDetails: { basePlanId: "bad" },
      }]
    ) {
      await expect(
        normalizeGooglePurchase(
          { ...await purchase(), lineItems: [line] },
          user,
          now,
        ),
      ).rejects.toThrow();
    }
  });
  it("requires explicit sandbox opt-in", async () => {
    const p = { ...await purchase(), testPurchase: {} };
    await expect(normalizeGooglePurchase(p, user, now)).rejects.toThrow();
    expect((await normalizeGooglePurchase(p, user, now, true)).test).toBe(true);
  });
  it.each([
    "PENDING",
    "PAUSED",
    "ON_HOLD",
    "EXPIRED",
    "PENDING_PURCHASE_CANCELED",
  ])(
    "does not grant %s even with a future expiry",
    async (state) =>
      expect(
        (await normalizeGooglePurchase(
          {
            ...await purchase(),
            subscriptionState: "SUBSCRIPTION_STATE_" + state,
          },
          user,
          now,
        )).active,
      ).toBe(false),
  );
  it.each(["CANCELED", "IN_GRACE_PERIOD"])(
    "retains paid access for %s until expiry",
    async (state) =>
      expect(
        (await normalizeGooglePurchase(
          {
            ...await purchase(),
            subscriptionState: "SUBSCRIPTION_STATE_" + state,
          },
          user,
          now,
        )).active,
      ).toBe(true),
  );
  it("expires canceled access", async () =>
    expect(
      (await normalizeGooglePurchase(
        {
          ...await purchase(),
          subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
        },
        user,
        "2026-11-01T00:00:00Z",
      )).active,
    ).toBe(false));
  it("rejects unknown and malformed provider responses", async () => {
    for (
      const patch of [{ kind: "other" }, { subscriptionState: "WHAT" }, {
        lineItems: [],
      }, { acknowledgementState: "unknown" }]
    ) {
      await expect(
        normalizeGooglePurchase({ ...await purchase(), ...patch }, user, now),
      ).rejects.toThrow();
    }
  });
  it("limits and deduplicates private tokens", () => {
    expect(purchaseTokens({ purchaseTokens: ["token-123456", "token-123456"] }))
      .toEqual(["token-123456"]);
    for (
      const b of [
        null,
        {},
        { purchaseTokens: [] },
        { purchaseTokens: ["bad"] },
        { purchaseTokens: Array(21).fill("token-123456") },
      ]
    ) expect(() => purchaseTokens(b)).toThrow();
  });
  it("pins the app and encodes the token path", async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(await purchase())),
    );
    await fetchGooglePurchase("token/?#", "oauth", f);
    expect(f.mock.calls[0][0]).toContain(
      "/applications/se.honsgarden.app/purchases/subscriptionsv2/tokens/token%2F%3F%23",
    );
  });
  it("distinguishes invalid tokens from unavailable Google service", async () => {
    await expect(
      fetchGooglePurchase(
        "token",
        "oauth",
        vi.fn().mockResolvedValue(new Response("", { status: 404 })),
      ),
    ).rejects.toBeInstanceOf(InvalidGooglePurchase);
    await expect(
      fetchGooglePurchase(
        "token",
        "oauth",
        vi.fn().mockResolvedValue(new Response("", { status: 403 })),
      ),
    ).rejects.toBeInstanceOf(GoogleUnavailable);
  });
  it("does not silently accept failed acknowledgement", async () => {
    await expect(
      acknowledgeGooglePurchase(
        "token",
        "oauth",
        vi.fn().mockResolvedValue(new Response("", { status: 500 })),
      ),
    ).rejects.toBeInstanceOf(GoogleUnavailable);
  });
  it("does not reinterpret Google paid access as an independent trial", () => {
    expect(
      independentPremiumExpiry({
        google_play: {
          verified: true,
          expires_at: end,
          previous_premium_expires_at: null,
        },
      }, end),
    ).toBeNull();
  });
});
