// Public egg alerts – anonymous signups with double opt-in via Brevo.
// - POST /public-egg-alert { email, ort_slug?, ort_name?, source?, utm? }
//     Creates/updates row, sends confirmation email. Returns { ok: true }.
// - GET  /public-egg-alert?action=confirm&token=... → HTML thank-you page.
// - GET  /public-egg-alert?action=unsubscribe&token=... → HTML unsubscribed page.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BREVO_SENDER_EMAIL = "notify@notify.honsgarden.se";
const BREVO_SENDER_NAME = "Hönsgården";
const APP_ORIGIN = Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://honsgarden.se";

const SubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  ort_slug: z.string().trim().max(80).optional().nullable(),
  ort_name: z.string().trim().max(120).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
  utm_source: z.string().trim().max(80).optional().nullable(),
  utm_medium: z.string().trim().max(80).optional().nullable(),
  utm_campaign: z.string().trim().max(80).optional().nullable(),
  // Honeypot – legitimate clients never fill these. Bots often do.
  website: z.string().max(200).optional().nullable(),
  hp_field: z.string().max(200).optional().nullable(),
});

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

async function checkRateLimit(supabase: any, ip: string): Promise<boolean> {
  // Bucket window to the current hour so rate_limits.window_start collapses per IP+hour.
  const windowStart = new Date(Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS).toISOString();
  // rate_limits.user_id is UUID – hash IP to a deterministic UUIDv5-ish value via md5.
  const enc = new TextEncoder().encode(`egg-alert:${ip}`);
  const hash = await crypto.subtle.digest("MD5", enc).catch(() => crypto.subtle.digest("SHA-1", enc));
  const bytes = new Uint8Array(hash).slice(0, 16);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const pseudoUserId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("id, request_count")
    .eq("user_id", pseudoUserId)
    .eq("function_name", "public-egg-alert")
    .eq("window_start", windowStart)
    .maybeSingle();

  if (existing) {
    if (existing.request_count >= RATE_LIMIT_MAX) return false;
    await supabase
      .from("rate_limits")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id);
    return true;
  }
  await supabase.from("rate_limits").insert({
    user_id: pseudoUserId,
    function_name: "public-egg-alert",
    window_start: windowStart,
    request_count: 1,
  });
  return true;
}


async function sendConfirmationEmail(params: {
  email: string;
  ortName: string | null;
  verifyToken: string;
  unsubscribeToken: string;
}) {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

  const confirmUrl = `${APP_ORIGIN}/functions/v1/public-egg-alert?action=confirm&token=${encodeURIComponent(params.verifyToken)}`;
  const unsubUrl = `${APP_ORIGIN}/functions/v1/public-egg-alert?action=unsubscribe&token=${encodeURIComponent(params.unsubscribeToken)}`;
  const ortLine = params.ortName
    ? `nära <strong>${escapeHtml(params.ortName)}</strong>`
    : `nära dig`;

  const html = `
<!doctype html>
<html><body style="margin:0;padding:0;background:#faf8f4;font-family:Inter,Arial,sans-serif;color:#2b2b2b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eae4d7;border-radius:16px;overflow:hidden">
        <tr><td style="padding:32px 32px 8px;font-family:'Young Serif',Georgia,serif;font-size:24px;color:#3A6B35">🥚 Bekräfta din notis</td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:15px;line-height:1.55">
          Tack! Klicka på knappen nedan så börjar vi mejla dig när det finns färska ägg till salu ${ortLine}.
        </td></tr>
        <tr><td align="center" style="padding:24px 32px 8px">
          <a href="${confirmUrl}" style="display:inline-block;background:#3A6B35;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600">Bekräfta min e-post</a>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;font-size:12px;color:#6b6b6b;line-height:1.5">
          Har du inte bett om det här? Ignorera mejlet – ingen prenumeration skapas utan bekräftelse.
        </td></tr>
        <tr><td style="padding:16px 32px 24px;font-size:11px;color:#9a9a9a;border-top:1px solid #f0ebde">
          Hönsgården – karta över lokala äggsäljare i Sverige. <br/>
          Vill du inte höra av oss alls? <a href="${unsubUrl}" style="color:#9a9a9a">Avregistrera</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: params.email }],
      subject: params.ortName
        ? `Bekräfta din äggnotis för ${params.ortName} 🥚`
        : "Bekräfta din äggnotis 🥚",
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${res.status}: ${text}`);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

function htmlPage(title: string, body: string) {
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:#faf8f4;color:#2b2b2b;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;max-width:480px;width:100%;padding:32px;border-radius:16px;border:1px solid #eae4d7;box-shadow:0 4px 24px rgba(0,0,0,.04)}
h1{font-family:'Young Serif',Georgia,serif;color:#3A6B35;margin:0 0 12px;font-size:24px}
p{line-height:1.55;font-size:15px}
a.btn{display:inline-block;margin-top:16px;background:#3A6B35;color:#fff;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:600}
</style></head><body><div class="card">${body}</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // GET-flöden: confirm / unsubscribe → HTML-svar
  if (req.method === "GET") {
    const action = url.searchParams.get("action");
    const token = url.searchParams.get("token") ?? "";
    if (action === "confirm") {
      const { data, error } = await supabase.rpc("confirm_public_egg_alert", { p_token: token });
      if (error || !(data as any)?.ok) {
        return new Response(
          htmlPage("Länken gick inte att bekräfta", `<h1>Något gick fel</h1><p>Länken är ogiltig eller redan använd. Skriv gärna till info@auroramedia.se om du behöver hjälp.</p><a class="btn" href="${APP_ORIGIN}/karta">Till äggkartan</a>`),
          { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
      const ort = (data as any)?.ort_name ? ` nära <strong>${escapeHtml((data as any).ort_name)}</strong>` : "";
      return new Response(
        htmlPage("Bekräftat!", `<h1>Tack – du är påslagen!</h1><p>Vi hör av oss så fort det finns färska ägg till salu${ort}. 🥚</p><p style="font-size:13px;color:#6b6b6b;margin-top:16px">Vill du redan nu se vilka som säljer ägg i Sverige?</p><a class="btn" href="${APP_ORIGIN}/karta">Öppna äggkartan</a>`),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    if (action === "unsubscribe") {
      await supabase.rpc("unsubscribe_public_egg_alert", { p_token: token });
      return new Response(
        htmlPage("Avregistrerad", `<h1>Du är avregistrerad</h1><p>Vi mejlar dig inte fler äggnotiser. Ändrar du dig är du välkommen tillbaka när som helst.</p><a class="btn" href="${APP_ORIGIN}/karta">Till äggkartan</a>`),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ ok: false, error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const p = parsed.data;

    const { data, error } = await supabase.rpc("request_public_egg_alert", {
      p_email: p.email,
      p_ort_slug: p.ort_slug ?? null,
      p_ort_name: p.ort_name ?? null,
      p_source: p.source ?? null,
      p_utm_source: p.utm_source ?? null,
      p_utm_medium: p.utm_medium ?? null,
      p_utm_campaign: p.utm_campaign ?? null,
    });
    if (error || !(data as any)?.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: (data as any)?.reason ?? error?.message ?? "unknown" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const row = data as {
      id: string;
      verify_token: string;
      already_verified: boolean;
      email: string;
      ort_name: string | null;
    };

    if (!row.already_verified) {
      // Behöver även hämta unsubscribe_token
      const { data: full } = await supabase
        .from("public_egg_alerts")
        .select("unsubscribe_token")
        .eq("id", row.id)
        .maybeSingle();
      try {
        await sendConfirmationEmail({
          email: row.email,
          ortName: row.ort_name,
          verifyToken: row.verify_token,
          unsubscribeToken: (full as any)?.unsubscribe_token ?? "",
        });
      } catch (err) {
        console.error("[public-egg-alert] confirmation email failed", (err as Error).message);
        return new Response(
          JSON.stringify({ ok: false, error: "email_send_failed" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, already_verified: row.already_verified }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[public-egg-alert] fatal", (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
