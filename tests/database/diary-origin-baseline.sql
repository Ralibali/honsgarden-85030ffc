-- Minimal pre-migration schema for isolated regression tests; never run on a real project.
create role authenticated; create role anon; create role service_role bypassrls;
create schema auth; create schema storage;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table auth.users(id uuid primary key);
create table public.farm_members(user_id uuid, farm_id uuid, role text);
create function public.get_farm_user_ids(_uid uuid) returns setof uuid language sql stable security definer as $$
select _uid union select b.user_id from public.farm_members a join public.farm_members b using(farm_id) where a.user_id=_uid $$;
create function public.has_farm_role_for_owner(_owner_uid uuid, _required_role text default 'viewer') returns boolean language sql stable security definer as $$
select _owner_uid=auth.uid() or exists(select 1 from public.farm_members a join public.farm_members b using(farm_id)
where a.user_id=auth.uid() and b.user_id=_owner_uid and case a.role when 'owner' then 3 when 'editor' then 2 else 1 end >= case _required_role when 'owner' then 3 when 'editor' then 2 else 1 end) $$;
create table public.hens(id uuid primary key, user_id uuid not null, name text, hen_type text, birth_date date, mother_id uuid, father_id uuid);
create table public.hatchings(id uuid primary key, user_id uuid not null);
create table public.health_logs(id uuid primary key default gen_random_uuid(), user_id uuid not null, hen_id uuid references public.hens(id) on delete set null,
 date date not null, description text, type text, created_at timestamptz default now());
alter table public.hens enable row level security;
alter table public.health_logs enable row level security;
alter table public.hatchings enable row level security;
create policy hens_read on public.hens for select to authenticated using(public.has_farm_role_for_owner(user_id,'viewer'));
create policy hens_write on public.hens for update to authenticated using(public.has_farm_role_for_owner(user_id,'editor')) with check(public.has_farm_role_for_owner(user_id,'editor'));
create policy hens_delete on public.hens for delete to authenticated using(public.has_farm_role_for_owner(user_id,'owner'));
create policy health_shared on public.health_logs for all to authenticated using(user_id in(select public.get_farm_user_ids(auth.uid()))) with check(user_id in(select public.get_farm_user_ids(auth.uid())));
create policy hatch_shared on public.hatchings for all to authenticated using(user_id in(select public.get_farm_user_ids(auth.uid()))) with check(user_id in(select public.get_farm_user_ids(auth.uid())));
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
grant usage on schema public, auth, storage to authenticated, anon, service_role;
grant select,insert,update,delete on all tables in schema public,storage to authenticated;
grant select,update on public.health_logs to service_role;
insert into auth.users values('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002'),('10000000-0000-0000-0000-000000000003'),('10000000-0000-0000-0000-000000000004');
insert into public.farm_members values
('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner'),
('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','editor'),
('10000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','viewer');
insert into public.hens(id,user_id,name,hen_type,birth_date) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Blomma','hen','2024-01-01'),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Rosa','hen','2024-01-01'),
('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Ture','rooster','2024-01-01'),
('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Kyckling','chick','2026-09-01'),
('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000003','Annan gård','hen','2024-01-01');
insert into public.health_logs(id,user_id,hen_id,date,description,type) values
('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-01-01','Äldre minne','diary');
insert into public.hatchings values('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
