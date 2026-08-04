CREATE TABLE IF NOT EXISTS public.egg_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer text NOT NULL,
  eggs integer NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT true,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.egg_sales TO authenticated;
GRANT ALL ON public.egg_sales TO service_role;

ALTER TABLE public.egg_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own egg_sales" ON public.egg_sales
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own egg_sales" ON public.egg_sales
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own egg_sales" ON public.egg_sales
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own egg_sales" ON public.egg_sales
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_egg_sales_user_date ON public.egg_sales(user_id, sale_date DESC);

CREATE TRIGGER trg_egg_sales_updated_at
  BEFORE UPDATE ON public.egg_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();