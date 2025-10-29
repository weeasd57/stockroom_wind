-- ========================================
-- Fix Race Condition in log_post_creation
-- ========================================
-- This migration updates the log_post_creation function to return
-- the updated subscription data directly, eliminating race conditions
-- between the UPDATE and subsequent SELECT queries.
-- ========================================

-- Drop ALL existing versions of log_post_creation function
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 'DROP FUNCTION IF EXISTS ' || n.nspname || '.' || p.proname || '(' || 
               pg_get_function_identity_arguments(p.oid) || ') CASCADE;' AS drop_statement
        FROM pg_proc p
        LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'log_post_creation'
        AND n.nspname = 'public'
    )
    LOOP
        EXECUTE r.drop_statement;
        RAISE NOTICE 'Dropped function: %', r.drop_statement;
    END LOOP;
END $$;

-- Create the new function that returns JSON with updated subscription info
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
        -- Return current subscription info even if creation not allowed
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

    IF v_subscription_exists THEN
        UPDATE user_subscriptions 
        SET 
            posts_created = COALESCE(posts_created, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id AND status = 'active'
        RETURNING (
            SELECT json_build_object(
                'success', TRUE,
                'posts_created', posts_created,
                'post_creation_limit', (SELECT post_creation_limit FROM subscription_plans WHERE id = plan_id),
                'plan_name', (SELECT name FROM subscription_plans WHERE id = plan_id)
            )
        ) INTO v_result;
    ELSE
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_post_creation TO authenticated;

-- ========================================
-- Migration Complete
-- ========================================
