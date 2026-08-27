import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isIosCheckoutBlocked } from "../_shared/appleIap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_PRICE_ENV: Record<"monthly" | "yearly", string> = {
  monthly: "STRIPE_PRICE_MONTHLY",
  yearly: "STRIPE_PRICE_YEARLY",
};

// Äldre klienter kan fortfarande skicka gamla priceId:n. De används endast för
// att avgöra plan – nya köp måste alltid använda de aktuella env-konfigurerade priserna.
const LEGACY_PRICE_PLAN: Record<string, "monthly" | "yearly"> = {
  price_1T3joGHzffTezY82dRQc7GTO: "monthly",
  price_1T3jwRHzffTezY829aWQVXZr: "yearly",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolvePlanAndPrice(body: Record<string, unknown>) {
  const requestedPlan = typeof body.plan === "string" ? body.plan : null;
  const legacyPriceId = typeof body.priceId === "string" ? body.priceId : null;
  const plan = requestedPlan ?? (legacyPriceId ? LEGACY_PRICE_PLAN[legacyPriceId] : null);

  if (plan !== "monthly" && plan !== "yearly") {
    throw new Error("Invalid plan. Expected monthly or yearly.");
  }

  const priceId = Deno.env.get(PLAN_PRICE_ENV[plan]);
  if (!priceId) {
    throw new Error(`Stripe price is not configured for plan: ${plan}`);
  }

  return { plan, priceId };
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeKey) {
      throw new Error("Checkout backend is not fully configured");
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

    const body = await req.json().catch(() => ({}));
    if (isIosCheckoutBlocked(req.headers.get("x-supabase-client-platform"), (body as Record<string, unknown>).platform)) {
      return json({
        error: "ios_storekit_required",
        message: "Plus in the iOS app is sold through StoreKit, not Stripe.",
      }, 400);
    }
    const { plan, priceId } = resolvePlanAndPrice(body as Record<string, unknown>);
    const origin = getSafeOrigin(req);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);

    let customerId: string | null = profile?.stripe_customer_id ?? null;

    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if ((customer as Stripe.DeletedCustomer).deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const list = await stripe.customers.list({ email: user.email, limit: 10 });
      const matching = list.data.find((customer) => customer.metadata?.supabase_user_id === user.id)
        ?? list.data[0];
      customerId = matching?.id ?? null;
    }

    if (!customerId) {
      const created = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = created.id;
    }

    const { error: saveCustomerError } = await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id);
    if (saveCustomerError) throw new Error(`Could not save Stripe customer: ${saveCustomerError.message}`);

    await stripe.customers.update(customerId, {
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });

    const existing = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    const blocking = existing.data.find(
      (subscription) => ["active", "trialing", "past_due", "paused"].includes(subscription.status),
    );

    if (blocking) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/app/premium`,
      });
      return json({
        error: "already_subscribed",
        message: "Du har redan en prenumeration. Vi öppnar kundportalen.",
        portal_url: portal.url,
        subscription_status: blocking.status,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      metadata: {
        supabase_user_id: user.id,
        plan,
        premium_type: "subscription",
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          premium_type: "subscription",
        },
      },
      success_url: `${origin}/app/premium?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/premium?canceled=true`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[create-checkout]", message);
    return json({ error: message }, 500);
  }
});
