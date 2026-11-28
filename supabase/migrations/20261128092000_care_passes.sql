create table public.care_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  starts_on date not null, ends_on date not null check(ends_on>=starts_on),
  morning text not null check(length(trim(morning)) between 1 and 1800),
  evening text not null check(length(trim(evening)) between 1 and 1800),
  contact text not null default '' check(length(contact)<=250),
  photo text check(photo is null or (length(photo)<=260000 and photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')),
  revoked_at timestamptz, created_at timestamptz not null default now()
);
create index care_pass_owner on public.care_passes(user_id,starts_on);
create table public.care_rounds(
  pass_id uuid not null references public.care_passes(id) on delete cascade,
  care_day date not null, round text not null check(round in ('morning','evening')),
  eggs integer not null check(eggs between 0 and 500), note text not null check(length(note)<=600),
  created_at timestamptz not null default now(),primary key(pass_id,care_day,round)
);
alter table public.care_passes enable row level security;
alter table public.care_rounds enable row level security;
revoke all on public.care_passes,public.care_rounds from public,anon,authenticated;
grant select on public.care_passes,public.care_rounds to authenticated;
grant insert(id,starts_on,ends_on,morning,evening,contact,photo),update(revoked_at) on public.care_passes to authenticated;
create policy care_owner_read on public.care_passes for select to authenticated using(user_id=(select auth.uid()));
create policy care_owner_create on public.care_passes for insert to authenticated with check(user_id=(select auth.uid()));
create policy care_owner_revoke on public.care_passes for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy care_history_owner on public.care_rounds for select to authenticated using(exists(select 1 from public.care_passes p where p.id=pass_id and p.user_id=(select auth.uid())));

create function public.read_care_pass(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('starts_on',p.starts_on,'ends_on',p.ends_on,'morning',p.morning,'evening',p.evening,
    'contact',p.contact,'photo',p.photo,'day',(now() at time zone 'Europe/Stockholm')::date,'done',
    (select coalesce(jsonb_agg(r.round),'[]'::jsonb) from public.care_rounds r where r.pass_id=p.id and r.care_day=(now() at time zone 'Europe/Stockholm')::date))
  from public.care_passes p where p.token=p_token and p.revoked_at is null and (now() at time zone 'Europe/Stockholm')::date between p.starts_on and p.ends_on;
$$;
create function public.complete_care_round(p_token uuid,p_day date,p_round text,p_eggs integer,p_note text) returns boolean
language plpgsql security definer set search_path='' as $$
declare pass public.care_passes; changed integer;
begin
  select * into pass from public.care_passes where token=p_token and revoked_at is null and (now() at time zone 'Europe/Stockholm')::date between starts_on and ends_on for update;
  if not found then raise exception 'Passet är inte aktivt.'; end if;
  if p_day is distinct from (now() at time zone 'Europe/Stockholm')::date then raise exception 'Dagen har ändrats. Ladda om passet.'; end if;
  insert into public.care_rounds(pass_id,care_day,round,eggs,note) values(pass.id,p_day,p_round,p_eggs,trim(coalesce(p_note,''))) on conflict do nothing;
  get diagnostics changed=row_count;
  if changed=1 and p_eggs>0 then
    insert into public.egg_logs(user_id,date,count,notes) values(pass.user_id,p_day,p_eggs,'Hönsvakt · '||case when p_round='morning' then 'morgon' else 'kväll' end);
  end if;
  return changed=1;
end $$;
revoke all on function public.read_care_pass(uuid), public.complete_care_round(uuid,date,text,integer,text) from public;
grant execute on function public.read_care_pass(uuid), public.complete_care_round(uuid,date,text,integer,text) to anon,authenticated;
