-- Only unrelated services are stubbed; premium, referral, signup and RLS use real SQL.
CREATE FUNCTION public.check_rate_limit(_user_id uuid, _function_name text, _max_requests integer, _window_minutes integer) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.count_user_backups_today(_uid uuid) RETURNS integer LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.count_user_reports_today(_uid uuid) RETURNS integer LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.deactivate_expired_simple_listings() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.delete_email(queue_name text, message_id bigint) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.enqueue_email(queue_name text, payload jsonb) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.expire_marketplace_listings() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb) LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
CREATE FUNCTION public.shop_finalize_paid_order(p_order_id uuid, p_amount_total_ore integer, p_discount_ore integer, p_customer_email text, p_customer_name text, p_customer_phone text, p_shipping_address jsonb, p_payment_intent_id text) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test stub: not invoked'; END; $$;
