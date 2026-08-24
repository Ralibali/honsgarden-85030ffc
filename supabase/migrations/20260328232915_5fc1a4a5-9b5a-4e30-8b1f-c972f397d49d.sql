ALTER TABLE public.daily_chores
  ADD COLUMN IF NOT EXISTS recurrence text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS next_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_hours_before int DEFAULT 24;

-- Add validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_chore_recurrence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.recurrence NOT IN ('daily', 'weekly', 'monthly', 'none') THEN
    RAISE EXCEPTION 'Invalid recurrence value: %', NEW.recurrence;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_chore_recurrence_trigger ON public.daily_chores;
CREATE TRIGGER validate_chore_recurrence_trigger
  BEFORE INSERT OR UPDATE ON public.daily_chores
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chore_recurrence();