-- ===================================================================
-- FIX: Allow public access to active premium plans
-- This allows users to view broker subscription plans
-- ===================================================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own premium plans" ON premium_plans;

-- Create two new policies:
-- 1. Users can view their own plans (active or inactive)
CREATE POLICY "Users can view their own premium plans" ON premium_plans
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Everyone can view active premium plans (for browsing broker subscriptions)
CREATE POLICY "Anyone can view active premium plans" ON premium_plans
  FOR SELECT USING (is_active = true);

-- Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'premium_plans'
ORDER BY policyname;

-- ===================================================================
-- Test Queries
-- ===================================================================

-- Test 1: View own plan (should work for owner)
-- SELECT * FROM premium_plans WHERE user_id = auth.uid();

-- Test 2: View active plans (should work for everyone)
-- SELECT * FROM premium_plans WHERE is_active = true;

-- Test 3: View inactive plan of another user (should fail)
-- SELECT * FROM premium_plans WHERE user_id != auth.uid() AND is_active = false;

-- ===================================================================
-- NOTES
-- ===================================================================
-- ✓ Users can see their own plans (active or inactive)
-- ✓ Everyone can see active plans from other users
-- ✗ Cannot see inactive plans from other users
-- 
-- This allows:
-- - Brokers to manage their own plans
-- - Users to browse and subscribe to active broker plans
-- - Privacy for draft/inactive plans
-- ===================================================================
