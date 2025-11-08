-- Create webhook_notifications table for PayPal webhook notifications
CREATE TABLE IF NOT EXISTS webhook_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Webhook details
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  
  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- PayPal data
  paypal_data JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'error')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Indexes
  CONSTRAINT unique_event_per_user UNIQUE(user_id, event_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_user_id ON webhook_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_created_at ON webhook_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_is_read ON webhook_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_webhook_notifications_event_type ON webhook_notifications(event_type);

-- Enable RLS (Row Level Security)
ALTER TABLE webhook_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications" ON webhook_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON webhook_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can insert notifications (for webhook processing)
CREATE POLICY "Service can insert notifications" ON webhook_notifications
  FOR INSERT WITH CHECK (true);

-- Create function to update read_at timestamp
CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  ELSIF NEW.is_read = false THEN
    NEW.read_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for read_at
CREATE TRIGGER trigger_notification_read_at
  BEFORE UPDATE ON webhook_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_read_at();

-- Grant necessary permissions
GRANT ALL ON webhook_notifications TO authenticated;
GRANT ALL ON webhook_notifications TO service_role;

-- Create PayPal accounts table for verified accounts
CREATE TABLE IF NOT EXISTS paypal_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- PayPal account details
  email TEXT NOT NULL,
  merchant_id TEXT,
  account_type TEXT DEFAULT 'personal' CHECK (account_type IN ('personal', 'business')),
  country_code TEXT DEFAULT 'US',
  
  -- Verification status
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  verified_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Webhook configuration
  webhook_id TEXT NULL,
  webhook_url TEXT NULL,
  
  -- OAuth tokens (encrypted)
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, email)
);

-- Create indexes for PayPal accounts
CREATE INDEX IF NOT EXISTS idx_paypal_accounts_user_id ON paypal_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_paypal_accounts_email ON paypal_accounts(email);
CREATE INDEX IF NOT EXISTS idx_paypal_accounts_merchant_id ON paypal_accounts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_paypal_accounts_verification_status ON paypal_accounts(verification_status);

-- Enable RLS for PayPal accounts
ALTER TABLE paypal_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for PayPal accounts
CREATE POLICY "Users can view their own PayPal accounts" ON paypal_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PayPal accounts" ON paypal_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PayPal accounts" ON paypal_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service can manage PayPal accounts" ON paypal_accounts
  FOR ALL USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_paypal_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_paypal_accounts_updated_at
  BEFORE UPDATE ON paypal_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_paypal_accounts_updated_at();

-- Grant permissions
GRANT ALL ON paypal_accounts TO authenticated;
GRANT ALL ON paypal_accounts TO service_role;

-- Create function to create notification from webhook
CREATE OR REPLACE FUNCTION create_webhook_notification(
  p_user_id UUID,
  p_webhook_id TEXT,
  p_event_type TEXT,
  p_event_id TEXT,
  p_title TEXT,
  p_message TEXT,
  p_paypal_data JSONB DEFAULT '{}'::jsonb,
  p_severity TEXT DEFAULT 'info'
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO webhook_notifications (
    user_id,
    webhook_id,
    event_type,
    event_id,
    title,
    message,
    paypal_data,
    severity
  ) VALUES (
    p_user_id,
    p_webhook_id,
    p_event_type,
    p_event_id,
    p_title,
    p_message,
    p_paypal_data,
    p_severity
  )
  ON CONFLICT (user_id, event_id) DO UPDATE SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    paypal_data = EXCLUDED.paypal_data,
    severity = EXCLUDED.severity
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_webhook_notification TO service_role;
GRANT EXECUTE ON FUNCTION create_webhook_notification TO authenticated;

COMMENT ON TABLE webhook_notifications IS 'PayPal webhook notifications for users';
COMMENT ON TABLE paypal_accounts IS 'Verified PayPal accounts for receiving payments';
COMMENT ON FUNCTION create_webhook_notification IS 'Creates or updates webhook notifications from PayPal events';
