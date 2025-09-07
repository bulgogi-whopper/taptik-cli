-- Fix storage RLS path configuration
-- This migration was applied directly to Supabase

-- Update storage policies for taptik-packages bucket
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to manage their own files" ON storage.objects;

-- Create proper storage policies
CREATE POLICY "Allow authenticated uploads to taptik-packages" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'taptik-packages');

CREATE POLICY "Allow public downloads from public folder" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'taptik-packages' AND (storage.foldername(name))[1] = 'public');

CREATE POLICY "Allow authenticated downloads from all folders" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'taptik-packages');

CREATE POLICY "Allow users to update their own files" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'taptik-packages' AND auth.uid()::text = (storage.foldername(name))[2]);

CREATE POLICY "Allow users to delete their own files" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'taptik-packages' AND auth.uid()::text = (storage.foldername(name))[2]);