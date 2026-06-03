import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "config" }), { status: 500, headers: corsHeaders });
  }

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Check admin role
  const { data: roleCheck } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleCheck) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const { feedback_id, to, display_name, message, user_id } = await req.json();

  if (!to || !message) {
    return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
  }

  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const displayName = escapeHtml(display_name || to.split("@")[0]);
  const safeMessage = escapeHtml(message);
  const messageId = `feedback-reply-${feedback_id}-${Date.now()}`;

  // 1. Save reply to feedback table
  await supabase.from("feedback").update({
    admin_reply: message,
    admin_reply_at: new Date().toISOString(),
    status: "resolved",
  }).eq("id", feedback_id);

  // 2. Create in-app notification ONLY for this user (not broadcast)
  if (user_id) {
    await supabase.from("user_notifications").insert({
      user_id,
      type: "system",
      title: "Svar på din feedback 💬",
      body: message.length > 160 ? message.slice(0, 160) + "…" : message,
      link: "/app/settings",
      metadata: { feedback_id, kind: "feedback_reply" },
    });
  }

  // 3. Send email
  const html = `
<div style="font-family: 'Inter', Arial, sans-serif; max-width: 540px; padding: 36px 28px; background: #ffffff;">
  <img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin: 0 0 28px;" />

  <h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">
    Svar på din feedback 💬
  </h1>

  <p style="font-size: 15px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">
    Hej <strong>${displayName}</strong>!
  </p>

  <p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 24px;">
    Tack för att du hörde av dig till oss. Här kommer ett svar från Hönsgården-teamet:
  </p>

  <div style="background: hsl(142,32%,96%); border-left: 4px solid hsl(142,32%,34%); border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 0 0 24px;">
    <p style="font-size: 14px; color: hsl(22,12%,25%); line-height: 1.7; margin: 0; white-space: pre-wrap;">${safeMessage}</p>
  </div>

  <a href="https://honsgarden.lovable.app/app/settings" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 15px; font-weight: 600; border-radius: 14px; padding: 14px 28px; text-decoration: none; display: inline-block;">
    Se ditt ärende i appen →
  </a>

  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.5;">
    Du får detta mejl för att du skickade feedback via Hönsgården.
  </p>
</div>`;

  await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      run_id: crypto.randomUUID(),
      to,
      from: "Hönsgården <noreply@notify.honsgarden.se>",
      sender_domain: "notify.honsgarden.se",
      subject: "Svar på din feedback – Hönsgården 💬",
      html,
      text: `Hej ${displayName}! Tack för din feedback. Svar: ${safeMessage}`,
      purpose: "transactional",
      label: "feedback-reply",
      message_id: messageId,
      queued_at: new Date().toISOString(),
    },
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
