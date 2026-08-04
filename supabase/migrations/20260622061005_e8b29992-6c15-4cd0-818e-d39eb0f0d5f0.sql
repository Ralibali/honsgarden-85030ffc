ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS section_title text;

DROP POLICY IF EXISTS "Anyone can insert affiliate clicks (limited)" ON public.affiliate_clicks;
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
  AND (section_title IS NULL OR length(section_title) <= 300)
);

CREATE TABLE IF NOT EXISTS public.affiliate_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  product_id text,
  advertiser text NOT NULL,
  source text NOT NULL,
  slug text,
  path text,
  section_title text,
  session_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent text,
  referer text
);

CREATE INDEX IF NOT EXISTS affiliate_impressions_created_idx
  ON public.affiliate_impressions (created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_impressions_slug_idx
  ON public.affiliate_impressions (slug);
CREATE INDEX IF NOT EXISTS affiliate_impressions_product_idx
  ON public.affiliate_impressions (product_id);

GRANT INSERT ON public.affiliate_impressions TO anon, authenticated;
GRANT SELECT ON public.affiliate_impressions TO authenticated;
GRANT ALL ON public.affiliate_impressions TO service_role;

ALTER TABLE public.affiliate_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert affiliate impressions (limited)"
ON public.affiliate_impressions
FOR INSERT
TO public
WITH CHECK (
  advertiser IS NOT NULL AND length(advertiser) <= 100
  AND source IS NOT NULL AND length(source) <= 50
  AND (product_id IS NULL OR length(product_id) <= 100)
  AND (slug IS NULL OR length(slug) <= 500)
  AND (path IS NULL OR length(path) <= 500)
  AND (section_title IS NULL OR length(section_title) <= 300)
  AND (session_id IS NULL OR length(session_id) <= 100)
  AND (user_agent IS NULL OR length(user_agent) <= 500)
  AND (referer IS NULL OR length(referer) <= 1000)
);

CREATE POLICY "Admins can read affiliate impressions"
ON public.affiliate_impressions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));