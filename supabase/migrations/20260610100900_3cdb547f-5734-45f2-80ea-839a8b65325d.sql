
-- Remove sensitive tables from Realtime publication to prevent broadcast of customer PII and error logs
ALTER PUBLICATION supabase_realtime DROP TABLE public.public_egg_sale_bookings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.client_error_logs;

-- Tighten egg_sale_subscriptions INSERT policy: require listing exists, is active, and seller matches
DROP POLICY IF EXISTS "Anyone can create subscription" ON public.egg_sale_subscriptions;

CREATE POLICY "Anyone can create valid subscription"
ON public.egg_sale_subscriptions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.public_egg_sale_listings l
    WHERE l.id = listing_id
      AND l.user_id = seller_user_id
      AND l.is_active = true
  )
);
