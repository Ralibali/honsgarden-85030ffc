ALTER TABLE public.egg_logs ADD COLUMN IF NOT EXISTS hen_id uuid REFERENCES public.hens(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;