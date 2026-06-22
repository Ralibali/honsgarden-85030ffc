-- Prompt 3: Recensionsförfrågan
ALTER TABLE public.public_egg_sale_bookings
  ADD COLUMN IF NOT EXISTS review_request_sent_at timestamptz;

-- Daily cron at 08:00 UTC (~09:00/10:00 Europe/Stockholm)
SELECT cron.schedule(
  'send-review-request-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/send-review-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpa2J5bXRyYmhyb2Z5c2drcXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQ0MjAsImV4cCI6MjA4ODI0MDQyMH0.SlgJoYwkD5GWeZ2mK-GihDvEWpt8noKWE8xulzSOqaU',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);