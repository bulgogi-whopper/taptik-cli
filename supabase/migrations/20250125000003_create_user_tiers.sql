-- Migration: Create User Tiers and Rate Limiting Tables
-- Description: Sets up user tier management and rate limiting infrastructure

-- Create user tiers table for managing subscription levels
CREATE TABLE IF NOT EXISTS user_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    tier TEXT CHECK (tier IN ('free', 'pro', 'premium', 'enterprise')) DEFAULT 'free',
    
    -- Quota settings
    daily_upload_limit INT DEFAULT 100,
    monthly_bandwidth_gb INT DEFAULT 10,
    max_package_size_mb INT DEFAULT 50,
    max_storage_gb INT DEFAULT 5,
    
    -- Subscription info
    subscription_id TEXT, -- External subscription ID (Stripe, etc.)
    subscription_status TEXT CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'trial')),
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create rate limiting table for tracking usage
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Daily counters (reset at midnight UTC)
    daily_uploads INT DEFAULT 0,
    daily_downloads INT DEFAULT 0,
    daily_bandwidth_bytes BIGINT DEFAULT 0,
    daily_reset_at TIMESTAMPTZ DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
    
    -- Monthly counters
    monthly_uploads INT DEFAULT 0,
    monthly_downloads INT DEFAULT 0,
    monthly_bandwidth_bytes BIGINT DEFAULT 0,
    monthly_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'),
    
    -- Total usage
    total_storage_bytes BIGINT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id)
);

-- Create function to reset daily counters
CREATE OR REPLACE FUNCTION reset_daily_limits()
RETURNS void AS $$
BEGIN
    UPDATE rate_limits
    SET 
        daily_uploads = 0,
        daily_downloads = 0,
        daily_bandwidth_bytes = 0,
        daily_reset_at = CURRENT_DATE + INTERVAL '1 day',
        updated_at = now()
    WHERE daily_reset_at <= now();
END;
$$ LANGUAGE plpgsql;

-- Create function to reset monthly counters
CREATE OR REPLACE FUNCTION reset_monthly_limits()
RETURNS void AS $$
BEGIN
    UPDATE rate_limits
    SET 
        monthly_uploads = 0,
        monthly_downloads = 0,
        monthly_bandwidth_bytes = 0,
        monthly_reset_at = date_trunc('month', CURRENT_DATE) + INTERVAL '1 month',
        updated_at = now()
    WHERE monthly_reset_at <= now();
END;
$$ LANGUAGE plpgsql;

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_action TEXT, -- 'upload', 'download'
    p_size_bytes BIGINT DEFAULT 0
) RETURNS BOOLEAN AS $$
DECLARE
    v_tier TEXT;
    v_daily_limit INT;
    v_monthly_bandwidth_limit BIGINT;
    v_current_daily_count INT;
    v_current_monthly_bandwidth BIGINT;
BEGIN
    -- Reset counters if needed
    PERFORM reset_daily_limits();
    PERFORM reset_monthly_limits();
    
    -- Get user tier
    SELECT tier, daily_upload_limit, monthly_bandwidth_gb * 1073741824 -- Convert GB to bytes
    INTO v_tier, v_daily_limit, v_monthly_bandwidth_limit
    FROM user_tiers
    WHERE user_id = p_user_id;
    
    -- If no tier found, create default free tier
    IF v_tier IS NULL THEN
        INSERT INTO user_tiers (user_id, tier)
        VALUES (p_user_id, 'free')
        RETURNING tier, daily_upload_limit, monthly_bandwidth_gb * 1073741824
        INTO v_tier, v_daily_limit, v_monthly_bandwidth_limit;
    END IF;
    
    -- Get or create rate limit record
    INSERT INTO rate_limits (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Get current usage
    SELECT daily_uploads, monthly_bandwidth_bytes
    INTO v_current_daily_count, v_current_monthly_bandwidth
    FROM rate_limits
    WHERE user_id = p_user_id;
    
    -- Check limits based on action
    IF p_action = 'upload' THEN
        IF v_current_daily_count >= v_daily_limit THEN
            RETURN FALSE; -- Daily upload limit exceeded
        END IF;
    END IF;
    
    -- Check bandwidth limit
    IF v_current_monthly_bandwidth + p_size_bytes > v_monthly_bandwidth_limit THEN
        RETURN FALSE; -- Monthly bandwidth limit exceeded
    END IF;
    
    -- Update counters
    IF p_action = 'upload' THEN
        UPDATE rate_limits
        SET 
            daily_uploads = daily_uploads + 1,
            monthly_uploads = monthly_uploads + 1,
            daily_bandwidth_bytes = daily_bandwidth_bytes + p_size_bytes,
            monthly_bandwidth_bytes = monthly_bandwidth_bytes + p_size_bytes,
            total_storage_bytes = total_storage_bytes + p_size_bytes,
            updated_at = now()
        WHERE user_id = p_user_id;
    ELSIF p_action = 'download' THEN
        UPDATE rate_limits
        SET 
            daily_downloads = daily_downloads + 1,
            monthly_downloads = monthly_downloads + 1,
            daily_bandwidth_bytes = daily_bandwidth_bytes + p_size_bytes,
            monthly_bandwidth_bytes = monthly_bandwidth_bytes + p_size_bytes,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;
    
    RETURN TRUE; -- Operation allowed
END;
$$ LANGUAGE plpgsql;

-- Create function to get remaining quota
CREATE OR REPLACE FUNCTION get_user_quota(p_user_id UUID)
RETURNS TABLE (
    tier TEXT,
    daily_uploads_remaining INT,
    monthly_bandwidth_remaining_gb NUMERIC,
    total_storage_used_gb NUMERIC,
    max_storage_gb INT,
    daily_reset_at TIMESTAMPTZ,
    monthly_reset_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Reset counters if needed
    PERFORM reset_daily_limits();
    PERFORM reset_monthly_limits();
    
    RETURN QUERY
    SELECT 
        ut.tier,
        ut.daily_upload_limit - COALESCE(rl.daily_uploads, 0) AS daily_uploads_remaining,
        ROUND((ut.monthly_bandwidth_gb::NUMERIC - COALESCE(rl.monthly_bandwidth_bytes, 0)::NUMERIC / 1073741824), 2) AS monthly_bandwidth_remaining_gb,
        ROUND(COALESCE(rl.total_storage_bytes, 0)::NUMERIC / 1073741824, 2) AS total_storage_used_gb,
        ut.max_storage_gb,
        rl.daily_reset_at,
        rl.monthly_reset_at
    FROM user_tiers ut
    LEFT JOIN rate_limits rl ON ut.user_id = rl.user_id
    WHERE ut.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Set up default tiers for new users
CREATE OR REPLACE FUNCTION create_default_user_tier()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_tiers (user_id, tier)
    VALUES (NEW.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO rate_limits (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default tier for new users
CREATE TRIGGER create_user_tier_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_user_tier();

-- Update the package upload validation trigger to use the new system
DROP TRIGGER IF EXISTS validate_package_upload_trigger ON taptik_packages;
DROP FUNCTION IF EXISTS validate_package_upload();

CREATE OR REPLACE FUNCTION validate_package_upload()
RETURNS TRIGGER AS $$
DECLARE
    v_allowed BOOLEAN;
BEGIN
    -- Check rate limit
    v_allowed := check_rate_limit(NEW.user_id, 'upload', NEW.package_size);
    
    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please check your quota.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_package_upload_trigger
    BEFORE INSERT ON taptik_packages
    FOR EACH ROW
    EXECUTE FUNCTION validate_package_upload();

-- Enable RLS on new tables
ALTER TABLE user_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tiers
CREATE POLICY "Users can view own tier" ON user_tiers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage user tiers" ON user_tiers
    FOR ALL USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for rate_limits
CREATE POLICY "Users can view own rate limits" ON rate_limits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage rate limits" ON rate_limits
    FOR ALL USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tiers_user ON user_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(daily_reset_at, monthly_reset_at);

-- Comments for documentation
COMMENT ON TABLE user_tiers IS 'Manages user subscription tiers and associated quotas';
COMMENT ON TABLE rate_limits IS 'Tracks usage and enforces rate limiting per user';
COMMENT ON FUNCTION check_rate_limit IS 'Validates and updates rate limits for user actions';
COMMENT ON FUNCTION get_user_quota IS 'Returns current quota usage and remaining limits for a user';