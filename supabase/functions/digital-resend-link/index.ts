// Återhämtning: skickar en ny nedladdningslänk till orderns verifierade e-post.
// Svarar alltid neutralt (ingen kontoläckage) och skickar bara till betalda ordrar.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { evaluateCors, jsonResponse } from "../_shared/cors.ts";
import { getDigitalProduct, SELLER, formatSek } from "../_shared/digitalProduct.ts";
import { deliveryUrl, issueAccessToken } from "../_shared/digitalReceipt.ts";

const NEUTRAL = {
  ok: true,
  message: "Om det finns ett köp kopplat till adressen skickar vi nedladdningslänken dit.",
};
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FROM_DOMAIN = "notify.honsgarden.se";

serve(async (req) => {
  const cors = evaluateCors(req);
  if (req.method === "OPTIONS") {
    if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
    return new Response(null, { headers: cors.headers });
  }
  if (cors.blocked) return jsonResponse({ error: "Origin ej tillåten" }, 403, cors.headers);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors.headers);

  const h = cors.headers;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(NEUTRAL, 200, h);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return jsonResponse({ error: "Ange en giltig e-postadress." }, 400, h);
    }

    const { data: orders } = await admin
      .from("digital_orders")
      .select("id, order_number, product_slug, customer_email, amount_ore, status, refunded_at, created_at")
      .ilike("customer_email", email)
      .eq("status", "paid")
      .is("refunded_at", null)
      .order("created_at", { ascending: false })
      .limit(3);

    for (const order of orders ?? []) {
      const product = getDigitalProduct(order.product_slug);
      if (!product || !order.customer_email) continue;
      const token = await issueAccessToken(admin, order.id, "resend");
      if (!token) continue;
      const link = deliveryUrl(product, token);

      const { error: queueError } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: order.customer_email,
          from: `Hönsgården <noreply@${FROM_DOMAIN}>`,
          sender_domain: FROM_DOMAIN,
          subject: `Din nedladdningslänk – Mina första höns (${order.order_number})`,
          html: `<!DOCTYPE html><html lang="sv"><body style="margin:0;background:#faf8f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2b2b26">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#3a6b35;margin:0 0 16px">Hönsgården</p>
    <h1 style="font-size:24px;margin:0 0 12px">Här är din länk igen</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 20px">Order ${order.order_number} – Mina första höns (${formatSek(order.amount_ore)} inkl. moms).</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#3a6b35;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600">Ladda ner PDF:en</a></p>
    <p style="font-size:13px;color:#6b6b5f;line-height:1.6;margin:0">${SELLER.name}, org.nr ${SELLER.orgNumber} · ${SELLER.supportEmail}</p>
  </div></body></html>`,
          text: `Din nedladdningslänk för Mina första höns (order ${order.order_number}): ${link}`,
          purpose: "transactional",
          label: "digital-resend-link",
          message_id: `digital-resend-${order.id}-${Date.now()}`,
          queued_at: new Date().toISOString(),
        },
      });
      if (queueError) console.error("[digital-resend-link] enqueue failed", queueError.message);
    }

    return jsonResponse(NEUTRAL, 200, h);
  } catch (error) {
    console.error("[digital-resend-link]", error instanceof Error ? error.message : String(error));
    return jsonResponse(NEUTRAL, 200, h);
  }
});
