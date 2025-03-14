-- Fix profiles table in Supabase
-- 1. Drop dependent views first
-- 2. Remove trading_style column
-- 3. Add success_posts, loss_posts, and background_url columns
-- 4. Recreate views

-- First, drop the views that depend on the profiles table
DROP VIEW IF EXISTS public.profile_details;
DROP VIEW IF EXISTS public.post_details;
DROP VIEW IF EXISTS public.comment_details;

-- Now we can alter the profiles table to add the new columns and drop the trading_style column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS background_url TEXT,
ADD COLUMN IF NOT EXISTS success_posts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loss_posts INTEGER DEFAULT 0;

-- Then, drop the trading_style column
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS trading_style;

-- Recreate the profile_details view
CREATE OR REPLACE VIEW public.profile_details AS
SELECT 
  p.id,
  p.username,
  p.avatar_url,
  p.background_url,
  p.bio,
  p.experience_level,
  p.success_posts,
  p.loss_posts,
  COUNT(DISTINCT followers.id) AS followers_count,
  COUNT(DISTINCT following.id) AS following_count,
  COUNT(DISTINCT posts.id) AS posts_count
FROM 
  public.profiles p
LEFT JOIN public.followers followers ON p.id = followers.following_id
LEFT JOIN public.followers following ON p.id = following.follower_id
LEFT JOIN public.posts posts ON p.id = posts.user_id
GROUP BY p.id;

-- Recreate the post_details view
CREATE OR REPLACE VIEW public.post_details AS
SELECT 
  p.id,
  p.created_at,
  p.content,
  p.image_urls,
  p.stock_symbols,
  p.chart_data,
  p.sentiment,
  p.user_id,
  p.updated_at,
  pr.username,
  pr.avatar_url,
  pr.experience_level,
  COUNT(DISTINCT c.id) AS comments_count,
  COUNT(DISTINCT l.id) AS likes_count
FROM 
  public.posts p
LEFT JOIN public.profiles pr ON p.user_id = pr.id
LEFT JOIN public.comments c ON p.id = c.post_id
LEFT JOIN public.likes l ON p.id = l.post_id
GROUP BY p.id, pr.username, pr.avatar_url, pr.experience_level;

-- Recreate the comment_details view
CREATE OR REPLACE VIEW public.comment_details AS
SELECT 
  c.id,
  c.created_at,
  c.content,
  c.user_id,
  c.post_id,
  pr.username,
  pr.avatar_url,
  COUNT(DISTINCT l.id) AS likes_count
FROM 
  public.comments c
LEFT JOIN public.profiles pr ON c.user_id = pr.id
LEFT JOIN public.likes l ON c.id = l.comment_id
GROUP BY c.id, pr.username, pr.avatar_url;
