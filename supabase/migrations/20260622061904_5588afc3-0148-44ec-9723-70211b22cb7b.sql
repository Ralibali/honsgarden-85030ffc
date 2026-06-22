
-- 1. Tidsstämplar på bokningar
ALTER TABLE public.public_egg_sale_bookings
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS packed_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- 2. Historiktabell
CREATE TABLE IF NOT EXISTS public.egg_sale_booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.public_egg_sale_bookings(id) ON DELETE CASCADE,
  listing_id uuid,
  seller_user_id uuid,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  actor text NOT NULL DEFAULT 'system',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS egg_sale_booking_events_booking_idx
  ON public.egg_sale_booking_events (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS egg_sale_booking_events_seller_idx
  ON public.egg_sale_booking_events (seller_user_id, created_at DESC);

GRANT SELECT ON public.egg_sale_booking_events TO authenticated;
GRANT ALL ON public.egg_sale_booking_events TO service_role;

ALTER TABLE public.egg_sale_booking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers read own booking events" ON public.egg_sale_booking_events;
CREATE POLICY "Sellers read own booking events"
ON public.egg_sale_booking_events
FOR SELECT
TO authenticated
USING (seller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Säkra RPC:er

-- 3a. get_order_by_token – fullständig info för kundportalen
CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok record;
  v_b record;
  v_l record;
  v_slot record;
  v_seller_display text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_tok FROM egg_sale_booking_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_b FROM public_egg_sale_bookings WHERE id = v_tok.booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_l FROM public_egg_sale_listings WHERE id = v_b.listing_id;

  IF v_b.pickup_slot_id IS NOT NULL THEN
    SELECT * INTO v_slot FROM egg_sale_pickup_slots WHERE id = v_b.pickup_slot_id;
  END IF;

  IF v_l.user_id IS NOT NULL THEN
    SELECT COALESCE(display_name, split_part(email,'@',1))
    INTO v_seller_display
    FROM profiles WHERE user_id = v_l.user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking', jsonb_build_object(
      'id', v_b.id,
      'reference', upper(substr(v_b.id::text, 1, 8)),
      'customer_name', v_b.customer_name,
      'customer_phone', v_b.customer_phone,
      'customer_email', v_b.customer_email,
      'customer_message', v_b.customer_message,
      'pickup_person_name', v_b.pickup_person_name,
      'pickup_person_phone', v_b.pickup_person_phone,
      'packs', v_b.packs,
      'status', v_b.status,
      'payment_status', v_b.payment_status,
      'created_at', v_b.created_at,
      'cancelled_at', v_b.cancelled_at,
      'paid_at', v_b.paid_at,
      'packed_at', v_b.packed_at,
      'picked_up_at', v_b.picked_up_at
    ),
    'listing', jsonb_build_object(
      'id', v_l.id,
      'slug', v_l.slug,
      'title', v_l.title,
      'eggs_per_pack', COALESCE(v_l.eggs_per_pack, 12),
      'price_per_pack', v_l.price_per_pack,
      'location', v_l.location,
      'pickup_info', v_l.pickup_info,
      'latitude', v_l.latitude,
      'longitude', v_l.longitude,
      'swish_number', v_l.swish_number,
      'swish_name', v_l.swish_name,
      'swish_message', v_l.swish_message,
      'seller_display_name', v_seller_display
    ),
    'pickup_slot', CASE WHEN v_slot.id IS NOT NULL THEN jsonb_build_object(
      'id', v_slot.id,
      'starts_at', v_slot.starts_at,
      'ends_at', v_slot.ends_at,
      'label', v_slot.label
    ) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_token(text) TO anon, authenticated;

-- 3b. cancel_order_by_token – transaktionssäker avbokning
CREATE OR REPLACE FUNCTION public.cancel_order_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok record;
  v_b record;
  v_updated int;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_tok FROM egg_sale_booking_tokens
  WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_b FROM public_egg_sale_bookings
  WHERE id = v_tok.booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF v_b.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_cancelled');
  END IF;

  IF v_b.status IN ('picked_up') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_cancellable');
  END IF;

  UPDATE public_egg_sale_bookings
  SET status = 'cancelled',
      cancelled_at = COALESCE(cancelled_at, now())
  WHERE id = v_b.id AND status <> 'cancelled';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE egg_sale_booking_tokens
  SET used_at = COALESCE(used_at, now())
  WHERE id = v_tok.id;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_cancelled');
  END IF;

  INSERT INTO egg_sale_booking_events (booking_id, listing_id, seller_user_id, event_type, old_status, new_status, actor)
  VALUES (v_b.id, v_b.listing_id, v_b.seller_user_id, 'cancelled', v_b.status, 'cancelled', 'customer');

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_order_by_token(text) TO anon, authenticated;

-- 3c. list_pickup_slots_by_token – listar lediga framtida tider för aktuell säljsida
CREATE OR REPLACE FUNCTION public.list_pickup_slots_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok record;
  v_b record;
  v_rows jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_tok FROM egg_sale_booking_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_b FROM public_egg_sale_bookings WHERE id = v_tok.booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'label', s.label,
    'remaining', GREATEST(0, s.max_bookings - s.current_bookings),
    'is_current', (s.id = v_b.pickup_slot_id)
  ) ORDER BY s.starts_at), '[]'::jsonb) INTO v_rows
  FROM egg_sale_pickup_slots s
  WHERE s.listing_id = v_b.listing_id
    AND s.is_active = true
    AND s.starts_at > now()
    AND (s.id = v_b.pickup_slot_id OR s.current_bookings < s.max_bookings);

  RETURN jsonb_build_object('ok', true, 'slots', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_pickup_slots_by_token(text) TO anon, authenticated;

-- 3d. reschedule_order_by_token – byt upphämtningstid, transaktionssäkert
CREATE OR REPLACE FUNCTION public.reschedule_order_by_token(p_token text, p_new_slot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok record;
  v_b record;
  v_old_slot record;
  v_new_slot record;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 OR p_new_slot_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_tok FROM egg_sale_booking_tokens
  WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_b FROM public_egg_sale_bookings
  WHERE id = v_tok.booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF v_b.status IN ('cancelled', 'picked_up') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_reschedulable');
  END IF;

  IF v_b.pickup_slot_id = p_new_slot_id THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  -- Lås båda tidsluckorna
  SELECT * INTO v_new_slot FROM egg_sale_pickup_slots
  WHERE id = p_new_slot_id FOR UPDATE;
  IF NOT FOUND OR v_new_slot.is_active = false OR v_new_slot.listing_id <> v_b.listing_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_invalid');
  END IF;

  IF v_new_slot.starts_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_past');
  END IF;

  IF v_new_slot.current_bookings >= v_new_slot.max_bookings THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_full');
  END IF;

  IF v_b.pickup_slot_id IS NOT NULL THEN
    SELECT * INTO v_old_slot FROM egg_sale_pickup_slots
    WHERE id = v_b.pickup_slot_id FOR UPDATE;
    IF FOUND THEN
      UPDATE egg_sale_pickup_slots
      SET current_bookings = GREATEST(0, current_bookings - 1)
      WHERE id = v_old_slot.id;
    END IF;
  END IF;

  UPDATE egg_sale_pickup_slots
  SET current_bookings = current_bookings + 1
  WHERE id = v_new_slot.id;

  -- Uppdatera bokningen – triggern adjust_slot_count_on_booking gör inget
  -- vid pickup_slot_id-byte utan status-byte, så vi har räknat manuellt.
  UPDATE public_egg_sale_bookings
  SET pickup_slot_id = v_new_slot.id
  WHERE id = v_b.id;

  INSERT INTO egg_sale_booking_events
    (booking_id, listing_id, seller_user_id, event_type, old_status, new_status, actor, metadata)
  VALUES
    (v_b.id, v_b.listing_id, v_b.seller_user_id, 'rescheduled', v_b.status, v_b.status, 'customer',
     jsonb_build_object('old_slot_id', v_b.pickup_slot_id, 'new_slot_id', v_new_slot.id));

  RETURN jsonb_build_object(
    'ok', true,
    'pickup_slot', jsonb_build_object(
      'id', v_new_slot.id,
      'starts_at', v_new_slot.starts_at,
      'ends_at', v_new_slot.ends_at,
      'label', v_new_slot.label
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_order_by_token(text, uuid) TO anon, authenticated;
