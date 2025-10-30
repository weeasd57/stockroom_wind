-- Fix get_subscription_info to auto-create free subscription and always return from database
-- This ensures new users get a proper database record and data is never cached

DROP FUNCTION IF EXISTS public.get_subscription_info(UUID);

CREATE OR REPLACE FUNCTION public.get_subscription_info(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
VOLATILE -- CRITICAL: Prevents PostgreSQL from caching results
SECURITY DEFINER -- Run with elevated permissions to bypass RLS
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_subscription_exists BOOLEAN;
  v_free_plan_id UUID;
BEGIN
  -- Check if user has any active subscription
  SELECT EXISTS(
    SELECT 1 FROM user_subscriptions 
    WHERE user_id = p_user_id AND status = 'active'
  ) INTO v_subscription_exists;
  
  -- If no subscription exists, create a free one automatically
  IF NOT v_subscription_exists THEN
    -- Get free plan ID
    SELECT id INTO v_free_plan_id
    FROM subscription_plans
    WHERE name = 'free'
    LIMIT 1;
    
    -- Create free subscription for this user
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
      NULL -- Free plan never expires
    )
    ON CONFLICT (user_id, status) DO NOTHING;
  END IF;
  
  -- Now fetch the subscription data (guaranteed to exist)
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_subscription_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_info(UUID) TO anon;

-- Verify function properties
DO $$
BEGIN
  RAISE NOTICE 'Function get_subscription_info created successfully';
  RAISE NOTICE 'Volatility: VOLATILE (no caching)';
  RAISE NOTICE 'Security: DEFINER (elevated permissions)';
  RAISE NOTICE 'Auto-creates free subscription for new users';
END $$;
