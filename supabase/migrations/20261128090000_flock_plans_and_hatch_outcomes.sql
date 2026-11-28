-- A saved plan only becomes livestock after its owner confirms arrival.
create table public.flock_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  breed text not null check (length(trim(breed)) between 1 and 80),
  quantity integer not null check (quantity between 1 and 100),
  bird_price integer not null check (bird_price between 0 and 100000),
  setup_cost integer not null check (setup_cost between 0 and 10000000),
  arrived_at timestamptz,
  flock_id uuid references public.flocks(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.flock_plans enable row level security;
revoke all on public.flock_plans from public, anon, authenticated;
grant select on public.flock_plans to authenticated;
create policy own_plans on public.flock_plans for select to authenticated using (user_id = (select auth.uid()));
create index flock_plans_owner on public.flock_plans(user_id,created_at);

create function public.save_flock_plan(p_id uuid, p_breed text, p_quantity integer, p_bird_price integer, p_setup_cost integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  if auth.uid() is null then raise exception 'Logga in för att spara planen.'; end if;
  insert into public.flock_plans(id,user_id,breed,quantity,bird_price,setup_cost)
  values (p_id,auth.uid(),trim(p_breed),p_quantity,p_bird_price,p_setup_cost)
  on conflict (id) do update set breed=excluded.breed,quantity=excluded.quantity,
    bird_price=excluded.bird_price,setup_cost=excluded.setup_cost
    where flock_plans.user_id=auth.uid() and flock_plans.arrived_at is null
  returning id into saved;
  if saved is null then raise exception 'Planen kan inte ändras.'; end if;
  return saved;
end $$;

create function public.receive_flock_plan(p_id uuid,p_quantity integer,p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare plan public.flock_plans; flock uuid;
begin
  select * into plan from public.flock_plans where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Planen saknas.'; end if;
  if plan.arrived_at is not null then return plan.flock_id; end if;
  if p_quantity is null or p_quantity not between 1 and 100 or coalesce(length(trim(p_name)),0) not between 1 and 80 then
    raise exception 'Ange flocknamn och antal fåglar.'; end if;
  insert into public.flocks(user_id,name) values(auth.uid(),trim(p_name)) returning id into flock;
  insert into public.hens(user_id,flock_id,name,breed,hen_type,is_active)
    select auth.uid(),flock,plan.breed || ' ' || i,plan.breed,'hen',true from generate_series(1,p_quantity) i;
  update public.flock_plans set quantity=p_quantity,flock_id=flock,arrived_at=now() where id=p_id;
  return flock;
end $$;

alter table public.hatchings add column outcome_session_id uuid references public.hatch_sessions(id) on delete set null,
  add column outcome_date date;

create function public.confirm_hatch_outcome(p_id uuid,p_count integer,p_day date,p_flock uuid,p_mother uuid,p_father uuid,p_add_birds boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare batch public.hatchings; session_id uuid; mother public.hens; father public.hens;
begin
  select * into batch from public.hatchings where id=p_id for update;
  if not found or auth.uid() is null or not coalesce(public.has_farm_role_for_owner(batch.user_id,'editor'),false) then
    raise exception 'Du kan inte ändra den här kläckningen.'; end if;
  if batch.outcome_date is not null then return batch.outcome_session_id; end if;
  if batch.status <> 'incubating' then raise exception 'Kläckningen är redan avslutad.'; end if;
  if p_count is null or p_count not between 0 and least(batch.egg_count,1000) or p_day is null or p_day < batch.start_date or p_day > (now() at time zone 'Europe/Stockholm')::date then
    raise exception 'Kontrollera antal kläckta och datum.'; end if;
  if p_flock is not null and not exists(select 1 from public.flocks where id=p_flock and user_id=batch.user_id) then raise exception 'Välj en flock på samma gård.'; end if;
  if p_mother is not null then
    select * into mother from public.hens where id=p_mother and user_id=batch.user_id and hen_type='hen';
    if not found then raise exception 'Kontrollera modern.'; end if;
  end if;
  if p_father is not null then
    select * into father from public.hens where id=p_father and user_id=batch.user_id and hen_type='rooster';
    if not found then raise exception 'Kontrollera fadern.'; end if;
  end if;
  insert into public.hatch_sessions(user_id,flock_id,name,set_date,expected_hatch_date,actual_hatch_date,eggs_set,eggs_hatched,status)
    values(batch.user_id,p_flock,coalesce(nullif(batch.notes,''),'Kull ' || batch.start_date),batch.start_date,batch.expected_hatch_date,p_day,batch.egg_count,p_count,'hatched')
    returning id into session_id;
  if p_add_birds then
    insert into public.hens(user_id,flock_id,name,birth_date,hen_type,is_active,mother_id,father_id,hatch_session_id)
      select batch.user_id,p_flock,'Kyckling ' || i,p_day,'chick',true,p_mother,p_father,session_id from generate_series(1,p_count) i;
  end if;
  update public.hatchings set status='hatched',hatched_count=p_count,outcome_session_id=session_id,outcome_date=p_day where id=p_id;
  return session_id;
end $$;
revoke all on function public.save_flock_plan(uuid,text,integer,integer,integer), public.receive_flock_plan(uuid,integer,text),
  public.confirm_hatch_outcome(uuid,integer,date,uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.save_flock_plan(uuid,text,integer,integer,integer), public.receive_flock_plan(uuid,integer,text),
  public.confirm_hatch_outcome(uuid,integer,date,uuid,uuid,uuid,boolean) to authenticated;
