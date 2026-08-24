import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (n: number) => Math.round(n * 100) / 100; // ~1 km

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=se&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Honsgarden/1.0 (info@auroramedia.se)" } });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return { lat: round(parseFloat(arr[0].lat)), lng: round(parseFloat(arr[0].lon)) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey) return new Response(JSON.stringify({ error: "config" }), { status: 500, headers: corsHeaders });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.replace("Bearer ", "").trim();
  const isService = bearer === serviceKey;
  const body = await req.json().catch(() => ({}));
  const listingId: string | undefined = body.listing_id;

  let rows: any[] = [];
  if (listingId) {
    const { data: listing } = await admin
      .from("public_egg_sale_listings")
      .select("id, user_id, location").eq("id", listingId).maybeSingle();
    if (!listing) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: corsHeaders });
    if (!isService) {
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user || user.id !== listing.user_id) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    rows = [listing];
  } else {
    if (!isService) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const { data } = await admin
      .from("public_egg_sale_listings")
      .select("id, user_id, location").eq("is_active", true).is("latitude", null);
    rows = data ?? [];
  }

  let updated = 0;
  for (const r of rows) {
    const { data: coop } = await admin
      .from("coop_settings").select("postal_code, city").eq("user_id", r.user_id).maybeSingle();
    const q = coop?.postal_code
      ? `${coop.postal_code} ${coop.city ?? ""}, Sverige`
      : `${r.location ?? ""}, Sverige`;
    if (!q.trim() || q.trim() === ", Sverige") continue;
    const geo = await geocode(q);
    if (geo) {
      await admin.from("public_egg_sale_listings").update({ latitude: geo.lat, longitude: geo.lng }).eq("id", r.id);
      updated++;
    }
    await sleep(1100);
  }
  return new Response(JSON.stringify({ updated, total: rows.length }), { headers: corsHeaders });
});
