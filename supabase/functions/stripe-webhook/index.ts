import { isPlusSubscription, plusPriceIds, stripePeriodEnd as getStripeEnd, stripeAccessActive } from "../_shared/stripeBilling.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getDigitalProduct } from "../_shared/digitalProduct.ts";
import { sendDigitalReceipt } from "../_shared/digitalReceipt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

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

    async function syncSubscription(eventSub: Stripe.Subscription) {
      // Notifications can arrive out of order. Read the current Stripe state.
      const observedAt = new Date().toISOString();
      const sub = await stripe.subscriptions.retrieve(eventSub.id);
      if (!isPlusSubscription(sub, plusPriceIds(Deno.env.get("STRIPE_PRICE_MONTHLY"), Deno.env.get("STRIPE_PRICE_YEARLY")))) return;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const userId =
        sub.metadata?.supabase_user_id ||
        (await userIdFromCustomer(customerId));
      if (!userId) {
        console.warn("[stripe-webhook] could not map subscription", sub.id, "to user");
        return;
      }

      const endsAt = getStripeEnd(sub);
      const isPremiumStatus = stripeAccessActive(sub);
      const { error } = await supabase.rpc("apply_stripe_plus_status", {
        _user_id: userId, _customer_id: customerId, _active: isPremiumStatus,
        _period_end: endsAt, _observed_at: observedAt,
      });
      if (error && error.code !== "P0002") throw new Error("Subscription persistence failed");
      console.log("[stripe-webhook] subscription synchronized");
    }

    // ---- Digitalt engångsköp (PDF-guide) ----
    async function finalizeDigitalOrder(session: Stripe.Checkout.Session) {
      const orderId = session.metadata?.digital_order_id;
      if (!orderId) return;
      if (session.payment_status !== "paid") {
        console.log("[stripe-webhook] digital order not paid yet:", orderId, session.payment_status);
        return;
      }

      const { data: order, error: fetchError } = await supabase
        .from("digital_orders")
        .select("id, order_number, product_slug, status, customer_email, amount_ore, vat_rate, consent_terms_version, consent_at, paid_at, refunded_at")
        .eq("id", orderId)
        .maybeSingle();
      if (fetchError) {
        // Databasfel är övergående: låt Stripe göra ett nytt försök.
        throw new Error(`digital order fetch failed: ${fetchError.message}`);
      }
      if (!order) {
        console.error("[stripe-webhook] digital order not found:", orderId);
        return;
      }

      const product = getDigitalProduct(order.product_slug);
      if (!product) {
        console.error("[stripe-webhook] unknown digital product:", order.product_slug);
        return;
      }

      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
      const verifiedEmail = session.customer_details?.email ?? session.customer_email ?? null;

      const verifiedCountry = session.customer_details?.address?.country ?? null;

      const { data: rpcResult, error: rpcError } = await supabase.rpc("digital_finalize_paid_order", {
        p_order_id: order.id,
        p_amount_total_ore: session.amount_total ?? 0,
        p_customer_email: verifiedEmail,
        p_payment_intent_id: paymentIntentId,
        p_currency: session.currency ?? null,
        p_verified_country: verifiedCountry,
        p_livemode: event.livemode,
      });
      if (rpcError) {
        throw new Error(`digital finalize failed: ${rpcError.message}`);
      }
      const rpc = (rpcResult ?? {}) as { ok?: boolean; reason?: string };
      if (!rpc.ok) {
        // Avsiktligt avvisad (belopp, valuta, land, saknat samtycke, återbetald).
        // Ingen leverans, ingen retry – ordern är markerad för granskning.
        console.error("[stripe-webhook] digital finalize refused:", rpc.reason, order.id);
        return;
      }

      // Atomärt och idempotent: länk + köat mejl + flagga i samma transaktion.
      const receipt = await sendDigitalReceipt(supabase, {
        id: order.id,
        order_number: order.order_number,
        customer_email: verifiedEmail ?? order.customer_email,
        amount_ore: order.amount_ore,
        vat_rate: Number(order.vat_rate),
        consent_terms_version: order.consent_terms_version,
        consent_at: order.consent_at,
        paid_at: order.paid_at,
      }, product);
      if (!receipt.ok && receipt.reason === "transaction_failed") {
        // Betalningen är registrerad men kvittot kom inte i kö: be Stripe försöka igen.
        throw new Error(`digital receipt failed for ${order.id}`);
      }
      console.log("[stripe-webhook] digital order finalized:", order.id, "receipt queued:", receipt.queued);
    }



    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Digitalt engångsköp (PDF): leverans först efter verifierad betalning.
        if (session.mode === "payment" && session.metadata?.digital_order_id) {
          await finalizeDigitalOrder(session);
          break;
        }



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
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.digital_order_id) {
          await supabase
            .from("digital_orders")
            .update({ status: "failed", admin_note: "Asynkron betalning misslyckades." })
            .eq("id", session.metadata.digital_order_id)
            .eq("status", "pending");
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const digitalOrderId = charge.metadata?.digital_order_id
          ?? (typeof charge.payment_intent === "string" ? null : charge.payment_intent?.metadata?.digital_order_id ?? null);
        const paymentIntentId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
        // Delåterbetalning ska inte dra in en levererad guide – bara full.
        const fullyRefunded = charge.refunded === true
          || (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);
        if ((digitalOrderId || paymentIntentId) && !fullyRefunded) {
          const note = `Delåterbetalning ${((charge.amount_refunded ?? 0) / 100).toFixed(2)} av ${((charge.amount ?? 0) / 100).toFixed(2)} – åtkomsten behålls.`;
          const partial = supabase.from("digital_orders").update({ admin_note: note });
          const { error: partialError } = digitalOrderId
            ? await partial.eq("id", digitalOrderId)
            : await partial.eq("payment_intent_id", paymentIntentId!);
          if (partialError) console.error("[stripe-webhook] digital partial refund note error:", partialError.message);
        } else if (digitalOrderId || paymentIntentId) {
          const query = supabase
            .from("digital_orders")
            .update({
              refunded_at: new Date().toISOString(),
              fulfillment_status: "refunded",
              admin_note: "Återbetald i Stripe – åtkomst återkallad.",
            });
          const { data: refunded, error: refundError } = digitalOrderId
            ? await query.eq("id", digitalOrderId).is("refunded_at", null).select("id")
            : await query.eq("payment_intent_id", paymentIntentId!).is("refunded_at", null).select("id");
          if (refundError) throw new Error(`digital refund failed: ${refundError.message}`);
          for (const row of refunded ?? []) {
            await supabase.from("digital_access_tokens").update({ revoked: true }).eq("order_id", row.id);
          }
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.shop_order_id;
        if (intent.metadata?.digital_order_id) {
          await supabase
            .from("digital_orders")
            .update({
              status: "failed",
              admin_note: `Betalning misslyckades: ${intent.last_payment_error?.message ?? "Okänt fel"}`,
            })
            .eq("id", intent.metadata.digital_order_id)
            .eq("status", "pending");
        }
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
