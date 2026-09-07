// Ger ut en kortlivad signerad nedladdnings-URL till en betald digital order.
// Access kräver giltig, ej återkallad token + status paid + ingen återbetalning.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { evaluateCors, jsonResponse } from "../_shared/cors.ts";
import {
  clientIp,
  getDigitalProduct,
  hashAccessToken,
  hashKey,
  isPlausibleToken,
} from "../_shared/digitalProduct.ts";

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
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;

    // Allt i en transaktion i databasen: kontroll, spärr per timme, logg och räknare.
    const { data: rpc, error: rpcError } = await admin.rpc("digital_register_download", {
      p_token_hash: tokenHash,
      p_ip_hash: ipHash,
      p_user_agent: req.headers.get("user-agent") ?? null,
      p_max_per_hour: 20,
    });
    if (rpcError) throw new Error(`register download failed: ${rpcError.message}`);

    const result = (rpc ?? {}) as { ok?: boolean; reason?: string; product_slug?: string };
    if (!result.ok) {
      if (result.reason === "rate_limited") {
        return jsonResponse({
          error: "Många nedladdningar den senaste timmen. Försök igen om en stund –"
            + " länken slutar inte gälla.",
        }, 429, h);
      }
      if (result.reason === "not_available") {
        return jsonResponse({ error: "Ordern är inte betald." }, 403, h);
      }
      return jsonResponse({ error: "Länken gäller inte längre." }, 404, h);
    }

    const product = getDigitalProduct(result.product_slug);
    if (!product) return jsonResponse({ error: "Produkten hittades inte." }, 500, h);

    const { data: signed, error: signError } = await admin.storage
      .from(product.bucket)
      .createSignedUrl(product.objectPath, SIGNED_URL_SECONDS, {
        download: product.downloadFilename,
      });
    if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "no signed url");

    return jsonResponse({
      url: signed.signedUrl,
      expiresInSeconds: SIGNED_URL_SECONDS,
    }, 200, h);
  } catch (error) {
    console.error("[digital-download]", error instanceof Error ? error.message : String(error));
    return jsonResponse({ error: "Kunde inte skapa nedladdningen just nu." }, 500, h);
  }
});
