-- Hämtade beställningar är försäljningar, inte längre reserverat lager.

CREATE OR REPLACE FUNCTION public.egg_sale_active_packs(p_listing_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(packs), 0)::integer
  FROM public.public_egg_sale_bookings
  WHERE listing_id = p_listing_id
    AND status IN ('reserved', 'confirmed', 'paid', 'packed', 'ready');
$$;

CREATE OR REPLACE FUNCTION public.egg_sale_sync_listing_stock(p_listing_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_reserved integer;
BEGIN
  v_reserved := public.egg_sale_active_packs(p_listing_id);
  UPDATE public.public_egg_sale_listings
  SET reserved_packs = v_reserved, updated_at = now()
  WHERE id = p_listing_id;
  RETURN v_reserved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.egg_sale_active_packs(uuid) TO anon, authenticated;
