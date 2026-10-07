import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "npm:stripe@22.6.0";
import { bundleAccess } from "../_shared/unifiedBilling.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const key = Deno.env.get("STRIPE_SECRET_KEY"),
    secret = Deno.env.get("STRIPE_BUNDLE_WEBHOOK_SECRET");
  if (!key || !secret) return new Response("Not configured", { status: 503 });
  const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      req.headers.get("stripe-signature") || "",
      secret,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    let subscriptionId: string | null = null;
    if (event.type.startsWith("customer.subscription.")) {
      subscriptionId = (event.data.object as Stripe.Subscription).id;
    }
    if (
      ["checkout.session.completed", "checkout.session.async_payment_succeeded"]
        .includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (
        session.mode === "subscription" && session.payment_status === "paid"
      ) {
        subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;
      }
    }
    if (!subscriptionId) return new Response("ok");
    // Retrieve current Stripe state, so duplicate or out-of-order webhooks never restore an old entitlement.
    const observed = new Date().toISOString();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const id = subscription.metadata.unified_account_id;
    if (!id) return new Response("ok");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const customer = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
    const { data: account, error } = await admin.from("unified_accounts")
      .select(
        "id,hens_user_id,garden_user_id,stripe_customer_id,stripe_subscription_id",
      ).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!account) return new Response("ok");
    if (account.stripe_customer_id !== customer) {
      return new Response("Customer mismatch", { status: 400 });
    }
    if (
      account.stripe_subscription_id &&
      account.stripe_subscription_id !== subscription.id
    ) {
      const current = await stripe.subscriptions.retrieve(
        account.stripe_subscription_id,
      );
      if (
        !["canceled", "incomplete_expired"].includes(current.status) ||
        ["canceled", "incomplete_expired"].includes(subscription.status)
      ) return new Response("ok");
    }
    const access = bundleAccess(
      subscription,
      Deno.env.get("STRIPE_BUNDLE_PRICE_ID"),
    );
    const { error: updateError } = await admin.from("unified_accounts").update({
      stripe_subscription_id: subscription.id,
      bundle_status: access.active
        ? "active"
        : subscription.status === "active"
        ? "none"
        : subscription.status,
      active_until: access.until,
      verified_at: observed,
    }).eq("id", id);
    if (updateError) throw updateError;
    const gardenKey = Deno.env.get("GARDEN_SERVICE_ROLE_KEY");
    if (!gardenKey) throw new Error("Garden connection missing");
    const garden = createClient(
      "https://ysonnvbkrwajacvdkqut.supabase.co",
      gardenKey,
    );
    for (
      const [db, userId] of [[admin, account.hens_user_id], [
        garden,
        account.garden_user_id,
      ]] as const
    ) {
      const { error } = await db.rpc("apply_bundle_entitlement", {
        p_user: userId,
        p_active: access.active,
        p_until: access.until,
        p_observed: observed,
      });
      if (error) throw error;
    }
    return new Response("ok");
  } catch {
    return new Response("Retry later", { status: 500 });
  }
});
