create table public.feed_weighings (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day date not null, kg numeric not null check(kg between 0 and 100000), measured_at timestamptz not null default now(), primary key(user_id,day)
);
alter table public.feed_weighings enable row level security;
revoke all on public.feed_weighings from public,anon,authenticated;
grant select,insert,update on public.feed_weighings to authenticated;
create policy own_feed_weight on public.feed_weighings for all to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid() and day<=(now() at time zone 'Europe/Stockholm')::date);
create table public.feed_receipt_links (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.inventory_items(id) on delete set null, kg numeric not null
);
alter table public.feed_receipt_links enable row level security;
revoke all on public.feed_receipt_links from public,anon,authenticated;
alter table public.transactions add column source_feed_receipt_id uuid unique;

create function public.guard_linked_feed_expense() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' and pg_trigger_depth()>1 then return old; end if;
  if tg_op<>'INSERT' and old.source_feed_receipt_id is not null and exists(select 1 from public.feed_receipt_links where id=old.source_feed_receipt_id) then
    raise exception 'Ändra inköpet i foderjournalen.';
  end if;
  if tg_op<>'DELETE' and new.source_feed_receipt_id is not null then
    if new.id<>new.source_feed_receipt_id or not exists(select 1 from public.feed_receipt_links where id=new.id and user_id=new.user_id) then
      raise exception 'Foderkvittot saknas.';
    end if;
  end if;
  return coalesce(new,old);
end $$;
create trigger guard_linked_feed_expense before insert or update or delete on public.transactions for each row execute function public.guard_linked_feed_expense();
revoke all on function public.guard_linked_feed_expense() from public,anon,authenticated;

create function public.save_feed_receipt(p_id uuid,p_name text,p_day date,p_kg numeric,p_cost numeric,p_item uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item uuid; prior public.feed_receipt_links;
begin
  if uid is null or p_day is null or p_day>(now() at time zone 'Europe/Stockholm')::date or p_kg is null or p_kg not between 0.001 and 100000
    or p_cost is null or p_cost not between 0 and 10000000 or coalesce(length(trim(p_name)),0) not between 1 and 160 then raise exception 'Kontrollera foder, datum, kilo och belopp.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||'feed-receipt',0));
  select * into prior from public.feed_receipt_links where id=p_id;
  if found then
    if prior.user_id=uid and (p_item is null or prior.item_id=p_item) and exists(select 1 from public.feed_records where id=p_id and date=p_day and amount_kg=p_kg and cost=p_cost and feed_type=trim(p_name)) then return p_id; end if;
    raise exception 'Inköpet har ändrats.';
  end if;
  if p_item is null then
    select id into item from public.inventory_items where user_id=uid and category='foder' and unit='kg' and name=trim(p_name) order by id limit 1;
    if item is null then insert into public.inventory_items(user_id,category,name,unit) values(uid,'foder',trim(p_name),'kg') returning id into item; end if;
  else
    select id into item from public.inventory_items where id=p_item and user_id=uid and category='foder' and lower(unit)='kg';
    if item is null then raise exception 'Välj en egen fodervara i kilo.'; end if;
  end if;
  insert into public.feed_records(id,user_id,date,feed_type,amount_kg,cost) values(p_id,uid,p_day,trim(p_name),p_kg,p_cost);
  insert into public.inventory_transactions(id,user_id,inventory_item_id,transaction_type,quantity,cost,transaction_date,notes) values(p_id,uid,item,'in',p_kg,p_cost,p_day,'Foderinköp');
  insert into public.feed_receipt_links values(p_id,uid,item,p_kg);
  insert into public.transactions(id,user_id,date,type,category,amount,description,source_feed_receipt_id) values(p_id,uid,p_day,'expense','feed',p_cost,trim(p_name),p_id);
  return p_id;
end $$;
create function public.remove_linked_feed_receipt() returns trigger language plpgsql security definer set search_path='' as $$
declare receipt public.feed_receipt_links;
begin
  delete from public.feed_receipt_links where id=old.id and user_id=old.user_id returning * into receipt;
  if found then
    delete from public.transactions where id=old.id and user_id=old.user_id;
    if receipt.item_id is not null then
      insert into public.inventory_transactions(user_id,inventory_item_id,transaction_type,quantity,notes)
      values(old.user_id,receipt.item_id,'justering',-receipt.kg,'Återfört borttaget foderinköp');
    end if;
  end if;
  return old;
end $$;
create trigger remove_linked_feed_receipt after delete on public.feed_records for each row execute function public.remove_linked_feed_receipt();
revoke all on function public.save_feed_receipt(uuid,text,date,numeric,numeric,uuid),public.remove_linked_feed_receipt() from public,anon;
grant execute on function public.save_feed_receipt(uuid,text,date,numeric,numeric,uuid) to authenticated;
