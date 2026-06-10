// Daily reminder for buyers picking up eggs tomorrow.
// Runs via pg_cron at 15:00 UTC (≈ 16:00/17:00 Europe/Stockholm depending on DST).
// Idempotent: marks each booking with pickup_reminder_sent_at after enqueueing.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.lovable.app";
const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

// Returns YYYY-MM-DD in Europe/Stockholm for now() + addDays
function stockholmDateStr(addDays = 0): string {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
  local.setDate(local.getDate() + addDays);
  return local.toISOString().slice(0, 10);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

Deno.serve(async (req) => {
  // Auth — same pattern as daily-egg-reminder
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKeyAuth = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (provided !== serviceKeyAuth && !okSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!serviceKeyAuth) {
    return new Response(JSON.stringify({ error: "config" }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKeyAuth, { auth: { persistSession: false } });

  const tomorrow = stockholmDateStr(1);
  // Window of "tomorrow in Europe/Stockholm" expressed in UTC:
  // We just compare ISO date prefix after converting to Stockholm tz below.
  // First fetch candidate slots whose starts_at falls on `tomorrow` (Stockholm).
  // Use wide UTC window then filter precisely.
  const startOfTomorrowUtc = new Date(`${tomorrow}T00:00:00+01:00`); // approx — DST handled by filter
  const endWindowUtc = new Date(startOfTomorrowUtc.getTime() + 36 * 60 * 60 * 1000);

  const { data: slots, error: slotsErr } = await supabase
    .from("egg_sale_pickup_slots")
    .select("id, starts_at, ends_at")
    .gte("starts_at", new Date(startOfTomorrowUtc.getTime() - 12 * 60 * 60 * 1000).toISOString())
    .lte("starts_at", endWindowUtc.toISOString());

  if (slotsErr) {
    return new Response(JSON.stringify({ error: slotsErr.message }), { status: 500 });
  }

  const tomorrowSlots = (slots ?? []).filter((s: any) => {
    const local = new Date(s.starts_at).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" }).slice(0, 10).replaceAll("-", "-");
    // sv-SE returns "YYYY-MM-DD HH:MM:SS"
    return local.startsWith(tomorrow);
  });

  if (tomorrowSlots.length === 0) {
    return new Response(JSON.stringify({ found: 0, sent: 0, errors: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const slotIds = tomorrowSlots.map((s: any) => s.id);
  const slotById = new Map(tomorrowSlots.map((s: any) => [s.id, s]));

  // Fetch bookings for those slots that need reminding
  const { data: bookings, error: bErr } = await supabase
    .from("public_egg_sale_bookings")
    .select("id, listing_id, customer_name, customer_email, packs, payment_status, status, pickup_slot_id, pickup_reminder_sent_at")
    .in("pickup_slot_id", slotIds)
    .is("pickup_reminder_sent_at", null)
    .neq("status", "cancelled")
    .not("customer_email", "is", null);

  if (bErr) {
    return new Response(JSON.stringify({ error: bErr.message }), { status: 500 });
  }

  const found = bookings?.length ?? 0;
  let sent = 0;
  let errors = 0;

  if (found === 0) {
    return new Response(JSON.stringify({ found, sent, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Bulk-fetch listings + tokens
  const listingIds = Array.from(new Set((bookings ?? []).map((b: any) => b.listing_id)));
  const bookingIds = (bookings ?? []).map((b: any) => b.id);

  const [{ data: listings }, { data: tokens }] = await Promise.all([
    supabase
      .from("public_egg_sale_listings")
      .select("id, title, pickup_info, swish_number, swish_name, price_per_pack")
      .in("id", listingIds),
    supabase
      .from("egg_sale_booking_tokens")
      .select("booking_id, token")
      .in("booking_id", bookingIds),
  ]);

  const listingById = new Map((listings ?? []).map((l: any) => [l.id, l]));
  const tokenByBooking = new Map((tokens ?? []).map((t: any) => [t.booking_id, t.token]));

  for (const b of bookings ?? []) {
    try {
      const listing: any = listingById.get(b.listing_id);
      const slot: any = slotById.get(b.pickup_slot_id);
      if (!listing || !slot) {
        errors++;
        continue;
      }
      const token = tokenByBooking.get(b.id);
      const cancelLink = token ? `${APP_URL}/avboka/${token}` : null;

      const title = listing.title ?? "säljaren";
      const datePart = fmtDate(slot.starts_at);
      const startTime = fmtTime(slot.starts_at);
      const endTime = slot.ends_at ? fmtTime(slot.ends_at) : null;
      const slotText = endTime ? `${datePart} ${startTime} – ${endTime}` : `${datePart} ${startTime}`;

      const amount = Number(listing.price_per_pack ?? 0) * Number(b.packs ?? 0);
      const showSwish = b.payment_status === "unpaid" && listing.swish_number;

      const subject = `Påminnelse: imorgon hämtar du dina ägg hos ${title}`;
      const messageId = `pickup-reminder-${b.id}`;

      const html = `<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">`
        + `<img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin:0 0 24px;" />`
        + `<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ${b.customer_name}! 🥚</h1>`
        + `<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">En liten påminnelse – <strong>imorgon</strong> hämtar du dina <strong>${b.packs} förpackning${b.packs > 1 ? "ar" : ""}</strong> hos <strong>${title}</strong>.</p>`
        + `<div style="background: hsl(35,32%,97%); border: 1px solid hsl(22,15%,90%); border-radius: 14px; padding: 18px 20px; margin: 0 0 20px;">`
        + `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtningstid</p>`
        + `<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">${slotText}</p>`
        + (listing.pickup_info
          ? `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtning</p>`
            + `<p style="margin:0 0 14px;font-size:14px;color:hsl(22,18%,12%);">${listing.pickup_info}</p>`
          : "")
        + (showSwish
          ? `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Att betala</p>`
            + `<p style="margin:0 0 14px;font-size:18px;color:hsl(22,18%,12%);font-weight:700;">${Math.round(amount)} kr</p>`
            + `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Swisha till</p>`
            + `<p style="margin:0;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">${listing.swish_number}${listing.swish_name ? ` (${listing.swish_name})` : ""}</p>`
          : "")
        + `</div>`
        + (cancelLink
          ? `<p style="font-size:13px;color:hsl(22,12%,44%);margin:0 0 8px;">Behöver du avboka?</p>`
            + `<a href="${cancelLink}" style="color:hsl(142,32%,34%);font-size:13px;text-decoration:underline;">Avboka din bokning →</a>`
          : "")
        + `<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du gjort en bokning via Agdas bod på Hönsgården.</p>`
        + `</div>`;

      const text = `Hej ${b.customer_name}! Imorgon hämtar du ${b.packs} förp. hos ${title}. Tid: ${slotText}.`
        + (showSwish ? ` Att betala: ${Math.round(amount)} kr via Swish ${listing.swish_number}.` : "")
        + (cancelLink ? ` Avboka: ${cancelLink}` : "");

      const { error: enqErr } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          run_id: crypto.randomUUID(),
          to: b.customer_email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject,
          html,
          text,
          purpose: "transactional",
          label: "pickup-reminder",
          message_id: messageId,
          queued_at: new Date().toISOString(),
        },
      });
      if (enqErr) {
        console.error("enqueue failed", b.id, enqErr);
        errors++;
        continue;
      }

      const { error: updErr } = await supabase
        .from("public_egg_sale_bookings")
        .update({ pickup_reminder_sent_at: new Date().toISOString() })
        .eq("id", b.id)
        .is("pickup_reminder_sent_at", null);
      if (updErr) {
        console.error("mark sent failed", b.id, updErr);
      }
      sent++;
    } catch (err) {
      console.error("pickup-reminder error", b.id, err);
      errors++;
    }
  }

  return new Response(JSON.stringify({ found, sent, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});
