DROP POLICY IF EXISTS "Public can read egg sale images" ON storage.objects;
DROP POLICY IF EXISTS "Public can read community images" ON storage.objects;
CREATE POLICY "Owners can list own egg sale images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'egg-sale-images' AND (select auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can list own community images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-images' AND (select auth.uid())::text = (storage.foldername(name))[1]);