
-- Webbshop – publik lansering (v2, utan unaccent)

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  emoji text not null default '🥚',
  image_url text,
  price_ore integer not null check (price_ore >= 0),
  stock integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_products
  add column if not exists slug text,
  add column if not exists category text,
  add column if not exists long_description text,
  add column if not exists images text[] not null default '{}'::text[],
  add column if not exists features text[] not null default '{}'::text[],
  add column if not exists specifications jsonb not null default '{}'::jsonb,
  add column if not exists badge text,
  add column if not exists featured boolean not null default false,
  add column if not exists shipping_days_min integer,
  add column if not exists shipping_days_max integer,
  add column if not exists vat_rate numeric not null default 0.25;

update public.shop_products
   set slug = regexp_replace(
                regexp_replace(lower(coalesce(name,'p')), '[^a-z0-9]+', '-', 'g'),
                '(^-|-$)', '', 'g'
              ) || '-' || substr(id::text, 1, 6)
 where slug is null or slug = '';

alter table public.shop_products alter column slug set not null;

create unique index if not exists shop_products_slug_key on public.shop_products(slug);
create index if not exists shop_products_active_idx on public.shop_products(active, sort_order);
create index if not exists shop_products_category_idx on public.shop_products(category) where category is not null;
create index if not exists shop_products_featured_idx on public.shop_products(featured) where featured;

create table if not exists public.shop_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete cascade,
  name text not null,
  sku text,
  options jsonb not null default '{}'::jsonb,
  price_override_ore integer check (price_override_ore is null or price_override_ore >= 0),
  stock integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shop_product_variants_sku_key
  on public.shop_product_variants(sku) where sku is not null;
create index if not exists shop_product_variants_product_idx
  on public.shop_product_variants(product_id, active, sort_order);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  stripe_session_id text unique,
  items jsonb not null default '[]'::jsonb,
  amount_total_ore integer not null default 0,
  currency text not null default 'sek',
  status text not null default 'pending' check (status in ('pending','paid','expired','canceled','refunded')),
  customer_email text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.shop_orders alter column user_id drop not null;

alter table public.shop_orders
  add column if not exists order_number text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists shipping_address jsonb,
  add column if not exists subtotal_ore integer not null default 0,
  add column if not exists shipping_ore integer not null default 0,
  add column if not exists discount_ore integer not null default 0,
  add column if not exists fulfillment_status text not null default 'new'
    check (fulfillment_status in ('new','processing','packed','shipped','completed','canceled')),
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists admin_note text,
  add column if not exists public_token text,
  add column if not exists shipped_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists stock_applied boolean not null default false,
  add column if not exists payment_intent_id text;

create sequence if not exists public.shop_order_number_seq start 1000;

create or replace function public.shop_orders_set_defaults()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'HG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.shop_order_number_seq')::text, 6, '0');
  end if;
  if new.public_token is null or new.public_token = '' then
    new.public_token := encode(gen_random_bytes(24), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists shop_orders_set_defaults_trg on public.shop_orders;
create trigger shop_orders_set_defaults_trg
  before insert on public.shop_orders
  for each row execute function public.shop_orders_set_defaults();

update public.shop_orders
   set order_number = 'HG-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.shop_order_number_seq')::text, 6, '0')
 where order_number is null;
update public.shop_orders
   set public_token = encode(gen_random_bytes(24), 'hex')
 where public_token is null;

create unique index if not exists shop_orders_order_number_key on public.shop_orders(order_number);
create unique index if not exists shop_orders_public_token_key on public.shop_orders(public_token);
create index if not exists shop_orders_user_id_idx on public.shop_orders(user_id);
create index if not exists shop_orders_status_idx on public.shop_orders(status);
create index if not exists shop_orders_fulfillment_idx on public.shop_orders(fulfillment_status);

create or replace function public.shop_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists shop_products_touch on public.shop_products;
create trigger shop_products_touch before update on public.shop_products
  for each row execute function public.shop_touch_updated_at();

drop trigger if exists shop_variants_touch on public.shop_product_variants;
create trigger shop_variants_touch before update on public.shop_product_variants
  for each row execute function public.shop_touch_updated_at();

grant select on public.shop_products to anon, authenticated;
grant all on public.shop_products to service_role;
grant select on public.shop_product_variants to anon, authenticated;
grant all on public.shop_product_variants to service_role;
grant select on public.shop_orders to authenticated;
grant all on public.shop_orders to service_role;

alter table public.shop_products enable row level security;
alter table public.shop_product_variants enable row level security;
alter table public.shop_orders enable row level security;

drop policy if exists "Admins hanterar shopprodukter" on public.shop_products;
drop policy if exists "Admins ser alla shopordrar" on public.shop_orders;
drop policy if exists "Anvandare ser egna shopordrar" on public.shop_orders;
drop policy if exists shop_products_public_read on public.shop_products;
drop policy if exists shop_products_admin_all on public.shop_products;
drop policy if exists shop_variants_public_read on public.shop_product_variants;
drop policy if exists shop_variants_admin_all on public.shop_product_variants;
drop policy if exists shop_orders_admin_all on public.shop_orders;
drop policy if exists shop_orders_owner_read on public.shop_orders;

create or replace function public.shop_public_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when value::text in ('true','"true"','1','"1"') then true else false end
       from public.system_settings where key = 'shop_public_enabled' limit 1),
    false);
$$;
grant execute on function public.shop_public_enabled() to anon, authenticated;

create policy shop_products_public_read on public.shop_products
  for select to anon, authenticated
  using (active = true and public.shop_public_enabled());

create policy shop_products_admin_all on public.shop_products
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy shop_variants_public_read on public.shop_product_variants
  for select to anon, authenticated
  using (
    active = true and public.shop_public_enabled()
    and exists (select 1 from public.shop_products p
                 where p.id = shop_product_variants.product_id and p.active = true)
  );

create policy shop_variants_admin_all on public.shop_product_variants
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy shop_orders_admin_all on public.shop_orders
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy shop_orders_owner_read on public.shop_orders
  for select to authenticated
  using (auth.uid() is not null and user_id = auth.uid());

insert into public.system_settings (key, value, description) values
  ('shop_public_enabled', 'false'::jsonb, 'Om publika webbshoppen /butik är synlig för besökare'),
  ('shop_shipping_ore', '5900'::jsonb, 'Fraktpris i öre för standardleverans (SE)'),
  ('shop_free_shipping_threshold_ore', '49900'::jsonb, 'Gräns i öre för fri frakt'),
  ('shop_support_email', '"info@auroramedia.se"'::jsonb, 'Kontakt-e-post för butiksfrågor'),
  ('shop_delivery_text', '"Vi packar din order inom 1–3 arbetsdagar och skickar med Postnord."'::jsonb, 'Leveranstext på produktsida/checkout')
on conflict (key) do nothing;

create or replace function public.get_shop_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from public.system_settings
   where key like 'shop\_%' escape '\';
$$;
grant execute on function public.get_shop_settings() to anon, authenticated;

create or replace function public.shop_finalize_paid_order(
  p_order_id uuid,
  p_amount_total_ore integer default null,
  p_customer_email text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_shipping_address jsonb default null,
  p_payment_intent_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.shop_orders%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_current_stock integer;
  v_stock_warning text := null;
begin
  select * into v_order from public.shop_orders where id = p_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_order.stock_applied then return jsonb_build_object('ok', true, 'reason', 'already_applied'); end if;

  for v_item in select * from jsonb_array_elements(v_order.items) loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_variant_id := nullif(v_item->>'variant_id','')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 or v_product_id is null then continue; end if;

    if v_variant_id is not null then
      select stock into v_current_stock from public.shop_product_variants where id = v_variant_id for update;
      if v_current_stock is not null then
        if v_current_stock < v_qty then
          v_stock_warning := coalesce(v_stock_warning || ' ', '') || 'Variant ' || v_variant_id || ' understock (' || v_current_stock || '/' || v_qty || ').';
          update public.shop_product_variants set stock = 0 where id = v_variant_id;
        else
          update public.shop_product_variants set stock = stock - v_qty where id = v_variant_id;
        end if;
      end if;
    else
      select stock into v_current_stock from public.shop_products where id = v_product_id for update;
      if v_current_stock is not null then
        if v_current_stock < v_qty then
          v_stock_warning := coalesce(v_stock_warning || ' ', '') || 'Product ' || v_product_id || ' understock (' || v_current_stock || '/' || v_qty || ').';
          update public.shop_products set stock = 0 where id = v_product_id;
        else
          update public.shop_products set stock = stock - v_qty where id = v_product_id;
        end if;
      end if;
    end if;
  end loop;

  update public.shop_orders
     set status = 'paid',
         stock_applied = true,
         paid_at = coalesce(paid_at, now()),
         amount_total_ore = coalesce(p_amount_total_ore, amount_total_ore),
         customer_email = coalesce(p_customer_email, customer_email),
         customer_name = coalesce(p_customer_name, customer_name),
         customer_phone = coalesce(p_customer_phone, customer_phone),
         shipping_address = coalesce(p_shipping_address, shipping_address),
         payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
         admin_note = case when v_stock_warning is not null
             then coalesce(admin_note || E'\n', '') || 'STOCK WARNING: ' || v_stock_warning
             else admin_note end,
         fulfillment_status = case when v_stock_warning is not null then 'processing' else fulfillment_status end
   where id = p_order_id;

  return jsonb_build_object('ok', true, 'stock_warning', v_stock_warning);
end;
$$;

revoke all on function public.shop_finalize_paid_order(uuid, integer, text, text, text, jsonb, text) from public;
grant execute on function public.shop_finalize_paid_order(uuid, integer, text, text, text, jsonb, text) to service_role;

insert into public.shop_products (name, slug, description, long_description, emoji, price_ore, stock, sort_order, category, features)
select * from (values
  ('Hönsgården T-shirt', 'honsgarden-t-shirt',
   'Mjuk ekologisk t-shirt med Hönsgårdens logga.',
   'Skön vardagströja i 100% ekologisk bomull, tryckt i Sverige. Perfekt när du är ute vid hönshuset.',
   '👕', 24900, 25, 1, 'Kläder', array['100% ekologisk bomull','Tryckt i Sverige','Passform: unisex']),
  ('Hönsgården mugg', 'honsgarden-mugg',
   'Keramikmugg med gårdens logga.',
   'Stengodsmugg 33 cl med diskret Hönsgården-etikett. Tål maskindisk och mikro.',
   '☕', 14900, 40, 2, 'Kök', array['33 cl','Diskmaskinssäker','Mikrosäker']),
  ('Äggkartong med eget tryck (10-pack)', 'aggkartong-eget-tryck-10-pack',
   'Snygga kartonger med din gårdsetikett.',
   'Kraftig äggkartong för 6 ägg, 10-pack. Enkel att märka med din egen etikett.',
   '🥚', 39900, 15, 3, 'Förpackning', array['10-pack','För 6 ägg','FSC-certifierat papper'])
) as t(name, slug, description, long_description, emoji, price_ore, stock, sort_order, category, features)
where not exists (select 1 from public.shop_products);
