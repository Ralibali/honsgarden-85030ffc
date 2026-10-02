-- A device token can move between accounts on one phone. Only a live, signed
-- session may register it; the sender independently checks that session again.
-- Existing unbound tokens remain stored but are not used by the new sender.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.register_native_push(p_token text, p_platform text, p_registration_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller uuid := auth.uid();
  session_id text := auth.jwt()->>'session_id';
BEGIN
  IF caller IS NULL OR session_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.sessions s WHERE s.id::text = session_id AND s.user_id = caller
      AND (s.not_after IS NULL OR s.not_after > now())
  ) THEN RAISE EXCEPTION 'Active session required' USING ERRCODE = '42501'; END IF;

  IF p_registration_id IS NULL OR p_platform IS NULL OR p_token IS NULL OR NOT (
    (p_platform = 'ios' AND p_token ~ '^[a-fA-F0-9]{64}$') OR
    (p_platform = 'android' AND length(p_token) BETWEEN 20 AND 4096 AND p_token ~ '^[A-Za-z0-9:_-]+$')
  ) THEN RAISE EXCEPTION 'Invalid device registration' USING ERRCODE = '22023'; END IF;

  -- Serialize rotation/rebinding for this token without exposing other owners.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_token, 0));
  DELETE FROM public.device_tokens d WHERE d.user_id = caller AND d.platform = p_platform
    AND d.device_info->>'session_id' = session_id AND d.token <> p_token;

  INSERT INTO public.device_tokens (user_id, token, platform, device_info, updated_at)
    VALUES (caller, p_token, p_platform, jsonb_build_object('session_id', session_id, 'registration_id', p_registration_id), now())
  ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform, updated_at = EXCLUDED.updated_at,
    device_info = EXCLUDED.device_info || CASE
      WHEN public.device_tokens.platform = EXCLUDED.platform
        AND public.device_tokens.device_info->>'apns_environment' IN ('production', 'sandbox')
      THEN jsonb_build_object('apns_environment', public.device_tokens.device_info->>'apns_environment')
      ELSE '{}'::jsonb END;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION app_private.register_native_push(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.register_native_push(text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_native_push(p_token text, p_platform text, p_registration_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app_private.register_native_push(p_token, p_platform, p_registration_id);
$$;
REVOKE ALL ON FUNCTION public.register_native_push(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_native_push(text, text, uuid) TO authenticated;

-- Session metadata is server-derived; clients may still delete their own device.
REVOKE INSERT, UPDATE ON public.device_tokens FROM authenticated;

CREATE OR REPLACE FUNCTION app_private.active_native_push_tokens(p_user_ids uuid[], p_token text DEFAULT NULL)
RETURNS SETOF public.device_tokens
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.* FROM public.device_tokens d
  JOIN auth.sessions s ON s.id::text = d.device_info->>'session_id' AND s.user_id = d.user_id
  WHERE d.user_id = ANY(p_user_ids[1:200]) AND d.platform IN ('ios', 'android')
    AND (s.not_after IS NULL OR s.not_after > now())
    AND (p_token IS NULL OR d.token = p_token);
$$;
REVOKE ALL ON FUNCTION app_private.active_native_push_tokens(uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.active_native_push_tokens(uuid[], text) TO service_role;

CREATE OR REPLACE FUNCTION public.active_native_push_tokens(p_user_ids uuid[], p_token text DEFAULT NULL)
RETURNS SETOF public.device_tokens
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM app_private.active_native_push_tokens(p_user_ids, p_token);
$$;
REVOKE ALL ON FUNCTION public.active_native_push_tokens(uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.active_native_push_tokens(uuid[], text) TO service_role;
