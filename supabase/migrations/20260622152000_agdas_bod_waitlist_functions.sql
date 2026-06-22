create or replace function public.create_next_waitlist_offer(p_listing_id uuid, p_packs integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_id uuid;
  entry public.egg_sale_waitlist%rowtype;
  token uuid;
begin
  select user_id into seller_id
  from public.public_egg_sale_listings
  where id = p_listing_id;

  if seller_id is null or seller_id <> auth.uid() then
    raise exception 'Åtkomst nekad';
  end if;

  update public.egg_sale_waitlist
  set status = 'expired', expired_at = now(), updated_at = now()
  where listing_id = p_listing_id
    and status = 'offered'
    and offer_expires_at < now();

  select * into entry
  from public.egg_sale_waitlist
  where listing_id = p_listing_id
    and status = 'waiting'
  order by created_at
  for update skip locked
  limit 1;

  if entry.id is null then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  token := gen_random_uuid();

  update public.egg_sale_waitlist
  set status = 'offered',
      offer_token = token,
      offered_packs = least(greatest(1, p_packs), greatest(1, entry.packs_wanted)),
      offer_expires_at = now() + interval '45 minutes',
      notified_at = now(),
      updated_at = now()
  where id = entry.id;

  insert into public.egg_sale_notification_queue(
    listing_id, unique_key, kind, destination, data
  ) values (
    p_listing_id,
    'waitlist-offer-' || entry.id || '-' || token,
    'waitlist_offer',
    coalesce(entry.customer_email, entry.customer_phone),
    jsonb_build_object(
      'waitlist_id', entry.id,
      'offer_token', token,
      'expires_at', now() + interval '45 minutes'
    )
  ) on conflict (unique_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'waitlist_id', entry.id,
    'offer_token', token,
    'expires_at', now() + interval '45 minutes'
  );
end;
$$;

create or replace function public.get_waitlist_offer(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'id', w.id,
    'customer_name', w.customer_name,
    'packs', w.offered_packs,
    'expires_at', w.offer_expires_at,
    'status', w.status,
    'listing_slug', l.slug,
    'listing_title', l.title
  )
  from public.egg_sale_waitlist w
  join public.public_egg_sale_listings l on l.id = w.listing_id
  where w.offer_token = p_token
  limit 1;
$$;

create or replace function public.accept_waitlist_offer(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  entry public.egg_sale_waitlist%rowtype;
begin
  select * into entry
  from public.egg_sale_waitlist
  where offer_token = p_token
  for update;

  if entry.id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if entry.status = 'accepted' then
    return jsonb_build_object('ok', true, 'already_accepted', true);
  end if;

  if entry.status <> 'offered' or entry.offer_expires_at < now() then
    update public.egg_sale_waitlist
    set status = 'expired', expired_at = coalesce(expired_at, now()), updated_at = now()
    where id = entry.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  update public.egg_sale_waitlist
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = entry.id;

  return jsonb_build_object(
    'ok', true,
    'listing_id', entry.listing_id,
    'packs', entry.offered_packs
  );
end;
$$;

grant execute on function public.create_next_waitlist_offer(uuid, integer) to authenticated;
grant execute on function public.get_waitlist_offer(uuid) to anon, authenticated;
grant execute on function public.accept_waitlist_offer(uuid) to anon, authenticated;
