-- Existing sellers retain their listing limits. A seller explicitly connects one listing.
create table public.egg_baskets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_day date not null,
  opening_eggs integer not null check (opening_eggs between 0 and 100000),
  household integer not null check (household between 0 and 100000),
  listing_id uuid unique references public.public_egg_sale_listings(id) on delete set null
);
create table public.egg_basket_uses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  eggs integer not null check (eggs between 1 and 100000),
  reason text not null check (reason in ('kitchen','broken'))
);
create index egg_basket_uses_day on public.egg_basket_uses(user_id,used_on);
alter table public.egg_baskets enable row level security;
alter table public.egg_basket_uses enable row level security;
revoke all on public.egg_baskets,public.egg_basket_uses from public, anon, authenticated;

alter table public.public_egg_sale_bookings add column basket_eggs integer, add column basket_amount numeric(12,2), add column basket_request_id uuid unique;
alter table public.egg_sales add column source_booking_id uuid unique;
alter table public.transactions add column source_egg_sale_id uuid unique;

create function public.basket_totals(p_owner uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with b as (select * from public.egg_baskets where user_id=p_owner),
  numbers as (
    select b.*,
      coalesce((select sum(e.count) from public.egg_logs e where e.user_id=p_owner and e.date>=b.start_day and e.date <= (now() at time zone 'Europe/Stockholm')::date),0) collected,
      coalesce((select sum(u.eggs) from public.egg_basket_uses u where u.user_id=p_owner and u.used_on>=b.start_day),0) used,
      coalesce((select sum(s.eggs) from public.egg_sales s where s.user_id=p_owner and (s.source_booking_id is null or not exists(select 1 from public.public_egg_sale_bookings original where original.id=s.source_booking_id)) and s.sale_date>=b.start_day and s.sale_date<=(now() at time zone 'Europe/Stockholm')::date),0) manual,
      coalesce((select sum(coalesce(o.basket_eggs,o.packs*l.eggs_per_pack)) from public.public_egg_sale_bookings o join public.public_egg_sale_listings l on l.id=o.listing_id
        where l.user_id=p_owner and o.picked_up_at is null and o.status in ('pending','reserved','confirmed','paid','packed')),0) reserved,
      coalesce((select sum(coalesce(o.basket_eggs,o.packs*l.eggs_per_pack)) from public.public_egg_sale_bookings o join public.public_egg_sale_listings l on l.id=o.listing_id
        where l.user_id=p_owner and (o.picked_up_at is not null or o.status='picked_up') and (coalesce(o.picked_up_at,o.updated_at) at time zone 'Europe/Stockholm')::date>=b.start_day),0) picked
    from b
  )
  select (to_jsonb(numbers)-'user_id') || jsonb_build_object('available',opening_eggs+collected-used-manual-picked-reserved-household) from numbers;
$$;
create function public.my_egg_basket() returns jsonb language sql stable security definer set search_path='' as $$
  select public.basket_totals(auth.uid());
$$;

create function public.configure_egg_basket(p_day date,p_opening integer,p_household integer,p_listing uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_day is null or p_day>(now() at time zone 'Europe/Stockholm')::date then raise exception 'Kontrollera startdatumet.'; end if;
  if p_listing is not null and not exists(select 1 from public.public_egg_sale_listings where id=p_listing and user_id=auth.uid() and listing_kind='full' and is_active) then raise exception 'Välj din egen aktiva säljsida.'; end if;
  insert into public.egg_baskets(user_id,start_day,opening_eggs,household,listing_id) values(auth.uid(),p_day,p_opening,p_household,p_listing)
  on conflict(user_id) do update set start_day=excluded.start_day,opening_eggs=excluded.opening_eggs,household=excluded.household,listing_id=excluded.listing_id;
end $$;

create function public.record_basket_use(p_id uuid,p_eggs integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare basket public.egg_baskets; previous public.egg_basket_uses; available integer;
begin
  select * into basket from public.egg_baskets where user_id=auth.uid() for update;
  if not found then raise exception 'Ställ in äggkorgen först.'; end if;
  select * into previous from public.egg_basket_uses where id=p_id;
  if found then
    if previous.user_id=auth.uid() and previous.eggs=p_eggs and previous.reason=p_reason then return; end if;
    raise exception 'Registreringen har ändrats.';
  end if;
  available:=(public.basket_totals(auth.uid())->>'available')::integer+basket.household;
  if p_eggs>available then raise exception 'Det finns färre obokade ägg i korgen.'; end if;
  insert into public.egg_basket_uses values(p_id,auth.uid(),(now() at time zone 'Europe/Stockholm')::date,p_eggs,p_reason);
end $$;

create function public.publish_basket_packs() returns integer language plpgsql security definer set search_path='' as $$
declare basket public.egg_baskets; listing public.public_egg_sale_listings; remaining integer;
begin
  select * into basket from public.egg_baskets where user_id=auth.uid() for update;
  select * into listing from public.public_egg_sale_listings where id=basket.listing_id and user_id=auth.uid() and is_active for update;
  if not found or listing.eggs_per_pack<=0 then raise exception 'Välj en aktiv säljsida med en kartstorlek.'; end if;
  remaining:=greatest(0,(public.basket_totals(auth.uid())->>'available')::integer)/listing.eggs_per_pack;
  update public.public_egg_sale_listings set packs_available=public.get_public_egg_sale_reserved_packs(listing.id)+remaining,
    stock_source='manual',stock_packs=remaining,sold_out_manually=false where id=listing.id;
  return remaining;
end $$;

create function public.basket_listing_packs(p_listing uuid) returns integer language sql stable security definer set search_path='' as $$
 select least(greatest(0,l.packs_available-public.get_public_egg_sale_reserved_packs(l.id)),
    greatest(0,(public.basket_totals(l.user_id)->>'available')::integer)/nullif(l.eggs_per_pack,0))
 from public.public_egg_sale_listings l join public.egg_baskets b on b.listing_id=l.id and b.user_id=l.user_id
 where l.id=p_listing and l.is_active;
$$;

create function public.check_basket_booking() returns trigger language plpgsql security definer set search_path='' as $$
declare listing public.public_egg_sale_listings; basket public.egg_baskets; unit_price numeric; available integer;
  prior public.public_egg_sale_bookings; expected numeric:=new.basket_amount;
begin
  new.basket_eggs:=null; new.basket_amount:=null;
  select * into listing from public.public_egg_sale_listings where id=new.listing_id;
  select * into basket from public.egg_baskets where user_id=listing.user_id for update;
  if not found then new.basket_request_id:=null; return new; end if;
  if new.basket_request_id is not null then
    select * into prior from public.public_egg_sale_bookings where basket_request_id=new.basket_request_id;
    if found then
      if (prior.listing_id,prior.packs,prior.customer_name,prior.customer_email,prior.customer_phone,prior.customer_message,prior.pickup_slot_id,prior.pickup_person_name,prior.pickup_person_phone,prior.basket_amount)
        is distinct from (new.listing_id,new.packs,new.customer_name,new.customer_email,new.customer_phone,new.customer_message,new.pickup_slot_id,new.pickup_person_name,new.pickup_person_phone,expected) then raise exception 'Bokningsförsöket har ändrats.'; end if;
      return null;
    end if;
  end if;
  new.seller_user_id:=listing.user_id;
  if new.packs is null or new.packs not between 1 and 1000 or listing.eggs_per_pack<=0 then raise exception 'Kontrollera antalet kartor.'; end if;
  available:=(public.basket_totals(listing.user_id)->>'available')::integer;
  new.basket_eggs:=new.packs*listing.eggs_per_pack;
  if new.basket_eggs>available or (basket.listing_id=listing.id and new.packs>public.basket_listing_packs(listing.id)) then
    raise exception 'Det finns färre ägg kvar. Uppdatera säljsidan.'; end if;
  select (tier->>'price_per_pack')::numeric into unit_price
    from jsonb_array_elements(case when jsonb_typeof(listing.price_tiers)='array' then listing.price_tiers else '[]'::jsonb end) tier
    where (tier->>'min_qty') ~ '^[0-9]{1,6}$' and (tier->>'price_per_pack') ~ '^[0-9]{1,8}([.][0-9]{1,2})?$'
    and (tier->>'min_qty')::int<=new.packs and (tier->>'price_per_pack')::numeric>0
    and new.packs <= case when (tier->>'max_qty') ~ '^[0-9]{1,6}$' then (tier->>'max_qty')::int else 1000000 end
    order by (tier->>'min_qty')::int desc limit 1;
  new.basket_amount:=round(coalesce(unit_price,listing.price_per_pack)*new.packs,2);
  if expected is not null and expected is distinct from new.basket_amount then raise exception 'Priset har ändrats. Uppdatera säljsidan.'; end if;
  return new;
end $$;
create trigger check_opted_in_basket before insert on public.public_egg_sale_bookings for each row execute function public.check_basket_booking();

create function public.preserve_booking_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
  new.basket_request_id:=old.basket_request_id;
  new.basket_eggs:=old.basket_eggs; new.basket_amount:=old.basket_amount;
  if old.basket_eggs is not null then
    if (new.listing_id,new.packs,new.seller_user_id) is distinct from (old.listing_id,old.packs,old.seller_user_id) then raise exception 'Ändra antalet genom att avboka och boka på nytt.'; end if;
    if old.picked_up_at is not null then new.picked_up_at:=old.picked_up_at;
    elsif new.status='picked_up' then new.picked_up_at:=coalesce(new.picked_up_at,now()); end if;
  end if;
  return new;
end $$;
create trigger preserve_booking_snapshot before update on public.public_egg_sale_bookings for each row execute function public.preserve_booking_snapshot();

create function public.guard_basket_journal() returns trigger language plpgsql security definer set search_path='' as $$
declare basket public.egg_baskets; difference integer;
begin
  if pg_trigger_depth()>1 then return coalesce(new,old); end if;
  if (tg_op<>'DELETE' and new.source_booking_id is not null) or (tg_op<>'INSERT' and old.source_booking_id is not null) then
    raise exception 'Ändra den här försäljningen i bokningen.'; end if;
  if tg_op='DELETE' then return old; end if;
  select * into basket from public.egg_baskets where user_id=new.user_id for update;
  if not found or new.sale_date not between basket.start_day and (now() at time zone 'Europe/Stockholm')::date then return new; end if;
  difference:=new.eggs;
  if tg_op='UPDATE' and old.sale_date between basket.start_day and (now() at time zone 'Europe/Stockholm')::date then difference:=difference-old.eggs; end if;
  if difference>0 and difference>(public.basket_totals(new.user_id)->>'available')::integer then raise exception 'Det finns färre säljbara ägg kvar.'; end if;
  return new;
end $$;
create trigger guard_basket_journal before insert or update or delete on public.egg_sales for each row execute function public.guard_basket_journal();

create function public.guard_basket_income() returns trigger language plpgsql set search_path='' as $$
begin
  if pg_trigger_depth()=1 and ((tg_op<>'DELETE' and new.source_egg_sale_id is not null) or (tg_op<>'INSERT' and old.source_egg_sale_id is not null)) then
    raise exception 'Ändra inkomsten i försäljningsjournalen.'; end if;
  return coalesce(new,old);
end $$;
create trigger guard_basket_income before insert or update or delete on public.transactions for each row execute function public.guard_basket_income();
revoke all on function public.guard_basket_income(),public.guard_basket_journal(),public.preserve_booking_snapshot() from public,anon,authenticated;

create function public.journal_basket_pickup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.basket_eggs is null or new.basket_amount is null or (new.status<>'picked_up' and new.picked_up_at is null) then return new; end if;
  insert into public.egg_sales(user_id,customer,eggs,amount,paid,sale_date,source_booking_id)
    values(new.seller_user_id,new.customer_name,new.basket_eggs,case when new.payment_status='refunded' then 0 else new.basket_amount end,new.payment_status='paid',
      (coalesce(new.picked_up_at,now()) at time zone 'Europe/Stockholm')::date,new.id)
    on conflict(source_booking_id) do update set paid=excluded.paid,amount=excluded.amount;
  return new;
end $$;
create trigger journal_basket_pickup after update of status,payment_status on public.public_egg_sale_bookings for each row execute function public.journal_basket_pickup();

create function public.basket_sale_finance() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then delete from public.transactions where source_egg_sale_id=old.id; return old; end if;
  if new.source_booking_id is null and not exists(select 1 from public.egg_baskets where user_id=new.user_id and start_day<=new.sale_date) then
    delete from public.transactions where source_egg_sale_id=new.id; return new; end if;
  if new.paid then
    insert into public.transactions(user_id,date,type,category,amount,description,source_egg_sale_id)
      values(new.user_id,new.sale_date,'income','egg_sales',new.amount,'Äggförsäljning · '||new.customer,new.id)
      on conflict(source_egg_sale_id) do update set amount=excluded.amount,date=excluded.date,description=excluded.description;
  else delete from public.transactions where source_egg_sale_id=new.id; end if;
  return new;
end $$;
create trigger basket_sale_finance after insert or update or delete on public.egg_sales for each row execute function public.basket_sale_finance();
revoke all on function public.basket_totals(uuid),public.check_basket_booking(),public.journal_basket_pickup(),public.basket_sale_finance(),
  public.my_egg_basket(),public.configure_egg_basket(date,integer,integer,uuid),public.record_basket_use(uuid,integer,text),public.publish_basket_packs(),public.basket_listing_packs(uuid) from public,anon,authenticated;
grant execute on function public.my_egg_basket(),public.configure_egg_basket(date,integer,integer,uuid),public.record_basket_use(uuid,integer,text),public.publish_basket_packs() to authenticated;
grant execute on function public.basket_listing_packs(uuid) to anon,authenticated;
