// Daily review request email for buyers who picked up eggs 1-7 days ago.
// Runs via pg_cron. Idempotent via review_request_sent_at stamp.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const APP_URL = "https://honsgarden.lovable.app";
const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKeyAuth = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (provided !== serviceKeyAuth && !okSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!serviceKeyAuth) {
    return new Response(JSON.stringify({ error: "config" }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKeyAuth, { auth: { persistSession: false } });

  const nowMs = Date.now();
  const earliest = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();
  const latest = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const { data: bookings, error: bErr } = await supabase
    .from("public_egg_sale_bookings")
    .select("id, listing_id, seller_user_id, customer_name, customer_email, picked_up_at, review_request_sent_at, status")
    .not("picked_up_at", "is", null)
    .gte("picked_up_at", earliest)
    .lte("picked_up_at", latest)
    .is("review_request_sent_at", null)
    .neq("status", "cancelled")
    .not("customer_email", "is", null);

  if (bErr) {
    return new Response(JSON.stringify({ error: bErr.message }), { status: 500 });
  }

  const found = bookings?.length ?? 0;
  let sent = 0;
  let errors = 0;

  if (found === 0) {
    return new Response(JSON.stringify({ found, sent, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const listingIds = Array.from(new Set((bookings ?? []).map((b: any) => b.listing_id)));
  const { data: listings } = await supabase
    .from("public_egg_sale_listings")
    .select("id, title")
    .in("id", listingIds);
  const listingById = new Map((listings ?? []).map((l: any) => [l.id, l]));

  for (const b of bookings ?? []) {
    try {
      const listing: any = listingById.get(b.listing_id);
      const title = listing?.title ?? "säljaren";

      // Reuse existing token if one exists, else create new
      let token: string | null = null;
      const { data: existingTok } = await supabase
        .from("egg_sale_review_tokens")
        .select("token")
        .eq("booking_id", b.id)
        .maybeSingle();
      if (existingTok?.token) {
        token = existingTok.token;
      } else {
        const newToken = crypto.randomUUID().replace(/-/g, "");
        const { error: tokErr } = await supabase
          .from("egg_sale_review_tokens")
          .insert({
            booking_id: b.id,
            listing_id: b.listing_id,
            seller_user_id: b.seller_user_id,
            token: newToken,
          });
        if (tokErr) {
          console.error("token insert failed", b.id, tokErr);
          errors++;
          continue;
        }
        token = newToken;
      }

      const reviewLink = `${APP_URL}/r/${token}`;
      const subject = `Hur var dina ägg från ${title}?`;
      const messageId = `review-request-${b.id}`;

      const html = `<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">`
        + `<img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin:0 0 24px;" />`
        + `<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ${b.customer_name}!</h1>`
        + `<p style="font-size: 15px; color: hsl(22,18%,12%); line-height: 1.6; margin: 0 0 18px;">Hoppas dina ägg från <strong>${title}</strong> smakade bra! Vill du dela ett litet omdöme? Det hjälper både säljaren och andra köpare.</p>`
        + `<p style="margin: 28px 0;"><a href="${reviewLink}" style="background: hsl(142,32%,34%); color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-size: 15px; font-weight: 600; display: inline-block;">Lämna ett omdöme ★</a></p>`
        + `<p style="font-size: 13px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 8px;">Det tar bara en halv minut – välj 1–5 stjärnor och skriv gärna en rad om upplevelsen.</p>`
        + `<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du nyligen hämtat en bokning via Agdas bod på Hönsgården.</p>`
        + `</div>`;

      const text = `Hej ${b.customer_name}! Hur var dina ägg från ${title}? Lämna ett omdöme här: ${reviewLink}`;

      const { error: enqErr } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          run_id: crypto.randomUUID(),
          to: b.customer_email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject,
          html,
          text,
          purpose: "transactional",
          label: "review-request",
          message_id: messageId,
          queued_at: new Date().toISOString(),
        },
      });
      if (enqErr) {
        console.error("enqueue failed", b.id, enqErr);
        errors++;
        continue;
      }

      const { error: updErr } = await supabase
        .from("public_egg_sale_bookings")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", b.id)
        .is("review_request_sent_at", null);
      if (updErr) {
        console.error("mark sent failed", b.id, updErr);
      }
      sent++;
    } catch (err) {
      console.error("send-review-request error", b.id, err);
      errors++;
    }
  }

  return new Response(JSON.stringify({ found, sent, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});
