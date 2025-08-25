-- Migration: Create Storage Buckets for Taptik Packages
-- Description: Sets up Supabase Storage buckets for package uploads

-- Create the main storage bucket for Taptik packages
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'taptik-packages',
    'taptik-packages',
    false, -- Private bucket, access via signed URLs
    52428800, -- 50MB limit per file
    ARRAY['application/octet-stream', 'application/gzip', 'application/x-tar', 'application/zip']::text[]
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create storage policies for the bucket

-- Users can upload to their own folder
CREATE POLICY "Users can upload packages" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'taptik-packages' AND
        auth.uid()::text = (string_to_array(name, '/'))[1]
    );

-- Users can view their own packages
CREATE POLICY "Users can view own packages" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'taptik-packages' AND
        auth.uid()::text = (string_to_array(name, '/'))[1]
    );

-- Users can update their own packages
CREATE POLICY "Users can update own packages" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'taptik-packages' AND
        auth.uid()::text = (string_to_array(name, '/'))[1]
    );

-- Users can delete their own packages
CREATE POLICY "Users can delete own packages" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'taptik-packages' AND
        auth.uid()::text = (string_to_array(name, '/'))[1]
    );

-- Public packages can be viewed by anyone (requires signed URL from application)
-- This is handled at the application level through signed URLs

-- Create a function to generate storage paths
CREATE OR REPLACE FUNCTION generate_storage_path(
    user_id UUID,
    config_id TEXT,
    version TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN format('packages/%s/%s/%s/package.taptik', user_id::text, config_id, version);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to validate package upload
CREATE OR REPLACE FUNCTION validate_package_upload()
RETURNS TRIGGER AS $$
DECLARE
    user_tier TEXT;
    daily_upload_count INT;
    max_uploads INT;
BEGIN
    -- Get user tier (placeholder - would be from a user_tiers table in production)
    user_tier := COALESCE(
        (SELECT tier FROM user_tiers WHERE user_id = NEW.user_id),
        'free'
    );

    -- Set max uploads based on tier
    max_uploads := CASE
        WHEN user_tier = 'pro' THEN 1000
        WHEN user_tier = 'premium' THEN 5000
        ELSE 100 -- free tier
    END;

    -- Count today's uploads
    SELECT COUNT(*)
    INTO daily_upload_count
    FROM taptik_packages
    WHERE user_id = NEW.user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';

    -- Check upload limit
    IF daily_upload_count >= max_uploads THEN
        RAISE EXCEPTION 'Daily upload limit exceeded. Tier: %, Limit: %', user_tier, max_uploads;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for upload validation
CREATE TRIGGER validate_package_upload_trigger
    BEFORE INSERT ON taptik_packages
    FOR EACH ROW
    EXECUTE FUNCTION validate_package_upload();

-- Create helper function for generating unique config IDs
CREATE OR REPLACE FUNCTION generate_config_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INT;
BEGIN
    -- Generate a random 12-character ID
    FOR i IN 1..12 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        -- Add hyphens for readability
        IF i = 4 OR i = 8 THEN
            result := result || '-';
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Set default for config_id if not provided
ALTER TABLE taptik_packages 
    ALTER COLUMN config_id SET DEFAULT generate_config_id();

-- Comments for documentation
COMMENT ON FUNCTION generate_storage_path IS 'Generates consistent storage paths for packages';
COMMENT ON FUNCTION validate_package_upload IS 'Validates upload quotas based on user tier';
COMMENT ON FUNCTION generate_config_id IS 'Generates unique, readable config IDs for packages';