// Worker som behandlar egg_sale_notification_queue
// - Claim:ar pending-poster (radlåsning via RPC)
// - Bygger e-post och köar via befintlig enqueue_email/pgmq
// - Markerar levererad eller misslyckad (backoff sköts av RPC:n)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const APP_BASE = 'https://honsgarden.lovable.app';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: claimed, error: claimErr } = await supabase.rpc('claim_egg_notifications', { p_limit: 25 });
  if (claimErr) {
    console.error('claim error', claimErr);
    return new Response(JSON.stringify({ error: claimErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let delivered = 0;
  let failed = 0;

  for (const n of (claimed ?? []) as Array<{ id: string; listing_id: string | null; kind: string; destination: string | null; data: Record<string, unknown> }>) {
    try {
      const handled = await handle(supabase, n);
      if (handled) {
        await supabase.rpc('complete_egg_notification', { p_id: n.id, p_error: null });
        delivered++;
      } else {
        await supabase.rpc('complete_egg_notification', { p_id: n.id, p_error: 'skipped: no handler or no destination' });
        failed++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('notification handler failed', n.id, msg);
      await supabase.rpc('complete_egg_notification', { p_id: n.id, p_error: msg });
      failed++;
    }
  }

  return new Response(JSON.stringify({ claimed: claimed?.length ?? 0, delivered, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

type Sb = ReturnType<typeof createClient>;
type Notif = { id: string; listing_id: string | null; kind: string; destination: string | null; data: Record<string, unknown> };

async function handle(supabase: Sb, n: Notif): Promise<boolean> {
  if (n.kind === 'waitlist_offer') return waitlistOffer(supabase, n);
  console.warn('unknown notification kind', n.kind);
  return false;
}

async function waitlistOffer(supabase: Sb, n: Notif): Promise<boolean> {
  const to = n.destination;
  if (!to || !to.includes('@')) return false; // bara mejl just nu (sms i framtida iteration)

  const offerToken = String((n.data as any).offer_token ?? '');
  const expiresAt = String((n.data as any).expires_at ?? '');
  if (!offerToken) return false;

  const { data: listing } = await supabase
    .from('public_egg_sale_listings')
    .select('title, slug, swish_name')
    .eq('id', n.listing_id ?? '')
    .maybeSingle();

  const title = (listing as any)?.title ?? 'säljaren';
  const offerLink = `${APP_BASE}/vantelista/${offerToken}`;
  const expiresFmt = expiresAt
    ? new Date(expiresAt).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' })
    : 'snart';

  const subject = `Det finns ägg igen hos ${title} 🥚`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:540px;padding:30px 25px;">
    <h1 style="font-family:Young Serif,Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 16px;">Din tur i kön!</h1>
    <p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.6;margin:0 0 18px;">Du stod först på väntelistan hos <strong>${title}</strong> och har nu fått ett erbjudande att boka ägg. Erbjudandet gäller till <strong>${expiresFmt}</strong> – var snabb!</p>
    <a href="${offerLink}" style="background:hsl(142,32%,34%);color:hsl(35,32%,97%);font-size:14px;border-radius:14px;padding:12px 24px;text-decoration:none;display:inline-block;">Bekräfta din plats →</a>
    <p style="font-size:12px;color:#999;margin:30px 0 0;">Du får detta mejl för att du anmälde intresse via väntelistan på Hönsgården.</p>
  </div>`;
  const text = `Du står först i kön hos ${title}! Bekräfta din plats senast ${expiresFmt}: ${offerLink}`;

  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      run_id: crypto.randomUUID(),
      to,
      from: 'Hönsgården <noreply@notify.honsgarden.se>',
      sender_domain: 'notify.honsgarden.se',
      subject,
      html,
      text,
      purpose: 'transactional',
      label: 'waitlist-offer',
      message_id: `waitlist-offer-${n.id}`,
      queued_at: new Date().toISOString(),
    },
  });
  if (error) throw new Error(`enqueue_email: ${error.message}`);
  return true;
}
