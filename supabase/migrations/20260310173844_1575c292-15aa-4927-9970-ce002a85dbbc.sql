
-- Admin can read all transactions
CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all feed_records
CREATE POLICY "Admins can view all feed records"
ON public.feed_records FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all hatchings
CREATE POLICY "Admins can view all hatchings"
ON public.hatchings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all coop_settings
CREATE POLICY "Admins can view all coop settings"
ON public.coop_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all daily_chores
CREATE POLICY "Admins can view all daily chores"
ON public.daily_chores FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all chore_completions
CREATE POLICY "Admins can view all chore completions"
ON public.chore_completions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all health_logs
CREATE POLICY "Admins can view all health logs"
ON public.health_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
