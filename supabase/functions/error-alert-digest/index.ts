// Skickar mejl till admin när nya klientfel loggats.
// Körs var 15:e minut via cron och grupperar onotifierade fel.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "info@auroramedia.se";
const SPIKE_THRESHOLD = 10; // antal fel inom intervall för "spike"-rubrik

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Intern cron-trigger — verify_jwt=false. Värsta scenariot vid spam är att
  // admin får en extra mejl OM det finns onotifierade fel; annars no-op.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
    { auth: { persistSession: false } },
  );

  try {
    const { data: rows, error } = await supabase
      .from("client_error_logs")
      .select("id, level, message, url, user_id, created_at, stack")
      .eq("notified", false)
      .eq("level", "error")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gruppera per meddelande
    const grouped = new Map<string, { count: number; sample: typeof rows[number] }>();
    for (const r of rows) {
      const key = r.message.slice(0, 200);
      const g = grouped.get(key);
      if (g) g.count += 1;
      else grouped.set(key, { count: 1, sample: r });
    }

    const total = rows.length;
    const uniqueUsers = new Set(rows.map((r) => r.user_id).filter(Boolean)).size;
    const isSpike = total >= SPIKE_THRESHOLD;
    const subject = isSpike
      ? `🚨 ${total} klientfel hos Hönsgården (${grouped.size} unika)`
      : `⚠️ ${total} nya klientfel hos Hönsgården`;

    const groupsHtml = Array.from(grouped.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([msg, g]) => `
        <div style="border-left:3px solid hsl(15,68%,55%);padding:8px 12px;margin:8px 0;background:#fafafa;">
          <div style="font-size:13px;color:#1a1a1a;font-weight:600;">${escapeHtml(msg)}</div>
          <div style="font-size:12px;color:#777;margin-top:4px;">
            ${g.count}× • ${escapeHtml(g.sample.url ?? "")}
          </div>
        </div>
      `)
      .join("");

    const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:640px;padding:30px 25px;">
  <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 16px;">
    ${isSpike ? "🚨 Felspike upptäckt" : "⚠️ Nya klientfel"}
  </h1>
  <p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.6;">
    <strong>${total}</strong> fel från <strong>${uniqueUsers || "okända"}</strong> användare,
    fördelat på <strong>${grouped.size}</strong> unika meddelanden.
  </p>
  <h2 style="font-size:15px;color:hsl(22,18%,12%);margin:20px 0 8px;">Vanligaste felen</h2>
  ${groupsHtml}
  <p style="font-size:12px;color:#999;margin:24px 0 0;">
    Se alla detaljer i Admin → Fel-loggar.
  </p>
</div>`;

    await supabase.rpc("enqueue_email", {
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

    // Markera som notifierade
    const ids = rows.map((r) => r.id);
    await supabase.from("client_error_logs").update({ notified: true }).in("id", ids);

    return new Response(JSON.stringify({ ok: true, sent: 1, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[error-alert-digest] failed", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
