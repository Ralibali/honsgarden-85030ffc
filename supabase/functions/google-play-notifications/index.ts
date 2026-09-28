import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { GOOGLE_PACKAGE } from "../_shared/googlePlay.ts";
import { syncGooglePurchases } from "../_shared/googlePlaySync.ts";
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const audience = Deno.env.get("GOOGLE_PLAY_RTDN_AUDIENCE");
  const email = Deno.env.get("GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL");
  if (!audience || !email) return new Response(null, { status: 503 });
  const jwt = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!jwt) return new Response(null, { status: 401 });
  try {
    const { payload } = await jwtVerify(jwt, keys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
      algorithms: ["RS256"],
    });
    if (payload.email !== email || payload.email_verified !== true) {
      return new Response(null, { status: 403 });
    }
  } catch {
    return new Response(null, { status: 401 });
  }
  try {
    const raw = await req.text();
    if (raw.length > 64000) return new Response(null, { status: 413 });
    const envelope = JSON.parse(raw);
    const event = JSON.parse(atob(envelope.message?.data ?? ""));
    if (event.packageName !== GOOGLE_PACKAGE) {
      return new Response(null, { status: 400 });
    }
    if (event.testNotification) return new Response(null, { status: 204 });
    const token = event.subscriptionNotification?.purchaseToken ??
      event.voidedPurchaseNotification?.purchaseToken;
    if (typeof token !== "string" || token.length < 10 || token.length > 4096) {
      return new Response(null, { status: 400 });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.from("google_play_purchases").select(
      "user_id",
    ).eq("purchase_token", token).maybeSingle();
    if (error) return new Response(null, { status: 503 });
    // An unknown first purchase must be claimed through authenticated in-app verification.
    if (!data) return new Response(null, { status: 204 });
    await syncGooglePurchases(admin, data.user_id, [token]);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
});
