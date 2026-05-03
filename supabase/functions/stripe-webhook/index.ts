import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const PREMIUM_STATUSES = new Set(["active", "trialing", "past_due"]);

function toIsoDate(input?: number | null): string | null {
  if (typeof input !== "number") return null;
  return new Date(input * 1000).toISOString();
}

async function findUserIdForSubscription(
  supabase: any,
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const metadataUserId = subscription.metadata?.supabase_user_id;
  if (metadataUserId) {
    return metadataUserId;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return null;

  const { data: byCustomer } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (byCustomer?.user_id) {
    return byCustomer.user_id;
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!("deleted" in customer) && customer.email) {
      const { data: byEmail } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", customer.email)
        .maybeSingle();

      if (byEmail?.user_id) {
        return byEmail.user_id;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function syncProfileFromSubscription(
  supabase: any,
  stripe: Stripe,
  subscription: Stripe.Subscription,
) {
  const userId = await findUserIdForSubscription(supabase, stripe, subscription);
  if (!userId) {
    console.warn("[stripe-webhook] Ingen användare hittades för subscription", subscription.id);
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const isPremium = PREMIUM_STATUSES.has(subscription.status);
  const premiumExpiresAt = isPremium
    ? toIsoDate(subscription.current_period_end)
    : null;

  const payload: Record<string, unknown> = {
    subscription_status: isPremium ? "premium" : "free",
    premium_expires_at: premiumExpiresAt,
  };

  if (customerId) {
    payload.stripe_customer_id = customerId;
  }

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Kunde inte uppdatera profil: ${error.message}`);
  }
}

serve(async (req) => {
  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY saknas");
    if (!stripeWebhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET saknas");

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Saknar stripe-signature", { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        stripeWebhookSecret,
      );
    } catch (err: any) {
      return new Response(`Ogiltig webhook-signatur: ${err.message}`, {
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        const userId = session.metadata?.supabase_user_id;

        if (userId && customerId) {
          await supabase
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("user_id", userId);
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncProfileFromSubscription(supabase, stripe, subscription);
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[stripe-webhook] fel", error);
    return new Response(
      JSON.stringify({
        error: error?.message ?? "Okänt fel",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
