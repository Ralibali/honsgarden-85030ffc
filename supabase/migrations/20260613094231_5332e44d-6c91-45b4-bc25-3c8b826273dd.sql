
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS sold_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz NULL;

-- Backfill expires_at safety (column is NOT NULL but ensure sanity for any future relax)
UPDATE public.marketplace_listings
  SET expires_at = created_at + interval '60 days'
  WHERE expires_at IS NULL;

-- Cron: daily expire + reminders at 06:15
SELECT cron.unschedule('marketplace-expire-listings-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='marketplace-expire-listings-daily'
);

SELECT cron.schedule(
  'marketplace-expire-listings-daily',
  '15 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/marketplace-expire-listings',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpa2J5bXRyYmhyb2Z5c2drcXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQ0MjAsImV4cCI6MjA4ODI0MDQyMH0.SlgJoYwkD5GWeZ2mK-GihDvEWpt8noKWE8xulzSOqaU"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
