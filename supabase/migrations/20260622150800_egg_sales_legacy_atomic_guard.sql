-- Gör även befintliga direkta bokningsinserts transaktionellt säkra.
-- Detta skyddar gamla klienter och publicerade säljsidor under övergången.

CREATE OR REPLACE FUNCTION public.guard_legacy_egg_sale_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.public_egg_sale_listings%ROWTYPE;
  v_slot public.egg_sale_pickup_slots%ROWTYPE;
  v_reserved integer;
  v_slot_count integer;
  v_capacity integer;
BEGIN
  SELECT * INTO v_listing
  FROM public.public_egg_sale_listings
  WHERE id = NEW.listing_id
  FOR UPDATE;

  IF NOT FOUND OR v_listing.is_active IS NOT TRUE OR v_listing.sold_out_manually IS TRUE THEN
    RAISE EXCEPTION 'Säljsidan är inte tillgänglig just nu.';
  END IF;

  SELECT COALESCE(sum(packs), 0)::integer INTO v_reserved
  FROM public.public_egg_sale_bookings
  WHERE listing_id = NEW.listing_id
    AND status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready');

  v_capacity := COALESCE(NULLIF(v_listing.stock_packs, 0), v_listing.packs_available, 0);
  IF COALESCE(NEW.packs, 0) < 1 OR v_reserved + NEW.packs > v_capacity THEN
    RAISE EXCEPTION 'Det finns inte tillräckligt många förpackningar kvar.';
  END IF;

  IF NEW.pickup_slot_id IS NOT NULL THEN
    SELECT * INTO v_slot
    FROM public.egg_sale_pickup_slots
    WHERE id = NEW.pickup_slot_id
      AND listing_id = NEW.listing_id
      AND is_active = true
      AND starts_at > now()
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Den valda upphämtningstiden är inte längre tillgänglig.';
    END IF;

    SELECT count(*)::integer INTO v_slot_count
    FROM public.public_egg_sale_bookings
    WHERE pickup_slot_id = NEW.pickup_slot_id
      AND status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready');

    IF v_slot_count >= v_slot.max_bookings THEN
      RAISE EXCEPTION 'Den valda upphämtningstiden är fullbokad.';
    END IF;
  END IF;

  NEW.seller_user_id := v_listing.user_id;
  NEW.booking_reference := COALESCE(
    NEW.booking_reference,
    'AGD-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10))
  );
  NEW.eggs_per_pack_snapshot := COALESCE(NEW.eggs_per_pack_snapshot, v_listing.eggs_per_pack, 12);
  NEW.price_per_pack_snapshot := COALESCE(
    NEW.price_per_pack_snapshot,
    public.egg_sale_price_for_pack(v_listing, NEW.eggs_per_pack_snapshot)
  );
  NEW.total_amount := COALESCE(NEW.total_amount, NEW.packs * NEW.price_per_pack_snapshot);
  NEW.status := COALESCE(NULLIF(NEW.status, ''), 'reserved');
  NEW.payment_status := COALESCE(NULLIF(NEW.payment_status, ''), 'unpaid');
  NEW.source := COALESCE(NULLIF(NEW.source, ''), 'legacy_insert');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_egg_sale_booking_trigger ON public.public_egg_sale_bookings;
DROP TRIGGER IF EXISTS a_guard_egg_sale_booking ON public.public_egg_sale_bookings;
CREATE TRIGGER a_guard_egg_sale_booking
BEFORE INSERT ON public.public_egg_sale_bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_egg_sale_booking();

CREATE OR REPLACE FUNCTION public.finalize_egg_sale_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_listing_title text;
BEGIN
  SELECT token INTO v_token
  FROM public.egg_sale_booking_tokens
  WHERE booking_id = NEW.id
  LIMIT 1;

  IF v_token IS NULL THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.egg_sale_booking_tokens (booking_id, token, token_hash, expires_at)
    VALUES (NEW.id, v_token, public.egg_sale_hash_token(v_token), now() + interval '3 years')
    ON CONFLICT (booking_id) DO UPDATE SET
      token = EXCLUDED.token,
      token_hash = EXCLUDED.token_hash,
      expires_at = EXCLUDED.expires_at,
      revoked_at = NULL;
  END IF;

  SELECT title INTO v_listing_title
  FROM public.public_egg_sale_listings
  WHERE id = NEW.listing_id;

  INSERT INTO public.egg_sale_booking_events (
    booking_id, listing_id, seller_user_id, event_type, new_status, metadata
  ) VALUES (
    NEW.id,
    NEW.listing_id,
    NEW.seller_user_id,
    'booking_created',
    NEW.status,
    jsonb_build_object(
      'packs', NEW.packs,
      'eggs_per_pack', NEW.eggs_per_pack_snapshot,
      'source', NEW.source
    )
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.notification_outbox (
    seller_user_id,
    booking_id,
    listing_id,
    recipient_email,
    recipient_phone,
    notification_type,
    subject,
    message,
    dedupe_key,
    payload
  ) VALUES (
    NEW.seller_user_id,
    NEW.id,
    NEW.listing_id,
    NEW.customer_email,
    NEW.customer_phone,
    'booking_confirmation',
    'Din bokning hos ' || COALESCE(v_listing_title, 'Agdas bod'),
    'Din bokning ' || NEW.booking_reference || ' är mottagen. Öppna din personliga beställningslänk för betalning och upphämtning.',
    'booking-confirmation:' || NEW.id::text,
    jsonb_build_object(
      'booking_reference', NEW.booking_reference,
      'order_path', '/bestallning/' || v_token
    )
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  PERFORM public.egg_sale_sync_listing_stock(NEW.listing_id);
  IF NEW.pickup_slot_id IS NOT NULL THEN
    PERFORM public.egg_sale_sync_slot_count(NEW.pickup_slot_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_finalize_egg_sale_booking ON public.public_egg_sale_bookings;
CREATE TRIGGER zz_finalize_egg_sale_booking
AFTER INSERT ON public.public_egg_sale_bookings
FOR EACH ROW EXECUTE FUNCTION public.finalize_egg_sale_booking();

CREATE OR REPLACE FUNCTION public.sync_egg_sale_booking_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.egg_sale_sync_listing_stock(COALESCE(NEW.listing_id, OLD.listing_id));
  IF OLD.pickup_slot_id IS NOT NULL THEN
    PERFORM public.egg_sale_sync_slot_count(OLD.pickup_slot_id);
  END IF;
  IF NEW.pickup_slot_id IS NOT NULL AND NEW.pickup_slot_id IS DISTINCT FROM OLD.pickup_slot_id THEN
    PERFORM public.egg_sale_sync_slot_count(NEW.pickup_slot_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_sync_egg_sale_booking_change ON public.public_egg_sale_bookings;
CREATE TRIGGER zz_sync_egg_sale_booking_change
AFTER UPDATE OF status, pickup_slot_id, packs ON public.public_egg_sale_bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_egg_sale_booking_after_change();
