-- Fix generate_config_id function
-- This migration was applied directly to Supabase

-- Drop existing function if exists
DROP FUNCTION IF EXISTS generate_config_id();

-- Create improved config ID generation function
CREATE OR REPLACE FUNCTION generate_config_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    -- Generate a random 8-character ID
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        -- Add hyphen after 3rd and 6th character
        IF i = 3 OR i = 6 THEN
            result := result || '-';
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Update the default value for config_id column if needed
ALTER TABLE public.taptik_packages 
    ALTER COLUMN config_id SET DEFAULT generate_config_id();