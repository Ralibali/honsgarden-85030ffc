-- 1. Extra kolumner på digital_orders
ALTER TABLE public.digital_orders
  ADD COLUMN IF NOT EXISTS declared_country text,
  ADD COLUMN IF NOT EXISTS verified_country text,
  ADD COLUMN IF NOT EXISTS livemode boolean,
  ADD COLUMN IF NOT EXISTS review_reason text;

-- 2. Nedladdningslogg
CREATE TABLE IF NOT EXISTS public.digital_download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.digital_orders(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.digital_access_tokens(id) ON DELETE SET NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_download_events_order_idx
  ON public.digital_download_events (order_id, created_at DESC);

GRANT SELECT ON public.digital_download_events TO authenticated;
GRANT ALL ON public.digital_download_events TO service_role;
ALTER TABLE public.digital_download_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS digital_download_events_admin_read ON public.digital_download_events;
CREATE POLICY digital_download_events_admin_read
  ON public.digital_download_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Hastighetsspärr för publika digitala endpoints
CREATE TABLE IF NOT EXISTS public.digital_rate_limits (
  scope text NOT NULL,
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, key_hash, window_start)
);
GRANT ALL ON public.digital_rate_limits TO service_role;
ALTER TABLE public.digital_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.digital_rate_limit(
  p_scope text,
  p_key_hash text,
  p_max integer,
  p_window_minutes integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window timestamptz;
  v_count integer;
BEGIN
  IF p_scope IS NULL OR p_key_hash IS NULL THEN
    RETURN false;
  END IF;
  v_window := to_timestamp(
    floor(extract(epoch from now()) / (greatest(p_window_minutes, 1) * 60))
      * (greatest(p_window_minutes, 1) * 60)
  );

  DELETE FROM public.digital_rate_limits WHERE window_start < now() - interval '2 days';

  INSERT INTO public.digital_rate_limits (scope, key_hash, window_start, request_count)
  VALUES (p_scope, p_key_hash, v_window, 1)
  ON CONFLICT (scope, key_hash, window_start)
  DO UPDATE SET request_count = public.digital_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= greatest(p_max, 1);
END;
$$;
REVOKE ALL ON FUNCTION public.digital_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.digital_rate_limit(text, text, integer, integer) TO service_role;

-- 4. Atomär nedladdningsregistrering (spärr per timme + logg + räknare)
CREATE OR REPLACE FUNCTION public.digital_register_download(
  p_token_hash text,
  p_ip_hash text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_max_per_hour integer DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token public.digital_access_tokens;
  v_order public.digital_orders;
  v_recent integer;
BEGIN
  SELECT * INTO v_token FROM public.digital_access_tokens WHERE token_hash = p_token_hash;
  IF NOT FOUND OR v_token.revoked THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  SELECT * INTO v_order FROM public.digital_orders WHERE id = v_token.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status <> 'paid' OR v_order.refunded_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_available');
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.digital_download_events
  WHERE order_id = v_order.id AND created_at > now() - interval '1 hour';

  IF v_recent >= greatest(p_max_per_hour, 1) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  INSERT INTO public.digital_download_events (order_id, token_id, ip_hash, user_agent)
  VALUES (v_order.id, v_token.id, p_ip_hash, left(coalesce(p_user_agent, ''), 300));

  UPDATE public.digital_orders
    SET download_count = coalesce(download_count, 0) + 1,
        last_downloaded_at = now()
    WHERE id = v_order.id;

  UPDATE public.digital_access_tokens SET last_used_at = now() WHERE id = v_token.id;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'product_slug', v_order.product_slug,
    'downloads_this_hour', v_recent + 1
  );
END;
$$;
REVOKE ALL ON FUNCTION public.digital_register_download(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.digital_register_download(text, text, text, integer) TO service_role;

-- 5. Atomär kvittoutgivning: länk + köad e-post + flagga i en transaktion
CREATE OR REPLACE FUNCTION public.digital_issue_receipt(
  p_order_id uuid,
  p_token_hash text,
  p_message_id text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.digital_orders;
  v_msg bigint;
BEGIN
  SELECT * INTO v_order FROM public.digital_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status <> 'paid' OR v_order.refunded_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_payable');
  END IF;
  IF v_order.receipt_sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_sent', true);
  END IF;
  IF v_order.customer_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_email');
  END IF;

  INSERT INTO public.digital_access_tokens (order_id, token_hash, source)
  VALUES (p_order_id, p_token_hash, 'email');

  v_msg := public.enqueue_email('transactional_emails', p_payload);
  IF v_msg IS NULL THEN
    RAISE EXCEPTION 'enqueue_email returned null for order %', p_order_id;
  END IF;

  UPDATE public.digital_orders
    SET receipt_sent_at = now(),
        receipt_message_id = p_message_id
    WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_sent', false, 'queue_message_id', v_msg);
END;
$$;
REVOKE ALL ON FUNCTION public.digital_issue_receipt(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.digital_issue_receipt(uuid, text, text, jsonb) TO service_role;

-- 6. Striktare avstämning av betalning
CREATE OR REPLACE FUNCTION public.digital_finalize_paid_order(
  p_order_id uuid,
  p_amount_total_ore integer,
  p_customer_email text,
  p_payment_intent_id text,
  p_currency text DEFAULT NULL,
  p_verified_country text DEFAULT NULL,
  p_livemode boolean DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.digital_orders;
BEGIN
  SELECT * INTO v_order FROM public.digital_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_order.refunded_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'refunded');
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'order_number', v_order.order_number);
  END IF;

  IF v_order.consent_immediate_delivery IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_consent');
  END IF;

  IF p_amount_total_ore IS DISTINCT FROM v_order.amount_ore THEN
    UPDATE public.digital_orders
      SET status = 'review',
          review_reason = 'amount_mismatch',
          admin_note = 'KRITISKT: belopp matchar inte. Stripe=' || coalesce(p_amount_total_ore, -1)
            || ' öre, förväntat ' || v_order.amount_ore || ' öre.'
      WHERE id = p_order_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  END IF;

  IF p_currency IS NOT NULL AND lower(p_currency) <> lower(v_order.currency) THEN
    UPDATE public.digital_orders
      SET status = 'review',
          review_reason = 'currency_mismatch',
          admin_note = 'KRITISKT: valuta matchar inte. Stripe=' || p_currency
            || ', förväntat ' || v_order.currency || '.'
      WHERE id = p_order_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'currency_mismatch');
  END IF;

  IF p_verified_country IS NOT NULL AND upper(p_verified_country) <> 'SE' THEN
    UPDATE public.digital_orders
      SET status = 'review',
          review_reason = 'country_not_supported',
          verified_country = upper(p_verified_country),
          customer_email = coalesce(p_customer_email, customer_email),
          payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
          livemode = coalesce(p_livemode, livemode),
          admin_note = 'Faktureringsland ' || upper(p_verified_country)
            || ' utanför Sverige: momsen måste hanteras manuellt. Leverans stoppad, återbetala eller hantera manuellt.'
      WHERE id = p_order_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'country_not_supported');
  END IF;

  UPDATE public.digital_orders
    SET status = 'paid',
        fulfillment_status = 'fulfilled',
        paid_at = coalesce(paid_at, now()),
        customer_email = coalesce(p_customer_email, customer_email),
        payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
        verified_country = coalesce(upper(p_verified_country), verified_country),
        livemode = coalesce(p_livemode, livemode)
    WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_paid', false, 'order_number', v_order.order_number);
END;
$$;
REVOKE ALL ON FUNCTION public.digital_finalize_paid_order(uuid, integer, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.digital_finalize_paid_order(uuid, integer, text, text, text, text, boolean) TO service_role;

-- 7. Livstidstaket ersätts av spärr per timme
ALTER TABLE public.digital_orders ALTER COLUMN max_downloads DROP NOT NULL;
UPDATE public.digital_orders SET max_downloads = NULL WHERE max_downloads IS NOT NULL;