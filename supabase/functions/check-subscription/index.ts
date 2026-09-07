import { isPlusSubscription, plusPriceIds, stripePeriodEnd as getStripeEnd, stripeAccessActive } from "../_shared/stripeBilling.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { independentPremiumExpiry, isAppleIapActive, readAppleIapPreference, resolveEntitlement } from "../_shared/appleIap.ts";
import { hasActiveLocalPremium, shouldClearLocalPremium } from "../_shared/localPremium.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STATUS_PRIORITY: Record<string, number> = {
  active: 4,
  trialing: 3,
  past_due: 2,
};

function getStripeProductId(subscription: Stripe.Subscription): string | null {
  const product = subscription.items.data[0]?.price?.product;
  return typeof product === "string" ? product : product?.id ?? null;
}

function getStripePriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("subscription_status, premium_expires_at, is_lifetime_premium, stripe_customer_id, preferences")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw new Error("Profile lookup unavailable");
    const now = new Date();
    const appleIap = readAppleIapPreference(profile?.preferences);
    const applePaid = isAppleIapActive(appleIap, now, (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    });
    const hasLifetimePremium = profile?.is_lifetime_premium === true;
    const localTrialEnd = independentPremiumExpiry(profile?.preferences, profile?.premium_expires_at);
    const localTrialActive = hasActiveLocalPremium(localTrialEnd, now);

    const localTrialResponse = () => new Response(JSON.stringify({
      subscribed: true,
      premium_type: "trial",
      subscription_end: localTrialEnd,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (hasLifetimePremium) {
      return new Response(JSON.stringify({
        subscribed: true,
        premium_type: "lifetime",
        subscription_end: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const applePaidResponse = () => new Response(JSON.stringify({
      subscribed: true,
      premium_type: "paid",
      subscription_end: appleIap?.expires_at ?? null,
      source: "apple",
      product_id: appleIap?.product_id ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      if (applePaid) return applePaidResponse();
      if (localTrialActive) return localTrialResponse();
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customers: Stripe.ApiList<Stripe.Customer>;
    try {
      customers = await stripe.customers.list({ email: user.email, limit: 100 });
    } catch (stripeError) {
      const message = stripeError instanceof Error ? stripeError.message : String(stripeError);
      console.error("[check-subscription] Stripe customer lookup failed", message);
      if (applePaid) return applePaidResponse();
      if (localTrialActive) return localTrialResponse();
      throw stripeError;
    }
    const customerIds = [
      ...new Set([
        ...(profile?.stripe_customer_id ? [profile.stripe_customer_id] : []),
        ...customers.data.map((customer: Stripe.Customer) => customer.id),
      ]),
    ];

    let stripeSubscription: Stripe.Subscription | null = null;

    if (customerIds.length > 0) {
      try {
        const subscriptionResponses = await Promise.all(
          customerIds.map((customerId) => stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 100,
          })),
        );

        const eligibleSubscriptions = subscriptionResponses
          .flatMap((response: Stripe.ApiList<Stripe.Subscription>) => response.data)
          .filter((subscription: Stripe.Subscription) => isPlusSubscription(subscription, plusPriceIds(Deno.env.get("STRIPE_PRICE_MONTHLY"), Deno.env.get("STRIPE_PRICE_YEARLY"))) && stripeAccessActive(subscription, now))
          .sort((a: Stripe.Subscription, b: Stripe.Subscription) => {
            const statusDiff = (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0);
            if (statusDiff !== 0) return statusDiff;
            const endA = new Date(getStripeEnd(a) ?? 0).getTime();
            const endB = new Date(getStripeEnd(b) ?? 0).getTime();
            return endB - endA;
          });

        stripeSubscription = eligibleSubscriptions[0] ?? null;
      } catch (stripeError) {
        const message = stripeError instanceof Error ? stripeError.message : String(stripeError);
        console.error("[check-subscription] Stripe subscription lookup failed", message);
        if (applePaid) return applePaidResponse();
        if (localTrialActive) return localTrialResponse();
        throw stripeError;
      }
    }

    if (stripeSubscription) {
      const customerId = typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id;
      const subscriptionEnd = getStripeEnd(stripeSubscription);
      const productId = getStripeProductId(stripeSubscription);
      const priceId = getStripePriceId(stripeSubscription);

      const { error: updateError } = await supabaseClient.rpc("apply_stripe_plus_status", {
        _user_id: user.id, _customer_id: customerId, _active: true,
        _period_end: subscriptionEnd, _observed_at: now.toISOString(),
      });
      if (updateError) throw new Error("Subscription persistence failed");

      return new Response(JSON.stringify({
        subscribed: true,
        premium_type: hasLifetimePremium ? "lifetime" : "paid",
        product_id: productId,
        price_id: priceId,
        subscription_end: hasLifetimePremium ? null : subscriptionEnd,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const entitlement = resolveEntitlement({
      hasLifetime: hasLifetimePremium,
      stripePaid: false,
      stripeEnd: null,
      applePaid,
      appleEnd: appleIap?.expires_at ?? null,
      localTrialActive,
      localTrialEnd,
    });

    if (entitlement.source === "apple") {
      return applePaidResponse();
    }

    if (entitlement.source === "trial") {
      if (profile?.subscription_status !== "premium") {
        await supabaseClient
          .from("profiles")
          .update({ subscription_status: "premium" })
          .eq("user_id", user.id);
      }

      return localTrialResponse();
    }

    if (!applePaid && shouldClearLocalPremium(profile?.subscription_status, profile?.premium_expires_at, now)) {
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
