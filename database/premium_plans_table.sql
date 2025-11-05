-- Create premium_plans table for storing premium plan configurations
CREATE TABLE IF NOT EXISTS premium_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Plan details
  description TEXT DEFAULT '',
  features JSONB DEFAULT '[]'::jsonb,
  
  -- Pricing information
  pricing JSONB DEFAULT '{"monthly": 0, "yearly": 0, "currency": "USD"}'::jsonb,
  
  -- Stats (calculated from other tables)
  stats JSONB DEFAULT '{"averagePostsPerMonth": 0, "successRate": 0, "totalSubscribers": 0, "premiumSubscribers": 0}'::jsonb,
  
  -- Payment info
  paypal_account_id UUID,
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id)
);

-- Create paypal_accounts table for storing verified PayPal account information
CREATE TABLE IF NOT EXISTS paypal_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- PayPal account details
  email TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  account_type TEXT DEFAULT 'personal',
  environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'live')),
  
  -- Verification status
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- OAuth tokens (encrypt in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id),
  UNIQUE(email, environment),
  UNIQUE(merchant_id, environment)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_premium_plans_user_id ON premium_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_plans_is_active ON premium_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_premium_plans_created_at ON premium_plans(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE premium_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own premium plans" ON premium_plans;
DROP POLICY IF EXISTS "Users can insert their own premium plans" ON premium_plans;
DROP POLICY IF EXISTS "Users can update their own premium plans" ON premium_plans;
DROP POLICY IF EXISTS "Users can delete their own premium plans" ON premium_plans;

-- Create RLS policies
CREATE POLICY "Users can view their own premium plans" ON premium_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own premium plans" ON premium_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own premium plans" ON premium_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own premium plans" ON premium_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_premium_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_premium_plans_updated_at ON premium_plans;

-- Create trigger for updated_at
CREATE TRIGGER trigger_premium_plans_updated_at
  BEFORE UPDATE ON premium_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_premium_plans_updated_at();

-- Grant necessary permissions
GRANT ALL ON premium_plans TO authenticated;

-- PayPal Accounts RLS
ALTER TABLE paypal_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing PayPal policies if they exist
DROP POLICY IF EXISTS "Users can view their own paypal accounts" ON paypal_accounts;
DROP POLICY IF EXISTS "Users can insert their own paypal accounts" ON paypal_accounts;
DROP POLICY IF EXISTS "Users can update their own paypal accounts" ON paypal_accounts;
DROP POLICY IF EXISTS "Users can delete their own paypal accounts" ON paypal_accounts;

-- Create PayPal RLS policies
CREATE POLICY "Users can view their own paypal accounts" ON paypal_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own paypal accounts" ON paypal_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own paypal accounts" ON paypal_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own paypal accounts" ON paypal_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions for PayPal accounts
GRANT ALL ON paypal_accounts TO authenticated;

-- Create view for premium plans with calculated stats
CREATE OR REPLACE VIEW premium_plans_with_stats AS
SELECT 
  pp.*,
  -- Calculate stats from posts
  COALESCE(ps.total_posts, 0) as total_posts,
  COALESCE(ps.successful_posts, 0) as successful_posts,
  COALESCE(ps.avg_posts_per_month, 0) as avg_posts_per_month,
  CASE 
    WHEN ps.total_posts > 0 THEN ROUND((ps.successful_posts::numeric / ps.total_posts::numeric) * 100, 2)
    ELSE 0 
  END as calculated_success_rate,
  
  -- Calculate subscriber stats
  COALESCE(ts.total_subscribers, 0) as total_telegram_subscribers,
  COALESCE(ts.premium_subscribers, 0) as premium_telegram_subscribers
  
FROM premium_plans pp

-- Join with posts stats
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE target_reached = true) as successful_posts,
    ROUND((COUNT(*)::numeric / 12), 2) as avg_posts_per_month
  FROM posts_with_stats 
  WHERE created_at >= NOW() - INTERVAL '12 months'
  GROUP BY user_id
) ps ON pp.user_id = ps.user_id

-- Join with telegram subscriber stats (placeholder - will be updated when telegram tables exist)
LEFT JOIN (
  SELECT 
    pp.user_id,
    0 as total_subscribers,
    0 as premium_subscribers
  FROM premium_plans pp
  WHERE false -- This ensures no rows are returned, just structure
) ts ON pp.user_id = ts.user_id;

-- Grant access to the view
GRANT SELECT ON premium_plans_with_stats TO authenticated;

-- Create RLS policy for the view
ALTER VIEW premium_plans_with_stats SET (security_invoker = true);

COMMENT ON TABLE premium_plans IS 'Premium plan configurations for users offering paid subscriptions';
COMMENT ON VIEW premium_plans_with_stats IS 'Premium plans with calculated statistics from posts and telegram subscribers';
