-- 20260420120500_seo_content_engine_generation_status_completion.sql
-- ensure every seo_ table has generation_status as required.

alter table public.seo_settings
add column if not exists generation_status text not null default 'pending' check (generation_status in ('pending','generating','completed','failed'));

alter table public.seo_problem_breeds
add column if not exists generation_status text not null default 'pending' check (generation_status in ('pending','generating','completed','failed'));

alter table public.seo_indexing_queue
add column if not exists generation_status text not null default 'pending' check (generation_status in ('pending','generating','completed','failed'));

create index if not exists idx_seo_settings_generation_status on public.seo_settings (generation_status);
create index if not exists idx_seo_problem_breeds_generation_status on public.seo_problem_breeds (generation_status);
create index if not exists idx_seo_indexing_queue_generation_status on public.seo_indexing_queue (generation_status);