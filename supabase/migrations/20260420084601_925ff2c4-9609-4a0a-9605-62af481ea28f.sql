
-- Ta bort den breda SELECT-policyn som tillåter listning
DROP POLICY IF EXISTS "Hen images are publicly viewable" ON storage.objects;

-- Public buckets ger ändå direktåtkomst via URL utan SELECT-policy
-- Men vi behåller en restriktiv policy så ägaren kan lista sina egna bilder
CREATE POLICY "Users can list their own hen images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'hen-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
