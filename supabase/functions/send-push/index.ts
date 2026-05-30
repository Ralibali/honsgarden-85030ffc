import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const rawSubject = Deno.env.get("VAPID_SUBJECT") ?? "";
  const vapidSubject = /^(mailto:|https?:\/\/)/i.test(rawSubject) ? rawSubject : "mailto:info@auroramedia.se";
  if (!serviceKey || !vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: "config" }), { status: 500, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));

  // Publik endpoint: returnera VAPID public key (behövs av klienten för subscribe)
  if (body.get_public_key) {
    return new Response(JSON.stringify({ public_key: vapidPublic }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.replace("Bearer ", "").trim();
  const isService = bearer === serviceKey;

  let targetUserIds: string[] = [];
  let title = body.title ?? "Hönsgården";
  let message = body.body ?? "";
  let clickUrl = body.url ?? "/app";

  if (isService) {
    targetUserIds = Array.isArray(body.user_ids) ? body.user_ids : [];
  } else {
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    targetUserIds = [user.id];
    if (body.test) {
      title = "Testnotis 🐔";
      message = "Push fungerar! Du får nu påminnelser från Hönsgården.";
      clickUrl = "/app/settings";
    }
  }
  if (targetUserIds.length === 0) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

  const { data: subs, error } = await admin
    .from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", targetUserIds);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const payload = JSON.stringify({ title, body: message, url: clickUrl, tag: body.tag ?? "honsgarden" });
  let sent = 0;
  const dead: string[] = [];
  await Promise.all((subs ?? []).map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.endpoint);
    }
  }));
  if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
  return new Response(JSON.stringify({ sent, pruned: dead.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
