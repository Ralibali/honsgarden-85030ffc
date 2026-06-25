-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any old / duplicate schedules for the Soro sync
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT jobid, jobname FROM cron.job
    WHERE jobname IN ('sync-soro-blog-daily','sync-ln-blog-daily','sync-soro-blog','sync-ln-blog')
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

-- Schedule daily sync at 03:15 UTC
SELECT cron.schedule(
  'sync-soro-blog-daily',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/sync-soro-blog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);