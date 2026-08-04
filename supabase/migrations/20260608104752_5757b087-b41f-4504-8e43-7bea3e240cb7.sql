-- Affiliate-feed (levande pris/lager) + marknadens fulltextsök

-- 1) Feed-källa per annonsör
ALTER TABLE public.affiliate_advertisers
  ADD COLUMN IF NOT EXISTS product_feed_url text,
  ADD COLUMN IF NOT EXISTS product_feed_format text NOT NULL DEFAULT 'auto';

-- 2) Unik nyckel så feed-synken kan upserta. Om dubbletter finns, dedup först:
DELETE FROM public.affiliate_products a USING public.affiliate_products b
  WHERE a.ctid < b.ctid
    AND a.advertiser_id = b.advertiser_id
    AND a.external_id = b.external_id
    AND a.external_id IS NOT NULL;

ALTER TABLE public.affiliate_products
  DROP CONSTRAINT IF EXISTS affiliate_products_advertiser_external_uniq;
ALTER TABLE public.affiliate_products
  ADD CONSTRAINT affiliate_products_advertiser_external_uniq UNIQUE (advertiser_id, external_id);

-- 3) Seeda/peka ut P. Lindberg-feeden (CSV)
INSERT INTO public.affiliate_advertisers (slug, name, pin_domain, is_active, product_feed_url, product_feed_format)
VALUES (
  'p-lindberg', 'P. Lindberg', 'do.p-lindberg.se', true,
  'https://adtraction.com/productfeed.htm?type=feed&format=CSV&encoding=UTF8&cdelim=tab&tdelim=singlequote&flat=0&apid=1954027466&asid=2056181186&pfid=2580',
  'auto'
)
ON CONFLICT (slug) DO UPDATE
  SET product_feed_url = EXCLUDED.product_feed_url,
      product_feed_format = EXCLUDED.product_feed_format,
      is_active = true;

-- 4) Marknadens fulltextsök (krävs av useListings textSearch på search_vector)
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('swedish', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_marketplace_search_vector
  ON public.marketplace_listings USING gin (search_vector);