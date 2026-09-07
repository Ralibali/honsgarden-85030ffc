-- Apple billing metadata is server-owned, even though other preferences are editable.
CREATE OR REPLACE FUNCTION public.protect_apple_iap_preferences()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  NEW.preferences := coalesce(NEW.preferences, '{}'::jsonb) - 'apple_iap' - 'stripe_plus';
  IF TG_OP = 'UPDATE' AND OLD.preferences ? 'apple_iap' THEN
    NEW.preferences := jsonb_set(NEW.preferences, '{apple_iap}', OLD.preferences->'apple_iap');
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.preferences ? 'stripe_plus' THEN
    NEW.preferences := jsonb_set(NEW.preferences, '{stripe_plus}', OLD.preferences->'stripe_plus');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_apple_iap_preferences ON public.profiles;
CREATE TRIGGER protect_apple_iap_preferences BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_apple_iap_preferences();

-- The row lock makes app restores and server notifications atomic. An old receipt
-- must not overwrite a later refund, and unrelated preferences must survive.
CREATE OR REPLACE FUNCTION public.apply_apple_iap_entitlement(_user_id uuid, _entitlement jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  old_apple jsonb;
  next_apple jsonb;
  prior_expiry timestamptz;
  apple_expiry timestamptz;
  next_expiry timestamptz;
  active boolean;
  ignored boolean := false;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Server billing access required' USING ERRCODE = '42501';
  END IF;
  IF _entitlement->>'verified' IS DISTINCT FROM 'true'
    OR coalesce(_entitlement->>'product_id', '') NOT IN ('se.honsgarden.plus.monthly', 'se.honsgarden.plus.yearly')
    OR coalesce(_entitlement->>'environment', '') NOT IN ('Production', 'Sandbox')
    OR nullif(_entitlement->>'original_transaction_id', '') IS NULL
    OR nullif(_entitlement->>'transaction_id', '') IS NULL
    OR nullif(_entitlement->>'signed_at', '') IS NULL
    OR nullif(_entitlement->>'expires_at', '') IS NULL THEN
    RAISE EXCEPTION 'Invalid verified Apple entitlement';
  END IF;

  SELECT * INTO STRICT p FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  old_apple := p.preferences->'apple_iap';
  next_apple := _entitlement;
  IF old_apple IS NOT NULL THEN
    IF old_apple->>'environment' = 'Production' AND next_apple->>'environment' = 'Sandbox' THEN
      ignored := true;
    ELSIF old_apple->>'original_transaction_id' = next_apple->>'original_transaction_id' THEN
      IF old_apple->>'transaction_id' <> next_apple->>'transaction_id' THEN
        -- A refund for an older billing period must not revoke a newer renewal.
        ignored := (next_apple->>'expires_at')::timestamptz < (old_apple->>'expires_at')::timestamptz
          OR (next_apple->>'revoked_at' IS NOT NULL
            AND (next_apple->>'expires_at')::timestamptz <= (old_apple->>'expires_at')::timestamptz);
      ELSE
        ignored := (next_apple->>'signed_at')::timestamptz < (old_apple->>'signed_at')::timestamptz
          OR ((next_apple->>'signed_at')::timestamptz = (old_apple->>'signed_at')::timestamptz
            AND old_apple->>'revoked_at' IS NOT NULL AND next_apple->>'revoked_at' IS NULL);
      END IF;
    ELSE
      ignored := next_apple->>'revoked_at' IS NOT NULL
        OR (old_apple->>'revoked_at' IS NULL
          AND (old_apple->>'expires_at')::timestamptz > now()
          AND (old_apple->>'expires_at')::timestamptz > (next_apple->>'expires_at')::timestamptz);
    END IF;
  END IF;

  IF ignored THEN
    next_apple := old_apple;
    next_expiry := p.premium_expires_at;
  ELSE
    -- Preserve independently granted access (trial, gift or a Stripe webhook).
    prior_expiry := (old_apple->>'previous_premium_expires_at')::timestamptz;
    IF old_apple IS NULL OR p.premium_expires_at IS DISTINCT FROM (old_apple->>'expires_at')::timestamptz THEN
      prior_expiry := p.premium_expires_at;
    END IF;
    next_apple := next_apple || jsonb_build_object('previous_premium_expires_at', prior_expiry);
    apple_expiry := CASE WHEN next_apple->>'revoked_at' IS NULL THEN (next_apple->>'expires_at')::timestamptz END;
    next_expiry := greatest(prior_expiry, apple_expiry);
    UPDATE public.profiles SET
      preferences = jsonb_set(coalesce(preferences, '{}'::jsonb), '{apple_iap}', next_apple),
      subscription_status = CASE WHEN is_lifetime_premium OR next_expiry > now() THEN 'premium' ELSE 'free' END,
      premium_expires_at = CASE WHEN is_lifetime_premium THEN NULL ELSE next_expiry END
    WHERE user_id = _user_id;
  END IF;
  active := next_apple->>'revoked_at' IS NULL AND (next_apple->>'expires_at')::timestamptz > now();
  RETURN jsonb_build_object('subscribed', coalesce(p.is_lifetime_premium, false) OR active OR coalesce(next_expiry > now(), false),
    'premium_type', CASE WHEN p.is_lifetime_premium THEN 'lifetime' WHEN active THEN 'paid' WHEN next_expiry > now() THEN 'trial' ELSE 'free' END,
    'subscription_end', CASE WHEN p.is_lifetime_premium THEN NULL WHEN active THEN next_apple->>'expires_at' ELSE next_expiry::text END,
    'source', CASE WHEN p.is_lifetime_premium THEN 'lifetime' WHEN active THEN 'apple' WHEN next_expiry > now() THEN 'trial' ELSE 'free' END, 'ignored', ignored);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_apple_iap_entitlement(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_apple_iap_entitlement(uuid, jsonb) TO service_role;

-- Synchronize provider overlap under the same profile row lock. A Stripe
-- cancellation must also remove its cached grant inside Apple metadata.
CREATE OR REPLACE FUNCTION public.apply_stripe_plus_status(
  _user_id uuid, _customer_id text, _active boolean, _period_end timestamptz, _observed_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  apple jsonb;
  prefs jsonb;
  other_end timestamptz;
  old_stripe_end timestamptz;
  apple_end timestamptz;
  access_end timestamptz;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Server billing access required' USING ERRCODE = '42501';
  END IF;
  IF nullif(_customer_id, '') IS NULL OR _observed_at IS NULL OR _active IS NULL OR (_active AND _period_end IS NULL) THEN
    RAISE EXCEPTION 'Incomplete Stripe subscription state';
  END IF;
  SELECT * INTO STRICT p FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  prefs := coalesce(p.preferences, '{}'::jsonb);
  IF (prefs->'stripe_plus'->>'observed_at')::timestamptz > _observed_at THEN RETURN; END IF;
  apple := prefs->'apple_iap';
  other_end := p.premium_expires_at;
  IF apple IS NOT NULL AND other_end = (apple->>'expires_at')::timestamptz THEN
    other_end := (apple->>'previous_premium_expires_at')::timestamptz;
  END IF;
  old_stripe_end := coalesce((prefs->'stripe_plus'->>'expires_at')::timestamptz, _period_end);
  IF other_end = old_stripe_end THEN other_end := NULL; END IF;
  IF _active THEN other_end := greatest(other_end, _period_end); END IF;
  IF apple IS NOT NULL THEN
    apple := apple || jsonb_build_object('previous_premium_expires_at', other_end);
    prefs := jsonb_set(prefs, '{apple_iap}', apple);
    IF apple->>'verified' = 'true' AND apple->>'revoked_at' IS NULL THEN apple_end := (apple->>'expires_at')::timestamptz; END IF;
  END IF;
  prefs := jsonb_set(prefs, '{stripe_plus}', jsonb_build_object('active', _active, 'expires_at', _period_end, 'observed_at', _observed_at));
  access_end := greatest(other_end, apple_end);
  UPDATE public.profiles SET preferences = prefs, stripe_customer_id = _customer_id,
    subscription_status = CASE WHEN is_lifetime_premium OR access_end > now() THEN 'premium' ELSE 'free' END,
    premium_expires_at = CASE WHEN is_lifetime_premium THEN NULL ELSE access_end END
  WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_stripe_plus_status(uuid,text,boolean,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_plus_status(uuid,text,boolean,timestamptz,timestamptz) TO service_role;
