-- Update user_strategies table to add image support
-- This script adds the image_url column to store strategy images

-- Add image_url column to user_strategies table
ALTER TABLE user_strategies 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update the table comment to reflect the new schema
COMMENT ON TABLE user_strategies IS 'User-defined trading strategies with optional images';
COMMENT ON COLUMN user_strategies.image_url IS 'URL to strategy image stored in Supabase Storage';

-- Create index on user_id and strategy_name for better performance
CREATE INDEX IF NOT EXISTS idx_user_strategies_user_strategy 
ON user_strategies(user_id, strategy_name);

-- Create index on user_id for better performance when fetching user strategies
CREATE INDEX IF NOT EXISTS idx_user_strategies_user_id 
ON user_strategies(user_id);

-- Enable RLS (Row Level Security) if not already enabled
ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_strategies table
-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view own strategies" ON user_strategies;
DROP POLICY IF EXISTS "Users can insert own strategies" ON user_strategies;
DROP POLICY IF EXISTS "Users can update own strategies" ON user_strategies;
DROP POLICY IF EXISTS "Users can delete own strategies" ON user_strategies;

-- Policy: Users can only see their own strategies
CREATE POLICY "Users can view own strategies" ON user_strategies
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own strategies
CREATE POLICY "Users can insert own strategies" ON user_strategies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own strategies
CREATE POLICY "Users can update own strategies" ON user_strategies
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can only delete their own strategies
CREATE POLICY "Users can delete own strategies" ON user_strategies
    FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for strategy images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'strategy-images',
  'strategy-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for strategy-images bucket
-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can upload strategy images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view strategy images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own strategy images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own strategy images" ON storage.objects;

-- Policy: Users can upload their own strategy images
CREATE POLICY "Users can upload strategy images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'strategy-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Anyone can view strategy images (public bucket)
CREATE POLICY "Anyone can view strategy images" ON storage.objects
    FOR SELECT USING (bucket_id = 'strategy-images');

-- Policy: Users can update their own strategy images
CREATE POLICY "Users can update own strategy images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'strategy-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policy: Users can delete their own strategy images
CREATE POLICY "Users can delete own strategy images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'strategy-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Show current schema for verification

-- Sample query to test the updated schema
-- SELECT id, user_id, strategy_name, description, image_url, created_at, updated_at 
-- FROM user_strategies 
-- WHERE user_id = auth.uid() 
-- ORDER BY created_at DESC;
