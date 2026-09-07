-- Shared care: server-checked roles, one completion per day and an immutable audit trail.
alter table public.chore_completions add column previous_due_at timestamptz, add column advanced_due_at timestamptz;
create table public.farm_chore_events (
 id uuid primary key default gen_random_uuid(),
 chore_id uuid references public.daily_chores(id) on delete set null,
 owner_id uuid not null,
 title text not null,
 actor_id uuid,
 actor_name text not null,
 action text not null check(action in ('completed','reopened')),
 care_date date not null,
 created_at timestamptz not null default now()
);
create index farm_chore_events_owner_date_idx on public.farm_chore_events(owner_id,created_at desc);
create index farm_chore_events_chore_idx on public.farm_chore_events(chore_id);
alter table public.farm_chore_events enable row level security;
revoke all on public.farm_chore_events from anon,authenticated;
grant select on public.farm_chore_events to authenticated;
create policy "Farm members read care history" on public.farm_chore_events for select to authenticated using(public.has_farm_role_for_owner(owner_id,'viewer'));

drop policy if exists "Users manage farm chores" on public.daily_chores;
create policy "Read chores by farm role" on public.daily_chores for select to authenticated using(public.has_farm_role_for_owner(user_id,'viewer'));
create policy "Create own chores" on public.daily_chores for insert to authenticated with check(user_id=auth.uid());
create policy "Edit chores by farm role" on public.daily_chores for update to authenticated using(public.has_farm_role_for_owner(user_id,'editor')) with check(public.has_farm_role_for_owner(user_id,'editor'));
create policy "Owners delete chores" on public.daily_chores for delete to authenticated using(public.has_farm_role_for_owner(user_id,'owner'));
drop policy if exists "Users manage farm completions" on public.chore_completions;
create policy "Read completions through chore" on public.chore_completions for select to authenticated using(exists(select 1 from public.daily_chores c where c.id=chore_id and public.has_farm_role_for_owner(c.user_id,'viewer')));
create policy "Editors complete chores as themselves" on public.chore_completions for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.daily_chores c where c.id=chore_id and public.has_farm_role_for_owner(c.user_id,'editor')));
create policy "Editors reopen chores" on public.chore_completions for delete to authenticated using(exists(select 1 from public.daily_chores c where c.id=chore_id and public.has_farm_role_for_owner(c.user_id,'editor')));
-- Existing clients retain INSERT/DELETE through the stricter policies during rollout.
revoke update on public.chore_completions from authenticated;

create function public.record_farm_chore_event() returns trigger language plpgsql security definer set search_path='' as $$
declare v_chore public.daily_chores; v_row public.chore_completions; v_actor text;
begin
 if tg_op='DELETE' then v_row:=old; else v_row:=new; end if;
 select * into v_chore from public.daily_chores where id=v_row.chore_id;
 if not found then return coalesce(new,old); end if;
 if auth.uid() is null then v_actor:='System'; else select coalesce(nullif(display_name,''),'Gårdsmedlem') into v_actor from public.profiles where user_id=auth.uid(); end if;
 insert into public.farm_chore_events(chore_id,owner_id,title,actor_id,actor_name,action,care_date)
 values(v_chore.id,v_chore.user_id,v_chore.title,auth.uid(),coalesce(v_actor,'Gårdsmedlem'),case when tg_op='INSERT' then 'completed' else 'reopened' end,v_row.completed_date);
 return coalesce(new,old);
end $$;
revoke all on function public.record_farm_chore_event() from public,anon,authenticated;
create trigger record_farm_chore_completion after insert or delete on public.chore_completions for each row execute function public.record_farm_chore_event();

create function public.keep_chore_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if new.user_id is distinct from old.user_id then raise exception 'Sysslans ägare kan inte ändras.'; end if;
 return new;
end $$;
revoke all on function public.keep_chore_owner() from public,anon,authenticated;
create trigger keep_chore_owner before update of user_id on public.daily_chores for each row execute function public.keep_chore_owner();

create function public.set_farm_chore_completion(p_chore_id uuid,p_complete boolean,p_date date,p_timezone text default 'Europe/Stockholm',p_completion_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.daily_chores; done public.chore_completions; v_new_id uuid; v_next timestamptz; v_interval interval;
begin
 if auth.uid() is null then raise exception 'Logga in för att ändra skötseln.'; end if;
 if p_complete is null or p_date is null or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Kontrollera datum och tidszon.'; end if;
 if p_date<>(now() at time zone p_timezone)::date then raise exception 'Datumet har ändrats. Hämta dagens skötsel igen.'; end if;
 select * into c from public.daily_chores where id=p_chore_id for update;
 if not found or not coalesce(public.has_farm_role_for_owner(c.user_id,'editor'),false) then raise exception 'Du behöver redigeringsbehörighet för den här sysslan.'; end if;
 select * into done from public.chore_completions where chore_id=c.id and completed_date=p_date;
 if p_complete then
  if done.id is not null then return jsonb_build_object('completed',true,'id',done.id,'alreadyCompleted',true); end if;
  v_interval:=case c.recurrence when 'daily' then interval '1 day' when 'weekly' then interval '7 days' when 'monthly' then interval '1 month' else null end;
  v_next:=case when c.next_due_at is not null and v_interval is not null then ((c.next_due_at at time zone p_timezone)+v_interval) at time zone p_timezone else c.next_due_at end;
  insert into public.chore_completions(chore_id,user_id,completed_date,previous_due_at,advanced_due_at)
   values(c.id,auth.uid(),p_date,c.next_due_at,v_next) on conflict(chore_id,completed_date) do nothing returning id into v_new_id;
  if v_new_id is null then
   select id into v_new_id from public.chore_completions where chore_id=c.id and completed_date=p_date;
   return jsonb_build_object('completed',true,'id',v_new_id,'alreadyCompleted',true);
  end if;
  update public.daily_chores set next_due_at=v_next where id=c.id;
  return jsonb_build_object('completed',true,'id',v_new_id,'alreadyCompleted',false);
 else
  if done.id is null then return jsonb_build_object('completed',false); end if;
  if p_completion_id is null or p_completion_id<>done.id then raise exception 'Sysslan har uppdaterats av någon annan. Hämta senaste uppgifterna före ändringen.'; end if;
  if done.advanced_due_at is not null and c.next_due_at is not distinct from done.advanced_due_at then
   update public.daily_chores set next_due_at=done.previous_due_at where id=c.id;
  end if;
  delete from public.chore_completions where id=done.id;
  return jsonb_build_object('completed',false);
 end if;
end $$;
revoke all on function public.set_farm_chore_completion(uuid,boolean,date,text,uuid) from public,anon;
grant execute on function public.set_farm_chore_completion(uuid,boolean,date,text,uuid) to authenticated;
notify pgrst,'reload schema';
