-- ============================================================================
-- ADMIN AUTHENTICATION & USER MANAGEMENT SYSTEM
-- ============================================================================
-- This schema provides:
-- 1. Admin credentials table with password hashing
-- 2. Complete user deletion functions (cascading all user data)
-- 3. Admin activity logging
-- ============================================================================

-- ============================================================================
-- 1. ADMIN CREDENTIALS TABLE
-- ============================================================================
-- Stores admin passwords (hashed) in Supabase
-- Use bcrypt or similar for password hashing on application side

CREATE TABLE IF NOT EXISTS admin_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admin_credentials_email ON admin_credentials(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_credentials_active ON admin_credentials(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read (they still need correct password)
CREATE POLICY "Admin credentials readable by authenticated users"
  ON admin_credentials FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 2. ADMIN ACTIVITY LOG
-- ============================================================================
-- Tracks all admin actions for audit trail

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'login', 'delete_user', 'create_admin', etc.
  target_user_id UUID, -- User affected by the action
  details JSONB, -- Additional details about the action
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_log_email ON admin_activity_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_log_type ON admin_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_log_created ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_target ON admin_activity_log(target_user_id);

-- Enable RLS
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read logs
CREATE POLICY "Admin logs readable by authenticated users"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert logs
CREATE POLICY "Admin logs insertable by service role"
  ON admin_activity_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- 3. FUNCTION: LOG ADMIN ACTIVITY
-- ============================================================================

CREATE OR REPLACE FUNCTION log_admin_activity(
  p_admin_email TEXT,
  p_action_type TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_activity_log (
    admin_email,
    action_type,
    target_user_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_email,
    p_action_type,
    p_target_user_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- 4. FUNCTION: COMPLETE USER DELETION
-- ============================================================================
-- Deletes ALL user data from the entire application
-- This is a DESTRUCTIVE operation and should be used with caution

CREATE OR REPLACE FUNCTION delete_user_completely(
  p_user_id UUID,
  p_admin_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_data JSONB;
  v_profile_username TEXT;
  v_posts_count INT;
  v_comments_count INT;
  v_followings_count INT;
  v_followers_count INT;
  v_subscriptions_count INT;
  v_post_actions_count INT;
  v_telegram_subs_count INT;
  v_contact_convs_count INT;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'user_id', p_user_id
    );
  END IF;
  
  -- Get user info before deletion
  SELECT username INTO v_profile_username FROM profiles WHERE id = p_user_id;
  
  -- Count data to be deleted (for logging)
  SELECT COUNT(*) INTO v_posts_count FROM posts WHERE posts.user_id = p_user_id;
  SELECT COUNT(*) INTO v_comments_count FROM comments WHERE comments.user_id = p_user_id;
  SELECT COUNT(*) INTO v_followings_count FROM user_followings WHERE user_followings.follower_id = p_user_id;
  SELECT COUNT(*) INTO v_followers_count FROM user_followings WHERE user_followings.following_id = p_user_id;
  SELECT COUNT(*) INTO v_post_actions_count FROM post_actions WHERE post_actions.user_id = p_user_id;
  
  -- Check if telegram_subscribers exists (ignore if column doesn't match)
  BEGIN
    SELECT COUNT(*) INTO v_telegram_subs_count FROM telegram_subscribers WHERE telegram_subscribers.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN
      v_telegram_subs_count := 0;
    WHEN undefined_column THEN
      v_telegram_subs_count := 0;
  END;
  
  -- Check if contact_conversations exists (ignore if column doesn't match)
  BEGIN
    SELECT COUNT(*) INTO v_contact_convs_count FROM contact_conversations WHERE contact_conversations.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN
      v_contact_convs_count := 0;
    WHEN undefined_column THEN
      v_contact_convs_count := 0;
  END;
  
  v_subscriptions_count := 0;
  
  -- Start deletion cascade - Delete ALL user data
  
  -- 1. Delete all comments by this user
  DELETE FROM comments WHERE comments.user_id = p_user_id;
  
  -- 2. Delete all post actions (buy/sell votes) by this user
  DELETE FROM post_actions WHERE post_actions.user_id = p_user_id;
  
  -- 3. Delete all posts by this user (cascade will handle related tables)
  DELETE FROM posts WHERE posts.user_id = p_user_id;
  
  -- 4. Delete ALL followings relationships (both directions)
  -- Remove where this user follows others
  DELETE FROM user_followings WHERE user_followings.follower_id = p_user_id;
  -- Remove where others follow this user
  DELETE FROM user_followings WHERE user_followings.following_id = p_user_id;
  
  -- 5. Delete Telegram related data (if tables exist and columns match)
  BEGIN
    DELETE FROM telegram_subscribers WHERE telegram_subscribers.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;
  
  BEGIN
    DELETE FROM telegram_bots WHERE telegram_bots.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;
  
  BEGIN
    DELETE FROM telegram_broadcasts WHERE telegram_broadcasts.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;
  
  -- 6. Delete contact conversations (if table exists and columns match)
  BEGIN
    DELETE FROM contact_conversations WHERE contact_conversations.user_id = p_user_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;
  
  -- 7. Delete profile (this should be last before auth)
  DELETE FROM profiles WHERE id = p_user_id;
  
  -- 8. Delete from auth.users (Supabase auth table)
  DELETE FROM auth.users WHERE id = p_user_id;
  
  -- Build response JSON
  v_deleted_data := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'username', v_profile_username,
    'deleted_counts', jsonb_build_object(
      'posts', v_posts_count,
      'comments', v_comments_count,
      'followings', v_followings_count,
      'followers', v_followers_count,
      'subscriptions', v_subscriptions_count,
      'post_actions', v_post_actions_count,
      'telegram_subscriptions', v_telegram_subs_count,
      'contact_conversations', v_contact_convs_count
    ),
    'deleted_at', NOW()
  );
  
  -- Log admin activity if admin email provided
  IF p_admin_email IS NOT NULL THEN
    PERFORM log_admin_activity(
      p_admin_email,
      'delete_user',
      p_user_id,
      v_deleted_data,
      NULL,
      NULL
    );
  END IF;
  
  RETURN v_deleted_data;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', p_user_id
    );
END;
$$;

-- ============================================================================
-- 5. FUNCTION: BULK USER DELETION
-- ============================================================================
-- Deletes multiple users at once

CREATE OR REPLACE FUNCTION delete_users_bulk(
  p_user_ids UUID[],
  p_admin_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
  v_results JSONB[] := '{}';
  v_success_count INT := 0;
  v_failure_count INT := 0;
BEGIN
  -- Loop through each user
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Delete user
    v_result := delete_user_completely(v_user_id, p_admin_email);
    
    -- Count successes/failures
    IF (v_result->>'success')::boolean THEN
      v_success_count := v_success_count + 1;
    ELSE
      v_failure_count := v_failure_count + 1;
    END IF;
    
    -- Add to results array
    v_results := array_append(v_results, v_result);
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_requested', array_length(p_user_ids, 1),
    'successful_deletions', v_success_count,
    'failed_deletions', v_failure_count,
    'results', to_jsonb(v_results)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================================================
-- 6. FUNCTION: GET ALL USERS FOR ADMIN
-- ============================================================================
-- Returns comprehensive user list with stats

CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  posts_count BIGINT,
  comments_count BIGINT,
  followers_count BIGINT,
  following_count BIGINT,
  subscription_plan TEXT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    COALESCE(p.username, 'user_' || SUBSTRING(p.id::TEXT, 1, 8))::TEXT AS username,
    COALESCE(au.email, 'No email')::TEXT AS email,
    COALESCE(p.avatar_url, '')::TEXT AS avatar_url,
    p.created_at,
    COALESCE(posts_stats.count, 0) AS posts_count,
    COALESCE(comments_stats.count, 0) AS comments_count,
    COALESCE(followers_stats.count, 0) AS followers_count,
    COALESCE(following_stats.count, 0) AS following_count,
    'free'::TEXT AS subscription_plan,
    COALESCE(au.confirmed_at IS NOT NULL, false) AS is_active
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN (
    SELECT posts.user_id, COUNT(*) AS count 
    FROM posts 
    GROUP BY posts.user_id
  ) posts_stats ON posts_stats.user_id = p.id
  LEFT JOIN (
    SELECT comments.user_id, COUNT(*) AS count 
    FROM comments 
    GROUP BY comments.user_id
  ) comments_stats ON comments_stats.user_id = p.id
  LEFT JOIN (
    SELECT user_followings.following_id, COUNT(*) AS count 
    FROM user_followings 
    GROUP BY user_followings.following_id
  ) followers_stats ON followers_stats.following_id = p.id
  LEFT JOIN (
    SELECT user_followings.follower_id, COUNT(*) AS count 
    FROM user_followings 
    GROUP BY user_followings.follower_id
  ) following_stats ON following_stats.follower_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- ============================================================================
-- 7. INITIAL ADMIN USER SETUP
-- ============================================================================
-- Instructions to create first admin user:
-- 
-- 1. Hash your password using bcrypt (use online tool or node.js):
--    const bcrypt = require('bcrypt');
--    const hash = bcrypt.hashSync('your_password', 10);
--
-- 2. Insert admin credentials:

-- Example (replace with your actual hashed password):
-- INSERT INTO admin_credentials (admin_email, password_hash, is_active)
-- VALUES ('admin@example.com', '$2b$10$YourHashedPasswordHere', true);

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION log_admin_activity TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_completely TO authenticated;
GRANT EXECUTE ON FUNCTION delete_users_bulk TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_admin TO authenticated;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Create your first admin user with hashed password
-- 3. Update .env.local with admin configuration
-- 4. Implement admin authentication in the app
-- ============================================================================
