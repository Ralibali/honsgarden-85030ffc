-- Fix Supabase security review findings
-- - Restrict public system settings reads
-- - Prevent public review token enumeration
-- - Prevent public reads of internal affiliate advertiser notes
-- - Restrict notification inserts to the owner or service role
-- - Keep pitch lead writes service-role only

-- 1. system_settings: remove broad public read policies and allow only authenticated users.
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public read access to system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_select_all" ON public.system_settings;

CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2. egg_sale_review_tokens: remove public token reads to stop token enumeration.
DROP POLICY IF EXISTS "Anyone can read token by value" ON public.egg_sale_review_tokens;
DROP POLICY IF EXISTS "Anyone can read review tokens" ON public.egg_sale_review_tokens;
DROP POLICY IF EXISTS "Public can read review tokens" ON public.egg_sale_review_tokens;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.egg_sale_review_tokens;
DROP POLICY IF EXISTS "egg_sale_review_tokens_select_all" ON public.egg_sale_review_tokens;

DROP POLICY IF EXISTS "Service role can manage review tokens" ON public.egg_sale_review_tokens;
CREATE POLICY "Service role can manage review tokens"
ON public.egg_sale_review_tokens
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3. affiliate_advertisers: remove public reads from base table so internal notes are not exposed.
-- Public UI should read a safe view/RPC that does not include notes, or this policy can be replaced
-- with a column-safe API layer.
DROP POLICY IF EXISTS "Public can read active affiliate advertisers" ON public.affiliate_advertisers;
DROP POLICY IF EXISTS "Anyone can read active affiliate advertisers" ON public.affiliate_advertisers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.affiliate_advertisers;
DROP POLICY IF EXISTS "affiliate_advertisers_select_active_public" ON public.affiliate_advertisers;

CREATE POLICY "Authenticated users can read affiliate advertisers"
ON public.affiliate_advertisers
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 4. user_notifications: users may only insert notifications for themselves. Service role remains allowed.
DROP POLICY IF EXISTS "Users can insert notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Anyone authenticated can insert notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "user_notifications_insert_authenticated" ON public.user_notifications;

CREATE POLICY "Users can insert own notifications"
ON public.user_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'
  OR auth.uid() = user_id
);

-- 5. pitch_leads: make direct client writes impossible; use validated service-role endpoint/function.
DROP POLICY IF EXISTS "Anyone can insert pitch leads" ON public.pitch_leads;
DROP POLICY IF EXISTS "Public can insert pitch leads" ON public.pitch_leads;
DROP POLICY IF EXISTS "Authenticated users can insert pitch leads" ON public.pitch_leads;
DROP POLICY IF EXISTS "pitch_leads_insert_public" ON public.pitch_leads;
DROP POLICY IF EXISTS "Service role can manage pitch leads" ON public.pitch_leads;

CREATE POLICY "Service role can manage pitch leads"
ON public.pitch_leads
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
