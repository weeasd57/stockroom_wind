-- ===================================================================
-- CRITICAL FIX: Auto-create subscriptions for new users
-- Apply this SQL in Supabase SQL Editor NOW
-- ===================================================================

-- Step 1: Drop old function
DROP FUNCTION IF EXISTS public.get_subscription_info(UUID) CASCADE;

-- Step 2: Create new VOLATILE function with auto-creation
CREATE OR REPLACE FUNCTION public.get_subscription_info(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
VOLATILE -- PREVENTS ALL CACHING
SECURITY DEFINER -- Run with elevated permissions
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_subscription_exists BOOLEAN;
  v_free_plan_id UUID;
BEGIN
  -- Check if user has active subscription
  SELECT EXISTS(
    SELECT 1 FROM user_subscriptions 
    WHERE user_id = p_user_id AND status = 'active'
  ) INTO v_subscription_exists;
  
  -- AUTO-CREATE FREE SUBSCRIPTION IF MISSING
  IF NOT v_subscription_exists THEN
    -- Get free plan ID
    SELECT id INTO v_free_plan_id
    FROM subscription_plans
    WHERE name = 'free'
    LIMIT 1;
    
    -- Create free subscription
    INSERT INTO user_subscriptions (
      user_id, 
      plan_id, 
      status, 
      price_checks_used, 
      posts_created,
      started_at,
      expires_at
    ) VALUES (
      p_user_id,
      v_free_plan_id,
      'active',
      0,
      0,
      NOW(),
      NULL
    )
    ON CONFLICT (user_id, status) DO NOTHING;
    
    -- Log creation for debugging
    RAISE NOTICE 'Auto-created free subscription for user: %', p_user_id;
  END IF;
  
  -- Fetch subscription data from database
  SELECT json_build_object(
    'user_id', p_user_id,
    'plan_id', s.plan_id,
    'plan_name', sp.name,
    'plan_display_name', sp.display_name,
    'price_check_limit', sp.price_check_limit,
    'post_creation_limit', sp.post_creation_limit,
    'price_checks_used', s.price_checks_used,
    'posts_created', s.posts_created,
    'subscription_status', s.status,
    'start_date', s.started_at,
    'end_date', s.expires_at
  ) INTO v_result
  FROM user_subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.user_id = p_user_id AND s.status = 'active'
  ORDER BY s.updated_at DESC
  LIMIT 1;
  
  RETURN v_result;
END;
$$;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION public.get_subscription_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_info(UUID) TO anon;

-- Step 4: Verify function properties
SELECT 
  p.proname as function_name,
  p.provolatile as volatility,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE (cached)'
    WHEN 's' THEN 'STABLE (cached per statement)'
    WHEN 'v' THEN 'VOLATILE (no cache) ✓'
  END as volatility_description,
  p.prosecdef as security_definer
FROM pg_proc p
WHERE p.proname = 'get_subscription_info';

-- Step 5: Test with a user (replace with actual user_id)
-- SELECT get_subscription_info('your-user-id-here');

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check if free plan exists
SELECT * FROM subscription_plans WHERE name = 'free';

-- Count users with subscriptions
SELECT 
  COUNT(DISTINCT user_id) as total_users_with_subscriptions,
  COUNT(*) as total_subscription_records
FROM user_subscriptions 
WHERE status = 'active';

-- Show recent subscriptions
SELECT 
  us.user_id,
  sp.name as plan_name,
  us.price_checks_used,
  us.posts_created,
  us.created_at
FROM user_subscriptions us
JOIN subscription_plans sp ON sp.id = us.plan_id
WHERE us.status = 'active'
ORDER BY us.created_at DESC
LIMIT 10;

-- ===================================================================
-- NOTES
-- ===================================================================
-- 1. This function is VOLATILE - PostgreSQL will NEVER cache results
-- 2. Function auto-creates free subscription for new users
-- 3. All data comes from database, no fallbacks in code
-- 4. Run this SQL in Supabase SQL Editor
-- 5. Test by calling API: GET /api/subscription/info
-- ===================================================================
