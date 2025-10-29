CREATE OR REPLACE FUNCTION public.get_subscription_info(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH s AS (
    SELECT us.*, sp.name AS plan_name, sp.display_name, sp.price_check_limit, sp.post_creation_limit
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = p_user_id AND us.status = 'active'
    ORDER BY us.updated_at DESC
    LIMIT 1
  )
  SELECT COALESCE(
    json_build_object(
      'user_id', p_user_id,
      'plan_id', s.plan_id,
      'plan_name', COALESCE(s.plan_name, 'free'),
      'plan_display_name', COALESCE(s.display_name, 'Free'),
      'price_check_limit', COALESCE(s.price_check_limit, 50),
      'post_creation_limit', COALESCE(s.post_creation_limit, 100),
      'price_checks_used', COALESCE(s.price_checks_used, 0),
      'posts_created', COALESCE(s.posts_created, 0),
      'subscription_status', s.status,
      'start_date', s.started_at,
      'end_date', s.expires_at
    ),
    (
      SELECT json_build_object(
        'user_id', p_user_id,
        'plan_id', NULL,
        'plan_name', 'free',
        'plan_display_name', 'Free',
        'price_check_limit', COALESCE(sp.price_check_limit, 50),
        'post_creation_limit', COALESCE(sp.post_creation_limit, 100),
        'price_checks_used', 0,
        'posts_created', 0,
        'subscription_status', NULL,
        'start_date', NULL,
        'end_date', NULL
      )
      FROM subscription_plans sp
      WHERE sp.name = 'free'
      LIMIT 1
    )
  ) INTO v_result
  FROM s;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_info(UUID) TO authenticated;
