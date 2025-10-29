-- ========================================
-- Check Function Signatures & Return Types
-- ========================================
-- Purpose:
-- - Verify that critical RPC functions exist and return the expected types
-- - Specifically ensure JSON return types for race-condition-safe functions
-- - Optionally test-call functions for a given user (if provided)
-- ========================================

-- 1) List functions, return types, and arguments
SELECT 
  p.proname                      AS function_name,
  pg_get_function_result(p.oid)  AS return_type,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'log_price_check',
    'log_post_creation',
    'check_price_limit',
    'check_post_limit'
  )
ORDER BY function_name, arguments;

-- 2) Summaries (OK/MISSING/WRONG_TYPE)
WITH funcs AS (
  SELECT 
    p.proname AS name,
    pg_get_function_result(p.oid) AS result_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
)
SELECT 
  'log_price_check' AS function_name,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM funcs WHERE name = 'log_price_check') THEN '❌ MISSING'
    WHEN EXISTS (SELECT 1 FROM funcs WHERE name = 'log_price_check' AND result_type = 'json') THEN '✅ JSON (OK)'
    ELSE '⚠️ WRONG TYPE (expected json)'
  END AS status
UNION ALL
SELECT 
  'log_post_creation' AS function_name,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM funcs WHERE name = 'log_post_creation') THEN '❌ MISSING'
    WHEN EXISTS (SELECT 1 FROM funcs WHERE name = 'log_post_creation' AND result_type = 'json') THEN '✅ JSON (OK)'
    ELSE '⚠️ WRONG TYPE (expected json)'
  END AS status;

-- 3) Show overload counts (should normally be 1 each)
SELECT 
  p.proname AS function_name,
  COUNT(*)  AS overload_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('log_price_check','log_post_creation','check_price_limit','check_post_limit')
GROUP BY p.proname
ORDER BY p.proname;

-- 4) Optional: Test calls (set test_user_id to a UUID to enable)
DO $$
DECLARE
  test_user_id UUID := NULL;  -- Set to your user id to test, e.g. '00000000-0000-0000-0000-000000000000'
  v_json JSON;
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'Skip test calls (set test_user_id in the script to enable)';
    RETURN;
  END IF;

  RAISE NOTICE '=== Testing RPC functions for user % ===', test_user_id;

  -- Test log_price_check
  BEGIN
    SELECT log_price_check(test_user_id, 'TEST_SQL_CHECK') INTO v_json;
    RAISE NOTICE 'log_price_check returned: %', v_json;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_price_check call failed: %', SQLERRM;
  END;

  -- Test log_post_creation
  BEGIN
    SELECT log_post_creation(test_user_id) INTO v_json;
    RAISE NOTICE 'log_post_creation returned: %', v_json;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_post_creation call failed: %', SQLERRM;
  END;

  -- Show current subscription usage for the user
  BEGIN
    RAISE NOTICE 'Current subscription row:';
    PERFORM 1 FROM user_subscriptions WHERE user_id = test_user_id; -- quick existence check
    IF FOUND THEN
      -- Return row as a result set
      RAISE NOTICE 'See result grid for SELECT below';
    ELSE
      RAISE NOTICE 'No active subscription row found for user %', test_user_id;
    END IF;
  END;
END $$;

-- If test_user_id was set above and user exists, run this SELECT separately to see the row
-- SELECT user_id, price_checks_used, posts_created, updated_at, plan_id
-- FROM user_subscriptions
-- WHERE user_id = '<PUT-USER-ID-HERE>' AND status = 'active';
