-- Recension via ordertoken och deduplicerade upphämtningspåminnelser.

CREATE OR REPLACE FUNCTION public.create_review_by_booking_token(
  p_token text,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_booking public.public_egg_sale_bookings%ROWTYPE; v_review_id uuid;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN json_build_object('ok', false, 'error', 'Betyget måste vara 1–5.');
  END IF;

  SELECT b.* INTO v_booking
  FROM public.egg_sale_booking_tokens t
  JOIN public.public_egg_sale_bookings b ON b.id = t.booking_id
  WHERE (t.token_hash = public.egg_sale_hash_token(p_token) OR t.token = p_token)
    AND t.revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Bokningen hittades inte.'); END IF;
  IF v_booking.status <> 'picked_up' THEN
    RETURN json_build_object('ok', false, 'error', 'Recension kan lämnas efter genomförd hämtning.');
  END IF;

  INSERT INTO public.egg_sale_reviews (
    booking_id, listing_id, seller_user_id, customer_name, rating, comment, is_published
  ) VALUES (
    v_booking.id, v_booking.listing_id, v_booking.seller_user_id,
    v_booking.customer_name, p_rating, nullif(trim(p_comment), ''), true
  )
  ON CONFLICT (booking_id) DO NOTHING
  RETURNING id INTO v_review_id;

  IF v_review_id IS NULL THEN
    RETURN json_build_object('ok', true, 'already_submitted', true);
  END IF;
  RETURN json_build_object('ok', true, 'review_id', v_review_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_egg_sale_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_first integer := 0; v_second integer := 0;
BEGIN
  INSERT INTO public.notification_outbox (
    seller_user_id, booking_id, listing_id, recipient_email, recipient_phone,
    notification_type, subject, message, dedupe_key, scheduled_at
  )
  SELECT
    b.seller_user_id, b.id, b.listing_id, b.customer_email, b.customer_phone,
    'pickup_reminder_24h', 'Påminnelse om ägghämtning',
    'Din upphämtning är planerad till ' || to_char(s.starts_at AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI') || '.',
    'pickup-24h:' || b.id::text,
    s.starts_at - interval '24 hours'
  FROM public.public_egg_sale_bookings b
  JOIN public.egg_sale_pickup_slots s ON s.id = b.pickup_slot_id
  WHERE b.status IN ('reserved','confirmed','paid','packed','ready')
    AND s.starts_at > now()
    AND s.starts_at <= now() + interval '14 days'
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_first = ROW_COUNT;

  INSERT INTO public.notification_outbox (
    seller_user_id, booking_id, listing_id, recipient_email, recipient_phone,
    notification_type, subject, message, dedupe_key, scheduled_at
  )
  SELECT
    b.seller_user_id, b.id, b.listing_id, b.customer_email, b.customer_phone,
    'pickup_reminder_2h', 'Snart dags att hämta dina ägg',
    'Din upphämtning börjar ' || to_char(s.starts_at AT TIME ZONE 'Europe/Stockholm', 'HH24:MI') || '.',
    'pickup-2h:' || b.id::text,
    s.starts_at - interval '2 hours'
  FROM public.public_egg_sale_bookings b
  JOIN public.egg_sale_pickup_slots s ON s.id = b.pickup_slot_id
  WHERE b.status IN ('reserved','confirmed','paid','packed','ready')
    AND s.starts_at > now()
    AND s.starts_at <= now() + interval '14 days'
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_second = ROW_COUNT;

  RETURN v_first + v_second;
END;
$$;

REVOKE ALL ON FUNCTION public.create_review_by_booking_token(text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_egg_sale_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_review_by_booking_token(text,integer,text) TO anon, authenticated;
