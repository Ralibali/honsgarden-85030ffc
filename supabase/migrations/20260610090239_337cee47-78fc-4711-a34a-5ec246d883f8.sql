ALTER TABLE public.egg_logs
  ADD COLUMN IF NOT EXISTS client_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS egg_logs_user_client_unique
  ON public.egg_logs (user_id, client_id)
  WHERE client_id IS NOT NULL;