import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

const PREMIUM_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);
const FREE_STRIPE_STATUSES = new Set(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]);

function getStripeEnd(subscription: Stripe.Subscription): string | null {
  const periodEndTs = (subscription as any).current_period_end as number | undefined;
  return periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  if (!stripeKey || !webhookSecret) {
    return new Response("Missing env", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("No signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[stripe-webhook] signature error:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("[stripe-webhook] event:", event.type, event.id);

  try {
    async function userIdFromCustomer(customerId: string): Promise<string | null> {
      const customer = await stripe.customers.retrieve(customerId);
      if (!("deleted" in customer && customer.deleted)) {
        const metaUserId = (customer as Stripe.Customer).metadata?.supabase_user_id;
        if (metaUserId) return metaUserId;
      }
      const { data: byCustomer } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (byCustomer?.user_id) return byCustomer.user_id;
      if (!("deleted" in customer && customer.deleted)) {
        const email = (customer as Stripe.Customer).email;
        if (email) {
          const { data: byEmail } = await supabase.auth.admin.listUsers();
          const match = byEmail?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (match) return match.id;
        }
      }
      return null;
    }

    async function syncSubscription(sub: Stripe.Subscription) {
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const userId =
        sub.metadata?.supabase_user_id ||
        (await userIdFromCustomer(customerId));
      if (!userId) {
        console.warn("[stripe-webhook] could not map subscription", sub.id, "to user");
        return;
      }

      const endsAt = getStripeEnd(sub);
      const isPremiumStatus = PREMIUM_STRIPE_STATUSES.has(sub.status);
      const isFreeStatus = FREE_STRIPE_STATUSES.has(sub.status);

      const update: Record<string, unknown> = {
        stripe_customer_id: customerId,
        subscription_status: isPremiumStatus ? "premium" : "free",
      };

      // Vanliga Stripe-abonnemang får aldrig sätta eller härleda lifetime.
      if (isPremiumStatus) {
        update.premium_expires_at = endsAt;
      } else if (isFreeStatus) {
        update.premium_expires_at = null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("user_id", userId);
      if (error) console.error("[stripe-webhook] profile update error:", error.message);
      else console.log("[stripe-webhook] synced", userId, "->", update);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Webbshop: engångsbetalning för en shop-order
        if (session.mode === "payment" && session.metadata?.shop_order_id) {
          const { error } = await supabase
            .from("shop_orders")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              customer_email: session.customer_details?.email ?? session.customer_email ?? null,
              amount_total_ore: session.amount_total ?? undefined,
            })
            .eq("id", session.metadata.shop_order_id);
          if (error) console.error("[stripe-webhook] shop order update error:", error.message);
          else console.log("[stripe-webhook] shop order paid:", session.metadata.shop_order_id);
          break;
        }

        if (session.mode !== "subscription" || !session.subscription) break;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(sub);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment" && session.metadata?.shop_order_id) {
          const { error } = await supabase
            .from("shop_orders")
            .update({ status: "expired" })
            .eq("id", session.metadata.shop_order_id)
            .eq("status", "pending");
          if (error) console.error("[stripe-webhook] shop order expire error:", error.message);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription as string | null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[stripe-webhook] handler error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
