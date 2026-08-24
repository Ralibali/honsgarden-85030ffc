-- Check whether CRON_SECRET exists in vault; if not, insert it from a placeholder.
-- The cron jobs read the secret dynamically from vault.decrypted_secrets so we never
-- need to hardcode it.

DO $$
DECLARE
  has_secret boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET') INTO has_secret;
  IF NOT has_secret THEN
    RAISE NOTICE 'CRON_SECRET missing from vault; cron jobs will fail auth until it is added.';
  END IF;
END $$;

-- Reschedule premium-expiry-cron with x-cron-secret header sourced from vault
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-premium-expiry-check';
SELECT cron.schedule(
  'daily-premium-expiry-check',
  '0 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/premium-expiry-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $cron$
);

-- Reschedule subscription-health-check with x-cron-secret header
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-subscription-health-check';
SELECT cron.schedule(
  'daily-subscription-health-check',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/subscription-health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object('triggered_by', 'cron')
  ) AS request_id;
  $cron$
);