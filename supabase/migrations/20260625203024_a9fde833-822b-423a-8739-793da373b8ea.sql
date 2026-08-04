
-- Leverans 1: Regionala kolumner på profiles (idempotent, bakåtkompatibel)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS language_code text,
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS currency_code text,
  ADD COLUMN IF NOT EXISTS measurement_system text,
  ADD COLUMN IF NOT EXISTS temperature_unit text,
  ADD COLUMN IF NOT EXISTS postal_code text;

-- Validering (mjuk): tillåt endast kända värden där vi har en kort lista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_measurement_system_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_measurement_system_check
      CHECK (measurement_system IS NULL OR measurement_system IN ('metric','imperial'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_temperature_unit_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_temperature_unit_check
      CHECK (temperature_unit IS NULL OR temperature_unit IN ('C','F'));
  END IF;
END $$;

-- Backfill: befintliga användare utan land migreras till Sverige.
-- Vi rör INTE rader som redan har country_code satt.
UPDATE public.profiles
SET
  country_code        = COALESCE(country_code, 'SE'),
  language_code       = COALESCE(language_code, 'sv'),
  locale              = COALESCE(locale, 'sv-SE'),
  timezone            = COALESCE(timezone, 'Europe/Stockholm'),
  currency_code       = COALESCE(currency_code, 'SEK'),
  measurement_system  = COALESCE(measurement_system, 'metric'),
  temperature_unit    = COALESCE(temperature_unit, 'C')
WHERE country_code IS NULL
   OR language_code IS NULL
   OR locale IS NULL
   OR timezone IS NULL
   OR currency_code IS NULL
   OR measurement_system IS NULL
   OR temperature_unit IS NULL;

-- Uppdatera handle_new_user så att registrering sätter regionala defaults
-- från raw_user_meta_data om de finns, annars SE-defaults.
-- Behåller all befintlig premium/trial-logik exakt.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_country text := nullif(m->>'country_code','');
  v_language text := nullif(m->>'language_code','');
  v_locale text := nullif(m->>'locale','');
  v_timezone text := nullif(m->>'timezone','');
  v_currency text := nullif(m->>'currency_code','');
  v_measure text := nullif(m->>'measurement_system','');
  v_temp text := nullif(m->>'temperature_unit','');
  v_postal text := nullif(m->>'postal_code','');
begin
  insert into public.profiles (
    user_id,
    email,
    display_name,
    subscription_status,
    premium_expires_at,
    is_lifetime_premium,
    country_code,
    language_code,
    locale,
    timezone,
    currency_code,
    measurement_system,
    temperature_unit,
    postal_code
  )
  values (
    new.id,
    new.email,
    coalesce(m->>'name', split_part(new.email, '@', 1)),
    'premium',
    now() + interval '7 days',
    false,
    coalesce(v_country, 'SE'),
    coalesce(v_language, 'sv'),
    coalesce(v_locale, 'sv-SE'),
    coalesce(v_timezone, 'Europe/Stockholm'),
    coalesce(v_currency, 'SEK'),
    coalesce(v_measure, 'metric'),
    coalesce(v_temp, 'C'),
    v_postal
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
    is_lifetime_premium = coalesce(public.profiles.is_lifetime_premium, false),
    country_code        = coalesce(public.profiles.country_code, excluded.country_code),
    language_code       = coalesce(public.profiles.language_code, excluded.language_code),
    locale              = coalesce(public.profiles.locale, excluded.locale),
    timezone            = coalesce(public.profiles.timezone, excluded.timezone),
    currency_code       = coalesce(public.profiles.currency_code, excluded.currency_code),
    measurement_system  = coalesce(public.profiles.measurement_system, excluded.measurement_system),
    temperature_unit    = coalesce(public.profiles.temperature_unit, excluded.temperature_unit),
    postal_code         = coalesce(public.profiles.postal_code, excluded.postal_code);

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;
