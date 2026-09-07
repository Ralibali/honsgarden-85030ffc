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
): Promise<boolean> {
  if (!order.customer_email) {
    console.error("[digital] receipt skipped: no verified email", order.id);
    return false;
  }

  // Idempotensspärr: bara den första lyckade uppdateringen får skicka.
  const messageId = `digital-receipt-${order.id}`;
  const { data: claimed, error: claimError } = await admin
    .from("digital_orders")
    .update({ receipt_message_id: messageId })
    .eq("id", order.id)
    .is("receipt_sent_at", null)
    .is("receipt_message_id", null)
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("[digital] receipt claim failed", claimError.message);
    return false;
  }
  if (!claimed) return false; // redan skickat eller pågår

  const token = await issueAccessToken(admin, order.id, "email");
  if (!token) {
    await admin.from("digital_orders").update({ receipt_message_id: null }).eq("id", order.id);
    return false;
  }

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

  const { error: queueError } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
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

  if (queueError) {
    console.error("[digital] receipt enqueue failed", queueError.message);
    // Släpp spärren så att nästa webhookförsök kan skicka igen.
    await admin.from("digital_orders").update({ receipt_message_id: null }).eq("id", order.id);
    return false;
  }

  await admin
    .from("digital_orders")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", order.id);
  return true;
}
