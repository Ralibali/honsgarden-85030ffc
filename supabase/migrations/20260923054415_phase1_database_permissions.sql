-- Fas 1: database privileges and compatible callers.

-- Scope policies before revoking helper access, including Storage policies.
DO $migration$
DECLARE p record;
BEGIN
  FOR p IN SELECT * FROM pg_policies
    WHERE 'public' = ANY(roles)
      AND (coalesce(qual, '') || coalesce(with_check, ''))
          ~ '(get_farm_user_ids|get_user_farm_ids|get_farm_member_display_names)'
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.get_farm_user_ids(_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid WHERE _uid = auth.uid() OR auth.role() = 'service_role'
  UNION
  SELECT fm2.user_id FROM public.farm_members fm1
  JOIN public.farm_members fm2 ON fm1.farm_id = fm2.farm_id
  WHERE fm1.user_id = _uid AND fm2.user_id != _uid
    AND (_uid = auth.uid() OR auth.role() = 'service_role')
$$;

CREATE OR REPLACE FUNCTION public.get_user_farm_ids(_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT farm_id FROM public.farm_members WHERE user_id = _uid
    AND (_uid = auth.uid() OR auth.role() = 'service_role')
$$;

CREATE OR REPLACE FUNCTION public.get_farm_member_display_names(_uid uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.display_name FROM public.profiles p
  WHERE p.user_id IN (SELECT public.get_farm_user_ids(_uid)) AND p.user_id != _uid
    AND (_uid = auth.uid() OR auth.role() = 'service_role')
$$;

REVOKE EXECUTE ON FUNCTION public.get_farm_user_ids(uuid), public.get_user_farm_ids(uuid), public.get_farm_member_display_names(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_farm_user_ids(uuid), public.get_user_farm_ids(uuid), public.get_farm_member_display_names(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_grant_premium_days(_user_id uuid, _days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM public.grant_premium_days(_user_id, _days);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_lifetime_premium(_user_id uuid, _is_lifetime boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  PERFORM public.set_lifetime_premium(_user_id, _is_lifetime);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_premium_days(uuid, integer), public.admin_set_lifetime_premium(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_premium_days(uuid, integer), public.admin_set_lifetime_premium(uuid, boolean) TO authenticated;

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

  -- Attribution belongs to the trusted signup transaction; no client session is required.
  IF nullif(trim(NEW.raw_user_meta_data->>'referral_code'), '') IS NOT NULL THEN
    PERFORM public.process_referral(NEW.raw_user_meta_data->>'referral_code', NEW.id);
  END IF;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user totalfel för %: %', new.id, SQLERRM;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin')
     OR current_setting('app.trusted_premium_grant', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Auth trigger (no JWT): allow first-time local trial onto a never-paid row.
  IF auth.uid() IS NULL AND auth.role() IS NULL
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

CREATE OR REPLACE FUNCTION public.grant_premium_days(_user_id UUID, _days INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  previous_trust text := current_setting('app.trusted_premium_grant', true);
  current_expires TIMESTAMP WITH TIME ZONE;
  new_expires TIMESTAMP WITH TIME ZONE;
BEGIN
  PERFORM set_config('app.trusted_premium_grant', 'on', true);
  SELECT premium_expires_at INTO current_expires FROM public.profiles WHERE user_id = _user_id;

  -- If already premium and not expired, extend from current expiry
  IF current_expires IS NOT NULL AND current_expires > now() THEN
    new_expires := current_expires + (_days || ' days')::interval;
  ELSE
    new_expires := now() + (_days || ' days')::interval;
  END IF;

  UPDATE public.profiles
  SET subscription_status = 'premium', premium_expires_at = new_expires
  WHERE user_id = _user_id;
  -- Never leave the privilege flag enabled for subsequent statements.
  PERFORM set_config('app.trusted_premium_grant', coalesce(previous_trust, ''), true);
END;
$$;

-- Handle every existing overload and remove Supabase's explicit default grants.
DO $migration$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY['enqueue_email', 'read_email_batch', 'delete_email', 'move_to_dlq', 'shop_finalize_paid_order', 'grant_premium_days', 'set_lifetime_premium', 'grant_referral_reward_for_referred', 'process_referral', 'check_rate_limit', 'count_user_backups_today', 'count_user_reports_today', 'deactivate_expired_simple_listings', 'expire_marketplace_listings'])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
  END LOOP;
END;
$migration$;

REVOKE SELECT ON TABLE public.public_egg_sale_listings FROM authenticated;
REVOKE SELECT (owner_email, contact_phone, manage_token, submitted_ip) ON public.public_egg_sale_listings FROM authenticated;
GRANT SELECT (
  id, user_id, slug, title, description, image_url, packs_available, eggs_per_pack,
  price_per_pack, location, pickup_info, contact_info, swish_number, swish_name,
  swish_message, p6_price, p12_price, p30_price, is_active, reserved_packs,
  sold_out_manually, created_at, updated_at, stock_packs, stock_source, auto_publish,
  regular_customer_threshold, latitude, longitude, listing_kind, verified_at,
  expires_at, theme, sections, price_tiers, reko_enabled, reko_group_name,
  reko_pickup_location, reko_next_pickup_at, reko_recurring_biweekly, reko_reminder_sent_for
) ON public.public_egg_sale_listings TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_listing_private(p_listing_id uuid)
RETURNS TABLE(owner_email text, contact_phone text, manage_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.public_egg_sale_listings l WHERE l.id = p_listing_id
      AND (l.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT l.owner_email, l.contact_phone, l.manage_token::text
    FROM public.public_egg_sale_listings l WHERE l.id = p_listing_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_listing_private(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_listing_private(uuid) TO authenticated;
