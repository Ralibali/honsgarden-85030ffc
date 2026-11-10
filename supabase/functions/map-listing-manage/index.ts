// Manage a simple map listing using its manage_token.
// Actions: get | update | pause | resume | delete | extend
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { isManageToken, openPrivateStore } from "../_shared/mapListingPrivate.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Annonsens egna fält. Kontaktuppgifterna hämtas separat via PrivateStore.
const LISTING_FIELDS = ["id", "slug", "title", "description", "location", "latitude", "longitude",
  "eggs_per_pack", "price_per_pack", "stock_packs", "packs_available", "is_active",
  "image_url", "expires_at", "verified_at", "listing_kind"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function geocode(q: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=se&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Honsgarden/1.0 (info@auroramedia.se)" } });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length) return null;
  return { lat: Math.round(parseFloat(arr[0].lat) * 1000) / 1000, lng: Math.round(parseFloat(arr[0].lon) * 1000) / 1000 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Ogiltig begäran" }, 400);
    }
    const token = String(body.token ?? "");
    const action = String(body.action ?? "get");
    if (!token) return json({ error: "missing token" }, 400);
    if (!isManageToken(token)) return json({ error: "Ogiltig länk" }, 404);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const store = await openPrivateStore(admin);

    const listingId = await store.listingIdForToken(token);
    if (!listingId) return json({ error: "Ogiltig länk" }, 404);

    const { data: listing, error } = await admin
      .from("public_egg_sale_listings")
      .select(LISTING_FIELDS.join(", "))
      .eq("id", listingId)
      .eq("listing_kind", "simple")
      .maybeSingle();
    if (error) throw error;
    if (!listing) return json({ error: "Ogiltig länk" }, 404);

    const listings = () => admin.from("public_egg_sale_listings");

    if (action === "get") {
      const contact = await store.contact(listingId);
      return json({ ok: true, listing: { ...(listing as any), ...contact } });
    }
    if (action === "pause") {
      const { error: upErr } = await listings().update({ is_active: false }).eq("id", listingId);
      if (upErr) throw upErr;
      return json({ ok: true });
    }
    if (action === "resume") {
      const { error: upErr } = await listings().update({ is_active: true }).eq("id", listingId);
      if (upErr) throw upErr;
      return json({ ok: true });
    }
    if (action === "delete") {
      // egg_listing_private följer med via ON DELETE CASCADE.
      const { error: delErr } = await listings().delete().eq("id", listingId);
      if (delErr) throw delErr;
      return json({ ok: true });
    }
    if (action === "extend") {
      const expires = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
      const { error: upErr } = await listings().update({ expires_at: expires, is_active: true }).eq("id", listingId);
      if (upErr) throw upErr;
      return json({ ok: true, expires_at: expires });
    }
    if (action === "update") {
      const patch = body.patch ?? {};
      const update: Record<string, any> = {};
      const hasPhone = typeof patch.contact_phone === "string";
      if (typeof patch.title === "string" && patch.title.trim().length >= 3) update.title = patch.title.trim().slice(0, 80);
      if (typeof patch.description === "string" && patch.description.trim().length >= 10) update.description = patch.description.trim().slice(0, 1500);
      if ([6, 12, 30].includes(Number(patch.eggs_per_pack))) update.eggs_per_pack = Number(patch.eggs_per_pack);
      if (isFinite(Number(patch.price_per_pack)) && Number(patch.price_per_pack) >= 0 && Number(patch.price_per_pack) <= 999) update.price_per_pack = Number(patch.price_per_pack);
      if (isFinite(Number(patch.stock_packs)) && Number(patch.stock_packs) >= 0 && Number(patch.stock_packs) <= 999) {
        update.stock_packs = Number(patch.stock_packs);
        update.packs_available = Number(patch.stock_packs);
      }
      if (typeof patch.location === "string" && patch.location.trim().length >= 2 && patch.location.trim() !== (listing as any).location) {
        const loc = patch.location.trim().slice(0, 80);
        const geo = await geocode(`${loc}, Sverige`);
        if (geo) { update.location = loc; update.latitude = geo.lat; update.longitude = geo.lng; }
      }
      if (Object.keys(update).length === 0 && !hasPhone) {
        return json({ ok: true, noop: true });
      }
      if (Object.keys(update).length > 0) {
        const { error: upErr } = await listings().update(update).eq("id", listingId);
        if (upErr) throw upErr;
      }
      if (hasPhone) {
        await store.setContactPhone(listingId, patch.contact_phone.trim().slice(0, 30) || null);
      }
      return json({ ok: true });
    }

    return json({ error: "okänd action" }, 400);
  } catch (e) {
    console.error("[map-listing-manage]", e);
    // Databasfel ska inte läcka ut till en oinloggad anropare.
    return json({ error: "Något gick fel. Försök igen om en stund." }, 500);
  }
});
