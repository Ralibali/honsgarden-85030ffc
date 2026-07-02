import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ELIGIBLE_STATUSES = new Set(["active", "trialing", "past_due"]);
const STATUS_PRIORITY: Record<string, number> = {
  active: 4,
  trialing: 3,
  past_due: 2,
};

function getStripeEnd(subscription: Stripe.Subscription): string | null {
  const endTimestamp = (subscription as any).current_period_end as number | undefined;
  return typeof endTimestamp === "number" ? new Date(endTimestamp * 1000).toISOString() : null;
}

function getStripeProductId(subscription: Stripe.Subscription): string | null {
  const product = subscription.items.data[0]?.price?.product;
  return typeof product === "string" ? product : product?.id ?? null;
}

function getStripePriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

function isEligibleStripeSubscription(subscription: Stripe.Subscription, now: Date): boolean {
  if (!ELIGIBLE_STATUSES.has(subscription.status)) return false;
  if (subscription.status === "active" || subscription.status === "trialing") return true;

  const stripeEnd = getStripeEnd(subscription);
  return !!stripeEnd && new Date(stripeEnd) > now;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_status, premium_expires_at, is_lifetime_premium, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const now = new Date();
    const hasLifetimePremium = profile?.is_lifetime_premium === true;
    const localExpiry = profile?.premium_expires_at ? new Date(profile.premium_expires_at) : null;
    const hasActiveLocalPremium = !!localExpiry && localExpiry > now;

    const customers = await stripe.customers.list({ email: user.email, limit: 100 });
    const customerIds = [
      ...new Set([
        ...(profile?.stripe_customer_id ? [profile.stripe_customer_id] : []),
        ...customers.data.map((customer) => customer.id),
      ]),
    ];

    let stripeSubscription: Stripe.Subscription | null = null;

    if (customerIds.length > 0) {
      const subscriptionResponses = await Promise.all(
        customerIds.map((customerId) => stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
        })),
      );

      const eligibleSubscriptions = subscriptionResponses
        .flatMap((response) => response.data)
        .filter((subscription) => isEligibleStripeSubscription(subscription, now))
        .sort((a, b) => {
          const statusDiff = (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0);
          if (statusDiff !== 0) return statusDiff;
          return (((b as any).current_period_end ?? 0) - ((a as any).current_period_end ?? 0));
        });

      stripeSubscription = eligibleSubscriptions[0] ?? null;
    }

    if (stripeSubscription) {
      const customerId = typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id;
      const subscriptionEnd = getStripeEnd(stripeSubscription);
      const productId = getStripeProductId(stripeSubscription);

      const desiredExpiry = hasLifetimePremium ? null : subscriptionEnd;
      const needsUpdate =
        profile?.stripe_customer_id !== customerId ||
        profile?.subscription_status !== "premium" ||
        (profile?.premium_expires_at ?? null) !== desiredExpiry;

      if (needsUpdate) {
        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            subscription_status: "premium",
            premium_expires_at: desiredExpiry,
          })
          .eq("user_id", user.id);

        if (updateError) throw new Error(`Profile update error: ${updateError.message}`);
      }

      return new Response(JSON.stringify({
        subscribed: true,
        premium_type: hasLifetimePremium ? "lifetime" : "paid",
        product_id: productId,
        subscription_end: hasLifetimePremium ? null : subscriptionEnd,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (hasLifetimePremium) {
      return new Response(JSON.stringify({
        subscribed: true,
        premium_type: "lifetime",
        subscription_end: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (hasActiveLocalPremium) {
      if (profile?.subscription_status !== "premium") {
        await supabaseClient
          .from("profiles")
          .update({ subscription_status: "premium" })
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({
        subscribed: true,
        premium_type: "trial",
        subscription_end: profile?.premium_expires_at ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (profile?.subscription_status === "premium" || profile?.premium_expires_at) {
      await supabaseClient
        .from("profiles")
        .update({ subscription_status: "free", premium_expires_at: null })
        .eq("user_id", user.id);
    }

    return new Response(JSON.stringify({
      subscribed: false,
      premium_type: "free",
      subscription_end: null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[check-subscription] fatal error", message);

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
