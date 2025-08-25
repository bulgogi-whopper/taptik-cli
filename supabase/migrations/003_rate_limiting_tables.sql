-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    upload_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure we only have one record per user per day
    UNIQUE(user_id, created_at::date)
);

-- Bandwidth usage tracking table
CREATE TABLE IF NOT EXISTS bandwidth_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    bytes_used BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User subscription table for tier management
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
    tier TEXT CHECK (tier IN ('free', 'pro')) DEFAULT 'free',
    status TEXT CHECK (status IN ('active', 'inactive', 'cancelled')) DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_date ON rate_limits(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bandwidth_user_date ON bandwidth_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON user_subscriptions(user_id, status);

-- Row Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bandwidth_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rate_limits
CREATE POLICY "Users can view their own rate limits" ON rate_limits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage all rate limits" ON rate_limits
    FOR ALL USING (true);

-- RLS Policies for bandwidth_usage
CREATE POLICY "Users can view their own bandwidth usage" ON bandwidth_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage all bandwidth usage" ON bandwidth_usage
    FOR ALL USING (true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage all subscriptions" ON user_subscriptions
    FOR ALL USING (true);

-- Function to increment upload count
CREATE OR REPLACE FUNCTION increment_upload_count(
    p_user_id UUID,
    p_date_start TIMESTAMPTZ,
    p_date_end TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
    v_existing_count INT;
BEGIN
    -- Check if record exists for today
    SELECT upload_count INTO v_existing_count
    FROM rate_limits
    WHERE user_id = p_user_id
    AND created_at >= p_date_start
    AND created_at < p_date_end
    LIMIT 1;

    IF v_existing_count IS NULL THEN
        -- Insert new record
        INSERT INTO rate_limits (user_id, upload_count, created_at)
        VALUES (p_user_id, 1, now());
    ELSE
        -- Update existing record
        UPDATE rate_limits
        SET upload_count = upload_count + 1,
            updated_at = now()
        WHERE user_id = p_user_id
        AND created_at >= p_date_start
        AND created_at < p_date_end;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION increment_upload_count TO authenticated;

-- Create a cleanup function for old records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS VOID AS $$
BEGIN
    -- Delete rate limit records older than 7 days
    DELETE FROM rate_limits WHERE created_at < now() - INTERVAL '7 days';
    
    -- Delete bandwidth records older than 30 days
    DELETE FROM bandwidth_usage WHERE created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on tables for documentation
COMMENT ON TABLE rate_limits IS 'Tracks daily upload counts for rate limiting';
COMMENT ON TABLE bandwidth_usage IS 'Tracks bandwidth usage for quota management';
COMMENT ON TABLE user_subscriptions IS 'Manages user subscription tiers for different limits';