// Statuskontroll för digitala ordrar.
// - { session_id }: verifierar betalningen direkt mot Stripe (fallback om webhooken är sen)
//   och ger då ut en ny åtkomsttoken till just den webbläsaren.
// - { token }: kontrollerar en befintlig åtkomsttoken.
// Inga klientparametrar kan bevilja access – allt kontrolleras mot Stripe/DB.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { evaluateCors, jsonResponse } from "../_shared/cors.ts";
import { getDigitalProduct, hashAccessToken, isPlausibleToken, maskEmail } from "../_shared/digitalProduct.ts";
import { issueAccessToken, sendDigitalReceipt } from "../_shared/digitalReceipt.ts";

const GENERIC = "Kunde inte hämta orderstatus just nu.";

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
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !stripeKey) return jsonResponse({ error: GENERIC }, 500, h);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // --- Väg 1: befintlig token ---
    if (body.token !== undefined) {
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
        .select("order_number, status, customer_email, amount_ore, vat_rate, paid_at, refunded_at, download_count, max_downloads, product_slug")
        .eq("id", tokenRow.order_id)
        .maybeSingle();
      if (!order) return jsonResponse({ error: "Ordern hittades inte." }, 404, h);

      return jsonResponse({
        status: order.status,
        paid: order.status === "paid" && !order.refunded_at,
        refunded: !!order.refunded_at,
        orderNumber: order.order_number,
        email: maskEmail(order.customer_email),
        amountOre: order.amount_ore,
        vatRate: Number(order.vat_rate),
        downloadsLeft: Math.max(0, (order.max_downloads ?? 0) - (order.download_count ?? 0)),
        productSlug: order.product_slug,
      }, 200, h);
    }

    // --- Väg 2: retur från Stripe Checkout ---
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    if (!sessionId || sessionId.length > 200 || !sessionId.startsWith("cs_")) {
      return jsonResponse({ error: "Ogiltig referens." }, 400, h);
    }

    const { data: order } = await admin
      .from("digital_orders")
      .select("id, order_number, product_slug, status, customer_email, amount_ore, vat_rate, refunded_at, paid_at, consent_terms_version, consent_at, download_count, max_downloads")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (!order) return jsonResponse({ error: "Ordern hittades inte." }, 404, h);

    const product = getDigitalProduct(order.product_slug);
    if (!product) return jsonResponse({ error: GENERIC }, 500, h);

    let status = order.status;
    let email = order.customer_email;

    if (status !== "paid") {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
        const verifiedEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const { data: rpc } = await admin.rpc("digital_finalize_paid_order", {
          p_order_id: order.id,
          p_amount_total_ore: session.amount_total ?? 0,
          p_customer_email: verifiedEmail,
          p_payment_intent_id: paymentIntentId,
        });
        const result = (rpc ?? {}) as { ok?: boolean; reason?: string };
        if (result.ok) {
          status = "paid";
          email = verifiedEmail ?? email;
        } else {
          console.error("[digital-order-status] finalize refused", result.reason, order.id);
        }
      }
    }

    if (status !== "paid" || order.refunded_at) {
      return jsonResponse({
        status,
        paid: false,
        refunded: !!order.refunded_at,
        orderNumber: order.order_number,
      }, 200, h);
    }

    // Skicka kvitto om webhooken inte redan hunnit (idempotent internt).
    await sendDigitalReceipt(admin, {
      id: order.id,
      order_number: order.order_number,
      customer_email: email,
      amount_ore: order.amount_ore,
      vat_rate: Number(order.vat_rate),
      consent_terms_version: order.consent_terms_version,
      consent_at: order.consent_at,
      paid_at: order.paid_at,
    }, product);

    const token = await issueAccessToken(admin, order.id, "thankyou");
    if (!token) return jsonResponse({ error: GENERIC }, 500, h);

    return jsonResponse({
      status: "paid",
      paid: true,
      refunded: false,
      orderNumber: order.order_number,
      email: maskEmail(email),
      amountOre: order.amount_ore,
      vatRate: Number(order.vat_rate),
      token,
      deliveryPath: product.deliveryPath,
      productSlug: product.slug,
      downloadsLeft: Math.max(0, (order.max_downloads ?? 0) - (order.download_count ?? 0)),
    }, 200, h);
  } catch (error) {
    console.error("[digital-order-status]", error instanceof Error ? error.message : String(error));
    return jsonResponse({ error: GENERIC }, 500, h);
  }
});
