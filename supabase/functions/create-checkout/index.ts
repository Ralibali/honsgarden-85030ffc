import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PREMIUM_STATUSES = new Set(["active", "trialing", "past_due"]);

function getSiteUrl(req: Request): string {
  return (
    req.headers.get("origin") ||
    Deno.env.get("SITE_URL") ||
    "https://honsgarden.se"
  );
}

function getPriceId(plan: string): string {
  if (plan === "monthly") {
    const value = Deno.env.get("STRIPE_PRICE_MONTHLY");
    if (!value) throw new Error("STRIPE_PRICE_MONTHLY saknas");
    return value;
  }

  if (plan === "yearly") {
    const value = Deno.env.get("STRIPE_PRICE_YEARLY");
    if (!value) throw new Error("STRIPE_PRICE_YEARLY saknas");
    return value;
  }

  throw new Error("Ogiltig plan");
}

async function getUserFromToken(supabaseAdmin: any, req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Saknar Authorization-header");

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error) throw new Error(`Auth-fel: ${error.message}`);
  if (!data.user) throw new Error("Användaren är inte inloggad");

  return data.user;
}

async function resolveCustomerId(
  stripe: Stripe,
  supabaseAdmin: any,
  user: { id: string; email?: string | null },
): Promise<string> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Kunde inte läsa profil: ${profileError.message}`);
  }

  let customerId: string | null = profile?.stripe_customer_id ?? null;

  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if ("deleted" in customer && customer.deleted) {
        customerId = null;
      }
    } catch {
      customerId = null;
    }
  }

  if (!customerId && user.email) {
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 100,
    });
    const existing = customers.data[0];
    if (existing) {
      customerId = existing.id;
    }
  }

  if (!customerId) {
    const created = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
      },
    });
    customerId = created.id;
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Kunde inte spara stripe_customer_id: ${updateError.message}`);
  }

  return customerId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY saknas");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const user = await getUserFromToken(supabaseAdmin, req);

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan;

    const priceId = getPriceId(plan);
    const siteUrl = getSiteUrl(req);

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const customerId = await resolveCustomerId(stripe, supabaseAdmin, user);

    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const blocking = existingSubscriptions.data.find((sub) =>
      PREMIUM_STATUSES.has(sub.status)
    );

    if (blocking) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${siteUrl}/app/premium`,
      });

      return new Response(
        JSON.stringify({
          error: "already_subscribed",
          message: "Användaren har redan en aktiv prenumeration",
          portal_url: portal.url,
          subscription_status: blocking.status,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/app/premium?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/app/premium?canceled=true`,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
        },
      },
      metadata: {
        supabase_user_id: user.id,
        plan,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message ?? "Okänt fel",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
