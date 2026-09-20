-- Commerce Strategy v2: domain attributes for explainable, flock-aware recommendations.
-- Based on the 2026 commerce research. Unknown/medical risk is fail-closed.

create table if not exists public.product_commerce_profiles (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('affiliate','own')),
  product_id uuid not null,
  risk_class text not null default 'unknown'
    check (risk_class in (
      'unknown',
      'fri_zon',
      'biocid_registrering_kravs',
      'apoteksvara',
      'veterinar_hanvisning'
    )),
  biocide_registration_verified boolean not null default false,
  regulatory_note text,
  capacity_hens_min integer check (capacity_hens_min is null or capacity_hens_min >= 0),
  capacity_hens_max integer check (
    capacity_hens_max is null or capacity_hens_max >= 0
  ),
  package_size_kg numeric check (package_size_kg is null or package_size_kg > 0),
  capacity_liters numeric check (capacity_liters is null or capacity_liters > 0),
  floor_area_m2 numeric check (floor_area_m2 is null or floor_area_m2 > 0),
  material text,
  power_source text check (
    power_source is null or power_source in ('battery','mains_230v','solar','manual','other')
  ),
  control_modes text[] not null default '{}',
  winter_rated boolean,
  frost_resistant boolean,
  predator_protection_level text check (
    predator_protection_level is null or predator_protection_level in ('none','partial','high')
  ),
  life_stages text[] not null default '{}',
  use_cases text[] not null default '{}',
  season_months smallint[] not null default '{}',
  recommendation_priority smallint not null default 3
    check (recommendation_priority between 1 and 5),
  test_status text not null default 'unverified'
    check (test_status in ('unverified','partner_data','forum_consensus','tested_by_us')),
  evidence_source text,
  commission_rate numeric check (commission_rate is null or commission_rate between 0 and 1),
  margin_tier text check (margin_tier is null or margin_tier in ('low','medium','high')),
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_type, product_id),
  check (
    capacity_hens_min is null
    or capacity_hens_max is null
    or capacity_hens_max >= capacity_hens_min
  )
);

create index if not exists product_commerce_profiles_source_idx
  on public.product_commerce_profiles(source_type, product_id);
create index if not exists product_commerce_profiles_risk_idx
  on public.product_commerce_profiles(risk_class);
create index if not exists product_commerce_profiles_season_idx
  on public.product_commerce_profiles using gin(season_months);

alter table public.product_commerce_profiles enable row level security;

drop policy if exists "Admins read commerce profiles" on public.product_commerce_profiles;
create policy "Admins read commerce profiles"
  on public.product_commerce_profiles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins manage commerce profiles" on public.product_commerce_profiles;
create policy "Admins manage commerce profiles"
  on public.product_commerce_profiles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.product_commerce_profiles to authenticated;
grant all on public.product_commerce_profiles to service_role;

-- Existing affiliate categories that are clearly equipment/feed/housing are seeded
-- as free-zone. Tillskott is intentionally left unknown until reviewed.
insert into public.product_commerce_profiles (
  source_type,
  product_id,
  risk_class,
  use_cases,
  season_months,
  recommendation_priority,
  test_status,
  evidence_source
)
select
  'affiliate',
  p.id,
  case
    when p.category in ('vatten','redskap','foder','hus','staengsel','klackning','vaerme','startset')
      then 'fri_zon'
    else 'unknown'
  end,
  case
    when p.category = 'vatten' then array['water']
    when p.category = 'foder' then array['feeding']
    when p.category = 'hus' then array['housing']
    when p.category = 'staengsel' then array['fencing']
    when p.category = 'klackning' then array['hatching']
    when p.category = 'vaerme' then array['winter']
    when p.category = 'startset' then array['starter']
    else array['general']
  end,
  case
    when p.category = 'klackning' then array[2,3,4]::smallint[]
    when p.category in ('hus','staengsel','startset') then array[3,4,5]::smallint[]
    when p.category = 'vaerme' then array[9,10,11,12,1,2]::smallint[]
    when p.category = 'vatten' then array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
    when p.category = 'foder' then array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
    else '{}'::smallint[]
  end,
  case
    when p.category in ('hus','klackning') then 4
    else 3
  end,
  'partner_data',
  'Backfill from existing normalized affiliate category'
from public.affiliate_products p
where p.is_active
on conflict (source_type, product_id) do nothing;

-- Seed only clearly non-medical own-shop categories. Unknown/new categories fail closed.
insert into public.product_commerce_profiles (
  source_type,
  product_id,
  risk_class,
  use_cases,
  season_months,
  recommendation_priority,
  test_status,
  evidence_source
)
select
  'own',
  p.id,
  case
    when lower(coalesce(p.category,'')) in ('kläder','kök','förpackning') then 'fri_zon'
    else 'unknown'
  end,
  array['own_shop'],
  '{}'::smallint[],
  4,
  'tested_by_us',
  'Hönsgården own shop'
from public.shop_products p
where p.active
on conflict (source_type, product_id) do nothing;

create or replace function public.product_commerce_profiles_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists product_commerce_profiles_touch on public.product_commerce_profiles;
create trigger product_commerce_profiles_touch
  before update on public.product_commerce_profiles
  for each row execute function public.product_commerce_profiles_touch_updated_at();
