-- ===================================================================
-- Add PayPal Email and Broker Status to Profiles
-- Allows brokers to receive payments directly through PayPal
-- ===================================================================

-- Add PayPal email field to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_broker BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS broker_plan_description TEXT,
  ADD COLUMN IF NOT EXISTS broker_average_posts_info TEXT,
  ADD COLUMN IF NOT EXISTS broker_price_plan_info TEXT;

-- Add constraints for PayPal email format validation
ALTER TABLE profiles
  ADD CONSTRAINT check_paypal_email_format 
  CHECK (
    (paypal_email IS NULL) OR 
    (paypal_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
  );

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

-- Update RLS policies to allow brokers to update their own broker fields
DROP POLICY IF EXISTS "Users can update own profile broker fields" ON profiles;

CREATE POLICY "Users can update own profile broker fields" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant permissions
GRANT UPDATE ON profiles TO authenticated;

-- Example: Set a user as broker (replace with actual user_id)
-- UPDATE profiles SET is_broker = TRUE WHERE id = 'user_id_here';

-- ===================================================================
-- DONE! PayPal and Broker fields added to profiles
-- ===================================================================
