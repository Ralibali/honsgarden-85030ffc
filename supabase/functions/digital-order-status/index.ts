// Statuskontroll för digitala ordrar.
// - { session_id }: verifierar betalningen direkt mot Stripe (fallback om webhooken är sen)
//   och ger då ut en ny åtkomsttoken till just den webbläsaren.
// - { token }: kontrollerar en befintlig åtkomsttoken.
// Inga klientparametrar kan bevilja access – allt kontrolleras mot Stripe/DB.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { evaluateCors, jsonResponse } from "../_shared/cors.ts";
import {
  clientIp,
  DIGITAL_PRIVATE_HEADERS,
  digitalRateLimitAllows,
  getDigitalProduct,
  hashAccessToken,
  isLiveStripeKey,
  isPlausibleToken,
  maskEmail,
  normalizeEmail,
} from "../_shared/digitalProduct.ts";
import { flushEmailQueue, issueAccessToken, sendDigitalReceipt } from "../_shared/digitalReceipt.ts";

const GENERIC = "Kunde inte hämta orderstatus just nu.";

serve(async (req) => {
  const cors = evaluateCors(req);
  if (req.method === "OPTIONS") {
    if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
    return new Response(null, { headers: cors.headers });
  }
  if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors.headers);

  const h = { ...cors.headers, ...DIGITAL_PRIVATE_HEADERS };
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !stripeKey) return jsonResponse({ error: GENERIC }, 500, h);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    // --- Väg 1: befintlig token ---
    if (body.token !== undefined) {
      const tokenAllowed = await digitalRateLimitAllows(admin, {
        scope: "digital-token-status-ip", value: clientIp(req) || "unknown",
        max: 60, windowMinutes: 10,
      });
      if (!tokenAllowed) return jsonResponse({ error: "För många förfrågningar. Vänta en stund." }, 429, h);
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
        .select("order_number, status, customer_email, amount_ore, vat_rate, paid_at, refunded_at, product_slug")
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
        productSlug: order.product_slug,
      }, 200, h);
    }

    // --- Väg 2: retur från Stripe Checkout ---
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    if (!sessionId || sessionId.length > 200 || !sessionId.startsWith("cs_")) {
      return jsonResponse({ error: "Ogiltig referens." }, 400, h);
    }

    // Spärren gäller alla sessionsuppslag, även redan betalda ordrar, och
    // stänger vid databasfel så ingen kan pumpa förfrågningar mot Stripe.
    const allowed = await digitalRateLimitAllows(admin, {
      scope: "digital-order-status-ip",
      value: clientIp(req) || sessionId,
      max: 30,
      windowMinutes: 10,
    });
    if (!allowed) {
      return jsonResponse({ error: "För många förfrågningar. Vänta en stund." }, 429, h);
    }

    const { data: order } = await admin
      .from("digital_orders")
      .select("id, order_number, product_slug, status, currency, customer_email, amount_ore, vat_rate, refunded_at, paid_at, consent_terms_version, consent_at")
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

      // Sessionen måste tillhöra just den här ordern, produkten, läget och valutan.
      const sessionOrderId = session.metadata?.digital_order_id;
      const sessionSlug = session.metadata?.digital_product_slug;
      const mismatch = sessionOrderId !== order.id
        || session.id !== sessionId
        || sessionSlug !== order.product_slug
        || session.mode !== "payment"
        || session.livemode !== isLiveStripeKey(stripeKey)
        || (session.currency ?? "").toLowerCase() !== String(order.currency ?? "sek").toLowerCase();
      if (mismatch) {
        console.error("[digital-order-status] session mismatch", sessionId, order.id);
        return jsonResponse({ error: "Ogiltig referens." }, 400, h);
      }

      if (session.payment_status === "paid") {
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
        const verifiedEmail = normalizeEmail(session.customer_details?.email ?? session.customer_email);
        const { data: rpc, error: rpcError } = await admin.rpc("digital_finalize_paid_order", {
          p_order_id: order.id,
          p_amount_total_ore: session.amount_total ?? 0,
          p_customer_email: verifiedEmail,
          p_payment_intent_id: paymentIntentId,
          p_currency: session.currency ?? null,
          p_verified_country: session.customer_details?.address?.country ?? null,
          p_livemode: session.livemode,
        });
        if (rpcError) {
          // Övergående databasfel: be klienten försöka igen i stället för att
          // visa "inte betald" för en kund som faktiskt har betalat.
          console.error("[digital-order-status] finalize failed", rpcError.message, order.id);
          return jsonResponse({ error: GENERIC, retry: true }, 503, h);
        }
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
      const { data: fresh } = await admin
        .from("digital_orders")
        .select("status, review_reason")
        .eq("id", order.id)
        .maybeSingle();
      return jsonResponse({
        status: fresh?.status ?? status,
        paid: false,
        refunded: !!order.refunded_at,
        needsReview: fresh?.status === "review",
        reviewReason: fresh?.review_reason ?? null,
        orderNumber: order.order_number,
      }, 200, h);
    }

    // Skicka kvitto om webhooken inte redan hunnit (atomärt och idempotent).
    const receipt = await sendDigitalReceipt(admin, {
      id: order.id,
      order_number: order.order_number,
      customer_email: email,
      amount_ore: order.amount_ore,
      vat_rate: Number(order.vat_rate),
      consent_terms_version: order.consent_terms_version,
      consent_at: order.consent_at,
      paid_at: order.paid_at,
    }, product);
    if (!receipt.ok) {
      console.error("[digital-order-status] receipt not queued", receipt.reason, order.id);
      return jsonResponse({ error: GENERIC, retry: true }, 503, h);
    }
    if (receipt.queued) await flushEmailQueue("digital-order-status");

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
    }, 200, h);
  } catch (error) {
    console.error("[digital-order-status]", error instanceof Error ? error.message : String(error));
    return jsonResponse({ error: GENERIC }, 500, h);
  }
});
