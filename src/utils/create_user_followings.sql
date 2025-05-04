-- Create user_followings table to store following relationships
CREATE TABLE IF NOT EXISTS public.user_followings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- Ensure a user can only follow another user once
  CONSTRAINT unique_following UNIQUE (follower_id, following_id),
  
  -- Prevent users from following themselves
  CONSTRAINT prevent_self_follow CHECK (follower_id <> following_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS user_followings_follower_id_idx ON public.user_followings (follower_id);
CREATE INDEX IF NOT EXISTS user_followings_following_id_idx ON public.user_followings (following_id);

-- Create RLS policies
ALTER TABLE public.user_followings ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see who they follow
CREATE POLICY "Users can see who they follow" ON public.user_followings
  FOR SELECT
  USING (auth.uid() = follower_id);

-- Policy to allow users to follow others
CREATE POLICY "Users can follow others" ON public.user_followings
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Policy to allow users to unfollow others
CREATE POLICY "Users can unfollow others" ON public.user_followings
  FOR DELETE
  USING (auth.uid() = follower_id);

-- Add trigger to update follower count in profiles table
CREATE OR REPLACE FUNCTION update_profile_followers()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET followers = COALESCE(followers, 0) + 1
    WHERE id = NEW.following_id;
    
    UPDATE public.profiles
    SET following = COALESCE(following, 0) + 1
    WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET followers = GREATEST(COALESCE(followers, 0) - 1, 0)
    WHERE id = OLD.following_id;
    
    UPDATE public.profiles
    SET following = GREATEST(COALESCE(following, 0) - 1, 0)
    WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profile_followers_trigger
AFTER INSERT OR DELETE ON public.user_followings
FOR EACH ROW
EXECUTE FUNCTION update_profile_followers();

-- Grant access to authenticated users
GRANT SELECT, INSERT, DELETE ON public.user_followings TO authenticated; 