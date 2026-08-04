create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    email,
    display_name,
    subscription_status,
    premium_expires_at,
    is_lifetime_premium
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'premium',
    now() + interval '7 days',
    false
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    subscription_status = case
      when public.profiles.is_lifetime_premium = true then public.profiles.subscription_status
      when public.profiles.subscription_status = 'premium' and public.profiles.premium_expires_at is not null then public.profiles.subscription_status
      else excluded.subscription_status
    end,
    premium_expires_at = case
      when public.profiles.is_lifetime_premium = true then null
      when public.profiles.subscription_status = 'premium' and public.profiles.premium_expires_at is not null then public.profiles.premium_expires_at
      else excluded.premium_expires_at
    end,
    is_lifetime_premium = coalesce(public.profiles.is_lifetime_premium, false);

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;