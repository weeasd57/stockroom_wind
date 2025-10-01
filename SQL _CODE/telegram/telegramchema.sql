-- ===================================================================
-- TELEGRAM BOT INTEGRATION TABLES
-- ===================================================================

-- Table: telegram_bots (إعدادات البوت لكل مستخدم)
CREATE TABLE telegram_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    bot_token TEXT NOT NULL, -- Bot token from @BotFather
    bot_username VARCHAR(255) NOT NULL, -- @botusername
    bot_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id) -- كل يوزر له بوت واحد بس
);

-- Table: telegram_subscribers (المستخدمين المشتركين في التليجرام)
CREATE TABLE telegram_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES telegram_bots(id) ON DELETE CASCADE NOT NULL,
    telegram_user_id BIGINT NOT NULL, -- Telegram User ID
    telegram_username VARCHAR(255), -- @username (optional)
    telegram_first_name VARCHAR(255),
    telegram_last_name VARCHAR(255),
    platform_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- ربط بالحساب في المنصة
    is_subscribed BOOLEAN DEFAULT TRUE,
    language_code VARCHAR(10) DEFAULT 'ar', -- ar, en
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(bot_id, telegram_user_id)
);

-- Table: telegram_notification_settings (إعدادات الإشعارات)
CREATE TABLE telegram_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID REFERENCES telegram_subscribers(id) ON DELETE CASCADE NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'new_post', 'price_update', 'target_reached', 'stop_loss'
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(subscriber_id, notification_type)
);

-- Table: telegram_broadcasts (حملات الإشعارات)
CREATE TABLE telegram_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES telegram_bots(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL, -- المرسل (البروكر)
    title VARCHAR(255) NOT NULL,
    message TEXT,
    broadcast_type VARCHAR(50) NOT NULL, -- 'post_selection', 'price_update', 'custom'
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'sending', 'completed', 'failed'
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Table: telegram_broadcast_posts (البوستات المختارة للإشعار)
CREATE TABLE telegram_broadcast_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES telegram_broadcasts(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    include_price_update BOOLEAN DEFAULT FALSE,
    custom_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(broadcast_id, post_id)
);

-- Table: telegram_broadcast_recipients (المستقبلين المختارين)
CREATE TABLE telegram_broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES telegram_broadcasts(id) ON DELETE CASCADE NOT NULL,
    subscriber_id UUID REFERENCES telegram_subscribers(id) ON DELETE CASCADE NOT NULL,
    recipient_type VARCHAR(50) DEFAULT 'follower', -- 'follower', 'all_subscribers', 'manual'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'skipped'
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    telegram_message_id BIGINT, -- رقم الرسالة في التليجرام
    
    UNIQUE(broadcast_id, subscriber_id)
);

-- Table: telegram_notifications (سجل الإشعارات المرسلة)
CREATE TABLE telegram_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES telegram_bots(id) ON DELETE CASCADE NOT NULL,
    subscriber_id UUID REFERENCES telegram_subscribers(id) ON DELETE CASCADE NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    broadcast_id UUID REFERENCES telegram_broadcasts(id) ON DELETE SET NULL,
    telegram_message_id BIGINT,
    message_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'failed', 'read'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT
);

-- Table: telegram_bot_commands (أوامر البوت المتاحة)
CREATE TABLE telegram_bot_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES telegram_bots(id) ON DELETE CASCADE NOT NULL,
    command VARCHAR(50) NOT NULL, -- 'start', 'subscribe', 'unsubscribe', 'settings'
    description TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(bot_id, command)
);

-- ===================================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================================

CREATE INDEX idx_telegram_bots_user_id ON telegram_bots(user_id);
CREATE INDEX idx_telegram_bots_active ON telegram_bots(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_telegram_subscribers_bot_id ON telegram_subscribers(bot_id);
CREATE INDEX idx_telegram_subscribers_telegram_user_id ON telegram_subscribers(telegram_user_id);
CREATE INDEX idx_telegram_subscribers_platform_user_id ON telegram_subscribers(platform_user_id);
CREATE INDEX idx_telegram_subscribers_subscribed ON telegram_subscribers(is_subscribed) WHERE is_subscribed = TRUE;

CREATE INDEX idx_telegram_notifications_bot_id ON telegram_notifications(bot_id);
CREATE INDEX idx_telegram_notifications_subscriber_id ON telegram_notifications(subscriber_id);
CREATE INDEX idx_telegram_notifications_post_id ON telegram_notifications(post_id);
CREATE INDEX idx_telegram_notifications_sent_at ON telegram_notifications(sent_at DESC);

CREATE INDEX idx_telegram_broadcasts_bot_id ON telegram_broadcasts(bot_id);
CREATE INDEX idx_telegram_broadcasts_sender_id ON telegram_broadcasts(sender_id);
CREATE INDEX idx_telegram_broadcasts_status ON telegram_broadcasts(status);
CREATE INDEX idx_telegram_broadcasts_created_at ON telegram_broadcasts(created_at DESC);

-- ===================================================================
-- ROW LEVEL SECURITY POLICIES
-- ===================================================================

-- Enable RLS on all telegram tables
ALTER TABLE telegram_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_broadcast_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_bot_commands ENABLE ROW LEVEL SECURITY;

-- Policies for telegram_bots
CREATE POLICY "Users can manage their own bots" ON telegram_bots
  FOR ALL USING (auth.uid() = user_id);

-- Policies for telegram_subscribers  
CREATE POLICY "Bot owners can view their subscribers" ON telegram_subscribers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM telegram_bots 
      WHERE id = telegram_subscribers.bot_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Bot owners can manage subscribers" ON telegram_subscribers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM telegram_bots 
      WHERE id = telegram_subscribers.bot_id 
      AND user_id = auth.uid()
    )
  );

-- Policies for telegram_broadcasts
CREATE POLICY "Users can manage their own broadcasts" ON telegram_broadcasts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM telegram_bots 
      WHERE id = telegram_broadcasts.bot_id 
      AND user_id = auth.uid()
    )
  );

-- Policies for other tables follow similar pattern...

-- ===================================================================
-- USEFUL FUNCTIONS
-- ===================================================================

-- Function to get follower subscribers for a user
CREATE OR REPLACE FUNCTION get_follower_telegram_subscribers(p_user_id UUID, p_bot_id UUID)
RETURNS TABLE(
    subscriber_id UUID,
    telegram_user_id BIGINT,
    telegram_username VARCHAR(255),
    telegram_first_name VARCHAR(255),
    platform_user_id UUID,
    username VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.id as subscriber_id,
    ts.telegram_user_id,
    ts.telegram_username,
    ts.telegram_first_name,
    ts.platform_user_id,
    p.username,
    p.full_name,
    p.avatar_url
  FROM telegram_subscribers ts
  JOIN profiles p ON ts.platform_user_id = p.id
  WHERE ts.bot_id = p_bot_id
    AND ts.is_subscribed = TRUE
    AND EXISTS (
      SELECT 1 FROM user_followings uf
      WHERE uf.follower_id = ts.platform_user_id
      AND uf.following_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a broadcast with posts and recipients
CREATE OR REPLACE FUNCTION create_telegram_broadcast(
    p_bot_id UUID,
    p_sender_id UUID,
    p_title VARCHAR(255),
    p_message TEXT,
    p_post_ids UUID[],
    p_recipient_ids UUID[],
    p_broadcast_type VARCHAR(50) DEFAULT 'post_selection'
)
RETURNS UUID AS $$
DECLARE
    v_broadcast_id UUID;
    v_post_id UUID;
    v_recipient_id UUID;
BEGIN
    -- Create broadcast
    INSERT INTO telegram_broadcasts (
        bot_id, sender_id, title, message, broadcast_type,
        total_recipients, status
    ) VALUES (
        p_bot_id, p_sender_id, p_title, p_message, p_broadcast_type,
        array_length(p_recipient_ids, 1), 'draft'
    ) RETURNING id INTO v_broadcast_id;
    
    -- Add posts to broadcast
    FOREACH v_post_id IN ARRAY p_post_ids
    LOOP
        INSERT INTO telegram_broadcast_posts (broadcast_id, post_id)
        VALUES (v_broadcast_id, v_post_id);
    END LOOP;
    
    -- Add recipients to broadcast
    FOREACH v_recipient_id IN ARRAY p_recipient_ids
    LOOP
        INSERT INTO telegram_broadcast_recipients (broadcast_id, subscriber_id)
        VALUES (v_broadcast_id, v_recipient_id);
    END LOOP;
    
    RETURN v_broadcast_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's telegram bot info
CREATE OR REPLACE FUNCTION get_user_telegram_bot(p_user_id UUID)
RETURNS TABLE(
    bot_id UUID,
    bot_token TEXT,
    bot_username VARCHAR(255),
    bot_name VARCHAR(255),
    is_active BOOLEAN,
    subscriber_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tb.id as bot_id,
    tb.bot_token,
    tb.bot_username,
    tb.bot_name,
    tb.is_active,
    COUNT(ts.id) as subscriber_count
  FROM telegram_bots tb
  LEFT JOIN telegram_subscribers ts ON tb.id = ts.bot_id AND ts.is_subscribed = TRUE
  WHERE tb.user_id = p_user_id
  GROUP BY tb.id, tb.bot_token, tb.bot_username, tb.bot_name, tb.is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- USEFUL VIEWS
-- ===================================================================

-- View for broadcasts with stats
CREATE OR REPLACE VIEW telegram_broadcasts_with_stats
WITH (security_invoker = on) AS
SELECT 
    b.id,
    b.bot_id,
    b.sender_id,
    b.title,
    b.message,
    b.broadcast_type,
    b.status,
    b.total_recipients,
    b.sent_count,
    b.failed_count,
    b.created_at,
    b.sent_at,
    b.completed_at,
    p.username as sender_username,
    p.full_name as sender_name,
    COUNT(DISTINCT bp.post_id) as post_count,
    COUNT(DISTINCT br.subscriber_id) as recipient_count
FROM telegram_broadcasts b
JOIN profiles p ON b.sender_id = p.id
LEFT JOIN telegram_broadcast_posts bp ON b.id = bp.broadcast_id
LEFT JOIN telegram_broadcast_recipients br ON b.id = br.broadcast_id
GROUP BY b.id, p.username, p.full_name;

-- ===================================================================
-- TRIGGERS
-- ===================================================================

-- Trigger to update telegram_bots updated_at
CREATE TRIGGER update_telegram_bots_updated_at BEFORE UPDATE ON telegram_bots
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger to update subscriber last_interaction
CREATE OR REPLACE FUNCTION update_subscriber_last_interaction()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_interaction = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_telegram_subscribers_last_interaction 
    BEFORE UPDATE ON telegram_subscribers
    FOR EACH ROW EXECUTE PROCEDURE update_subscriber_last_interaction();

-- ===================================================================
-- PUBLIC SAFE FUNCTION: list users with active telegram bots (no tokens)
-- ===================================================================

-- This function exposes minimal, non-sensitive bot info for UI badges.
-- It bypasses RLS via SECURITY DEFINER but does NOT return bot_token.
-- Ensure the function owner is a role with proper access (e.g., postgres).
CREATE OR REPLACE FUNCTION public_get_users_with_active_bots(
  p_user_ids UUID[]
)
RETURNS TABLE(
  user_id UUID,
  bot_username TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT tb.user_id, tb.bot_username::text AS bot_username, tb.is_active
  FROM telegram_bots tb
  WHERE tb.is_active = TRUE
    AND (p_user_ids IS NULL OR tb.user_id = ANY (p_user_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: restrict search_path for safety (if your environment supports it)
-- ALTER FUNCTION public_get_users_with_active_bots(UUID[]) SET search_path = public;

-- Grant execute to web roles
GRANT EXECUTE ON FUNCTION public_get_users_with_active_bots(UUID[]) TO anon, authenticated;