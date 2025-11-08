-- Create broker_subscriptions table for tracking user subscriptions to brokers
CREATE TABLE IF NOT EXISTS broker_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Subscription details
  subscription_id TEXT, -- PayPal subscription ID or transaction ID
  plan_type TEXT DEFAULT 'monthly' CHECK (plan_type IN ('monthly', 'yearly', 'lifetime')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, broker_id, status) -- One active subscription per user-broker pair
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_broker_subscriptions_user_id ON broker_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_subscriptions_broker_id ON broker_subscriptions(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_subscriptions_status ON broker_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_broker_subscriptions_expires_at ON broker_subscriptions(expires_at);

-- Enable RLS
ALTER TABLE broker_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON broker_subscriptions;
DROP POLICY IF EXISTS "Brokers can view their subscribers" ON broker_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON broker_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON broker_subscriptions;

-- RLS Policies
CREATE POLICY "Users can view their own subscriptions" ON broker_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Brokers can view their subscribers" ON broker_subscriptions
  FOR SELECT USING (auth.uid() = broker_id);

CREATE POLICY "Users can insert their own subscriptions" ON broker_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON broker_subscriptions
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = broker_id);

-- Function to check if user is subscribed to a broker
CREATE OR REPLACE FUNCTION is_subscribed_to_broker(
  p_user_id UUID,
  p_broker_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM broker_subscriptions
    WHERE user_id = p_user_id
      AND broker_id = p_broker_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_subscribed_to_broker(UUID, UUID) TO authenticated;

-- Function to get broker subscriber count
CREATE OR REPLACE FUNCTION get_broker_subscriber_count(
  p_broker_id UUID
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM broker_subscriptions
    WHERE broker_id = p_broker_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_broker_subscriber_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_broker_subscriber_count(UUID) TO anon;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_broker_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_broker_subscriptions_updated_at ON broker_subscriptions;

CREATE TRIGGER trigger_broker_subscriptions_updated_at
  BEFORE UPDATE ON broker_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_broker_subscriptions_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON broker_subscriptions TO authenticated;

COMMENT ON TABLE broker_subscriptions IS 'User subscriptions to premium broker plans';
COMMENT ON FUNCTION is_subscribed_to_broker(UUID, UUID) IS 'Check if a user is subscribed to a broker';
COMMENT ON FUNCTION get_broker_subscriber_count(UUID) IS 'Get the count of active subscribers for a broker';
