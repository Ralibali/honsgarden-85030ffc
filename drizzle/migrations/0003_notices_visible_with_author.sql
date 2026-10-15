DROP POLICY IF EXISTS "Signed-in users read admin notices" ON public.notifications;
CREATE POLICY "Signed-in users read published notices" ON public.notifications
  FOR SELECT TO authenticated
  USING (author_id IS NOT NULL AND created_at <= now());