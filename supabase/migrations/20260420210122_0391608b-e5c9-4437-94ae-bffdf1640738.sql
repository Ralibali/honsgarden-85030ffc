-- Adtraction final configuration schema
-- Does not touch subscription, Premium, Stripe, or user billing flows.

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;

CREATE POLICY "Anyone can read system settings"
ON public.system_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.affiliate_advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT,
  commission_rate NUMERIC,
  cookie_days INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  adtraction_advertiser_id TEXT,
  pin_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_advertisers
  DROP COLUMN IF EXISTS adtraction_partner_id,
  DROP COLUMN IF EXISTS deep_link_template,
  ADD COLUMN IF NOT EXISTS adtraction_advertiser_id TEXT,
  ADD COLUMN IF NOT EXISTS pin_domain TEXT,
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS cookie_days INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.affiliate_advertisers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active affiliate advertisers" ON public.affiliate_advertisers;
DROP POLICY IF EXISTS "Admins can manage affiliate advertisers" ON public.affiliate_advertisers;

CREATE POLICY "Anyone can read active affiliate advertisers"
ON public.affiliate_advertisers
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage affiliate advertisers"
ON public.affiliate_advertisers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID REFERENCES public.affiliate_advertisers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  product_url TEXT,
  affiliate_url TEXT,
  image_url TEXT,
  price TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_products
  ADD COLUMN IF NOT EXISTS advertiser_id UUID REFERENCES public.affiliate_advertisers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_url TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active affiliate products" ON public.affiliate_products;
DROP POLICY IF EXISTS "Admins can manage affiliate products" ON public.affiliate_products;

CREATE POLICY "Anyone can read active affiliate products"
ON public.affiliate_products
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage affiliate products"
ON public.affiliate_products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.build_affiliate_url(
  p_advertiser_id UUID,
  p_product_url TEXT
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id TEXT;
  v_tracking_params TEXT;
  v_pin_domain TEXT;
  v_advertiser_id TEXT;
BEGIN
  SELECT value INTO v_partner_id FROM public.system_settings WHERE key = 'adtraction_partner_id';
  SELECT value INTO v_tracking_params FROM public.system_settings WHERE key = 'adtraction_tracking_params';

  SELECT pin_domain, adtraction_advertiser_id
  INTO v_pin_domain, v_advertiser_id
  FROM public.affiliate_advertisers
  WHERE id = p_advertiser_id;

  IF p_product_url IS NULL OR v_pin_domain IS NULL OR v_advertiser_id IS NULL OR v_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN format(
    'https://%s/t/t?a=%s&as=%s&%s&url=%s',
    v_pin_domain,
    v_advertiser_id,
    v_partner_id,
    COALESCE(v_tracking_params, 't=2&tk=1'),
    p_product_url
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_affiliate_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_url IS NOT NULL AND NEW.advertiser_id IS NOT NULL THEN
    NEW.affiliate_url := public.build_affiliate_url(NEW.advertiser_id, NEW.product_url);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_affiliate_url ON public.affiliate_products;
CREATE TRIGGER tr_affiliate_url
  BEFORE INSERT OR UPDATE OF product_url, advertiser_id
  ON public.affiliate_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliate_url();

CREATE TABLE IF NOT EXISTS public.affiliate_link_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.affiliate_products(id) ON DELETE CASCADE,
  affiliate_url TEXT NOT NULL,
  tested_by TEXT,
  tested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  adtraction_registered_at TIMESTAMPTZ,
  registered_correctly BOOLEAN,
  notes TEXT
);

ALTER TABLE public.affiliate_link_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage affiliate link tests" ON public.affiliate_link_tests;

CREATE POLICY "Admins can manage affiliate link tests"
ON public.affiliate_link_tests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.advertiser_config AS
SELECT
  a.id,
  a.slug,
  a.name,
  a.pin_domain,
  a.adtraction_advertiser_id,
  (SELECT value FROM public.system_settings WHERE key = 'adtraction_partner_id') AS partner_id,
  a.base_url,
  a.commission_rate,
  a.is_active,
  format(
    'https://%s/t/t?a=%s&as=%s&t=2&tk=1',
    a.pin_domain,
    a.adtraction_advertiser_id,
    (SELECT value FROM public.system_settings WHERE key = 'adtraction_partner_id')
  ) AS base_tracking_url
FROM public.affiliate_advertisers a
WHERE a.is_active;

CREATE INDEX IF NOT EXISTS idx_affiliate_advertisers_slug ON public.affiliate_advertisers(slug);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_advertiser_id ON public.affiliate_products(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_active ON public.affiliate_products(is_active);
CREATE INDEX IF NOT EXISTS idx_affiliate_link_tests_product_id ON public.affiliate_link_tests(product_id);