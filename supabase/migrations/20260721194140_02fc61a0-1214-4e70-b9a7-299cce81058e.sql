
-- Launch gate: prevent enabling shop_public_enabled unless required fields are set.

create or replace function public.enforce_shop_launch_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_enabled boolean;
  v_name text;
  v_org  text;
  v_addr text;
  v_supp text;
  v_delivery text;
  v_reviewed text;
begin
  if NEW.key <> 'shop_public_enabled' then
    return NEW;
  end if;

  -- Only guard when the value is being set to true
  begin
    v_enabled := (NEW.value::text in ('true','"true"','1','"1"'));
  exception when others then
    v_enabled := false;
  end;

  if not v_enabled then
    return NEW;
  end if;

  select value::text into v_name     from public.system_settings where key = 'shop_company_name';
  select value::text into v_org      from public.system_settings where key = 'shop_company_org_number';
  select value::text into v_addr     from public.system_settings where key = 'shop_company_address';
  select value::text into v_supp     from public.system_settings where key = 'shop_support_email';
  select value::text into v_delivery from public.system_settings where key = 'shop_delivery_text';
  select value::text into v_reviewed from public.system_settings where key = 'shop_terms_reviewed_at';

  if coalesce(btrim(v_name, '"'), '') = ''
     or coalesce(btrim(v_org, '"'), '') = ''
     or coalesce(btrim(v_addr, '"'), '') = ''
     or coalesce(btrim(v_supp, '"'), '') = ''
     or coalesce(btrim(v_delivery, '"'), '') = ''
     or v_reviewed is null or v_reviewed = 'null' or btrim(v_reviewed, '"') = ''
  then
    raise exception 'launch_gate_incomplete: fyll i företagsuppgifter, leveranstext och markera köpvillkoren som granskade innan publik butik kan aktiveras.'
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_shop_launch_gate on public.system_settings;
create trigger trg_enforce_shop_launch_gate
  before insert or update on public.system_settings
  for each row execute function public.enforce_shop_launch_gate();

-- Helper: returns launch checklist as jsonb (admin only via has_role check in view layer)
create or replace function public.shop_launch_checklist()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select key, btrim(value::text, '"') as v from public.system_settings
     where key in ('shop_company_name','shop_company_org_number','shop_company_address',
                   'shop_support_email','shop_delivery_text','shop_terms_reviewed_at',
                   'shop_public_enabled')
  )
  select jsonb_build_object(
    'company_name',    coalesce((select v from s where key='shop_company_name'),'') <> '',
    'org_number',      coalesce((select v from s where key='shop_company_org_number'),'') <> '',
    'address',         coalesce((select v from s where key='shop_company_address'),'') <> '',
    'support_email',   coalesce((select v from s where key='shop_support_email'),'') <> '',
    'delivery_text',   coalesce((select v from s where key='shop_delivery_text'),'') <> '',
    'terms_reviewed',  coalesce((select v from s where key='shop_terms_reviewed_at'),'null') not in ('','null'),
    'public_enabled',  coalesce((select v from s where key='shop_public_enabled'),'false') in ('true','1')
  );
$$;

grant execute on function public.shop_launch_checklist() to authenticated;
