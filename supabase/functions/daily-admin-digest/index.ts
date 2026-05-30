import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";
const ADMIN_EMAIL = "info@auroramedia.se";

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

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString();
  const todayStr = now.toISOString().slice(0, 10);

  // Fetch new registrations (last 24h)
  const { data: newUsers } = await supabase
    .from("profiles")
    .select("email, display_name, created_at, subscription_status")
    .gte("created_at", yesterdayStr)
    .order("created_at", { ascending: false });

  // Fetch new premium upgrades (look at email_send_log for premium welcome emails sent in last 24h)
  const { data: premiumEvents } = await supabase
    .from("email_send_log")
    .select("recipient_email, created_at")
    .eq("template_name", "user-premium-welcome")
    .gte("created_at", yesterdayStr)
    .eq("status", "sent");

  // Fetch total user count
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  // Fetch total premium count
  const { count: totalPremium } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("subscription_status", "premium");

  // Fetch total eggs logged today
  const { data: todayEggs } = await supabase
    .from("egg_logs")
    .select("count")
    .eq("date", todayStr);

  const totalEggsToday = (todayEggs || []).reduce((s, r) => s + (r.count || 0), 0);

  const newUserCount = newUsers?.length || 0;
  const premiumCount = premiumEvents?.length || 0;

  // If nothing happened, still send a brief digest
  const dateLabel = now.toLocaleDateString("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build new users table rows
  let userRows = "";
  if (newUsers && newUsers.length > 0) {
    for (const u of newUsers) {
      const time = new Date(u.created_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      userRows += `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid hsl(35,32%,92%); font-size: 13px; color: hsl(22,12%,35%);">${u.display_name || "—"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid hsl(35,32%,92%); font-size: 13px; color: hsl(22,12%,50%);">${u.email || "—"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid hsl(35,32%,92%); font-size: 13px; color: hsl(22,12%,50%);">${time}</td>
      </tr>`;
    }
  }

  let premiumRows = "";
  if (premiumEvents && premiumEvents.length > 0) {
    for (const p of premiumEvents) {
      const time = new Date(p.created_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      premiumRows += `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid hsl(35,32%,92%); font-size: 13px; color: hsl(22,12%,35%);">${p.recipient_email}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid hsl(35,32%,92%); font-size: 13px; color: hsl(22,12%,50%);">${time}</td>
      </tr>`;
    }
  }

  const html = `
<div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; padding: 36px 28px; background: #ffffff;">
  <img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin: 0 0 28px;" />

  <h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 6px;">
    Daglig rapport 📊
  </h1>
  <p style="font-size: 13px; color: hsl(22,12%,55%); margin: 0 0 24px;">${dateLabel}</p>

  <!-- Summary stats -->
  <div style="background: linear-gradient(135deg, hsl(142,32%,96%), hsl(35,32%,95%)); border-radius: 16px; padding: 24px; margin: 0 0 24px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 8px; text-align: center; width: 25%;">
          <div style="font-size: 28px; font-weight: 700; color: hsl(142,32%,28%);">${newUserCount}</div>
          <div style="font-size: 11px; color: hsl(22,12%,50%); margin-top: 2px;">nya medlemmar</div>
        </td>
        <td style="padding: 10px 8px; text-align: center; width: 25%;">
          <div style="font-size: 28px; font-weight: 700; color: hsl(142,32%,28%);">${premiumCount}</div>
          <div style="font-size: 11px; color: hsl(22,12%,50%); margin-top: 2px;">nya premium</div>
        </td>
        <td style="padding: 10px 8px; text-align: center; width: 25%;">
          <div style="font-size: 28px; font-weight: 700; color: hsl(142,32%,28%);">${totalUsers || 0}</div>
          <div style="font-size: 11px; color: hsl(22,12%,50%); margin-top: 2px;">totalt</div>
        </td>
        <td style="padding: 10px 8px; text-align: center; width: 25%;">
          <div style="font-size: 28px; font-weight: 700; color: hsl(142,32%,28%);">${totalPremium || 0}</div>
          <div style="font-size: 11px; color: hsl(22,12%,50%); margin-top: 2px;">premium</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Egg stat -->
  <div style="background: hsl(35,32%,97%); border-radius: 12px; padding: 16px 20px; margin: 0 0 24px;">
    <p style="font-size: 14px; color: hsl(22,12%,35%); margin: 0;">
      🥚 <strong>${totalEggsToday} ägg</strong> loggade idag på plattformen
    </p>
  </div>

  ${newUserCount > 0 ? `
  <!-- New users -->
  <h2 style="font-family: 'Young Serif', Georgia, serif; font-size: 16px; color: hsl(22,18%,12%); margin: 0 0 12px;">
    Nya medlemmar 👋
  </h2>
  <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
    <tr style="background: hsl(35,32%,95%);">
      <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: hsl(22,12%,50%); font-weight: 600;">Namn</th>
      <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: hsl(22,12%,50%); font-weight: 600;">E-post</th>
      <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: hsl(22,12%,50%); font-weight: 600;">Tid</th>
    </tr>
    ${userRows}
  </table>` : `
  <p style="font-size: 14px; color: hsl(22,12%,55%); margin: 0 0 24px;">Inga nya registreringar senaste dygnet.</p>`}

  ${premiumCount > 0 ? `
  <!-- Premium upgrades -->
  <h2 style="font-family: 'Young Serif', Georgia, serif; font-size: 16px; color: hsl(22,18%,12%); margin: 0 0 12px;">
    Nya Premium-medlemmar 🌟
  </h2>
  <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
    <tr style="background: hsl(142,32%,96%);">
      <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: hsl(22,12%,50%); font-weight: 600;">E-post</th>
      <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: hsl(22,12%,50%); font-weight: 600;">Tid</th>
    </tr>
    ${premiumRows}
  </table>` : ""}

  <a href="https://honsgarden.lovable.app/app/admin" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; font-weight: 600; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">
    Öppna adminpanelen →
  </a>

  <p style="font-size: 12px; color: #999; margin: 32px 0 0;">
    Denna rapport skickas automatiskt varje morgon kl 07:00.
  </p>
</div>`;

  const messageId = `admin-digest-${todayStr}`;

  await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: ADMIN_EMAIL,
      from: "Hönsgården <noreply@notify.honsgarden.se>",
      sender_domain: "notify.honsgarden.se",
      subject: `📊 Dygnsrapport: ${newUserCount} nya, ${premiumCount} premium (${todayStr})`,
      html,
      text: `Dygnsrapport ${todayStr}: ${newUserCount} nya medlemmar, ${premiumCount} nya premium, ${totalUsers} totalt, ${totalEggsToday} ägg loggade.`,
      purpose: "transactional",
      label: "admin-daily-digest",
      message_id: messageId,
      queued_at: new Date().toISOString(),
    },
  });

  return new Response(JSON.stringify({ sent: true, newUsers: newUserCount, premium: premiumCount }), {
    headers: { "Content-Type": "application/json" },
  });
});
