-- Händelsebaserat lager för registrerade, reserverade och sålda ägg.

CREATE TABLE IF NOT EXISTS public.egg_inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid REFERENCES public.public_egg_sale_listings(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.public_egg_sale_bookings(id) ON DELETE SET NULL,
  egg_log_id uuid REFERENCES public.egg_logs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  quantity_eggs integer NOT NULL,
  quantity_packs integer,
  pack_size integer,
  source text NOT NULL DEFAULT 'system',
  source_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS egg_inventory_events_source_key_uidx
  ON public.egg_inventory_events (source_key)
  WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS egg_inventory_events_user_date_idx
  ON public.egg_inventory_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS egg_inventory_events_listing_idx
  ON public.egg_inventory_events (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS egg_inventory_events_booking_idx
  ON public.egg_inventory_events (booking_id);

ALTER TABLE public.egg_inventory_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own egg inventory events" ON public.egg_inventory_events;
CREATE POLICY "Users read own egg inventory events"
ON public.egg_inventory_events FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users add own egg inventory events" ON public.egg_inventory_events;
CREATE POLICY "Users add own egg inventory events"
ON public.egg_inventory_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_egg_log_inventory_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.egg_inventory_events (
      user_id, egg_log_id, event_type, quantity_eggs, source, source_key, metadata, created_at
    ) VALUES (
      NEW.user_id, NEW.id, 'eggs_logged', NEW.count, 'egg_log',
      'egg-log:' || NEW.id::text,
      jsonb_build_object('date', NEW.date, 'hen_id', NEW.hen_id, 'flock_id', NEW.flock_id),
      COALESCE(NEW.created_at, now())
    ) ON CONFLICT (source_key) DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.count IS DISTINCT FROM OLD.count THEN
    INSERT INTO public.egg_inventory_events (
      user_id, egg_log_id, event_type, quantity_eggs, source, metadata
    ) VALUES (
      NEW.user_id, NEW.id, 'manual_adjustment', NEW.count - OLD.count,
      'egg_log_update', jsonb_build_object('old_count', OLD.count, 'new_count', NEW.count)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.egg_inventory_events (
      user_id, event_type, quantity_eggs, source, source_key, metadata
    ) VALUES (
      OLD.user_id, 'manual_adjustment', -OLD.count, 'egg_log_delete',
      'egg-log-delete:' || OLD.id::text,
      jsonb_build_object('deleted_egg_log_id', OLD.id, 'date', OLD.date)
    ) ON CONFLICT (source_key) DO NOTHING;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS egg_logs_inventory_ledger_trigger ON public.egg_logs;
CREATE TRIGGER egg_logs_inventory_ledger_trigger
AFTER INSERT OR UPDATE OF count OR DELETE ON public.egg_logs
FOR EACH ROW EXECUTE FUNCTION public.record_egg_log_inventory_event();

INSERT INTO public.egg_inventory_events (
  user_id, egg_log_id, event_type, quantity_eggs, source, source_key, metadata, created_at
)
SELECT
  e.user_id, e.id, 'eggs_logged', e.count, 'egg_log_backfill',
  'egg-log:' || e.id::text,
  jsonb_build_object('date', e.date, 'backfilled', true),
  COALESCE(e.created_at, now())
FROM public.egg_logs e
ON CONFLICT (source_key) DO NOTHING;
