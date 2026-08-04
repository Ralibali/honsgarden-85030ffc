SELECT net.http_post(
  url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/premium-expiry-cron',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
  ),
  body := jsonb_build_object('trigger','manual-reconcile')
) AS request_id;