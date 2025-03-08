-- Comprehensive fix for profiles table issues

-- 1. First, check if the last_sign_in column exists and add it if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'last_sign_in'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_sign_in TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added last_sign_in column to profiles table';
  ELSE
    RAISE NOTICE 'last_sign_in column already exists in profiles table';
  END IF;
END $$;

-- 2. Update any auth triggers to make them more robust
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    email, 
    avatar_url, 
    full_name,
    last_sign_in
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'preferred_username', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'full_name',
    NOW()
  );
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Make sure all existing users have a last_sign_in value
UPDATE public.profiles 
SET last_sign_in = NOW() 
WHERE last_sign_in IS NULL;

-- 4. Add an auth function to update last_sign_in on login (optional)
CREATE OR REPLACE FUNCTION public.handle_auth_sign_in()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_sign_in = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
