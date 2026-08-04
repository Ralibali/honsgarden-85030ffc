
ALTER TABLE public.egg_logs
  ADD COLUMN IF NOT EXISTS weather jsonb;

ALTER TABLE public.coop_settings
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

ALTER TABLE public.feed_records
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS feed_category text,
  ADD COLUMN IF NOT EXISTS affiliate_product_id uuid;

CREATE INDEX IF NOT EXISTS idx_egg_logs_date ON public.egg_logs (date);
CREATE INDEX IF NOT EXISTS idx_feed_records_brand ON public.feed_records (brand);
CREATE INDEX IF NOT EXISTS idx_coop_settings_postal ON public.coop_settings (postal_code);
