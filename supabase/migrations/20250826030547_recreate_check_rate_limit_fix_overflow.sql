-- Recreate check_rate_limit function to fix overflow issues
-- This migration was applied directly to Supabase

-- Drop existing function
DROP FUNCTION IF EXISTS check_rate_limit(UUID, TEXT);

-- Create improved rate limit checking function
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_limit_type TEXT
)
RETURNS TABLE(
    allowed BOOLEAN,
    current_usage INT,
    limit_value INT,
    reset_at TIMESTAMPTZ
) AS $$
DECLARE
    v_tier TEXT;
    v_limit INT;
    v_current INT;
    v_reset TIMESTAMPTZ;
BEGIN
    -- Get user tier
    SELECT tier INTO v_tier
    FROM public.user_tiers
    WHERE user_id = p_user_id;
    
    -- Default to 'free' if no tier found
    IF v_tier IS NULL THEN
        v_tier := 'free';
    END IF;
    
    -- Set limits based on tier and type
    CASE p_limit_type
        WHEN 'daily_upload' THEN
            v_limit := CASE v_tier
                WHEN 'free' THEN 100
                WHEN 'pro' THEN 1000
                WHEN 'premium' THEN 5000
                WHEN 'enterprise' THEN 999999
                ELSE 100
            END;
            
            SELECT 
                COALESCE(daily_uploads, 0),
                daily_reset_at
            INTO v_current, v_reset
            FROM public.rate_limits
            WHERE user_id = p_user_id;
            
        WHEN 'monthly_bandwidth' THEN
            v_limit := CASE v_tier
                WHEN 'free' THEN 10 * 1024 * 1024 * 1024 -- 10GB in bytes
                WHEN 'pro' THEN 100 * 1024 * 1024 * 1024 -- 100GB
                WHEN 'premium' THEN 500 * 1024 * 1024 * 1024 -- 500GB
                WHEN 'enterprise' THEN 999999 * 1024 * 1024 * 1024 -- Unlimited
                ELSE 10 * 1024 * 1024 * 1024
            END::INT;
            
            SELECT 
                COALESCE(monthly_bandwidth_bytes, 0)::INT,
                monthly_reset_at
            INTO v_current, v_reset
            FROM public.rate_limits
            WHERE user_id = p_user_id;
            
        ELSE
            RAISE EXCEPTION 'Invalid limit type: %', p_limit_type;
    END CASE;
    
    -- Check if limit needs reset
    IF v_reset IS NOT NULL AND v_reset < NOW() THEN
        -- Reset the counter
        IF p_limit_type = 'daily_upload' THEN
            UPDATE public.rate_limits
            SET daily_uploads = 0,
                daily_reset_at = CURRENT_DATE + INTERVAL '1 day'
            WHERE user_id = p_user_id;
            v_current := 0;
            v_reset := CURRENT_DATE + INTERVAL '1 day';
        ELSIF p_limit_type = 'monthly_bandwidth' THEN
            UPDATE public.rate_limits
            SET monthly_bandwidth_bytes = 0,
                monthly_reset_at = date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
            WHERE user_id = p_user_id;
            v_current := 0;
            v_reset := date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
        END IF;
    END IF;
    
    -- Return result
    RETURN QUERY SELECT 
        (v_current < v_limit) AS allowed,
        v_current AS current_usage,
        v_limit AS limit_value,
        v_reset AS reset_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;