import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const MAX_BODY_BYTES = 16_000;
const buckets = new Map<string, { count: number; reset: number }>();

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.reset <= now) {
    buckets.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 30;
}

function safeContext(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 4_000) return { truncated: true };
    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (rateLimited(ip)) return json({ ok: false, throttled: true }, 429, { "Retry-After": "60" });

  try {
    const body = await req.json();
    const level = ["error", "warning", "info"].includes(body?.level) ? body.level : "error";
    const message = String(body?.message ?? "").trim().slice(0, 2_000);
    if (!message) return json({ error: "message required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Backend not configured" }, 500);

    let verifiedUserId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ") && anonKey) {
      try {
        const authClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        });
        const { data: { user } } = await authClient.auth.getUser();
        verifiedUserId = user?.id ?? null;
      } catch {
        verifiedUserId = null;
      }
    }

    let clientTs: string | null = null;
    if (body?.ts) {
      const parsed = new Date(body.ts);
      if (!Number.isNaN(parsed.getTime())) clientTs = parsed.toISOString();
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { error } = await admin.from("client_error_logs").insert({
      level,
      message,
      stack: body?.stack ? String(body.stack).slice(0, 8_000) : null,
      url: body?.url ? String(body.url).slice(0, 1_000) : null,
      user_agent: body?.ua ? String(body.ua).slice(0, 500) : null,
      user_id: verifiedUserId,
      build_time: body?.buildTime ? String(body.buildTime).slice(0, 100) : null,
      context: safeContext(body?.context),
      client_ts: clientTs,
    });

    if (error) {
      console.error("[log-client-error] insert failed", error.message);
      return json({ ok: false, error: "Could not store error" }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("[log-client-error] invalid payload", error);
    return json({ ok: false, error: "Invalid payload" }, 400);
  }
});
