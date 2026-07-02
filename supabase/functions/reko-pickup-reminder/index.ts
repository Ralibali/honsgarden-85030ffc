// Daily cron: notify sellers 2 days before their next REKO pickup date.
// Idempotent via public_egg_sale_listings.reko_reminder_sent_for (timestamptz).
// Auto-rolls reko_next_pickup_at forward +14 days after pickup date has passed
// when reko_recurring_biweekly = true.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.se";
const LOGO_URL =
  "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

function stockholmDateStr(d: Date): string {
  return new Date(
    d.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }),
  )
    .toISOString()
    .slice(0, 10);
}

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (provided !== serviceKey && !okSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const targetDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const targetDateStr = stockholmDateStr(targetDate);
  const windowStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: listings, error } = await supabase
    .from("public_egg_sale_listings")
    .select(
      "id, user_id, title, slug, reko_group_name, reko_pickup_location, reko_next_pickup_at, reko_reminder_sent_for, packs_available, stock_packs",
    )
    .eq("reko_enabled", true)
    .eq("is_active", true)
    .not("reko_next_pickup_at", "is", null)
    .gte("reko_next_pickup_at", windowStart)
    .lte("reko_next_pickup_at", windowEnd);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const candidates = (listings ?? []).filter((l: any) => {
    if (!l.reko_next_pickup_at) return false;
    const dateStr = stockholmDateStr(new Date(l.reko_next_pickup_at));
    if (dateStr !== targetDateStr) return false;
    if (l.reko_reminder_sent_for) {
      const alreadySent = new Date(l.reko_reminder_sent_for).toISOString();
      if (alreadySent === new Date(l.reko_next_pickup_at).toISOString()) return false;
    }
    return true;
  });

  let sent = 0;
  let errors = 0;
  for (const l of candidates) {
    try {
      const { data: userRes } = await supabase.auth.admin.getUserById(l.user_id);
      const email = userRes?.user?.email;
      if (!email) continue;

      const pickupDate = new Date(l.reko_next_pickup_at!);
      const dateSv = pickupDate.toLocaleDateString("sv-SE", {
        timeZone: "Europe/Stockholm",
        weekday: "long", day: "numeric", month: "long",
      });
      const timeSv = pickupDate.toLocaleTimeString("sv-SE", {
        timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit",
      });
      const stock = l.stock_packs ?? l.packs_available ?? 0;
      const subject = `REKO-utlämning ${dateSv} – uppdatera lagersaldot?`;
      const editLink = `${APP_URL}/app/egg-sales`;

      const html =
        `<div style="font-family:Inter,Arial,sans-serif;max-width:540px;padding:28px 22px;">` +
        `<img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin:0 0 20px;" />` +
        `<h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 12px;">REKO-utlämning om 2 dagar 📦</h1>` +
        `<p style="font-size:14px;line-height:1.6;color:hsl(22,12%,44%);margin:0 0 16px;">Hej! Din annons <strong>${l.title ?? "Färska ägg"}</strong> har utlämning i <strong>${l.reko_group_name ?? "REKO-ringen"}</strong> den <strong>${dateSv} kl ${timeSv}</strong>${l.reko_pickup_location ? ` (${l.reko_pickup_location})` : ""}.</p>` +
        `<div style="background:hsl(35,32%,97%);border:1px solid hsl(22,15%,90%);border-radius:14px;padding:16px 18px;margin:0 0 20px;">` +
        `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Nuvarande lagersaldo</p>` +
        `<p style="margin:0 0 12px;font-size:18px;font-weight:700;color:hsl(22,18%,12%);">${stock} kartor</p>` +
        `<a href="${editLink}" style="display:inline-block;background:hsl(142,32%,34%);color:white;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;">Uppdatera lager</a>` +
        `</div>` +
        `<p style="font-size:12px;color:#999;margin:24px 0 0;">Vi påminner en gång per utlämningsdatum. Avaktivera REKO på annonsen för att sluta få dessa.</p>` +
        `</div>`;

      const text = `REKO-utlämning ${dateSv} kl ${timeSv} via ${l.reko_group_name ?? "REKO"}. Nuvarande lager: ${stock} kartor. Uppdatera: ${editLink}`;

      const { error: enqErr } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          run_id: crypto.randomUUID(),
          to: email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject, html, text,
          purpose: "transactional",
          label: "reko-pickup-reminder",
          message_id: `reko-reminder-${l.id}-${pickupDate.toISOString()}`,
          queued_at: new Date().toISOString(),
        },
      });
      if (enqErr) throw enqErr;

      await supabase
        .from("public_egg_sale_listings")
        .update({ reko_reminder_sent_for: pickupDate.toISOString() })
        .eq("id", l.id);

      sent++;
    } catch (e) {
      console.error("reko reminder error", l.id, e);
      errors++;
    }
  }

  // Housekeeping: roll biweekly listings whose date is in the past +14 days
  const nowIso = new Date().toISOString();
  const { data: past } = await supabase
    .from("public_egg_sale_listings")
    .select("id, reko_next_pickup_at")
    .eq("reko_enabled", true)
    .eq("reko_recurring_biweekly", true)
    .lt("reko_next_pickup_at", nowIso);
  for (const p of past ?? []) {
    const cur = new Date(p.reko_next_pickup_at!);
    const next = new Date(cur.getTime() + 14 * 24 * 60 * 60 * 1000);
    await supabase
      .from("public_egg_sale_listings")
      .update({ reko_next_pickup_at: next.toISOString(), reko_reminder_sent_for: null })
      .eq("id", p.id);
  }

  return new Response(
    JSON.stringify({ candidates: candidates.length, sent, errors }),
    { headers: { "Content-Type": "application/json" } },
  );
});
