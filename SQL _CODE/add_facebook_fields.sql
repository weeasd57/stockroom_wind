-- Add Facebook fields to profiles table
-- Run this in your Supabase SQL editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS show_facebook BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN profiles.facebook_url IS 'Facebook profile URL for the user';
COMMENT ON COLUMN profiles.show_facebook IS 'Whether to display Facebook icon on profile page';