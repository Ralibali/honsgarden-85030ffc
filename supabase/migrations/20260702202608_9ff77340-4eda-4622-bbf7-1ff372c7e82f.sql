ALTER TABLE public.public_egg_sale_listings
  ADD COLUMN IF NOT EXISTS reko_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reko_group_name text,
  ADD COLUMN IF NOT EXISTS reko_pickup_location text,
  ADD COLUMN IF NOT EXISTS reko_next_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS reko_recurring_biweekly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reko_reminder_sent_for timestamptz;

CREATE INDEX IF NOT EXISTS idx_egg_sale_listings_reko_enabled
  ON public.public_egg_sale_listings (reko_enabled)
  WHERE reko_enabled = true;

CREATE INDEX IF NOT EXISTS idx_egg_sale_listings_reko_next
  ON public.public_egg_sale_listings (reko_next_pickup_at)
  WHERE reko_enabled = true AND reko_next_pickup_at IS NOT NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'reko-pickup-reminder-daily' LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'reko-pickup-reminder-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/reko-pickup-reminder',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','R6WJ9wC4v9IMJtZ1cE2giCFyPe96rWaEh4DdWDAckfM'
    ),
    body := '{}'::jsonb
  );
  $$
);