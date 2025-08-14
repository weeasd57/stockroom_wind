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
-- ROW LEVEL SECURITY POLICIES
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_followings ENABLE ROW LEVEL SECURITY;

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
