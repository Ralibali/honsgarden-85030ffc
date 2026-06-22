-- Agdas bod v2: säker orderportal, transaktioner, händelser, notifieringar,
-- väntelista och abonnemang. Migrationen är idempotent och bevarar gamla bokningar.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Bokningar och tokens
-- ---------------------------------------------------------------------------
ALTER TABLE public.public_egg_sale_bookings
  ADD COLUMN IF NOT EXISTS booking_reference text,
  ADD COLUMN IF NOT EXISTS eggs_per_pack_snapshot integer,
  ADD COLUMN IF NOT EXISTS price_per_pack_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS packed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'public_listing';

CREATE UNIQUE INDEX IF NOT EXISTS public_egg_sale_bookings_reference_uidx
  ON public.public_egg_sale_bookings (booking_reference)
  WHERE booking_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS public_egg_sale_bookings_listing_status_idx
  ON public.public_egg_sale_bookings (listing_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS public_egg_sale_bookings_seller_status_idx
  ON public.public_egg_sale_bookings (seller_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS public_egg_sale_bookings_pickup_idx
  ON public.public_egg_sale_bookings (pickup_slot_id, status);
CREATE INDEX IF NOT EXISTS public_egg_sale_bookings_customer_email_idx
  ON public.public_egg_sale_bookings (seller_user_id, lower(customer_email))
  WHERE customer_email IS NOT NULL;

ALTER TABLE public.egg_sale_booking_tokens
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS egg_sale_booking_tokens_hash_uidx
  ON public.egg_sale_booking_tokens (token_hash)
  WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS egg_sale_booking_tokens_booking_idx
  ON public.egg_sale_booking_tokens (booking_id);

UPDATE public.egg_sale_booking_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

UPDATE public.public_egg_sale_bookings b
SET
  booking_reference = COALESCE(
    b.booking_reference,
    'AGD-' || upper(substr(replace(b.id::text, '-', ''), 1, 10))
  ),
  eggs_per_pack_snapshot = COALESCE(b.eggs_per_pack_snapshot, l.eggs_per_pack, 12),
  price_per_pack_snapshot = COALESCE(b.price_per_pack_snapshot, l.price_per_pack, 0),
  total_amount = COALESCE(
    b.total_amount,
    b.packs * COALESCE(b.price_per_pack_snapshot, l.price_per_pack, 0)
  ),
  paid_at = CASE WHEN b.payment_status = 'paid' THEN COALESCE(b.paid_at, b.updated_at) ELSE b.paid_at END,
  picked_up_at = CASE WHEN b.status = 'picked_up' THEN COALESCE(b.picked_up_at, b.updated_at) ELSE b.picked_up_at END,
  cancelled_at = CASE WHEN b.status = 'cancelled' THEN COALESCE(b.cancelled_at, b.updated_at) ELSE b.cancelled_at END
FROM public.public_egg_sale_listings l
WHERE l.id = b.listing_id;

-- Skapa hanteringstoken för gamla bokningar som saknar token. De är åtkomliga för
-- säljaren via säker RPC och exponeras aldrig via publik tabell-select.
INSERT INTO public.egg_sale_booking_tokens (booking_id, token, token_hash, expires_at)
SELECT
  b.id,
  encode(gen_random_bytes(24), 'hex'),
  NULL,
  now() + interval '3 years'
FROM public.public_egg_sale_bookings b
LEFT JOIN public.egg_sale_booking_tokens t ON t.booking_id = b.id
WHERE t.booking_id IS NULL
ON CONFLICT (booking_id) DO NOTHING;

UPDATE public.egg_sale_booking_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Händelselogg och notifieringskö
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.egg_sale_booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.public_egg_sale_bookings(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.public_egg_sale_listings(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS egg_sale_booking_events_booking_idx
  ON public.egg_sale_booking_events (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS egg_sale_booking_events_seller_idx
  ON public.egg_sale_booking_events (seller_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid,
  booking_id uuid REFERENCES public.public_egg_sale_bookings(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.public_egg_sale_listings(id) ON DELETE CASCADE,
  recipient_email text,
  recipient_phone text,
  channel text NOT NULL DEFAULT 'email',
  notification_type text NOT NULL,
  subject text,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_outbox_dedupe_uidx
  ON public.notification_outbox (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON public.notification_outbox (status, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_outbox_seller_idx
  ON public.notification_outbox (seller_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Väntelista
-- ---------------------------------------------------------------------------
ALTER TABLE public.egg_sale_waitlist
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS eggs_per_pack integer,
  ADD COLUMN IF NOT EXISTS offered_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS egg_sale_waitlist_queue_idx
  ON public.egg_sale_waitlist (listing_id, status, created_at);

CREATE TABLE IF NOT EXISTS public.egg_sale_waitlist_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id uuid NOT NULL REFERENCES public.egg_sale_waitlist(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.public_egg_sale_listings(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL,
  packs integer NOT NULL CHECK (packs > 0),
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  token_hash text,
  status text NOT NULL DEFAULT 'offered',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '45 minutes'),
  accepted_at timestamptz,
  booking_id uuid REFERENCES public.public_egg_sale_bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE public.egg_sale_waitlist_offers
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS egg_sale_waitlist_offers_token_hash_uidx
  ON public.egg_sale_waitlist_offers (token_hash)
  WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS egg_sale_waitlist_offers_expiry_idx
  ON public.egg_sale_waitlist_offers (status, expires_at);

-- ---------------------------------------------------------------------------
-- Abonnemang
-- ---------------------------------------------------------------------------
ALTER TABLE public.egg_sale_subscriptions
  ADD COLUMN IF NOT EXISTS manage_token text,
  ADD COLUMN IF NOT EXISTS manage_token_hash text,
  ADD COLUMN IF NOT EXISTS pause_until date,
  ADD COLUMN IF NOT EXISTS preferred_weekday integer,
  ADD COLUMN IF NOT EXISTS preferred_pickup_slot_id uuid REFERENCES public.egg_sale_pickup_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skipped_next boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS eggs_per_pack integer,
  ADD COLUMN IF NOT EXISTS generated_through date;

UPDATE public.egg_sale_subscriptions
SET manage_token = encode(gen_random_bytes(24), 'hex')
WHERE manage_token IS NULL;
UPDATE public.egg_sale_subscriptions
SET manage_token_hash = encode(digest(manage_token, 'sha256'), 'hex')
WHERE manage_token_hash IS NULL AND manage_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS egg_sale_subscriptions_token_hash_uidx
  ON public.egg_sale_subscriptions (manage_token_hash)
  WHERE manage_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS egg_sale_subscriptions_due_idx
  ON public.egg_sale_subscriptions (status, next_run_at)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Hjälpfunktioner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.egg_sale_hash_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT encode(digest(p_token, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.egg_sale_active_packs(p_listing_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(packs), 0)::integer
  FROM public.public_egg_sale_bookings
  WHERE listing_id = p_listing_id
    AND status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready', 'picked_up');
$$;

CREATE OR REPLACE FUNCTION public.egg_sale_sync_listing_stock(p_listing_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved integer;
BEGIN
  v_reserved := public.egg_sale_active_packs(p_listing_id);
  UPDATE public.public_egg_sale_listings
  SET reserved_packs = v_reserved, updated_at = now()
  WHERE id = p_listing_id;
  RETURN v_reserved;
END;
$$;

CREATE OR REPLACE FUNCTION public.egg_sale_sync_slot_count(p_slot_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_slot_id IS NULL THEN RETURN 0; END IF;
  SELECT count(*)::integer INTO v_count
  FROM public.public_egg_sale_bookings
  WHERE pickup_slot_id = p_slot_id
    AND status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready', 'picked_up');
  UPDATE public.egg_sale_pickup_slots
  SET current_bookings = v_count, updated_at = now()
  WHERE id = p_slot_id;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.egg_sale_price_for_pack(
  p_listing public.public_egg_sale_listings,
  p_eggs_per_pack integer
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_eggs_per_pack = 6 AND p_listing.p6_price IS NOT NULL THEN p_listing.p6_price
    WHEN p_eggs_per_pack = 12 AND p_listing.p12_price IS NOT NULL THEN p_listing.p12_price
    WHEN p_eggs_per_pack = 30 AND p_listing.p30_price IS NOT NULL THEN p_listing.p30_price
    ELSE p_listing.price_per_pack
  END::numeric;
$$;

-- ---------------------------------------------------------------------------
-- Skapa bokning atomiskt och returnera kundens råa hanteringstoken en gång.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_public_egg_sale_booking(
  p_listing_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_packs integer DEFAULT 1,
  p_eggs_per_pack integer DEFAULT NULL,
  p_pickup_slot_id uuid DEFAULT NULL,
  p_customer_message text DEFAULT NULL,
  p_pickup_person_name text DEFAULT NULL,
  p_pickup_person_phone text DEFAULT NULL,
  p_marketing_consent boolean DEFAULT false,
  p_source text DEFAULT 'public_listing'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.public_egg_sale_listings%ROWTYPE;
  v_slot public.egg_sale_pickup_slots%ROWTYPE;
  v_booking public.public_egg_sale_bookings%ROWTYPE;
  v_token text;
  v_reference text;
  v_reserved integer;
  v_slot_count integer;
  v_pack_size integer;
  v_price numeric;
BEGIN
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Skriv ditt namn.';
  END IF;
  IF p_customer_email IS NULL OR position('@' IN p_customer_email) < 2 THEN
    RAISE EXCEPTION 'Skriv en giltig e-postadress.';
  END IF;
  IF p_customer_phone IS NULL OR length(regexp_replace(p_customer_phone, '\D', '', 'g')) < 6 THEN
    RAISE EXCEPTION 'Skriv ett giltigt telefonnummer.';
  END IF;
  IF COALESCE(p_packs, 0) < 1 OR p_packs > 100 THEN
    RAISE EXCEPTION 'Ogiltigt antal förpackningar.';
  END IF;

  SELECT * INTO v_listing
  FROM public.public_egg_sale_listings
  WHERE id = p_listing_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND OR v_listing.sold_out_manually THEN
    RAISE EXCEPTION 'Säljsidan är inte tillgänglig just nu.';
  END IF;

  v_pack_size := COALESCE(p_eggs_per_pack, v_listing.eggs_per_pack, 12);
  IF v_pack_size NOT IN (6, 12, 30) THEN
    v_pack_size := COALESCE(v_listing.eggs_per_pack, 12);
  END IF;
  v_price := public.egg_sale_price_for_pack(v_listing, v_pack_size);
  v_reserved := public.egg_sale_active_packs(v_listing.id);
  IF v_reserved + p_packs > GREATEST(COALESCE(v_listing.packs_available, 0), COALESCE(v_listing.stock_packs, 0)) THEN
    RAISE EXCEPTION 'Det finns inte tillräckligt många förpackningar kvar.';
  END IF;

  IF p_pickup_slot_id IS NOT NULL THEN
    SELECT * INTO v_slot
    FROM public.egg_sale_pickup_slots
    WHERE id = p_pickup_slot_id
      AND listing_id = v_listing.id
      AND is_active = true
      AND starts_at > now()
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Den valda upphämtningstiden är inte längre tillgänglig.'; END IF;
    SELECT count(*)::integer INTO v_slot_count
    FROM public.public_egg_sale_bookings
    WHERE pickup_slot_id = v_slot.id
      AND status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready', 'picked_up');
    IF v_slot_count >= v_slot.max_bookings THEN RAISE EXCEPTION 'Den valda upphämtningstiden är fullbokad.'; END IF;
  END IF;

  v_reference := 'AGD-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.public_egg_sale_bookings (
    listing_id, seller_user_id, customer_name, customer_email, customer_phone,
    customer_message, packs, status, payment_status, pickup_slot_id,
    pickup_person_name, pickup_person_phone, booking_reference,
    eggs_per_pack_snapshot, price_per_pack_snapshot, total_amount,
    marketing_consent, source
  ) VALUES (
    v_listing.id, v_listing.user_id, trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone),
    nullif(trim(p_customer_message), ''), p_packs, 'reserved', 'unpaid', p_pickup_slot_id,
    nullif(trim(p_pickup_person_name), ''), nullif(trim(p_pickup_person_phone), ''), v_reference,
    v_pack_size, v_price, p_packs * v_price,
    COALESCE(p_marketing_consent, false), COALESCE(nullif(p_source, ''), 'public_listing')
  ) RETURNING * INTO v_booking;

  INSERT INTO public.egg_sale_booking_tokens (booking_id, token, token_hash, expires_at)
  VALUES (v_booking.id, v_token, public.egg_sale_hash_token(v_token), now() + interval '3 years')
  ON CONFLICT (booking_id) DO UPDATE SET
    token = EXCLUDED.token,
    token_hash = EXCLUDED.token_hash,
    expires_at = EXCLUDED.expires_at,
    revoked_at = NULL;

  INSERT INTO public.egg_sale_booking_events (
    booking_id, listing_id, seller_user_id, event_type, new_status, metadata
  ) VALUES (
    v_booking.id, v_listing.id, v_listing.user_id, 'booking_created', 'reserved',
    jsonb_build_object('packs', p_packs, 'eggs_per_pack', v_pack_size, 'source', p_source)
  );

  INSERT INTO public.notification_outbox (
    seller_user_id, booking_id, listing_id, recipient_email, recipient_phone,
    notification_type, subject, message, dedupe_key, payload
  ) VALUES (
    v_listing.user_id, v_booking.id, v_listing.id, v_booking.customer_email, v_booking.customer_phone,
    'booking_confirmation', 'Din bokning hos ' || COALESCE(v_listing.title, 'Agdas bod'),
    'Din bokning ' || v_reference || ' är mottagen. Hantera den via din personliga beställningslänk.',
    'booking-confirmation:' || v_booking.id::text,
    jsonb_build_object('token', v_token, 'booking_reference', v_reference)
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  PERFORM public.egg_sale_sync_listing_stock(v_listing.id);
  IF p_pickup_slot_id IS NOT NULL THEN PERFORM public.egg_sale_sync_slot_count(p_pickup_slot_id); END IF;

  RETURN json_build_object(
    'booking_id', v_booking.id,
    'booking_reference', v_reference,
    'token', v_token,
    'order_path', '/bestallning/' || v_token,
    'total_amount', v_booking.total_amount
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Säker orderportal: endast nödvändiga fält.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_booking_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_hash text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN NULL; END IF;
  v_hash := public.egg_sale_hash_token(p_token);

  SELECT json_build_object(
    'booking_id', b.id,
    'booking_reference', b.booking_reference,
    'created_at', b.created_at,
    'updated_at', b.updated_at,
    'customer_name', b.customer_name,
    'customer_email', b.customer_email,
    'customer_phone', b.customer_phone,
    'customer_message', b.customer_message,
    'pickup_person_name', b.pickup_person_name,
    'pickup_person_phone', b.pickup_person_phone,
    'packs', b.packs,
    'eggs_per_pack', COALESCE(b.eggs_per_pack_snapshot, l.eggs_per_pack),
    'total_eggs', b.packs * COALESCE(b.eggs_per_pack_snapshot, l.eggs_per_pack),
    'price_per_pack', COALESCE(b.price_per_pack_snapshot, l.price_per_pack),
    'total_amount', COALESCE(b.total_amount, b.packs * l.price_per_pack),
    'status', b.status,
    'payment_status', b.payment_status,
    'payment_method', b.payment_method,
    'confirmed_at', b.confirmed_at,
    'paid_at', b.paid_at,
    'packed_at', b.packed_at,
    'ready_at', b.ready_at,
    'picked_up_at', b.picked_up_at,
    'cancelled_at', b.cancelled_at,
    'listing_id', l.id,
    'listing_slug', l.slug,
    'listing_title', l.title,
    'seller_name', COALESCE(p.display_name, l.swish_name, 'Lokal äggsäljare'),
    'location', l.location,
    'pickup_info', l.pickup_info,
    'contact_info', l.contact_info,
    'contact_phone', l.contact_phone,
    'swish_number', l.swish_number,
    'swish_name', l.swish_name,
    'swish_message', COALESCE(l.swish_message, b.booking_reference, 'Ägg'),
    'latitude', l.latitude,
    'longitude', l.longitude,
    'pickup_slot', CASE WHEN s.id IS NULL THEN NULL ELSE json_build_object(
      'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'label', s.label
    ) END,
    'can_cancel', b.status IN ('reserved', 'confirmed', 'paid') AND b.cancelled_at IS NULL,
    'can_reschedule', b.status IN ('reserved', 'confirmed', 'paid') AND b.cancelled_at IS NULL,
    'can_review', b.status = 'picked_up' AND NOT EXISTS (
      SELECT 1 FROM public.egg_sale_reviews r WHERE r.booking_id = b.id
    )
  ) INTO v_result
  FROM public.egg_sale_booking_tokens t
  JOIN public.public_egg_sale_bookings b ON b.id = t.booking_id
  JOIN public.public_egg_sale_listings l ON l.id = b.listing_id
  LEFT JOIN public.egg_sale_pickup_slots s ON s.id = b.pickup_slot_id
  LEFT JOIN public.profiles p ON p.user_id = b.seller_user_id
  WHERE (t.token_hash = v_hash OR t.token = p_token)
    AND t.revoked_at IS NULL
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;

  UPDATE public.egg_sale_booking_tokens
  SET last_used_at = now()
  WHERE (token_hash = v_hash OR token = p_token)
    AND revoked_at IS NULL;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_booking_pickup_slots_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_current_slot uuid;
BEGIN
  SELECT b.listing_id, b.pickup_slot_id INTO v_listing_id, v_current_slot
  FROM public.egg_sale_booking_tokens t
  JOIN public.public_egg_sale_bookings b ON b.id = t.booking_id
  WHERE (t.token_hash = public.egg_sale_hash_token(p_token) OR t.token = p_token)
    AND t.revoked_at IS NULL
    AND b.status IN ('reserved', 'confirmed', 'paid')
  LIMIT 1;

  IF v_listing_id IS NULL THEN RETURN '[]'::json; END IF;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', s.id,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'label', s.label,
      'available_places', GREATEST(0, s.max_bookings - (
        SELECT count(*) FROM public.public_egg_sale_bookings x
        WHERE x.pickup_slot_id = s.id
          AND x.id IS DISTINCT FROM (SELECT booking_id FROM public.egg_sale_booking_tokens WHERE token_hash = public.egg_sale_hash_token(p_token) OR token = p_token LIMIT 1)
          AND x.status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready', 'picked_up')
      )),
      'is_current', s.id = v_current_slot
    ) ORDER BY s.starts_at)
    FROM public.egg_sale_pickup_slots s
    WHERE s.listing_id = v_listing_id
      AND s.is_active = true
      AND s.starts_at > now()
      AND (s.id = v_current_slot OR (
        SELECT count(*) FROM public.public_egg_sale_bookings x
        WHERE x.pickup_slot_id = s.id
          AND x.status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready', 'picked_up')
      ) < s.max_bookings)
  ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.public_egg_sale_bookings%ROWTYPE;
  v_listing public.public_egg_sale_listings%ROWTYPE;
BEGIN
  SELECT b.* INTO v_booking
  FROM public.egg_sale_booking_tokens t
  JOIN public.public_egg_sale_bookings b ON b.id = t.booking_id
  WHERE (t.token_hash = public.egg_sale_hash_token(p_token) OR t.token = p_token)
    AND t.revoked_at IS NULL
  FOR UPDATE OF b
  LIMIT 1;

  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Bokningen hittades inte.'); END IF;
  IF v_booking.status = 'cancelled' THEN
    RETURN json_build_object('ok', true, 'already_cancelled', true, 'booking_reference', v_booking.booking_reference);
  END IF;
  IF v_booking.status IN ('packed', 'ready', 'picked_up', 'refunded', 'no_show') THEN
    RETURN json_build_object('ok', false, 'error', 'Bokningen kan inte längre avbokas via länken. Kontakta säljaren.');
  END IF;

  SELECT * INTO v_listing FROM public.public_egg_sale_listings WHERE id = v_booking.listing_id FOR UPDATE;

  UPDATE public.public_egg_sale_bookings
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = v_booking.id;

  INSERT INTO public.egg_sale_booking_events (
    booking_id, listing_id, seller_user_id, event_type, old_status, new_status, metadata
  ) VALUES (
    v_booking.id, v_booking.listing_id, v_booking.seller_user_id,
    'booking_cancelled_by_customer', v_booking.status, 'cancelled',
    jsonb_build_object('released_packs', v_booking.packs)
  );

  INSERT INTO public.notification_outbox (
    seller_user_id, booking_id, listing_id, notification_type, subject, message, dedupe_key
  ) VALUES (
    v_booking.seller_user_id, v_booking.id, v_booking.listing_id,
    'booking_cancelled', 'En bokning har avbokats',
    COALESCE(v_booking.customer_name, 'Kunden') || ' har avbokat ' || v_booking.packs || ' förpackning(ar).',
    'booking-cancelled:' || v_booking.id::text
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  PERFORM public.egg_sale_sync_listing_stock(v_booking.listing_id);
  IF v_booking.pickup_slot_id IS NOT NULL THEN PERFORM public.egg_sale_sync_slot_count(v_booking.pickup_slot_id); END IF;
  PERFORM public.offer_next_egg_sale_waitlist(v_booking.listing_id, v_booking.packs);

  RETURN json_build_object('ok', true, 'booking_reference', v_booking.booking_reference, 'released_packs', v_booking.packs);
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_booking_by_token(p_token text, p_pickup_slot_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.public_egg_sale_bookings%ROWTYPE;
  v_new_slot public.egg_sale_pickup_slots%ROWTYPE;
  v_old_slot uuid;
  v_count integer;
BEGIN
  SELECT b.* INTO v_booking
  FROM public.egg_sale_booking_tokens t
  JOIN public.public_egg_sale_bookings b ON b.id = t.booking_id
  WHERE (t.token_hash = public.egg_sale_hash_token(p_token) OR t.token = p_token)
    AND t.revoked_at IS NULL
  FOR UPDATE OF b
  LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Bokningen hittades inte.'); END IF;
  IF v_booking.status NOT IN ('reserved', 'confirmed', 'paid') THEN
    RETURN json_build_object('ok', false, 'error', 'Bokningen kan inte bokas om i nuvarande status.');
  END IF;

  SELECT * INTO v_new_slot
  FROM public.egg_sale_pickup_slots
  WHERE id = p_pickup_slot_id
    AND listing_id = v_booking.listing_id
    AND is_active = true
    AND starts_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Tiden är inte längre tillgänglig.'); END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.public_egg_sale_bookings
  WHERE pickup_slot_id = v_new_slot.id
    AND id <> v_booking.id
    AND status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready', 'picked_up');
  IF v_count >= v_new_slot.max_bookings THEN RETURN json_build_object('ok', false, 'error', 'Tiden är fullbokad.'); END IF;

  v_old_slot := v_booking.pickup_slot_id;
  UPDATE public.public_egg_sale_bookings
  SET pickup_slot_id = v_new_slot.id, updated_at = now()
  WHERE id = v_booking.id;

  INSERT INTO public.egg_sale_booking_events (
    booking_id, listing_id, seller_user_id, event_type, metadata
  ) VALUES (
    v_booking.id, v_booking.listing_id, v_booking.seller_user_id, 'pickup_rescheduled',
    jsonb_build_object('old_slot_id', v_old_slot, 'new_slot_id', v_new_slot.id)
  );

  INSERT INTO public.notification_outbox (
    seller_user_id, booking_id, listing_id, recipient_email, recipient_phone,
    notification_type, subject, message, dedupe_key
  ) VALUES (
    v_booking.seller_user_id, v_booking.id, v_booking.listing_id,
    v_booking.customer_email, v_booking.customer_phone,
    'pickup_rescheduled', 'Upphämtningstiden har ändrats',
    'Ny upphämtningstid: ' || to_char(v_new_slot.starts_at AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI'),
    'pickup-rescheduled:' || v_booking.id::text || ':' || v_new_slot.id::text
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  IF v_old_slot IS NOT NULL THEN PERFORM public.egg_sale_sync_slot_count(v_old_slot); END IF;
  PERFORM public.egg_sale_sync_slot_count(v_new_slot.id);

  RETURN json_build_object(
    'ok', true,
    'pickup_slot', json_build_object('id', v_new_slot.id, 'starts_at', v_new_slot.starts_at, 'ends_at', v_new_slot.ends_at, 'label', v_new_slot.label)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Väntelisteerbjudanden
-- ---------------------------------------------------------------------------
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
    waitlist_id, listing_id, seller_user_id, packs, token_hash
  ) VALUES (
    v_entry.id, v_entry.listing_id, v_entry.seller_user_id, v_entry.packs_wanted, ''
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

CREATE OR REPLACE FUNCTION public.get_waitlist_offer_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result json;
BEGIN
  UPDATE public.egg_sale_waitlist_offers o
  SET status = 'expired', updated_at = now()
  WHERE o.status = 'offered' AND o.expires_at <= now();

  SELECT json_build_object(
    'offer_id', o.id,
    'status', o.status,
    'packs', o.packs,
    'expires_at', o.expires_at,
    'customer_name', w.customer_name,
    'customer_email', w.customer_email,
    'customer_phone', w.customer_phone,
    'listing_title', l.title,
    'listing_slug', l.slug,
    'eggs_per_pack', COALESCE(w.eggs_per_pack, l.eggs_per_pack),
    'price_per_pack', public.egg_sale_price_for_pack(l, COALESCE(w.eggs_per_pack, l.eggs_per_pack)),
    'location', l.location,
    'pickup_info', l.pickup_info
  ) INTO v_result
  FROM public.egg_sale_waitlist_offers o
  JOIN public.egg_sale_waitlist w ON w.id = o.waitlist_id
  JOIN public.public_egg_sale_listings l ON l.id = o.listing_id
  WHERE (o.token_hash = public.egg_sale_hash_token(p_token) OR o.token = p_token)
  LIMIT 1;
  RETURN v_result;
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
BEGIN
  SELECT * INTO v_offer
  FROM public.egg_sale_waitlist_offers
  WHERE (token_hash = public.egg_sale_hash_token(p_token) OR token = p_token)
  FOR UPDATE
  LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Erbjudandet hittades inte.'); END IF;
  IF v_offer.status = 'accepted' THEN
    SELECT json_build_object('ok', true, 'already_accepted', true, 'booking_id', booking_id) INTO v_result
    FROM public.egg_sale_waitlist_offers WHERE id = v_offer.id;
    RETURN v_result;
  END IF;
  IF v_offer.status <> 'offered' OR v_offer.expires_at <= now() THEN
    UPDATE public.egg_sale_waitlist_offers SET status = 'expired', updated_at = now() WHERE id = v_offer.id;
    RETURN json_build_object('ok', false, 'error', 'Erbjudandet har löpt ut.');
  END IF;

  SELECT * INTO v_wait FROM public.egg_sale_waitlist WHERE id = v_offer.waitlist_id FOR UPDATE;
  v_result := public.create_public_egg_sale_booking(
    v_offer.listing_id,
    v_wait.customer_name,
    COALESCE(v_wait.customer_email, 'saknas+' || v_wait.id::text || '@honsgarden.invalid'),
    COALESCE(v_wait.customer_phone, '000000'),
    v_offer.packs,
    v_wait.eggs_per_pack,
    p_pickup_slot_id,
    'Skapad från väntelistan',
    NULL,
    NULL,
    false,
    'waitlist'
  );

  IF COALESCE((v_result->>'booking_id')::uuid, NULL) IS NULL THEN RETURN v_result; END IF;

  UPDATE public.egg_sale_waitlist_offers
  SET status = 'accepted', accepted_at = now(), booking_id = (v_result->>'booking_id')::uuid, updated_at = now()
  WHERE id = v_offer.id;
  UPDATE public.egg_sale_waitlist
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_wait.id;

  RETURN v_result || jsonb_build_object('ok', true, 'offer_id', v_offer.id)::json;
END;
$$;

-- ---------------------------------------------------------------------------
-- Abonnemang via ordertoken
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_subscription_request_by_token(
  p_token text,
  p_frequency text,
  p_packs integer,
  p_preferred_weekday integer DEFAULT NULL,
  p_pickup_slot_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.public_egg_sale_bookings%ROWTYPE;
  v_sub public.egg_sale_subscriptions%ROWTYPE;
  v_manage_token text;
  v_interval_days integer;
BEGIN
  IF p_frequency NOT IN ('weekly', 'biweekly', 'monthly') THEN
    RETURN json_build_object('ok', false, 'error', 'Ogiltig frekvens.');
  END IF;
  IF COALESCE(p_packs, 0) < 1 OR p_packs > 100 THEN
    RETURN json_build_object('ok', false, 'error', 'Ogiltigt antal förpackningar.');
  END IF;

  SELECT b.* INTO v_booking
  FROM public.egg_sale_booking_tokens t
  JOIN public.public_egg_sale_bookings b ON b.id = t.booking_id
  WHERE (t.token_hash = public.egg_sale_hash_token(p_token) OR t.token = p_token)
    AND t.revoked_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Bokningen hittades inte.'); END IF;

  v_interval_days := CASE p_frequency WHEN 'weekly' THEN 7 WHEN 'biweekly' THEN 14 ELSE 28 END;
  v_manage_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.egg_sale_subscriptions (
    listing_id, seller_user_id, customer_name, customer_email, customer_phone,
    packs, frequency, next_run_at, status, manage_token, manage_token_hash,
    preferred_weekday, preferred_pickup_slot_id, eggs_per_pack
  ) VALUES (
    v_booking.listing_id, v_booking.seller_user_id, v_booking.customer_name,
    COALESCE(v_booking.customer_email, ''), v_booking.customer_phone,
    p_packs, p_frequency, now() + make_interval(days => v_interval_days), 'active',
    v_manage_token, public.egg_sale_hash_token(v_manage_token),
    p_preferred_weekday, p_pickup_slot_id, v_booking.eggs_per_pack_snapshot
  ) RETURNING * INTO v_sub;

  INSERT INTO public.notification_outbox (
    seller_user_id, listing_id, recipient_email, recipient_phone,
    notification_type, subject, message, dedupe_key, payload
  ) VALUES (
    v_sub.seller_user_id, v_sub.listing_id, v_sub.customer_email, v_sub.customer_phone,
    'subscription_created', 'Ditt äggabonnemang är skapat',
    'Du kan pausa, ändra eller avsluta abonnemanget via din personliga länk.',
    'subscription-created:' || v_sub.id::text,
    jsonb_build_object('token', v_manage_token, 'manage_path', '/abonnemang/' || v_manage_token)
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN json_build_object(
    'ok', true,
    'subscription_id', v_sub.id,
    'token', v_manage_token,
    'manage_path', '/abonnemang/' || v_manage_token,
    'next_run_at', v_sub.next_run_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_by_token(p_token text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'subscription_id', s.id,
    'status', s.status,
    'customer_name', s.customer_name,
    'customer_email', s.customer_email,
    'customer_phone', s.customer_phone,
    'packs', s.packs,
    'eggs_per_pack', COALESCE(s.eggs_per_pack, l.eggs_per_pack),
    'frequency', s.frequency,
    'next_run_at', s.next_run_at,
    'pause_until', s.pause_until,
    'preferred_weekday', s.preferred_weekday,
    'listing_title', l.title,
    'listing_slug', l.slug,
    'location', l.location
  )
  FROM public.egg_sale_subscriptions s
  JOIN public.public_egg_sale_listings l ON l.id = s.listing_id
  WHERE s.manage_token_hash = public.egg_sale_hash_token(p_token) OR s.manage_token = p_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_subscription_by_token(
  p_token text,
  p_action text,
  p_packs integer DEFAULT NULL,
  p_pause_until date DEFAULT NULL,
  p_pickup_slot_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sub public.egg_sale_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.egg_sale_subscriptions
  WHERE manage_token_hash = public.egg_sale_hash_token(p_token) OR manage_token = p_token
  FOR UPDATE LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'Abonnemanget hittades inte.'); END IF;

  IF p_action = 'pause' THEN
    UPDATE public.egg_sale_subscriptions SET status = 'paused', pause_until = p_pause_until, updated_at = now() WHERE id = v_sub.id;
  ELSIF p_action = 'resume' THEN
    UPDATE public.egg_sale_subscriptions SET status = 'active', pause_until = NULL, skipped_next = false, updated_at = now() WHERE id = v_sub.id;
  ELSIF p_action = 'skip_next' THEN
    UPDATE public.egg_sale_subscriptions SET skipped_next = true, updated_at = now() WHERE id = v_sub.id;
  ELSIF p_action = 'cancel' THEN
    UPDATE public.egg_sale_subscriptions SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = v_sub.id;
  ELSIF p_action = 'update' THEN
    UPDATE public.egg_sale_subscriptions
    SET packs = COALESCE(NULLIF(p_packs, 0), packs),
        preferred_pickup_slot_id = COALESCE(p_pickup_slot_id, preferred_pickup_slot_id),
        updated_at = now()
    WHERE id = v_sub.id;
  ELSE
    RETURN json_build_object('ok', false, 'error', 'Ogiltig åtgärd.');
  END IF;

  RETURN json_build_object('ok', true, 'action', p_action);
END;
$$;

-- ---------------------------------------------------------------------------
-- Säljarens säkra status- och massuppdateringar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_egg_sale_booking_status(
  p_booking_id uuid,
  p_status text DEFAULT NULL,
  p_payment_status text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.public_egg_sale_bookings%ROWTYPE;
  v_old_status text;
  v_old_payment text;
BEGIN
  SELECT * INTO v_booking FROM public.public_egg_sale_bookings
  WHERE id = p_booking_id AND seller_user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bokningen hittades inte.'; END IF;

  v_old_status := v_booking.status;
  v_old_payment := v_booking.payment_status;

  IF p_status IS NOT NULL AND p_status NOT IN ('reserved','confirmed','paid','packed','ready','picked_up','cancelled','no_show','refunded') THEN
    RAISE EXCEPTION 'Ogiltig status.';
  END IF;
  IF p_payment_status IS NOT NULL AND p_payment_status NOT IN ('unpaid','paid','refunded') THEN
    RAISE EXCEPTION 'Ogiltig betalningsstatus.';
  END IF;

  UPDATE public.public_egg_sale_bookings SET
    status = COALESCE(p_status, status),
    payment_status = COALESCE(p_payment_status, payment_status),
    confirmed_at = CASE WHEN p_status = 'confirmed' THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END,
    packed_at = CASE WHEN p_status = 'packed' THEN COALESCE(packed_at, now()) ELSE packed_at END,
    ready_at = CASE WHEN p_status = 'ready' THEN COALESCE(ready_at, now()) ELSE ready_at END,
    picked_up_at = CASE WHEN p_status = 'picked_up' THEN COALESCE(picked_up_at, now()) ELSE picked_up_at END,
    cancelled_at = CASE WHEN p_status = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END,
    no_show_at = CASE WHEN p_status = 'no_show' THEN COALESCE(no_show_at, now()) ELSE no_show_at END,
    refunded_at = CASE WHEN p_status = 'refunded' OR p_payment_status = 'refunded' THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
    paid_at = CASE WHEN p_payment_status = 'paid' OR p_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
    updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  INSERT INTO public.egg_sale_booking_events (
    booking_id, listing_id, seller_user_id, event_type, old_status, new_status, metadata, created_by
  ) VALUES (
    v_booking.id, v_booking.listing_id, v_booking.seller_user_id, 'seller_status_changed',
    v_old_status, v_booking.status,
    jsonb_build_object('old_payment_status', v_old_payment, 'new_payment_status', v_booking.payment_status),
    auth.uid()
  );

  IF p_status IN ('packed', 'ready') THEN
    INSERT INTO public.notification_outbox (
      seller_user_id, booking_id, listing_id, recipient_email, recipient_phone,
      notification_type, subject, message, dedupe_key
    ) VALUES (
      v_booking.seller_user_id, v_booking.id, v_booking.listing_id,
      v_booking.customer_email, v_booking.customer_phone,
      CASE WHEN p_status = 'packed' THEN 'booking_packed' ELSE 'booking_ready' END,
      CASE WHEN p_status = 'packed' THEN 'Dina ägg är packade' ELSE 'Din beställning är klar att hämtas' END,
      CASE WHEN p_status = 'packed' THEN 'Säljaren har packat din beställning.' ELSE 'Din beställning är klar att hämtas.' END,
      p_status || ':' || v_booking.id::text
    ) ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  PERFORM public.egg_sale_sync_listing_stock(v_booking.listing_id);
  IF v_booking.pickup_slot_id IS NOT NULL THEN PERFORM public.egg_sale_sync_slot_count(v_booking.pickup_slot_id); END IF;

  RETURN json_build_object('ok', true, 'status', v_booking.status, 'payment_status', v_booking.payment_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_update_egg_sale_bookings(
  p_booking_ids uuid[],
  p_status text DEFAULT NULL,
  p_payment_status text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; v_count integer := 0;
BEGIN
  FOREACH v_id IN ARRAY p_booking_ids LOOP
    IF EXISTS (SELECT 1 FROM public.public_egg_sale_bookings WHERE id = v_id AND seller_user_id = auth.uid()) THEN
      PERFORM public.update_egg_sale_booking_status(v_id, p_status, p_payment_status);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN json_build_object('ok', true, 'updated', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seller_booking_management_tokens(p_listing_id uuid)
RETURNS TABLE (booking_id uuid, token text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, t.token
  FROM public.public_egg_sale_bookings b
  JOIN public.egg_sale_booking_tokens t ON t.booking_id = b.id
  WHERE b.listing_id = p_listing_id AND b.seller_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.egg_sale_booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_sale_waitlist_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers read own egg booking events" ON public.egg_sale_booking_events;
CREATE POLICY "Sellers read own egg booking events"
ON public.egg_sale_booking_events FOR SELECT TO authenticated
USING (seller_user_id = auth.uid());

DROP POLICY IF EXISTS "Sellers read own notification outbox" ON public.notification_outbox;
CREATE POLICY "Sellers read own notification outbox"
ON public.notification_outbox FOR SELECT TO authenticated
USING (seller_user_id = auth.uid());

DROP POLICY IF EXISTS "Sellers read own waitlist offers" ON public.egg_sale_waitlist_offers;
CREATE POLICY "Sellers read own waitlist offers"
ON public.egg_sale_waitlist_offers FOR SELECT TO authenticated
USING (seller_user_id = auth.uid());

REVOKE ALL ON FUNCTION public.create_public_egg_sale_booking(uuid,text,text,text,integer,integer,uuid,text,text,text,boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_booking_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_booking_pickup_slots_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_booking_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_booking_by_token(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_waitlist_offer_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_waitlist_offer(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_subscription_request_by_token(text,text,integer,integer,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_subscription_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_subscription_by_token(text,text,integer,date,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_egg_sale_booking_status(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_update_egg_sale_bookings(uuid[],text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_seller_booking_management_tokens(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_public_egg_sale_booking(uuid,text,text,text,integer,integer,uuid,text,text,text,boolean,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_booking_pickup_slots_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_by_token(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_waitlist_offer_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_waitlist_offer(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_subscription_request_by_token(text,text,integer,integer,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_subscription_by_token(text,text,integer,date,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_egg_sale_booking_status(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_egg_sale_bookings(uuid[],text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_booking_management_tokens(uuid) TO authenticated;

COMMENT ON FUNCTION public.create_public_egg_sale_booking IS 'Transaktionell publik bokning som validerar lager och tidslucka och returnerar säker hanteringstoken.';
COMMENT ON FUNCTION public.get_booking_by_token IS 'Returnerar endast säkra fält för kundens orderportal.';
COMMENT ON FUNCTION public.cancel_booking_by_token IS 'Idempotent avbokning som återställer lager och tidskapacitet.';
COMMENT ON FUNCTION public.reschedule_booking_by_token IS 'Transaktionell ombokning utan överbokning.';
