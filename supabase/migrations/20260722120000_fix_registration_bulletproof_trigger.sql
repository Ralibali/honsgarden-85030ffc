-- ============================================================
-- FIX: Registrering kraschade med "Database error saving new user"
-- Orsak: något i signup-kedjan (handle_new_user-triggern) kastar ett
-- undantag i live-databasen, t.ex. schemadrift mellan migrationer
-- och live-schemat. Då misslyckas HELA registreringen – för alla.
--
-- Denna version kan ALDRIG stoppa en registrering:
--   1. Fullständig profil-insert med alla fält
--   2. Vid fel → minimal insert (user_id, email, display_name)
--   3. Vid fel → bara en WARNING i loggen; användaren skapas ändå
-- Alla tre nivåerna loggar via RAISE WARNING så att roten till felet
-- syns i Postgres-loggarna i Supabase-dashboarden.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := coalesce(nullif(m->>'name', ''), split_part(new.email, '@', 1));
BEGIN
  -- Nivå 1: fullständig profil med regionala fält + villkors-tidsstämpel
  BEGIN
    INSERT INTO public.profiles (
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
      postal_code,
      terms_accepted_at
    )
    VALUES (
      new.id,
      new.email,
      v_name,
      'premium',
      now() + interval '7 days',
      false,
      coalesce(nullif(m->>'country_code', ''), 'SE'),
      coalesce(nullif(m->>'language_code', ''), 'sv'),
      coalesce(nullif(m->>'locale', ''), 'sv-SE'),
      coalesce(nullif(m->>'timezone', ''), 'Europe/Stockholm'),
      coalesce(nullif(m->>'currency_code', ''), 'SEK'),
      coalesce(nullif(m->>'measurement_system', ''), 'metric'),
      coalesce(nullif(m->>'temperature_unit', ''), 'C'),
      nullif(m->>'postal_code', ''),
      nullif(m->>'terms_accepted_at', '')::timestamptz
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user nivå 1 misslyckades för %: % – försöker minimal profil', new.id, SQLERRM;

    -- Nivå 2: minimal profil – huvudsaken är att kontot fungerar
    BEGIN
      INSERT INTO public.profiles (user_id, email, display_name)
      VALUES (new.id, new.email, v_name)
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user nivå 2 misslyckades för %: %', new.id, SQLERRM;
    END;
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Absolut sista skyddsnätet: släpp ALLTID igenom registreringen
  RAISE WARNING 'handle_new_user totalfel för %: %', new.id, SQLERRM;
  RETURN new;
END;
$function$;

-- Säkerställ att triggern finns och pekar på funktionen
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
