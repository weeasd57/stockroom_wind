-- Migration to add email column to profiles table
-- This fixes the auth callback error: "ERROR: column profiles.email does not exist"

-- Check if the column already exists before adding it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'email'
  ) THEN
    -- Add the email column to the profiles table
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
    
    -- Copy emails from auth.users to profiles for existing users
    UPDATE public.profiles
    SET email = auth.users.email
    FROM auth.users
    WHERE profiles.id = auth.users.id;
    
    RAISE NOTICE 'Added email column to profiles table and synchronized data';
  ELSE
    RAISE NOTICE 'Email column already exists in profiles table';
  END IF;
END $$;
