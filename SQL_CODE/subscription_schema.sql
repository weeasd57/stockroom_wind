-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    price_check_limit INTEGER NOT NULL,
    post_creation_limit INTEGER NOT NULL DEFAULT 100,
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
    price_checks_used INTEGER DEFAULT 0,
    posts_created INTEGER DEFAULT 0,
    price_checks_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 month',
    posts_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 month',
    paypal_subscription_id VARCHAR(255),
    paypal_order_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, status)
);

-- Create price check logs table
CREATE TABLE IF NOT EXISTS price_check_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(50),
    country VARCHAR(100),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Create payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    paypal_transaction_id VARCHAR(255),
    paypal_order_id VARCHAR(255),
    paypal_capture_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'payment' CHECK (transaction_type IN ('payment', 'refund')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_user_id ON price_check_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_checked_at ON price_check_logs(checked_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_paypal_order_id ON payment_transactions(paypal_order_id);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Drop ALL existing functions with all possible signatures
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all functions by querying pg_proc with specific signatures
    FOR r IN (
        SELECT 'DROP FUNCTION IF EXISTS ' || n.nspname || '.' || p.proname || '(' || 
               pg_get_function_identity_arguments(p.oid) || ') CASCADE;' AS drop_statement
        FROM pg_proc p
        LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname IN ('check_price_limit', 'log_price_check', 'reset_daily_price_checks', 'create_pro_subscription')
        AND n.nspname = 'public'
    )
    LOOP
        EXECUTE r.drop_statement;
    END LOOP;
EXCEPTION 
    WHEN OTHERS THEN 
        -- Ignore errors during cleanup
        NULL;
END $$;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, price, price_check_limit, post_creation_limit, features) VALUES
('free', 'Free', 0, 2, 100, '["2 price checks per month", "100 posts per month", "Basic features", "Community support"]'),
('pro', 'Pro', 7.00, 300, 500, '["300 price checks per month", "500 posts per month", "Priority support"]')
ON CONFLICT (name) DO UPDATE SET
    price = EXCLUDED.price,
    price_check_limit = EXCLUDED.price_check_limit,
    post_creation_limit = EXCLUDED.post_creation_limit,
    features = EXCLUDED.features,
    updated_at = NOW();

-- Function to check if user has reached their price check limit
CREATE OR REPLACE FUNCTION check_price_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
    v_used INTEGER;
BEGIN
    -- Get user's current plan limits and usage
    SELECT 
        COALESCE(p.price_check_limit, 2),
        COALESCE(s.price_checks_used, 0)
    INTO v_limit, v_used
    FROM user_subscriptions s
    LEFT JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id AND s.status = 'active';
    
    -- If no active subscription found, use free plan defaults
    IF v_limit IS NULL THEN
        v_limit := 2;  -- Free plan default
        v_used := 0;
    END IF;
    
    -- Return true if user can make more checks
    RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to log a price check
CREATE OR REPLACE FUNCTION log_price_check(
    p_user_id UUID,
    p_symbol VARCHAR(20),
    p_exchange VARCHAR(50) DEFAULT NULL,
    p_country VARCHAR(100) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_can_check BOOLEAN;
    v_subscription_exists BOOLEAN;
BEGIN
    -- Check if user can make the price check
    SELECT check_price_limit(p_user_id) INTO v_can_check;
    
    IF NOT v_can_check THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user has an active subscription
    SELECT EXISTS(
        SELECT 1 FROM user_subscriptions 
        WHERE user_id = p_user_id AND status = 'active'
    ) INTO v_subscription_exists;
    
    -- If user has active subscription, increment the counter
    IF v_subscription_exists THEN
        UPDATE user_subscriptions 
        SET 
            price_checks_used = COALESCE(price_checks_used, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id AND status = 'active';
    ELSE
        -- Create free subscription if none exists
        INSERT INTO user_subscriptions (user_id, plan_id, status, price_checks_used, posts_created)
        SELECT p_user_id, sp.id, 'active', 1, 0
        FROM subscription_plans sp
        WHERE sp.name = 'free'
        ON CONFLICT (user_id) WHERE status = 'active'
        DO UPDATE SET 
            price_checks_used = COALESCE(user_subscriptions.price_checks_used, 0) + 1,
            updated_at = NOW();
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to create subscription for Pro plan
CREATE OR REPLACE FUNCTION create_pro_subscription(
    p_user_id UUID,
    p_paypal_order_id VARCHAR(255)
)
RETURNS UUID AS $$
DECLARE
    v_pro_plan_id UUID;
    v_subscription_id UUID;
BEGIN
    -- Get Pro plan ID
    SELECT id INTO v_pro_plan_id
    FROM subscription_plans
    WHERE name = 'pro';
    
    IF v_pro_plan_id IS NULL THEN
        RAISE EXCEPTION 'Pro plan not found';
    END IF;
    
    -- Cancel any existing active subscription
    UPDATE user_subscriptions
    SET status = 'cancelled', cancelled_at = NOW()
    WHERE user_id = p_user_id AND status = 'active';
    
    -- Create new subscription
    INSERT INTO user_subscriptions (
        user_id,
        plan_id,
        status,
        paypal_order_id,
        price_checks_used,
        posts_created,
        expires_at
    ) VALUES (
        p_user_id,
        v_pro_plan_id, 
        'active',
        p_paypal_order_id,
        0,
        0,
        NOW() + INTERVAL '1 month'
    )
    RETURNING id INTO v_subscription_id;
    
    RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for easy access to user subscription info
CREATE OR REPLACE VIEW user_subscription_info AS
SELECT 
  u.id as user_id,
  u.email,
  s.plan_id,
  COALESCE(p.name, 'free') as plan_name,
  COALESCE(p.display_name, 'Free') as plan_display_name,
  COALESCE(p.price_check_limit, 2) as price_check_limit,
  COALESCE(s.price_checks_used, 0) as price_checks_used,
  COALESCE(p.price_check_limit, 2) - COALESCE(s.price_checks_used, 0) as remaining_checks,
  COALESCE(p.post_creation_limit, 100) as post_creation_limit,
  COALESCE(s.posts_created, 0) as posts_created,
  COALESCE(p.post_creation_limit, 100) - COALESCE(s.posts_created, 0) as remaining_posts,
  s.status as subscription_status,
  s.started_at as start_date,
  s.expires_at as end_date
FROM 
  auth.users u
  LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.status = 'active'
  LEFT JOIN subscription_plans p ON s.plan_id = p.id;

-- Function to check if user has reached their post creation limit
CREATE OR REPLACE FUNCTION check_post_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
    v_used INTEGER;
BEGIN
    -- Get user's current plan limits and usage
    SELECT 
        COALESCE(p.post_creation_limit, 100),
        COALESCE(s.posts_created, 0)
    INTO v_limit, v_used
    FROM auth.users u
    LEFT JOIN user_subscriptions s ON u.id = s.user_id AND s.status = 'active'
    LEFT JOIN subscription_plans p ON s.plan_id = p.id
    WHERE u.id = p_user_id;
    
    -- Return true if user can create more posts
    RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to log a post creation
CREATE OR REPLACE FUNCTION log_post_creation(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_can_create BOOLEAN;
BEGIN
    -- Check if user can create the post
    SELECT check_post_limit(p_user_id) INTO v_can_create;
    
    IF NOT v_can_create THEN
        RETURN FALSE;
    END IF;
    
    -- Increment the usage counter
    INSERT INTO user_subscriptions (user_id, plan_id, price_checks_used, posts_created)
    SELECT p_user_id, sp.id, 0, 1
    FROM subscription_plans sp
    WHERE sp.name = 'free'
    ON CONFLICT (user_id, status) 
    DO UPDATE SET 
        posts_created = user_subscriptions.posts_created + 1,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly usage (should be called monthly via cron job)
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  -- Reset price_checks_used and posts_created to 0 for all active subscriptions
  UPDATE user_subscriptions
  SET price_checks_used = 0,
      posts_created = 0,
      price_checks_reset_at = NOW() + INTERVAL '1 month',
      posts_reset_at = NOW() + INTERVAL '1 month'
  WHERE status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to reset daily usage at midnight
-- Note: This requires pg_cron extension to be enabled in Supabase
-- You can enable it from the Supabase dashboard under Database > Extensions
-- Then run this to schedule the job:
-- SELECT cron.schedule('reset-daily-checks', '0 0 * * *', 'SELECT reset_daily_price_checks();');

-- Add RLS policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_check_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (must be after enabling RLS)
DO $$ 
BEGIN
    -- Drop policies for subscription_plans
    DROP POLICY IF EXISTS "Plans are viewable by all" ON subscription_plans;
    
    -- Drop policies for user_subscriptions
    DROP POLICY IF EXISTS "Users can view own subscriptions" ON user_subscriptions;
    DROP POLICY IF EXISTS "Users can update own subscriptions" ON user_subscriptions;
    DROP POLICY IF EXISTS "Service role can manage subscriptions" ON user_subscriptions;
    
    -- Drop policies for price_check_logs
    DROP POLICY IF EXISTS "Users can view own price checks" ON price_check_logs;
    DROP POLICY IF EXISTS "Users can insert own price checks" ON price_check_logs;
    
    -- Drop policies for payment_transactions
    DROP POLICY IF EXISTS "Users can view own transactions" ON payment_transactions;
    DROP POLICY IF EXISTS "Service role can manage transactions" ON payment_transactions;
EXCEPTION 
    WHEN undefined_object THEN 
        -- Ignore if policies don't exist
        NULL;
END $$;

-- Plans are readable by all
CREATE POLICY "Plans are viewable by all" ON subscription_plans
    FOR SELECT USING (true);

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own subscriptions (for usage tracking)
CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (for webhooks)
CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own price check logs
CREATE POLICY "Users can view own price checks" ON price_check_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own price check logs
CREATE POLICY "Users can insert own price checks" ON price_check_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all transactions (for webhooks)
CREATE POLICY "Service role can manage transactions" ON payment_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON subscription_plans TO authenticated;
GRANT SELECT, UPDATE ON user_subscriptions TO authenticated;
GRANT SELECT, INSERT ON price_check_logs TO authenticated;
GRANT SELECT ON payment_transactions TO authenticated;
GRANT SELECT ON user_subscription_info TO authenticated;
GRANT EXECUTE ON FUNCTION check_price_limit TO authenticated;
GRANT EXECUTE ON FUNCTION log_price_check TO authenticated;
GRANT EXECUTE ON FUNCTION check_post_limit TO authenticated;
GRANT EXECUTE ON FUNCTION log_post_creation TO authenticated;
GRANT EXECUTE ON FUNCTION reset_monthly_usage TO service_role;
GRANT EXECUTE ON FUNCTION create_pro_subscription TO service_role;

-- Note: Views cannot have RLS policies directly
-- Security is handled through the underlying tables and our API endpoint
