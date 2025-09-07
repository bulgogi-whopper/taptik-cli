-- Complete Auth Fix Migration
-- This migration consolidates all auth-related fixes applied directly to Supabase

-- 1. Create profiles table (required for OAuth user metadata)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    username TEXT UNIQUE,
    provider TEXT,
    provider_id TEXT,
    provider_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Ensure user_tiers table exists with correct structure
CREATE TABLE IF NOT EXISTS public.user_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    tier TEXT CHECK (tier IN ('free', 'pro', 'premium', 'enterprise')) DEFAULT 'free',
    daily_upload_limit INT DEFAULT 100,
    monthly_bandwidth_gb INT DEFAULT 10,
    max_package_size_mb INT DEFAULT 50,
    max_storage_gb INT DEFAULT 5,
    subscription_id TEXT,
    subscription_status TEXT CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'trial')),
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ensure rate_limits table exists with correct structure
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    daily_uploads INT DEFAULT 0,
    daily_downloads INT DEFAULT 0,
    daily_bandwidth_bytes BIGINT DEFAULT 0,
    daily_reset_at TIMESTAMPTZ DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
    monthly_uploads INT DEFAULT 0,
    monthly_downloads INT DEFAULT 0,
    monthly_bandwidth_bytes BIGINT DEFAULT 0,
    monthly_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'),
    total_storage_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Drop and recreate the trigger function with proper error handling
DROP TRIGGER IF EXISTS create_user_tier_on_signup ON auth.users;
DROP FUNCTION IF EXISTS public.create_default_user_tier();

CREATE OR REPLACE FUNCTION public.create_default_user_tier()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user tier with explicit schema
    INSERT INTO public.user_tiers (user_id, tier)
    VALUES (NEW.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create rate limits with explicit schema
    INSERT INTO public.rate_limits (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create profile with explicit schema
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        provider,
        provider_id,
        provider_metadata
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
        NEW.raw_user_meta_data->>'provider_id',
        NEW.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        provider = COALESCE(EXCLUDED.provider, public.profiles.provider),
        provider_metadata = COALESCE(EXCLUDED.provider_metadata, public.profiles.provider_metadata),
        updated_at = now();
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the signup
        RAISE LOG 'Error in create_default_user_tier for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 5. Create the trigger
CREATE TRIGGER create_user_tier_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_user_tier();

-- 6. Populate missing data for existing users
INSERT INTO public.profiles (id, email, full_name, provider)
SELECT 
    id, 
    email, 
    COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name',
        split_part(email, '@', 1)
    ),
    COALESCE(raw_app_meta_data->>'provider', 'email')
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = users.id);

INSERT INTO public.user_tiers (user_id, tier)
SELECT id, 'free'
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_tiers WHERE user_tiers.user_id = users.id);

INSERT INTO public.rate_limits (user_id)
SELECT id
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.rate_limits WHERE rate_limits.user_id = users.id);

-- 7. Add helpful comments
COMMENT ON TABLE public.profiles IS 'User profiles with OAuth provider metadata';
COMMENT ON TABLE public.user_tiers IS 'User subscription tiers and quotas';
COMMENT ON TABLE public.rate_limits IS 'User rate limiting and usage tracking';
COMMENT ON FUNCTION public.create_default_user_tier() IS 'Creates necessary records for new users during signup with error handling';