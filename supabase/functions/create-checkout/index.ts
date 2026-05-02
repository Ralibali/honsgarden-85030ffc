import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAuth.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // 1. Hämta sparad customer_id från profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId: string | null = profile?.stripe_customer_id ?? null;

    // 2. Verifiera att den fortfarande existerar i Stripe
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if ((c as any).deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }

    // 3. Försök matcha på email om vi inte har sparad id
    if (!customerId) {
      const list = await stripe.customers.list({ email: user.email, limit: 1 });
      if (list.data.length > 0) customerId = list.data[0].id;
    }

    // 4. Om ingen kund finns – skapa en explicit
    if (!customerId) {
      const created = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = created.id;
    }

    // 5. Spara customer_id på profilen
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id);

    // 6. Säkerställ metadata på customer
    await stripe.customers.update(customerId, {
      metadata: { supabase_user_id: user.id },
    });

    // 7. Blockera duplicerade prenumerationer
    const existing = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const blocking = existing.data.find(
      (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due"
    );
    if (blocking) {
      const origin = req.headers.get("origin") || "";
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/app/premium`,
      });
      return new Response(
        JSON.stringify({
          error: "already_subscribed",
          message: "Du har redan en aktiv prenumeration. Vi öppnar kundportalen.",
          portal_url: portal.url,
          subscription_status: blocking.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
      );
    }

    // 8. Skapa Checkout med customer (INTE customer_email)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${req.headers.get("origin")}/app/premium?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/app/premium?canceled=true`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
