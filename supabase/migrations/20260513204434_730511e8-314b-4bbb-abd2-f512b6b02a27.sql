
-- Generated reports table
CREATE TABLE public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  farm_id UUID NOT NULL REFERENCES public.coop_settings(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('manad', 'kvartal', 'ar', 'avel')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT,
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT period_valid CHECK (period_end >= period_start)
);

CREATE INDEX idx_generated_reports_user ON public.generated_reports(user_id, created_at DESC);
CREATE INDEX idx_generated_reports_farm ON public.generated_reports(farm_id, created_at DESC);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- Members of a farm can view reports for that farm
CREATE POLICY "Farm members can view reports"
  ON public.generated_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.farm_members fm
      WHERE fm.farm_id = generated_reports.farm_id
        AND fm.user_id = auth.uid()
    )
  );

-- Only owners can insert
CREATE POLICY "Farm owners can create reports"
  ON public.generated_reports FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.farm_members fm
      WHERE fm.farm_id = generated_reports.farm_id
        AND fm.user_id = auth.uid()
        AND fm.role = 'owner'
    )
  );

-- Owners can update (used by service-role mostly)
CREATE POLICY "Farm owners can update own reports"
  ON public.generated_reports FOR UPDATE
  USING (user_id = auth.uid());

-- Owners can delete their own reports
CREATE POLICY "Owners can delete own reports"
  ON public.generated_reports FOR DELETE
  USING (user_id = auth.uid());

-- Helper to count today's reports
CREATE OR REPLACE FUNCTION public.count_user_reports_today(_uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.generated_reports
  WHERE user_id = _uid AND created_at >= (NOW() - INTERVAL '24 hours')
$$;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can read their own folder; service role bypasses
CREATE POLICY "Users can read own report files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own report files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
