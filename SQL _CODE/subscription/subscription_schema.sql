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

-- Drop existing triggers if they exist to avoid duplicate errors
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;

-- Create triggers
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
('free', 'Free', 0, 50, 100, '["50 price checks per month", "100 posts per month", "Basic features", "Community support"]'),
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
        COALESCE(p.price_check_limit, 50),
        COALESCE(s.price_checks_used, 0)
    INTO v_limit, v_used
    FROM user_subscriptions s
    LEFT JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id AND s.status = 'active';
    
    -- If no active subscription found, use free plan defaults
    IF v_limit IS NULL THEN
        v_limit := 50;  -- Free plan default
        v_used := 0;
    END IF;
    
    -- Return true if user can make more checks
    RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to log a price check
-- Returns JSON with updated subscription info to avoid race conditions
CREATE OR REPLACE FUNCTION log_price_check(
    p_user_id UUID,
    p_symbol VARCHAR(20),
    p_exchange VARCHAR(50) DEFAULT NULL,
    p_country VARCHAR(100) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_can_check BOOLEAN;
    v_subscription_exists BOOLEAN;
    v_result JSON;
BEGIN
    -- Check if user can make the price check
    SELECT check_price_limit(p_user_id) INTO v_can_check;
    
    IF NOT v_can_check THEN
        -- Return current subscription info even if check fails
        SELECT json_build_object(
            'success', FALSE,
            'price_checks_used', us.price_checks_used,
            'price_check_limit', sp.price_check_limit,
            'plan_name', sp.name
        ) INTO v_result
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = p_user_id AND us.status = 'active';
        
        RETURN COALESCE(v_result, '{"success": false, "price_checks_used": 0}'::JSON);
    END IF;
    
    -- Check if user has an active subscription
    SELECT EXISTS(
        SELECT 1 FROM user_subscriptions 
        WHERE user_id = p_user_id AND status = 'active'
    ) INTO v_subscription_exists;
    
    -- If user has active subscription, increment the counter and return updated data
    IF v_subscription_exists THEN
        UPDATE user_subscriptions 
        SET 
            price_checks_used = COALESCE(price_checks_used, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id AND status = 'active'
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'price_checks_used', price_checks_used,
                'price_check_limit', (SELECT price_check_limit FROM subscription_plans WHERE id = plan_id),
                'plan_name', (SELECT name FROM subscription_plans WHERE id = plan_id)
            )
        ) INTO v_result;
    ELSE
        -- Create free subscription if none exists and return new data
        INSERT INTO user_subscriptions (user_id, plan_id, status, price_checks_used, posts_created)
        SELECT p_user_id, sp.id, 'active', 1, 0
        FROM subscription_plans sp
        WHERE sp.name = 'free'
        ON CONFLICT (user_id, status)
        DO UPDATE SET 
            price_checks_used = COALESCE(user_subscriptions.price_checks_used, 0) + 1,
            updated_at = NOW()
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'price_checks_used', user_subscriptions.price_checks_used,
                'price_check_limit', (SELECT price_check_limit FROM subscription_plans sp WHERE sp.name = 'free'),
                'plan_name', 'free'
            )
        ) INTO v_result;
    END IF;
    
    RETURN v_result;
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
    FROM user_subscriptions s
    LEFT JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id AND s.status = 'active';
    
    -- Return true if user can create more posts
    RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to log a post creation
CREATE OR REPLACE FUNCTION log_post_creation(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_can_create BOOLEAN;
    v_subscription_exists BOOLEAN;
    v_result JSON;
BEGIN
    -- Check if user can create the post
    SELECT check_post_limit(p_user_id) INTO v_can_create;
    
    IF NOT v_can_create THEN
        -- Return current subscription info even if check fails
        SELECT json_build_object(
            'success', FALSE,
            'posts_created', us.posts_created,
            'post_creation_limit', sp.post_creation_limit,
            'plan_name', sp.name
        ) INTO v_result
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = p_user_id AND us.status = 'active';
        
        RETURN COALESCE(v_result, '{"success": false, "posts_created": 0}'::JSON);
    END IF;
    
    -- Check if user has an active subscription
    SELECT EXISTS(
        SELECT 1 FROM user_subscriptions 
        WHERE user_id = p_user_id AND status = 'active'
    ) INTO v_subscription_exists;
    
    -- Increment the usage counter and return updated info with row lock
    IF v_subscription_exists THEN
        UPDATE user_subscriptions 
        SET 
            posts_created = COALESCE(posts_created, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id AND status = 'active'
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'posts_created', user_subscriptions.posts_created,
                'post_creation_limit', (SELECT post_creation_limit FROM subscription_plans WHERE id = user_subscriptions.plan_id),
                'plan_name', (SELECT name FROM subscription_plans WHERE id = user_subscriptions.plan_id)
            )
        ) INTO v_result;
    ELSE
        -- Create free subscription if none exists and return new data
        INSERT INTO user_subscriptions (user_id, plan_id, status, price_checks_used, posts_created)
        SELECT p_user_id, sp.id, 'active', 0, 1
        FROM subscription_plans sp
        WHERE sp.name = 'free'
        ON CONFLICT (user_id, status)
        DO UPDATE SET 
            posts_created = COALESCE(user_subscriptions.posts_created, 0) + 1,
            updated_at = NOW()
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'posts_created', user_subscriptions.posts_created,
                'post_creation_limit', (SELECT post_creation_limit FROM subscription_plans sp WHERE sp.name = 'free'),
                'plan_name', 'free'
            )
        ) INTO v_result;
    END IF;
    
    RETURN v_result;
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
    WHEN undefined_table THEN
        -- Ignore if tables don't exist yet
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

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

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

-- Users can insert their own transactions
CREATE POLICY "Users can insert own transactions" ON payment_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can manage all transactions (for webhooks)
CREATE POLICY "Service role can manage transactions" ON payment_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON subscription_plans TO authenticated;
GRANT SELECT, UPDATE, INSERT ON user_subscriptions TO authenticated;
GRANT SELECT, INSERT ON price_check_logs TO authenticated;
GRANT SELECT, INSERT ON payment_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION check_price_limit TO authenticated;
GRANT EXECUTE ON FUNCTION log_price_check TO authenticated;
GRANT EXECUTE ON FUNCTION check_post_limit TO authenticated;
GRANT EXECUTE ON FUNCTION log_post_creation TO authenticated;
GRANT EXECUTE ON FUNCTION reset_monthly_usage TO service_role;
GRANT EXECUTE ON FUNCTION create_pro_subscription TO service_role;
GRANT EXECUTE ON FUNCTION create_pro_subscription TO authenticated;

-- Make create_pro_subscription function run with elevated permissions to bypass RLS when needed
  ALTER FUNCTION create_pro_subscription(UUID, VARCHAR) 
    SECURITY DEFINER
    SET search_path = public;

  -- Note: Views cannot have RLS policies directly
  -- Security is handled through the underlying tables and our API endpoint

  -- =============================================
  -- Optional: Subscription events audit table
  -- =============================================

  -- Create subscription_events table (if you want to log subscription lifecycle events)
  CREATE TABLE IF NOT EXISTS subscription_events (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      event_data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );

  -- Helpful index for querying events by user/date
  CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id_created_at
    ON subscription_events(user_id, created_at DESC);

  -- Enable RLS on subscription_events
  ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies if they exist
  DO $$ BEGIN
    DROP POLICY IF EXISTS subscription_events_select_own ON subscription_events;
    DROP POLICY IF EXISTS subscription_events_insert_own ON subscription_events;
  EXCEPTION WHEN undefined_object THEN NULL; END $$;

  -- Allow authenticated users to read their own events
  CREATE POLICY subscription_events_select_own
    ON subscription_events
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

  -- Allow authenticated users to insert their own events
  CREATE POLICY subscription_events_insert_own
    ON subscription_events
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

  -- Grants
  GRANT SELECT, INSERT ON subscription_events TO authenticated;
