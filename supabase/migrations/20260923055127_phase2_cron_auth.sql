-- Fas 2: only Vault-backed cron credentials; no embedded API keys.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'reko-pickup-reminder-daily';
SELECT cron.schedule('reko-pickup-reminder-daily', '0 9 * * *', $cron$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/reko-pickup-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
$cron$);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-review-request-daily';
SELECT cron.schedule('send-review-request-daily', '0 8 * * *', $cron$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/send-review-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
$cron$);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'marketplace-expire-listings-daily';
SELECT cron.schedule('marketplace-expire-listings-daily', '15 6 * * *', $cron$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/marketplace-expire-listings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
$cron$);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-soro-blog-daily';
SELECT cron.schedule('sync-soro-blog-daily', '15 3 * * *', $cron$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/sync-soro-blog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
$cron$);
