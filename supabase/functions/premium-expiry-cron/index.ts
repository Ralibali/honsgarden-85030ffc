import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { cronRequestAllowed } from "../_shared/cronAuth.ts";
import { stripeEntitlement } from "../_shared/premiumExpiry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Bara pg_cron (x-cron-secret) eller service role-nyckeln släpps in.
  // verify_jwt är avstängt, så en JWT:s innehåll bevisar ingenting här.
  const allowed = cronRequestAllowed(req.headers, {
    cronSecret: Deno.env.get("CRON_SECRET"),
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  });
  if (!allowed) {
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
      .select("user_id, email, stripe_customer_id, subscription_status, premium_expires_at")
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
        // Finns en prenumeration som ger åtkomst? Kunden slås upp både via
        // sparat kund-id och e-post, och trialing/past_due inom perioden
        // räknas, precis som i webhooken. Annars kan en betalande kund
        // nedgraderas när en webhook har missats.
        const { entitled, periodEnd } = await stripeEntitlement(stripe, profile);
        if (entitled) {
          if (periodEnd) {
            const { error: extendError } = await supabase
              .from("profiles")
              .update({ premium_expires_at: periodEnd })
              .eq("user_id", profile.user_id);
            if (extendError) throw extendError;
            console.log(`Skipped ${profile.user_id}: Stripe subscription still valid, extended to ${periodEnd}`);
          } else {
            console.warn(`Stripe subscription valid for ${profile.user_id} but no period end found; leaving premium untouched.`);
          }
          skipped++;
          continue;
        }

        // Ingen prenumeration ger åtkomst längre: nedgradera.
        const { error: downgradeError } = await supabase
          .from("profiles")
          .update({ subscription_status: "free", premium_expires_at: null })
          .eq("user_id", profile.user_id);
        if (downgradeError) throw downgradeError;

        console.log(`Downgraded ${profile.user_id}`);
        downgraded++;
      } catch (userErr) {
        console.error(`Error processing ${profile.user_id}:`, userErr);
        // Don't downgrade on error – safer to keep premium
        skipped++;
      }
    }

    console.log(`Done: ${downgraded} downgraded, ${skipped} skipped (still paying, or could not be checked).`);

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
