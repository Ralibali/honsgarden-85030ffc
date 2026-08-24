-- 1. affiliate_advertisers: drop the "OR true" public read policy.
-- The public view affiliate_advertisers_public is the supported public read path.
DROP POLICY IF EXISTS "Public can read non-sensitive advertiser fields" ON public.affiliate_advertisers;

-- Ensure the public view remains accessible to anon/authenticated.
GRANT SELECT ON public.affiliate_advertisers_public TO anon, authenticated;

-- 2. system_settings: remove the open public read policy.
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;

-- Admins keep full access via the existing "Admins can manage system settings" policy.
-- Edge functions using service_role keep access automatically (bypasses RLS).