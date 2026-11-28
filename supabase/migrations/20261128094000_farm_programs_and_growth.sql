create table public.farm_program_runs (
  user_id uuid not null references auth.users(id) on delete cascade,
  program text not null, start_day date not null, primary key(user_id,program,start_day)
);
alter table public.farm_program_runs enable row level security;
revoke all on public.farm_program_runs from public,anon,authenticated;
grant select on public.farm_program_runs to authenticated;
create policy own_programs on public.farm_program_runs for select to authenticated using(user_id=auth.uid());

create function public.start_farm_program(p_program text,p_day date) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); today date:=(now() at time zone 'Europe/Stockholm')::date;
begin
  if uid is null or p_program is null or p_program not in ('mina-forsta-hons','vinterklar-honsgard','klack-tillsammans')
    or p_day is null or p_day not between today and today+365 then raise exception 'Välj ett startdatum inom ett år.'; end if;
  if p_program <> 'klack-tillsammans' and not exists (
    select 1 from public.digital_orders o join auth.users u on u.id=uid and u.email_confirmed_at is not null and lower(trim(o.customer_email))=lower(trim(u.email))
    where o.product_slug=p_program and o.status='paid' and o.refunded_at is null and o.livemode is true
  ) then raise exception 'Logga in med den bekräftade e-postadress du använde vid guideköpet.'; end if;
  insert into public.farm_program_runs values(uid,p_program,p_day) on conflict do nothing;
  if not found then return false; end if;
  insert into public.reminders(user_id,title,due_date,reminder_type,recurrence,status)
    select uid,task,p_day+offset_days,'other','none','upcoming' from (values
    ('mina-forsta-hons',0,'Planera antal höns och budget'),('mina-forsta-hons',3,'Förbered hönshuset och kontrollera luckan'),('mina-forsta-hons',7,'Gå igenom första veckans flockjournal'),
    ('vinterklar-honsgard',0,'Kontrollera vatten och reservkärl'),('vinterklar-honsgard',2,'Gå igenom strö och ventilation'),('vinterklar-honsgard',7,'Kontrollera foderförrådet inför vintern'),
    ('klack-tillsammans',0,'Registrera kläckstarten och antalet ägg'),('klack-tillsammans',7,'Skriv veckans observation i kläckjournalen'),('klack-tillsammans',21,'Följ upp kläckningen och registrera det verkliga utfallet')
  ) tasks(program,offset_days,task) where program=p_program;
  return true;
end $$;

create function public.farm_growth_totals() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare totals jsonb;
begin
  if auth.uid() is null or not coalesce(public.has_role(auth.uid(),'admin'),false) then raise exception 'Åtkomst nekad.'; end if;
  with cohort as (select id from auth.users where created_at>=now()-interval '30 days' and email_confirmed_at is not null),
  sellers as (select distinct user_id from public.public_egg_sale_listings where listing_kind='full' and is_active and created_at>=now()-interval '30 days'),
  pickups as (select l.user_id,o.customer_email,o.customer_phone from public.public_egg_sale_bookings o join public.public_egg_sale_listings l on l.id=o.listing_id join sellers s on s.user_id=l.user_id
    where l.listing_kind='full' and l.is_active and l.created_at>=now()-interval '30 days' and (o.picked_up_at is not null or o.status='picked_up')),
  buyers as (select user_id,coalesce(nullif(lower(trim(customer_email)),''),nullif(regexp_replace(customer_phone,'[^0-9]','','g'),'')) customer from pickups)
  select jsonb_build_object('accounts',(select count(*) from cohort),'planned',(select count(distinct user_id) from public.flock_plans where user_id in(select id from cohort)),
    'arrived',(select count(distinct user_id) from public.flock_plans where user_id in(select id from cohort) and arrived_at is not null),
    'sellers',(select count(*) from sellers),'pickup',(select count(distinct user_id) from pickups),
    'repeat',(select count(distinct user_id) from (select user_id,customer from buyers where customer is not null group by user_id,customer having count(*)>=2) repeated)) into totals;
  return totals;
end $$;
revoke all on function public.start_farm_program(text,date),public.farm_growth_totals() from public,anon,authenticated;
grant execute on function public.start_farm_program(text,date),public.farm_growth_totals() to authenticated;
