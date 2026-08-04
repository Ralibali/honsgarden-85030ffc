-- Tidsstämplar på bokningar
alter table public.public_egg_sale_bookings
  add column if not exists confirmed_at timestamptz,
  add column if not exists picked_up_at timestamptz,
  add column if not exists no_show_at timestamptz;

-- 1. Säker statusövergångs-RPC
create or replace function public.transition_egg_booking_status(
  p_booking_id uuid,
  p_new_status text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bk public.public_egg_sale_bookings%rowtype;
  ok boolean := false;
begin
  select * into bk from public.public_egg_sale_bookings
   where id = p_booking_id for update;
  if bk.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if bk.seller_user_id <> auth.uid() then
    raise exception 'Åtkomst nekad';
  end if;
  if bk.status = p_new_status then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  -- Tillåtna övergångar
  if bk.status = 'pending' and p_new_status in ('confirmed','cancelled') then ok := true;
  elsif bk.status = 'confirmed' and p_new_status in ('picked_up','cancelled','no_show') then ok := true;
  elsif bk.status in ('picked_up','cancelled','no_show') then
    raise exception 'Bokningen är låst i status %', bk.status;
  end if;

  if not ok then
    raise exception 'Ogiltig övergång % → %', bk.status, p_new_status;
  end if;

  update public.public_egg_sale_bookings
     set status = p_new_status,
         confirmed_at = case when p_new_status='confirmed' then now() else confirmed_at end,
         picked_up_at = case when p_new_status='picked_up' then now() else picked_up_at end,
         no_show_at   = case when p_new_status='no_show'   then now() else no_show_at end,
         updated_at = now()
   where id = p_booking_id;

  insert into public.egg_sale_booking_events(
    booking_id, listing_id, event_type, actor_user_id, note, created_at
  ) values (
    bk.id, bk.listing_id, 'status_'||p_new_status, auth.uid(), p_note, now()
  );

  return jsonb_build_object('ok', true, 'status', p_new_status);
end;
$$;

revoke all on function public.transition_egg_booking_status(uuid, text, text) from public, anon;
grant execute on function public.transition_egg_booking_status(uuid, text, text) to authenticated;

-- 2. Notifieringskö-workers (service_role only)
create or replace function public.claim_egg_notifications(p_limit integer default 20)
returns setof public.egg_sale_notification_queue
language sql
security definer
set search_path = public
as $$
  with picked as (
    select id from public.egg_sale_notification_queue
     where state = 'pending' and deliver_after <= now()
     order by deliver_after
     for update skip locked
     limit greatest(1, p_limit)
  )
  update public.egg_sale_notification_queue q
     set state = 'in_progress',
         attempts = attempts + 1,
         updated_at = now()
    from picked
   where q.id = picked.id
   returning q.*;
$$;

create or replace function public.complete_egg_notification(
  p_id uuid, p_error text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_error is null then
    update public.egg_sale_notification_queue
       set state = 'delivered', delivered_at = now(), error_message = null, updated_at = now()
     where id = p_id;
  else
    update public.egg_sale_notification_queue
       set state = case when attempts >= 5 then 'failed' else 'pending' end,
           deliver_after = case when attempts >= 5 then deliver_after else now() + (attempts * interval '2 minutes') end,
           error_message = p_error,
           updated_at = now()
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.claim_egg_notifications(integer) from public, anon, authenticated;
revoke all on function public.complete_egg_notification(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_egg_notifications(integer) to service_role;
grant execute on function public.complete_egg_notification(uuid, text) to service_role;

-- 3. Abonnemangsworker (service_role only)
create or replace function public.claim_due_egg_subscriptions(p_limit integer default 20)
returns setof public.egg_sale_subscriptions
language sql
security definer
set search_path = public
as $$
  with picked as (
    select id from public.egg_sale_subscriptions
     where status = 'active'
       and next_run_at <= now()
       and (paused_until is null or paused_until <= current_date)
     order by next_run_at
     for update skip locked
     limit greatest(1, p_limit)
  )
  update public.egg_sale_subscriptions s
     set updated_at = now()
    from picked
   where s.id = picked.id
   returning s.*;
$$;

create or replace function public.complete_egg_subscription_run(
  p_id uuid,
  p_ok boolean,
  p_error text default null,
  p_next_run_at timestamptz default null,
  p_booking_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ok then
    update public.egg_sale_subscriptions
       set last_booking_id = coalesce(p_booking_id, last_booking_id),
           total_bookings = total_bookings + 1,
           consecutive_failures = 0,
           last_error = null,
           skip_next = false,
           next_run_at = coalesce(p_next_run_at, next_run_at + interval '7 days'),
           updated_at = now()
     where id = p_id;
  else
    update public.egg_sale_subscriptions
       set consecutive_failures = consecutive_failures + 1,
           last_error = p_error,
           status = case when consecutive_failures + 1 >= 3 then 'paused' else status end,
           next_run_at = coalesce(p_next_run_at, next_run_at + interval '1 day'),
           updated_at = now()
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.claim_due_egg_subscriptions(integer) from public, anon, authenticated;
revoke all on function public.complete_egg_subscription_run(uuid, boolean, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.claim_due_egg_subscriptions(integer) to service_role;
grant execute on function public.complete_egg_subscription_run(uuid, boolean, text, timestamptz, uuid) to service_role;