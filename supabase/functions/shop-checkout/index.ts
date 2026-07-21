// Publik shop-checkout: stöder gäster, validerar allt server-side,
// skapar en pending order och startar Stripe Checkout.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_ORIGINS_DEFAULT = [
  "https://honsgarden.se",
  "https://www.honsgarden.se",
  "https://honsgarden.app",
  "https://www.honsgarden.app",
  "https://honsgarden.lovable.app",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeOrigin(req: Request): string {
  const fallback = "https://honsgarden.se";
  const requested = req.headers.get("origin");
  if (!requested) return fallback;
  try {
    const url = new URL(requested);
    const configured = (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "").split(",").map(v => v.trim()).filter(Boolean);
    const allowed = new Set([...ALLOWED_ORIGINS_DEFAULT, ...configured]);
    const isLocal = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    return allowed.has(url.origin) || isLocal ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

interface CartItemInput {
  product_id: string;
  variant_id?: string | null;
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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Optional auth – om användaren är inloggad förifyller vi email.
    let userId: string | null = null;
    let userEmail: string | null = null;
    let isAdmin = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseAuth = createClient(supabaseUrl, anonKey);
      const token = authHeader.slice("Bearer ".length).trim();
      const { data } = await supabaseAuth.auth.getUser(token);
      if (data.user) {
        userId = data.user.id;
        userEmail = data.user.email ?? null;
        const { data: adminData } = await supabaseAdmin.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
        isAdmin = !!adminData;
      }
    }

    // Publik toggle – blockera om butiken är stängd (om inte admin med preview-flagga).
    const body = await req.json().catch(() => ({}));
    const previewMode = !!body?.preview && isAdmin;
    const { data: enabledRow } = await supabaseAdmin.rpc("shop_public_enabled");
    if (!enabledRow && !isAdmin) return json({ error: "Butiken är inte öppen ännu" }, 403);
    if (!enabledRow && !previewMode) {
      // Admin behöver skicka preview: true för att köra köp i stängt läge.
      return json({ error: "Butiken är inte öppen ännu" }, 403);
    }

    // ---- Items ----
    const rawItems: CartItemInput[] = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) return json({ error: "Kundvagnen är tom" }, 400);
    if (rawItems.length > 50) return json({ error: "För många varor" }, 400);

    // Slå ihop dubbletter (samma product+variant)
    const merged = new Map<string, CartItemInput>();
    for (const it of rawItems) {
      if (typeof it?.product_id !== "string") continue;
      const qty = Math.max(1, Math.min(99, Math.floor(Number(it.quantity) || 0)));
      if (qty <= 0) continue;
      const variantId = typeof it.variant_id === "string" && it.variant_id.length > 0 ? it.variant_id : null;
      const key = `${it.product_id}::${variantId ?? ""}`;
      const existing = merged.get(key);
      if (existing) existing.quantity = Math.min(99, existing.quantity + qty);
      else merged.set(key, { product_id: it.product_id, variant_id: variantId, quantity: qty });
    }
    const items = Array.from(merged.values());
    if (items.length === 0) return json({ error: "Kundvagnen är tom" }, 400);

    const productIds = [...new Set(items.map((it) => it.product_id))];
    const variantIds = items.map((it) => it.variant_id).filter((v): v is string => !!v);

    const [{ data: products, error: pErr }, { data: variants, error: vErr }] = await Promise.all([
      supabaseAdmin.from("shop_products").select("id, name, price_ore, active, stock, slug").in("id", productIds),
      variantIds.length > 0
        ? supabaseAdmin.from("shop_product_variants").select("id, product_id, name, price_override_ore, stock, active, sku").in("id", variantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (pErr) throw new Error(`Product lookup failed: ${pErr.message}`);
    if (vErr) throw new Error(`Variant lookup failed: ${vErr.message}`);

    // deno-lint-ignore no-explicit-any
    const productById = new Map<string, any>((products ?? []).map((p) => [p.id, p]));
    // deno-lint-ignore no-explicit-any
    const variantById = new Map<string, any>((variants ?? []).map((v) => [v.id, v]));

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const orderItems: Array<{
      product_id: string; variant_id: string | null; name: string; variant_name?: string;
      sku?: string | null; quantity: number; unit_price_ore: number;
    }> = [];
    let subtotalOre = 0;

    for (const it of items) {
      const product = productById.get(it.product_id);
      if (!product || !product.active) return json({ error: "En produkt i kundvagnen finns inte längre" }, 400);

      let unitPrice = product.price_ore as number;
      let stock: number | null = product.stock ?? null;
      let variantName: string | undefined;
      let sku: string | null = null;
      if (it.variant_id) {
        const variant = variantById.get(it.variant_id);
        if (!variant || !variant.active || variant.product_id !== product.id) {
          return json({ error: "En vald variant är inte tillgänglig" }, 400);
        }
        if (variant.price_override_ore != null) unitPrice = variant.price_override_ore;
        stock = variant.stock ?? null;
        variantName = variant.name;
        sku = variant.sku ?? null;
      }
      if (stock !== null && stock < it.quantity) {
        return json({ error: `Endast ${stock} kvar av ${product.name}${variantName ? ' – ' + variantName : ''}` }, 400);
      }

      subtotalOre += unitPrice * it.quantity;
      orderItems.push({
        product_id: product.id,
        variant_id: it.variant_id ?? null,
        name: product.name,
        variant_name: variantName,
        sku,
        quantity: it.quantity,
        unit_price_ore: unitPrice,
      });
      lineItems.push({
        quantity: it.quantity,
        price_data: {
          currency: "sek",
          unit_amount: unitPrice,
          product_data: { name: variantName ? `${product.name} – ${variantName}` : product.name },
        },
      });
    }

    if (subtotalOre < 300) return json({ error: "Beloppet är för litet för kortbetalning" }, 400);

    // ---- Shipping från settings ----
    const { data: settingsData } = await supabaseAdmin.rpc("get_shop_settings");
    const raw = (settingsData ?? {}) as Record<string, unknown>;
    const parseNum = (v: unknown, fb: number) => {
      if (typeof v === "number") return v;
      if (typeof v === "string") { const n = Number(v.replace(/^"|"$/g, "")); return Number.isFinite(n) ? n : fb; }
      return fb;
    };
    const shippingOre = parseNum(raw["shop_shipping_ore"], 5900);
    const freeThreshold = parseNum(raw["shop_free_shipping_threshold_ore"], 49900);
    const shipping = subtotalOre >= freeThreshold ? 0 : shippingOre;
    const totalOre = subtotalOre + shipping;

    // ---- Skapa pending order ----
    const { data: order, error: orderError } = await supabaseAdmin
      .from("shop_orders")
      // deno-lint-ignore no-explicit-any
      .insert({
        user_id: userId,
        items: orderItems,
        subtotal_ore: subtotalOre,
        shipping_ore: shipping,
        amount_total_ore: totalOre,
        status: "pending",
        customer_email: userEmail,
      } as any)
      .select("id, order_number, public_token")
      .single();
    if (orderError || !order) throw new Error(`Could not create order: ${orderError?.message}`);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = safeOrigin(req);

    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail ?? undefined,
      line_items: lineItems,
      mode: "payment",
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ["SE"] },
      shipping_options: shipping > 0
        ? [{
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: shipping, currency: "sek" },
              display_name: "Standardleverans (PostNord)",
              delivery_estimate: {
                minimum: { unit: "business_day", value: 1 },
                maximum: { unit: "business_day", value: 3 },
              },
            },
          }]
        : [{
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: 0, currency: "sek" },
              display_name: "Fri frakt",
            },
          }],
      metadata: {
        shop_order_id: order.id,
        shop_order_number: order.order_number,
        shop_public_token: order.public_token,
        ...(userId ? { supabase_user_id: userId } : {}),
      },
      payment_intent_data: {
        metadata: {
          shop_order_id: order.id,
          shop_order_number: order.order_number,
        },
      },
      success_url: `${origin}/butik/tack?token=${encodeURIComponent(order.public_token)}`,
      cancel_url: `${origin}/butik?canceled=1`,
    });

    await supabaseAdmin
      .from("shop_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return json({ url: session.url, order_id: order.id, order_number: order.order_number });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[shop-checkout]", message);
    return json({ error: "Kunde inte starta betalning. Försök igen om en stund." }, 500);
  }
});
