-- Google purchases remain server-only. Never put purchase tokens in client-readable preferences.
CREATE TABLE public.google_play_purchases (
  purchase_token text PRIMARY KEY CHECK (length(purchase_token) BETWEEN 10 AND 4096),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL CHECK (product_id = 'honsgarden_plus'),
  base_plan_id text NOT NULL CHECK (base_plan_id IN ('monthly','yearly')),
  subscription_state text NOT NULL,
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL,
  test_purchase boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL
);
CREATE INDEX google_play_purchases_user_id_idx ON public.google_play_purchases(user_id);
ALTER TABLE public.google_play_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_play_purchases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_play_purchases TO service_role;

CREATE OR REPLACE FUNCTION public.billing_without_google_expiry(prefs jsonb, cached timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN prefs->'google_play'->>'verified' = 'true'
    AND cached = (prefs->'google_play'->>'expires_at')::timestamptz
    THEN (prefs->'google_play'->>'previous_premium_expires_at')::timestamptz ELSE cached END;
$$;
REVOKE ALL ON FUNCTION public.billing_without_google_expiry(jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_without_google_expiry(jsonb,timestamptz) TO service_role;

-- Apple billing metadata is server-owned, even though other preferences are editable.
CREATE OR REPLACE FUNCTION public.protect_apple_iap_preferences()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  NEW.preferences := coalesce(NEW.preferences, '{}'::jsonb) - 'apple_iap' - 'stripe_plus' - 'google_play';
  IF TG_OP = 'UPDATE' AND OLD.preferences ? 'apple_iap' THEN
    NEW.preferences := jsonb_set(NEW.preferences, '{apple_iap}', OLD.preferences->'apple_iap');
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.preferences ? 'stripe_plus' THEN
    NEW.preferences := jsonb_set(NEW.preferences, '{stripe_plus}', OLD.preferences->'stripe_plus');
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.preferences ? 'google_play' THEN
    NEW.preferences := jsonb_set(NEW.preferences, '{google_play}', OLD.preferences->'google_play');
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
  p.premium_expires_at := public.billing_without_google_expiry(p.preferences, p.premium_expires_at);
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
  SELECT * INTO STRICT p FROM public.profiles WHERE user_id = _user_id;
  next_expiry := p.premium_expires_at;
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
  p.premium_expires_at := public.billing_without_google_expiry(p.preferences, p.premium_expires_at);
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

-- Run after the existing preference guards. All inputs are protected server-owned metadata.
CREATE OR REPLACE FUNCTION public.merge_google_play_access()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  g jsonb;
  independent_end timestamptz;
  google_end timestamptz;
BEGIN
  g := NEW.preferences->'google_play';
  IF g->>'verified' IS DISTINCT FROM 'true' THEN RETURN NEW; END IF;
  independent_end := NEW.premium_expires_at;
  IF TG_OP = 'UPDATE' AND NEW.premium_expires_at IS NOT DISTINCT FROM OLD.premium_expires_at
    AND OLD.preferences->'google_play'->>'verified' = 'true'
    AND OLD.premium_expires_at = (OLD.preferences->'google_play'->>'expires_at')::timestamptz THEN
    independent_end := (OLD.preferences->'google_play'->>'previous_premium_expires_at')::timestamptz;
  END IF;
  IF NEW.preferences->'apple_iap'->>'verified' = 'true' AND NEW.preferences->'apple_iap'->>'revoked_at' IS NULL THEN
    independent_end := greatest(independent_end, (NEW.preferences->'apple_iap'->>'expires_at')::timestamptz);
  END IF;
  IF NEW.preferences->'stripe_plus'->>'active' = 'true' THEN
    independent_end := greatest(independent_end, (NEW.preferences->'stripe_plus'->>'expires_at')::timestamptz);
  END IF;
  google_end := (g->>'expires_at')::timestamptz;
  NEW.preferences := jsonb_set(NEW.preferences, '{google_play}',
    g || jsonb_build_object('previous_premium_expires_at', independent_end));
  NEW.premium_expires_at := CASE WHEN NEW.is_lifetime_premium THEN NULL ELSE greatest(independent_end, google_end) END;
  NEW.subscription_status := CASE WHEN NEW.is_lifetime_premium OR NEW.premium_expires_at > now() THEN 'premium' ELSE 'free' END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.merge_google_play_access() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_merge_google_play_access BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.merge_google_play_access();

CREATE OR REPLACE FUNCTION public.apply_google_play_purchase(_user_id uuid, _purchase_token text, _state jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  p public.profiles%ROWTYPE;
  existing public.google_play_purchases%ROWTYPE;
  google_end timestamptz;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Server billing access required' USING ERRCODE = '42501';
  END IF;
  IF _state->>'product_id' IS DISTINCT FROM 'honsgarden_plus'
    OR coalesce(_state->>'base_plan_id','') NOT IN ('monthly','yearly')
    OR nullif(_state->>'observed_at','') IS NULL OR nullif(_state->>'expires_at','') IS NULL
    OR ((_state->>'active')::boolean AND _state->>'acknowledged' IS DISTINCT FROM 'true')
    OR _state->>'active' IS NULL OR _state->>'test' IS NULL THEN
    RAISE EXCEPTION 'Invalid verified Google purchase';
  END IF;
  SELECT * INTO STRICT p FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  SELECT * INTO existing FROM public.google_play_purchases WHERE purchase_token = _purchase_token FOR UPDATE;
  IF FOUND AND existing.user_id <> _user_id THEN
    RAISE EXCEPTION 'Purchase account mismatch' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.google_play_purchases(purchase_token,user_id,product_id,base_plan_id,subscription_state,expires_at,active,test_purchase,observed_at)
  VALUES (_purchase_token,_user_id,_state->>'product_id',_state->>'base_plan_id',_state->>'state',
    (_state->>'expires_at')::timestamptz,(_state->>'active')::boolean,(_state->>'test')::boolean,(_state->>'observed_at')::timestamptz)
  ON CONFLICT (purchase_token) DO UPDATE SET
    subscription_state=excluded.subscription_state, expires_at=excluded.expires_at, active=excluded.active,
    base_plan_id=excluded.base_plan_id, test_purchase=excluded.test_purchase, observed_at=excluded.observed_at
  WHERE public.google_play_purchases.user_id = excluded.user_id
    AND public.google_play_purchases.observed_at < excluded.observed_at;
  -- Also catches a concurrent first claim by a different account.
  IF EXISTS (SELECT 1 FROM public.google_play_purchases WHERE purchase_token=_purchase_token AND user_id<>_user_id) THEN
    RAISE EXCEPTION 'Purchase account mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT max(expires_at) INTO google_end FROM public.google_play_purchases
    WHERE user_id=_user_id AND active AND expires_at > now();
  UPDATE public.profiles SET preferences=jsonb_set(coalesce(preferences,'{}'::jsonb),'{google_play}',
    jsonb_build_object('verified',true,'expires_at',google_end)) WHERE user_id=_user_id;
  SELECT * INTO STRICT p FROM public.profiles WHERE user_id=_user_id;
  RETURN jsonb_build_object('subscribed',p.is_lifetime_premium OR coalesce(p.premium_expires_at>now(),false),
    'subscription_end',p.premium_expires_at,'premium_type',CASE WHEN p.is_lifetime_premium THEN 'lifetime'
      WHEN google_end>now() THEN 'paid' WHEN p.premium_expires_at>now() THEN 'trial' ELSE 'free' END,
    'source',CASE WHEN google_end>now() THEN 'google' ELSE 'other' END);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_google_play_purchase(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_google_play_purchase(uuid,text,jsonb) TO service_role;
