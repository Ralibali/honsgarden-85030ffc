// Worker som kör återkommande äggabonnemang.
// Endast service role eller CRON_SECRET får starta jobbet.
import { createClient } from 'npm:@supabase/supabase-js@2';

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

function isAuthorized(req: Request, serviceRoleKey: string) {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  return (
    (!!serviceRoleKey && bearer === serviceRoleKey) ||
    (!!cronSecret && req.headers.get('x-cron-secret') === cronSecret)
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Backend not configured' }, 500);
  if (!isAuthorized(req, serviceRoleKey)) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const { data: claimed, error } = await supabase.rpc('claim_due_egg_subscriptions', { p_limit: 50 });
    if (error) return json({ error: `Claim failed: ${error.message}` }, 500);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const subscription of (claimed ?? []) as any[]) {
      try {
        if (subscription.skip_next) {
          const nextRun = computeNext(subscription.frequency, new Date());
          const { error: completeError } = await supabase.rpc('complete_egg_subscription_run', {
            p_id: subscription.id,
            p_ok: true,
            p_error: null,
            p_next_run_at: nextRun.toISOString(),
            p_booking_id: null,
          });
          if (completeError) throw new Error(`complete skip: ${completeError.message}`);
          skipped += 1;
          continue;
        }

        const { data: listing, error: listingError } = await supabase
          .from('public_egg_sale_listings')
          .select('id, user_id, is_active, stock_packs, stock_source, sold_out_manually')
          .eq('id', subscription.listing_id)
          .maybeSingle();
        if (listingError) throw new Error(`listing fetch: ${listingError.message}`);

        // Lita aldrig på seller_user_id från den claimade payloaden när listingens
        // ägare finns i databasen.
        if (!listing || listing.user_id !== subscription.seller_user_id) {
          throw new Error('listing ownership mismatch');
        }

        if (!listing.is_active || listing.sold_out_manually) {
          const retry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const { error: completeError } = await supabase.rpc('complete_egg_subscription_run', {
            p_id: subscription.id,
            p_ok: false,
            p_error: 'listing inactive or sold out',
            p_next_run_at: retry.toISOString(),
            p_booking_id: null,
          });
          if (completeError) throw new Error(`complete inactive: ${completeError.message}`);
          skipped += 1;
          continue;
        }

        const packs = Math.max(1, Math.min(100, Math.round(Number(subscription.packs || 0))));
        if (listing.stock_source === 'manual' && (listing.stock_packs ?? 0) < packs) {
          const retry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const { error: completeError } = await supabase.rpc('complete_egg_subscription_run', {
            p_id: subscription.id,
            p_ok: false,
            p_error: 'insufficient stock',
            p_next_run_at: retry.toISOString(),
            p_booking_id: null,
          });
          if (completeError) throw new Error(`complete stock: ${completeError.message}`);
          skipped += 1;
          continue;
        }

        const today = new Date().toISOString().slice(0, 10);
        const idempotencyKey = `sub-${subscription.id}-${today}`;
        const { data: existing, error: existingError } = await supabase
          .from('public_egg_sale_bookings')
          .select('id')
          .eq('listing_id', subscription.listing_id)
          .eq('seller_user_id', listing.user_id)
          .eq('customer_email', subscription.customer_email)
          .gte('created_at', `${today}T00:00:00Z`)
          .ilike('customer_message', `%${idempotencyKey}%`)
          .maybeSingle();
        if (existingError) throw new Error(`idempotency lookup: ${existingError.message}`);

        let bookingId: string | null = existing?.id ?? null;
        if (!bookingId) {
          const { data: booking, error: bookingError } = await supabase
            .from('public_egg_sale_bookings')
            .insert({
              listing_id: subscription.listing_id,
              seller_user_id: listing.user_id,
              customer_name: String(subscription.customer_name || '').slice(0, 120),
              customer_email: String(subscription.customer_email || '').slice(0, 320),
              customer_phone: subscription.customer_phone ? String(subscription.customer_phone).slice(0, 50) : null,
              packs,
              pickup_slot_id: subscription.pickup_slot_id ?? null,
              status: 'pending',
              customer_message: `🔁 Abonnemang (${String(subscription.frequency || 'monthly').slice(0, 30)}) [${idempotencyKey}]`,
            })
            .select('id')
            .single();
          if (bookingError) throw new Error(`booking insert: ${bookingError.message}`);
          bookingId = booking.id;
        }

        const nextRun = computeNext(subscription.frequency, new Date());
        const { error: completeError } = await supabase.rpc('complete_egg_subscription_run', {
          p_id: subscription.id,
          p_ok: true,
          p_error: null,
          p_next_run_at: nextRun.toISOString(),
          p_booking_id: bookingId,
        });
        if (completeError) throw new Error(`complete run: ${completeError.message}`);
        created += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[process-egg-subscriptions] run failed', subscription.id, message);
        const retry = new Date(Date.now() + 6 * 60 * 60 * 1000);
        const { error: completeError } = await supabase.rpc('complete_egg_subscription_run', {
          p_id: subscription.id,
          p_ok: false,
          p_error: message.slice(0, 500),
          p_next_run_at: retry.toISOString(),
          p_booking_id: null,
        });
        if (completeError) console.error('[process-egg-subscriptions] completion failed', completeError.message);
        failed += 1;
      }
    }

    return json({ claimed: claimed?.length ?? 0, created, skipped, failed });
  } catch (error) {
    console.error('[process-egg-subscriptions] fatal', error);
    return json({ error: 'Unexpected error' }, 500);
  }
});

function computeNext(frequency: string, from: Date): Date {
  const days = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
