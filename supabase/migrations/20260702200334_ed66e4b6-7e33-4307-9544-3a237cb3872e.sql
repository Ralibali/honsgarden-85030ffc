CREATE TABLE IF NOT EXISTS public.public_egg_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ort_slug text,
  ort_name text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  verify_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  unsubscribe_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, ort_slug)
);

CREATE INDEX IF NOT EXISTS public_egg_alerts_ort_verified_idx
  ON public.public_egg_alerts (ort_slug) WHERE verified = true;

GRANT SELECT ON public.public_egg_alerts TO service_role;
GRANT ALL ON public.public_egg_alerts TO service_role;

ALTER TABLE public.public_egg_alerts ENABLE ROW LEVEL SECURITY;

-- Ingen direkt åtkomst för anon/authenticated – all insert går via RPC eller edge function.
-- (Admin når via service_role i admin-panelen.)

-- Anonym insert via SECURITY DEFINER RPC. Endast e-post + ortkontext accepteras.
CREATE OR REPLACE FUNCTION public.request_public_egg_alert(
  p_email text,
  p_ort_slug text DEFAULT NULL,
  p_ort_name text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_row public.public_egg_alerts%ROWTYPE;
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 255 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;

  INSERT INTO public.public_egg_alerts (
    email, ort_slug, ort_name, source, utm_source, utm_medium, utm_campaign
  ) VALUES (
    v_email,
    NULLIF(trim(p_ort_slug), ''),
    NULLIF(trim(p_ort_name), ''),
    NULLIF(trim(p_source), ''),
    NULLIF(trim(p_utm_source), ''),
    NULLIF(trim(p_utm_medium), ''),
    NULLIF(trim(p_utm_campaign), '')
  )
  ON CONFLICT (email, ort_slug) DO UPDATE
    SET updated_at = now(),
        source = COALESCE(EXCLUDED.source, public_egg_alerts.source),
        utm_source = COALESCE(EXCLUDED.utm_source, public_egg_alerts.utm_source),
        utm_medium = COALESCE(EXCLUDED.utm_medium, public_egg_alerts.utm_medium),
        utm_campaign = COALESCE(EXCLUDED.utm_campaign, public_egg_alerts.utm_campaign)
    RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.public_egg_alerts
      WHERE email = v_email AND ort_slug IS NOT DISTINCT FROM NULLIF(trim(p_ort_slug), '');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'verify_token', v_row.verify_token,
    'already_verified', v_row.verified,
    'email', v_row.email,
    'ort_name', v_row.ort_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_public_egg_alert(text, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_public_egg_alert(text, text, text, text, text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_public_egg_alert(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.public_egg_alerts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.public_egg_alerts WHERE verify_token = p_token;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  IF NOT v_row.verified THEN
    UPDATE public.public_egg_alerts
      SET verified = true, verified_at = now(), updated_at = now()
      WHERE id = v_row.id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'email', v_row.email, 'ort_name', v_row.ort_name);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_public_egg_alert(text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_public_egg_alert(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.unsubscribe_public_egg_alert(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.public_egg_alerts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.public_egg_alerts WHERE unsubscribe_token = p_token;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  DELETE FROM public.public_egg_alerts WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'email', v_row.email);
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_public_egg_alert(text) FROM public;
GRANT EXECUTE ON FUNCTION public.unsubscribe_public_egg_alert(text) TO anon, authenticated, service_role;

CREATE TRIGGER update_public_egg_alerts_updated_at
  BEFORE UPDATE ON public.public_egg_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();