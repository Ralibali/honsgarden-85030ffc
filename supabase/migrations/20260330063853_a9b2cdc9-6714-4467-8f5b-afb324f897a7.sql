
-- Fix 2: Farm invitation INSERT - require farm ownership
DROP POLICY IF EXISTS "Farm owners can insert invitations" ON farm_invitations;

CREATE POLICY "Farm owners can insert invitations"
ON farm_invitations FOR INSERT
TO public
WITH CHECK (
  invited_by = auth.uid()
  AND farm_id IN (SELECT farm_id FROM farm_members WHERE user_id = auth.uid() AND role = 'owner')
);

-- Fix 3: Achievement rewards - restrict INSERT to service role only, keep SELECT for users
DROP POLICY IF EXISTS "Users manage own achievement rewards" ON achievement_rewards;

CREATE POLICY "Users can view own achievements"
ON achievement_rewards FOR SELECT TO public
USING (auth.uid() = user_id);

-- Fix 4: email-assets storage bucket - add restrictive policies
CREATE POLICY "Service role can manage email assets"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'email-assets' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'email-assets' AND auth.role() = 'service_role');

-- Fix 5: blog-images - add missing UPDATE policy for admins
CREATE POLICY "Admins can update blog images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'));

-- Fix 6: Add size constraints on analytics tables
ALTER TABLE click_events ADD CONSTRAINT click_events_metadata_size CHECK (octet_length(metadata::text) < 4096);
ALTER TABLE click_events ADD CONSTRAINT click_events_event_name_length CHECK (length(event_name) < 200);
ALTER TABLE page_views ADD CONSTRAINT page_views_path_length CHECK (length(path) < 500);
ALTER TABLE page_views ADD CONSTRAINT page_views_user_agent_length CHECK (length(user_agent) < 1000);
