-- Track sent egg-alert emails: 1 per (alert, listing), used for dedupe + daily quota
CREATE TABLE public.public_egg_alert_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.public_egg_alerts(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.public_egg_sale_listings(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  ort_slug TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (alert_id, listing_id)
);

CREATE INDEX public_egg_alert_sends_alert_sent_idx
  ON public.public_egg_alert_sends (alert_id, sent_at DESC);

GRANT ALL ON public.public_egg_alert_sends TO service_role;

ALTER TABLE public.public_egg_alert_sends ENABLE ROW LEVEL SECURITY;

-- No policies: service_role only (edge functions).

-- Seed dispatch cursor
INSERT INTO public.system_settings (key, value, description)
VALUES ('dispatch_egg_alerts_last_run', now()::text, 'Cursor for dispatch-egg-alerts cron')
ON CONFLICT (key) DO NOTHING;