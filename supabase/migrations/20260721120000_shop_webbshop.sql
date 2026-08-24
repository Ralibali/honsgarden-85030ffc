-- ============================================================
-- Webbshop (dold tills lansering): produkter + ordrar
-- Endast admin har åtkomst via RLS – shoppen är osynlig för alla andra.
-- ============================================================

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  emoji text not null default '🥚',
  image_url text,
  price_ore integer not null check (price_ore >= 0),
  stock integer, -- null = obegränsat lager
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text unique,
  items jsonb not null default '[]'::jsonb,
  amount_total_ore integer not null default 0,
  currency text not null default 'sek',
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'canceled')),
  customer_email text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shop_orders_user_id_idx on public.shop_orders(user_id);
create index if not exists shop_orders_status_idx on public.shop_orders(status);
create index if not exists shop_products_active_idx on public.shop_products(active, sort_order);

alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;

-- Produkter: bara admin ser och ändrar (tills shoppen lanseras publikt)
create policy "Admins hanterar shopprodukter"
  on public.shop_products
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Ordrar: admin ser allt; ägaren ser sin egen order (kvittensida)
create policy "Admins ser alla shopordrar"
  on public.shop_orders
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Anvandare ser egna shopordrar"
  on public.shop_orders
  for select to authenticated
  using (auth.uid() = user_id);

-- Inserts/updates sker via edge functions med service role (kringgår RLS)

-- updated_at-trigger för produkter
create or replace function public.shop_products_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shop_products_touch on public.shop_products;
create trigger shop_products_touch
  before update on public.shop_products
  for each row execute function public.shop_products_touch_updated_at();

-- Exempelprodukter att utgå ifrån (redigera eller ta bort i Butik → Produkter)
insert into public.shop_products (name, description, emoji, price_ore, stock, sort_order)
values
  ('Hönsgården T-shirt', 'Exempelprodukt – mjuk ekologisk t-shirt med Hönsgårdens motiv. Redigera eller byt ut mot din egen produkt.', '👕', 24900, 25, 1),
  ('Hönsgården mugg', 'Exempelprodukt – keramikmugg med gårdens logga, perfekt till morgonkaffet vid hönshuset.', '☕', 14900, 40, 2),
  ('Äggkartong med eget tryck (10-pack)', 'Exempelprodukt – snygga kartonger med din gårdsetikett för den som säljer ägg lokalt.', '🥚', 39900, 15, 3);
