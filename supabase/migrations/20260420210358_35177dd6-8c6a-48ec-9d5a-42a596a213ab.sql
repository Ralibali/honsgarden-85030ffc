ALTER TABLE public.affiliate_products
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS price_original NUMERIC,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'SEK',
  ADD COLUMN IF NOT EXISTS in_stock BOOLEAN,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS description_md TEXT,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.affiliate_products(id) ON DELETE SET NULL,
  source_url TEXT,
  status TEXT NOT NULL,
  result JSONB,
  error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage scrape jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Service role can manage scrape jobs" ON public.scrape_jobs;

CREATE POLICY "Admins can manage scrape jobs"
ON public.scrape_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role can manage scrape jobs"
ON public.scrape_jobs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_affiliate_products_external_id ON public.affiliate_products(external_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_last_scraped_at ON public.affiliate_products(last_scraped_at);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_product_id ON public.scrape_jobs(product_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON public.scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created_at ON public.scrape_jobs(created_at DESC);