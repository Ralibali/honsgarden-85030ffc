import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";
const APP_URL = "https://honsgarden.lovable.app";

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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Find users whose premium expired in the last 25 hours (to catch with some buffer)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000);

  const { data: expiredUsers, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, premium_expires_at")
    .eq("subscription_status", "free")
    .not("email", "is", null)
    .not("premium_expires_at", "is", null)
    .gte("premium_expires_at", yesterday.toISOString())
    .lte("premium_expires_at", now.toISOString());

  if (error || !expiredUsers?.length) {
    console.log("No recently expired users or error", error);
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;

  for (const user of expiredUsers) {
    try {
      const displayName = user.display_name || user.email?.split("@")[0] || "Hönsägare";
      const messageId = `premium-expired-${user.user_id}-${now.toISOString().slice(0, 10)}`;

      const html = `
<div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; padding: 36px 28px; background: #ffffff;">
  <img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin: 0 0 28px;" />

  <h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 8px;">
    Din Premium har löpt ut 🌻
  </h1>

  <p style="font-size: 15px; color: hsl(22,12%,44%); line-height: 1.7; margin: 0 0 20px;">
    Hej <strong>${displayName}</strong>! Vi ville bara berätta att din Premium-period på Hönsgården har avslutats.
  </p>

  <p style="font-size: 15px; color: hsl(22,12%,44%); line-height: 1.7; margin: 0 0 20px;">
    Du kan fortfarande använda grundfunktionerna – logga ägg, hantera dina höns och utföra dagliga sysslor. Men du saknar nu tillgång till:
  </p>

  <div style="background: linear-gradient(135deg, hsl(35,32%,97%), hsl(35,32%,94%)); border-radius: 16px; padding: 24px; margin: 0 0 24px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; font-size: 14px; color: hsl(22,12%,35%);">📊 Avancerad äggstatistik & trender</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: hsl(22,12%,35%);">💰 Detaljerad ekonomiöversikt</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: hsl(22,12%,35%);">📋 Veckorapporter via mejl</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: hsl(22,12%,35%);">🏆 Alla achievements & belöningar</td></tr>
      <tr><td style="padding: 6px 0; font-size: 14px; color: hsl(22,12%,35%);">💡 AI-drivna personliga tips</td></tr>
    </table>
  </div>

  <p style="font-size: 15px; color: hsl(22,12%,44%); line-height: 1.7; margin: 0 0 24px;">
    Vill du ha tillbaka allt? Uppgradera enkelt igen – det tar bara några sekunder! 💚
  </p>

  <a href="${APP_URL}/app/premium" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 15px; font-weight: 600; border-radius: 14px; padding: 14px 28px; text-decoration: none; display: inline-block;">
    Uppgradera till Premium →
  </a>

  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.5;">
    Vi skickar detta mejl en gång när din Premium löper ut. Du får inte fler påminnelser.
  </p>
</div>`;

      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: user.email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject: "Din Premium har löpt ut – vi saknar dig! 🌻",
          html,
          text: `Hej ${displayName}! Din Premium-period på Hönsgården har avslutats. Uppgradera igen: ${APP_URL}/app/premium`,
          purpose: "transactional",
          label: "premium-expired",
          message_id: messageId,
          queued_at: new Date().toISOString(),
        },
      });

      sent++;
    } catch (err) {
      console.error(`Failed for user ${user.user_id}:`, err);
    }
  }

  return new Response(JSON.stringify({ processed: sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
