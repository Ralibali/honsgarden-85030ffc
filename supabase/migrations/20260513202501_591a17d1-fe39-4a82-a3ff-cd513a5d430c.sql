
-- 1.1 Utöka hens
ALTER TABLE public.hens
  ADD COLUMN IF NOT EXISTS mother_id uuid REFERENCES public.hens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS father_id uuid REFERENCES public.hens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hatch_session_id uuid,
  ADD COLUMN IF NOT EXISTS death_date date,
  ADD COLUMN IF NOT EXISTS death_cause text,
  ADD COLUMN IF NOT EXISTS bloodline text;

CREATE INDEX IF NOT EXISTS idx_hens_mother ON public.hens(mother_id);
CREATE INDEX IF NOT EXISTS idx_hens_father ON public.hens(father_id);

-- 1.2 Avelspar
CREATE TABLE IF NOT EXISTS public.breeding_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flock_id uuid REFERENCES public.flocks(id) ON DELETE CASCADE,
  name text NOT NULL,
  rooster_id uuid REFERENCES public.hens(id) ON DELETE SET NULL,
  hen_ids uuid[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  goal text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.breeding_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage farm breeding pairs" ON public.breeding_pairs
  FOR ALL USING (user_id IN (SELECT get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT get_farm_user_ids(auth.uid())));
CREATE POLICY "Admins view all breeding pairs" ON public.breeding_pairs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_breeding_pairs_updated BEFORE UPDATE ON public.breeding_pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.3 Kläckningssessioner
CREATE TABLE IF NOT EXISTS public.hatch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flock_id uuid REFERENCES public.flocks(id) ON DELETE CASCADE,
  breeding_pair_id uuid REFERENCES public.breeding_pairs(id) ON DELETE SET NULL,
  name text NOT NULL,
  incubator_type text,
  set_date date NOT NULL,
  expected_hatch_date date GENERATED ALWAYS AS (set_date + INTERVAL '21 days') STORED,
  actual_hatch_date date,
  eggs_set integer NOT NULL CHECK (eggs_set >= 0),
  eggs_fertile integer CHECK (eggs_fertile >= 0),
  eggs_hatched integer CHECK (eggs_hatched >= 0),
  chicks_survived_7d integer,
  temperature_avg numeric(4,1),
  humidity_avg numeric(4,1),
  notes text,
  status text NOT NULL DEFAULT 'incubating',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hatch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage farm hatch sessions" ON public.hatch_sessions
  FOR ALL USING (user_id IN (SELECT get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT get_farm_user_ids(auth.uid())));
CREATE POLICY "Admins view all hatch sessions" ON public.hatch_sessions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_hatch_sessions_updated BEFORE UPDATE ON public.hatch_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK från hens.hatch_session_id till hatch_sessions
ALTER TABLE public.hens
  ADD CONSTRAINT fk_hens_hatch_session FOREIGN KEY (hatch_session_id)
  REFERENCES public.hatch_sessions(id) ON DELETE SET NULL;

-- 1.4 Hälsohändelser
CREATE TABLE IF NOT EXISTS public.health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hen_id uuid REFERENCES public.hens(id) ON DELETE CASCADE,
  flock_id uuid REFERENCES public.flocks(id) ON DELETE CASCADE,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  treatment text,
  photo_url text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage farm health events" ON public.health_events
  FOR ALL USING (user_id IN (SELECT get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT get_farm_user_ids(auth.uid())));
CREATE POLICY "Admins view all health events" ON public.health_events
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_health_events_updated BEFORE UPDATE ON public.health_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.5 Fototidslinje
CREATE TABLE IF NOT EXISTS public.hen_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hen_id uuid NOT NULL REFERENCES public.hens(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text,
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hen_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage farm hen photos" ON public.hen_photos
  FOR ALL USING (user_id IN (SELECT get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT get_farm_user_ids(auth.uid())));
CREATE POLICY "Admins view all hen photos" ON public.hen_photos
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_hen_photos_hen ON public.hen_photos(hen_id, taken_at DESC);

-- 1.6 Lager
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  current_quantity numeric NOT NULL DEFAULT 0,
  low_threshold numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage farm inventory" ON public.inventory_items
  FOR ALL USING (user_id IN (SELECT get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT get_farm_user_ids(auth.uid())));
CREATE POLICY "Admins view all inventory" ON public.inventory_items
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_inventory_items_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  quantity numeric NOT NULL,
  cost numeric,
  notes text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage farm inventory tx" ON public.inventory_transactions
  FOR ALL USING (user_id IN (SELECT get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT get_farm_user_ids(auth.uid())));
CREATE POLICY "Admins view all inventory tx" ON public.inventory_transactions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger för att uppdatera lagersaldo vid transaktion
CREATE OR REPLACE FUNCTION public.apply_inventory_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _delta numeric;
BEGIN
  IF NEW.transaction_type = 'in' THEN
    _delta := NEW.quantity;
  ELSIF NEW.transaction_type = 'ut' THEN
    _delta := -NEW.quantity;
  ELSIF NEW.transaction_type = 'justering' THEN
    _delta := NEW.quantity;
  ELSE
    RAISE EXCEPTION 'Okänd transaktionstyp: %', NEW.transaction_type;
  END IF;

  UPDATE public.inventory_items
  SET current_quantity = current_quantity + _delta,
      updated_at = now()
  WHERE id = NEW.inventory_item_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_tx_apply AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_transaction();

-- 1.7 Storage bucket för fototidslinje
INSERT INTO storage.buckets (id, name, public)
VALUES ('hen-photos', 'hen-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read hen photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'hen-photos');
CREATE POLICY "Users upload own hen photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'hen-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own hen photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'hen-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own hen photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'hen-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
