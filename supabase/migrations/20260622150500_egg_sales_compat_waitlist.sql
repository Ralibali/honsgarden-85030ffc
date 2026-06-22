-- Bakåtkompatibilitet för äldre bokningsflöden och korrigerad väntelista.

CREATE OR REPLACE FUNCTION public.prepare_egg_sale_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_listing public.public_egg_sale_listings%ROWTYPE;
BEGIN
  SELECT * INTO v_listing FROM public.public_egg_sale_listings WHERE id = NEW.listing_id;
  NEW.booking_reference := COALESCE(NEW.booking_reference, 'AGD-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)));
  NEW.eggs_per_pack_snapshot := COALESCE(NEW.eggs_per_pack_snapshot, v_listing.eggs_per_pack, 12);
  NEW.price_per_pack_snapshot := COALESCE(NEW.price_per_pack_snapshot, public.egg_sale_price_for_pack(v_listing, NEW.eggs_per_pack_snapshot));
  NEW.total_amount := COALESCE(NEW.total_amount, NEW.packs * NEW.price_per_pack_snapshot);
  NEW.source := COALESCE(NULLIF(NEW.source, ''), 'legacy_insert');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_egg_sale_booking_trigger ON public.public_egg_sale_bookings;
CREATE TRIGGER prepare_egg_sale_booking_trigger
BEFORE INSERT ON public.public_egg_sale_bookings
FOR EACH ROW EXECUTE FUNCTION public.prepare_egg_sale_booking();

CREATE OR REPLACE FUNCTION public.create_missing_egg_sale_booking_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.egg_sale_booking_tokens WHERE booking_id = NEW.id) THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.egg_sale_booking_tokens (booking_id, token, token_hash, expires_at)
    VALUES (NEW.id, v_token, public.egg_sale_hash_token(v_token), now() + interval '3 years')
    ON CONFLICT (booking_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_egg_sale_booking_token_trigger ON public.public_egg_sale_bookings;
CREATE TRIGGER create_egg_sale_booking_token_trigger
AFTER INSERT ON public.public_egg_sale_bookings
FOR EACH ROW EXECUTE FUNCTION public.create_missing_egg_sale_booking_token();

CREATE OR REPLACE FUNCTION public.offer_next_egg_sale_waitlist(p_listing_id uuid, p_available_packs integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.egg_sale_waitlist%ROWTYPE;
  v_offer public.egg_sale_waitlist_offers%ROWTYPE;
BEGIN
  IF COALESCE(p_available_packs, 0) <= 0 THEN RETURN NULL; END IF;

  UPDATE public.egg_sale_waitlist_offers
  SET status = 'expired', updated_at = now()
  WHERE listing_id = p_listing_id AND status = 'offered' AND expires_at <= now();

  UPDATE public.egg_sale_waitlist w
  SET status = 'waiting', expired_at = now(), updated_at = now()
  WHERE w.listing_id = p_listing_id
    AND w.status = 'offered'
    AND w.offer_expires_at <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.egg_sale_waitlist_offers o
      WHERE o.waitlist_id = w.id AND o.status = 'accepted'
    );

  SELECT * INTO v_entry
  FROM public.egg_sale_waitlist
  WHERE listing_id = p_listing_id
    AND status = 'waiting'
    AND packs_wanted <= p_available_packs
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.egg_sale_waitlist_offers (
    waitlist_id, listing_id, seller_user_id, packs
  ) VALUES (
    v_entry.id, v_entry.listing_id, v_entry.seller_user_id, v_entry.packs_wanted
  ) RETURNING * INTO v_offer;

  UPDATE public.egg_sale_waitlist_offers
  SET token_hash = public.egg_sale_hash_token(token)
  WHERE id = v_offer.id
  RETURNING * INTO v_offer;

  UPDATE public.egg_sale_waitlist
  SET status = 'offered', offered_at = now(), offer_expires_at = v_offer.expires_at, updated_at = now()
  WHERE id = v_entry.id;

  INSERT INTO public.notification_outbox (
    seller_user_id, listing_id, recipient_email, recipient_phone,
    notification_type, subject, message, dedupe_key, payload
  ) VALUES (
    v_entry.seller_user_id, v_entry.listing_id, v_entry.customer_email, v_entry.customer_phone,
    'waitlist_offer', 'Ägg finns tillgängliga',
    'Du har ett tidsbegränsat erbjudande som gäller i 45 minuter.',
    'waitlist-offer:' || v_offer.id::text,
    jsonb_build_object('token', v_offer.token, 'offer_path', '/vantelista/' || v_offer.token, 'expires_at', v_offer.expires_at)
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN json_build_object('offer_id', v_offer.id, 'token', v_offer.token, 'expires_at', v_offer.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_waitlist_offer(p_token text, p_pickup_slot_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.egg_sale_waitlist_offers%ROWTYPE;
  v_wait public.egg_sale_waitlist%ROWTYPE;
  v_result json;
  v_booking_id uuid;
BEGIN
  SELECT * INTO v_offer
  FROM public.egg_sale_waitlist_offers
  WHERE (token_hash = public.egg_sale_hash_token(p_token) OR token = p_token)
  FOR UPDATE
  LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Erbjudandet hittades inte.'); END IF;
  IF v_offer.status = 'accepted' THEN
    RETURN json_build_object('ok', true, 'already_accepted', true, 'booking_id', v_offer.booking_id);
  END IF;
  IF v_offer.status <> 'offered' OR v_offer.expires_at <= now() THEN
    UPDATE public.egg_sale_waitlist_offers SET status = 'expired', updated_at = now() WHERE id = v_offer.id;
    RETURN json_build_object('ok', false, 'error', 'Erbjudandet har löpt ut.');
  END IF;

  SELECT * INTO v_wait FROM public.egg_sale_waitlist WHERE id = v_offer.waitlist_id FOR UPDATE;
  v_result := public.create_public_egg_sale_booking(
    v_offer.listing_id,
    v_wait.customer_name,
    COALESCE(v_wait.customer_email, 'waitlist-' || v_wait.id::text || '@honsgarden.invalid'),
    COALESCE(v_wait.customer_phone, '000000'),
    v_offer.packs,
    v_wait.eggs_per_pack,
    p_pickup_slot_id,
    'Skapad från väntelistan',
    NULL, NULL, false, 'waitlist'
  );

  v_booking_id := NULLIF(v_result->>'booking_id', '')::uuid;
  IF v_booking_id IS NULL THEN RETURN v_result; END IF;

  UPDATE public.egg_sale_waitlist_offers
  SET status = 'accepted', accepted_at = now(), booking_id = v_booking_id, updated_at = now()
  WHERE id = v_offer.id;
  UPDATE public.egg_sale_waitlist
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_wait.id;

  RETURN (v_result::jsonb || jsonb_build_object('ok', true, 'offer_id', v_offer.id))::json;
END;
$$;
