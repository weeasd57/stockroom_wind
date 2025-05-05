-- Create a function to alter the profiles table
-- This avoids permission issues when running directly from JavaScript
CREATE OR REPLACE FUNCTION alter_profiles_updated_at_default()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Set default value for updated_at column to NOW()
  ALTER TABLE public.profiles 
  ALTER COLUMN updated_at SET DEFAULT NOW();
  
  -- 2. Update any existing NULL values to match created_at
  UPDATE public.profiles 
  SET updated_at = created_at 
  WHERE updated_at IS NULL;
  
  -- 3. Make updated_at column NOT NULL after fixing existing data
  ALTER TABLE public.profiles 
  ALTER COLUMN updated_at SET NOT NULL;
END;
$$; 