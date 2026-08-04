
CREATE TABLE public.link_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  url text NOT NULL,
  rel text NOT NULL DEFAULT 'noopener sponsored',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Only admins can manage glossary
ALTER TABLE public.link_glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage glossary"
  ON public.link_glossary
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read active glossary"
  ON public.link_glossary
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
