import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  InvalidGooglePurchase,
  purchaseTokens,
} from "../_shared/googlePlay.ts";
import { syncGooglePurchases } from "../_shared/googlePlaySync.ts";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: "not_authenticated" }, 401);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      return json(
        { error: "not_authenticated" },
        (error?.status ?? 0) >= 500 ? 503 : 401,
      );
    }
    const raw = await req.text();
    if (raw.length > 100000) return json({ error: "request_too_large" }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    return json(
      await syncGooglePurchases(admin, data.user.id, purchaseTokens(body)),
    );
  } catch (error) {
    // No purchase tokens, credentials or provider response bodies in logs/errors.
    return error instanceof InvalidGooglePurchase
      ? json({ error: "invalid_google_purchase" }, 400)
      : json({ error: "billing_sync_unavailable" }, 503);
  }
});
