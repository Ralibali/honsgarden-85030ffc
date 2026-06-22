create or replace function public.pause_egg_subscription(p_subscription_id uuid, p_paused_until date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.egg_sale_subscriptions%rowtype;
begin
  select * into sub from public.egg_sale_subscriptions
   where id = p_subscription_id for update;
  if sub.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if sub.seller_user_id <> auth.uid() then
    raise exception 'Åtkomst nekad';
  end if;

  update public.egg_sale_subscriptions
     set status = 'paused',
         paused_until = p_paused_until,
         last_error = null,
         updated_at = now()
   where id = p_subscription_id;

  return jsonb_build_object('ok', true, 'status', 'paused', 'paused_until', p_paused_until);
end;
$$;

create or replace function public.resume_egg_subscription(p_subscription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.egg_sale_subscriptions%rowtype;
begin
  select * into sub from public.egg_sale_subscriptions
   where id = p_subscription_id for update;
  if sub.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if sub.seller_user_id <> auth.uid() then
    raise exception 'Åtkomst nekad';
  end if;

  update public.egg_sale_subscriptions
     set status = 'active',
         paused_until = null,
         consecutive_failures = 0,
         last_error = null,
         updated_at = now()
   where id = p_subscription_id;

  return jsonb_build_object('ok', true, 'status', 'active');
end;
$$;

create or replace function public.cancel_egg_subscription(p_subscription_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.egg_sale_subscriptions%rowtype;
begin
  select * into sub from public.egg_sale_subscriptions
   where id = p_subscription_id for update;
  if sub.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if sub.seller_user_id <> auth.uid() then
    raise exception 'Åtkomst nekad';
  end if;

  update public.egg_sale_subscriptions
     set status = 'cancelled',
         cancellation_reason = p_reason,
         cancelled_at = now(),
         updated_at = now()
   where id = p_subscription_id;

  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.pause_egg_subscription(uuid, date) from public, anon;
revoke all on function public.resume_egg_subscription(uuid) from public, anon;
revoke all on function public.cancel_egg_subscription(uuid, text) from public, anon;

grant execute on function public.pause_egg_subscription(uuid, date) to authenticated;
grant execute on function public.resume_egg_subscription(uuid) to authenticated;
grant execute on function public.cancel_egg_subscription(uuid, text) to authenticated;