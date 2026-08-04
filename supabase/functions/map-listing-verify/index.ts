// Verify (activate) an anonymous map listing using its manage_token.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "missing token" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: listing, error } = await admin
      .from("public_egg_sale_listings")
      .select("id, slug, is_active, listing_kind, verified_at, expires_at, title, location")
      .eq("manage_token", token)
      .eq("listing_kind", "simple")
      .maybeSingle();
    if (error) throw error;
    if (!listing) {
      return new Response(JSON.stringify({ error: "Ogiltig länk" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (!listing.is_active) {
      const expires = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
      const { error: upErr } = await admin
        .from("public_egg_sale_listings")
        .update({ is_active: true, verified_at: new Date().toISOString(), expires_at: expires })
        .eq("id", listing.id);
      if (upErr) throw upErr;
    }

    return new Response(JSON.stringify({ ok: true, slug: listing.slug, title: listing.title, location: listing.location }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
