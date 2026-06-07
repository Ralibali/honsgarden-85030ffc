
-- Klientfel-loggning
CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  user_id UUID,
  build_time TEXT,
  context JSONB,
  client_ts TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_created_at ON public.client_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_level ON public.client_error_logs (level);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_notified ON public.client_error_logs (notified) WHERE notified = false;

GRANT SELECT, UPDATE, DELETE ON public.client_error_logs TO authenticated;
GRANT ALL ON public.client_error_logs TO service_role;

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

-- Endast admins kan läsa/uppdatera/radera (insert sker via edge function med service role)
CREATE POLICY "Admins kan se klientfel"
  ON public.client_error_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins kan uppdatera klientfel"
  ON public.client_error_logs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins kan radera klientfel"
  ON public.client_error_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Rensa loggar äldre än 30 dagar via cron
CREATE OR REPLACE FUNCTION public.cleanup_old_client_error_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.client_error_logs WHERE created_at < now() - INTERVAL '30 days';
$$;

-- Aktivera pg_cron/pg_net om de inte redan finns
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Daglig rensning kl 04:00
SELECT cron.unschedule('cleanup-client-error-logs') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-client-error-logs'
);
SELECT cron.schedule(
  'cleanup-client-error-logs',
  '0 4 * * *',
  $$ SELECT public.cleanup_old_client_error_logs(); $$
);
