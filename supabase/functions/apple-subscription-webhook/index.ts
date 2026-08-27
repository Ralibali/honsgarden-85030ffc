import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { entitlementFromApplePayload, mergeAppleIapPreference, readAppleIapPreference } from "../_shared/appleIap.ts";
import { verifyAppleSignedPayload } from "../_shared/appleJws.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({})) as { signedPayload?: string };
    if (!body.signedPayload) return json({ error: "missing_signed_payload" }, 400);

    const notification = await verifyAppleSignedPayload(body.signedPayload) as {
      notificationType?: string;
      data?: { signedTransactionInfo?: string };
    };
    const signedTransaction = notification.data?.signedTransactionInfo;
    if (!signedTransaction) return json({ ok: true, ignored: true });

    const payload = await verifyAppleSignedPayload(signedTransaction);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    let userId = payload.appAccountToken ?? null;
    if (!userId && payload.originalTransactionId) {
      const { data: matches } = await admin
        .from("profiles")
        .select("user_id, preferences")
        .contains("preferences", {
          apple_iap: { original_transaction_id: payload.originalTransactionId },
        });
      userId = matches?.[0]?.user_id ?? null;
    }

    if (!userId) {
      console.warn("[apple-subscription-webhook] no user for", payload.originalTransactionId);
      return json({ ok: true, unmatched: true });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("preferences, is_lifetime_premium")
      .eq("user_id", userId)
      .maybeSingle();

    const revoked = !!payload.revocationDate || notification.notificationType === "REFUND";
    if (revoked) {
      const existing = readAppleIapPreference(profile?.preferences);
      const preferences = mergeAppleIapPreference(profile?.preferences, existing
        ? { ...existing, expires_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : null);
      await admin.from("profiles").update({
        subscription_status: profile?.is_lifetime_premium ? "premium" : "free",
        premium_expires_at: profile?.is_lifetime_premium ? null : new Date().toISOString(),
        preferences,
      }).eq("user_id", userId);
      return json({ ok: true, revoked: true });
    }

    try {
      const latest = entitlementFromApplePayload(payload);
      const preferences = mergeAppleIapPreference(profile?.preferences, latest);
      await admin.from("profiles").update({
        subscription_status: "premium",
        premium_expires_at: profile?.is_lifetime_premium ? null : latest.expires_at,
        preferences,
      }).eq("user_id", userId);
      return json({ ok: true, user_id: userId });
    } catch (error) {
      console.warn("[apple-subscription-webhook] entitlement skipped", error instanceof Error ? error.message : error);
      return json({ ok: true, skipped: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[apple-subscription-webhook]", message);
    return json({ error: message }, 200);
  }
});
