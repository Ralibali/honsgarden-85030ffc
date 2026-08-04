-- 20260420120000_seo_content_engine.sql
-- seo-content engine for hönsgården. all objects use seo_ prefix to avoid collisions.

create table if not exists public.seo_settings (
  id uuid primary key default gen_random_uuid(),
  public_routes_enabled boolean not null default false,
  llms_txt_enabled boolean not null default false,
  default_ai_model text not null default 'claude-3-5-sonnet-20241022',
  default_medical_disclaimer text,
  editorial_org_name text not null default 'Hönsgårdens redaktion',
  last_sitemap_ping_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.seo_settings is 'seo engine feature flags and global content generation configuration.';

create table if not exists public.seo_breeds (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_latin text,
  name_alt text[],
  summary text,
  origin_country text,
  breed_group text,
  is_swedish_landrace boolean default false,
  avg_eggs_per_year int,
  egg_color text,
  egg_size text,
  adult_weight_hen_kg numeric(3,1),
  adult_weight_rooster_kg numeric(3,1),
  temperament text,
  cold_hardy boolean,
  broody_tendency text,
  noise_level text,
  space_requirement_m2_per_hen numeric(3,1),
  beginner_friendly boolean,
  conservation_status text,
  key_facts jsonb,
  content text,
  faq jsonb,
  authoritative_sources jsonb,
  medical_disclaimer text,
  medically_reviewed_by text,
  reviewed_at timestamptz,
  meta_title text,
  meta_description text,
  og_image_url text,
  generation_status text not null default 'pending' check (generation_status in ('pending','generating','completed','failed')),
  ai_model_used text,
  last_generated_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.seo_breeds is 'seo landing pages for chicken breeds with structured facts, sources and ymyl review fields.';

create table if not exists public.seo_problems (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_alt text[],
  category text not null,
  severity text,
  is_notifiable boolean default false,
  is_zoonotic boolean default false,
  summary text,
  symptoms jsonb,
  causes jsonb,
  diagnosis_steps jsonb,
  treatment_overview text,
  prevention_steps jsonb,
  when_to_call_vet text,
  key_facts jsonb,
  content text,
  faq jsonb,
  authoritative_sources jsonb,
  medical_disclaimer text,
  medically_reviewed_by text,
  reviewed_at timestamptz,
  meta_title text,
  meta_description text,
  og_image_url text,
  generation_status text not null default 'pending' check (generation_status in ('pending','generating','completed','failed')),
  ai_model_used text,
  last_generated_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.seo_problems is 'ymyl seo content for chicken health problems, symptoms and diseases with sources and review fields.';

create table if not exists public.seo_care_topics (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  intent text,
  difficulty_level text,
  time_required text,
  cost_estimate_sek text,
  summary text,
  key_facts jsonb,
  howto_steps jsonb,
  required_materials jsonb,
  content text,
  faq jsonb,
  authoritative_sources jsonb,
  meta_title text,
  meta_description text,
  og_image_url text,
  generation_status text not null default 'pending' check (generation_status in ('pending','generating','completed','failed')),
  ai_model_used text,
  last_generated_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.seo_care_topics is 'non-medical seo guide pages for chicken care topics, how-to steps and source references.';

create table if not exists public.seo_months (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  month_number int unique not null check (month_number between 1 and 12),
  name text not null,
  summary text,
  temperature_considerations text,
  daylight_considerations text,
  typical_tasks jsonb,
  common_problems_this_month jsonb,
  egg_production_expectation text,
  key_facts jsonb,
  content text,
  faq jsonb,
  meta_title text,
  meta_description text,
  og_image_url text,
  generation_status text not null default 'pending' check (generation_status in ('pending','generating','completed','failed')),
  ai_model_used text,
  last_generated_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.seo_months is 'seasonal seo pages for each month with tasks, expectations and common monthly problems.';

create table if not exists public.seo_problem_breeds (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.seo_problems(id) on delete cascade,
  breed_id uuid not null references public.seo_breeds(id) on delete cascade,
  note text,
  unique(problem_id, breed_id)
);
comment on table public.seo_problem_breeds is 'relations between seo health problems and breeds where the problem is especially relevant.';

create table if not exists public.seo_indexing_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null default 'publish',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
comment on table public.seo_indexing_queue is 'internal queue for seo indexing events created when content is published.';

insert into public.seo_settings (public_routes_enabled, llms_txt_enabled, default_ai_model, editorial_org_name)
select false, false, 'claude-3-5-sonnet-20241022', 'Hönsgårdens redaktion'
where not exists (select 1 from public.seo_settings);

insert into public.seo_months (slug, month_number, name, generation_status)
values
  ('januari', 1, 'Januari', 'pending'),
  ('februari', 2, 'Februari', 'pending'),
  ('mars', 3, 'Mars', 'pending'),
  ('april', 4, 'April', 'pending'),
  ('maj', 5, 'Maj', 'pending'),
  ('juni', 6, 'Juni', 'pending'),
  ('juli', 7, 'Juli', 'pending'),
  ('augusti', 8, 'Augusti', 'pending'),
  ('september', 9, 'September', 'pending'),
  ('oktober', 10, 'Oktober', 'pending'),
  ('november', 11, 'November', 'pending'),
  ('december', 12, 'December', 'pending')
on conflict (month_number) do nothing;

create index if not exists idx_seo_breeds_published on public.seo_breeds (published);
create index if not exists idx_seo_breeds_generation_status on public.seo_breeds (generation_status);
create index if not exists idx_seo_problems_published on public.seo_problems (published);
create index if not exists idx_seo_problems_generation_status on public.seo_problems (generation_status);
create index if not exists idx_seo_problems_category on public.seo_problems (category);
create index if not exists idx_seo_care_topics_published on public.seo_care_topics (published);
create index if not exists idx_seo_care_topics_generation_status on public.seo_care_topics (generation_status);
create index if not exists idx_seo_care_topics_category on public.seo_care_topics (category);
create index if not exists idx_seo_months_published on public.seo_months (published);
create index if not exists idx_seo_months_generation_status on public.seo_months (generation_status);
create index if not exists idx_seo_problem_breeds_problem_id on public.seo_problem_breeds (problem_id);
create index if not exists idx_seo_problem_breeds_breed_id on public.seo_problem_breeds (breed_id);
create index if not exists idx_seo_indexing_queue_processed_at on public.seo_indexing_queue (processed_at);
create index if not exists idx_seo_indexing_queue_entity on public.seo_indexing_queue (entity_type, entity_id);

create or replace function public.seo_public_routes_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select public_routes_enabled from public.seo_settings order by created_at asc limit 1), false)
$$;

create or replace function public.seo_enqueue_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.published = false and new.published = true then
    insert into public.seo_indexing_queue (entity_type, entity_id, action)
    values (tg_table_name, new.id, 'publish');
  end if;
  return new;
end;
$$;

alter table public.seo_settings enable row level security;
alter table public.seo_breeds enable row level security;
alter table public.seo_problems enable row level security;
alter table public.seo_care_topics enable row level security;
alter table public.seo_months enable row level security;
alter table public.seo_problem_breeds enable row level security;
alter table public.seo_indexing_queue enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_settings' and policyname = 'seo_settings public read') then
    create policy "seo_settings public read" on public.seo_settings
    for select to anon, authenticated
    using (true);
    comment on policy "seo_settings public read" on public.seo_settings is 'allows clients to read seo feature flags and global public seo configuration.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_settings' and policyname = 'seo_settings admin write') then
    create policy "seo_settings admin write" on public.seo_settings
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role))
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
    comment on policy "seo_settings admin write" on public.seo_settings is 'allows only admins to change seo feature flags and global configuration.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_breeds' and policyname = 'seo_breeds public read published anon') then
    create policy "seo_breeds public read published anon" on public.seo_breeds
    for select to anon
    using (published = true and public.seo_public_routes_enabled());
    comment on policy "seo_breeds public read published anon" on public.seo_breeds is 'allows visitors to read only published breed pages when seo public routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_breeds' and policyname = 'seo_breeds public read published authenticated') then
    create policy "seo_breeds public read published authenticated" on public.seo_breeds
    for select to authenticated
    using (published = true and public.seo_public_routes_enabled());
    comment on policy "seo_breeds public read published authenticated" on public.seo_breeds is 'allows signed-in users to read only published breed pages when seo public routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_breeds' and policyname = 'seo_breeds admin full access') then
    create policy "seo_breeds admin full access" on public.seo_breeds
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role))
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
    comment on policy "seo_breeds admin full access" on public.seo_breeds is 'allows admins to manage breed seo content through the editorial system.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_problems' and policyname = 'seo_problems public read published anon') then
    create policy "seo_problems public read published anon" on public.seo_problems
    for select to anon
    using (published = true and public.seo_public_routes_enabled());
    comment on policy "seo_problems public read published anon" on public.seo_problems is 'allows visitors to read only published ymyl problem pages when seo public routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_problems' and policyname = 'seo_problems public read published authenticated') then
    create policy "seo_problems public read published authenticated" on public.seo_problems
    for select to authenticated
    using (published = true and public.seo_public_routes_enabled());
    comment on policy "seo_problems public read published authenticated" on public.seo_problems is 'allows signed-in users to read only published ymyl problem pages when seo public routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_problems' and policyname = 'seo_problems admin full access') then
    create policy "seo_problems admin full access" on public.seo_problems
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role))
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
    comment on policy "seo_problems admin full access" on public.seo_problems is 'allows admins to manage ymyl health seo content and review metadata.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_care_topics' and policyname = 'seo_care_topics public read published anon') then
    create policy "seo_care_topics public read published anon" on public.seo_care_topics
    for select to anon
    using (published = true and public.seo_public_routes_enabled());
    comment on policy "seo_care_topics public read published anon" on public.seo_care_topics is 'allows visitors to read only published care guide pages when seo public routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_care_topics' and policyname = 'seo_care_topics public read published authenticated') then
    create policy "seo_care_topics public read published authenticated" on public.seo_care_topics
    for select to authenticated
    using (published = true and public.seo_public_routes_enabled());
    comment on policy "seo_care_topics public read published authenticated" on public.seo_care_topics is 'allows signed-in users to read only published care guide pages when seo public routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_care_topics' and policyname = 'seo_care_topics admin full access') then
    create policy "seo_care_topics admin full access" on public.seo_care_topics
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role))
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
    comment on policy "seo_care_topics admin full access" on public.seo_care_topics is 'allows admins to manage non-medical seo guide content.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_months' and policyname = 'seo_months public read published anon') then
    create policy "seo_months public read published anon" on public.seo_months
    for select to anon
    using (published = true and public.seo_public_routes_enabled());
    comment on policy "seo_months public read published anon" on public.seo_months is 'allows visitors to read only published seasonal month pages when seo public routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_months' and policyname = 'seo_months public read published authenticated') then
    create policy "seo_months public read published authenticated" on public.seo_months
    for select to authenticated
    using (published = true and public.seo_public_routes_enabled());
    comment on policy "seo_months public read published authenticated" on public.seo_months is 'allows signed-in users to read only published seasonal month pages when seo public routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_months' and policyname = 'seo_months admin full access') then
    create policy "seo_months admin full access" on public.seo_months
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role))
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
    comment on policy "seo_months admin full access" on public.seo_months is 'allows admins to manage seasonal seo pages.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_problem_breeds' and policyname = 'seo_problem_breeds public read published anon') then
    create policy "seo_problem_breeds public read published anon" on public.seo_problem_breeds
    for select to anon
    using (
      public.seo_public_routes_enabled()
      and exists (select 1 from public.seo_problems p where p.id = problem_id and p.published = true)
      and exists (select 1 from public.seo_breeds b where b.id = breed_id and b.published = true)
    );
    comment on policy "seo_problem_breeds public read published anon" on public.seo_problem_breeds is 'allows visitors to read breed-problem relations only when linked content is published and public seo routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_problem_breeds' and policyname = 'seo_problem_breeds public read published authenticated') then
    create policy "seo_problem_breeds public read published authenticated" on public.seo_problem_breeds
    for select to authenticated
    using (
      public.seo_public_routes_enabled()
      and exists (select 1 from public.seo_problems p where p.id = problem_id and p.published = true)
      and exists (select 1 from public.seo_breeds b where b.id = breed_id and b.published = true)
    );
    comment on policy "seo_problem_breeds public read published authenticated" on public.seo_problem_breeds is 'allows signed-in users to read breed-problem relations only when linked content is published and public seo routes are enabled.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_problem_breeds' and policyname = 'seo_problem_breeds admin full access') then
    create policy "seo_problem_breeds admin full access" on public.seo_problem_breeds
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role))
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
    comment on policy "seo_problem_breeds admin full access" on public.seo_problem_breeds is 'allows admins to manage breed-problem relations.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seo_indexing_queue' and policyname = 'seo_indexing_queue admin full access') then
    create policy "seo_indexing_queue admin full access" on public.seo_indexing_queue
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'::public.app_role))
    with check (public.has_role(auth.uid(), 'admin'::public.app_role));
    comment on policy "seo_indexing_queue admin full access" on public.seo_indexing_queue is 'allows admins to inspect and manage seo indexing jobs; public users cannot read the queue.';
  end if;
end $$;

drop trigger if exists update_seo_settings_updated_at on public.seo_settings;
create trigger update_seo_settings_updated_at
before update on public.seo_settings
for each row execute function public.update_updated_at_column();

drop trigger if exists update_seo_breeds_updated_at on public.seo_breeds;
create trigger update_seo_breeds_updated_at
before update on public.seo_breeds
for each row execute function public.update_updated_at_column();

drop trigger if exists update_seo_problems_updated_at on public.seo_problems;
create trigger update_seo_problems_updated_at
before update on public.seo_problems
for each row execute function public.update_updated_at_column();

drop trigger if exists update_seo_care_topics_updated_at on public.seo_care_topics;
create trigger update_seo_care_topics_updated_at
before update on public.seo_care_topics
for each row execute function public.update_updated_at_column();

drop trigger if exists update_seo_months_updated_at on public.seo_months;
create trigger update_seo_months_updated_at
before update on public.seo_months
for each row execute function public.update_updated_at_column();

drop trigger if exists enqueue_seo_breeds_publish on public.seo_breeds;
create trigger enqueue_seo_breeds_publish
after update of published on public.seo_breeds
for each row execute function public.seo_enqueue_publish();

drop trigger if exists enqueue_seo_problems_publish on public.seo_problems;
create trigger enqueue_seo_problems_publish
after update of published on public.seo_problems
for each row execute function public.seo_enqueue_publish();

drop trigger if exists enqueue_seo_care_topics_publish on public.seo_care_topics;
create trigger enqueue_seo_care_topics_publish
after update of published on public.seo_care_topics
for each row execute function public.seo_enqueue_publish();

drop trigger if exists enqueue_seo_months_publish on public.seo_months;
create trigger enqueue_seo_months_publish
after update of published on public.seo_months
for each row execute function public.seo_enqueue_publish();