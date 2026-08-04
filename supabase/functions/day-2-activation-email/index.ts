// Day-2 activation email. Runs daily via pg_cron.
// Sends a one-time nudge to users who registered ~2 days ago and have NOT
// logged a single egg yet. Deduped via email_send_log (one send per user).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.lovable.app/app";
const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";
const LABEL = "day-2-activation";

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKeyAuth = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (provided !== serviceKeyAuth && !okSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "config" }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Window: profiles created between 48h and 72h ago (one full day to catch
  // them, even if cron misses a run).
  const now = Date.now();
  const fromIso = new Date(now - 72 * 3600 * 1000).toISOString();
  const toIso = new Date(now - 36 * 3600 * 1000).toISOString();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, created_at")
    .not("email", "is", null)
    .gte("created_at", fromIso)
    .lte("created_at", toIso);

  if (error) {
    console.error("day-2-activation list error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!profiles?.length) {
    return new Response(JSON.stringify({ sent: 0, skipped: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  let sent = 0;
  let skipped = 0;

  for (const p of profiles) {
    try {
      // Skip if user already logged any egg
      const { count: eggCount } = await supabase
        .from("egg_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", p.user_id);
      if (eggCount && eggCount > 0) { skipped++; continue; }

      // Dedupe: skip if we've already enqueued/sent this email to the user
      const messageId = `day2-activation-${p.user_id}`;
      const { data: existing } = await supabase
        .from("email_send_log")
        .select("id")
        .eq("message_id", messageId)
        .limit(1)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      const name = (p.display_name || "").split(" ")[0] || "kompis";
      const subject = "Logga ditt första ägg på 10 sekunder 🥚";

      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#faf8f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2a28;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:20px;">
    <img src="${LOGO_URL}" alt="Hönsgården" width="56" height="56" style="border-radius:14px" />
  </div>
  <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:hsl(142,32%,28%);margin:0 0 12px;">Hej ${name}!</h1>
  <p style="font-size:15px;line-height:1.55;color:hsl(22,12%,30%);margin:0 0 16px;">
    Kul att du har gått med i Hönsgården! Det enklaste sättet att komma igång
    är att logga dagens äggräkning – det tar 10 sekunder och allt blir mycket
    roligare när du börjar se din statistik växa.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${APP_URL}/eggs" style="display:inline-block;background:hsl(142,32%,34%);color:#faf8f4;font-size:15px;font-weight:600;border-radius:14px;padding:14px 28px;text-decoration:none;">
      🥚 Logga ditt första ägg
    </a>
  </div>
  <p style="font-size:14px;line-height:1.55;color:hsl(22,12%,30%);margin:0 0 16px;">
    Saknar du en höna än? Lägg till en på <a href="${APP_URL}/hens" style="color:hsl(142,32%,34%);">Mina höns</a> först – sen är du igång.
  </p>
  <p style="font-size:12px;color:#999;line-height:1.5;margin:32px 0 0;">
    Du får detta mejl för att du nyligen registrerade dig på Hönsgården.
  </p>
</div></body></html>`;

      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: p.email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject,
          html,
          text: `Hej ${name}! Logga ditt första ägg på ${APP_URL}/eggs – det tar 10 sekunder.`,
          purpose: "transactional",
          label: LABEL,
          message_id: messageId,
          queued_at: new Date().toISOString(),
        },
      });
      sent++;
    } catch (err) {
      console.error("day-2-activation error", p.user_id, err);
    }
  }

  return new Response(JSON.stringify({ sent, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});
