-- Run this SQL in your Supabase Dashboard → SQL Editor to fix pet photo uploads

-- 1. Create the pet-photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pet-photos',
  'pet-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Enable RLS on storage.objects (required)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Public Access to Pet Photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own pet photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own pet photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own pet photos" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_auth_delete" ON storage.objects;

-- 4. Public SELECT: anyone can view pet photos
CREATE POLICY "Public Access to Pet Photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-photos');

-- 5. Authenticated INSERT: users can upload to their own folder
CREATE POLICY "Users can upload their own pet photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pet-photos'
  AND auth.role() = 'authenticated'
);

-- 6. Authenticated UPDATE: users can update their own files
CREATE POLICY "Users can update their own pet photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pet-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 7. Authenticated DELETE: users can delete their own files
CREATE POLICY "Users can delete their own pet photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pet-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
