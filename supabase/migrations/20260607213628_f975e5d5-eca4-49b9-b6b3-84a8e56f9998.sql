-- 1. Tabell
CREATE TABLE public.affiliate_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Produktidentifierare (från statiska katalogen i affiliateProducts.ts eller DB-tabellen affiliate_products)
  product_id text,
  banner_id text,
  advertiser text NOT NULL,
  source text NOT NULL CHECK (source IN ('product_box','banner','glossary','app_widget','other')),
  -- Var klicket skedde (artikelslug, app-sidans path, eller annan kontext)
  slug text,
  path text,
  href text NOT NULL,
  -- Sessions- och användarspårning
  session_id text,
  user_id uuid,
  user_agent text,
  referer text,
  ip_hash text
);

CREATE INDEX idx_affiliate_clicks_created_at ON public.affiliate_clicks (created_at DESC);
CREATE INDEX idx_affiliate_clicks_product_id ON public.affiliate_clicks (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_affiliate_clicks_banner_id ON public.affiliate_clicks (banner_id) WHERE banner_id IS NOT NULL;
CREATE INDEX idx_affiliate_clicks_slug ON public.affiliate_clicks (slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_affiliate_clicks_source ON public.affiliate_clicks (source);

-- 2. Grants
GRANT SELECT ON public.affiliate_clicks TO authenticated;
GRANT INSERT ON public.affiliate_clicks TO anon, authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;

-- 3. RLS
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read affiliate clicks"
  ON public.affiliate_clicks
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert affiliate clicks (limited)"
  ON public.affiliate_clicks
  FOR INSERT
  TO public
  WITH CHECK (
    advertiser IS NOT NULL AND length(advertiser) <= 100
    AND source IS NOT NULL AND length(source) <= 50
    AND href IS NOT NULL AND length(href) <= 2000
    AND (product_id IS NULL OR length(product_id) <= 100)
    AND (banner_id IS NULL OR length(banner_id) <= 100)
    AND (slug IS NULL OR length(slug) <= 500)
    AND (path IS NULL OR length(path) <= 500)
    AND (session_id IS NULL OR length(session_id) <= 100)
    AND (user_agent IS NULL OR length(user_agent) <= 500)
    AND (referer IS NULL OR length(referer) <= 1000)
    AND (ip_hash IS NULL OR length(ip_hash) <= 100)
  );

-- 4. Daglig städning (180 dagars retention) via pg_cron
SELECT cron.schedule(
  'cleanup-affiliate-clicks',
  '15 4 * * *',
  $$DELETE FROM public.affiliate_clicks WHERE created_at < now() - interval '180 days';$$
);