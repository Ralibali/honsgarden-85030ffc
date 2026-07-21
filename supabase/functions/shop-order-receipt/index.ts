// Publik säker orderkvittens – nås endast med public_token.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { evaluateCors, jsonResponse } from "../_shared/cors.ts";

const GENERIC_FAILURE = "Kunde inte hämta kvitto";

serve(async (req) => {
  const cors = evaluateCors(req);

  if (req.method === "OPTIONS") {
    if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
    return new Response(null, { headers: cors.headers });
  }
  if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors.headers);

  const corsHeaders = cors.headers;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[shop-order-receipt] misconfigured environment");
      return jsonResponse({ error: GENERIC_FAILURE }, 500, corsHeaders);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length < 20 || token.length > 128) {
      return jsonResponse({ error: "Ogiltig token" }, 400, corsHeaders);
    }

    const { data: order, error } = await admin
      .from("shop_orders")
      .select(
        "order_number, status, fulfillment_status, currency, subtotal_ore, shipping_ore, amount_total_ore, customer_email, customer_name, shipping_address, items, created_at, tracking_number, tracking_url",
      )
      .eq("public_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!order) return jsonResponse({ error: "Order hittades inte" }, 404, corsHeaders);

    const maskedEmail = order.customer_email
      ? order.customer_email.replace(/(^.).*(@.*)$/, "$1***$2")
      : null;

    return jsonResponse(
      {
        receipt: {
          order_number: order.order_number,
          status: order.status,
          fulfillment_status: order.fulfillment_status,
          currency: order.currency,
          subtotal_ore: order.subtotal_ore,
          shipping_ore: order.shipping_ore,
          amount_total_ore: order.amount_total_ore,
          customer_email: maskedEmail,
          customer_name: order.customer_name,
          shipping_address: order.shipping_address,
          items: order.items,
          created_at: order.created_at,
          tracking_number: order.tracking_number,
          tracking_url: order.tracking_url,
        },
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shop-order-receipt] internal error:", message);
    return jsonResponse({ error: GENERIC_FAILURE }, 500, corsHeaders);
  }
});
