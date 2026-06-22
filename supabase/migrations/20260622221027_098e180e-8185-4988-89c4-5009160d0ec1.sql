create or replace function public.get_public_egg_sale_social_proof(p_listing_id uuid)
returns table(bookings_today integer, last_booked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(count(*) filter (
      where b.created_at >= date_trunc('day', now() at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm'
    ), 0)::integer as bookings_today,
    max(b.created_at) as last_booked_at
  from public.public_egg_sale_bookings b
  join public.public_egg_sale_listings l on l.id = b.listing_id
  where b.listing_id = p_listing_id
    and b.status <> 'cancelled'
    and l.is_active = true;
$$;

grant execute on function public.get_public_egg_sale_social_proof(uuid) to anon, authenticated;