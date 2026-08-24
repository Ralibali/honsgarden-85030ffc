import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSafeOrigin(req: Request) {
  const fallback = "https://honsgarden.se";
  const requested = req.headers.get("origin");
  if (!requested) return fallback;

  try {
    const url = new URL(requested);
    const configured = (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const allowed = new Set([
      "https://honsgarden.se",
      "https://www.honsgarden.se",
      "https://honsgarden.app",
      "https://www.honsgarden.app",
      "https://honsgarden.lovable.app",
      ...configured,
    ]);
    const localDev = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    return allowed.has(url.origin) || localDev ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!stripeKey || !supabaseUrl || !serviceRoleKey) return json({ error: "Backend not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "No authorization header" }, 401);

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const token = authHeader.slice("Bearer ".length).trim();
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) return json({ error: "User not authenticated" }, 401);
    const user = userData.user;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) return json({ error: "Could not load billing profile" }, 503);

    let customerId: string | null = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 10 });
      const matching = customers.data.find((customer) => customer.metadata?.supabase_user_id === user.id)
        ?? customers.data[0];
      customerId = matching?.id ?? null;
    }
    if (!customerId) return json({ error: "No Stripe customer found" }, 404);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getSafeOrigin(req)}/app/premium`,
    });

    return json({ url: portalSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[customer-portal]", message);
    return json({ error: "Could not open customer portal" }, 500);
  }
});
