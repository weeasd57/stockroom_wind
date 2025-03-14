-- Storage bucket policies for avatars and backgrounds
-- This script sets up the necessary RLS policies to allow users to upload and manage their images

-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create backgrounds bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('backgrounds', 'backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for avatars bucket

-- Allow users to select their own avatars
CREATE POLICY "Users can view their own avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to insert their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Set up RLS policies for backgrounds bucket

-- Allow users to select their own backgrounds
CREATE POLICY "Users can view their own backgrounds"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to insert their own backgrounds
CREATE POLICY "Users can upload their own backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to update their own backgrounds
CREATE POLICY "Users can update their own backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own backgrounds
CREATE POLICY "Users can delete their own backgrounds"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public access to view all avatars and backgrounds
CREATE POLICY "Public can view all avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Public can view all backgrounds"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'backgrounds');
