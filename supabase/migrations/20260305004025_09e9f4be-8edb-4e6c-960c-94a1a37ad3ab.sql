-- Allow admins to read all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all egg_logs for stats
CREATE POLICY "Admins can view all egg logs"
ON public.egg_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all hens for stats  
CREATE POLICY "Admins can view all hens"
ON public.hens FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));