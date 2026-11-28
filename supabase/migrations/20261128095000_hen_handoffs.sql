create table public.hen_handoffs (
  token uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  hen_id uuid not null references public.hens(id) on delete cascade, payload jsonb not null,
  expires_at timestamptz not null default now()+interval '7 days', revoked_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null, imported_id uuid references public.hens(id) on delete set null
);
create index hen_handoffs_hen on public.hen_handoffs(hen_id,expires_at desc);
alter table public.hen_handoffs enable row level security;
revoke all on public.hen_handoffs from public,anon,authenticated;
grant select(token,hen_id,expires_at,revoked_at),update(revoked_at) on public.hen_handoffs to authenticated;
create policy own_hen_handoffs on public.hen_handoffs for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());

create function public.create_hen_handoff(p_hen uuid,p_photo boolean,p_parents boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare bird public.hens; payload jsonb; pass uuid;
begin
 select * into bird from public.hens where id=p_hen and user_id=auth.uid() for update;
 if not found then raise exception 'Välj en fågel som tillhör dig.'; end if;
 payload:=jsonb_build_object('name',bird.name,'breed',bird.breed,'birth_date',bird.birth_date,'hen_type',bird.hen_type,'color',bird.color,
   'photo',case when p_photo and bird.image_url like 'https://%' then bird.image_url end,
   'mother',case when p_parents then (select name from public.hens where id=bird.mother_id and user_id=bird.user_id) end,
   'father',case when p_parents then (select name from public.hens where id=bird.father_id and user_id=bird.user_id) end);
 update public.hen_handoffs set revoked_at=now() where hen_id=p_hen and revoked_at is null;
 insert into public.hen_handoffs(owner_id,hen_id,payload) values(bird.user_id,bird.id,payload) returning token into pass;
 return pass;
end $$;
create function public.read_hen_handoff(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select payload || jsonb_build_object('expires',expires_at,'imported',imported_id is not null)
 from public.hen_handoffs where token=p_token and expires_at>now() and revoked_at is null and (claimed_by is null or claimed_by=auth.uid() or owner_id=auth.uid());
$$;
create function public.receive_hen_handoff(p_token uuid,p_flock uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare pass public.hen_handoffs; uid uuid:=auth.uid(); payload jsonb; imported uuid; parent_note text;
begin
 select * into pass from public.hen_handoffs where token=p_token for update;
 if uid is null or not found or pass.revoked_at is not null or pass.expires_at<=now() or pass.owner_id=uid then raise exception 'Passet är inte tillgängligt för inflyttning.'; end if;
 if pass.claimed_by is not null then
   if pass.claimed_by=uid and pass.imported_id is not null then return pass.imported_id; end if;
   raise exception 'Passet är redan använt.';
 end if;
 if p_flock is not null and not exists(select 1 from public.flocks where id=p_flock and user_id=uid) then raise exception 'Välj din egen flock.'; end if;
 payload:=pass.payload;
 parent_note:=nullif(concat_ws(E'\n',case when payload->>'mother' is not null then 'Mor enligt hönspasset: '||(payload->>'mother') end,case when payload->>'father' is not null then 'Far enligt hönspasset: '||(payload->>'father') end),'');
 insert into public.hens(user_id,name,breed,hen_type,birth_date,color,image_url,notes,flock_id,is_active)
 values(uid,payload->>'name',payload->>'breed',payload->>'hen_type',(payload->>'birth_date')::date,payload->>'color',payload->>'photo',parent_note,p_flock,true) returning id into imported;
 update public.hen_handoffs set imported_id=imported,claimed_by=uid where token=p_token;
 return imported;
end $$;
revoke all on function public.create_hen_handoff(uuid,boolean,boolean),public.read_hen_handoff(uuid),public.receive_hen_handoff(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_hen_handoff(uuid,boolean,boolean),public.receive_hen_handoff(uuid,uuid) to authenticated;
grant execute on function public.read_hen_handoff(uuid) to anon,authenticated;
