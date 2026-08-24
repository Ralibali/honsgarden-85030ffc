-- Daily AI tip cache table (1 row per day, global for all users)
CREATE TABLE public.daily_ai_tip (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  season text NOT NULL,
  tip_text text NOT NULL,
  source text DEFAULT 'lovable_ai',
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Allow all authenticated users to read tips (global cache)
ALTER TABLE public.daily_ai_tip ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tips" ON public.daily_ai_tip FOR SELECT TO authenticated USING (true);
-- Only service role / edge functions can insert/update (no direct user writes)