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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_egg_sale_listings enable row level security;

create policy "Public can read active egg sale listings"
  on public.public_egg_sale_listings
  for select
  using (is_active = true);

create policy "Users can insert own egg sale listings"
  on public.public_egg_sale_listings
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own egg sale listings"
  on public.public_egg_sale_listings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
