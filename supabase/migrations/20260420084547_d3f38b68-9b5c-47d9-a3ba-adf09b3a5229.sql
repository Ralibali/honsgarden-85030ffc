
-- 1. Lägg till image_url på hens
ALTER TABLE public.hens ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Skapa storage bucket för hönsbilder (publik för snabb visning)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hen-images',
  'hen-images',
  true,
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 3. RLS policies för hen-images bucket
-- Alla kan visa bilderna (publik)
CREATE POLICY "Hen images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'hen-images');

-- Användare kan ladda upp till sin egen mapp (user_id som första segment)
CREATE POLICY "Users can upload their own hen images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'hen-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Användare kan uppdatera sina egna bilder
CREATE POLICY "Users can update their own hen images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'hen-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Användare kan ta bort sina egna bilder
CREATE POLICY "Users can delete their own hen images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'hen-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
