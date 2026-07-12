import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";
const APP_URL = "https://honsgarden.se/app/settings";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "config" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: roleCheck, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) return json({ error: "Could not verify admin role" }, 503);
    if (!roleCheck) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const feedbackId = typeof body.feedback_id === "string" ? body.feedback_id : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!feedbackId || !message) return json({ error: "Missing fields" }, 400);
    if (message.length > 5_000) return json({ error: "Message too long" }, 413);

    const { data: feedback, error: feedbackError } = await admin
      .from("feedback")
      .select("id, user_id")
      .eq("id", feedbackId)
      .maybeSingle();
    if (feedbackError) return json({ error: "Could not load feedback" }, 503);
    if (!feedback?.user_id) return json({ error: "Feedback not found" }, 404);

    const { data: recipient, error: recipientError } = await admin
      .from("profiles")
      .select("email, display_name")
      .eq("user_id", feedback.user_id)
      .maybeSingle();
    if (recipientError) return json({ error: "Could not load recipient" }, 503);
    if (!recipient?.email) return json({ error: "Recipient has no email" }, 400);

    const displayName = escapeHtml(recipient.display_name || recipient.email.split("@")[0]);
    const safeMessage = escapeHtml(message);
    const messageId = `feedback-reply-${feedbackId}-${Date.now()}`;

    const { error: updateError } = await admin.from("feedback").update({
      admin_reply: message,
      admin_reply_at: new Date().toISOString(),
      status: "resolved",
    }).eq("id", feedbackId);
    if (updateError) return json({ error: "Could not save reply" }, 503);

    const { error: notificationError } = await admin.from("user_notifications").insert({
      user_id: feedback.user_id,
      type: "system",
      title: "Svar på din feedback 💬",
      body: message.length > 160 ? `${message.slice(0, 160)}…` : message,
      link: "/app/settings",
      metadata: { feedback_id: feedbackId, kind: "feedback_reply" },
    });
    if (notificationError) console.error("[reply-feedback] notification failed", notificationError.message);

    const html = `
<div style="font-family:'Inter',Arial,sans-serif;max-width:540px;padding:36px 28px;background:#ffffff;">
  <img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin:0 0 28px;" />
  <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:#2a241e;margin:0 0 20px;">Svar på din feedback 💬</h1>
  <p style="font-size:15px;color:#75685e;line-height:1.6;margin:0 0 16px;">Hej <strong>${displayName}</strong>!</p>
  <p style="font-size:14px;color:#75685e;line-height:1.6;margin:0 0 24px;">Tack för att du hörde av dig. Här kommer ett svar från Hönsgården:</p>
  <div style="background:#f2f8f2;border-left:4px solid #3a6b35;border-radius:0 12px 12px 0;padding:16px 20px;margin:0 0 24px;">
    <p style="font-size:14px;color:#453d36;line-height:1.7;margin:0;white-space:pre-wrap;">${safeMessage}</p>
  </div>
  <a href="${APP_URL}" style="background-color:#3a6b35;color:#faf8f4;font-size:15px;font-weight:600;border-radius:14px;padding:14px 28px;text-decoration:none;display:inline-block;">Se ditt ärende i appen →</a>
  <p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">Du får detta mejl för att du skickade feedback via Hönsgården.</p>
</div>`;

    const { error: queueError } = await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        run_id: crypto.randomUUID(),
        to: recipient.email,
        from: "Hönsgården <noreply@notify.honsgarden.se>",
        sender_domain: "notify.honsgarden.se",
        subject: "Svar på din feedback – Hönsgården 💬",
        html,
        text: `Hej ${recipient.display_name || recipient.email.split("@")[0]}! Tack för din feedback. Svar: ${message}`,
        purpose: "transactional",
        label: "feedback-reply",
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });
    if (queueError) return json({ error: "Could not queue email" }, 503);

    return json({ success: true });
  } catch (error) {
    console.error("[reply-feedback]", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
