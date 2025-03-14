-- Create a stored procedure to set up the schema
CREATE OR REPLACE FUNCTION setup_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Enable UUID extension if not already enabled
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Posts table for storing trading posts
  CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    image_url TEXT,
    symbol TEXT,
    company_name TEXT,
    country TEXT,
    exchange TEXT,
    current_price DECIMAL(10, 2),
    target_price DECIMAL(10, 2),
    stop_loss_price DECIMAL(10, 2),
    strategy TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Create index on user_id for faster queries
  CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);

  -- Create index on created_at for faster sorting
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

  -- Drop the existing view if it exists
  DROP VIEW IF EXISTS post_details;

  -- Create a view that joins posts with user profiles for easier querying
  CREATE VIEW post_details AS
  SELECT 
    p.*,
    pr.username,
    pr.avatar_url AS user_avatar,
    pr.background_url AS user_background
  FROM 
    posts p
  JOIN 
    profiles pr ON p.user_id = pr.id;

  -- RLS Policies for posts table
  ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Anyone can read posts" ON posts;
  DROP POLICY IF EXISTS "Authenticated users can insert posts" ON posts;
  DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
  DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

  -- Anyone can read posts
  CREATE POLICY "Anyone can read posts"
    ON posts FOR SELECT
    USING (true);

  -- Only authenticated users can insert posts
  CREATE POLICY "Authenticated users can insert posts"
    ON posts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  -- Only post owners can update their posts
  CREATE POLICY "Users can update their own posts"
    ON posts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Only post owners can delete their posts
  CREATE POLICY "Users can delete their own posts"
    ON posts FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

  -- User strategies table to store trading strategies for each user
  CREATE TABLE IF NOT EXISTS user_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, strategy_name)
  );

  -- Create index on user_id for faster queries
  CREATE INDEX IF NOT EXISTS idx_user_strategies_user_id ON user_strategies(user_id);

  -- RLS Policies for user_strategies table
  ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can read their own strategies" ON user_strategies;
  DROP POLICY IF EXISTS "Authenticated users can insert strategies" ON user_strategies;
  DROP POLICY IF EXISTS "Users can update their own strategies" ON user_strategies;
  DROP POLICY IF EXISTS "Users can delete their own strategies" ON user_strategies;

  -- Users can read their own strategies
  CREATE POLICY "Users can read their own strategies"
    ON user_strategies FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  -- Authenticated users can insert strategies
  CREATE POLICY "Authenticated users can insert strategies"
    ON user_strategies FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  -- Users can update their own strategies
  CREATE POLICY "Users can update their own strategies"
    ON user_strategies FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Users can delete their own strategies
  CREATE POLICY "Users can delete their own strategies"
    ON user_strategies FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

  -- Add default strategies for all users
  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Swing Trading'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Swing Trading'
    );

  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Day Trading'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Day Trading'
    );

  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Position Trading'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Position Trading'
    );

  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Scalping'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Scalping'
    );

  INSERT INTO user_strategies (user_id, strategy_name)
  SELECT 
    id, 'Trend Following'
  FROM 
    auth.users
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_strategies 
      WHERE user_id = auth.users.id AND strategy_name = 'Trend Following'
    );

END;
$$;
