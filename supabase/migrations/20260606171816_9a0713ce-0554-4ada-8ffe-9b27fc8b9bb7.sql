-- Allow admins to read all egg sale listings and bookings for admin panel
CREATE POLICY "Admins can read all egg sale listings"
  ON public.public_egg_sale_listings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read all egg sale bookings"
  ON public.public_egg_sale_bookings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));