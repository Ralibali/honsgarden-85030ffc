// Ger ut en kortlivad signerad nedladdnings-URL till en betald digital order.
// Access kräver giltig, ej återkallad token + status paid + ingen återbetalning.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { evaluateCors, jsonResponse } from "../_shared/cors.ts";
import { getDigitalProduct, hashAccessToken, isPlausibleToken } from "../_shared/digitalProduct.ts";

const SIGNED_URL_SECONDS = 300;

serve(async (req) => {
  const cors = evaluateCors(req);
  if (req.method === "OPTIONS") {
    if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
    return new Response(null, { headers: cors.headers });
  }
  if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors.headers);

  const h = cors.headers;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Nedladdning otillgänglig." }, 500, h);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!isPlausibleToken(body.token)) return jsonResponse({ error: "Ogiltig länk." }, 400, h);

    const tokenHash = await hashAccessToken(body.token);
    const { data: tokenRow } = await admin
      .from("digital_access_tokens")
      .select("id, order_id, revoked")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!tokenRow || tokenRow.revoked) return jsonResponse({ error: "Länken gäller inte längre." }, 404, h);

    const { data: order } = await admin
      .from("digital_orders")
      .select("id, product_slug, status, refunded_at, download_count, max_downloads")
      .eq("id", tokenRow.order_id)
      .maybeSingle();
    if (!order) return jsonResponse({ error: "Ordern hittades inte." }, 404, h);
    if (order.status !== "paid" || order.refunded_at) {
      return jsonResponse({ error: "Ordern är inte betald." }, 403, h);
    }
    if ((order.download_count ?? 0) >= (order.max_downloads ?? 0)) {
      return jsonResponse({ error: "Nedladdningsgränsen är nådd. Kontakta support." }, 429, h);
    }

    const product = getDigitalProduct(order.product_slug);
    if (!product) return jsonResponse({ error: "Produkten hittades inte." }, 500, h);

    const { data: signed, error: signError } = await admin.storage
      .from(product.bucket)
      .createSignedUrl(product.objectPath, SIGNED_URL_SECONDS, {
        download: product.downloadFilename,
      });
    if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "no signed url");

    const nowIso = new Date().toISOString();
    await admin.from("digital_orders").update({
      download_count: (order.download_count ?? 0) + 1,
      last_downloaded_at: nowIso,
    }).eq("id", order.id);
    await admin.from("digital_access_tokens").update({ last_used_at: nowIso }).eq("id", tokenRow.id);

    return jsonResponse({
      url: signed.signedUrl,
      expiresInSeconds: SIGNED_URL_SECONDS,
      downloadsLeft: Math.max(0, (order.max_downloads ?? 0) - ((order.download_count ?? 0) + 1)),
    }, 200, h);
  } catch (error) {
    console.error("[digital-download]", error instanceof Error ? error.message : String(error));
    return jsonResponse({ error: "Kunde inte skapa nedladdningen just nu." }, 500, h);
  }
});
