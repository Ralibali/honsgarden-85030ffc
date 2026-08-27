import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { entitlementFromApplePayload, mergeAppleIapPreference, pickLatestAppleEntitlement } from "../_shared/appleIap.ts";
import { verifyAppleSignedPayload } from "../_shared/appleJws.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function collectJws(body: Record<string, unknown>): string[] {
  const single = typeof body.jws === "string" ? [body.jws] : [];
  const listed = Array.isArray(body.transactions)
    ? body.transactions
      .map((item) => (item && typeof item === "object" ? (item as { jws?: unknown }).jws : null))
      .filter((jws): jws is string => typeof jws === "string" && jws.length > 0)
    : [];
  return [...new Set([...single, ...listed])];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Apple IAP backend is not fully configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "User not authenticated" }, 401);

    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.slice("Bearer ".length).trim();
    const { data, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !data.user) return json({ error: "User not authenticated" }, 401);
    const user = data.user;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const jwsList = collectJws(body);
    if (jwsList.length === 0) return json({ error: "missing_jws", message: "No Apple transaction was provided." }, 400);

    const entitlements = [];
    for (const jws of jwsList) {
      try {
        const payload = await verifyAppleSignedPayload(jws);
        if (payload.appAccountToken && payload.appAccountToken !== user.id) {
          console.warn("[verify-apple-subscription] appAccountToken mismatch", payload.appAccountToken, user.id);
        }
        entitlements.push(entitlementFromApplePayload(payload));
      } catch (error) {
        console.warn("[verify-apple-subscription] skipped transaction", error instanceof Error ? error.message : error);
      }
    }

    const latest = pickLatestAppleEntitlement(entitlements);
    if (!latest) {
      return json({
        subscribed: false,
        premium_type: "free",
        subscription_end: null,
        source: "apple",
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("preferences, is_lifetime_premium")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    const preferences = mergeAppleIapPreference(profile?.preferences, latest);
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: "premium",
        premium_expires_at: profile?.is_lifetime_premium ? null : latest.expires_at,
        preferences,
      })
      .eq("user_id", user.id);
    if (updateError) throw new Error(updateError.message);

    return json({
      subscribed: true,
      premium_type: profile?.is_lifetime_premium ? "lifetime" : "paid",
      subscription_end: profile?.is_lifetime_premium ? null : latest.expires_at,
      source: "apple",
      product_id: latest.product_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[verify-apple-subscription]", message);
    return json({ error: message }, 500);
  }
});
