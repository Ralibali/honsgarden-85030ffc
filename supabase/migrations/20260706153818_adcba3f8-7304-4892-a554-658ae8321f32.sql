
-- Reminders table for Del 2a
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES public.flocks(id) ON DELETE SET NULL,
  hen_id UUID REFERENCES public.hens(id) ON DELETE SET NULL,
  flock_id UUID REFERENCES public.flocks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  reminder_type TEXT NOT NULL DEFAULT 'other' CHECK (reminder_type IN ('vaccination','deworming','vet','feed','cleaning','other')),
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly','quarterly','yearly')),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','overdue','done','archived')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders (farm shared read)"
  ON public.reminders FOR SELECT
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

CREATE POLICY "Users insert own reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own reminders"
  ON public.reminders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own reminders"
  ON public.reminders FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_reminders_user_status ON public.reminders(user_id, status, due_date);
CREATE INDEX idx_reminders_hen ON public.reminders(hen_id);

CREATE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
