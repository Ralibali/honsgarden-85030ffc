// Verify (activate) an anonymous map listing using its manage_token.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isManageToken, openPrivateStore } from "../_shared/mapListingPrivate.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    let token: unknown;
    try {
      ({ token } = await req.json());
    } catch {
      return json({ error: "Ogiltig begäran" }, 400);
    }
    if (!token || typeof token !== "string") return json({ error: "missing token" }, 400);
    if (!isManageToken(token)) return json({ error: "Ogiltig länk" }, 404);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const store = await openPrivateStore(admin);

    const listingId = await store.listingIdForToken(token);
    if (!listingId) return json({ error: "Ogiltig länk" }, 404);

    const { data: listing, error } = await admin
      .from("public_egg_sale_listings")
      .select("id, slug, is_active, listing_kind, verified_at, expires_at, title, location")
      .eq("id", listingId)
      .eq("listing_kind", "simple")
      .maybeSingle();
    if (error) throw error;
    if (!listing) return json({ error: "Ogiltig länk" }, 404);

    if (!listing.is_active) {
      const expires = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
      const { error: upErr } = await admin
        .from("public_egg_sale_listings")
        .update({ is_active: true, verified_at: new Date().toISOString(), expires_at: expires })
        .eq("id", listing.id);
      if (upErr) throw upErr;
    }

    return json({ ok: true, slug: listing.slug, title: listing.title, location: listing.location });
  } catch (e) {
    console.error("[map-listing-verify]", e);
    // Databasfel ska inte läcka ut till en oinloggad anropare.
    return json({ error: "Något gick fel. Försök igen om en stund." }, 500);
  }
});
