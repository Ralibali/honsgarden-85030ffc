CREATE OR REPLACE FUNCTION public.get_egg_sale_listing_stats(p_listing_id uuid, p_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_slug text;
  v_owner uuid;
  v_views int := 0;
  v_unique int := 0;
  v_since timestamptz := now() - make_interval(days => GREATEST(1, p_days));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT slug, user_id INTO v_slug, v_owner
  FROM public.public_egg_sale_listings
  WHERE id = p_listing_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'listing not found';
  END IF;

  IF v_owner <> v_user AND NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_slug IS NOT NULL AND length(v_slug) > 0 THEN
    SELECT count(*)::int, count(DISTINCT session_id)::int
      INTO v_views, v_unique
    FROM public.page_views
    WHERE created_at >= v_since
      AND (path = '/s/' || v_slug OR path LIKE '/s/' || v_slug || '/%');
  END IF;

  RETURN jsonb_build_object(
    'views', COALESCE(v_views, 0),
    'unique_visitors', COALESCE(v_unique, 0),
    'days', p_days,
    'slug', v_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_egg_sale_listing_stats(uuid, int) TO authenticated;