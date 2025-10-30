-- ===================================================================
-- VERIFICATION SCRIPT - Run after applying APPLY_FIX_NOW.sql
-- ===================================================================

-- 1. Check function exists and is VOLATILE
SELECT 
  p.proname as "Function Name",
  CASE p.provolatile
    WHEN 'i' THEN '❌ IMMUTABLE (cached forever)'
    WHEN 's' THEN '❌ STABLE (cached per statement)'
    WHEN 'v' THEN '✅ VOLATILE (no cache)'
  END as "Caching Status",
  CASE p.prosecdef
    WHEN true THEN '✅ SECURITY DEFINER (elevated)'
    ELSE '❌ SECURITY INVOKER (limited)'
  END as "Security Mode",
  pg_get_functiondef(p.oid) as "Definition Preview"
FROM pg_proc p
WHERE p.proname = 'get_subscription_info'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Check if free plan exists
SELECT 
  id,
  name,
  display_name,
  price_check_limit,
  post_creation_limit,
  CASE 
    WHEN name = 'free' THEN '✅ Free plan exists'
    ELSE '❌ Not free plan'
  END as status
FROM subscription_plans
WHERE name = 'free';

-- 3. Count existing subscriptions
SELECT 
  sp.name as plan_name,
  COUNT(*) as user_count,
  SUM(us.price_checks_used) as total_checks_used,
  SUM(us.posts_created) as total_posts_created
FROM user_subscriptions us
JOIN subscription_plans sp ON sp.id = us.plan_id
WHERE us.status = 'active'
GROUP BY sp.name;

-- 4. Test function with a dummy UUID (will auto-create subscription)
-- Replace 'test-user-id' with actual user ID to test
DO $$
DECLARE
  test_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- Change this
  result JSON;
BEGIN
  -- Only run if test_user_id is changed
  IF test_user_id != '00000000-0000-0000-0000-000000000000' THEN
    SELECT get_subscription_info(test_user_id) INTO result;
    RAISE NOTICE 'Function result: %', result;
    
    -- Check if subscription was created
    IF EXISTS (
      SELECT 1 FROM user_subscriptions 
      WHERE user_id = test_user_id AND status = 'active'
    ) THEN
      RAISE NOTICE '✅ Subscription auto-created successfully';
    ELSE
      RAISE WARNING '❌ Subscription was NOT created';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  Skipped test - update test_user_id first';
  END IF;
END $$;

-- 5. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as command,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'user_subscriptions'
ORDER BY policyname;

-- 6. Check function permissions (Method 1: Using aclexplode)
SELECT 
  p.proname as function_name,
  r.rolname as granted_to,
  (a.privilege_type) as privilege
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
JOIN pg_roles r ON a.grantee = r.oid
WHERE p.proname = 'get_subscription_info'
  AND n.nspname = 'public'
  AND a.privilege_type = 'EXECUTE'
ORDER BY r.rolname;

-- 6b. Alternative: Check function permissions (simpler method)
SELECT 
  p.proname as "Function",
  p.proacl as "Access Control List (ACL)",
  CASE 
    WHEN p.proacl::text LIKE '%authenticated%' THEN '✅ Has authenticated'
    ELSE '❌ Missing authenticated'
  END as authenticated_check,
  CASE 
    WHEN p.proacl::text LIKE '%anon%' OR p.proacl IS NULL THEN '✅ Has anon/public'
    ELSE '⚠️  Check anon access'
  END as anon_check
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_subscription_info'
  AND n.nspname = 'public';

-- ===================================================================
-- EXPECTED RESULTS CHECKLIST
-- ===================================================================
-- ✅ Query 1: Function is VOLATILE with SECURITY DEFINER
-- ✅ Query 2: Free plan exists with limits (50, 100)
-- ✅ Query 3: Shows count of users per plan
-- ✅ Query 4: Auto-creates subscription for test user
-- ✅ Query 5: RLS policies allow authenticated users
-- ✅ Query 6: Function granted to authenticated and anon
-- ===================================================================

-- Run this to see sample data from user_subscriptions
SELECT 
  us.user_id,
  sp.name as plan,
  us.price_checks_used,
  sp.price_check_limit,
  us.posts_created,
  sp.post_creation_limit,
  us.status,
  us.created_at,
  CASE 
    WHEN us.created_at > NOW() - INTERVAL '1 hour' THEN '🆕 Created recently'
    ELSE '📅 ' || to_char(us.created_at, 'YYYY-MM-DD')
  END as created_info
FROM user_subscriptions us
JOIN subscription_plans sp ON sp.id = us.plan_id
WHERE us.status = 'active'
ORDER BY us.created_at DESC
LIMIT 10;

-- ===================================================================
-- FINAL CHECK: Call function and verify no caching
-- ===================================================================
-- Run this 3 times - results should be fresh each time (check timestamps)
-- SELECT 
--   (get_subscription_info('your-user-id-here')::json)->>'fetched_at' as fetched_at,
--   NOW() as current_time;
-- ===================================================================
