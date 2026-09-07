import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { appleStateFromPayload } from "../_shared/appleIap.ts";
import { AppleConfigurationError, AppleVerificationUnavailableError, verifyAppleNotification, verifyAppleSignedPayload } from "../_shared/appleJws.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 256000) return json({ error: "request_too_large" }, 413);
    const body = JSON.parse(raw);
    if (!body.signedPayload) return json({ error: "missing_signed_payload" }, 400);
    const notification = await verifyAppleNotification(body.signedPayload);
    const signedTransaction = notification.data?.signedTransactionInfo;
    if (!signedTransaction) return json({ ok: true, ignored: true });
    const payload = await verifyAppleSignedPayload(signedTransaction);
    if (payload.environment !== notification.data?.environment) return json({ error: "environment_mismatch" }, 400);
    const state = appleStateFromPayload(payload, new Date(), { type: notification.notificationType, signedDate: notification.signedDate });
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    let userId = payload.appAccountToken;
    if (!userId) {
      const { data, error } = await admin.from("profiles").select("user_id").contains("preferences", { apple_iap: { original_transaction_id: state.original_transaction_id, verified: true } }).limit(2);
      if (error) return json({ error: "billing_lookup_unavailable" }, 503);
      if (!data || data.length !== 1) return json({ ok: true, unmatched: true });
      userId = data[0].user_id;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId!)) return json({ error: "invalid_account_binding" }, 400);
    const { error } = await admin.rpc("apply_apple_iap_entitlement", { _user_id: userId, _entitlement: state });
    if (error) {
      // A deleted account should not cause Apple to retry forever.
      if (error.code === "P0002") return json({ ok: true, unmatched: true });
      console.error("[apple-subscription-webhook] persistence failed", error.code);
      return json({ error: "billing_sync_unavailable" }, 503);
    }
    return json({ ok: true });
  } catch (error) {
    if (error instanceof AppleVerificationUnavailableError) return json({ error: "apple_verification_unavailable" }, 503);
    if (error instanceof AppleConfigurationError) return json({ error: "billing_not_configured" }, 503);
    console.warn("[apple-subscription-webhook] rejected notification");
    return json({ error: "invalid_apple_notification" }, 400);
  }
});
