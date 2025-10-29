-- ===================================================================
-- PREMIUM POSTS FEATURE - SQL SCHEMA
-- Feature: Allow Pro Brokers to create premium-only posts
-- Premium posts are visible only to premium subscribers
-- Telegram notifications sent only to premium subscribers for premium posts
-- ===================================================================

-- ===================================================================
-- 1. ALTER POSTS TABLE - Add is_premium_only field
-- ===================================================================

-- Add is_premium_only column to posts table
ALTER TABLE posts 
  ADD COLUMN IF NOT EXISTS is_premium_only BOOLEAN DEFAULT FALSE;

-- Add index for filtering premium posts
CREATE INDEX IF NOT EXISTS idx_posts_is_premium_only 
  ON posts(is_premium_only) WHERE is_premium_only = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN posts.is_premium_only IS 
  'If TRUE, post is visible only to premium subscribers and post owner. If FALSE, visible to all.';

-- ===================================================================
-- 2. ALTER TELEGRAM_SUBSCRIBERS TABLE - Add subscription_tier
-- ===================================================================

-- Create enum type for subscription tier
DO $$ BEGIN
  CREATE TYPE subscription_tier_enum AS ENUM ('free', 'premium');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add subscription_tier column
ALTER TABLE telegram_subscribers 
  ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier_enum DEFAULT 'free';

-- Add index for filtering by tier
CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_tier 
  ON telegram_subscribers(subscription_tier);

-- Add index for premium subscribers (most queried)
CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_premium 
  ON telegram_subscribers(bot_id, subscription_tier) 
  WHERE subscription_tier = 'premium' AND is_subscribed = TRUE;

-- Add comment
COMMENT ON COLUMN telegram_subscribers.subscription_tier IS 
  'Subscription tier: free or premium. Synced with user_subscriptions table.';

-- ===================================================================
-- 3. ALTER TELEGRAM_BROADCASTS TABLE - Add target_audience
-- ===================================================================

-- Create enum type for target audience
DO $$ BEGIN
  CREATE TYPE broadcast_audience_enum AS ENUM ('all', 'premium_only', 'free_only');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add target_audience column
ALTER TABLE telegram_broadcasts 
  ADD COLUMN IF NOT EXISTS target_audience broadcast_audience_enum DEFAULT 'all';

-- Add index for filtering by audience
CREATE INDEX IF NOT EXISTS idx_telegram_broadcasts_audience 
  ON telegram_broadcasts(target_audience);

-- Add comment
COMMENT ON COLUMN telegram_broadcasts.target_audience IS 
  'Target audience: all, premium_only, or free_only subscribers.';

-- ===================================================================
-- 4. ALTER TELEGRAM_NOTIFICATIONS TABLE - Add recipient_tier
-- ===================================================================

-- Add recipient_tier column for analytics
ALTER TABLE telegram_notifications 
  ADD COLUMN IF NOT EXISTS recipient_tier VARCHAR(20);

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_recipient_tier 
  ON telegram_notifications(recipient_tier);

-- Add comment
COMMENT ON COLUMN telegram_notifications.recipient_tier IS 
  'Recipient subscription tier (free/premium) for analytics.';

-- ===================================================================
-- 5. CREATE VIEWS FOR PREMIUM/FREE SUBSCRIBERS
-- ===================================================================

-- View: premium_telegram_subscribers
-- Returns only premium subscribers who are active
CREATE OR REPLACE VIEW premium_telegram_subscribers
WITH (security_invoker = on) AS
SELECT 
  ts.*,
  p.username,
  p.full_name,
  p.avatar_url,
  us.plan_id,
  sp.name as plan_name
FROM telegram_subscribers ts
LEFT JOIN profiles p ON ts.platform_user_id = p.id
LEFT JOIN user_subscriptions us ON ts.platform_user_id = us.user_id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE ts.subscription_tier = 'premium'
  AND ts.is_subscribed = TRUE;

-- View: free_telegram_subscribers
-- Returns only free subscribers who are active
CREATE OR REPLACE VIEW free_telegram_subscribers
WITH (security_invoker = on) AS
SELECT 
  ts.*,
  p.username,
  p.full_name,
  p.avatar_url
FROM telegram_subscribers ts
LEFT JOIN profiles p ON ts.platform_user_id = p.id
WHERE ts.subscription_tier = 'free'
  AND ts.is_subscribed = TRUE;

-- View: telegram_subscribers_with_subscription
-- Complete view with subscription details
CREATE OR REPLACE VIEW telegram_subscribers_with_subscription
WITH (security_invoker = on) AS
SELECT 
  ts.*,
  p.username,
  p.full_name,
  p.avatar_url,
  us.plan_id,
  COALESCE(sp.name, 'free') as plan_name,
  COALESCE(sp.display_name, 'Free') as plan_display_name,
  us.status as subscription_status,
  us.expires_at as subscription_expires_at
FROM telegram_subscribers ts
LEFT JOIN profiles p ON ts.platform_user_id = p.id
LEFT JOIN user_subscriptions us ON ts.platform_user_id = us.user_id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE ts.is_subscribed = TRUE;

-- ===================================================================
-- 6. UPDATE EXISTING FUNCTION - get_follower_telegram_subscribers
-- ===================================================================

-- Drop and recreate function with premium_only parameter
DROP FUNCTION IF EXISTS get_follower_telegram_subscribers(UUID, UUID);

CREATE OR REPLACE FUNCTION get_follower_telegram_subscribers(
  p_user_id UUID, 
  p_bot_id UUID,
  p_premium_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    subscriber_id UUID,
    telegram_user_id BIGINT,
    telegram_username VARCHAR(255),
    telegram_first_name VARCHAR(255),
    platform_user_id UUID,
    username VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    subscription_tier subscription_tier_enum
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.id as subscriber_id,
    ts.telegram_user_id,
    ts.telegram_username,
    ts.telegram_first_name,
    ts.platform_user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    ts.subscription_tier
  FROM telegram_subscribers ts
  JOIN profiles p ON ts.platform_user_id = p.id
  WHERE ts.bot_id = p_bot_id
    AND ts.is_subscribed = TRUE
    AND (
      -- If premium_only is TRUE, only return premium subscribers
      (p_premium_only = FALSE) OR 
      (p_premium_only = TRUE AND ts.subscription_tier = 'premium')
    )
    AND EXISTS (
      SELECT 1 FROM user_followings uf
      WHERE uf.follower_id = ts.platform_user_id
      AND uf.following_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION get_follower_telegram_subscribers(UUID, UUID, BOOLEAN) IS 
  'Get telegram subscribers who follow a user. If premium_only=TRUE, returns only premium subscribers.';

-- ===================================================================
-- 7. UPDATE EXISTING FUNCTION - create_telegram_broadcast
-- ===================================================================

-- Drop and recreate function with target_audience parameter
DROP FUNCTION IF EXISTS create_telegram_broadcast(UUID, UUID, VARCHAR, TEXT, UUID[], UUID[], VARCHAR);

CREATE OR REPLACE FUNCTION create_telegram_broadcast(
    p_bot_id UUID,
    p_sender_id UUID,
    p_title VARCHAR(255),
    p_message TEXT,
    p_post_ids UUID[],
    p_recipient_ids UUID[],
    p_broadcast_type VARCHAR(50) DEFAULT 'post_selection',
    p_target_audience broadcast_audience_enum DEFAULT 'all'
)
RETURNS UUID AS $$
DECLARE
    v_broadcast_id UUID;
    v_post_id UUID;
    v_recipient_id UUID;
BEGIN
    -- Create broadcast with target_audience
    INSERT INTO telegram_broadcasts (
        bot_id, sender_id, title, message, broadcast_type,
        total_recipients, status, target_audience
    ) VALUES (
        p_bot_id, p_sender_id, p_title, p_message, p_broadcast_type,
        array_length(p_recipient_ids, 1), 'draft', p_target_audience
    ) RETURNING id INTO v_broadcast_id;
    
    -- Add posts to broadcast
    FOREACH v_post_id IN ARRAY p_post_ids
    LOOP
        INSERT INTO telegram_broadcast_posts (broadcast_id, post_id)
        VALUES (v_broadcast_id, v_post_id);
    END LOOP;
    
    -- Add recipients to broadcast (already filtered by caller)
    FOREACH v_recipient_id IN ARRAY p_recipient_ids
    LOOP
        INSERT INTO telegram_broadcast_recipients (broadcast_id, subscriber_id)
        VALUES (v_broadcast_id, v_recipient_id);
    END LOOP;
    
    RETURN v_broadcast_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION create_telegram_broadcast(UUID, UUID, VARCHAR, TEXT, UUID[], UUID[], VARCHAR, broadcast_audience_enum) IS 
  'Create telegram broadcast with target audience support (all, premium_only, free_only).';

-- ===================================================================
-- 8. NEW FUNCTION - sync_subscriber_tier_from_subscription
-- ===================================================================

-- Function to sync telegram subscriber tier with user subscription
CREATE OR REPLACE FUNCTION sync_subscriber_tier_from_subscription(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_is_premium BOOLEAN;
BEGIN
  -- Check if user has active pro subscription
  SELECT EXISTS(
    SELECT 1 FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND sp.name = 'pro'
  ) INTO v_is_premium;
  
  -- Update all telegram subscribers for this user
  UPDATE telegram_subscribers
  SET subscription_tier = CASE 
    WHEN v_is_premium THEN 'premium'::subscription_tier_enum
    ELSE 'free'::subscription_tier_enum
  END
  WHERE platform_user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION sync_subscriber_tier_from_subscription(UUID) IS 
  'Sync telegram_subscribers.subscription_tier with user_subscriptions status.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_subscriber_tier_from_subscription(UUID) TO authenticated;

-- ===================================================================
-- 9. CREATE TRIGGER - Auto-sync subscription tier
-- ===================================================================

-- Trigger function to sync subscription tier when user_subscriptions changes
CREATE OR REPLACE FUNCTION trigger_sync_telegram_subscriber_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync for the affected user
  PERFORM sync_subscriber_tier_from_subscription(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_subscriptions INSERT/UPDATE
DROP TRIGGER IF EXISTS sync_telegram_tier_on_subscription_change ON user_subscriptions;
CREATE TRIGGER sync_telegram_tier_on_subscription_change
  AFTER INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_telegram_subscriber_tier();

-- ===================================================================
-- 10. UPDATE RLS POLICIES - Premium post visibility
-- ===================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "premium_posts_visibility" ON posts;

-- Create policy: Premium posts visible only to premium users and post owner
CREATE POLICY "premium_posts_visibility" ON posts
  FOR SELECT
  USING (
    -- Public posts visible to all
    is_premium_only = FALSE
    OR
    -- Own posts visible to owner
    user_id = auth.uid()
    OR
    -- Premium posts visible to premium subscribers
    (
      is_premium_only = TRUE 
      AND EXISTS (
        SELECT 1 FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = auth.uid()
          AND us.status = 'active'
          AND sp.name = 'pro'
      )
    )
  );

-- Add comment
COMMENT ON POLICY "premium_posts_visibility" ON posts IS 
  'Premium posts are visible only to post owner and premium subscribers.';

-- ===================================================================
-- 11. OPTIONAL: Premium Post Access Log Table
-- ===================================================================

-- Create table to track premium post access (for analytics)
CREATE TABLE IF NOT EXISTS premium_post_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  access_type VARCHAR(20) NOT NULL, -- 'owner', 'premium_subscriber', 'public'
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ip_address INET,
  user_agent TEXT
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_premium_access_log_post_id 
  ON premium_post_access_log(post_id);
CREATE INDEX IF NOT EXISTS idx_premium_access_log_viewer_id 
  ON premium_post_access_log(viewer_id);
CREATE INDEX IF NOT EXISTS idx_premium_access_log_viewed_at 
  ON premium_post_access_log(viewed_at DESC);

-- Enable RLS
ALTER TABLE premium_post_access_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own access logs
CREATE POLICY "users_view_own_access_logs" ON premium_post_access_log
  FOR SELECT
  USING (viewer_id = auth.uid());

-- RLS Policy: Post owners can view access logs for their posts
CREATE POLICY "post_owners_view_access_logs" ON premium_post_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = premium_post_access_log.post_id
        AND p.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert their own access logs
CREATE POLICY "users_insert_access_logs" ON premium_post_access_log
  FOR INSERT
  WITH CHECK (viewer_id = auth.uid());

-- ===================================================================
-- 12. HELPER FUNCTION - Check if user can view premium post
-- ===================================================================

CREATE OR REPLACE FUNCTION can_user_view_premium_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_premium_only BOOLEAN;
  v_is_owner BOOLEAN;
  v_is_premium_subscriber BOOLEAN;
BEGIN
  -- Get post premium status and ownership
  SELECT 
    is_premium_only,
    (user_id = p_user_id)
  INTO v_is_premium_only, v_is_owner
  FROM posts
  WHERE id = p_post_id;
  
  -- If post not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- If not premium post, everyone can view
  IF v_is_premium_only = FALSE THEN
    RETURN TRUE;
  END IF;
  
  -- If user is owner
  IF v_is_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is premium subscriber
  SELECT EXISTS(
    SELECT 1 FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND sp.name = 'pro'
  ) INTO v_is_premium_subscriber;
  
  RETURN v_is_premium_subscriber;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION can_user_view_premium_post(UUID, UUID) IS 
  'Check if a user can view a premium post. Returns TRUE if allowed.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_user_view_premium_post(UUID, UUID) TO authenticated;

-- ===================================================================
-- 13. UPDATE posts_with_stats VIEW - Include is_premium_only
-- ===================================================================

-- Drop and recreate view with is_premium_only field
DROP VIEW IF EXISTS public.posts_with_stats CASCADE;

CREATE OR REPLACE VIEW posts_with_stats
WITH (security_invoker = on) AS
SELECT 
    p.id,
    p.user_id,
    p.content,
    p.image_url,
    p.symbol,
    p.company_name,
    p.country,
    p.exchange,
    p.current_price,
    p.target_price,
    p.stop_loss_price,
    p.strategy,
    p.created_at,
    p.updated_at,
    p.description,
    p.target_reached,
    p.stop_loss_triggered,
    p.target_reached_date,
    p.stop_loss_triggered_date,
    p.last_price_check,
    p.closed,
    p.initial_price,
    p.high_price,
    p.target_high_price,
    p.target_hit_time,
    p.postDateAfterPriceDate,
    p.postAfterMarketClose,
    p.noDataAvailable,
    p.status_message,
    p.price_checks,
    p.closed_date,
    p.status,
    p.is_public,
    p.is_premium_only,
    COALESCE(buy_counts.buy_count, 0) as buy_count,
    COALESCE(sell_counts.sell_count, 0) as sell_count,
    COALESCE(comment_counts.comment_count, 0) as comment_count
FROM public.posts p
LEFT JOIN (
    SELECT 
        post_id,
        COUNT(CASE WHEN action_type = 'buy' THEN 1 END) as buy_count
    FROM post_actions 
    GROUP BY post_id
) buy_counts ON p.id = buy_counts.post_id
LEFT JOIN (
    SELECT 
        post_id,
        COUNT(CASE WHEN action_type = 'sell' THEN 1 END) as sell_count
    FROM post_actions 
    GROUP BY post_id
) sell_counts ON p.id = sell_counts.post_id
LEFT JOIN (
    SELECT 
        post_id,
        COUNT(*) as comment_count
    FROM comments 
    GROUP BY post_id
) comment_counts ON p.id = comment_counts.post_id;

-- Grant permissions
GRANT SELECT ON public.posts_with_stats TO authenticated;
GRANT SELECT ON public.posts_with_stats TO anon;

-- ===================================================================
-- 14. MIGRATION - Set existing posts to non-premium
-- ===================================================================

-- Set all existing posts as non-premium (backward compatibility)
UPDATE posts 
SET is_premium_only = FALSE 
WHERE is_premium_only IS NULL;

-- Set all existing telegram subscribers as free tier
UPDATE telegram_subscribers 
SET subscription_tier = 'free'::subscription_tier_enum 
WHERE subscription_tier IS NULL;

-- ===================================================================
-- 15. GRANT PERMISSIONS
-- ===================================================================

-- Grant permissions for views
GRANT SELECT ON premium_telegram_subscribers TO authenticated;
GRANT SELECT ON free_telegram_subscribers TO authenticated;
GRANT SELECT ON telegram_subscribers_with_subscription TO authenticated;

-- Grant permissions for access log table
GRANT SELECT, INSERT ON premium_post_access_log TO authenticated;

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION get_follower_telegram_subscribers(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION create_telegram_broadcast(UUID, UUID, VARCHAR, TEXT, UUID[], UUID[], VARCHAR, broadcast_audience_enum) TO authenticated;

-- ===================================================================
-- DONE! Premium Posts Feature Schema Complete
-- ===================================================================

-- Summary:
-- ✅ posts.is_premium_only - Flag for premium posts
-- ✅ telegram_subscribers.subscription_tier - Free/Premium tier
-- ✅ telegram_broadcasts.target_audience - All/Premium/Free
-- ✅ telegram_notifications.recipient_tier - Analytics field
-- ✅ Views for premium/free subscribers
-- ✅ Updated functions with premium filtering
-- ✅ Auto-sync trigger for subscription tier
-- ✅ RLS policies for premium post visibility
-- ✅ Premium post access log table (optional)
-- ✅ Helper functions for permission checks
-- ✅ Migration for existing data