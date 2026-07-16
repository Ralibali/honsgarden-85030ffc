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

  const auth = req.headers.get("Authorization") ?? "";
  const serviceKeyAuth = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  const okServiceKey = !!serviceKeyAuth && provided === serviceKeyAuth;
  const okAnonKey = !!anonKey && provided === anonKey; // triggered by pg_cron inside project
  console.log("[premium-expiry-cron] auth check", {
    providedLen: provided.length,
    serviceKeyLen: serviceKeyAuth.length,
    anonKeyLen: anonKey.length,
    hasCronSecret: !!cronSecret,
    okServiceKey,
    okAnonKey,
    okSecret,
  });
  if (!okServiceKey && !okAnonKey && !okSecret) {
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
      .select("user_id, email, subscription_status, premium_expires_at")
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
        // Check if user has active Stripe subscription
        if (profile.email) {
          const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
          if (customers.data.length > 0) {
            const subs = await stripe.subscriptions.list({
              customer: customers.data[0].id,
              status: "active",
              limit: 1,
            });
            if (subs.data.length > 0) {
              // Active Stripe sub – extend premium to match Stripe period.
              // Stripe API 2025-08-27.basil flyttade current_period_end till
              // subscription.items.data[i]. Läs primärt därifrån, fall
              // tillbaka till root för äldre svar/testklockor.
              const sub = subs.data[0];
              const itemEnd = (sub.items?.data ?? [])
                .map((it: any) => it.current_period_end as number | undefined)
                .filter((v): v is number => typeof v === "number")
                .sort((a, b) => b - a)[0];
              const rootEnd = (sub as any).current_period_end as number | undefined;
              const endTimestamp = itemEnd ?? (typeof rootEnd === "number" ? rootEnd : undefined);
              if (typeof endTimestamp === "number") {
                const newEnd = new Date(endTimestamp * 1000).toISOString();
                await supabase
                  .from("profiles")
                  .update({ premium_expires_at: newEnd })
                  .eq("user_id", profile.user_id);
                console.log(`Skipped ${profile.email}: active Stripe sub, extended to ${newEnd}`);
              } else {
                console.warn(`Active Stripe sub for ${profile.email} but no current_period_end found; leaving premium untouched.`);
              }
              skipped++;
              continue;
            }
          }
        }

        // No active Stripe subscription – downgrade
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
