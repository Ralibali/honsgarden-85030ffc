// Submit an anonymous "simple" egg listing for the public map.
// No auth required. Sends a magic link email for verification + management.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { digitalRateLimitAllows } from "../_shared/digitalProduct.ts";
import { openPrivateStore, requestIp } from "../_shared/mapListingPrivate.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE = "https://honsgarden.se";

// Endpointen är öppen och varje lyckat anrop skickar ett mejl från vår domän
// till en adress som anroparen väljer. Därför tre spärrar:
//   * per IP och globalt på försök (skyddar även geokodningen),
//   * per e-postadress på faktiskt skickade bekräftelsemejl.
// Det globala taket är bakstopp om IP-rubriken går att förfalska.
const LIMITS = {
  ip: { scope: "map-listing-submit:ip", max: 10, windowMinutes: 60 },
  global: { scope: "map-listing-submit:global", max: 60, windowMinutes: 60 },
  email: { scope: "map-listing-submit:email", max: 3, windowMinutes: 24 * 60 },
};
const MAX_ACTIVE_PER_EMAIL = 3;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const tooMany = () => json({ error: "För många försök just nu. Försök igen om en stund." }, 429);

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[åä]/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    .slice(0, 40);
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
  if (req.method !== "POST") return new Response("Method", { status: 405, headers: cors });

  let uploadedPath: string | null = null;
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Ogiltig begäran" }, 400);
    }

    const errors: string[] = [];
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const location = String(body.location ?? "").trim();
    const owner_email = String(body.owner_email ?? "").trim().toLowerCase();
    const contact_phone = body.contact_phone ? String(body.contact_phone).trim() : null;
    const eggs_per_pack = Number(body.eggs_per_pack ?? 6);
    const price_per_pack = Number(body.price_per_pack ?? 0);
    const stock_packs = Math.max(0, Math.min(999, Number(body.stock_packs ?? 5)));
    const image_b64 = body.image_b64 ? String(body.image_b64) : null;

    if (title.length < 3 || title.length > 80) errors.push("title");
    if (description.length < 10 || description.length > 1500) errors.push("description");
    if (location.length < 2 || location.length > 80) errors.push("location");
    if (owner_email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner_email)) errors.push("owner_email");
    if (![6, 12, 30].includes(eggs_per_pack)) errors.push("eggs_per_pack");
    if (!isFinite(price_per_pack) || price_per_pack < 0 || price_per_pack > 999) errors.push("price_per_pack");
    if (contact_phone && (contact_phone.length < 6 || contact_phone.length > 30)) errors.push("contact_phone");

    if (errors.length) {
      return json({ error: "Validering misslyckades", fields: errors }, 400);
    }

    // digitalRateLimitAllows stänger vid fel: går spärren inte att läsa nekas försöket.
    const limiter = {
      rpc: async (fn: string, args: Record<string, unknown>) => await admin.rpc(fn, args),
    };
    const ip = requestIp(req);
    if (!(await digitalRateLimitAllows(limiter, { ...LIMITS.ip, value: ip ?? "unknown" }))) return tooMany();
    if (!(await digitalRateLimitAllows(limiter, { ...LIMITS.global, value: "all" }))) return tooMany();

    const store = await openPrivateStore(admin);

    if ((await store.activeCountForEmail(owner_email)) >= MAX_ACTIVE_PER_EMAIL) {
      return json({ error: "Du har redan 3 aktiva annonser på denna e-post." }, 429);
    }

    // Geocode
    const geo = await geocode(`${location}, Sverige`);
    if (!geo) {
      return json({ error: "Hittade inte platsen. Försök med ort eller postnummer." }, 400);
    }

    // Räknas först här, så att en felstavad ort inte äter upp dagens försök.
    if (!(await digitalRateLimitAllows(limiter, { ...LIMITS.email, value: owner_email }))) {
      return json({ error: "Vi har redan skickat flera bekräftelsemejl till den här adressen i dag. Försök igen i morgon." }, 429);
    }

    // Optional image upload (base64 data URL or raw base64)
    let image_url: string | null = null;
    if (image_b64) {
      try {
        const m = image_b64.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
        if (!m) throw new Error("invalid image");
        const mime = m[1];
        const ext = m[2] === "jpeg" ? "jpg" : m[2];
        const raw = m[3];
        const bin = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
        if (bin.byteLength > 3_500_000) throw new Error("image too large");
        const path = `simple/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await admin.storage.from("egg-sale-images").upload(path, bin, {
          contentType: mime, upsert: false,
        });
        if (upErr) throw upErr;
        uploadedPath = path;
        const { data: pub } = admin.storage.from("egg-sale-images").getPublicUrl(path);
        image_url = pub.publicUrl;
      } catch (e) {
        console.warn("image upload failed", e);
      }
    }

    const manage_token = crypto.randomUUID();
    const baseSlug = slugify(title || location) || "agg";
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;

    const inserted = await store.insertListing(
      {
        listing_kind: "simple",
        user_id: null,
        slug,
        title,
        description,
        location,
        latitude: geo.lat,
        longitude: geo.lng,
        eggs_per_pack,
        price_per_pack,
        packs_available: stock_packs,
        stock_packs,
        stock_source: "manual",
        is_active: false, // activate after email verify
        image_url,
        expires_at: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
      },
      { manage_token, owner_email, contact_phone, submitted_ip: ip },
    );
    uploadedPath = null; // bilden hör nu till en sparad annons

    const verifyUrl = `${SITE}/karta/bekrafta?token=${manage_token}`;
    const manageUrl = `${SITE}/karta/hantera/${manage_token}`;

    const { error: mailError } = await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        run_id: crypto.randomUUID(),
        to: owner_email,
        from: "Hönsgården <noreply@notify.honsgarden.se>",
        sender_domain: "notify.honsgarden.se",
        subject: "Bekräfta din äggannons på kartan 🥚",
        html: `<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">
          <img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />
          <h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Bekräfta din äggannons</h1>
          <p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Hej! Klicka nedan för att publicera din annons <strong>${title.replace(/</g, "&lt;")}</strong> på äggkartan. Annonsen ligger uppe i 60 dagar.</p>
          <a href="${verifyUrl}" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Publicera annons →</a>
          <p style="font-size: 13px; color: hsl(22,12%,44%); margin: 24px 0 6px;">Spara denna länk för att redigera, pausa eller ta bort annonsen senare:</p>
          <p style="font-size: 13px; margin: 0 0 24px;"><a href="${manageUrl}" style="color: hsl(142,32%,34%);">${manageUrl}</a></p>
          <p style="font-size: 12px; color: #999; margin: 0;">Om du inte skickade in detta kan du ignorera mejlet.</p>
        </div>`,
        text: `Bekräfta din äggannons "${title}" på Hönsgården: ${verifyUrl}\n\nHantera senare: ${manageUrl}`,
        purpose: "transactional",
        label: "map-listing-verify",
        message_id: `map-verify-${inserted.id}`,
        queued_at: new Date().toISOString(),
      },
    });
    if (mailError) console.error("[map-listing-submit] enqueue_email failed", mailError.message);

    return json({ ok: true, slug: inserted.slug });
  } catch (e) {
    console.error("[map-listing-submit]", e);
    if (uploadedPath) {
      await admin.storage.from("egg-sale-images").remove([uploadedPath]).catch(() => {});
    }
    // Databasfel ska inte läcka ut till en oinloggad anropare.
    return json({ error: "Något gick fel. Försök igen om en stund." }, 500);
  }
});
