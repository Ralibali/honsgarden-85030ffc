-- Smart affiliateoptimering för befintliga och framtida bloggartiklar.

INSERT INTO public.affiliate_advertisers (
  slug, name, base_url, product_feed_url, product_feed_format, is_active, notes
)
VALUES
  (
    'by-benson', 'By Benson', 'https://www.bybenson.com',
    'https://addrevenue.io/productfeed?c=3467121&a=984666&m=SE&f=csv',
    'csv', true,
    'Addrevenue-feed. Endast relevanta trädgårdsprodukter importeras.'
  ),
  (
    'dintradgard', 'DinTrädgård', 'https://dintradgard.se',
    'https://addrevenue.io/productfeed?c=3467121&a=985743&m=SE&f=csv',
    'csv', true,
    'Addrevenue-feed. Grillprodukter filtreras bort.'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  product_feed_url = EXCLUDED.product_feed_url,
  product_feed_format = EXCLUDED.product_feed_format,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes,
  updated_at = now();

CREATE INDEX IF NOT EXISTS page_views_blog_recent_idx
  ON public.page_views (created_at DESC, path)
  WHERE path LIKE '/blogg/%';

CREATE OR REPLACE FUNCTION public.get_affiliate_article_profile(p_slug text)
RETURNS TABLE (
  views_30d bigint,
  unique_visitors_30d bigint,
  rank_30d bigint,
  article_count bigint,
  percentile numeric,
  tier text,
  max_blocks integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cleaned_input AS (
    SELECT regexp_replace(lower(coalesce(p_slug, '')), '[^a-z0-9-]', '', 'g') AS slug
  ),
  blog_views AS (
    SELECT
      regexp_replace(split_part(path, '?', 1), '^/blogg/', '') AS slug,
      count(*)::bigint AS views_30d,
      count(DISTINCT session_id)::bigint AS unique_visitors_30d
    FROM public.page_views
    WHERE created_at >= now() - interval '30 days'
      AND split_part(path, '?', 1) LIKE '/blogg/%'
      AND split_part(path, '?', 1) <> '/blogg/'
    GROUP BY 1
  ),
  ranked AS (
    SELECT
      slug,
      views_30d,
      unique_visitors_30d,
      dense_rank() OVER (ORDER BY views_30d DESC)::bigint AS rank_30d,
      count(*) OVER ()::bigint AS article_count,
      percent_rank() OVER (ORDER BY views_30d)::numeric AS percentile
    FROM blog_views
  ),
  selected AS (
    SELECT
      coalesce(r.views_30d, 0)::bigint AS views_30d,
      coalesce(r.unique_visitors_30d, 0)::bigint AS unique_visitors_30d,
      r.rank_30d,
      coalesce(r.article_count, 0)::bigint AS article_count,
      coalesce(r.percentile, 0)::numeric AS percentile
    FROM cleaned_input i
    LEFT JOIN ranked r ON r.slug = i.slug
  )
  SELECT
    s.views_30d,
    s.unique_visitors_30d,
    s.rank_30d,
    s.article_count,
    s.percentile,
    CASE
      WHEN ((s.rank_30d IS NOT NULL AND s.rank_30d <= 5 AND s.views_30d >= 10)
        OR (s.percentile >= 0.90 AND s.views_30d >= 20)) THEN 'hot'
      WHEN s.percentile >= 0.65 AND s.views_30d >= 8 THEN 'strong'
      ELSE 'normal'
    END AS tier,
    CASE
      WHEN ((s.rank_30d IS NOT NULL AND s.rank_30d <= 5 AND s.views_30d >= 10)
        OR (s.percentile >= 0.90 AND s.views_30d >= 20)) THEN 5
      WHEN s.percentile >= 0.65 AND s.views_30d >= 8 THEN 4
      ELSE 2
    END AS max_blocks
  FROM selected s;
$$;

REVOKE ALL ON FUNCTION public.get_affiliate_article_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_affiliate_article_profile(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_affiliate_article_profile(text) IS
  'Returnerar endast aggregerad 30-dagarstrafik och annonsnivå för en bloggartikel.';