// Worker som kör återkommande äggabonnemang
// - Claim:ar förfallna abonnemang via RPC (radlåsning, hoppar pausade/skip_next)
// - Hoppar över när lager inte räcker till
// - Idempotency-nyckel på bokning (en bokning per abonnemang per dag)
// - Rapporterar resultat via complete_egg_subscription_run (auto-paus efter 3 fel i rad)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: claimed, error } = await supabase.rpc('claim_due_egg_subscriptions', { p_limit: 50 });
  if (error) {
    console.error('claim error', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let created = 0, skipped = 0, failed = 0;

  for (const s of (claimed ?? []) as any[]) {
    try {
      // Honour skip_next
      if (s.skip_next) {
        const nextRun = computeNext(s.frequency, new Date());
        await supabase.rpc('complete_egg_subscription_run', {
          p_id: s.id,
          p_ok: true,
          p_error: null,
          p_next_run_at: nextRun.toISOString(),
          p_booking_id: null,
        });
        // skip_next ska bara hoppa över en gång — RPC:n nollställer flaggan på ok=true
        skipped++;
        continue;
      }

      // Hämta listing och kolla lager
      const { data: listing, error: lErr } = await supabase
        .from('public_egg_sale_listings')
        .select('id, is_active, stock_packs, stock_source, sold_out_manually')
        .eq('id', s.listing_id)
        .maybeSingle();

      if (lErr) throw new Error(`listing fetch: ${lErr.message}`);
      if (!listing || !listing.is_active || listing.sold_out_manually) {
        const retry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await supabase.rpc('complete_egg_subscription_run', {
          p_id: s.id, p_ok: false, p_error: 'listing inactive or sold out',
          p_next_run_at: retry.toISOString(), p_booking_id: null,
        });
        skipped++;
        continue;
      }
      if (listing.stock_source === 'manual' && (listing.stock_packs ?? 0) < s.packs) {
        const retry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await supabase.rpc('complete_egg_subscription_run', {
          p_id: s.id, p_ok: false, p_error: 'insufficient stock',
          p_next_run_at: retry.toISOString(), p_booking_id: null,
        });
        skipped++;
        continue;
      }

      // Idempotency: en bokning per abonnemang per dag
      const today = new Date().toISOString().slice(0, 10);
      const idemKey = `sub-${s.id}-${today}`;

      const { data: existing } = await supabase
        .from('public_egg_sale_bookings')
        .select('id')
        .eq('listing_id', s.listing_id)
        .eq('customer_email', s.customer_email)
        .gte('created_at', `${today}T00:00:00Z`)
        .ilike('customer_message', `%${idemKey}%`)
        .maybeSingle();

      let bookingId: string | null = existing?.id ?? null;

      if (!bookingId) {
        const { data: booking, error: bErr } = await supabase
          .from('public_egg_sale_bookings')
          .insert({
            listing_id: s.listing_id,
            seller_user_id: s.seller_user_id,
            customer_name: s.customer_name,
            customer_email: s.customer_email,
            customer_phone: s.customer_phone,
            packs: s.packs,
            pickup_slot_id: s.pickup_slot_id ?? null,
            status: 'pending',
            customer_message: `🔁 Abonnemang (${s.frequency}) [${idemKey}]`,
          })
          .select('id')
          .single();
        if (bErr) throw new Error(`booking insert: ${bErr.message}`);
        bookingId = booking!.id;
      }

      const next = computeNext(s.frequency, new Date());
      await supabase.rpc('complete_egg_subscription_run', {
        p_id: s.id, p_ok: true, p_error: null,
        p_next_run_at: next.toISOString(),
        p_booking_id: bookingId,
      });
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('subscription run failed', s.id, msg);
      const retry = new Date(Date.now() + 6 * 60 * 60 * 1000);
      await supabase.rpc('complete_egg_subscription_run', {
        p_id: s.id, p_ok: false, p_error: msg,
        p_next_run_at: retry.toISOString(), p_booking_id: null,
      });
      failed++;
    }
  }

  return new Response(JSON.stringify({ claimed: claimed?.length ?? 0, created, skipped, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

function computeNext(frequency: string, from: Date): Date {
  const days = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
