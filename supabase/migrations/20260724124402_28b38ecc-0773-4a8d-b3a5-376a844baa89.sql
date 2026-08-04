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
  BEGIN
    INSERT INTO public.profiles (
      user_id, email, display_name, subscription_status, premium_expires_at,
      is_lifetime_premium, country_code, language_code, locale, timezone,
      currency_code, measurement_system, temperature_unit, postal_code, terms_accepted_at
    )
    VALUES (
      new.id, new.email, v_name, 'premium', now() + interval '7 days', false,
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
    BEGIN
      INSERT INTO public.profiles (user_id, email, display_name)
      VALUES (new.id, new.email, v_name)
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user nivå 2 misslyckades för %: %', new.id, SQLERRM;
    END;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user user_roles misslyckades för %: %', new.id, SQLERRM;
  END;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user totalfel för %: %', new.id, SQLERRM;
  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();