import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PREMIUM_STATUSES = new Set(["active", "trialing", "past_due"]);

function toIsoDate(input?: number | null): string | null {
  if (typeof input !== "number") return null;
  return new Date(input * 1000).toISOString();
}

function isEligibleSubscription(
  subscription: Stripe.Subscription,
  now: Date,
): boolean {
  if (!PREMIUM_STATUSES.has(subscription.status)) return false;

  if (subscription.status === "active" || subscription.status === "trialing") {
    return true;
  }

  const end = toIsoDate(subscription.current_period_end);
  return !!end && new Date(end) > now;
}

function pickBestSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  const rank: Record<string, number> = {
    active: 3,
    trialing: 2,
    past_due: 1,
  };

  return subscriptions.sort((a, b) => {
    const statusDiff = (rank[b.status] ?? 0) - (rank[a.status] ?? 0);
    if (statusDiff !== 0) return statusDiff;
    return (b.current_period_end ?? 0) - (a.current_period_end ?? 0);
  })[0] ?? null;
}

async function getUserFromToken(supabase: any, req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Saknar Authorization-header");

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error) throw new Error(`Auth-fel: ${error.message}`);
  if (!data.user) throw new Error("Användaren är inte inloggad");

  return data.user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY saknas");

    const user = await getUserFromToken(supabase, req);
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "user_id, email, stripe_customer_id, subscription_status, premium_expires_at, is_lifetime_premium",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Kunde inte läsa profil: ${profileError.message}`);
    }

    const now = new Date();
    const isLifetime = profile?.is_lifetime_premium === true;

    if (isLifetime) {
      return new Response(
        JSON.stringify({
          subscribed: true,
          subscription_end: null,
          source: "lifetime",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const customerIds = new Set<string>();

    if (profile?.stripe_customer_id) {
      customerIds.add(profile.stripe_customer_id);
    }

    if (user.email) {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 100,
      });

      for (const customer of customers.data) {
        customerIds.add(customer.id);
      }
    }

    const ids = [...customerIds];

    if (ids.length === 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          subscription_status: "free",
          premium_expires_at: null,
        })
        .eq("user_id", user.id);

      if (updateError) {
        throw new Error(`Kunde inte nollställa profil: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({
          subscribed: false,
          subscription_end: null,
          source: "no_customer",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const subResponses = await Promise.all(
      ids.map((customerId) =>
        stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 100,
        })
      ),
    );

    const subscriptions = subResponses
      .flatMap((response) => response.data)
      .filter((sub) => isEligibleSubscription(sub, now));

    const best = pickBestSubscription(subscriptions);

    if (!best) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          subscription_status: "free",
          premium_expires_at: null,
        })
        .eq("user_id", user.id);

      if (updateError) {
        throw new Error(`Kunde inte nedgradera profil: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({
          subscribed: false,
          subscription_end: null,
          source: "no_active_subscription",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const subscriptionEnd = toIsoDate(best.current_period_end);

    const updatePayload = {
      subscription_status: "premium",
      premium_expires_at: subscriptionEnd,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(`Kunde inte uppdatera profil: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        subscription_end: subscriptionEnd,
        source: "stripe",
        stripe_status: best.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
