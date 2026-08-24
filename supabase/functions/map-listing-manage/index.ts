// Manage a simple map listing using its manage_token.
// Actions: get | update | pause | resume | delete | extend
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SAFE_FIELDS = ["id", "slug", "title", "description", "location", "latitude", "longitude",
  "eggs_per_pack", "price_per_pack", "stock_packs", "packs_available", "is_active",
  "image_url", "contact_phone", "owner_email", "expires_at", "verified_at", "listing_kind"];

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
    const body = await req.json();
    const token = String(body.token ?? "");
    const action = String(body.action ?? "get");
    if (!token) return new Response(JSON.stringify({ error: "missing token" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: listing, error } = await admin
      .from("public_egg_sale_listings")
      .select(SAFE_FIELDS.join(", "))
      .eq("manage_token", token)
      .eq("listing_kind", "simple")
      .maybeSingle();
    if (error) throw error;
    if (!listing) return new Response(JSON.stringify({ error: "Ogiltig länk" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });

    if (action === "get") {
      return new Response(JSON.stringify({ ok: true, listing }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (action === "pause") {
      await admin.from("public_egg_sale_listings").update({ is_active: false }).eq("id", (listing as any).id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (action === "resume") {
      await admin.from("public_egg_sale_listings").update({ is_active: true }).eq("id", (listing as any).id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (action === "delete") {
      await admin.from("public_egg_sale_listings").delete().eq("id", (listing as any).id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (action === "extend") {
      const expires = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
      await admin.from("public_egg_sale_listings").update({ expires_at: expires, is_active: true }).eq("id", (listing as any).id);
      return new Response(JSON.stringify({ ok: true, expires_at: expires }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (action === "update") {
      const patch = body.patch ?? {};
      const update: Record<string, any> = {};
      if (typeof patch.title === "string" && patch.title.trim().length >= 3) update.title = patch.title.trim().slice(0, 80);
      if (typeof patch.description === "string" && patch.description.trim().length >= 10) update.description = patch.description.trim().slice(0, 1500);
      if (typeof patch.contact_phone === "string") update.contact_phone = patch.contact_phone.trim().slice(0, 30) || null;
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
      if (Object.keys(update).length === 0) {
        return new Response(JSON.stringify({ ok: true, noop: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { error: upErr } = await admin.from("public_egg_sale_listings").update(update).eq("id", (listing as any).id);
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "okänd action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
