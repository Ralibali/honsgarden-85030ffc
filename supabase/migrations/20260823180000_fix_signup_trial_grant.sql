-- ============================================================
-- P1: Every new signup must get a 7-day local Plus trial.
--
-- Root cause (production 2026-08-23):
--   handle_new_user nivå 1 already inserts
--     subscription_status='premium', premium_expires_at=now()+7 days.
--   Live rows (including aurora.qa.prod28.*) confirm that grant lands.
--
--   But two fallbacks can silently create a Gratisplan row:
--     1) nivå 2 insert (user_id, email, display_name [, avatar_url]) uses
--        column defaults (subscription_status='free', expiry NULL)
--     2) sync_profile_from_auth() inserts the same free defaults when
--        the trigger missed the row (ON CONFLICT DO NOTHING then
--        refuses to backfill trial)
--
--   After-insert welcome/admin email triggers can also abort the
--   profile INSERT if enqueue_email throws, which forces those
--   fallbacks.
--
-- This migration:
--   * grants the 7-day trial on every insert path
--   * backfills trial on conflict when the row is still a never-paid
--     free profile (new signup race only — not expired paid users)
--   * makes welcome/admin emails non-fatal
-- ============================================================

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
  v_trial_end timestamptz := now() + interval '7 days';
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      user_id, email, display_name, avatar_url, subscription_status, premium_expires_at,
      is_lifetime_premium, country_code, language_code, locale, timezone,
      currency_code, measurement_system, temperature_unit, postal_code, terms_accepted_at
    )
    VALUES (
      new.id, new.email, v_name, v_avatar, 'premium', v_trial_end, false,
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
    ON CONFLICT (user_id) DO UPDATE
    SET
      email = coalesce(public.profiles.email, excluded.email),
      display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
      subscription_status = CASE
        WHEN public.profiles.is_lifetime_premium THEN public.profiles.subscription_status
        WHEN public.profiles.stripe_customer_id IS NOT NULL THEN public.profiles.subscription_status
        WHEN public.profiles.subscription_status = 'premium'
             AND public.profiles.premium_expires_at IS NOT NULL
             AND public.profiles.premium_expires_at > now()
          THEN public.profiles.subscription_status
        ELSE excluded.subscription_status
      END,
      premium_expires_at = CASE
        WHEN public.profiles.is_lifetime_premium THEN NULL
        WHEN public.profiles.stripe_customer_id IS NOT NULL THEN public.profiles.premium_expires_at
        WHEN public.profiles.subscription_status = 'premium'
             AND public.profiles.premium_expires_at IS NOT NULL
             AND public.profiles.premium_expires_at > now()
          THEN public.profiles.premium_expires_at
        ELSE excluded.premium_expires_at
      END;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user nivå 1 misslyckades för %: % – försöker minimal profil med trial', new.id, SQLERRM;
    BEGIN
      INSERT INTO public.profiles (
        user_id, email, display_name, avatar_url,
        subscription_status, premium_expires_at, is_lifetime_premium
      )
      VALUES (new.id, new.email, v_name, v_avatar, 'premium', v_trial_end, false)
      ON CONFLICT (user_id) DO UPDATE
      SET
        subscription_status = CASE
          WHEN public.profiles.is_lifetime_premium THEN public.profiles.subscription_status
          WHEN public.profiles.stripe_customer_id IS NOT NULL THEN public.profiles.subscription_status
          WHEN public.profiles.subscription_status = 'premium'
               AND public.profiles.premium_expires_at IS NOT NULL
               AND public.profiles.premium_expires_at > now()
            THEN public.profiles.subscription_status
          ELSE excluded.subscription_status
        END,
        premium_expires_at = CASE
          WHEN public.profiles.is_lifetime_premium THEN NULL
          WHEN public.profiles.stripe_customer_id IS NOT NULL THEN public.profiles.premium_expires_at
          WHEN public.profiles.subscription_status = 'premium'
               AND public.profiles.premium_expires_at IS NOT NULL
               AND public.profiles.premium_expires_at > now()
            THEN public.profiles.premium_expires_at
          ELSE excluded.premium_expires_at
        END;
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

  -- Safety net if handle_new_user missed the row: still grant the 7-day trial.
  INSERT INTO public.profiles (
    user_id, email, display_name, avatar_url,
    subscription_status, premium_expires_at, is_lifetime_premium
  )
  VALUES (
    v_uid, v_email, v_name, v_avatar,
    'premium', now() + interval '7 days', false
  )
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles
     SET avatar_url = coalesce(avatar_url, v_avatar),
         display_name = coalesce(nullif(display_name, ''), v_name),
         email = coalesce(email, v_email)
   WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_profile_from_auth() TO authenticated;

-- handle_new_user ON CONFLICT is an UPDATE. Without this exception the
-- protect trigger would revert a 7-day trial written onto a free row.
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Auth trigger (no JWT): allow first-time local trial onto a never-paid row.
  IF auth.uid() IS NULL
     AND coalesce(OLD.is_lifetime_premium, false) = false
     AND OLD.stripe_customer_id IS NULL
     AND NEW.subscription_status = 'premium'
     AND NEW.premium_expires_at IS NOT NULL
     AND NEW.premium_expires_at > now()
  THEN
    NEW.referral_code := OLD.referral_code;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.is_lifetime_premium := false;
    RETURN NEW;
  END IF;

  NEW.subscription_status := OLD.subscription_status;
  NEW.is_lifetime_premium := OLD.is_lifetime_premium;
  NEW.premium_expires_at := OLD.premium_expires_at;
  NEW.referral_code := OLD.referral_code;
  NEW.stripe_customer_id := OLD.stripe_customer_id;

  RETURN NEW;
END;
$function$;

-- Welcome / admin emails must never roll back the trial-granting insert.
CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _message_id text;
BEGIN
  _message_id := 'reg-' || NEW.user_id::text || '-' || extract(epoch from now())::bigint::text;

  BEGIN
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'to', 'info@auroramedia.se',
        'from', 'Hönsgården <noreply@notify.honsgarden.se>',
        'sender_domain', 'notify.honsgarden.se',
        'subject', 'Ny medlem registrerad på Hönsgården',
        'html', '<h2>Ny medlem!</h2><p><strong>E-post:</strong> ' || COALESCE(NEW.email, 'okänd') || '</p><p><strong>Namn:</strong> ' || COALESCE(NEW.display_name, 'ej angivet') || '</p><p><strong>Registrerad:</strong> ' || to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI') || '</p>',
        'text', 'Ny medlem registrerad: ' || COALESCE(NEW.email, 'okänd') || ' (' || COALESCE(NEW.display_name, 'ej angivet') || ')',
        'purpose', 'transactional',
        'label', 'admin-new-user',
        'message_id', _message_id,
        'queued_at', now()::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_new_user misslyckades för %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _message_id text;
  _display text;
BEGIN
  _message_id := 'welcome-' || NEW.user_id::text || '-' || extract(epoch from now())::bigint::text;
  _display := COALESCE(NEW.display_name, split_part(COALESCE(NEW.email, ''), '@', 1));

  BEGIN
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'to', NEW.email,
        'from', 'Hönsgården <noreply@notify.honsgarden.se>',
        'sender_domain', 'notify.honsgarden.se',
        'subject', 'Välkommen till Hönsgården! 🐔',
        'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 500px; padding: 30px 25px;">'
          || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />'
          || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">Hej ' || _display || '! 👋</h1>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">Vad kul att du har gått med i Hönsgården – din digitala kompanjon för hönsägare!</p>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">Här kan du registrera dina höns, logga ägg, hålla koll på foder och ekonomi – allt på ett ställe.</p>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 25px;">Du har dessutom <strong>7 dagars gratis Premium</strong> för att testa alla funktioner!</p>'
          || '<a href="https://honsgarden.lovable.app/app" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Kom igång →</a>'
          || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du registrerade dig på Hönsgården.</p>'
          || '</div>',
        'text', 'Välkommen till Hönsgården, ' || _display || '! Du har 7 dagars gratis Premium. Kom igång: https://honsgarden.lovable.app/app',
        'purpose', 'transactional',
        'label', 'welcome-email',
        'message_id', _message_id,
        'queued_at', now()::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'send_welcome_email misslyckades för %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
