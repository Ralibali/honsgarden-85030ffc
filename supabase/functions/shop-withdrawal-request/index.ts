// Digital ångerrätt – lookup + submit. Publik, ingen auth krävs.
// Använder service_role internt. Strikt CORS via _shared/cors.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateCors, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GENERIC_LOOKUP_ERROR = "Ingen order hittades med de uppgifterna.";
const GENERIC_SUBMIT_ERROR = "Din begäran kunde inte tas emot just nu. Försök igen om en stund.";
const RATE_LIMIT_ERROR = "För många försök. Vänta några minuter och försök igen.";

function makeConfirmationCode(): string {
  // Formaterat "ÅR-XXXX-YYYY" av gemener/siffror. Undvik lätt förväxlade tecken.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n: number) => {
    const arr = new Uint32Array(n);
    crypto.getRandomValues(arr);
    return Array.from(arr, (v) => alphabet[v % alphabet.length]).join("");
  };
  const year = new Date().getUTCFullYear();
  return `HG-${year}-${rand(4)}-${rand(4)}`;
}

function normalizeEmail(e: unknown): string | null {
  if (typeof e !== "string") return null;
  const t = e.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) return null;
  return t;
}

function normalizeOrderNumber(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < 3 || t.length > 64) return null;
  return t;
}

Deno.serve(async (req) => {
  const cors = evaluateCors(req);
  if (req.method === "OPTIONS") {
    return new Response(cors.blocked ? "blocked" : "ok", {
      status: cors.blocked ? 403 : 204,
      headers: cors.headers,
    });
  }
  if (cors.blocked) return jsonResponse({ error: "origin_forbidden" }, 403, cors.headers);
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, cors.headers);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const action = String(body.action ?? "");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Funktion aktiverad? (kunder ska ändå kunna nå gamla ordrar även om butiken senare stängs.)
  const { data: enabledRow } = await supabase
    .from("system_settings").select("value").eq("key", "shop_withdrawal_function_enabled").maybeSingle();
  const enabled = (() => {
    const v = enabledRow?.value as unknown;
    if (typeof v === "boolean") return v;
    const s = String(v ?? "true").replace(/^"|"$/g, "").toLowerCase();
    return s !== "false" && s !== "0";
  })();
  if (!enabled) return jsonResponse({ error: "withdrawal_disabled" }, 503, cors.headers);

  // Enkel rate limiting via rate_limits-tabellen (best effort).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rlKey = `withdrawal:${action}:${ip}`;
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 10 * 60_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("rate_limits").select("id", { head: true, count: "exact" })
      .eq("key", rlKey).gte("created_at", windowStart);
    if ((count ?? 0) >= 20) return jsonResponse({ error: RATE_LIMIT_ERROR }, 429, cors.headers);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("rate_limits").insert({ key: rlKey, created_at: now.toISOString() });
  } catch { /* rate_limits table may not exist – ignore */ }

  if (action === "lookup") {
    const email = normalizeEmail(body.email);
    const orderNumber = normalizeOrderNumber(body.order_number);
    if (!email || !orderNumber) {
      return jsonResponse({ error: GENERIC_LOOKUP_ERROR }, 404, cors.headers);
    }
    const { data: order, error } = await supabase
      .from("shop_orders")
      .select("id, order_number, customer_email, items, status, paid_at, created_at, amount_total_ore, currency")
      .eq("order_number", orderNumber)
      .eq("status", "paid")
      .maybeSingle();
    if (error) {
      console.error("withdrawal.lookup db error", error.message);
      return jsonResponse({ error: GENERIC_LOOKUP_ERROR }, 404, cors.headers);
    }
    if (!order) return jsonResponse({ error: GENERIC_LOOKUP_ERROR }, 404, cors.headers);
    const stored = String(order.customer_email ?? "").trim().toLowerCase();
    if (stored !== email) return jsonResponse({ error: GENERIC_LOOKUP_ERROR }, 404, cors.headers);

    return jsonResponse({
      ok: true,
      order: {
        order_number: order.order_number,
        paid_at: order.paid_at,
        currency: order.currency,
        amount_total_ore: order.amount_total_ore,
        items: Array.isArray(order.items) ? order.items : [],
      },
    }, 200, cors.headers);
  }

  if (action === "submit") {
    const email = normalizeEmail(body.email);
    const orderNumber = normalizeOrderNumber(body.order_number);
    const receiptMethod = body.receipt_method === "email" ? "email" : body.receipt_method === "screen" ? "screen" : null;
    const items = Array.isArray(body.items) ? body.items : null;
    const message = typeof body.message === "string" ? body.message.slice(0, 2000).trim() : "";
    if (!email || !orderNumber || !receiptMethod || !items || items.length === 0) {
      return jsonResponse({ error: "Ofullständig begäran. Fyll i alla fält och välj minst en produkt." }, 400, cors.headers);
    }

    const { data: order, error } = await supabase
      .from("shop_orders")
      .select("id, order_number, customer_email, items, status")
      .eq("order_number", orderNumber).eq("status", "paid").maybeSingle();
    if (error || !order) return jsonResponse({ error: GENERIC_LOOKUP_ERROR }, 404, cors.headers);
    if (String(order.customer_email ?? "").trim().toLowerCase() !== email) {
      return jsonResponse({ error: GENERIC_LOOKUP_ERROR }, 404, cors.headers);
    }

    // Snapshot: bara giltiga rader mot orderns items
    const orderItems = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
    const snapshot: Array<Record<string, unknown>> = [];
    for (const req of items) {
      if (!req || typeof req !== "object") continue;
      const line_id = String((req as Record<string, unknown>).line_id ?? "");
      const qty = Math.max(1, Math.floor(Number((req as Record<string, unknown>).quantity ?? 0)));
      const match = orderItems.find((it) => String(it.line_id ?? it.product_id ?? "") === line_id) ?? orderItems.find((it) => String(it.product_id) === line_id);
      if (!match) continue;
      const maxQty = Math.max(1, Math.floor(Number(match.quantity ?? 1)));
      snapshot.push({
        line_id,
        product_id: match.product_id,
        variant_id: match.variant_id ?? null,
        name: match.name,
        quantity: Math.min(qty, maxQty),
        unit_price_ore: match.unit_price_ore ?? match.price_ore ?? null,
      });
    }
    if (snapshot.length === 0) {
      return jsonResponse({ error: "Ingen giltig produkt vald att ångra." }, 400, cors.headers);
    }

    // Duplikat inom 24h: samma order + samma val
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("shop_withdrawal_requests")
      .select("id, confirmation_code, requested_items, requested_at")
      .eq("order_id", order.id).gte("requested_at", since).limit(10);
    const sameSignature = (existing ?? []).find((r: { requested_items: unknown }) => {
      try {
        const a = JSON.stringify(r.requested_items);
        const b = JSON.stringify(snapshot);
        return a === b;
      } catch { return false; }
    });
    if (sameSignature) {
      return jsonResponse({
        ok: true,
        duplicate: true,
        confirmation_code: sameSignature.confirmation_code,
        received_at: sameSignature.requested_at,
        message: "En likadan begäran är redan mottagen. Vi använder din tidigare bekräftelsekod.",
      }, 200, cors.headers);
    }

    const code = makeConfirmationCode();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insErr } = await (supabase as any)
      .from("shop_withdrawal_requests")
      .insert({
        confirmation_code: code,
        order_id: order.id,
        order_number: order.order_number,
        customer_email: email,
        requested_items: snapshot,
        customer_message: message || null,
        receipt_method: receiptMethod,
        status: "received",
      })
      .select("id, confirmation_code, requested_at")
      .single();
    if (insErr || !inserted) {
      console.error("withdrawal.submit insert error", insErr?.message);
      return jsonResponse({ error: GENERIC_SUBMIT_ERROR }, 500, cors.headers);
    }

    // E-postkvitto: använd befintlig transactional-email-kö om den finns.
    let emailSent = false; let emailFallback = false;
    if (receiptMethod === "email") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpc = await (supabase as any).rpc("enqueue_email", {
          _template: "shop-withdrawal-receipt",
          _to: email,
          _data: {
            confirmation_code: inserted.confirmation_code,
            order_number: order.order_number,
            requested_at: inserted.requested_at,
            items: snapshot,
            message: message || null,
          },
          _idempotency_key: `withdrawal:${inserted.confirmation_code}`,
        });
        if (rpc.error) throw rpc.error;
        emailSent = true;
      } catch (e) {
        console.error("withdrawal.email enqueue failed, falling back to screen receipt", (e as Error).message);
        emailFallback = true;
      }
    }

    return jsonResponse({
      ok: true,
      confirmation_code: inserted.confirmation_code,
      received_at: inserted.requested_at,
      order_number: order.order_number,
      items: snapshot,
      customer_message: message || null,
      email_sent: emailSent,
      email_fallback: emailFallback,
      receipt_method: emailFallback ? "screen" : receiptMethod,
    }, 200, cors.headers);
  }

  return jsonResponse({ error: "unknown_action" }, 400, cors.headers);
});
