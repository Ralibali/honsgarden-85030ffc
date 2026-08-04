alter table public.public_egg_sale_listings
  add column if not exists reserved_packs integer not null default 0,
  add column if not exists sold_out_manually boolean not null default false;

create table if not exists public.public_egg_sale_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.public_egg_sale_listings(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  customer_message text,
  packs integer not null default 1 check (packs > 0),
  status text not null default 'reserved' check (status in ('reserved', 'paid', 'picked_up', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_egg_sale_bookings enable row level security;

create policy "Anyone can create egg sale bookings"
  on public.public_egg_sale_bookings
  for insert
  with check (true);

create policy "Sellers can read own egg sale bookings"
  on public.public_egg_sale_bookings
  for select
  using (auth.uid() = seller_user_id);

create policy "Sellers can update own egg sale bookings"
  on public.public_egg_sale_bookings
  for update
  using (auth.uid() = seller_user_id)
  with check (auth.uid() = seller_user_id);

create policy "Sellers can delete own egg sale bookings"
  on public.public_egg_sale_bookings
  for delete
  using (auth.uid() = seller_user_id);

create index if not exists public_egg_sale_bookings_listing_id_idx
  on public.public_egg_sale_bookings (listing_id);

create or replace function public.set_public_egg_sale_booking_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_public_egg_sale_booking_updated_at on public.public_egg_sale_bookings;
create trigger set_public_egg_sale_booking_updated_at
before update on public.public_egg_sale_bookings
for each row
execute function public.set_public_egg_sale_booking_updated_at();

insert into storage.buckets (id, name, public)
values ('egg-sale-images', 'egg-sale-images', true)
on conflict (id) do update set public = true;

create policy "Users can upload egg sale images"
  on storage.objects
  for insert
  with check (bucket_id = 'egg-sale-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own egg sale images"
  on storage.objects
  for update
  using (bucket_id = 'egg-sale-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'egg-sale-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public can read egg sale images"
  on storage.objects
  for select
  using (bucket_id = 'egg-sale-images');
