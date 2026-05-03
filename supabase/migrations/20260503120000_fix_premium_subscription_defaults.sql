begin;

alter table public.profiles
  alter column subscription_status set default 'free';

alter table public.profiles
  alter column premium_expires_at drop default;

alter table public.profiles
  alter column is_lifetime_premium set default false;

update public.profiles
set
  is_lifetime_premium = false
where is_lifetime_premium is null;

update public.profiles
set
  subscription_status = 'free',
  premium_expires_at = null
where
  coalesce(is_lifetime_premium, false) = false
  and (
    subscription_status = 'premium'
    and premium_expires_at is null
  );

update public.profiles
set
  subscription_status = 'free',
  premium_expires_at = null
where
  coalesce(is_lifetime_premium, false) = false
  and premium_expires_at is not null
  and premium_expires_at <= now();

commit;
