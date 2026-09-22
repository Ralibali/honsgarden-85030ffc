-- Read-only. Run on the explicitly identified target BEFORE applying PR #72.
select current_database() as database_name, current_user as operator,
  current_setting('server_version') as postgres_version,
  exists(select 1 from supabase_migrations.schema_migrations where version = '20260920123852') as migration_recorded,
  to_regprocedure('public.get_farm_user_ids(uuid)') is not null as farm_helper_exists,
  to_regprocedure('public.has_farm_role_for_owner(uuid,text)') is not null as role_helper_exists,
  to_regclass('public.diary_entry_hens') is null as diary_links_absent,
  to_regclass('public.brood_origins') is null as brood_origins_absent,
  not exists(select 1 from storage.buckets where id = 'diary-photos') as diary_bucket_absent,
  (select count(*) from information_schema.columns where table_schema = 'public' and
    ((table_name = 'health_logs' and column_name in ('image_paths','milestone')) or
     (table_name = 'hens' and column_name in ('origin_genbank_number','brood_origin_id')))) as new_columns_present,
  (select count(*) from public.health_logs) as health_log_count,
  (select count(*) from public.health_logs where type = 'diary' and hen_id is not null) as legacy_links_to_backfill,
  (select count(*) from public.health_logs l left join public.hens h on h.id = l.hen_id
    where l.type = 'diary' and l.hen_id is not null and h.id is null) as broken_legacy_links,
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('health_logs','hens','hatchings')) as existing_rls_enabled;

-- Review definitions against the tested baseline, including existing permissive
-- policies: one broad Storage policy can override the new bucket-specific policy.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where (schemaname = 'storage' and tablename = 'objects') or
  (schemaname = 'public' and tablename in ('health_logs','hens','hatchings','farm_members'))
order by schemaname, tablename, policyname;
