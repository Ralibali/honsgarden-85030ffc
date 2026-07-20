import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSafeOrigin(req: Request) {
  const fallback = "https://honsgarden.se";
  const requested = req.headers.get("origin");
  if (!requested) return fallback;
  try {
    const url = new URL(requested);
    const configured = (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const defaults = [
      "https://honsgarden.se",
      "https://www.honsgarden.se",
      "https://honsgarden.app",
      "https://www.honsgarden.app",
      "https://honsgarden.lovable.app",
    ];
    const allowed = new Set([...defaults, ...configured]);
    const isLocalDev = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    return allowed.has(url.origin) || isLocalDev ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

interface CartItemInput {
  product_id: string;
  quantity: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeKey) {
      throw new Error("Shop checkout is not fully configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "User not authenticated" }, 401);

    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.slice("Bearer ".length).trim();
    const { data, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !data.user?.email) return json({ error: "User not authenticated" }, 401);
    const user = data.user;

    // Shoppen är dold – bara admin får handla tills den lanseras publikt.
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Butiken är inte öppen ännu" }, 403);

    const body = await req.json().catch(() => ({}));
    const rawItems: CartItemInput[] = Array.isArray(body?.items) ? body.items : [];
    const items = rawItems
      .filter((it) => typeof it?.product_id === "string" && Number.isFinite(it?.quantity))
      .map((it) => ({ product_id: it.product_id, quantity: Math.max(1, Math.min(99, Math.floor(it.quantity))) }));

    if (items.length === 0) return json({ error: "Kundvagnen är tom" }, 400);
    if (items.length > 50) return json({ error: "För många varor" }, 400);

    // Priser hämtas ALLTID från databasen – aldrig från klienten.
    const ids = [...new Set(items.map((it) => it.product_id))];
    const { data: products, error: productsError } = await supabaseAdmin
      .from("shop_products")
      .select("id, name, price_ore, active, stock")
      .in("id", ids);
    if (productsError) throw new Error(`Product lookup failed: ${productsError.message}`);

    const byId = new Map((products ?? []).map((p) => [p.id, p]));
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const orderItems: { product_id: string; name: string; quantity: number; unit_price_ore: number }[] = [];
    let totalOre = 0;

    for (const item of items) {
      const product = byId.get(item.product_id);
      if (!product || !product.active) {
        return json({ error: "En produkt i kundvagnen finns inte längre" }, 400);
      }
      if (product.stock !== null && product.stock < item.quantity) {
        return json({ error: `Bara ${product.stock} kvar av ${product.name}` }, 400);
      }
      totalOre += product.price_ore * item.quantity;
      orderItems.push({
        product_id: product.id,
        name: product.name,
        quantity: item.quantity,
        unit_price_ore: product.price_ore,
      });
      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: "sek",
          unit_amount: product.price_ore,
          product_data: { name: product.name },
        },
      });
    }

    if (totalOre < 50) return json({ error: "Beloppet är för litet för kortbetalning" }, 400);

    // 1. Skapa ordern som pending
    const { data: order, error: orderError } = await supabaseAdmin
      .from("shop_orders")
      .insert({
        user_id: user.id,
        items: orderItems,
        amount_total_ore: totalOre,
        status: "pending",
      })
      .select("id")
      .single();
    if (orderError || !order) throw new Error(`Could not create order: ${orderError?.message}`);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = getSafeOrigin(req);

    // 2. Återanvänd Stripe-kunden om användaren redan har en
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const customerId = profile?.stripe_customer_id ?? undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id,
      line_items: lineItems,
      mode: "payment",
      allow_promotion_codes: true,
      metadata: {
        shop_order_id: order.id,
        supabase_user_id: user.id,
      },
      payment_intent_data: {
        metadata: {
          shop_order_id: order.id,
          supabase_user_id: user.id,
        },
      },
      success_url: `${origin}/app/butik?kop=klart&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/butik?kop=avbrutet`,
    });

    const { error: linkError } = await supabaseAdmin
      .from("shop_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);
    if (linkError) console.error("[shop-checkout] could not link session:", linkError.message);

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return json({ url: session.url, order_id: order.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shop-checkout]", message);
    return json({ error: message }, 500);
  }
});
