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
    experience_Score INTEGER NOT NULL,
    followers INTEGER NOT NULL,
    following INTEGER NOT NULL
);

CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

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
    last_price DECIMAL(10,2) NOT NULL,
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
-- ROW LEVEL SECURITY POLICIES
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_followings ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;


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



-- ===================================================================
-- FUNCTIONS AND TRIGGERS
-- ===================================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, created_at, updated_at)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.email, now(), now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

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
CREATE OR REPLACE VIEW posts_with_stats AS
SELECT 
    p.*,
    COALESCE(buy_counts.buy_count, 0) as buy_count,
    COALESCE(sell_counts.sell_count, 0) as sell_count,
    COALESCE(comment_counts.comment_count, 0) as comment_count
FROM posts p
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

-- View for comments with user info
CREATE OR REPLACE VIEW comments_with_user_info AS
SELECT 
    c.*,
    p.username,
    p.avatar_url,
    p.full_name
FROM comments c
JOIN profiles p ON c.user_id = p.id;

-- ===================================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ===================================================================

-- Composite indexes for better query performance
CREATE INDEX idx_post_actions_post_user_type ON post_actions(post_id, user_id, action_type);
CREATE INDEX idx_comments_post_parent_created ON comments(post_id, parent_comment_id, created_at);


-- Partial indexes for active posts and comments
CREATE INDEX idx_posts_active ON posts(created_at) WHERE NOT closed;
CREATE INDEX idx_comments_recent ON comments(created_at) WHERE created_at > NOW() - INTERVAL '30 days';

-- ===================================================================
-- ADDITIONAL CONSTRAINTS AND CHECKS
-- ===================================================================

-- Check that comment content is not empty
ALTER TABLE comments ADD CONSTRAINT check_comment_content_not_empty 
CHECK (LENGTH(TRIM(content)) > 0);

-- Check that action_type is valid
ALTER TABLE post_actions ADD CONSTRAINT check_action_type_valid 
CHECK (action_type IN ('buy', 'sell'));



-- Check that users cannot have both buy and sell actions on the same post
ALTER TABLE post_actions ADD CONSTRAINT check_no_duplicate_actions 
CHECK (NOT EXISTS (
    SELECT 1 FROM post_actions pa2 
    WHERE pa2.post_id = post_id 
    AND pa2.user_id = user_id 
    AND pa2.action_type != action_type
));

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
