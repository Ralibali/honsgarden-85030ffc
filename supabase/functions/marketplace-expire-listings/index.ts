import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const SITE_URL = Deno.env.get('PUBLIC_APP_ORIGIN') ?? 'https://honsgarden.se';
const SENDER = { name: 'Hönsgården', email: 'noreply@notify.honsgarden.se' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}

function isAuthorized(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  return (
    (!!SERVICE_ROLE_KEY && bearer === SERVICE_ROLE_KEY) ||
    (!!cronSecret && req.headers.get('x-cron-secret') === cronSecret)
  );
}

async function sendReminderEmail(toEmail: string, toName: string | null, title: string, daysLeft: number) {
  if (!BREVO_API_KEY) return false;
  const safeName = escapeHtml(toName || 'där');
  const safeTitle = escapeHtml(title);
  const link = `${SITE_URL.replace(/\/+$/, '')}/app/marknad/mina`;
  const subject = 'Din annons går snart ut – förnya med ett klick';
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:540px;padding:30px 25px;">
    <img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />
    <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:#2a241e;margin:0 0 16px;">Hej ${safeName}! 🐔</h1>
    <p style="font-size:14px;color:#75685e;line-height:1.6;margin:0 0 18px;">Din annons <strong>"${safeTitle}"</strong> går ut om ${daysLeft} dag${daysLeft === 1 ? '' : 'ar'}. Vill du fortsätta synas på Marknaden?</p>
    <a href="${link}" style="background-color:#3a6b35;color:#faf8f4;font-size:14px;border-radius:14px;padding:12px 24px;text-decoration:none;display:inline-block;">Förnya annons →</a>
    <p style="font-size:12px;color:#999;margin:30px 0 0;">Du får detta mejl för att du har en aktiv annons på Hönsgårdens Marknad.</p>
  </div>`;
  const text = `Din annons "${title}" går ut om ${daysLeft} dag(ar). Förnya den här: ${link}`;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: toEmail, name: toName ?? undefined }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!response.ok) {
      console.error('[marketplace-expire-listings] Brevo error', response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[marketplace-expire-listings] Brevo throw', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isAuthorized(req)) return json({ error: 'Unauthorized' }, 401);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Backend not configured' }, 500);

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const now = new Date();

    const { data: expired, error: expireError } = await supabase
      .from('marketplace_listings')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', now.toISOString())
      .select('id');
    if (expireError) return json({ error: `Expire failed: ${expireError.message}` }, 500);

    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: soon, error: soonError } = await supabase
      .from('marketplace_listings')
      .select('id, title, user_id, expires_at')
      .eq('status', 'active')
      .is('reminded_at', null)
      .gt('expires_at', now.toISOString())
      .lte('expires_at', inThreeDays)
      .limit(500);
    if (soonError) return json({ error: `Reminder lookup failed: ${soonError.message}` }, 500);

    let reminded = 0;
    for (const listing of soon ?? []) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('user_id', listing.user_id)
        .maybeSingle();
      if (profileError || !profile?.email) continue;

      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(listing.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      );
      const sent = await sendReminderEmail(
        profile.email,
        profile.display_name ?? null,
        String(listing.title || 'Din annons'),
        daysLeft,
      );
      if (!sent) continue;

      const { error: markError } = await supabase
        .from('marketplace_listings')
        .update({ reminded_at: new Date().toISOString() })
        .eq('id', listing.id)
        .is('reminded_at', null);
      if (!markError) reminded += 1;
    }

    return json({
      expired: expired?.length ?? 0,
      reminded,
      candidates: soon?.length ?? 0,
    });
  } catch (error) {
    console.error('[marketplace-expire-listings]', error);
    return json({ error: 'Unexpected error' }, 500);
  }
});
