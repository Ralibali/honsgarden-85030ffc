import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!;
const SITE_URL = 'https://www.honsgarden.se';

const SENDER = { name: 'Hönsgården', email: 'noreply@notify.honsgarden.se' };
const REGION_LABEL = (r: string | null) => r || 'hela Sverige';

type Alert = {
  id: string;
  user_id: string;
  category: string | null;
  region: string | null;
  search_term: string | null;
  last_notified_at: string | null;
};

type Listing = {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  is_giveaway: boolean;
  region: string | null;
  city: string | null;
  category: string;
  created_at: string;
};

function formatPrice(price: number | null, giveaway: boolean): string {
  if (giveaway) return 'Skänkes';
  if (price == null) return 'Pris ej angivet';
  return `${Math.round(price)} kr`;
}

function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

async function sendEmail(toEmail: string, toName: string | null, subject: string, html: string, text: string) {
  const body = {
    sender: SENDER,
    to: [{ email: toEmail, name: toName ?? undefined }],
    subject,
    htmlContent: html,
    textContent: text,
  };
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${errText.slice(0, 300)}`);
  }
}

function buildEmail(profileName: string | null, listings: Listing[], alertSummaries: string[]) {
  const subject = 'Nya annonser som matchar din bevakning 🐔';
  const greeting = profileName ? `Hej ${profileName}!` : 'Hej!';

  const itemsHtml = listings
    .map((l) => {
      const url = `${SITE_URL}/marknad/${l.slug}`;
      const where = l.city || l.region || '';
      return (
        `<div style="border:1px solid hsl(22,15%,90%);border-radius:14px;padding:14px 16px;margin:0 0 12px;background:#fff;">` +
        `<a href="${url}" style="color:hsl(22,18%,12%);font-weight:600;font-size:15px;text-decoration:none;">${l.title}</a>` +
        `<div style="margin-top:4px;color:hsl(142,32%,34%);font-weight:600;font-size:14px;">${formatPrice(l.price, l.is_giveaway)}</div>` +
        (where
          ? `<div style="margin-top:2px;color:hsl(22,12%,44%);font-size:13px;">📍 ${where}</div>`
          : '') +
        `<div style="margin-top:10px;"><a href="${url}" style="color:hsl(142,32%,34%);font-size:13px;text-decoration:underline;">Öppna annons →</a></div>` +
        `</div>`
      );
    })
    .join('');

  const summaryHtml = alertSummaries.length
    ? `<p style="font-size:13px;color:hsl(22,12%,44%);margin:0 0 18px;">Matchar dina bevakningar: <strong>${alertSummaries.join(' · ')}</strong></p>`
    : '';

  const html =
    `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;padding:30px 25px;background:#fff;">` +
    `<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />` +
    `<h1 style="font-family:'Young Serif',Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 14px;">${greeting}</h1>` +
    `<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.6;margin:0 0 16px;">Vi hittade <strong>${listings.length}</strong> ny${listings.length === 1 ? '' : 'a'} annons${listings.length === 1 ? '' : 'er'} som matchar din bevakning på Marknaden.</p>` +
    summaryHtml +
    itemsHtml +
    `<p style="margin:24px 0 0;font-size:12px;color:hsl(22,12%,55%);">Vill du sluta få mejlen? <a href="${SITE_URL}/app/marknad/mina" style="color:hsl(142,32%,34%);">Hantera dina bevakningar →</a></p>` +
    `</div>`;

  const textLines = [
    greeting,
    '',
    `Vi hittade ${listings.length} nya annonser som matchar din bevakning på Marknaden.`,
    '',
    ...listings.map(
      (l) => `• ${l.title} – ${formatPrice(l.price, l.is_giveaway)} – ${l.city || l.region || ''}\n  ${SITE_URL}/marknad/${l.slug}`,
    ),
    '',
    `Hantera bevakningar: ${SITE_URL}/app/marknad/mina`,
  ];

  return { subject, html, text: textLines.join('\n') };
}

function describeAlert(a: Alert): string {
  const parts: string[] = [];
  if (a.category) parts.push(a.category);
  if (a.region) parts.push(`i ${a.region}`);
  if (a.search_term) parts.push(`"${a.search_term}"`);
  return parts.length ? parts.join(' ') : 'alla annonser';
}

async function runDispatch() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: alerts, error: alertErr } = await supabase
    .from('marketplace_alerts')
    .select('id, user_id, category, region, search_term, last_notified_at')
    .eq('active', true);

  if (alertErr) throw alertErr;
  if (!alerts || alerts.length === 0) {
    return { processed: 0, emailed: 0 };
  }

  // Gruppera per användare: { userId: { listings: Map<id,Listing>, alertIds: [], summaries: Set } }
  const byUser = new Map<
    string,
    { listings: Map<string, Listing>; alertIds: string[]; summaries: Set<string> }
  >();

  for (const a of alerts as Alert[]) {
    // Default window: 30 min för nya bevakningar utan last_notified_at
    const since = a.last_notified_at
      ? new Date(a.last_notified_at).toISOString()
      : new Date(Date.now() - 30 * 60 * 1000).toISOString();

    let query = supabase
      .from('marketplace_listings')
      .select('id, slug, title, price, is_giveaway, region, city, category, created_at')
      .eq('status', 'active')
      .gt('created_at', since)
      .neq('user_id', a.user_id) // notifiera inte om egna annonser
      .order('created_at', { ascending: false })
      .limit(20);

    if (a.category) query = query.eq('category', a.category);
    if (a.region) query = query.eq('region', a.region);
    if (a.search_term) {
      const term = `%${escapeIlike(a.search_term)}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term}`);
    }

    const { data: matches, error: mErr } = await query;
    if (mErr) {
      console.error('[marketplace-alerts] query error for alert', a.id, mErr.message);
      continue;
    }
    if (!matches || matches.length === 0) continue;

    const bucket = byUser.get(a.user_id) ?? {
      listings: new Map<string, Listing>(),
      alertIds: [],
      summaries: new Set<string>(),
    };
    for (const l of matches as Listing[]) {
      bucket.listings.set(l.id, l);
    }
    bucket.alertIds.push(a.id);
    bucket.summaries.add(describeAlert(a));
    byUser.set(a.user_id, bucket);
  }

  if (byUser.size === 0) {
    return { processed: alerts.length, emailed: 0 };
  }

  // Hämta e-postadresser
  const userIds = Array.from(byUser.keys());
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, email, display_name')
    .in('user_id', userIds);

  const profileMap = new Map<string, { email: string | null; display_name: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, { email: p.email, display_name: p.display_name });
  }

  let emailed = 0;
  for (const [userId, bucket] of byUser.entries()) {
    const profile = profileMap.get(userId);
    if (!profile?.email) {
      console.log('[marketplace-alerts] no email for user', userId);
      continue;
    }
    const listings = Array.from(bucket.listings.values()).slice(0, 12);
    const summaries = Array.from(bucket.summaries);
    const { subject, html, text } = buildEmail(profile.display_name, listings, summaries);

    try {
      await sendEmail(profile.email, profile.display_name, subject, html, text);
      emailed += 1;
      // Uppdatera last_notified_at för de bevakningar som triggade detta mejl
      const { error: upErr } = await supabase
        .from('marketplace_alerts')
        .update({ last_notified_at: new Date().toISOString() })
        .in('id', bucket.alertIds);
      if (upErr) {
        console.error('[marketplace-alerts] failed to update last_notified_at', upErr.message);
      }
    } catch (err) {
      console.error('[marketplace-alerts] send failed for user', userId, (err as Error).message);
      // hoppa över denna användare, fortsätt loopen
    }
  }

  return { processed: alerts.length, emailed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const result = await runDispatch();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[marketplace-alerts] fatal', (err as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
