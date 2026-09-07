// Orderbekräftelse för digitala köp. Köar via befintlig pgmq/enqueue_email.
// Endast orderns verifierade e-post används. Idempotent: receipt_sent_at sätts
// med villkor så att upprepade webhookanrop inte ger dubbla mejl.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

import {
  DigitalProductConfig,
  SELLER,
  createAccessToken,
  formatSek,
  hashAccessToken,
  vatBreakdown,
} from "./digitalProduct.ts";

export interface ReceiptResult {
  /** true när kvittot köades i detta anrop eller redan var skickat. */
  ok: boolean;
  queued: boolean;
  reason?: string;
}

const FROM_DOMAIN = "notify.honsgarden.se";
const SITE = "https://honsgarden.se";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

export async function issueAccessToken(
  admin: Admin,
  orderId: string,
  source: "email" | "thankyou" | "resend",
): Promise<string | null> {
  const token = createAccessToken();
  const tokenHash = await hashAccessToken(token);
  const { error } = await admin.from("digital_access_tokens").insert({
    order_id: orderId,
    token_hash: tokenHash,
    source,
  });
  if (error) {
    console.error("[digital] token insert failed", error.message);
    return null;
  }
  return token;
}

export function deliveryUrl(product: DigitalProductConfig, token: string): string {
  return `${SITE}${product.deliveryPath}?t=${token}`;
}

interface ReceiptOrder {
  id: string;
  order_number: string;
  customer_email: string | null;
  amount_ore: number;
  vat_rate: number;
  consent_terms_version: string | null;
  consent_at: string | null;
  paid_at: string | null;
}

/**
 * Skickar orderbekräftelse med beständig nedladdningslänk.
 * Returnerar true om ett mejl köades i detta anrop.
 */
export async function sendDigitalReceipt(
  admin: Admin,
  order: ReceiptOrder,
  product: DigitalProductConfig,
): Promise<ReceiptResult> {
  if (!order.customer_email) {
    console.error("[digital] receipt skipped: no verified email", order.id);
    return { ok: false, queued: false, reason: "missing_email" };
  }

  const messageId = `digital-receipt-${order.id}`;
  const token = createAccessToken();
  const tokenHash = await hashAccessToken(token);
  const link = deliveryUrl(product, token);
  const { netOre, vatOre } = vatBreakdown(order.amount_ore, Number(order.vat_rate ?? 0.06));
  const vatPercent = Math.round(Number(order.vat_rate ?? 0.06) * 100);

  const html = `<!DOCTYPE html><html lang="sv"><body style="margin:0;background:#faf8f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2b2b26">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#3a6b35;margin:0 0 16px">Hönsgården</p>
    <h1 style="font-size:26px;line-height:1.25;margin:0 0 12px">Tack för ditt köp!</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 20px">Din guide <strong>Mina första höns</strong> är klar att ladda ner. Spara det här mejlet – länken fungerar även senare om du behöver hämta filen igen.</p>
    <p style="margin:0 0 28px"><a href="${link}" style="display:inline-block;background:#3a6b35;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600">Ladda ner PDF:en</a></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;background:#ffffff;border:1px solid #e6e0d4;border-radius:10px">
      <tr><td style="padding:10px 14px;color:#6b6b5f">Ordernummer</td><td style="padding:10px 14px;text-align:right">${escapeHtml(order.order_number)}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b6b5f">Produkt</td><td style="padding:10px 14px;text-align:right">Mina första höns (PDF, 24 sidor)</td></tr>
      <tr><td style="padding:10px 14px;color:#6b6b5f">Pris inkl. moms</td><td style="padding:10px 14px;text-align:right">${formatSek(order.amount_ore)}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b6b5f">Varav moms (${vatPercent}%)</td><td style="padding:10px 14px;text-align:right">${formatSek(vatOre)}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b6b5f">Exkl. moms</td><td style="padding:10px 14px;text-align:right">${formatSek(netOre)}</td></tr>
    </table>
    <p style="font-size:13px;line-height:1.6;color:#6b6b5f;margin:22px 0 0">Du godkände vid köpet (villkorsversion ${escapeHtml(order.consent_terms_version ?? product.termsVersion)}${order.consent_at ? `, ${escapeHtml(new Date(order.consent_at).toLocaleString("sv-SE"))}` : ""}) att filen levereras omedelbart och att ångerrätten därmed upphör. Reklamationsrätten gäller som vanligt.</p>
    <p style="font-size:13px;line-height:1.6;color:#6b6b5f;margin:14px 0 0">Guiden är ett separat köp och innehåller inte Hönsgården Plus.</p>
    <p style="font-size:13px;line-height:1.6;color:#6b6b5f;margin:14px 0 0">Säljare: ${SELLER.name}, org.nr ${SELLER.orgNumber}, ${SELLER.address}. Frågor? Svara på detta mejl eller skriv till ${SELLER.supportEmail}.</p>
  </div></body></html>`;

  const text = [
    "Tack för ditt köp!",
    "",
    `Ladda ner Mina första höns: ${link}`,
    `Ordernummer: ${order.order_number}`,
    `Pris: ${formatSek(order.amount_ore)} inkl. moms (varav moms ${formatSek(vatOre)})`,
    "",
    "Du godkände att filen levereras omedelbart och att ångerrätten därmed upphör. Reklamationsrätten gäller som vanligt.",
    "Guiden är ett separat köp och innehåller inte Hönsgården Plus.",
    `${SELLER.name}, org.nr ${SELLER.orgNumber}, ${SELLER.address}, ${SELLER.supportEmail}`,
  ].join("\n");

  // En transaktion i databasen: skapa länken, köa mejlet och sätt flaggan.
  // Misslyckas något rullas allt tillbaka, så vi får aldrig en order som är
  // markerad som "kvitto skickat" utan att mejlet ligger i kön.
  const { data, error } = await admin.rpc("digital_issue_receipt", {
    p_order_id: order.id,
    p_token_hash: tokenHash,
    p_message_id: messageId,
    p_payload: {
      to: order.customer_email,
      from: `Hönsgården <noreply@${FROM_DOMAIN}>`,
      sender_domain: FROM_DOMAIN,
      subject: `Din guide Mina första höns (${order.order_number})`,
      html,
      text,
      purpose: "transactional",
      label: "digital-order-receipt",
      message_id: messageId,
      queued_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.error("[digital] receipt transaction failed", error.message);
    return { ok: false, queued: false, reason: "transaction_failed" };
  }

  const result = (data ?? {}) as { ok?: boolean; already_sent?: boolean; reason?: string };
  if (!result.ok) {
    console.error("[digital] receipt refused", result.reason, order.id);
    return { ok: false, queued: false, reason: result.reason };
  }
  return { ok: true, queued: !result.already_sent };
}
