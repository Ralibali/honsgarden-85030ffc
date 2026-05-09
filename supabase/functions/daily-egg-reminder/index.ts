// Daily egg-count reminder. Runs via pg_cron at 17:00 UTC (≈19:00 CEST/18:00 CET).
// Sends a short evening nudge to users who:
//   - have at least one active hen
//   - have NOT logged any eggs today
//   - have not opted out (reminder_settings.evening_reminder !== false)
// Email is enqueued via the standard pgmq queue, same pattern as weekly-report.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.lovable.app/app";
const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "config" }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Use Stockholm date for "today" calculation
  const todayStr = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Stockholm" })
  ).toISOString().slice(0, 10);

  // 1. Users with evening reminder enabled (default true if no row)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email, display_name")
    .not("email", "is", null);

  if (!profiles?.length) {
    return new Response(JSON.stringify({ processed: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  let sent = 0;
  let skipped = 0;

  for (const p of profiles) {
    try {
      // Check opt-out
      const { data: rs } = await supabase
        .from("reminder_settings")
        .select("evening_reminder, enabled")
        .eq("user_id", p.user_id)
        .maybeSingle();

      if (rs && (rs.enabled === false || rs.evening_reminder === false)) {
        skipped++;
        continue;
      }

      // Must have active hens
      const { count: henCount } = await supabase
        .from("hens")
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.user_id)
        .eq("is_active", true);
      if (!henCount) { skipped++; continue; }

      // Must have NOT logged eggs today
      const { count: eggCount } = await supabase
        .from("egg_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.user_id)
        .eq("date", todayStr);
      if (eggCount && eggCount > 0) { skipped++; continue; }

      const name = (p.display_name || "").split(" ")[0] || "kompis";
      const subject = "Glöm inte att räkna dagens ägg 🥚";

      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#faf8f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2a28;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:20px;">
    <img src="${LOGO_URL}" alt="Hönsgården" width="56" height="56" style="border-radius:14px" />
  </div>
  <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:hsl(142,32%,28%);margin:0 0 12px;">Hej ${name}!</h1>
  <p style="font-size:15px;line-height:1.55;color:hsl(22,12%,30%);margin:0 0 16px;">
    Det är kväll och du har inte loggat dagens äggräkning än. Det tar 10 sekunder
    och håller din streak igång.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${APP_URL}/eggs" style="display:inline-block;background:hsl(142,32%,34%);color:#faf8f4;font-size:15px;font-weight:600;border-radius:14px;padding:14px 28px;text-decoration:none;">
      🥚 Logga dagens ägg
    </a>
  </div>
  <p style="font-size:12px;color:#999;line-height:1.5;margin:32px 0 0;">
    Du får detta som daglig kvällspåminnelse. Vill du inte ha den?
    Stäng av i appen under Inställningar → Påminnelser.
  </p>
</div></body></html>`;

      const messageId = `daily-egg-reminder-${p.user_id}-${todayStr}`;
      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: p.email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject,
          html,
          text: `Hej ${name}! Glöm inte att logga dagens ägg på ${APP_URL}/eggs`,
          purpose: "transactional",
          label: "daily-egg-reminder",
          message_id: messageId,
          queued_at: new Date().toISOString(),
        },
      });
      sent++;
    } catch (err) {
      console.error("daily-egg-reminder error", p.user_id, err);
    }
  }

  return new Response(JSON.stringify({ sent, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
