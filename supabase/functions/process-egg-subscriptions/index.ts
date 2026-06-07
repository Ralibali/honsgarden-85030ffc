import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date();
  const { data: subs, error } = await supabase
    .from('egg_sale_subscriptions')
    .select('*, public_egg_sale_listings(id, is_active, stock_packs, stock_source, sold_out_manually, user_id)')
    .eq('status', 'active')
    .lte('next_run_at', now.toISOString())
    .limit(200);

  if (error) {
    console.error('subs fetch', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let created = 0, skipped = 0;

  for (const s of subs ?? []) {
    const listing: any = (s as any).public_egg_sale_listings;
    if (!listing || !listing.is_active || listing.sold_out_manually) {
      skipped++;
      continue;
    }
    if (listing.stock_source === 'manual' && (listing.stock_packs ?? 0) < s.packs) {
      // För lite på lager — försök igen om 1 dag
      await supabase.from('egg_sale_subscriptions').update({
        next_run_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', s.id);
      skipped++;
      continue;
    }

    const { data: booking, error: bErr } = await supabase
      .from('public_egg_sale_bookings')
      .insert({
        listing_id: s.listing_id,
        seller_user_id: s.seller_user_id,
        customer_name: s.customer_name,
        customer_email: s.customer_email,
        customer_phone: s.customer_phone,
        packs: s.packs,
        status: 'reserved',
        customer_message: '🔁 Abonnemang (' + s.frequency + ')',
      })
      .select('id')
      .single();

    if (bErr) {
      console.error('booking insert', bErr);
      skipped++;
      continue;
    }

    const intervalDays = s.frequency === 'weekly' ? 7 : s.frequency === 'biweekly' ? 14 : 30;
    const next = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    await supabase.from('egg_sale_subscriptions').update({
      last_booking_id: booking?.id ?? null,
      total_bookings: (s.total_bookings ?? 0) + 1,
      next_run_at: next.toISOString(),
    }).eq('id', s.id);

    created++;
  }

  return new Response(JSON.stringify({ created, skipped, scanned: subs?.length ?? 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
