CREATE TABLE public.marketplace_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX idx_marketplace_favorites_user ON public.marketplace_favorites(user_id);
CREATE INDEX idx_marketplace_favorites_listing ON public.marketplace_favorites(listing_id);

GRANT SELECT, INSERT, DELETE ON public.marketplace_favorites TO authenticated;
GRANT ALL ON public.marketplace_favorites TO service_role;

ALTER TABLE public.marketplace_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
  ON public.marketplace_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
  ON public.marketplace_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
  ON public.marketplace_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
