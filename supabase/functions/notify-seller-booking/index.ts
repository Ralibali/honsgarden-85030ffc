// Notifies the seller when someone books eggs via Agdas bod.
// Called from the public booking page right after a booking row is inserted.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.lovable.app";
const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      listing_id,
      seller_user_id,
      customer_name,
      customer_email,
      customer_phone,
      customer_message,
      packs,
      pickup_slot_id,
      pickup_person_name,
      pickup_person_phone,
    } = body ?? {};

    if (!listing_id || !seller_user_id || !customer_name || !packs) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Seller email & name
    const { data: seller } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("user_id", seller_user_id)
      .maybeSingle();

    if (!seller?.email) {
      return new Response(JSON.stringify({ skipped: "no_seller_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Listing title & pack size
    const { data: listing } = await supabase
      .from("public_egg_sale_listings")
      .select("title, pack_size, price_per_pack")
      .eq("id", listing_id)
      .maybeSingle();

    const title = listing?.title || "Din äggförsäljning";
    const packSize = listing?.pack_size ?? 12;

    // Optional pickup slot
    let slotText = "Enligt överenskommelse";
    if (pickup_slot_id) {
      const { data: slot } = await supabase
        .from("egg_sale_pickup_slots")
        .select("starts_at, ends_at")
        .eq("id", pickup_slot_id)
        .maybeSingle();
      if (slot?.starts_at) {
        const start = new Date(slot.starts_at).toLocaleString("sv-SE", {
          timeZone: "Europe/Stockholm",
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        });
        const end = slot.ends_at
          ? new Date(slot.ends_at).toLocaleString("sv-SE", {
              timeZone: "Europe/Stockholm",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        slotText = end ? `${start}–${end}` : start;
      }
    }

    const sellerName = seller.display_name || seller.email.split("@")[0] || "Hönsägare";
    const amount = listing?.price_per_pack
      ? `${Math.round(Number(listing.price_per_pack) * Number(packs))} kr`
      : null;
    const messageId = `seller-booking-${listing_id}-${Date.now()}`;
    const subject = `Ny bokning i Agdas bod: ${customer_name} (${packs} st)`;

    const dashLink = `${APP_URL}/app/egg-sales`;

    const html =
      `<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px; background:#ffffff;">` +
      `<img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin:0 0 24px;" />` +
      `<h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 12px;">Du har en ny bokning 🥚</h1>` +
      `<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Hej ${esc(sellerName)}! <strong>${esc(customer_name)}</strong> har precis bokat <strong>${esc(String(packs))} ${packSize}-pack</strong> via din säljsida <strong>${esc(title)}</strong>.</p>` +
      `<div style="background: hsl(35,32%,97%); border: 1px solid hsl(22,15%,90%); border-radius: 14px; padding: 18px 20px; margin: 0 0 20px;">` +
      `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Kund</p>` +
      `<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">${esc(customer_name)}</p>` +
      (customer_phone
        ? `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Telefon</p>` +
          `<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);">${esc(customer_phone)}</p>`
        : "") +
      (customer_email
        ? `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">E-post</p>` +
          `<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);">${esc(customer_email)}</p>`
        : "") +
      `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtningstid</p>` +
      `<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">${esc(slotText)}</p>` +
      (pickup_person_name
        ? `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Annan hämtare</p>` +
          `<p style="margin:0 0 14px;font-size:14px;color:hsl(22,18%,12%);">${esc(pickup_person_name)}${pickup_person_phone ? ` (${esc(pickup_person_phone)})` : ""}</p>`
        : "") +
      (amount
        ? `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Belopp</p>` +
          `<p style="margin:0 0 14px;font-size:18px;color:hsl(22,18%,12%);font-weight:700;">${amount}</p>`
        : "") +
      (customer_message
        ? `<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Meddelande från kunden</p>` +
          `<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);white-space:pre-wrap;">${esc(customer_message)}</p>`
        : "") +
      `</div>` +
      `<a href="${dashLink}" style="display:inline-block;background:hsl(142,32%,34%);color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;">Öppna Agdas bod →</a>` +
      `<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att någon bokat ägg via din publika säljsida på Hönsgården.</p>` +
      `</div>`;

    const text =
      `Ny bokning i Agdas bod!\n\n` +
      `${customer_name} har bokat ${packs} ${packSize}-pack via "${title}".\n` +
      (customer_phone ? `Telefon: ${customer_phone}\n` : "") +
      (customer_email ? `E-post: ${customer_email}\n` : "") +
      `Hämtning: ${slotText}\n` +
      (amount ? `Belopp: ${amount}\n` : "") +
      (customer_message ? `\nMeddelande: ${customer_message}\n` : "") +
      `\nÖppna: ${dashLink}`;

    const { error: enqErr } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        run_id: crypto.randomUUID(),
        to: seller.email,
        from: "Hönsgården <noreply@notify.honsgarden.se>",
        sender_domain: "notify.honsgarden.se",
        subject,
        html,
        text,
        purpose: "transactional",
        label: "seller-booking",
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqErr) {
      console.error("enqueue failed", enqErr);
      return new Response(JSON.stringify({ error: "enqueue_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-seller-booking error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
