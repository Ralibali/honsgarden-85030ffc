CREATE TABLE public.digital_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text NOT NULL DEFAULT ('HG-D-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  product_slug text NOT NULL,
  product_name text NOT NULL,
  customer_email text,
  amount_ore integer NOT NULL,
  currency text NOT NULL DEFAULT 'sek',
  vat_rate numeric NOT NULL DEFAULT 0.06,
  status text NOT NULL DEFAULT 'pending',
  fulfillment_status text NOT NULL DEFAULT 'unfulfilled',
  stripe_session_id text,
  payment_intent_id text,
  consent_immediate_delivery boolean NOT NULL DEFAULT false,
  consent_terms_version text,
  consent_at timestamptz,
  access_token_hash text NOT NULL,
  download_count integer NOT NULL DEFAULT 0,
  max_downloads integer NOT NULL DEFAULT 25,
  last_downloaded_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  receipt_sent_at timestamptz,
  receipt_message_id text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX digital_orders_access_token_hash_key ON public.digital_orders (access_token_hash);
CREATE UNIQUE INDEX digital_orders_order_number_key ON public.digital_orders (order_number);
CREATE INDEX digital_orders_session_idx ON public.digital_orders (stripe_session_id);
CREATE INDEX digital_orders_email_idx ON public.digital_orders (lower(customer_email));

GRANT ALL ON public.digital_orders TO service_role;

ALTER TABLE public.digital_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digital_orders_admin_read" ON public.digital_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER digital_orders_touch_updated_at
  BEFORE UPDATE ON public.digital_orders
  FOR EACH ROW EXECUTE FUNCTION public.shop_touch_updated_at();

CREATE OR REPLACE FUNCTION public.digital_finalize_paid_order(
  p_order_id uuid,
  p_amount_total_ore integer,
  p_customer_email text,
  p_payment_intent_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.digital_orders;
BEGIN
  SELECT * INTO v_order FROM public.digital_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'order_number', v_order.order_number);
  END IF;

  IF p_amount_total_ore IS DISTINCT FROM v_order.amount_ore THEN
    UPDATE public.digital_orders
      SET admin_note = 'KRITISKT: belopp matchar inte. Stripe=' || coalesce(p_amount_total_ore, -1) || ' öre, förväntat ' || v_order.amount_ore || ' öre.'
      WHERE id = p_order_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  END IF;

  IF v_order.consent_immediate_delivery IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_consent');
  END IF;

  UPDATE public.digital_orders
    SET status = 'paid',
        fulfillment_status = 'fulfilled',
        paid_at = coalesce(paid_at, now()),
        customer_email = coalesce(p_customer_email, customer_email),
        payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id)
    WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'already_paid', false, 'order_number', v_order.order_number);
END;
$$;

REVOKE ALL ON FUNCTION public.digital_finalize_paid_order(uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.digital_finalize_paid_order(uuid, integer, text, text) TO service_role;