alter table public.public_egg_sale_listings
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

drop policy if exists "public_can_view_active_listings_map" on public.public_egg_sale_listings;
create policy "public_can_view_active_listings_map"
  on public.public_egg_sale_listings for select
  to anon, authenticated
  using (is_active = true);