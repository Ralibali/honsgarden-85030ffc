DROP POLICY IF EXISTS "Anyone can read by token" ON public.egg_sale_booking_tokens;
DROP POLICY IF EXISTS "Anyone can mark used" ON public.egg_sale_booking_tokens;
REVOKE SELECT, UPDATE ON public.egg_sale_booking_tokens FROM anon;
REVOKE SELECT, UPDATE ON public.egg_sale_booking_tokens FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_booking_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok record;
  v_b record;
BEGIN
  SELECT * INTO v_tok FROM egg_sale_booking_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF v_tok.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'used');
  END IF;
  SELECT b.*, l.title AS listing_title INTO v_b
  FROM public_egg_sale_bookings b
  LEFT JOIN public_egg_sale_listings l ON l.id = b.listing_id
  WHERE b.id = v_tok.booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF v_b.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'used');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'customer_name', v_b.customer_name,
    'packs', v_b.packs,
    'status', v_b.status,
    'listing_title', v_b.listing_title
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok record;
  v_updated int;
BEGIN
  SELECT * INTO v_tok
  FROM egg_sale_booking_tokens
  WHERE token = p_token
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF v_tok.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'used');
  END IF;
  UPDATE public_egg_sale_bookings
  SET status = 'cancelled'
  WHERE id = v_tok.booking_id AND status <> 'cancelled';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  UPDATE egg_sale_booking_tokens
  SET used_at = now()
  WHERE id = v_tok.id;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'used');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_by_token(text) FROM public;
REVOKE ALL ON FUNCTION public.cancel_booking_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_token(text) TO anon, authenticated;