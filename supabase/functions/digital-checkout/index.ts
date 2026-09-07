// Publik checkout för digitalt engångsköp (PDF). Gäst tillåtet.
// Pris, moms, produkt och filsökväg bestäms server-side. Inga fraktuppgifter.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { evaluateCors, jsonResponse, safeSuccessOrigin } from "../_shared/cors.ts";
import { clientIp, getDigitalProduct, hashKey, isLiveStripeKey } from "../_shared/digitalProduct.ts";

const GENERIC_FAILURE = "Kunde inte starta betalningen. Försök igen om en stund.";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

serve(async (req) => {
  const cors = evaluateCors(req);
  if (req.method === "OPTIONS") {
    if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
    return new Response(null, { headers: cors.headers });
  }
  if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors.headers);

  const corsHeaders = cors.headers;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !stripeKey) {
    console.error("[digital-checkout] misconfigured environment");
    return jsonResponse({ error: GENERIC_FAILURE }, 500, corsHeaders);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let orderId: string | null = null;

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const product = getDigitalProduct(body.productSlug ?? "mina-forsta-hons");
    if (!product) return jsonResponse({ error: "Okänd produkt." }, 400, corsHeaders);

    if (body.consent !== true) {
      return jsonResponse(
        { error: "Du måste godkänna omedelbar leverans och att ångerrätten upphör." },
        400,
        corsHeaders,
      );
    }

    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const email = rawEmail && EMAIL_RE.test(rawEmail) && rawEmail.length <= 254 ? rawEmail : null;
    if (rawEmail && !email) {
      return jsonResponse({ error: "Ange en giltig e-postadress." }, 400, corsHeaders);
    }

    // Faktureringsland: vi kan bara momshantera Sverige automatiskt.
    const rawCountry = typeof body.country === "string" ? body.country.trim().toUpperCase() : "SE";
    if (!product.allowedBillingCountries.includes(rawCountry)) {
      return jsonResponse({
        error: "Vi säljer guiden till kunder med svensk faktureringsadress. Mejla "
          + "info@auroramedia.se om du vill köpa från ett annat land.",
      }, 400, corsHeaders);
    }

    // Hastighetsspärr: max 5 kassaförsök per IP och 10 minuter, 5 per e-post.
    const ip = clientIp(req);
    for (const [scope, value, max] of [
      ["digital-checkout-ip", ip, 5],
      ["digital-checkout-email", email ?? "", 5],
    ] as const) {
      if (!value) continue;
      const { data: allowed, error: limitError } = await admin.rpc("digital_rate_limit", {
        p_scope: scope,
        p_key_hash: await hashKey(value),
        p_max: max,
        p_window_minutes: 10,
      });
      if (limitError) console.error("[digital-checkout] rate limit error", limitError.message);
      if (allowed === false) {
        return jsonResponse(
          { error: "För många försök just nu. Vänta några minuter och prova igen." },
          429,
          corsHeaders,
        );
      }
    }

    const now = new Date().toISOString();
    const { data: order, error: orderError } = await admin
      .from("digital_orders")
      .insert({
        product_slug: product.slug,
        product_name: product.name,
        customer_email: email,
        amount_ore: product.amountOre,
        currency: product.currency,
        vat_rate: product.vatRate,
        status: "pending",
        declared_country: rawCountry,
        livemode: isLiveStripeKey(stripeKey),
        consent_immediate_delivery: true,
        consent_terms_version: product.termsVersion,
        consent_at: now,
      })
      .select("id, order_number")
      .single();
    if (orderError || !order) throw new Error(`order insert failed: ${orderError?.message}`);
    orderId = order.id;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = safeSuccessOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "sv",
      customer_email: email ?? undefined,
      customer_creation: "always",
      // Krävs för att kunna verifiera faktureringslandet mot momsen efteråt.
      billing_address_collection: "required",
      // Endast svensk försäljning i detta första steg – ingen global momsrisk.
      payment_method_types: ["card"],
      // Beständigt Stripe-pris (inte price_data) så att intäkter kan följas per produkt.
      line_items: [{ quantity: 1, price: product.stripePriceId }],
      metadata: {
        digital_order_id: order.id,
        digital_product_slug: product.slug,
        order_number: order.order_number,
        terms_version: product.termsVersion,
        declared_country: rawCountry,
      },
      payment_intent_data: {
        description: `Hönsgården – Mina första höns (PDF), order ${order.order_number}`,
        metadata: { digital_order_id: order.id, digital_product_slug: product.slug },
      },
      success_url: `${origin}${product.salesPath}/tack?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${product.salesPath}?avbrutet=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    }, { idempotencyKey: `digital-${order.id}` });

    if (!session.url) throw new Error("Stripe returned no checkout URL");

    await admin.from("digital_orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    return jsonResponse({ url: session.url, orderNumber: order.order_number }, 200, corsHeaders);
  } catch (error) {
    console.error("[digital-checkout]", error instanceof Error ? error.message : String(error));
    if (orderId) {
      await admin.from("digital_orders")
        .update({ status: "failed" })
        .eq("id", orderId)
        .eq("status", "pending");
    }
    return jsonResponse({ error: GENERIC_FAILURE }, 500, corsHeaders);
  }
});
