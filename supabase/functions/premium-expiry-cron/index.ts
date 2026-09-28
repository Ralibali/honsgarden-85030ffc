import { isCronAuthorized } from '../_shared/cronAuth.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isCronAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }


  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find all users with expired premium
    const now = new Date().toISOString();
    const { data: expiredProfiles, error: fetchError } = await supabase
      .from("profiles")
      .select("user_id, email, stripe_customer_id, preferences, subscription_status, premium_expires_at")
      .eq("subscription_status", "premium")
      .not("premium_expires_at", "is", null)
      .lt("premium_expires_at", now);

    if (fetchError) throw fetchError;
    if (!expiredProfiles || expiredProfiles.length === 0) {
      console.log("No expired premium users found.");
      return new Response(JSON.stringify({ downgraded: 0, skipped: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${expiredProfiles.length} expired premium profiles to check.`);

    let downgraded = 0;
    let skipped = 0;

    for (const profile of expiredProfiles) {
      try {
        // Apple renewal notifications may arrive after the local expiry timestamp.
        const expiresAt = Date.parse(profile.premium_expires_at);
        if (profile.preferences?.apple_iap && Date.now() < expiresAt + 48 * 60 * 60 * 1000) {
          skipped++;
          continue;
        }

        const customerIds: string[] = [];
        if (profile.stripe_customer_id) {
          try {
            const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
            if (!customer.deleted) customerIds.push(customer.id);
          } catch (error) {
            // Only a missing/deleted customer permits an email fallback. Other API errors fail closed.
            if ((error as { code?: string }).code !== "resource_missing") throw error;
          }
        }
        if (customerIds.length === 0 && profile.email) {
          for await (const customer of stripe.customers.list({ email: profile.email, limit: 100 })) {
            customerIds.push(customer.id);
          }
        }

        let paying = false;
        let endTimestamp: number | undefined;
        for (const customerId of customerIds) {
          for await (const sub of stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
            if (!["active", "trialing", "past_due"].includes(sub.status)) continue;
            paying = true;
            // Basil stores the billing period on items; retain compatibility with older responses.
            const itemEnds = (sub.items?.data ?? []).map(item => item.current_period_end);
            const rootEnd = (sub as any).current_period_end as number | undefined;
            for (const end of [...itemEnds, rootEnd]) {
              if (typeof end === "number" && Number.isFinite(end)) endTimestamp = Math.max(endTimestamp ?? 0, end);
            }
          }
        }
        if (paying) {
          if (typeof endTimestamp === "number") {
            const { error: updateError } = await supabase.from("profiles")
              .update({ premium_expires_at: new Date(endTimestamp * 1000).toISOString() })
              .eq("user_id", profile.user_id);
            if (updateError) throw updateError;
          }
          skipped++;
          continue;
        }

        // No paying Stripe subscription and outside Apple grace – downgrade
        await supabase
          .from("profiles")
          .update({ subscription_status: "free", premium_expires_at: null })
          .eq("user_id", profile.user_id);

        console.log(`Downgraded ${profile.email || profile.user_id}`);
        downgraded++;
      } catch (userErr) {
        console.error(`Error processing ${profile.user_id}:`, userErr);
        // Don't downgrade on error – safer to keep premium
        skipped++;
      }
    }

    console.log(`Done: ${downgraded} downgraded, ${skipped} skipped (active Stripe).`);

    return new Response(JSON.stringify({ downgraded, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Premium expiry cron error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
