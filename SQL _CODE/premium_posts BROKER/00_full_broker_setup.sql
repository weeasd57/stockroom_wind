-- ===================================================================
-- FULL BROKER SETUP - Complete Migration Script
-- Run this ONCE in Supabase SQL Editor
-- ===================================================================

-- ===================================================================
-- PART 1: Add Columns to Profiles
-- ===================================================================

-- Add PayPal email field to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_broker BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS broker_plan_description TEXT,
  ADD COLUMN IF NOT EXISTS broker_average_posts_info TEXT,
  ADD COLUMN IF NOT EXISTS broker_price_plan_info TEXT;

-- Add constraints for PayPal email format validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_paypal_email_format'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT check_paypal_email_format 
      CHECK (
        (paypal_email IS NULL) OR 
        (paypal_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
      );
  END IF;
END $$;

-- Add index for broker queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_broker 
  ON profiles(is_broker) WHERE is_broker = TRUE;

-- Add index for PayPal email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_paypal_email 
  ON profiles(paypal_email) WHERE paypal_email IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.paypal_email IS 
  'Broker PayPal email for receiving subscription payments from users';
  
COMMENT ON COLUMN profiles.is_broker IS 
  'TRUE if user is a broker who can create premium plans';
  
COMMENT ON COLUMN profiles.broker_plan_description IS 
  'Description of broker premium plan (e.g., "Professional stock analysis and signals")';
  
COMMENT ON COLUMN profiles.broker_average_posts_info IS 
  'Information about average posting frequency (e.g., "5-10 posts per week")';
  
COMMENT ON COLUMN profiles.broker_price_plan_info IS 
  'Information about pricing and included features';

-- Update RLS policies
DROP POLICY IF EXISTS "Users can update own profile broker fields" ON profiles;

CREATE POLICY "Users can update own profile broker fields" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant permissions
GRANT UPDATE ON profiles TO authenticated;

-- ===================================================================
-- PART 2: Sync Existing Data
-- ===================================================================

-- Step 1: Update profiles.paypal_email from paypal_accounts
UPDATE profiles p
SET paypal_email = pa.email
FROM paypal_accounts pa
WHERE p.id = pa.user_id
  AND pa.verification_status = 'verified'
  AND (p.paypal_email IS NULL OR p.paypal_email = '');

-- Step 2: Set is_broker = TRUE for users with premium_plans
UPDATE profiles p
SET is_broker = TRUE
FROM premium_plans pp
WHERE p.id = pp.user_id
  AND (p.is_broker IS NULL OR p.is_broker = FALSE);

-- Step 3: Sync broker plan descriptions from premium_plans
UPDATE profiles p
SET 
  broker_plan_description = pp.description,
  broker_average_posts_info = CONCAT('Average ', 
    COALESCE((pp.stats->>'averagePostsPerMonth')::TEXT, '0'), 
    ' posts per month'),
  broker_price_plan_info = CONCAT('$', 
    COALESCE((pp.pricing->>'monthly')::TEXT, '0'), 
    '/month or $', 
    COALESCE((pp.pricing->>'yearly')::TEXT, '0'), 
    '/year')
FROM premium_plans pp
WHERE p.id = pp.user_id;

-- Step 4: Update premium_plans.paypal_account from paypal_accounts
UPDATE premium_plans pp
SET paypal_account = pa.email
FROM paypal_accounts pa
WHERE pp.user_id = pa.user_id
  AND pa.verification_status = 'verified'
  AND (pp.paypal_account IS NULL OR pp.paypal_account = '');

-- ===================================================================
-- PART 3: Verification Query
-- ===================================================================

SELECT 
  '✅ Broker Setup Complete!' as status,
  COUNT(*) as total_brokers
FROM profiles
WHERE is_broker = TRUE;

SELECT 
  p.id,
  p.username,
  p.is_broker,
  p.paypal_email,
  pp.paypal_account as premium_plan_paypal,
  pa.email as paypal_accounts_email,
  LEFT(p.broker_plan_description, 50) as description_preview,
  p.broker_price_plan_info
FROM profiles p
LEFT JOIN premium_plans pp ON p.id = pp.user_id
LEFT JOIN paypal_accounts pa ON p.id = pa.user_id
WHERE p.is_broker = TRUE
ORDER BY p.username;

-- ===================================================================
-- DONE! Full Broker Setup Complete
-- ===================================================================
