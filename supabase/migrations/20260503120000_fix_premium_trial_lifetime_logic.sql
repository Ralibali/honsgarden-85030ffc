-- Keep the 7 day free premium trial, but make lifetime explicit and date-bound premium strict.

alter table public.profiles
  alter column is_lifetime_premium set default false;

update public.profiles
set is_lifetime_premium = false
where is_lifetime_premium is null;

alter table public.profiles
  alter column subscription_status set default 'free';

-- Existing expired trial/premium rows should not keep users premium forever.
-- Legitimate lifetime accounts are preserved.
update public.profiles
set
  subscription_status = 'free',
  premium_expires_at = null
where coalesce(is_lifetime_premium, false) = false
  and subscription_status = 'premium'
  and premium_expires_at is not null
  and premium_expires_at <= now();

-- New profiles get exactly 7 days of local premium trial.
-- The app treats this as trial because it is date-bound and is_lifetime_premium remains false.
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
    coalesce(new.raw_user_meta_data->>'name', ''),
    'premium',
    now() + interval '7 days',
    false
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    is_lifetime_premium = coalesce(public.profiles.is_lifetime_premium, false);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
