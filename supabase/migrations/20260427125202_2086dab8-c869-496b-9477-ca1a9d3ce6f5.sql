-- 1. Create public_egg_sale_listings
create table if not exists public.public_egg_sale_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null default 'Färska ägg till salu',
  description text not null default 'Färska ägg från lokal hönsgård.',
  image_url text,
  packs_available integer not null default 1,
  eggs_per_pack integer not null default 12,
  price_per_pack numeric not null default 60,
  location text,
  pickup_info text,
  contact_info text,
  swish_number text,
  swish_name text,
  swish_message text default 'Ägg',
  p6_price numeric,
  p12_price numeric,
  p30_price numeric,
  is_active boolean not null default true,
  reserved_packs integer not null default 0,
  sold_out_manually boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_egg_sale_listings enable row level security;

drop policy if exists "Public can read active egg sale listings" on public.public_egg_sale_listings;
create policy "Public can read active egg sale listings"
  on public.public_egg_sale_listings
  for select
  using (is_active = true);

drop policy if exists "Users can read own egg sale listings" on public.public_egg_sale_listings;
create policy "Users can read own egg sale listings"
  on public.public_egg_sale_listings
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own egg sale listings" on public.public_egg_sale_listings;
create policy "Users can insert own egg sale listings"
  on public.public_egg_sale_listings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own egg sale listings" on public.public_egg_sale_listings;
create policy "Users can update own egg sale listings"
  on public.public_egg_sale_listings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own egg sale listings" on public.public_egg_sale_listings;
create policy "Users can delete own egg sale listings"
  on public.public_egg_sale_listings
  for delete
  using (auth.uid() = user_id);

create index if not exists public_egg_sale_listings_slug_idx
  on public.public_egg_sale_listings (slug);

create or replace function public.set_public_egg_sale_listing_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_public_egg_sale_listing_updated_at on public.public_egg_sale_listings;
create trigger set_public_egg_sale_listing_updated_at
before update on public.public_egg_sale_listings
for each row
execute function public.set_public_egg_sale_listing_updated_at();

-- 2. Create public_egg_sale_bookings
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

drop policy if exists "Anyone can create egg sale bookings" on public.public_egg_sale_bookings;
create policy "Anyone can create egg sale bookings"
  on public.public_egg_sale_bookings
  for insert
  with check (true);

drop policy if exists "Sellers can read own egg sale bookings" on public.public_egg_sale_bookings;
create policy "Sellers can read own egg sale bookings"
  on public.public_egg_sale_bookings
  for select
  using (auth.uid() = seller_user_id);

drop policy if exists "Sellers can update own egg sale bookings" on public.public_egg_sale_bookings;
create policy "Sellers can update own egg sale bookings"
  on public.public_egg_sale_bookings
  for update
  using (auth.uid() = seller_user_id)
  with check (auth.uid() = seller_user_id);

drop policy if exists "Sellers can delete own egg sale bookings" on public.public_egg_sale_bookings;
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
set search_path = public
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

-- 3. Create storage bucket and policies for egg-sale-images
insert into storage.buckets (id, name, public)
values ('egg-sale-images', 'egg-sale-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can upload egg sale images" on storage.objects;
create policy "Users can upload egg sale images"
  on storage.objects
  for insert
  with check (bucket_id = 'egg-sale-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update own egg sale images" on storage.objects;
create policy "Users can update own egg sale images"
  on storage.objects
  for update
  using (bucket_id = 'egg-sale-images' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'egg-sale-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own egg sale images" on storage.objects;
create policy "Users can delete own egg sale images"
  on storage.objects
  for delete
  using (bucket_id = 'egg-sale-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Public can read egg sale images" on storage.objects;
create policy "Public can read egg sale images"
  on storage.objects
  for select
  using (bucket_id = 'egg-sale-images');