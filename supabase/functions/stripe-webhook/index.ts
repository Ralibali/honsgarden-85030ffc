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
          const orderId = session.metadata.shop_order_id;
          const shipping = session.shipping_details ?? session.customer_details?.address
            ? (session.shipping_details ?? { address: session.customer_details?.address, name: session.customer_details?.name })
            : null;
          const shippingAddress = shipping?.address ? {
            line1: shipping.address.line1 ?? null,
            line2: shipping.address.line2 ?? null,
            city: shipping.address.city ?? null,
            postal_code: shipping.address.postal_code ?? null,
            state: shipping.address.state ?? null,
            country: shipping.address.country ?? null,
          } : null;
          const paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;

          const stripeTotal = session.amount_total ?? 0;
          const discountOre = session.total_details?.amount_discount ?? 0;

          // Hämta orderns egna belopp för strikt kontroll.
          const { data: dbOrder, error: fetchErr } = await supabase
            .from("shop_orders")
            .select("id, subtotal_ore, shipping_ore, status, stock_applied")
            .eq("id", orderId)
            .maybeSingle();
          if (fetchErr) {
            console.error("[stripe-webhook] shop order fetch error:", fetchErr.message);
            break;
          }
          if (!dbOrder) {
            console.error("[stripe-webhook] shop order not found:", orderId);
            break;
          }

          const expectedTotal = (dbOrder.subtotal_ore ?? 0) + (dbOrder.shipping_ore ?? 0) - Math.max(0, discountOre);
          if (stripeTotal < 0 || expectedTotal < 0 || stripeTotal !== expectedTotal) {
            console.error("[stripe-webhook] AMOUNT MISMATCH", {
              orderId, stripeTotal, expectedTotal, discountOre,
            });
            await supabase
              .from("shop_orders")
              .update({
                admin_note:
                  `KRITISKT: Belopp matchar inte. Stripe=${stripeTotal} öre, ` +
                  `förväntat ${expectedTotal} öre ` +
                  `(subtotal ${dbOrder.subtotal_ore ?? 0} + frakt ${dbOrder.shipping_ore ?? 0} - rabatt ${discountOre}). ` +
                  `Order kvar i status pending – hantera manuellt.`,
              })
              .eq("id", orderId);
            break;
          }

          // Beloppet stämmer – finalisera atomiskt i DB. Kontrollen görs igen där under radlås.
          const { data: rpcResult, error: finalizeErr } = await supabase.rpc("shop_finalize_paid_order", {
            p_order_id: orderId,
            p_amount_total_ore: stripeTotal,
            p_discount_ore: discountOre,
            p_customer_email: session.customer_details?.email ?? session.customer_email ?? null,
            p_customer_name: shipping?.name ?? session.customer_details?.name ?? null,
            p_customer_phone: session.customer_details?.phone ?? null,
            p_shipping_address: shippingAddress,
            p_payment_intent_id: paymentIntentId,
          });
          if (finalizeErr) {
            console.error("[stripe-webhook] shop finalize RPC error:", finalizeErr.message);
            break;
          }
          const rpc = (rpcResult ?? {}) as { ok?: boolean; reason?: string };
          if (!rpc.ok) {
            console.error("[stripe-webhook] shop finalize refused:", rpc.reason, "order:", orderId);
            break;
          }
          console.log("[stripe-webhook] shop order finalized:", orderId);
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
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.shop_order_id;
        if (orderId) {
          const reason = intent.last_payment_error?.message ?? "Okänt fel";
          await supabase
            .from("shop_orders")
            .update({ admin_note: `Betalning misslyckades: ${reason}` })
            .eq("id", orderId)
            .eq("status", "pending");
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
