ALTER TABLE public.public_egg_sale_listings
  ADD COLUMN IF NOT EXISTS price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.public_egg_sale_listings.price_tiers IS
  'Optional quantity-based price tiers. Array of {min_qty:int, max_qty:int|null, price_per_pack:number}. Empty array = use price_per_pack as flat price.';
