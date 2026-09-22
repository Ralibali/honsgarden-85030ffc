-- Read-only. Run after the migration commits; every *_ok should be true,
-- missing_legacy_links and dangling_diary_objects should be zero.
select
  exists(select 1 from supabase_migrations.schema_migrations where version = '20260920123852') as history_ok,
  (select count(*) = 2 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('diary_entry_hens','brood_origins')) as new_rls_ok,
  exists(select 1 from storage.buckets where id = 'diary-photos' and not public and file_size_limit = 5242880
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
    and cardinality(allowed_mime_types) = 3) as bucket_ok,
  has_function_privilege('authenticated','public.save_diary_entry(uuid,boolean,date,text,uuid[],text[],text)','EXECUTE')
    and not has_function_privilege('anon','public.save_diary_entry(uuid,boolean,date,text,uuid[],text[],text)','EXECUTE') as diary_rpc_ok,
  has_function_privilege('service_role','public.detach_diary_photos_for_deleted_uploader(uuid)','EXECUTE')
    and not has_function_privilege('authenticated','public.detach_diary_photos_for_deleted_uploader(uuid)','EXECUTE')
    and not has_function_privilege('anon','public.detach_diary_photos_for_deleted_uploader(uuid)','EXECUTE') as cleanup_rpc_ok,
  (select count(*) from public.health_logs) as health_log_count,
  (select count(*) from public.health_logs l where l.type = 'diary' and l.hen_id is not null and not exists (
    select 1 from public.diary_entry_hens d where d.entry_id = l.id and d.hen_id = l.hen_id)) as missing_legacy_links,
  (select count(*) from public.health_logs l cross join lateral unnest(l.image_paths) p
    where not exists(select 1 from storage.objects o where o.bucket_id = 'diary-photos' and o.name = p)) as dangling_diary_objects;

-- Metadata existence alone cannot prove that Storage serves actual bytes.
-- Follow with test-diary-storage-live.mjs in staging and the browser checklist.
