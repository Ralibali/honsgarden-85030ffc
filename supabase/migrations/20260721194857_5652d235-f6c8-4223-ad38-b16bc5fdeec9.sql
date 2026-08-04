
-- 1) Är exempel-flagga för produkter
alter table public.shop_products
  add column if not exists is_example boolean not null default false;

-- Automatisk avmarkering: när admin uppdaterar en exempelprodukt räknas den inte längre som demo.
create or replace function public.shop_products_touch_example()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and OLD.is_example = true then
    if NEW.name is distinct from OLD.name
       or NEW.description is distinct from OLD.description
       or NEW.long_description is distinct from OLD.long_description
       or NEW.price_ore is distinct from OLD.price_ore
       or NEW.image_url is distinct from OLD.image_url
       or NEW.slug is distinct from OLD.slug
    then
      NEW.is_example := false;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_shop_products_touch_example on public.shop_products;
create trigger trg_shop_products_touch_example
  before update on public.shop_products
  for each row execute function public.shop_products_touch_example();

-- Slug-unikhet (redan not null; säkerställ unik index)
create unique index if not exists shop_products_slug_key on public.shop_products (slug);

-- 2) Strikare launch-gate: kräver även delivery_method + rimlig e-post
create or replace function public.enforce_shop_launch_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_enabled boolean;
  v_name text; v_org text; v_addr text; v_supp text;
  v_delivery text; v_method text; v_reviewed text;
begin
  if NEW.key <> 'shop_public_enabled' then
    return NEW;
  end if;
  begin
    v_enabled := (NEW.value::text in ('true','"true"','1','"1"'));
  exception when others then
    v_enabled := false;
  end;
  if not v_enabled then
    return NEW;
  end if;

  select btrim(value::text, '"') into v_name     from public.system_settings where key = 'shop_company_name';
  select btrim(value::text, '"') into v_org      from public.system_settings where key = 'shop_company_org_number';
  select btrim(value::text, '"') into v_addr     from public.system_settings where key = 'shop_company_address';
  select btrim(value::text, '"') into v_supp     from public.system_settings where key = 'shop_support_email';
  select btrim(value::text, '"') into v_delivery from public.system_settings where key = 'shop_delivery_text';
  select btrim(value::text, '"') into v_method   from public.system_settings where key = 'shop_delivery_method';
  select btrim(value::text, '"') into v_reviewed from public.system_settings where key = 'shop_terms_reviewed_at';

  if coalesce(v_name,'') = '' or coalesce(v_org,'') = '' or coalesce(v_addr,'') = ''
     or coalesce(v_delivery,'') = '' or coalesce(v_method,'') = ''
     or coalesce(v_reviewed,'null') in ('','null')
  then
    raise exception 'launch_gate_incomplete'
      using errcode = 'check_violation';
  end if;

  -- Rimlig e-postform: minst "a@b.c"
  if coalesce(v_supp,'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'launch_gate_incomplete: support-e-post saknas eller är ogiltig'
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

-- Säkerställ metod-nyckeln finns
insert into public.system_settings (key, value, description)
values ('shop_delivery_method', '""'::jsonb, 'Fri text som beskriver hur leveransen sker (fraktbolag eller upphämtning)')
on conflict (key) do nothing;

-- Uppdaterad checklista
create or replace function public.shop_launch_checklist()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select key, btrim(value::text, '"') as v from public.system_settings
     where key in ('shop_company_name','shop_company_org_number','shop_company_address',
                   'shop_support_email','shop_delivery_text','shop_delivery_method',
                   'shop_terms_reviewed_at','shop_public_enabled')
  )
  select jsonb_build_object(
    'company_name',    coalesce((select v from s where key='shop_company_name'),'') <> '',
    'org_number',      coalesce((select v from s where key='shop_company_org_number'),'') <> '',
    'address',         coalesce((select v from s where key='shop_company_address'),'') <> '',
    'support_email',   coalesce((select v from s where key='shop_support_email'),'') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$',
    'delivery_text',   coalesce((select v from s where key='shop_delivery_text'),'') <> '',
    'delivery_method', coalesce((select v from s where key='shop_delivery_method'),'') <> '',
    'terms_reviewed',  coalesce((select v from s where key='shop_terms_reviewed_at'),'null') not in ('','null'),
    'public_enabled',  coalesce((select v from s where key='shop_public_enabled'),'false') in ('true','1')
  );
$$;
grant execute on function public.shop_launch_checklist() to authenticated;

-- Säkerställ att butiken förblir avstängd tills checklistan är komplett
update public.system_settings set value = 'false'::jsonb where key = 'shop_public_enabled';

-- 3) Admin-RPC: uppdatera fulfillment säkert, bevara timestamps
create or replace function public.shop_admin_update_order_fulfillment(
  p_order_id uuid,
  p_fulfillment_status text,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.shop_orders%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_fulfillment_status not in ('new','processing','packed','shipped','completed','canceled') then
    raise exception 'invalid_fulfillment_status' using errcode = '22023';
  end if;

  if p_tracking_url is not null and length(p_tracking_url) > 0
     and p_tracking_url !~* '^https?://'
  then
    raise exception 'invalid_tracking_url' using errcode = '22023';
  end if;

  select * into v_order from public.shop_orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  update public.shop_orders
     set fulfillment_status = p_fulfillment_status,
         tracking_number   = nullif(coalesce(p_tracking_number, ''), ''),
         tracking_url      = nullif(coalesce(p_tracking_url,   ''), ''),
         admin_note        = case when p_admin_note is null then admin_note
                                  when length(btrim(p_admin_note)) = 0 then null
                                  else p_admin_note end,
         shipped_at        = case when p_fulfillment_status = 'shipped'   and v_order.shipped_at   is null then now() else v_order.shipped_at end,
         completed_at      = case when p_fulfillment_status = 'completed' and v_order.completed_at is null then now() else v_order.completed_at end
   where id = p_order_id;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.shop_admin_update_order_fulfillment(uuid, text, text, text, text) from public;
grant execute on function public.shop_admin_update_order_fulfillment(uuid, text, text, text, text) to authenticated;

-- 4) Historikkoll för varianter (räknar hur många ordrar variantens id snapshotats i)
create or replace function public.shop_variant_order_usage(p_variant_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.shop_orders o
   where public.has_role(auth.uid(), 'admin')
     and exists (
       select 1 from jsonb_array_elements(o.items) it
        where (it->>'variant_id')::uuid = p_variant_id
     );
$$;
grant execute on function public.shop_variant_order_usage(uuid) to authenticated;
