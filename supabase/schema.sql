-- Schema for StockRoom social trading platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set up storage for user avatars and post images
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'post_images') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('post_images', 'post_images', true);
  END IF;
END $$;

-- Create storage policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Avatar images are publicly accessible'
  ) THEN
    CREATE POLICY "Avatar images are publicly accessible" 
      ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Anyone can upload an avatar'
  ) THEN
    CREATE POLICY "Anyone can upload an avatar" 
      ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Users can update their own avatar'
  ) THEN
    CREATE POLICY "Users can update their own avatar" 
      ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Post images are publicly accessible'
  ) THEN
    CREATE POLICY "Post images are publicly accessible" 
      ON storage.objects FOR SELECT USING (bucket_id = 'post_images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload post images'
  ) THEN
    CREATE POLICY "Authenticated users can upload post images" 
      ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post_images' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Create profiles table that extends the auth.users table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  trading_style TEXT,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'professional')),
  favorite_markets TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND schemaname = 'public' 
    AND policyname = 'Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone" 
      ON public.profiles FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND schemaname = 'public' 
    AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile" 
      ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND schemaname = 'public' 
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" 
      ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_urls TEXT[],
  stock_symbols TEXT[],
  chart_data JSONB,
  sentiment TEXT CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create RLS policies for posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'posts' 
    AND schemaname = 'public' 
    AND policyname = 'Posts are viewable by everyone'
  ) THEN
    CREATE POLICY "Posts are viewable by everyone" 
      ON public.posts FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'posts' 
    AND schemaname = 'public' 
    AND policyname = 'Users can create their own posts'
  ) THEN
    CREATE POLICY "Users can create their own posts" 
      ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'posts' 
    AND schemaname = 'public' 
    AND policyname = 'Users can update their own posts'
  ) THEN
    CREATE POLICY "Users can update their own posts" 
      ON public.posts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'posts' 
    AND schemaname = 'public' 
    AND policyname = 'Users can delete their own posts'
  ) THEN
    CREATE POLICY "Users can delete their own posts" 
      ON public.posts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create RLS policies for comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'comments' 
    AND schemaname = 'public' 
    AND policyname = 'Comments are viewable by everyone'
  ) THEN
    CREATE POLICY "Comments are viewable by everyone" 
      ON public.comments FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'comments' 
    AND schemaname = 'public' 
    AND policyname = 'Users can create their own comments'
  ) THEN
    CREATE POLICY "Users can create their own comments" 
      ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'comments' 
    AND schemaname = 'public' 
    AND policyname = 'Users can update their own comments'
  ) THEN
    CREATE POLICY "Users can update their own comments" 
      ON public.comments FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'comments' 
    AND schemaname = 'public' 
    AND policyname = 'Users can delete their own comments'
  ) THEN
    CREATE POLICY "Users can delete their own comments" 
      ON public.comments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT likes_post_or_comment_check CHECK (
    (post_id IS NULL AND comment_id IS NOT NULL) OR
    (post_id IS NOT NULL AND comment_id IS NULL)
  ),
  CONSTRAINT likes_unique_post UNIQUE (post_id, user_id),
  CONSTRAINT likes_unique_comment UNIQUE (comment_id, user_id)
);

-- Create RLS policies for likes
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'likes' 
    AND schemaname = 'public' 
    AND policyname = 'Likes are viewable by everyone'
  ) THEN
    CREATE POLICY "Likes are viewable by everyone" 
      ON public.likes FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'likes' 
    AND schemaname = 'public' 
    AND policyname = 'Users can create their own likes'
  ) THEN
    CREATE POLICY "Users can create their own likes" 
      ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'likes' 
    AND schemaname = 'public' 
    AND policyname = 'Users can delete their own likes'
  ) THEN
    CREATE POLICY "Users can delete their own likes" 
      ON public.likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create followers table
CREATE TABLE IF NOT EXISTS public.followers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT followers_unique UNIQUE (follower_id, following_id),
  CONSTRAINT followers_not_self CHECK (follower_id != following_id)
);

-- Create RLS policies for followers
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'followers' 
    AND schemaname = 'public' 
    AND policyname = 'Follower relationships are viewable by everyone'
  ) THEN
    CREATE POLICY "Follower relationships are viewable by everyone" 
      ON public.followers FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'followers' 
    AND schemaname = 'public' 
    AND policyname = 'Users can create their own follower relationships'
  ) THEN
    CREATE POLICY "Users can create their own follower relationships" 
      ON public.followers FOR INSERT WITH CHECK (auth.uid() = follower_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'followers' 
    AND schemaname = 'public' 
    AND policyname = 'Users can delete their own follower relationships'
  ) THEN
    CREATE POLICY "Users can delete their own follower relationships" 
      ON public.followers FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END $$;

-- Create watchlists table
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT watchlists_unique_name_per_user UNIQUE (user_id, name)
);

-- Create RLS policies for watchlists
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlists' 
    AND schemaname = 'public' 
    AND policyname = 'Public watchlists are viewable by everyone'
  ) THEN
    CREATE POLICY "Public watchlists are viewable by everyone" 
      ON public.watchlists FOR SELECT USING (is_public = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlists' 
    AND schemaname = 'public' 
    AND policyname = 'Private watchlists are viewable by their owners'
  ) THEN
    CREATE POLICY "Private watchlists are viewable by their owners" 
      ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlists' 
    AND schemaname = 'public' 
    AND policyname = 'Users can create their own watchlists'
  ) THEN
    CREATE POLICY "Users can create their own watchlists" 
      ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlists' 
    AND schemaname = 'public' 
    AND policyname = 'Users can update their own watchlists'
  ) THEN
    CREATE POLICY "Users can update their own watchlists" 
      ON public.watchlists FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlists' 
    AND schemaname = 'public' 
    AND policyname = 'Users can delete their own watchlists'
  ) THEN
    CREATE POLICY "Users can delete their own watchlists" 
      ON public.watchlists FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create watchlist_items table
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID REFERENCES public.watchlists(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT watchlist_items_unique_symbol_per_watchlist UNIQUE (watchlist_id, symbol)
);

-- Create RLS policies for watchlist_items
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_items' 
    AND schemaname = 'public' 
    AND policyname = 'Watchlist items are viewable by everyone for public watchlists'
  ) THEN
    CREATE POLICY "Watchlist items are viewable by everyone for public watchlists" 
      ON public.watchlist_items FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM public.watchlists 
          WHERE watchlists.id = watchlist_items.watchlist_id AND watchlists.is_public = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_items' 
    AND schemaname = 'public' 
    AND policyname = 'Watchlist items are viewable by their owners'
  ) THEN
    CREATE POLICY "Watchlist items are viewable by their owners" 
      ON public.watchlist_items FOR SELECT 
      USING (
        EXISTS (
          SELECT 1 FROM public.watchlists 
          WHERE watchlists.id = watchlist_items.watchlist_id AND watchlists.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_items' 
    AND schemaname = 'public' 
    AND policyname = 'Users can create items in their own watchlists'
  ) THEN
    CREATE POLICY "Users can create items in their own watchlists" 
      ON public.watchlist_items FOR INSERT 
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.watchlists 
          WHERE watchlists.id = watchlist_items.watchlist_id AND watchlists.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_items' 
    AND schemaname = 'public' 
    AND policyname = 'Users can update items in their own watchlists'
  ) THEN
    CREATE POLICY "Users can update items in their own watchlists" 
      ON public.watchlist_items FOR UPDATE 
      USING (
        EXISTS (
          SELECT 1 FROM public.watchlists 
          WHERE watchlists.id = watchlist_items.watchlist_id AND watchlists.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_items' 
    AND schemaname = 'public' 
    AND policyname = 'Users can delete items in their own watchlists'
  ) THEN
    CREATE POLICY "Users can delete items in their own watchlists" 
      ON public.watchlist_items FOR DELETE 
      USING (
        EXISTS (
          SELECT 1 FROM public.watchlists 
          WHERE watchlists.id = watchlist_items.watchlist_id AND watchlists.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention')),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create RLS policies for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND schemaname = 'public' 
    AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications" 
      ON public.notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND schemaname = 'public' 
    AND policyname = 'System can create notifications'
  ) THEN
    CREATE POLICY "System can create notifications" 
      ON public.notifications FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND schemaname = 'public' 
    AND policyname = 'Users can mark their notifications as read'
  ) THEN
    CREATE POLICY "Users can mark their notifications as read" 
      ON public.notifications FOR UPDATE 
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create user settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  privacy_level TEXT DEFAULT 'public' CHECK (privacy_level IN ('public', 'followers', 'private')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create RLS policies for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_settings' 
    AND schemaname = 'public' 
    AND policyname = 'Users can view their own settings'
  ) THEN
    CREATE POLICY "Users can view their own settings" 
      ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_settings' 
    AND schemaname = 'public' 
    AND policyname = 'Users can create their own settings'
  ) THEN
    CREATE POLICY "Users can create their own settings" 
      ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_settings' 
    AND schemaname = 'public' 
    AND policyname = 'Users can update their own settings'
  ) THEN
    CREATE POLICY "Users can update their own settings" 
      ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create function to create a profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, avatar_url, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'preferred_username', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'full_name'
  );
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create function to handle likes and create notifications
CREATE OR REPLACE FUNCTION public.handle_new_like() 
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  comment_owner_id UUID;
BEGIN
  -- Create notification for post like
  IF NEW.post_id IS NOT NULL THEN
    SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- Only create notification if the like is not from the post owner
    IF post_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, type, post_id)
      VALUES (post_owner_id, NEW.user_id, 'like', NEW.post_id);
    END IF;
  END IF;
  
  -- Create notification for comment like
  IF NEW.comment_id IS NOT NULL THEN
    SELECT user_id INTO comment_owner_id FROM public.comments WHERE id = NEW.comment_id;
    
    -- Only create notification if the like is not from the comment owner
    IF comment_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, type, comment_id)
      VALUES (comment_owner_id, NEW.user_id, 'like', NEW.comment_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a like is created
DROP TRIGGER IF EXISTS on_like_created ON public.likes;
CREATE TRIGGER on_like_created
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_like();

-- Create function to handle new comments and create notifications
CREATE OR REPLACE FUNCTION public.handle_new_comment() 
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
BEGIN
  -- Get the post owner
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
  
  -- Only create notification if the comment is not from the post owner
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id, comment_id)
    VALUES (post_owner_id, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a comment is created
DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment();

-- Create function to handle new followers and create notifications
CREATE OR REPLACE FUNCTION public.handle_new_follower() 
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for the user being followed
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a follower relationship is created
DROP TRIGGER IF EXISTS on_follower_created ON public.followers;
CREATE TRIGGER on_follower_created
  AFTER INSERT ON public.followers
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_follower();

-- Create views for common queries

-- View for post details with user info and counts
CREATE OR REPLACE VIEW public.post_details AS
SELECT 
  p.id,
  p.content,
  p.image_urls,
  p.stock_symbols,
  p.chart_data,
  p.sentiment,
  p.created_at,
  p.updated_at,
  p.user_id,
  pr.username,
  pr.avatar_url,
  pr.full_name,
  (SELECT COUNT(*) FROM public.comments WHERE post_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM public.likes WHERE post_id = p.id) AS like_count
FROM 
  public.posts p
JOIN 
  public.profiles pr ON p.user_id = pr.id;

-- View for user profile with follower/following counts
CREATE OR REPLACE VIEW public.profile_details AS
SELECT 
  p.id,
  p.username,
  p.full_name,
  p.avatar_url,
  p.bio,
  p.website,
  p.trading_style,
  p.experience_level,
  p.favorite_markets,
  p.created_at,
  (SELECT COUNT(*) FROM public.followers WHERE following_id = p.id) AS follower_count,
  (SELECT COUNT(*) FROM public.followers WHERE follower_id = p.id) AS following_count,
  (SELECT COUNT(*) FROM public.posts WHERE user_id = p.id) AS post_count
FROM 
  public.profiles p;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_stock_symbols ON public.posts USING GIN(stock_symbols);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);

CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_comment_id ON public.likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON public.followers(following_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
