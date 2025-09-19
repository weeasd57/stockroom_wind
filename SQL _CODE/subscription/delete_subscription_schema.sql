-- Delete subscription schema - Remove all subscription-related tables, functions, views, and policies

-- Drop views first
DROP VIEW IF EXISTS public.user_subscription_info CASCADE;

-- Drop triggers (guarded by table existence to avoid errors)
DO $$ BEGIN
  IF to_regclass('public.subscription_plans') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON public.payment_transactions;
  END IF;
END $$;

-- Drop RLS policies before dropping tables
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

-- Drop functions (drop by name+signature safely)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY (ARRAY[
        'check_price_limit',
        'log_price_check',
        'create_pro_subscription',
        'check_post_limit',
        'log_post_creation',
        'reset_monthly_usage',
        'update_updated_at_column'
      ])
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
  END LOOP;
EXCEPTION 
    WHEN OTHERS THEN 
        -- Ignore errors during cleanup
        NULL;
END $$;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_user_subscriptions_user_id;
DROP INDEX IF EXISTS public.idx_user_subscriptions_status;
DROP INDEX IF EXISTS public.idx_price_check_logs_user_id;
DROP INDEX IF EXISTS public.idx_price_check_logs_checked_at;
DROP INDEX IF EXISTS public.idx_payment_transactions_user_id;
DROP INDEX IF EXISTS public.idx_payment_transactions_paypal_order_id;

-- Drop tables (child tables first, then parent tables)
DROP TABLE IF EXISTS public.payment_transactions CASCADE;
DROP TABLE IF EXISTS public.price_check_logs CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

-- Revoke permissions (if they exist)
DO $$
BEGIN
    -- Revoke table permissions (check if tables exist first)
    IF to_regclass('public.subscription_plans') IS NOT NULL THEN
        REVOKE ALL ON TABLE subscription_plans FROM authenticated;
    END IF;
    
    IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
        REVOKE ALL ON TABLE user_subscriptions FROM authenticated;
    END IF;
    
    IF to_regclass('public.price_check_logs') IS NOT NULL THEN
        REVOKE ALL ON TABLE price_check_logs FROM authenticated;
    END IF;
    
    IF to_regclass('public.payment_transactions') IS NOT NULL THEN
        REVOKE ALL ON TABLE payment_transactions FROM authenticated;
    END IF;
    
    -- Revoke view permissions (check if view exists first)
    IF to_regclass('public.user_subscription_info') IS NOT NULL THEN
        REVOKE ALL ON TABLE user_subscription_info FROM authenticated;
    END IF;
EXCEPTION 
    WHEN undefined_object THEN 
        -- Ignore if objects don't exist
        NULL;
END $$;

-- Revoke function permissions separately
DO $$
DECLARE 
    func_exists BOOLEAN;
BEGIN
    -- Check and revoke function permissions
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'check_price_limit'
    ) INTO func_exists;
    
    IF func_exists THEN
        REVOKE ALL ON FUNCTION check_price_limit FROM authenticated;
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'log_price_check'
    ) INTO func_exists;
    
    IF func_exists THEN
        REVOKE ALL ON FUNCTION log_price_check FROM authenticated;
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'check_post_limit'
    ) INTO func_exists;
    
    IF func_exists THEN
        REVOKE ALL ON FUNCTION check_post_limit FROM authenticated;
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'log_post_creation'
    ) INTO func_exists;
    
    IF func_exists THEN
        REVOKE ALL ON FUNCTION log_post_creation FROM authenticated;
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'reset_monthly_usage'
    ) INTO func_exists;
    
    IF func_exists THEN
        REVOKE ALL ON FUNCTION reset_monthly_usage FROM service_role;
    END IF;
    
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'create_pro_subscription'
    ) INTO func_exists;
    
    IF func_exists THEN
        REVOKE ALL ON FUNCTION create_pro_subscription FROM service_role;
    END IF;
EXCEPTION 
    WHEN undefined_object THEN 
        -- Ignore if functions don't exist
        NULL;
END $$;

-- Clean up any cron jobs (if pg_cron is enabled)
DO $$
BEGIN
    -- Check if cron schema exists first
    IF EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
        -- Check if unschedule function exists
        IF EXISTS(SELECT 1 FROM pg_proc p 
                  JOIN pg_namespace n ON p.pronamespace = n.oid 
                  WHERE n.nspname = 'cron' AND p.proname = 'unschedule') THEN
            -- Remove scheduled job for resetting usage
            PERFORM cron.unschedule('reset-daily-checks');
        END IF;
    END IF;
EXCEPTION 
    WHEN OTHERS THEN 
        -- Ignore any errors during cron cleanup
        NULL;
END $$;

-- Final cleanup message
DO $$
BEGIN
    RAISE NOTICE 'Subscription schema cleanup completed successfully';
END $$;
