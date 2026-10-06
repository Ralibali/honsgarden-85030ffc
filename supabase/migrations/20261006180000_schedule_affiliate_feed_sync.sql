-- Daglig synk av produktflöden (Adtraction, AddRevenue, Awin) till affiliate_products.
-- sync-affiliate-feed hade inget schema: katalogen uppdaterades aldrig automatiskt,
-- så AddRevenue-flödena (by-benson, dintradgard) gav noll produkter och lagerstatus
-- för P. Lindberg frös. Samma mönster som övriga cron-jobb: CRON_SECRET läses från
-- vault och skickas som x-cron-secret, aldrig hårdkodad.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET') THEN
    RAISE NOTICE 'CRON_SECRET missing from vault; sync-affiliate-feed will fail auth until it is added.';
  END IF;
END $$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-affiliate-feed-daily';

SELECT cron.schedule(
  'sync-affiliate-feed-daily',
  '40 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/sync-affiliate-feed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $cron$
);

-- En körning direkt så att katalogen kommer ikapp utan att vänta till i morgon.
SELECT net.http_post(
  url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/sync-affiliate-feed',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
);
