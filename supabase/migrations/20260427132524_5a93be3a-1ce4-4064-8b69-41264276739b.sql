drop policy if exists "Anyone can create egg sale bookings" on public.public_egg_sale_bookings;

create policy "Anyone can create valid egg sale bookings"
  on public.public_egg_sale_bookings
  for insert
  with check (
    exists (
      select 1
      from public.public_egg_sale_listings l
      where l.id = listing_id
        and l.user_id = seller_user_id
        and l.is_active = true
        and l.sold_out_manually = false
    )
  );

create or replace function public.get_public_egg_sale_reserved_packs(p_listing_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(b.packs), 0)::integer
  from public.public_egg_sale_bookings b
  join public.public_egg_sale_listings l on l.id = b.listing_id
  where b.listing_id = p_listing_id
    and b.status <> 'cancelled'
    and l.is_active = true;
$$;

grant execute on function public.get_public_egg_sale_reserved_packs(uuid) to anon, authenticated;