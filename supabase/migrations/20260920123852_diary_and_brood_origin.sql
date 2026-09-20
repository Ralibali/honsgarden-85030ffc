-- Additive: keep legacy diary entries and confirmed mother/father relationships.
alter table public.health_logs
  add column image_paths text[] not null default '{}',
  add column milestone text,
  add constraint diary_image_limit check (cardinality(image_paths) <= 5),
  add constraint diary_milestone check (milestone is null or milestone in ('first_egg','arrival','brooding','hatching','other'));

create table public.diary_entry_hens (
  entry_id uuid not null references public.health_logs(id) on delete cascade,
  hen_id uuid not null references public.hens(id) on delete cascade,
  primary key (entry_id, hen_id)
);
create index diary_entry_hens_hen_idx on public.diary_entry_hens(hen_id, entry_id);
alter table public.diary_entry_hens enable row level security;
grant select, insert, delete on public.diary_entry_hens to authenticated;
create policy "Read diary links in shared farm" on public.diary_entry_hens for select to authenticated
using (exists (select 1 from public.health_logs l where l.id = entry_id and l.user_id in (select public.get_farm_user_ids((select auth.uid())))));
create policy "Add diary links in shared farm" on public.diary_entry_hens for insert to authenticated
with check (exists (select 1 from public.health_logs l join public.hens h on h.id = diary_entry_hens.hen_id
  where l.id = entry_id and l.type = 'diary'
  and l.user_id in (select public.get_farm_user_ids((select auth.uid())))
  and h.user_id in (select public.get_farm_user_ids(l.user_id))));
create policy "Remove diary links in shared farm" on public.diary_entry_hens for delete to authenticated
using (exists (select 1 from public.health_logs l where l.id = entry_id and l.user_id in (select public.get_farm_user_ids((select auth.uid())))));
insert into public.diary_entry_hens(entry_id, hen_id)
select id, hen_id from public.health_logs where type = 'diary' and hen_id is not null;

create function public.validate_diary_images() returns trigger language plpgsql security invoker set search_path = '' as $$
declare p text;
begin
  if new.image_paths = '{}' then return new; end if;
  if new.type is distinct from 'diary' then raise exception 'Bilder hör till dagboksinlägg.'; end if;
  if cardinality(new.image_paths) <> (select count(distinct x) from unnest(new.image_paths) x) then
    raise exception 'Bilden finns redan i inlägget.';
  end if;
  foreach p in array new.image_paths loop
    if p is null or split_part(p, '/', 2) <> new.id::text or p !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' then
      raise exception 'Ogiltig bildreferens.';
    end if;
    if tg_op = 'UPDATE' and p = any(old.image_paths) then continue; end if;
    if split_part(p, '/', 1) is distinct from auth.uid()::text then
      raise exception 'Du kan bara bifoga dina egna uppladdningar.';
    end if;
  end loop;
  return new;
end $$;
create trigger validate_diary_images before insert or update of image_paths, type on public.health_logs
for each row execute function public.validate_diary_images();

-- One transaction for text, photos and all individual links. Stable client IDs make retry safe.
create function public.save_diary_entry(_id uuid, _is_new boolean, _date date, _description text,
  _hen_ids uuid[], _image_paths text[], _milestone text)
returns public.health_logs language plpgsql security invoker set search_path = '' as $$
declare entry public.health_logs; target uuid;
begin
  if auth.uid() is null then raise exception 'Logga in för att spara.'; end if;
  if _date is null or nullif(btrim(_description), '') is null then raise exception 'Ange datum och text.'; end if;
  select * into entry from public.health_logs where id = _id for update;
  if found then
    if entry.type is distinct from 'diary' or entry.user_id not in (select public.get_farm_user_ids(auth.uid())) then
      raise exception 'Du kan inte redigera detta inlägg.';
    end if;
  elsif not _is_new then raise exception 'Inlägget finns inte längre.';
  else
    insert into public.health_logs(id, user_id, date, description, type)
    values(_id, auth.uid(), _date, btrim(_description), 'diary') returning * into entry;
  end if;
  foreach target in array coalesce(_hen_ids, '{}'::uuid[]) loop
    if not exists (select 1 from public.hens h where h.id = target
      and h.user_id in (select public.get_farm_user_ids(entry.user_id))) then
      raise exception 'En vald individ är inte tillgänglig i denna hönsgård.';
    end if;
  end loop;
  update public.health_logs set date = _date, description = btrim(_description),
    image_paths = coalesce(_image_paths, '{}'), milestone = _milestone,
    hen_id = case when cardinality(_hen_ids) = 1 then _hen_ids[1] else null end
    where id = _id returning * into entry;
  delete from public.diary_entry_hens where entry_id = _id;
  insert into public.diary_entry_hens(entry_id, hen_id)
    select _id, x from (select distinct unnest(_hen_ids) x) ids;
  return entry;
end $$;
revoke all on function public.save_diary_entry(uuid,boolean,date,text,uuid[],text[],text) from public, anon;
grant execute on function public.save_diary_entry(uuid,boolean,date,text,uuid[],text[],text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('diary-photos', 'diary-photos', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy "Upload own diary images" on storage.objects for insert to authenticated with check (
  bucket_id = 'diary-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read diary images through entry" on storage.objects for select to authenticated using (
  bucket_id = 'diary-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or exists (
      select 1 from public.health_logs l where storage.objects.name = any(l.image_paths)
      and l.user_id in (select public.get_farm_user_ids((select auth.uid())))
    )
  )
);
-- Deletion only after detachment; a failed cleanup cannot break a saved entry.
create policy "Delete detached diary images" on storage.objects for delete to authenticated using (
  bucket_id = 'diary-photos'
  and (storage.foldername(name))[1] in (select public.get_farm_user_ids((select auth.uid()))::text)
  and not exists (select 1 from public.health_logs l where storage.objects.name = any(l.image_paths))
);

create table public.brood_origins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hatching_id uuid unique references public.hatchings(id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 150),
  date date not null,
  notes text not null default '' check (length(notes) <= 5000),
  parents jsonb not null default '[]' check (jsonb_typeof(parents) = 'array'),
  created_at timestamptz not null default now()
);
create index brood_origins_user_idx on public.brood_origins(user_id);
alter table public.brood_origins enable row level security;
grant select, insert, update, delete on public.brood_origins to authenticated;
create policy "Read brood origins" on public.brood_origins for select to authenticated
using (public.has_farm_role_for_owner(user_id, 'viewer'));
create policy "Create brood origins" on public.brood_origins for insert to authenticated
with check (user_id = (select auth.uid()) and public.has_farm_role_for_owner(user_id, 'editor'));
create policy "Edit brood origins" on public.brood_origins for update to authenticated
using (public.has_farm_role_for_owner(user_id, 'editor')) with check (public.has_farm_role_for_owner(user_id, 'editor'));
create policy "Delete brood origins" on public.brood_origins for delete to authenticated
using (public.has_farm_role_for_owner(user_id, 'owner'));

alter table public.hens add column origin_genbank_number text check (length(origin_genbank_number) <= 100),
  add column brood_origin_id uuid references public.brood_origins(id) on delete set null;
create index hens_brood_origin_idx on public.hens(brood_origin_id) where brood_origin_id is not null;

-- Store a snapshot of each parent. Retained candidates keep their original name and origin,
-- even if moved, renamed or deleted later. No writes to confirmed mother_id/father_id.
create function public.snapshot_brood_parents() returns trigger language plpgsql security invoker set search_path = '' as $$
declare p jsonb; previous jsonb; result jsonb := '[]'; h public.hens; seen uuid[] := '{}'; candidate uuid;
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then raise exception 'Kullens ägare kan inte ändras.'; end if;
  if new.hatching_id is not null and not exists (select 1 from public.hatchings b where b.id = new.hatching_id
    and b.user_id in (select public.get_farm_user_ids(new.user_id))) then raise exception 'Kläckningen är inte tillgänglig.'; end if;
  if jsonb_typeof(new.parents) <> 'array' then raise exception 'Ogiltig föräldragrupp.'; end if;
  for p in select * from jsonb_array_elements(new.parents) loop
    candidate := (p->>'hen_id')::uuid;
    if candidate is null or candidate = any(seen) or coalesce(p->>'role','') not in ('mother','father') then
      raise exception 'Välj varje möjlig förälder en gång.';
    end if;
    if exists(select 1 from public.hens where id = candidate and brood_origin_id = new.id) then
      raise exception 'En individ kan inte vara möjlig förälder till sin egen kull.';
    end if;
    seen := array_append(seen, candidate);
    previous := null;
    if tg_op = 'UPDATE' then
      select x into previous from jsonb_array_elements(old.parents) x
      where x->>'hen_id' = candidate::text and x->>'role' = p->>'role';
    end if;
    if previous is not null then result := result || jsonb_build_array(previous); continue; end if;
    select * into h from public.hens where id = candidate
      and user_id in (select public.get_farm_user_ids(new.user_id));
    if not found then raise exception 'En vald förälder är inte tillgänglig i denna hönsgård.'; end if;
    if (p->>'role' = 'father' and h.hen_type <> 'rooster') or (p->>'role' = 'mother' and h.hen_type = 'rooster') then
      raise exception 'Kontrollera kön på de valda föräldrarna.';
    end if;
    if h.birth_date is not null and h.birth_date > new.date then raise exception 'Föräldern är född efter kullens datum.'; end if;
    result := result || jsonb_build_array(jsonb_build_object('hen_id', h.id, 'role', p->>'role',
      'name', h.name, 'origin_genbank_number', h.origin_genbank_number));
  end loop;
  new.parents := result;
  return new;
end $$;
create trigger snapshot_brood_parents before insert or update on public.brood_origins
for each row execute function public.snapshot_brood_parents();

create function public.validate_hen_brood_origin() returns trigger language plpgsql security invoker set search_path = '' as $$
declare origin public.brood_origins;
begin
  if new.brood_origin_id is null then return new; end if;
  select * into origin from public.brood_origins where id = new.brood_origin_id
    and user_id in (select public.get_farm_user_ids(new.user_id)) for share;
  if not found then raise exception 'Kullen är inte tillgänglig i denna hönsgård.'; end if;
  if exists(select 1 from jsonb_array_elements(origin.parents) p where p->>'hen_id' = new.id::text) then
    raise exception 'En möjlig förälder kan inte tillhöra sin egen kull.';
  end if;
  return new;
end $$;
create trigger validate_hen_brood_origin before insert or update of brood_origin_id, user_id on public.hens
for each row execute function public.validate_hen_brood_origin();
