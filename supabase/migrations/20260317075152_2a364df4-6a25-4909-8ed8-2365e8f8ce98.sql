
-- Allow admins to read all egg_logs
CREATE POLICY "Admins can view all egg_logs"
ON public.egg_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all hens
CREATE POLICY "Admins can view all hens"
ON public.hens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all transactions
CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all feed_records
CREATE POLICY "Admins can view all feed_records"
ON public.feed_records FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all hatchings
CREATE POLICY "Admins can view all hatchings"
ON public.hatchings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all health_logs
CREATE POLICY "Admins can view all health_logs"
ON public.health_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all daily_chores
CREATE POLICY "Admins can view all daily_chores"
ON public.daily_chores FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all chore_completions
CREATE POLICY "Admins can view all chore_completions"
ON public.chore_completions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all coop_settings
CREATE POLICY "Admins can view all coop_settings"
ON public.coop_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all flocks (needed for flock names in user detail)
CREATE POLICY "Admins can view all flocks"
ON public.flocks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
