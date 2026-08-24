
-- 1. Utöka health_events med karenstid
ALTER TABLE public.health_events
  ADD COLUMN IF NOT EXISTS withdrawal_egg_days integer,
  ADD COLUMN IF NOT EXISTS withdrawal_meat_days integer,
  ADD COLUMN IF NOT EXISTS egg_safe_from date,
  ADD COLUMN IF NOT EXISTS meat_safe_from date,
  ADD COLUMN IF NOT EXISTS karens_end_notified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.compute_health_event_safe_from()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.withdrawal_egg_days IS NOT NULL AND NEW.event_date IS NOT NULL THEN
    NEW.egg_safe_from := NEW.event_date + NEW.withdrawal_egg_days;
  ELSE
    NEW.egg_safe_from := NULL;
  END IF;

  IF NEW.withdrawal_meat_days IS NOT NULL AND NEW.event_date IS NOT NULL THEN
    NEW.meat_safe_from := NEW.event_date + NEW.withdrawal_meat_days;
  ELSE
    NEW.meat_safe_from := NULL;
  END IF;

  -- Reset notified flag if karens window changed and isn't passed yet
  IF TG_OP = 'UPDATE' AND (NEW.egg_safe_from IS DISTINCT FROM OLD.egg_safe_from) THEN
    IF NEW.egg_safe_from IS NOT NULL AND NEW.egg_safe_from > CURRENT_DATE THEN
      NEW.karens_end_notified := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_health_events_compute_safe_from ON public.health_events;
CREATE TRIGGER trg_health_events_compute_safe_from
  BEFORE INSERT OR UPDATE ON public.health_events
  FOR EACH ROW EXECUTE FUNCTION public.compute_health_event_safe_from();

CREATE INDEX IF NOT EXISTS idx_health_events_egg_safe_from
  ON public.health_events(egg_safe_from) WHERE egg_safe_from IS NOT NULL;

-- 2. Ny tabell health_schedules
CREATE TABLE IF NOT EXISTS public.health_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flock_id uuid REFERENCES public.flocks(id) ON DELETE CASCADE,
  hen_id uuid REFERENCES public.hens(id) ON DELETE CASCADE,
  care_type text NOT NULL,
  title text NOT NULL,
  interval_days integer NOT NULL CHECK (interval_days > 0),
  next_due_date date NOT NULL,
  last_done_date date,
  reminder_days_before integer NOT NULL DEFAULT 3,
  last_reminded_due date,
  default_withdrawal_egg_days integer,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_schedules TO authenticated;
GRANT ALL ON public.health_schedules TO service_role;

ALTER TABLE public.health_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage farm health schedules" ON public.health_schedules
  FOR ALL TO authenticated
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

CREATE TRIGGER trg_health_schedules_updated
  BEFORE UPDATE ON public.health_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_health_schedules_next_due
  ON public.health_schedules(next_due_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_health_schedules_user
  ON public.health_schedules(user_id);
