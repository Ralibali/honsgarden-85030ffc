import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELIGIBLE_STATUSES = new Set(["active", "trialing", "past_due"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const serviceKeyAuth = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  const okServiceKey = !!serviceKeyAuth && provided === serviceKeyAuth;
  const okAnonKey = !!anonKey && provided === anonKey; // triggered by pg_cron inside project
  if (!okServiceKey && !okAnonKey && !okSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const issues: {
      duplicates: { email: string; subscription_ids: string[]; statuses: string[] }[];
      orphan_premium: { email: string; user_id: string }[];
      out_of_sync: { email: string; user_id: string; db_expires_at: string | null; stripe_expires_at: string }[];
    } = {
      duplicates: [],
      orphan_premium: [],
      out_of_sync: [],
    };

    // 1) Hämta alla premium-profiler som inte är livstid
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, subscription_status, premium_expires_at, is_lifetime_premium")
      .eq("subscription_status", "premium");

    for (const profile of profiles ?? []) {
      if (!profile.email) continue;

      // Profiler med status premium men inget slutdatum OCH ingen livstidsflagga
      if (!profile.is_lifetime_premium && !profile.premium_expires_at) {
        issues.orphan_premium.push({ email: profile.email, user_id: profile.user_id });
      }

      if (profile.is_lifetime_premium) continue;

      // Hämta Stripe-kunder och prenumerationer
      const customers = await stripe.customers.list({ email: profile.email, limit: 100 });
      const customerIds = [...new Set(customers.data.map((c) => c.id))];
      if (customerIds.length === 0) continue;

      const subResponses = await Promise.all(
        customerIds.map((id) =>
          stripe.subscriptions.list({ customer: id, status: "all", limit: 100 }),
        ),
      );

      const eligibleSubs = subResponses
        .flatMap((r) => r.data)
        .filter((s) => ELIGIBLE_STATUSES.has(s.status));

      // Dubbletter: fler än 1 aktiv/trialing/past_due
      if (eligibleSubs.length > 1) {
        issues.duplicates.push({
          email: profile.email,
          subscription_ids: eligibleSubs.map((s) => s.id),
          statuses: eligibleSubs.map((s) => s.status),
        });
      }

      // Synkkontroll: jämför slutdatum. Läs current_period_end från
      // subscription.items.data (Stripe 2025-08-27.basil) med fallback till root.
      const getEnd = (s: any): number | null => {
        const itemEnd = (s.items?.data ?? [])
          .map((it: any) => it.current_period_end as number | undefined)
          .filter((v: any): v is number => typeof v === "number")
          .sort((a: number, b: number) => b - a)[0];
        const rootEnd = s.current_period_end as number | undefined;
        return itemEnd ?? (typeof rootEnd === "number" ? rootEnd : null);
      };
      const latestSub = eligibleSubs.sort(
        (a, b) => (getEnd(b) ?? 0) - (getEnd(a) ?? 0),
      )[0];
      const latestEnd = latestSub ? getEnd(latestSub) : null;
      if (latestEnd) {
        const stripeEnd = new Date(latestEnd * 1000);
        const dbEnd = profile.premium_expires_at ? new Date(profile.premium_expires_at) : null;
        const driftMs = Math.abs((dbEnd?.getTime() ?? 0) - stripeEnd.getTime());
        // Mer än 24h drift räknas som osynkat
        if (!dbEnd || driftMs > 24 * 60 * 60 * 1000) {
          issues.out_of_sync.push({
            email: profile.email,
            user_id: profile.user_id,
            db_expires_at: profile.premium_expires_at ?? null,
            stripe_expires_at: stripeEnd.toISOString(),
          });
        }
      }
    }

    const totalIssues =
      issues.duplicates.length + issues.orphan_premium.length + issues.out_of_sync.length;

    console.log("[subscription-health-check] result", {
      totalIssues,
      duplicates: issues.duplicates.length,
      orphans: issues.orphan_premium.length,
      out_of_sync: issues.out_of_sync.length,
    });

    // Skicka admin-mejl om det finns problem
    if (totalIssues > 0) {
      const renderList = (items: any[]) =>
        items.length === 0
          ? "<p style=\"color:#888;font-size:13px;\">Inga.</p>"
          : `<ul style="font-size:13px;color:#333;line-height:1.6;">${items
              .map((i) => `<li>${JSON.stringify(i)}</li>`)
              .join("")}</ul>`;

      const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;padding:30px 25px;">
  <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 20px;">
    Prenumerations-hälsokontroll 🔍
  </h1>
  <p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.6;">
    Den dagliga kontrollen hittade <strong>${totalIssues}</strong> problem som behöver åtgärdas.
  </p>

  <h2 style="font-size:16px;color:hsl(22,18%,12%);margin:24px 0 8px;">
    🔁 Dubbla aktiva prenumerationer (${issues.duplicates.length})
  </h2>
  ${renderList(issues.duplicates)}

  <h2 style="font-size:16px;color:hsl(22,18%,12%);margin:24px 0 8px;">
    ⚠️ Premium utan slutdatum/livstidsflagga (${issues.orphan_premium.length})
  </h2>
  ${renderList(issues.orphan_premium)}

  <h2 style="font-size:16px;color:hsl(22,18%,12%);margin:24px 0 8px;">
    🔄 Profil ej synkad mot Stripe (${issues.out_of_sync.length})
  </h2>
  ${renderList(issues.out_of_sync)}

  <p style="font-size:12px;color:#999;margin:32px 0 0;">
    Kontrollen körs automatiskt varje dag kl 06:00 via cron.
  </p>
</div>`;

      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: "info@auroramedia.se",
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject: `🔍 Prenumerations-hälsokontroll: ${totalIssues} problem hittade`,
          html,
          text: `Prenumerations-hälsokontroll hittade ${totalIssues} problem. Logga in i admin för detaljer.`,
          purpose: "transactional",
          label: "subscription-health-check",
          message_id: `health-check-${Date.now()}`,
          queued_at: new Date().toISOString(),
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, totalIssues, issues }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[subscription-health-check] fatal", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
