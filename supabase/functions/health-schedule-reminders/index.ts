// Dygnsjobb: skickar påminnelser för förebyggande hälsoschema OCH
// notis när ägg-karens upphör.
// Schemaläggs via pg_cron.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.lovable.app/app/health";
const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (provided !== serviceKey && !okSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const todayStr = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Stockholm" })
  ).toISOString().slice(0, 10);

  let scheduleNotices = 0;
  let karensNotices = 0;

  // ------ DEL A: schema-påminnelser ------
  const { data: schedules } = await supabase
    .from("health_schedules" as any)
    .select("*")
    .eq("is_active", true);

  for (const s of (schedules ?? []) as any[]) {
    try {
      const due = new Date(s.next_due_date);
      const today = new Date(todayStr);
      const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
      if (diffDays > (s.reminder_days_before ?? 3)) continue;
      if (s.last_reminded_due === s.next_due_date) continue;

      // Recipient
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("user_id", s.user_id)
        .maybeSingle();
      if (!profile?.email) continue;

      const target = s.hen_id
        ? (await supabase.from("hens").select("name").eq("id", s.hen_id).maybeSingle()).data?.name || "höna"
        : s.flock_id
          ? (await supabase.from("flocks").select("name").eq("id", s.flock_id).maybeSingle()).data?.name || "flocken"
          : "hela besättningen";

      const status = diffDays < 0 ? "Försenat" : diffDays === 0 ? "Idag" : `Om ${diffDays} dagar`;
      const subject = `Påminnelse: ${s.title} (${target}) – ${status.toLowerCase()}`;

      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          run_id: crypto.randomUUID(),
          to: profile.email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject,
          html: `<div style="font-family:Inter,Arial,sans-serif;max-width:540px;padding:30px 25px;">`
            + `<img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin:0 0 24px;" />`
            + `<h1 style="font-family:Young Serif,Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 16px;">Dags för ${s.title}</h1>`
            + `<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.6;margin:0 0 18px;">Status: <strong>${status}</strong> · Gäller: <strong>${target}</strong> · Förfaller ${s.next_due_date}.</p>`
            + `<a href="${APP_URL}" style="background-color:hsl(142,32%,34%);color:hsl(35,32%,97%);font-size:14px;border-radius:14px;padding:12px 24px;text-decoration:none;display:inline-block;">Öppna hälsologgen →</a>`
            + `<p style="font-size:12px;color:#999;margin:30px 0 0;">Du får detta mejl för att du har lagt upp ett återkommande hälsoschema i Hönsgården.</p>`
            + `</div>`,
          text: `Påminnelse: ${s.title} för ${target}. Status: ${status}. Förfaller ${s.next_due_date}. Öppna: ${APP_URL}`,
          purpose: "transactional",
          label: "health-schedule-reminder",
          message_id: `hsched-${s.id}-${s.next_due_date}`,
          queued_at: new Date().toISOString(),
        },
      });

      // In-app notis
      await supabase.from("user_notifications").insert({
        user_id: s.user_id,
        type: "health_schedule",
        title: `Dags för ${s.title}`,
        body: `${target} · ${status} (förfaller ${s.next_due_date})`,
        link: "/app/health",
        metadata: { schedule_id: s.id, due: s.next_due_date },
      });

      await supabase
        .from("health_schedules" as any)
        .update({ last_reminded_due: s.next_due_date })
        .eq("id", s.id);

      scheduleNotices++;
    } catch (e) {
      console.error("schedule reminder error", s.id, e);
    }
  }

  // ------ DEL B: karens slutar idag eller tidigare ------
  const { data: karensEvents } = await supabase
    .from("health_events")
    .select("id, user_id, hen_id, flock_id, title, egg_safe_from, karens_end_notified")
    .lte("egg_safe_from", todayStr)
    .eq("karens_end_notified", false)
    .not("egg_safe_from", "is", null);

  for (const ev of (karensEvents ?? []) as any[]) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("user_id", ev.user_id)
        .maybeSingle();

      const target = ev.hen_id
        ? (await supabase.from("hens").select("name").eq("id", ev.hen_id).maybeSingle()).data?.name || "hönan"
        : ev.flock_id
          ? (await supabase.from("flocks").select("name").eq("id", ev.flock_id).maybeSingle()).data?.name || "besättningen"
          : "besättningen";

      if (profile?.email) {
        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            run_id: crypto.randomUUID(),
            to: profile.email,
            from: "Hönsgården <noreply@notify.honsgarden.se>",
            sender_domain: "notify.honsgarden.se",
            subject: `Karensen är slut: äggen från ${target} får ätas igen 🥚`,
            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:540px;padding:30px 25px;">`
              + `<img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin:0 0 24px;" />`
              + `<h1 style="font-family:Young Serif,Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 16px;">Karensen är över</h1>`
              + `<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.6;margin:0 0 18px;">Karenstiden efter <strong>${ev.title}</strong> har passerat. Äggen från <strong>${target}</strong> kan nu användas och säljas som vanligt igen.</p>`
              + `<a href="${APP_URL}" style="background-color:hsl(142,32%,34%);color:hsl(35,32%,97%);font-size:14px;border-radius:14px;padding:12px 24px;text-decoration:none;display:inline-block;">Öppna hälsologgen →</a>`
              + `</div>`,
            text: `Karenstiden efter ${ev.title} är slut. Äggen från ${target} får ätas igen.`,
            purpose: "transactional",
            label: "karens-end",
            message_id: `karens-${ev.id}`,
            queued_at: new Date().toISOString(),
          },
        });
      }

      await supabase.from("user_notifications").insert({
        user_id: ev.user_id,
        type: "karens_end",
        title: "Karensen är över",
        body: `Äggen från ${target} får ätas igen efter ${ev.title}.`,
        link: "/app/health",
        metadata: { event_id: ev.id },
      });

      await supabase
        .from("health_events")
        .update({ karens_end_notified: true })
        .eq("id", ev.id);

      karensNotices++;
    } catch (e) {
      console.error("karens notify error", ev.id, e);
    }
  }

  return new Response(
    JSON.stringify({ schedule_notices: scheduleNotices, karens_notices: karensNotices }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
