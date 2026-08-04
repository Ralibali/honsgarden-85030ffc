import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const ADMIN_EMAIL = "info@auroramedia.se";
const SPIKE_THRESHOLD = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request, serviceRoleKey: string) {
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  return (
    (!!serviceRoleKey && bearer === serviceRoleKey) ||
    (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret)
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Backend not configured" }, 500);
  if (!isAuthorized(req, serviceRoleKey)) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const { data: rows, error } = await supabase
      .from("client_error_logs")
      .select("id, level, message, url, user_id, created_at, stack")
      .eq("notified", false)
      .eq("level", "error")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!rows?.length) return json({ ok: true, sent: 0 });

    const grouped = new Map<string, { count: number; sample: typeof rows[number] }>();
    for (const row of rows) {
      const key = String(row.message || "Okänt fel").slice(0, 200);
      const group = grouped.get(key);
      if (group) group.count += 1;
      else grouped.set(key, { count: 1, sample: row });
    }

    const total = rows.length;
    const uniqueUsers = new Set(rows.map((row) => row.user_id).filter(Boolean)).size;
    const isSpike = total >= SPIKE_THRESHOLD;
    const subject = isSpike
      ? `🚨 ${total} klientfel hos Hönsgården (${grouped.size} unika)`
      : `⚠️ ${total} nya klientfel hos Hönsgården`;

    const groupsHtml = Array.from(grouped.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([message, group]) => `
        <div style="border-left:3px solid #d9694f;padding:8px 12px;margin:8px 0;background:#fafafa;">
          <div style="font-size:13px;color:#1a1a1a;font-weight:600;">${escapeHtml(message)}</div>
          <div style="font-size:12px;color:#777;margin-top:4px;">
            ${group.count}× • ${escapeHtml(group.sample.url ?? "")}
          </div>
        </div>
      `)
      .join("");

    const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:640px;padding:30px 25px;">
  <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:#2a241e;margin:0 0 16px;">
    ${isSpike ? "🚨 Felspike upptäckt" : "⚠️ Nya klientfel"}
  </h1>
  <p style="font-size:14px;color:#75685e;line-height:1.6;">
    <strong>${total}</strong> fel från <strong>${uniqueUsers || "okända"}</strong> användare,
    fördelat på <strong>${grouped.size}</strong> unika meddelanden.
  </p>
  <h2 style="font-size:15px;color:#2a241e;margin:20px 0 8px;">Vanligaste felen</h2>
  ${groupsHtml}
  <p style="font-size:12px;color:#999;margin:24px 0 0;">Se alla detaljer i Admin → Fel-loggar.</p>
</div>`;

    const { error: queueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: ADMIN_EMAIL,
        from: "Hönsgården <noreply@notify.honsgarden.se>",
        sender_domain: "notify.honsgarden.se",
        subject,
        html,
        text: `${total} nya klientfel hos Hönsgården. Se admin för detaljer.`,
        purpose: "transactional",
        label: "error-alert-digest",
        message_id: `err-${Date.now()}`,
        queued_at: new Date().toISOString(),
      },
    });
    if (queueError) throw queueError;

    const ids = rows.map((row) => row.id);
    const { error: markError } = await supabase
      .from("client_error_logs")
      .update({ notified: true })
      .in("id", ids)
      .eq("notified", false);
    if (markError) throw markError;

    return json({ ok: true, sent: 1, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[error-alert-digest] failed", message);
    return json({ ok: false, error: "Digest failed" }, 500);
  }
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
