
-- Fix 1: Prevent users from self-elevating subscription status
-- Revoke UPDATE on sensitive subscription columns from authenticated role
REVOKE UPDATE (subscription_status, premium_expires_at) ON public.profiles FROM authenticated;
REVOKE UPDATE (subscription_status, premium_expires_at) ON public.profiles FROM anon;
