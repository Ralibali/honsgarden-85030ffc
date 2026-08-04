import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { callAi } from "../_shared/ai.ts";

const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";
const APP_URL = "https://honsgarden.lovable.app/app";

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
    console.error("Missing required env vars");
    return new Response(JSON.stringify({ error: "config" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Get all premium users
  const { data: premiumUsers, error: usersErr } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, preferences")
    .eq("subscription_status", "premium")
    .not("email", "is", null);

  if (usersErr || !premiumUsers?.length) {
    console.log("No premium users or error", usersErr);
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  let sent = 0;

  for (const user of premiumUsers) {
    try {
      // Skip users who opted out
      const prefs = (user.preferences && typeof user.preferences === "object") ? user.preferences as Record<string, unknown> : {};
      if (prefs.weekly_report_email === false) continue;
      // 2. Fetch egg data for this & last week
      const [eggsThisWeek, eggsLastWeek, hens, choresCompleted] = await Promise.all([
        supabase
          .from("egg_logs")
          .select("count, date")
          .eq("user_id", user.user_id)
          .gte("date", weekAgoStr)
          .lte("date", todayStr),
        supabase
          .from("egg_logs")
          .select("count")
          .eq("user_id", user.user_id)
          .gte("date", twoWeeksAgoStr)
          .lt("date", weekAgoStr),
        supabase
          .from("hens")
          .select("id")
          .eq("user_id", user.user_id)
          .eq("is_active", true),
        supabase
          .from("chore_completions")
          .select("id")
          .eq("user_id", user.user_id)
          .gte("completed_date", weekAgoStr)
          .lte("completed_date", todayStr),
      ]);

      const totalEggs = (eggsThisWeek.data || []).reduce(
        (sum, r) => sum + (r.count || 0),
        0
      );
      const prevTotalEggs = (eggsLastWeek.data || []).reduce(
        (sum, r) => sum + (r.count || 0),
        0
      );
      const henCount = hens.data?.length || 0;
      const choresCount = choresCompleted.data?.length || 0;
      const avgPerDay = henCount > 0 ? (totalEggs / 7).toFixed(1) : "0";

      // Find best day
      const dayMap: Record<string, number> = {};
      for (const r of eggsThisWeek.data || []) {
        dayMap[r.date] = (dayMap[r.date] || 0) + (r.count || 0);
      }
      const bestDayEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];
      const bestDay = bestDayEntry
        ? `${new Date(bestDayEntry[0]).toLocaleDateString("sv-SE", { weekday: "long" })} (${bestDayEntry[1]} ägg)`
        : "—";

      // Egg trend
      const eggDiff = totalEggs - prevTotalEggs;
      const trendEmoji = eggDiff > 0 ? "📈" : eggDiff < 0 ? "📉" : "➡️";
      const trendText =
        eggDiff > 0
          ? `+${eggDiff} fler ägg än förra veckan`
          : eggDiff < 0
          ? `${eggDiff} färre ägg än förra veckan`
          : "Samma som förra veckan";

      // 3. Get AI insight
      let aiInsight = "";
      try {
        const season = getSeason(now);
        const ai = await callAi({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "user",
              content: `Du är en kunnig hönsgårdsrådgivare. Ge ETT kort, personligt tips (max 40 ord) på svenska baserat på: ${totalEggs} ägg denna vecka, ${henCount} höns, säsong: ${season}. Var uppmuntrande. Svara med bara tipset, inget annat.`,
            },
          ],
        });
        if (ai.ok) {
          aiInsight = ai.text.trim();
        }
      } catch {
        // Non-blocking
      }

      const displayName = user.display_name || user.email?.split("@")[0] || "Hönsägare";
      const weekLabel = `${weekAgo.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })} – ${now.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}`;

      // 4. Build email
      const html = `
<div style="font-family: 'Inter', Arial, sans-serif; max-width: 540px; padding: 36px 28px; background: #ffffff;">
  <img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin: 0 0 28px;" />

  <h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 6px;">
    Din veckorapport 📋
  </h1>
  <p style="font-size: 13px; color: hsl(22,12%,55%); margin: 0 0 24px;">${weekLabel}</p>

  <p style="font-size: 15px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 24px;">
    Hej <strong>${displayName}</strong>! Här är en sammanfattning av din vecka på gården.
  </p>

  <!-- Stats cards -->
  <div style="background: linear-gradient(135deg, hsl(142,32%,96%), hsl(35,32%,95%)); border-radius: 16px; padding: 24px; margin: 0 0 24px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 8px; vertical-align: top; width: 50%;">
          <div style="font-size: 28px; font-weight: 700; color: hsl(142,32%,28%);">${totalEggs}</div>
          <div style="font-size: 12px; color: hsl(22,12%,50%); margin-top: 2px;">ägg totalt 🥚</div>
        </td>
        <td style="padding: 10px 8px; vertical-align: top; width: 50%;">
          <div style="font-size: 28px; font-weight: 700; color: hsl(142,32%,28%);">${avgPerDay}</div>
          <div style="font-size: 12px; color: hsl(22,12%,50%); margin-top: 2px;">ägg per dag i snitt</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 8px; vertical-align: top;">
          <div style="font-size: 28px; font-weight: 700; color: hsl(142,32%,28%);">${henCount}</div>
          <div style="font-size: 12px; color: hsl(22,12%,50%); margin-top: 2px;">aktiva höns 🐔</div>
        </td>
        <td style="padding: 10px 8px; vertical-align: top;">
          <div style="font-size: 28px; font-weight: 700; color: hsl(142,32%,28%);">${choresCount}</div>
          <div style="font-size: 12px; color: hsl(22,12%,50%); margin-top: 2px;">sysslor avklarade ✅</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Trend -->
  <div style="background: hsl(35,32%,97%); border-radius: 12px; padding: 16px 20px; margin: 0 0 20px;">
    <p style="font-size: 14px; color: hsl(22,12%,35%); margin: 0;">
      ${trendEmoji} <strong>Äggtrend:</strong> ${trendText}
    </p>
    <p style="font-size: 13px; color: hsl(22,12%,50%); margin: 6px 0 0;">
      🏆 Bästa dag: <strong>${bestDay}</strong>
    </p>
  </div>

  ${aiInsight ? `
  <!-- AI tip -->
  <div style="background: hsl(142,32%,96%); border-left: 4px solid hsl(142,32%,34%); border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 0 0 24px;">
    <p style="font-size: 13px; color: hsl(142,32%,28%); margin: 0;">
      💡 <strong>Veckans tips:</strong> ${aiInsight}
    </p>
  </div>
  ` : ""}

  <a href="${APP_URL}/statistics" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 15px; font-weight: 600; border-radius: 14px; padding: 14px 28px; text-decoration: none; display: inline-block;">
    Se detaljerad statistik →
  </a>

  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.5;">
    Du får detta mejl varje måndag som Premium-medlem på Hönsgården. Vill du inte ha veckorapporter? Ändra i inställningarna i appen.
  </p>
</div>`;

      // 5. Queue email
      const messageId = `weekly-${user.user_id}-${todayStr}`;
      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: user.email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject: `Din veckorapport: ${totalEggs} ägg 🥚 (${weekLabel})`,
          html,
          text: `Hej ${displayName}! Veckorapport ${weekLabel}: ${totalEggs} ägg, ${henCount} höns, ${choresCount} sysslor avklarade. ${trendText}. ${aiInsight || ""}`,
          purpose: "transactional",
          label: "weekly-report",
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

function getSeason(date: Date): string {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "vår";
  if (m >= 5 && m <= 7) return "sommar";
  if (m >= 8 && m <= 10) return "höst";
  return "vinter";
}
