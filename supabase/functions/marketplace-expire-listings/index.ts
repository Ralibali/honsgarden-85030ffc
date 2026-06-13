import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const SITE_URL = 'https://www.honsgarden.se';
const SENDER = { name: 'Hönsgården', email: 'noreply@notify.honsgarden.se' };

async function sendReminderEmail(toEmail: string, toName: string | null, title: string, daysLeft: number) {
  if (!BREVO_API_KEY) return false;
  const subject = 'Din annons går snart ut – förnya med ett klick';
  const link = `${SITE_URL}/app/marknad/mina`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:540px;padding:30px 25px;">
    <img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />
    <h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 16px;">Hej ${toName ?? 'där'}! 🐔</h1>
    <p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.6;margin:0 0 18px;">Din annons <strong>"${title}"</strong> går ut om ${daysLeft} dag${daysLeft === 1 ? '' : 'ar'}. Vill du fortsätta synas på Marknaden? Förnya den med ett klick.</p>
    <a href="${link}" style="background-color:hsl(142,32%,34%);color:hsl(35,32%,97%);font-size:14px;border-radius:14px;padding:12px 24px;text-decoration:none;display:inline-block;">Förnya annons →</a>
    <p style="font-size:12px;color:#999;margin:30px 0 0;">Du får detta mejl för att du har en aktiv annons på Hönsgårdens Marknad.</p>
  </div>`;
  const text = `Din annons "${title}" går ut om ${daysLeft} dag(ar). Förnya den här: ${link}`;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({ sender: SENDER, to: [{ email: toEmail, name: toName ?? undefined }], subject, htmlContent: html, textContent: text }),
    });
    if (!res.ok) { console.error('Brevo error', res.status, await res.text()); return false; }
    return true;
  } catch (e) {
    console.error('Brevo throw', e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Expire overdue listings
  const { data: expired, error: expErr } = await supabase
    .from('marketplace_listings')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('id');
  if (expErr) console.error('Expire error', expErr);

  // 2. Reminder: 3 days before expiry, not yet reminded
  const in3 = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data: soon, error: soonErr } = await supabase
    .from('marketplace_listings')
    .select('id, title, user_id, expires_at')
    .eq('status', 'active')
    .is('reminded_at', null)
    .gt('expires_at', now)
    .lte('expires_at', in3);
  if (soonErr) console.error('Soon-fetch error', soonErr);

  let reminded = 0;
  for (const l of soon ?? []) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('user_id', (l as any).user_id)
      .maybeSingle();
    const email = (prof as any)?.email;
    if (!email) continue;
    const daysLeft = Math.max(1, Math.ceil((new Date((l as any).expires_at).getTime() - Date.now()) / (24 * 3600 * 1000)));
    const ok = await sendReminderEmail(email, (prof as any)?.display_name ?? null, (l as any).title, daysLeft);
    if (ok) {
      await supabase.from('marketplace_listings').update({ reminded_at: new Date().toISOString() }).eq('id', (l as any).id);
      reminded++;
    }
  }

  return new Response(
    JSON.stringify({ expired: expired?.length ?? 0, reminded, candidates: soon?.length ?? 0 }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
