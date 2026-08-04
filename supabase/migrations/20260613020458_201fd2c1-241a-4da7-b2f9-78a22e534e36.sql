CREATE TABLE public.marketplace_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NULL,
  region text NULL,
  search_term text NULL,
  active boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_alerts_user_id_idx ON public.marketplace_alerts(user_id);
CREATE INDEX marketplace_alerts_active_idx ON public.marketplace_alerts(active) WHERE active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_alerts TO authenticated;
GRANT ALL ON public.marketplace_alerts TO service_role;

ALTER TABLE public.marketplace_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON public.marketplace_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON public.marketplace_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON public.marketplace_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON public.marketplace_alerts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_marketplace_alerts_updated_at
  BEFORE UPDATE ON public.marketplace_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
