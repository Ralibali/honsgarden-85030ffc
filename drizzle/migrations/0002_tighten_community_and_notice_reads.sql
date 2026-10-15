DROP POLICY IF EXISTS "Authenticated users can read notifications" ON public.notifications;
CREATE POLICY "Signed-in users read admin notices" ON public.notifications
  FOR SELECT TO authenticated
  USING (author_id IS NOT NULL AND public.has_role(author_id, 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can view posts" ON public.community_posts;
CREATE POLICY "Members view posts from existing members" ON public.community_posts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = community_posts.user_id));

DROP POLICY IF EXISTS "Authenticated can view comments" ON public.community_comments;
CREATE POLICY "Members view comments on visible posts" ON public.community_comments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.community_posts cp WHERE cp.id = community_comments.post_id));

DROP POLICY IF EXISTS "Authenticated can view reactions" ON public.community_reactions;
CREATE POLICY "Members view reactions on visible content" ON public.community_reactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.community_posts cp WHERE cp.id = community_reactions.post_id)
    OR EXISTS (SELECT 1 FROM public.community_comments cc WHERE cc.id = community_reactions.comment_id));