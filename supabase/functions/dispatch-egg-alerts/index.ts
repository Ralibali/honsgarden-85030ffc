// Dispatch new-egg-seller notifications to verified public_egg_alerts subscribers.
// Cron: every hour. Auth: CRON_SECRET (x-cron-secret) or service role Bearer.
// - Finds listings that became active since last run
// - Matches subscribers by ort_slug via location ILIKE
// - Sends 1 mail per subscriber per listing, max 1 per subscriber per 24h
// - Logs every send in public_egg_alert_sends

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_ORIGIN = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://honsgarden.se";
const BREVO_SENDER_EMAIL = "notify@notify.honsgarden.se";
const BREVO_SENDER_NAME = "Hönsgården";
const CURSOR_KEY = "dispatch_egg_alerts_last_run";
const DEFAULT_LOOKBACK_HOURS = 2;
const DAILY_QUOTA_HOURS = 24;

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function sendBrevo(params: {
  email: string;
  ortName: string;
  listing: { slug: string; title: string; location: string | null; price_per_pack: number };
  unsubscribeToken: string;
}) {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");
  const listingUrl = `${APP_ORIGIN}/s/${encodeURIComponent(params.listing.slug)}?utm_source=egg_alert&utm_medium=email&utm_campaign=new_seller`;
  const unsubUrl = `${APP_ORIGIN}/functions/v1/public-egg-alert?action=unsubscribe&token=${encodeURIComponent(params.unsubscribeToken)}`;
  const priceLine = params.listing.price_per_pack
    ? `Från <strong>${params.listing.price_per_pack} kr</strong> per kartong.`
    : "";
  const html = `
<!doctype html><html><body style="margin:0;padding:0;background:#faf8f4;font-family:Inter,Arial,sans-serif;color:#2b2b2b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eae4d7;border-radius:16px;overflow:hidden">
        <tr><td style="padding:32px 32px 8px;font-family:'Young Serif',Georgia,serif;font-size:22px;color:#3A6B35">🥚 Ny äggsäljare i ${esc(params.ortName)}</td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:15px;line-height:1.55">
          <p style="margin:0 0 12px"><strong>${esc(params.listing.title)}</strong></p>
          ${params.listing.location ? `<p style="margin:0 0 8px;color:#6b6b6b">📍 ${esc(params.listing.location)}</p>` : ""}
          ${priceLine ? `<p style="margin:0 0 8px">${priceLine}</p>` : ""}
        </td></tr>
        <tr><td align="center" style="padding:24px 32px 8px">
          <a href="${listingUrl}" style="display:inline-block;background:#3A6B35;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600">Se säljsidan</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;font-size:11px;color:#9a9a9a;border-top:1px solid #f0ebde">
          Du får det här mejlet för att du bad om notiser när det finns färska ägg nära ${esc(params.ortName)}.<br/>
          <a href="${unsubUrl}" style="color:#9a9a9a">Avregistrera</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: params.email }],
      subject: `Ny äggsäljare i ${params.ortName} 🥚`,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${res.status}: ${text}`);
  }
}

Deno.serve(async (req) => {
  // Auth: CRON_SECRET header or service-role bearer
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (provided !== serviceKey && !okSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false },
  });

  // Cursor
  const { data: cursorRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", CURSOR_KEY)
    .maybeSingle();
  const lastRun = cursorRow?.value
    ? new Date(cursorRow.value)
    : new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 3600 * 1000);
  const runStartedAt = new Date();

  // 1. New/newly-active listings since last run
  const { data: listings, error: listingsErr } = await supabase
    .from("public_egg_sale_listings")
    .select("id, slug, title, location, price_per_pack, is_active, created_at")
    .eq("is_active", true)
    .gt("created_at", lastRun.toISOString())
    .limit(500);

  if (listingsErr) {
    return new Response(JSON.stringify({ error: listingsErr.message }), { status: 500 });
  }

  if (!listings?.length) {
    await supabase.from("system_settings").upsert({
      key: CURSOR_KEY,
      value: runStartedAt.toISOString(),
      description: "Cursor for dispatch-egg-alerts cron",
    });
    return new Response(JSON.stringify({ ok: true, listings: 0, sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. All verified alerts with ort_slug
  const { data: alerts } = await supabase
    .from("public_egg_alerts")
    .select("id, email, ort_slug, ort_name, unsubscribe_token")
    .eq("verified", true)
    .not("ort_slug", "is", null);

  if (!alerts?.length) {
    await supabase.from("system_settings").upsert({
      key: CURSOR_KEY,
      value: runStartedAt.toISOString(),
      description: "Cursor for dispatch-egg-alerts cron",
    });
    return new Response(JSON.stringify({ ok: true, listings: listings.length, sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Index alerts by ort_slug
  const alertsByOrt = new Map<string, typeof alerts>();
  for (const a of alerts) {
    if (!a.ort_slug) continue;
    const arr = alertsByOrt.get(a.ort_slug) ?? [];
    arr.push(a);
    alertsByOrt.set(a.ort_slug, arr);
  }

  const dailyCutoff = new Date(Date.now() - DAILY_QUOTA_HOURS * 3600 * 1000).toISOString();
  let sent = 0;
  let skippedQuota = 0;
  const errors: string[] = [];

  for (const listing of listings) {
    if (!listing.location) continue;
    const listingSlug = slugify(listing.location);

    for (const [ortSlug, subs] of alertsByOrt.entries()) {
      // Match if location slug equals or contains the ort_slug
      if (listingSlug !== ortSlug && !listingSlug.includes(ortSlug)) continue;

      for (const sub of subs) {
        // Daily-quota check: any send to this subscriber in last 24h?
        const { count } = await supabase
          .from("public_egg_alert_sends")
          .select("id", { count: "exact", head: true })
          .eq("alert_id", sub.id)
          .gt("sent_at", dailyCutoff);
        if ((count ?? 0) > 0) {
          skippedQuota++;
          continue;
        }

        // Reserve row first (unique alert_id+listing_id prevents duplicates on retry)
        const { error: insErr } = await supabase
          .from("public_egg_alert_sends")
          .insert({
            alert_id: sub.id,
            listing_id: listing.id,
            email: sub.email,
            ort_slug: ortSlug,
          });
        if (insErr) {
          if ((insErr as any).code === "23505") continue; // already sent
          errors.push(`insert:${insErr.message}`);
          continue;
        }

        try {
          await sendBrevo({
            email: sub.email,
            ortName: sub.ort_name ?? ortSlug,
            listing: {
              slug: listing.slug,
              title: listing.title,
              location: listing.location,
              price_per_pack: Number(listing.price_per_pack ?? 0),
            },
            unsubscribeToken: sub.unsubscribe_token,
          });
          await supabase
            .from("public_egg_alerts")
            .update({ last_notified_at: new Date().toISOString() })
            .eq("id", sub.id);
          sent++;
        } catch (err) {
          errors.push(String((err as Error).message ?? err));
          // Roll back the send record so we can retry later
          await supabase
            .from("public_egg_alert_sends")
            .delete()
            .eq("alert_id", sub.id)
            .eq("listing_id", listing.id);
        }
      }
    }
  }

  await supabase.from("system_settings").upsert({
    key: CURSOR_KEY,
    value: runStartedAt.toISOString(),
    description: "Cursor for dispatch-egg-alerts cron",
  });

  return new Response(
    JSON.stringify({
      ok: true,
      listings: listings.length,
      alerts: alerts.length,
      sent,
      skippedQuota,
      errors: errors.slice(0, 10),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
