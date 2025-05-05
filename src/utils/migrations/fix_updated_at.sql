-- Fix updated_at column in profiles table
-- This migration addresses the "null value in column 'updated_at' violates not-null constraint" error

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