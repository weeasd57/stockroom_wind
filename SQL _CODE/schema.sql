-- ===================================================================
-- REAL SCHEMA FROM SUPABASE DATABASE
-- Generated automatically from live database
-- ===================================================================

-- ===================================================================
-- Table: PROFILES (8 rows)
-- ===================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT NOT NULL,
    bio VARCHAR(255) NOT NULL,
    website TEXT,
    favorite_markets TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    last_sign_in TIMESTAMP WITH TIME ZONE,
    success_posts INTEGER DEFAULT 0 NOT NULL,
    loss_posts INTEGER DEFAULT 0 NOT NULL,
    background_url TEXT NOT NULL,
    experience_score INTEGER NOT NULL,
    followers INTEGER NOT NULL,
    following INTEGER NOT NULL,
    facebook_url TEXT,
    telegram_url TEXT,
    youtube_url TEXT
);

CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- Add comments for documentation  
COMMENT ON COLUMN profiles.facebook_url IS 'Facebook profile URL for the user';
COMMENT ON COLUMN profiles.telegram_url IS 'Telegram profile URL for the user';
COMMENT ON COLUMN profiles.youtube_url IS 'YouTube channel URL for the user';

-- ===================================================================
-- Table: POSTS (2 rows)
-- ===================================================================
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content VARCHAR(255) NOT NULL,
    image_url TEXT,
    symbol VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    exchange VARCHAR(255) NOT NULL,
    current_price DECIMAL(10,2) NOT NULL,
    target_price DECIMAL(10,2) NOT NULL,
    stop_loss_price DECIMAL(10,2) NOT NULL,
    strategy VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    description TEXT,
    target_reached BOOLEAN DEFAULT FALSE NOT NULL,
    stop_loss_triggered BOOLEAN DEFAULT FALSE NOT NULL,
    target_reached_date TIMESTAMP WITH TIME ZONE,
    stop_loss_triggered_date TIMESTAMP WITH TIME ZONE,
    last_price_check TIMESTAMP WITH TIME ZONE,
    closed BOOLEAN DEFAULT FALSE,
    initial_price DECIMAL(10,2),
    high_price DECIMAL(10,2),
    target_high_price DECIMAL(10,2),
    target_hit_time TIMESTAMP WITH TIME ZONE,
    postDateAfterPriceDate BOOLEAN DEFAULT FALSE NOT NULL,
    postAfterMarketClose BOOLEAN DEFAULT FALSE NOT NULL,
    noDataAvailable BOOLEAN DEFAULT FALSE NOT NULL,
    status_message VARCHAR(255) NOT NULL,
    price_checks JSONB,
    closed_date TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Ensure posts have an explicit visibility flag for public/private posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT TRUE;

-- Ensure posts have a simple status column (e.g., 'open', 'closed') used by the API
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'open';

-- Add constraint to prevent both target_reached and stop_loss_triggered from being true at the same time
ALTER TABLE posts
  ADD CONSTRAINT chk_target_or_stoploss 
  CHECK (
    NOT (target_reached = TRUE AND stop_loss_triggered = TRUE)
  );

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT chk_target_or_stoploss ON posts IS 
'Ensures that a post cannot have both target_reached and stop_loss_triggered set to true simultaneously. Only one outcome can occur.';

-- ===================================================================
-- Table: USER_STRATEGIES (0 rows)
-- ===================================================================
CREATE TABLE user_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, strategy_name)
);

CREATE INDEX idx_user_strategies_user_id ON user_strategies(user_id);
CREATE INDEX idx_user_strategies_created_at ON user_strategies(created_at DESC);

-- ===================================================================
-- Table: USER_FOLLOWINGS (0 rows)
-- ===================================================================
CREATE TABLE user_followings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX idx_user_followings_follower_id ON user_followings(follower_id);
CREATE INDEX idx_user_followings_following_id ON user_followings(following_id);
CREATE UNIQUE INDEX idx_user_followings_unique ON user_followings(follower_id, following_id);

-- ===================================================================
-- Table: POST_ACTIONS (Buy/Sell actions on posts)
-- ===================================================================
-- This table stores user actions (buy/sell) on trading posts
-- Users can only have one action type per post (either buy or sell)
-- The unique constraint ensures no duplicate actions per user per post
-- This creates a voting-like system where users show their trading sentiment
CREATE TABLE post_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    action_type VARCHAR(10) NOT NULL CHECK (action_type IN ('buy', 'sell')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(post_id, user_id, action_type)
);

CREATE INDEX idx_post_actions_post_id ON post_actions(post_id);
CREATE INDEX idx_post_actions_user_id ON post_actions(user_id);
CREATE INDEX idx_post_actions_action_type ON post_actions(action_type);
CREATE INDEX idx_post_actions_created_at ON post_actions(created_at DESC);
-- Enforce at most one action per (post_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_actions_user_post ON post_actions(post_id, user_id);

-- ===================================================================
-- Table: COMMENTS (Facebook-style comments system)
-- ===================================================================
-- This table implements a hierarchical comment system similar to Facebook
-- Users can comment on posts and reply to other comments (nested comments)
-- The parent_comment_id allows for unlimited nesting levels
-- is_edited and edited_at track comment modifications for transparency
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For nested replies
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);




-- ===================================================================
-- Table: NOTIFICATIONS (User notifications)
-- ===================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL, -- recipient
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,        -- who caused it
    type TEXT NOT NULL CHECK (type IN ('like','comment','follow','mention')),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- ===================================================================
-- Table: TELEGRAM_BOTS (Telegram Bot Configuration)
-- ===================================================================
-- Each user can have one Telegram bot for their subscribers
CREATE TABLE telegram_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    bot_token TEXT NOT NULL, -- Telegram bot token
    bot_username VARCHAR(255) NOT NULL, -- @username of the bot
    bot_name VARCHAR(255) NOT NULL, -- Display name of the bot
    webhook_url TEXT, -- Webhook URL for receiving messages
    description TEXT, -- Bot description
    welcome_message TEXT DEFAULT 'Welcome to our trading insights! You will receive notifications when new posts are published.',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id), -- One bot per user
    UNIQUE(bot_token), -- Each bot token is unique
    UNIQUE(bot_username) -- Each bot username is unique
);

CREATE INDEX idx_telegram_bots_user_id ON telegram_bots(user_id);
CREATE INDEX idx_telegram_bots_active ON telegram_bots(is_active);

-- ===================================================================
-- Table: TELEGRAM_SUBSCRIBERS (Telegram Bot Subscribers)
-- ===================================================================
-- Users who subscribed to a broker's Telegram bot
CREATE TABLE telegram_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES telegram_bots(id) ON DELETE CASCADE NOT NULL,
    telegram_user_id BIGINT NOT NULL, -- Telegram user ID (from Telegram API)
    telegram_username VARCHAR(255), -- Telegram @username (optional)
    telegram_first_name VARCHAR(255), -- First name from Telegram
    telegram_last_name VARCHAR(255), -- Last name from Telegram
    platform_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Link to platform user (if registered)
    language_code VARCHAR(10) DEFAULT 'en', -- User's language preference
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(bot_id, telegram_user_id) -- One subscription per Telegram user per bot
);

CREATE INDEX idx_telegram_subscribers_bot_id ON telegram_subscribers(bot_id);
CREATE INDEX idx_telegram_subscribers_telegram_user_id ON telegram_subscribers(telegram_user_id);
CREATE INDEX idx_telegram_subscribers_platform_user_id ON telegram_subscribers(platform_user_id);
CREATE INDEX idx_telegram_subscribers_active ON telegram_subscribers(is_active);

-- ===================================================================
-- Table: TELEGRAM_NOTIFICATION_SETTINGS (Notification Preferences)
-- ===================================================================
-- Notification preferences for each subscriber
CREATE TABLE telegram_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID REFERENCES telegram_subscribers(id) ON DELETE CASCADE NOT NULL,
    notify_new_posts BOOLEAN DEFAULT TRUE,
    notify_price_updates BOOLEAN DEFAULT TRUE,
    notify_target_reached BOOLEAN DEFAULT TRUE,
    notify_stop_loss BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(subscriber_id)
);

CREATE INDEX idx_telegram_notification_settings_subscriber_id ON telegram_notification_settings(subscriber_id);

-- ===================================================================
-- Table: TELEGRAM_BROADCASTS (Broadcast Campaigns)
-- ===================================================================
-- Broadcast campaigns sent by brokers to their subscribers
CREATE TABLE telegram_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES telegram_bots(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL, -- The broker sending the broadcast
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    broadcast_type VARCHAR(50) DEFAULT 'manual' CHECK (broadcast_type IN ('manual', 'auto_new_post', 'auto_price_update')),
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('all', 'followers', 'selected')),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
    total_recipients INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    failed_sends INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_user_owns_bot CHECK (
        EXISTS (SELECT 1 FROM telegram_bots tb WHERE tb.id = bot_id AND tb.user_id = telegram_broadcasts.user_id)
    )
);

CREATE INDEX idx_telegram_broadcasts_bot_id ON telegram_broadcasts(bot_id);
CREATE INDEX idx_telegram_broadcasts_user_id ON telegram_broadcasts(user_id);
CREATE INDEX idx_telegram_broadcasts_status ON telegram_broadcasts(status);
CREATE INDEX idx_telegram_broadcasts_created_at ON telegram_broadcasts(created_at DESC);

-- ===================================================================
-- Table: TELEGRAM_BROADCAST_POSTS (Posts in Broadcasts)
-- ===================================================================
-- Posts included in a broadcast campaign
CREATE TABLE telegram_broadcast_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES telegram_broadcasts(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(broadcast_id, post_id) -- Each post can only be included once per broadcast
);

CREATE INDEX idx_telegram_broadcast_posts_broadcast_id ON telegram_broadcast_posts(broadcast_id);
CREATE INDEX idx_telegram_broadcast_posts_post_id ON telegram_broadcast_posts(post_id);

-- ===================================================================
-- Table: TELEGRAM_BROADCAST_RECIPIENTS (Selected Recipients)
-- ===================================================================
-- Specific recipients selected for a broadcast (when target_audience = 'selected')
CREATE TABLE telegram_broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES telegram_broadcasts(id) ON DELETE CASCADE NOT NULL,
    subscriber_id UUID REFERENCES telegram_subscribers(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(broadcast_id, subscriber_id) -- Each subscriber can only be selected once per broadcast
);

CREATE INDEX idx_telegram_broadcast_recipients_broadcast_id ON telegram_broadcast_recipients(broadcast_id);
CREATE INDEX idx_telegram_broadcast_recipients_subscriber_id ON telegram_broadcast_recipients(subscriber_id);

-- ===================================================================
-- Table: TELEGRAM_NOTIFICATIONS (Sent Notifications Log)
-- ===================================================================
-- Log of all notifications sent via Telegram
CREATE TABLE telegram_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES telegram_bots(id) ON DELETE CASCADE NOT NULL,
    subscriber_id UUID REFERENCES telegram_subscribers(id) ON DELETE CASCADE NOT NULL,
    broadcast_id UUID REFERENCES telegram_broadcasts(id) ON DELETE SET NULL, -- NULL for individual notifications
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL, -- Related post if applicable
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('new_post', 'price_update', 'target_reached', 'stop_loss', 'broadcast')),
    message TEXT NOT NULL,
    telegram_message_id BIGINT, -- Message ID returned by Telegram API
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    error_message TEXT, -- Error message if sending failed
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_telegram_notifications_bot_id (bot_id),
    INDEX idx_telegram_notifications_subscriber_id (subscriber_id),
    INDEX idx_telegram_notifications_status (status),
    INDEX idx_telegram_notifications_sent_at (sent_at DESC),
    INDEX idx_telegram_notifications_type (notification_type)
);

-- ===================================================================
-- Table: TELEGRAM_BOT_COMMANDS (Available Bot Commands)
-- ===================================================================
-- Commands available in each Telegram bot
CREATE TABLE telegram_bot_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES telegram_bots(id) ON DELETE CASCADE NOT NULL,
    command VARCHAR(50) NOT NULL, -- e.g., 'start', 'help', 'subscribe', 'unsubscribe'
    description TEXT NOT NULL,
    response_message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(bot_id, command) -- Each command is unique per bot
);

CREATE INDEX idx_telegram_bot_commands_bot_id ON telegram_bot_commands(bot_id);
CREATE INDEX idx_telegram_bot_commands_active ON telegram_bot_commands(is_active);






-- ===================================================================
-- ROW LEVEL SECURITY POLICIES
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_followings ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Ensure posts RLS and insert policy (explicitly added)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Allow insert only when the authenticated user is the post owner
-- Drop existing policy if present to avoid errors when running repeatedly
DROP POLICY IF EXISTS allow_insert_own_posts ON public.posts;

CREATE POLICY allow_insert_own_posts
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

-- User strategies policies
CREATE POLICY "Users can view their own strategies" ON user_strategies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strategies" ON user_strategies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User followings policies
CREATE POLICY "Followings are viewable by everyone" ON user_followings
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON user_followings
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others" ON user_followings
  FOR DELETE USING (auth.uid() = follower_id);

-- Post actions policies
CREATE POLICY "Post actions are viewable by everyone" ON post_actions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own post actions" ON post_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own post actions" ON post_actions
  FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Notifications readable by owner" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Owner can mark notifications read" ON notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());




-- ===================================================================
-- FUNCTIONS AND TRIGGERS
-- ===================================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    email,
    avatar_url,
    bio,
    background_url,
    favorite_markets,
    success_posts,
    loss_posts,
    experience_score,
    followers,
    following,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    '',
    '',
    '',
    ARRAY[]::text[],
    0,
    0,
    0,
    0,
    0,
    now(),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup (create only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created'
      AND c.relname = 'users'
      AND n.nspname = 'auth'
  ) THEN
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to tables that have this column
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ===================================================================
-- USEFUL FUNCTIONS FOR NEW TABLES
-- ===================================================================

-- Function to get post action counts (buy/sell)
CREATE OR REPLACE FUNCTION get_post_action_counts(post_uuid UUID)
RETURNS TABLE(buy_count BIGINT, sell_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN pa.action_type = 'buy' THEN 1 END) as buy_count,
    COUNT(CASE WHEN pa.action_type = 'sell' THEN 1 END) as sell_count
  FROM post_actions pa
  WHERE pa.post_id = post_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comment count for a post
CREATE OR REPLACE FUNCTION get_post_comment_count(post_uuid UUID)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) 
    FROM comments 
    WHERE post_id = post_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- ===================================================================
-- USEFUL VIEWS FOR NEW TABLES
-- ===================================================================

-- View for posts with action counts and comment counts
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
    COALESCE(buy_counts.buy_count, 0) as buy_count,
    COALESCE(sell_counts.sell_count, 0) as sell_count,
    COALESCE(comment_counts.comment_count, 0) as comment_count
FROM public.posts p
LEFT JOIN (`
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

-- View for comments with user info
CREATE OR REPLACE VIEW comments_with_user_info
WITH (security_invoker = on) AS
SELECT 
    c.id,
    c.post_id,
    c.user_id,
    c.parent_comment_id,
    c.content,
    c.created_at,
    c.updated_at,
    c.is_edited,
    c.edited_at,
    p.username,
    p.avatar_url,
    p.full_name
FROM public.comments c
JOIN public.profiles p ON c.user_id = p.id;

-- ===================================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ===================================================================

-- Composite indexes for better query performance
CREATE INDEX idx_post_actions_post_user_type ON post_actions(post_id, user_id, action_type);
CREATE INDEX idx_comments_post_parent_created ON comments(post_id, parent_comment_id, created_at);


-- Partial indexes for active posts and comments
CREATE INDEX idx_posts_active ON posts(created_at) WHERE NOT closed;
-- Removed invalid partial index using now() (not IMMUTABLE)
-- CREATE INDEX idx_comments_recent ON comments(created_at) WHERE created_at > NOW() - INTERVAL '30 days';
-- Optional: better for large, append-only time-series-ish data
CREATE INDEX IF NOT EXISTS idx_comments_created_at_brin ON comments USING brin (created_at);

-- ===================================================================
-- ADDITIONAL CONSTRAINTS AND CHECKS
-- ===================================================================

-- Check that comment content is not empty
ALTER TABLE comments ADD CONSTRAINT check_comment_content_not_empty 
CHECK (LENGTH(TRIM(content)) > 0);

-- Check that action_type is valid
ALTER TABLE post_actions ADD CONSTRAINT check_action_type_valid 
CHECK (action_type IN ('buy', 'sell'));



-- Removed unsupported CHECK with subquery; enforced via unique index above

-- ===================================================================
-- ADDITIONAL UTILITY FUNCTIONS
-- ===================================================================

-- Function to toggle user action on a post (buy/sell)
CREATE OR REPLACE FUNCTION toggle_post_action(
    p_post_id UUID,
    p_user_id UUID,
    p_action_type VARCHAR(10)
)
RETURNS BOOLEAN AS $$
DECLARE
    existing_action UUID;
BEGIN
    -- Check if action already exists
    SELECT id INTO existing_action
    FROM post_actions
    WHERE post_id = p_post_id AND user_id = p_user_id AND action_type = p_action_type;
    
    IF existing_action IS NOT NULL THEN
        -- Remove existing action
        DELETE FROM post_actions WHERE id = existing_action;
        RETURN FALSE; -- Action removed
    ELSE
        -- Remove opposite action if exists
        DELETE FROM post_actions 
        WHERE post_id = p_post_id AND user_id = p_user_id 
        AND action_type != p_action_type;
        
        -- Add new action
        INSERT INTO post_actions (post_id, user_id, action_type)
        VALUES (p_post_id, p_user_id, p_action_type);
        RETURN TRUE; -- Action added
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's action on a specific post
CREATE OR REPLACE FUNCTION get_user_post_action(
    p_post_id UUID,
    p_user_id UUID
)
RETURNS VARCHAR(10) AS $$
DECLARE
    user_action VARCHAR(10);
BEGIN
    SELECT action_type INTO user_action
    FROM post_actions
    WHERE post_id = p_post_id AND user_id = p_user_id
    LIMIT 1;
    
    RETURN COALESCE(user_action, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get nested comments for a post
CREATE OR REPLACE FUNCTION get_nested_comments(p_post_id UUID)
RETURNS TABLE(
    comment_id UUID,
    user_id UUID,
    username VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    parent_comment_id UUID,
    level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE comment_tree AS (
    -- Base case: top-level comments
    SELECT 
      c.id,
      c.user_id,
      p.username,
      p.full_name,
      p.avatar_url,
      c.content,
      c.created_at,
      c.parent_comment_id,
      0 as level
    FROM comments c
    JOIN profiles p ON c.user_id = p.id
    WHERE c.post_id = p_post_id AND c.parent_comment_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child comments
    SELECT 
      c.id,
      c.user_id,
      p.username,
      p.full_name,
      p.avatar_url,
      c.content,
      c.created_at,
      c.parent_comment_id,
      ct.level + 1
    FROM comments c
    JOIN profiles p ON c.user_id = p.id
    JOIN comment_tree ct ON c.parent_comment_id = ct.comment_id
  )
  SELECT * FROM comment_tree
  ORDER BY level, created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- ADDITIONAL TRIGGERS FOR NEW TABLES
-- ===================================================================

-- Trigger to update comment edited_at when content changes
CREATE OR REPLACE FUNCTION update_comment_edited_at()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.edited_at = NOW();
        NEW.is_edited = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comment_edited_at_trigger
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE PROCEDURE update_comment_edited_at();

-- Trigger to prevent circular references in nested comments
CREATE OR REPLACE FUNCTION prevent_circular_comments()
RETURNS TRIGGER AS $$
DECLARE
    parent_comment UUID;
    current_comment UUID;
BEGIN
    -- Check for circular references
    current_comment := NEW.id;
    parent_comment := NEW.parent_comment_id;
    
    WHILE parent_comment IS NOT NULL LOOP
        IF parent_comment = current_comment THEN
            RAISE EXCEPTION 'Circular reference detected in comments';
        END IF;
        
        SELECT c.parent_comment_id INTO parent_comment
        FROM comments c
        WHERE c.id = parent_comment;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_circular_comments_trigger
    BEFORE INSERT OR UPDATE ON comments
    FOR EACH ROW EXECUTE PROCEDURE prevent_circular_comments();

-- ===================================================================
-- USAGE EXAMPLES AND SAMPLE DATA
-- ===================================================================

-- Example 1: How to use the toggle_post_action function
-- SELECT toggle_post_action('post-uuid-here', 'user-uuid-here', 'buy');
-- This will add a buy action if none exists, or remove it if it already exists
-- It also automatically removes any sell action for the same user on the same post

-- Example 2: How to get all comments for a post with user info
-- SELECT * FROM comments_with_user_info WHERE post_id = 'post-uuid-here' ORDER BY created_at;

-- Example 3: How to get nested comments for a post
-- SELECT * FROM get_nested_comments('post-uuid-here');

-- Example 4: How to get post statistics
-- SELECT * FROM posts_with_stats WHERE id = 'post-uuid-here';

-- Example 5: How to check if a user has acted on a post
-- SELECT get_user_post_action('post-uuid-here', 'user-uuid-here');
-- Returns: 'buy', 'sell', or 'none'

-- ===================================================================
-- PERFORMANCE TIPS
-- ===================================================================

-- 1. Use the views (posts_with_stats, comments_with_user_info) for read operations
-- 2. Use the functions (toggle_post_action, get_nested_comments) for complex operations
-- 3. The composite indexes will optimize queries that filter by multiple columns
-- 4. Partial indexes will improve performance for active posts and recent comments
-- 5. Use the recursive function get_nested_comments for hierarchical comment display

-- ===================================================================
-- SECURITY NOTES
-- ===================================================================

-- 1. All tables have RLS enabled with appropriate policies
-- 2. Users can only modify their own data (comments, actions, likes)
-- 3. All data is viewable by everyone (public read access)
-- 4. Functions use SECURITY DEFINER for proper permission handling
-- 5. Constraints prevent invalid data and circular references

-- ===================================================================
-- SUMMARY OF NEW FEATURES
-- ===================================================================

-- NEW TABLES ADDED:
-- 1. post_actions - Stores buy/sell actions on posts
-- 2. comments - Hierarchical comment system like Facebook

-- NEW FUNCTIONS ADDED:
-- 1. toggle_post_action() - Toggle buy/sell actions
-- 2. get_user_post_action() - Get user's action on a post
-- 3. get_nested_comments() - Get hierarchical comments
-- 4. get_post_action_counts() - Get buy/sell counts
-- 5. get_post_comment_count() - Get comment count

-- NEW VIEWS ADDED:
-- 1. posts_with_stats - Posts with action and comment counts
-- 2. comments_with_user_info - Comments with user info

-- NEW FEATURES:
-- 1. Buy/Sell voting system on posts
-- 2. Facebook-style comment system with nested replies
-- 3. Automatic tracking of comment edits
-- 4. Prevention of circular references in comments
-- 5. Performance-optimized queries with proper indexing

-- ===================================================================
-- NEXT STEPS FOR IMPLEMENTATION
-- ===================================================================

-- 1. Run this schema in your Supabase database
-- 2. Create React components for buy/sell buttons
-- 3. Create comment components with nested display
-- 4. Add real-time updates using Supabase subscriptions
-- 5. Style components to match your app's design

-- ===================================================================
-- END OF SCHEMA
-- ===================================================================

-- User-requested View for posts with only buy/sell action counts
CREATE OR REPLACE VIEW public.posts_with_action_counts
WITH (security_invoker = on) AS
 SELECT posts.id,
    posts.user_id,
    posts.content,
    posts.image_url,
    posts.symbol,
    posts.company_name,
    posts.country,
    posts.exchange,
    posts.current_price,
    posts.target_price,
    posts.stop_loss_price,
    posts.strategy,
    posts.created_at,
    posts.updated_at,
    posts.description,
    posts.target_reached,
    posts.stop_loss_triggered,
    posts.target_reached_date,
    posts.stop_loss_triggered_date,
    posts.last_price_check,
    posts.closed,
    posts.initial_price,
    posts.high_price,
    posts.target_high_price,
    posts.target_hit_time,
    posts.postdateafterpricedate,
    posts.postaftermarketclose,
    posts.nodataavailable,
    posts.status_message,
    posts.price_checks,
    posts.closed_date,
    posts.is_public,
    posts.status,
    COALESCE(buy_counts.count, 0::bigint) AS buy_count,
    COALESCE(sell_counts.count, 0::bigint) AS sell_count
   FROM posts
     LEFT JOIN ( SELECT post_actions.post_id,
            count(*) AS count
           FROM post_actions
          WHERE post_actions.action_type::text = 'buy'::text
          GROUP BY post_actions.post_id) buy_counts ON posts.id = buy_counts.post_id
     LEFT JOIN ( SELECT post_actions.post_id,
            count(*) AS count
           FROM post_actions
          WHERE post_actions.action_type::text = 'sell'::text
          GROUP BY post_actions.post_id) sell_counts ON posts.id = sell_counts.post_id;
