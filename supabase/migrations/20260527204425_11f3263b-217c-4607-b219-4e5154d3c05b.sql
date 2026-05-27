-- 1. Add file_path column for new uploads (legacy rows keep using photo_url)
ALTER TABLE public.hen_photos
  ADD COLUMN IF NOT EXISTS file_path text;

-- 2. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'hen-photos';

-- 3. Replace open public-read policy with farm-member-scoped read
DROP POLICY IF EXISTS "Public read hen photos" ON storage.objects;
DROP POLICY IF EXISTS "Farm members read hen photos" ON storage.objects;
CREATE POLICY "Farm members read hen photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'hen-photos'
    AND (
      (storage.foldername(name))[1]::uuid IN (SELECT public.get_farm_user_ids(auth.uid()))
    )
  );

-- 4. Tighten upload policy with WITH CHECK (was previously missing)
DROP POLICY IF EXISTS "Users upload own hen photos" ON storage.objects;
CREATE POLICY "Users upload own hen photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hen-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );