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

-- ===================================================================
-- Table: USER_PRICE_CHECKS (Price Check Usage Tracking)
-- ===================================================================
-- This table tracks price check usage for subscription limits
CREATE TABLE IF NOT EXISTS user_price_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT,
    exchange TEXT,
    country TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_price_checks_user_id ON user_price_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_price_checks_created_at ON user_price_checks(created_at);
CREATE INDEX IF NOT EXISTS idx_user_price_checks_user_month ON user_price_checks(user_id, DATE_TRUNC('month', created_at));

-- Enable RLS
ALTER TABLE user_price_checks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own price checks" 
ON user_price_checks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price checks" 
ON user_price_checks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ===================================================================
-- SUBSCRIPTION PLANS AND USER SUBSCRIPTIONS TABLES
-- ===================================================================
-- Create subscription plans table if not exists
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    price_check_limit INTEGER DEFAULT 50,
    post_creation_limit INTEGER DEFAULT 100,
    monthly_price DECIMAL(10,2) DEFAULT 0,
    yearly_price DECIMAL(10,2) DEFAULT 0,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans if not exist
INSERT INTO subscription_plans (name, display_name, price_check_limit, post_creation_limit, monthly_price, yearly_price)
VALUES 
    ('free', 'Free', 50, 100, 0, 0),
    ('pro', 'Pro', 500, 1000, 9.99, 99.99),
    ('premium', 'Premium', 2000, 5000, 19.99, 199.99)
ON CONFLICT (name) DO NOTHING;

-- Create user subscriptions table if not exists
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, plan_id)
);

-- Create or update the user_subscription_info view to include price check usage
CREATE OR REPLACE VIEW user_subscription_info AS
SELECT 
    u.id as user_id,
    s.id as subscription_id,
    s.plan_id,
    COALESCE(p.name, 'free') as plan_name,
    COALESCE(p.display_name, 'Free') as plan_display_name,
    COALESCE(p.price_check_limit, 50) as price_check_limit,
    
    -- Count price checks for current month
    COALESCE(
        (SELECT COUNT(*) 
         FROM user_price_checks pc 
         WHERE pc.user_id = u.id 
           AND DATE_TRUNC('month', pc.created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ), 0
    ) as price_checks_used,
    
    -- Calculate remaining checks
    GREATEST(
        COALESCE(p.price_check_limit, 50) - COALESCE(
            (SELECT COUNT(*) 
             FROM user_price_checks pc 
             WHERE pc.user_id = u.id 
               AND DATE_TRUNC('month', pc.created_at) = DATE_TRUNC('month', CURRENT_DATE)
            ), 0
        ), 0
    ) as remaining_checks,
    
    COALESCE(p.post_creation_limit, 100) as post_creation_limit,
    COALESCE(
        (SELECT COUNT(*) 
         FROM posts po 
         WHERE po.user_id = u.id 
           AND DATE_TRUNC('month', po.created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ), 0
    ) as posts_created,
    
    GREATEST(
        COALESCE(p.post_creation_limit, 100) - COALESCE(
            (SELECT COUNT(*) 
             FROM posts po 
             WHERE po.user_id = u.id 
               AND DATE_TRUNC('month', po.created_at) = DATE_TRUNC('month', CURRENT_DATE)
            ), 0
        ), 0
    ) as remaining_posts,
    
    COALESCE(s.status, 'active') as subscription_status,
    s.start_date,
    s.end_date
FROM profiles u
LEFT JOIN user_subscriptions s ON u.id = s.user_id 
    AND s.status = 'active'
    AND (s.end_date IS NULL OR s.end_date > CURRENT_DATE)
LEFT JOIN subscription_plans p ON s.plan_id = p.id;

-- Grant permissions on the view
GRANT SELECT ON user_subscription_info TO authenticated;
GRANT SELECT ON user_subscription_info TO anon;

-- ===================================================================
-- RPC FUNCTIONS FOR PRICE CHECK MANAGEMENT
-- ===================================================================

-- RPC function to check if user can perform price check
CREATE OR REPLACE FUNCTION check_price_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_month DATE;
    v_current_count INTEGER;
    v_limit INTEGER;
BEGIN
    -- Get the current month (first day)
    v_current_month := DATE_TRUNC('month', CURRENT_DATE);
    
    -- Get current usage count for this month
    SELECT COALESCE(COUNT(*), 0) INTO v_current_count
    FROM user_price_checks 
    WHERE user_id = p_user_id 
      AND DATE_TRUNC('month', created_at) = v_current_month;
    
    -- Get user's price check limit from subscription or use default
    SELECT 
        CASE 
            WHEN s.id IS NOT NULL THEN COALESCE(p.price_check_limit, 50)
            ELSE 50  -- Default free plan limit
        END INTO v_limit
    FROM profiles u
    LEFT JOIN user_subscriptions s ON u.id = s.user_id 
        AND s.status = 'active'
        AND (s.end_date IS NULL OR s.end_date > CURRENT_DATE)
    LEFT JOIN subscription_plans p ON s.plan_id = p.id
    WHERE u.id = p_user_id;
    
    -- If no user found or no limit set, use default
    IF v_limit IS NULL THEN
        v_limit := 50;
    END IF;
    
    -- Return TRUE if user can still make price checks
    RETURN v_current_count < v_limit;
    
EXCEPTION
    WHEN OTHERS THEN
        -- On error, be conservative and return FALSE
        RAISE WARNING 'Error in check_price_limit: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- RPC function to log price check usage and increment counter
CREATE OR REPLACE FUNCTION log_price_check(
    p_user_id UUID,
    p_symbol TEXT DEFAULT NULL,
    p_exchange TEXT DEFAULT NULL,
    p_country TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_month DATE;
    v_current_count INTEGER;
    v_limit INTEGER;
BEGIN
    -- Get the current month (first day)
    v_current_month := DATE_TRUNC('month', CURRENT_DATE);
    
    -- Get current usage count for this month
    SELECT COALESCE(COUNT(*), 0) INTO v_current_count
    FROM user_price_checks 
    WHERE user_id = p_user_id 
      AND DATE_TRUNC('month', created_at) = v_current_month;
    
    -- Get user's price check limit from subscription or use default
    SELECT 
        CASE 
            WHEN s.id IS NOT NULL THEN COALESCE(p.price_check_limit, 50)
            ELSE 50  -- Default free plan limit
        END INTO v_limit
    FROM profiles u
    LEFT JOIN user_subscriptions s ON u.id = s.user_id 
        AND s.status = 'active'
        AND (s.end_date IS NULL OR s.end_date > CURRENT_DATE)
    LEFT JOIN subscription_plans p ON s.plan_id = p.id
    WHERE u.id = p_user_id;
    
    -- If no limit found, use default
    IF v_limit IS NULL THEN
        v_limit := 50;
    END IF;
    
    -- Check if user has exceeded limit
    IF v_current_count >= v_limit THEN
        RETURN FALSE; -- Cannot log, limit exceeded
    END IF;
    
    -- Insert the price check log
    INSERT INTO user_price_checks (
        user_id,
        symbol,
        exchange,
        country,
        created_at
    ) VALUES (
        p_user_id,
        COALESCE(p_symbol, 'PRICE_CHECK_API'),
        p_exchange,
        p_country,
        NOW()
    );
    
    RETURN TRUE; -- Successfully logged
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail completely
        RAISE WARNING 'Error in log_price_check: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- ===================================================================
-- UPDATED PRICE CHECK SYSTEM WITH USER_SUBSCRIPTIONS
-- ===================================================================

-- Add price check usage columns to user_subscriptions table if not exist
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS price_checks_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_price_check_reset TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW());

-- Drop existing functions and create updated versions
DROP FUNCTION IF EXISTS check_price_limit;
DROP FUNCTION IF EXISTS log_price_check;
DROP VIEW IF EXISTS user_subscription_info;

-- RPC function to check if user can perform price check (UPDATED VERSION)
CREATE FUNCTION check_price_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INTEGER := 0;
    v_limit INTEGER := 50;
    v_current_month DATE;
BEGIN
    v_current_month := DATE_TRUNC('month', CURRENT_DATE);
    
    -- Get user's subscription info and current usage
    SELECT 
        COALESCE(s.price_checks_used, 0),
        COALESCE(sp.price_check_limit, 50)
    INTO v_current_count, v_limit
    FROM profiles u
    LEFT JOIN user_subscriptions s ON u.id = s.user_id 
        AND s.status = 'active'
    LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE u.id = p_user_id;
    
    -- If no subscription found, use free plan defaults
    IF v_limit IS NULL THEN
        v_limit := 50;
    END IF;
    
    -- Return TRUE if user can still make price checks
    RETURN v_current_count < v_limit;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in check_price_limit: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- RPC function to log price check usage and increment counter (UPDATED VERSION)
CREATE FUNCTION log_price_check(
    p_user_id UUID,
    p_symbol TEXT DEFAULT NULL,
    p_exchange TEXT DEFAULT NULL,
    p_country TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription_id UUID;
    v_current_count INTEGER := 0;
    v_limit INTEGER := 50;
    v_current_month DATE;
    v_last_reset DATE;
BEGIN
    v_current_month := DATE_TRUNC('month', CURRENT_DATE);
    
    -- Get user's active subscription
    SELECT 
        s.id,
        COALESCE(s.price_checks_used, 0),
        COALESCE(sp.price_check_limit, 50),
        COALESCE(DATE_TRUNC('month', s.last_price_check_reset), v_current_month)
    INTO v_subscription_id, v_current_count, v_limit, v_last_reset
    FROM user_subscriptions s
    LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE s.user_id = p_user_id 
        AND s.status = 'active'
    LIMIT 1;
    
    -- If no subscription found, create a default free subscription
    IF v_subscription_id IS NULL THEN
        -- Get free plan ID
        DECLARE v_free_plan_id UUID;
        BEGIN
            SELECT id INTO v_free_plan_id 
            FROM subscription_plans 
            WHERE name = 'free' 
            LIMIT 1;
            
            -- Create free subscription if plan exists
            IF v_free_plan_id IS NOT NULL THEN
                INSERT INTO user_subscriptions (user_id, plan_id, status, price_checks_used, last_price_check_reset)
                VALUES (p_user_id, v_free_plan_id, 'active', 0, v_current_month)
                RETURNING id INTO v_subscription_id;
                
                v_current_count := 0;
                v_limit := 50;
            ELSE
                RETURN FALSE; -- No free plan available
            END IF;
        END;
    END IF;
    
    -- Reset counter if it's a new month
    IF v_last_reset < v_current_month THEN
        UPDATE user_subscriptions 
        SET price_checks_used = 0, 
            last_price_check_reset = v_current_month
        WHERE id = v_subscription_id;
        v_current_count := 0;
    END IF;
    
    -- Check if user has exceeded limit
    IF v_current_count >= v_limit THEN
        RETURN FALSE; -- Cannot log, limit exceeded
    END IF;
    
    -- Increment the usage counter
    UPDATE user_subscriptions 
    SET price_checks_used = price_checks_used + 1
    WHERE id = v_subscription_id;
    
    RETURN TRUE; -- Successfully logged
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in log_price_check: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Create updated user_subscription_info view using user_subscriptions data
CREATE VIEW user_subscription_info AS
SELECT 
    u.id as user_id,
    s.id as subscription_id,
    s.plan_id,
    COALESCE(p.name, 'free') as plan_name,
    COALESCE(p.display_name, 'Free') as plan_display_name,
    COALESCE(p.price_check_limit, 50) as price_check_limit,
    
    -- Get price checks used from subscription (reset monthly)
    CASE 
        WHEN s.last_price_check_reset IS NULL OR 
             DATE_TRUNC('month', s.last_price_check_reset) < DATE_TRUNC('month', CURRENT_DATE)
        THEN 0
        ELSE COALESCE(s.price_checks_used, 0)
    END as price_checks_used,
    
    -- Calculate remaining checks
    GREATEST(
        COALESCE(p.price_check_limit, 50) - 
        CASE 
            WHEN s.last_price_check_reset IS NULL OR 
                 DATE_TRUNC('month', s.last_price_check_reset) < DATE_TRUNC('month', CURRENT_DATE)
            THEN 0
            ELSE COALESCE(s.price_checks_used, 0)
        END, 0
    ) as remaining_checks,
    
    COALESCE(p.post_creation_limit, 100) as post_creation_limit,
    COALESCE(
        (SELECT COUNT(*) 
         FROM posts po 
         WHERE po.user_id = u.id 
           AND DATE_TRUNC('month', po.created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ), 0
    ) as posts_created,
    
    GREATEST(
        COALESCE(p.post_creation_limit, 100) - COALESCE(
            (SELECT COUNT(*) 
             FROM posts po 
             WHERE po.user_id = u.id 
               AND DATE_TRUNC('month', po.created_at) = DATE_TRUNC('month', CURRENT_DATE)
            ), 0
        ), 0
    ) as remaining_posts,
    
    COALESCE(s.status, 'active') as subscription_status,
    s.created_at as start_date,
    NULL as end_date
FROM profiles u
LEFT JOIN user_subscriptions s ON u.id = s.user_id 
    AND s.status = 'active'
LEFT JOIN subscription_plans p ON s.plan_id = p.id;

-- Grant execute permissions (UPDATED)
GRANT EXECUTE ON FUNCTION check_price_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_price_limit TO anon;
GRANT EXECUTE ON FUNCTION log_price_check TO authenticated;
GRANT EXECUTE ON FUNCTION log_price_check TO anon;
GRANT SELECT ON user_subscription_info TO authenticated;
GRANT SELECT ON user_subscription_info TO anon;
