import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { appleStateFromPayload, assertAppleAccountToken, type AppleIapPreference } from "../_shared/appleIap.ts";
import { AppleConfigurationError, AppleVerificationUnavailableError, verifyAppleSignedPayload } from "../_shared/appleJws.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: "not_authenticated" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  let auth;
  try {
    const result = await admin.auth.getUser(token);
    if (result.error || !result.data.user) return json({ error: "not_authenticated" }, 401);
    auth = result.data;
  } catch { return json({ error: "authentication_unavailable" }, 503); }

  try {
    const raw = await req.text();
    if (raw.length > 256000) return json({ error: "request_too_large" }, 413);
    const body = JSON.parse(raw);
    const listed = Array.isArray(body.transactions) ? body.transactions.map((t: { jws?: unknown }) => t?.jws) : [];
    const transactions = [...new Set([body.jws, ...listed].filter((jws): jws is string => typeof jws === "string" && !!jws))];
    if (!transactions.length || transactions.length > 20) return json({ error: "invalid_transaction_count" }, 400);

    const states: AppleIapPreference[] = [];
    for (const jws of transactions) {
      const payload = await verifyAppleSignedPayload(jws);
      assertAppleAccountToken(payload, auth.user.id);
      states.push(appleStateFromPayload(payload));
    }
    states.sort((a, b) => a.signed_at!.localeCompare(b.signed_at!));
    let result: unknown;
    for (const state of states) {
      const { data, error } = await admin.rpc("apply_apple_iap_entitlement", { _user_id: auth.user.id, _entitlement: state });
      if (error) {
        console.error("[verify-apple-subscription] persistence failed", error.code);
        return json({ error: "billing_sync_unavailable", message: "Köpet kunde inte bekräftas just nu. Försök återställa köpet igen." }, 503);
      }
      result = data;
    }
    return json(result);
  } catch (error) {
    if (error instanceof AppleVerificationUnavailableError) return json({ error: "apple_verification_unavailable" }, 503);
    if (error instanceof AppleConfigurationError) return json({ error: "billing_not_configured" }, 503);
    console.warn("[verify-apple-subscription] rejected transaction");
    return json({ error: "invalid_apple_transaction", message: "Köpet kunde inte verifieras för det här kontot." }, 400);
  }
});
