DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('sync-soro-blog-daily','sync-ln-blog-daily','sync-soro-blog','sync-ln-blog')
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'sync-soro-blog-daily',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/sync-soro-blog',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Kick off one immediate run so missing posts catch up now
SELECT net.http_post(
  url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/sync-soro-blog?force=1',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{}'::jsonb
);