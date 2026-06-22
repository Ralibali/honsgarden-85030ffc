// Skickar betalpåminnelser till kunder som hämtat ägg men inte betalat.
// Två lägen:
//  - cron (POST {"mode":"cron"} eller GET): hittar alla obetalda hämtningar äldre än 2 dagar,
//    skickar påminnelse om ingen skickats senaste 2 dagarna och max 4 påminnelser totalt.
//  - manual (POST {"booking_id":"..."} med inloggad säljare): skickar EN påminnelse direkt.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.lovable.app";
const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

const MIN_DAYS_AFTER_PICKUP = 2;
const MIN_DAYS_BETWEEN = 2;
const MAX_REMINDERS = 4;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

function buildEmail(opts: {
  customerName: string;
  packs: number;
  amount: number;
  listingTitle: string;
  pickupDate: string;
  swishNumber?: string | null;
  swishName?: string | null;
  orderUrl?: string | null;
  reminderNumber: number;
}) {
  const { customerName, packs, amount, listingTitle, pickupDate, swishNumber, swishName, orderUrl, reminderNumber } = opts;
  const isFirst = reminderNumber === 1;
  const subject = isFirst
    ? `Vänlig påminnelse: betala dina ägg från ${listingTitle}`
    : `Påminnelse ${reminderNumber}: betala dina ägg från ${listingTitle}`;

  const intro = isFirst
    ? `Hoppas äggen smakar gott! Vi noterade att du hämtade ${packs} förpackning${packs > 1 ? "ar" : ""} hos <strong>${listingTitle}</strong> den ${pickupDate}, men ingen betalning har registrerats än.`
    : `Det här är en vänlig påminnelse om dina ${packs} förpackning${packs > 1 ? "ar" : ""} ägg som du hämtade hos <strong>${listingTitle}</strong> den ${pickupDate}.`;

  const html = `<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">`
    + `<img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin:0 0 24px;" />`
    + `<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ${customerName}!</h1>`
    + `<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">${intro}</p>`
    + `<div style="background: hsl(35,32%,97%); border: 1px solid hsl(22,15%,90%); border-radius: 14px; padding: 18px 20px; margin: 0 0 20px;">`
    + `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Att betala</p>`
    + `<p style="margin:0 0 14px;font-size:22px;color:hsl(22,18%,12%);font-weight:700;">${Math.round(amount)} kr</p>`
    + (swishNumber
      ? `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Swisha till</p>`
        + `<p style="margin:0;font-size:16px;color:hsl(22,18%,12%);font-weight:600;">${swishNumber}${swishName ? ` (${swishName})` : ""}</p>`
      : `<p style="margin:0;font-size:13px;color:hsl(22,12%,44%);">Kontakta säljaren för betalningsuppgifter.</p>`)
    + `</div>`
    + (orderUrl
      ? `<p style="font-size:13px;color:hsl(22,12%,44%);margin:0 0 8px;">Se din bokning:</p>`
        + `<a href="${orderUrl}" style="color:hsl(142,32%,34%);font-size:13px;text-decoration:underline;">Öppna orderlänken →</a>`
      : "")
    + `<p style="font-size: 13px; color: hsl(22,12%,44%); margin: 24px 0 0; line-height:1.6;">Har du redan swishat? Tack! Bortse i så fall från detta mejl – säljaren registrerar betalningen så snart den syns.</p>`
    + `<p style="font-size: 12px; color: #999; margin: 24px 0 0;">Skickat via Agdas bod på Hönsgården.</p>`
    + `</div>`;

  const text = `Hej ${customerName}! Vi noterade att du hämtade ${packs} förp. hos ${listingTitle} den ${pickupDate} men ingen betalning har registrerats än. Att betala: ${Math.round(amount)} kr`
    + (swishNumber ? ` via Swish ${swishNumber}${swishName ? ` (${swishName})` : ""}.` : ".")
    + (orderUrl ? ` Se bokning: ${orderUrl}` : "")
    + " Har du redan betalat – bortse från detta mejl.";

  return { subject, html, text };
}

async function sendForBooking(
  supabase: any,
  bookingId: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; reason?: string }> {
  const { data: b, error } = await supabase
    .from("public_egg_sale_bookings")
    .select("id, listing_id, customer_name, customer_email, packs, payment_status, cancelled_at, picked_up_at, payment_reminder_last_sent_at, payment_reminder_count")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !b) return { ok: false, reason: "not_found" };
  if (!b.customer_email) return { ok: false, reason: "no_email" };
  if (b.cancelled_at) return { ok: false, reason: "cancelled" };
  if (b.payment_status === "paid") return { ok: false, reason: "already_paid" };
  if (!b.picked_up_at) return { ok: false, reason: "not_picked_up" };

  if (!opts.force) {
    if ((b.payment_reminder_count ?? 0) >= MAX_REMINDERS) return { ok: false, reason: "max_reached" };
    const pickupAgeMs = Date.now() - new Date(b.picked_up_at).getTime();
    if (pickupAgeMs < MIN_DAYS_AFTER_PICKUP * 24 * 3600 * 1000) return { ok: false, reason: "too_soon_after_pickup" };
    if (b.payment_reminder_last_sent_at) {
      const sinceLast = Date.now() - new Date(b.payment_reminder_last_sent_at).getTime();
      if (sinceLast < MIN_DAYS_BETWEEN * 24 * 3600 * 1000) return { ok: false, reason: "too_soon" };
    }
  }

  const [{ data: listing }, { data: token }] = await Promise.all([
    supabase
      .from("public_egg_sale_listings")
      .select("title, swish_number, swish_name, price_per_pack")
      .eq("id", b.listing_id)
      .maybeSingle(),
    supabase
      .from("egg_sale_booking_tokens")
      .select("token")
      .eq("booking_id", b.id)
      .maybeSingle(),
  ]);
  if (!listing) return { ok: false, reason: "listing_missing" };

  const amount = Number(listing.price_per_pack ?? 0) * Number(b.packs ?? 0);
  const orderUrl = token?.token ? `${APP_URL}/bestallning/${token.token}` : null;
  const reminderNumber = (b.payment_reminder_count ?? 0) + 1;

  const { subject, html, text } = buildEmail({
    customerName: b.customer_name || "kund",
    packs: Number(b.packs ?? 0),
    amount,
    listingTitle: listing.title ?? "säljaren",
    pickupDate: fmtDate(b.picked_up_at),
    swishNumber: listing.swish_number,
    swishName: listing.swish_name,
    orderUrl,
    reminderNumber,
  });

  const { error: enqErr } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      run_id: crypto.randomUUID(),
      to: b.customer_email,
      from: "Hönsgården <noreply@notify.honsgarden.se>",
      sender_domain: "notify.honsgarden.se",
      subject, html, text,
      purpose: "transactional",
      label: "payment-reminder",
      message_id: `payment-reminder-${b.id}-${reminderNumber}`,
      queued_at: new Date().toISOString(),
    },
  });
  if (enqErr) return { ok: false, reason: enqErr.message };

  await supabase
    .from("public_egg_sale_bookings")
    .update({
      payment_reminder_last_sent_at: new Date().toISOString(),
      payment_reminder_count: reminderNumber,
    })
    .eq("id", b.id);

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "config" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
  }
  const mode = body?.mode === "cron" || req.method === "GET" ? "cron" : (body?.booking_id ? "manual" : "cron");

  // ---- Manual: säljaren skickar EN påminnelse från sin dashboard ----
  if (mode === "manual") {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: owns } = await service
      .from("public_egg_sale_bookings")
      .select("id")
      .eq("id", body.booking_id)
      .eq("seller_user_id", userId)
      .maybeSingle();
    if (!owns) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const res = await sendForBooking(service, body.booking_id, { force: true });
    const status = res.ok ? 200 : 400;
    return new Response(JSON.stringify(res), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ---- Cron: auth via service-role bearer eller CRON_SECRET ----
  const auth = req.headers.get("Authorization") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (provided !== serviceKey && !okSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - MIN_DAYS_AFTER_PICKUP * 24 * 3600 * 1000).toISOString();
  const lastCutoff = new Date(Date.now() - MIN_DAYS_BETWEEN * 24 * 3600 * 1000).toISOString();

  const { data: candidates, error: cErr } = await service
    .from("public_egg_sale_bookings")
    .select("id, payment_reminder_last_sent_at, payment_reminder_count")
    .neq("payment_status", "paid")
    .is("cancelled_at", null)
    .not("picked_up_at", "is", null)
    .not("customer_email", "is", null)
    .lte("picked_up_at", cutoff)
    .lt("payment_reminder_count", MAX_REMINDERS);

  if (cErr) {
    return new Response(JSON.stringify({ error: cErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const due = (candidates ?? []).filter((b: any) =>
    !b.payment_reminder_last_sent_at || b.payment_reminder_last_sent_at <= lastCutoff
  );

  let sent = 0, errors = 0;
  for (const b of due) {
    const r = await sendForBooking(service, b.id);
    if (r.ok) sent++; else if (r.reason && !["too_soon", "too_soon_after_pickup", "max_reached", "already_paid"].includes(r.reason)) errors++;
  }

  return new Response(JSON.stringify({ found: due.length, sent, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
