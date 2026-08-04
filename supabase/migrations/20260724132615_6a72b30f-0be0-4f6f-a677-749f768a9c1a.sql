
-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Update handle_new_user to pull Google OAuth metadata (name, avatar_url, picture, full_name)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := coalesce(
    nullif(m->>'name', ''),
    nullif(m->>'full_name', ''),
    split_part(new.email, '@', 1)
  );
  v_avatar text := coalesce(nullif(m->>'avatar_url', ''), nullif(m->>'picture', ''));
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      user_id, email, display_name, avatar_url, subscription_status, premium_expires_at,
      is_lifetime_premium, country_code, language_code, locale, timezone,
      currency_code, measurement_system, temperature_unit, postal_code, terms_accepted_at
    )
    VALUES (
      new.id, new.email, v_name, v_avatar, 'premium', now() + interval '7 days', false,
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
      INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
      VALUES (new.id, new.email, v_name, v_avatar)
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

-- RPC to sync current user's profile from their auth metadata (Google fills these on every login)
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  m jsonb;
  v_name text;
  v_avatar text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    INTO v_email, m
    FROM auth.users u
   WHERE u.id = v_uid;

  v_name := coalesce(nullif(m->>'name', ''), nullif(m->>'full_name', ''));
  v_avatar := coalesce(nullif(m->>'avatar_url', ''), nullif(m->>'picture', ''));

  -- Ensure profile row exists (idempotent safety net)
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  VALUES (v_uid, v_email, v_name, v_avatar)
  ON CONFLICT (user_id) DO NOTHING;

  -- Only fill missing fields; never overwrite user edits
  UPDATE public.profiles
     SET avatar_url = coalesce(avatar_url, v_avatar),
         display_name = coalesce(nullif(display_name, ''), v_name),
         email = coalesce(email, v_email)
   WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_profile_from_auth() TO authenticated;
