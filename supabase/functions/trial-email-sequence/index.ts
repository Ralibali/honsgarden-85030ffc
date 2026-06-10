// Trial lifecycle email sequence. Runs daily via pg_cron at 08:00 UTC (~09:00/10:00 CET/CEST).
// Three keys, max one per user ever:
//   trial_day5  — 2 days before premium_expires_at
//   trial_day7  — same Stockholm day as premium_expires_at (last day)
//   trial_day10 — 3 days after premium_expires_at (only if not currently premium)
// Idempotent via public.lifecycle_emails_sent.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.lovable.app";
const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";
const FROM = "Hönsgården <noreply@notify.honsgarden.se>";

function stockholmDateStr(d: Date = new Date()): string {
  const local = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
  return local.toISOString().slice(0, 10);
}

// Days between two dates (stockholm-anchored): expiresDay - todayDay
function dayDiff(expires: Date, now: Date): number {
  const a = stockholmDateStr(expires);
  const b = stockholmDateStr(now);
  const ms = new Date(a + "T00:00:00Z").getTime() - new Date(b + "T00:00:00Z").getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function shell(title: string, intro: string, bodyHtml: string, ctaLabel: string, ctaHref: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#faf8f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2a28;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:20px;">
    <img src="${LOGO_URL}" alt="Hönsgården" width="56" height="56" style="border-radius:14px" />
  </div>
  <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:hsl(142,32%,28%);margin:0 0 12px;">${title}</h1>
  <p style="font-size:15px;line-height:1.55;color:hsl(22,12%,30%);margin:0 0 16px;">${intro}</p>
  ${bodyHtml}
  <div style="text-align:center;margin:28px 0;">
    <a href="${ctaHref}" style="display:inline-block;background:hsl(142,32%,34%);color:#faf8f4;font-size:15px;font-weight:600;border-radius:14px;padding:14px 28px;text-decoration:none;">${ctaLabel}</a>
  </div>
  <p style="font-size:12px;color:#999;line-height:1.5;margin:32px 0 0;">${footer}</p>
</div></body></html>`;
}

function statCard(items: { label: string; value: string }[]): string {
  return `<div style="background:#fff;border:1px solid hsl(22,15%,90%);border-radius:14px;padding:18px 20px;margin:0 0 16px;">
    ${items.map(i => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:hsl(22,18%,12%);"><span style="color:hsl(22,12%,44%);">${i.label}</span><strong>${i.value}</strong></div>`).join("")}
  </div>`;
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "config" }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const now = new Date();
  const summary: Record<string, { candidates: number; sent: number; skipped: number }> = {
    trial_day5: { candidates: 0, sent: 0, skipped: 0 },
    trial_day7: { candidates: 0, sent: 0, skipped: 0 },
    trial_day10: { candidates: 0, sent: 0, skipped: 0 },
  };

  // Fetch trial-ish profiles: have an expiry, not lifetime
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, subscription_status, premium_expires_at, is_lifetime_premium")
    .not("premium_expires_at", "is", null)
    .eq("is_lifetime_premium", false);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  for (const p of profiles ?? []) {
    if (!p.email || !p.premium_expires_at) continue;

    // Skip suppressed (unsubscribed/bounced)
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email")
      .eq("email", p.email)
      .maybeSingle();
    if (suppressed) continue;

    const diff = dayDiff(new Date(p.premium_expires_at), now);

    let key: "trial_day5" | "trial_day7" | "trial_day10" | null = null;
    if (diff === 2) key = "trial_day5";
    else if (diff === 0) key = "trial_day7";
    else if (diff === -3) key = "trial_day10";
    if (!key) continue;

    // Day10 only if not currently premium
    if (key === "trial_day10" && p.subscription_status === "premium") {
      summary[key].skipped++;
      continue;
    }

    summary[key].candidates++;

    // Dedup
    const { data: existing } = await supabase
      .from("lifecycle_emails_sent")
      .select("id")
      .eq("user_id", p.user_id)
      .eq("email_key", key)
      .maybeSingle();
    if (existing) { summary[key].skipped++; continue; }

    const firstName = (p.display_name || "").split(" ")[0] || "kompis";

    let subject = "";
    let html = "";
    let text = "";

    if (key === "trial_day5") {
      // Personal stats
      const [{ count: eggDays }, { data: eggSum }, { count: hens }] = await Promise.all([
        supabase.from("egg_logs").select("date", { count: "exact", head: true }).eq("user_id", p.user_id),
        supabase.from("egg_logs").select("count").eq("user_id", p.user_id),
        supabase.from("hens").select("id", { count: "exact", head: true }).eq("user_id", p.user_id).eq("is_active", true),
      ]);
      const totalEggs = (eggSum ?? []).reduce((s: number, r: any) => s + Number(r.count ?? 0), 0);

      subject = "Se vad du hunnit med i Hönsgården 🐔";
      html = shell(
        `Hej ${firstName}!`,
        "Du har två dagar kvar av din provperiod. Här är vad du har gjort hittills:",
        statCard([
          { label: "Loggade ägg", value: String(totalEggs) },
          { label: "Aktiva hönor", value: String(hens ?? 0) },
          { label: "Aktiva dagar", value: String(eggDays ?? 0) },
        ]) + `<p style="font-size:14px;line-height:1.55;color:hsl(22,12%,30%);margin:0 0 8px;">Med <strong>Plus</strong> behåller du Agda (din AI-rådgivare), veckorapporten och ekonomi&shy;översikten.</p>`,
        "Fortsätt med Plus — 19 kr/mån",
        `${APP_URL}/app/premium`,
        "Du får detta som en del av din provperiod på Hönsgården."
      );
      text = `Hej ${firstName}! Du har loggat ${totalEggs} ägg med ${hens ?? 0} hönor. Fortsätt med Plus: ${APP_URL}/app/premium`;
    } else if (key === "trial_day7") {
      subject = "Din provperiod slutar idag";
      html = shell(
        `Hej ${firstName}!`,
        "Din gratisperiod tar slut idag. Imorgon låses Agda, veckorapporten och ekonomi&shy;översikten.",
        `<div style="background:#fff;border:1px solid hsl(22,15%,90%);border-radius:14px;padding:18px 20px;margin:0 0 16px;font-size:14px;color:hsl(22,18%,12%);">
          <div style="margin-bottom:8px;"><strong>19 kr/mån</strong> — månadsvis</div>
          <div><strong>149 kr/år</strong> — spara 79 kr</div>
        </div>
        <p style="font-size:14px;color:hsl(22,12%,30%);margin:0;">Allt du loggat finns kvar — uppgradera när du vill.</p>`,
        "Uppgradera till Plus",
        `${APP_URL}/app/premium`,
        "Du får detta för att din provperiod löper ut idag."
      );
      text = `Hej ${firstName}! Din provperiod slutar idag. 19 kr/mån eller 149 kr/år: ${APP_URL}/app/premium`;
    } else {
      // trial_day10
      subject = "Din hönsdata finns kvar";
      html = shell(
        `Hej ${firstName}!`,
        "Vi ville bara påminna om att all din data — hönor, ägg, hälsa, ekonomi — finns sparad och säker.",
        `<p style="font-size:14px;line-height:1.55;color:hsl(22,12%,30%);margin:0 0 8px;">När du vill, kan du låsa upp allt igen direkt med Plus. Ingen återställning behövs.</p>`,
        "Titta på Plus",
        `${APP_URL}/app/premium`,
        "Du får detta som en sista påminnelse — inga fler mail kring detta."
      );
      text = `Hej ${firstName}! Din hönsdata finns kvar. Lås upp Plus igen: ${APP_URL}/app/premium`;
    }

    const messageId = `${key}-${p.user_id}`;
    const { error: enqErr } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: p.email,
        from: FROM,
        sender_domain: "notify.honsgarden.se",
        subject,
        html,
        text,
        purpose: "transactional",
        label: key,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });
    if (enqErr) {
      console.error("enqueue failed", key, p.user_id, enqErr);
      continue;
    }

    await supabase
      .from("lifecycle_emails_sent")
      .insert({ user_id: p.user_id, email_key: key });

    summary[key].sent++;
  }

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});
