
-- Hide seller email from anonymous public visitors
REVOKE SELECT (owner_email) ON public.public_egg_sale_listings FROM anon;

-- Set stable search_path on shop trigger functions
ALTER FUNCTION public.shop_orders_set_defaults() SET search_path = public;
ALTER FUNCTION public.shop_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.shop_withdrawal_requests_touch_updated_at() SET search_path = public;
