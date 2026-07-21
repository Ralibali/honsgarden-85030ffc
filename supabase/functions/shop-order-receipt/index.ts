// Publik säker orderkvittens – nås endast med public_token.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Server misconfigured");

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length < 20 || token.length > 128) return json({ error: "Ogiltig token" }, 400);

    const { data: order, error } = await admin
      .from("shop_orders")
      .select("order_number, status, fulfillment_status, currency, subtotal_ore, shipping_ore, amount_total_ore, customer_email, customer_name, shipping_address, items, created_at, tracking_number, tracking_url")
      .eq("public_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!order) return json({ error: "Order hittades inte" }, 404);

    // Maskera e-post lätt (visa bara första + domän) i publikt kvitto
    const maskedEmail = order.customer_email
      ? order.customer_email.replace(/(^.).*(@.*)$/, "$1***$2")
      : null;

    return json({
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shop-order-receipt]", message);
    return json({ error: "Kunde inte hämta kvitto" }, 500);
  }
});
