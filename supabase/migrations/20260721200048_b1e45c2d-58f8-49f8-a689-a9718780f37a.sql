-- Lanseringspass: ångerrätt, seed-flagga för exempelprodukter, hårdare validering
update public.shop_products
   set is_example = true
 where lower(description) like 'exempelprodukt%'
   and is_example is not true;

create or replace function public.shop_products_touch_example()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and OLD.is_example = true then
    if NEW.name              is distinct from OLD.name
       or NEW.description    is distinct from OLD.description
       or NEW.long_description is distinct from OLD.long_description
       or NEW.emoji           is distinct from OLD.emoji
       or NEW.image_url       is distinct from OLD.image_url
       or NEW.images          is distinct from OLD.images
       or NEW.features        is distinct from OLD.features
       or NEW.specifications  is distinct from OLD.specifications
       or NEW.category        is distinct from OLD.category
       or NEW.badge           is distinct from OLD.badge
       or NEW.slug            is distinct from OLD.slug
       or NEW.price_ore       is distinct from OLD.price_ore
       or NEW.stock           is distinct from OLD.stock
       or NEW.featured        is distinct from OLD.featured
       or NEW.shipping_days_min is distinct from OLD.shipping_days_min
       or NEW.shipping_days_max is distinct from OLD.shipping_days_max
    then
      NEW.is_example := false;
    end if;
  end if;
  return NEW;
end;
$$;

-- shop_variant_order_usage: null-safe (jämför som text)
create or replace function public.shop_variant_order_usage(p_variant_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.shop_orders o
   where public.has_role(auth.uid(), 'admin')
     and p_variant_id is not null
     and exists (
       select 1 from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
        where nullif(it->>'variant_id','') is not null
          and (it->>'variant_id') = p_variant_id::text
     );
$$;
grant execute on function public.shop_variant_order_usage(uuid) to authenticated;

insert into public.system_settings (key, value, description)
values ('shop_withdrawal_function_enabled', 'true'::jsonb,
        'Om digital ångerfunktion (/butik/angra) är aktiv')
on conflict (key) do nothing;

create or replace function public.enforce_shop_launch_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_enabled boolean;
  v_name text; v_org text; v_addr text; v_supp text;
  v_delivery text; v_method text; v_reviewed text;
  v_withdrawal text;
begin
  if NEW.key <> 'shop_public_enabled' then return NEW; end if;
  begin
    v_enabled := (NEW.value::text in ('true','"true"','1','"1"'));
  exception when others then v_enabled := false; end;
  if not v_enabled then return NEW; end if;

  select btrim(value::text, '"') into v_name       from public.system_settings where key = 'shop_company_name';
  select btrim(value::text, '"') into v_org        from public.system_settings where key = 'shop_company_org_number';
  select btrim(value::text, '"') into v_addr       from public.system_settings where key = 'shop_company_address';
  select btrim(value::text, '"') into v_supp       from public.system_settings where key = 'shop_support_email';
  select btrim(value::text, '"') into v_delivery   from public.system_settings where key = 'shop_delivery_text';
  select btrim(value::text, '"') into v_method     from public.system_settings where key = 'shop_delivery_method';
  select btrim(value::text, '"') into v_reviewed   from public.system_settings where key = 'shop_terms_reviewed_at';
  select btrim(value::text, '"') into v_withdrawal from public.system_settings where key = 'shop_withdrawal_function_enabled';

  if coalesce(v_name,'') = '' or coalesce(v_org,'') = '' or coalesce(v_addr,'') = ''
     or coalesce(v_delivery,'') = '' or coalesce(v_method,'') = ''
     or coalesce(v_reviewed,'null') in ('','null') then
    raise exception 'launch_gate_incomplete: företags- eller leveransfält saknas'
      using errcode = 'check_violation';
  end if;
  if coalesce(v_supp,'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'launch_gate_incomplete: support-e-post ogiltig'
      using errcode = 'check_violation';
  end if;
  if lower(coalesce(v_withdrawal,'true')) not in ('true','1') then
    raise exception 'launch_gate_incomplete: ångerfunktionen måste vara aktiverad'
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

update public.system_settings set value = 'false'::jsonb where key = 'shop_public_enabled';

-- Tabell för ångerärenden
create table if not exists public.shop_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  order_number text not null,
  customer_email text not null,
  requested_items jsonb not null,
  customer_message text,
  receipt_method text not null check (receipt_method in ('screen','email')),
  status text not null default 'received'
    check (status in ('received','reviewing','accepted','rejected','completed')),
  admin_note text,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, update on public.shop_withdrawal_requests to authenticated;
grant all on public.shop_withdrawal_requests to service_role;

alter table public.shop_withdrawal_requests enable row level security;

drop policy if exists "Admins läser ångerärenden" on public.shop_withdrawal_requests;
create policy "Admins läser ångerärenden"
  on public.shop_withdrawal_requests for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins uppdaterar ångerärenden" on public.shop_withdrawal_requests;
create policy "Admins uppdaterar ångerärenden"
  on public.shop_withdrawal_requests for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create index if not exists shop_withdrawal_requests_order_idx
  on public.shop_withdrawal_requests(order_id);
create index if not exists shop_withdrawal_requests_status_idx
  on public.shop_withdrawal_requests(status);
create index if not exists shop_withdrawal_requests_email_idx
  on public.shop_withdrawal_requests(customer_email);

create or replace function public.shop_withdrawal_requests_touch_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at := now(); return NEW; end;
$$;
drop trigger if exists trg_shop_withdrawal_requests_touch on public.shop_withdrawal_requests;
create trigger trg_shop_withdrawal_requests_touch
  before update on public.shop_withdrawal_requests
  for each row execute function public.shop_withdrawal_requests_touch_updated_at();

-- Uppdaterad checklist inkl. withdrawal
create or replace function public.shop_launch_checklist()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select key, coalesce(btrim(value::text,'"'),'') as v
      from public.system_settings
     where key in ('shop_company_name','shop_company_org_number','shop_company_address',
                   'shop_support_email','shop_delivery_text','shop_delivery_method',
                   'shop_terms_reviewed_at','shop_withdrawal_function_enabled',
                   'shop_public_enabled')
  )
  select jsonb_build_object(
    'company_name',       coalesce((select v from s where key='shop_company_name'),'') <> '',
    'org_number',         coalesce((select v from s where key='shop_company_org_number'),'') <> '',
    'address',            coalesce((select v from s where key='shop_company_address'),'') <> '',
    'support_email',      coalesce((select v from s where key='shop_support_email'),'') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$',
    'delivery_text',      coalesce((select v from s where key='shop_delivery_text'),'') <> '',
    'delivery_method',    coalesce((select v from s where key='shop_delivery_method'),'') <> '',
    'terms_reviewed',     coalesce((select v from s where key='shop_terms_reviewed_at'),'null') not in ('','null'),
    'withdrawal_enabled', lower(coalesce((select v from s where key='shop_withdrawal_function_enabled'),'true')) in ('true','1'),
    'public_enabled',     coalesce((select v from s where key='shop_public_enabled'),'false') in ('true','1')
  );
$$;
grant execute on function public.shop_launch_checklist() to authenticated;