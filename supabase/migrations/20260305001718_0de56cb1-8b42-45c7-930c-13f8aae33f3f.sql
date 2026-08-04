-- Daily chores table
CREATE TABLE public.daily_chores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_chores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chores" ON public.daily_chores FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chore completions (tracks daily completion)
CREATE TABLE public.chore_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id uuid REFERENCES public.daily_chores(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  completed_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chore_id, completed_date)
);
ALTER TABLE public.chore_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own completions" ON public.chore_completions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Coop settings
CREATE TABLE public.coop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  coop_name text DEFAULT 'Min hönsgård',
  hen_count integer DEFAULT 0,
  location text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coop_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own coop" ON public.coop_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Flocks
CREATE TABLE public.flocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own flocks" ON public.flocks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reminder settings
CREATE TABLE public.reminder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  morning_reminder boolean DEFAULT true,
  evening_reminder boolean DEFAULT true,
  morning_time time DEFAULT '07:00',
  evening_time time DEFAULT '18:00',
  enabled boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reminders" ON public.reminder_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Updated_at triggers for new tables
CREATE TRIGGER update_coop_settings_updated_at BEFORE UPDATE ON public.coop_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_flocks_updated_at BEFORE UPDATE ON public.flocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminder_settings_updated_at BEFORE UPDATE ON public.reminder_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add flock_id to hens (optional grouping)
ALTER TABLE public.hens ADD COLUMN IF NOT EXISTS flock_id uuid REFERENCES public.flocks(id) ON DELETE SET NULL;