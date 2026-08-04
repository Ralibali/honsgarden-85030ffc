
-- Backup exports table
CREATE TABLE public.backup_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','completed','failed','expired')),
  file_path TEXT,
  file_size_bytes BIGINT,
  includes_photos BOOLEAN NOT NULL DEFAULT true,
  includes_reports BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backup_exports_user ON public.backup_exports(user_id, created_at DESC);

ALTER TABLE public.backup_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own backups"
  ON public.backup_exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own backups"
  ON public.backup_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own backups"
  ON public.backup_exports FOR DELETE
  USING (auth.uid() = user_id);

-- Service role updates handled via SECURITY DEFINER edge function (no UPDATE policy = client cannot modify status)

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read own backup files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Rate limit helper
CREATE OR REPLACE FUNCTION public.count_user_backups_today(_uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.backup_exports
  WHERE user_id = _uid AND created_at >= (NOW() - INTERVAL '24 hours')
$$;
