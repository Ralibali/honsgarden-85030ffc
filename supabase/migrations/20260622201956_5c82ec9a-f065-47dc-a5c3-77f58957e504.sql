
ALTER TABLE public.public_egg_sale_bookings
  ADD COLUMN IF NOT EXISTS payment_reminder_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_reminder_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bookings_unpaid_pickedup
  ON public.public_egg_sale_bookings (picked_up_at)
  WHERE payment_status IS DISTINCT FROM 'paid'
    AND picked_up_at IS NOT NULL
    AND cancelled_at IS NULL;

-- Schedule daily payment reminder scan at 09:00 UTC (~10/11 Europe/Stockholm)
DO $$
BEGIN
  PERFORM cron.unschedule('send-payment-reminder-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'send-payment-reminder-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/send-payment-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{"mode":"cron"}'::jsonb
  ) AS request_id;
  $$
);
