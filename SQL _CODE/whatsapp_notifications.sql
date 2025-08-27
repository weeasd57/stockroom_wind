-- ===================================================================
-- WhatsApp Notifications Feature
-- إضافة خدمة إشعارات واتساب للمتابعين عند نشر منشورات جديدة
-- ===================================================================

-- إضافة حقل رقم الواتساب لجدول الملفات الشخصية
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"new_posts": true, "price_updates": false, "strategy_updates": false}'::jsonb;

-- إنشاء جدول لتتبع إشعارات الواتساب المرسلة
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    message_content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- 'new_post', 'price_update', 'strategy_update'
    whatsapp_message_id VARCHAR(255), -- WhatsApp API message ID
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_recipient_id ON whatsapp_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_post_id ON whatsapp_notifications(post_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_status ON whatsapp_notifications(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_created_at ON whatsapp_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_message_type ON whatsapp_notifications(message_type);

-- إنشاء جدول لقوالب رسائل الواتساب
CREATE TABLE IF NOT EXISTS whatsapp_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) UNIQUE NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'new_post', 'price_update', 'strategy_update'
    language_code VARCHAR(10) DEFAULT 'ar',
    subject TEXT,
    body_template TEXT NOT NULL, -- Template with placeholders like {{username}}, {{symbol}}, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- إدراج قوالب رسائل افتراضية
INSERT INTO whatsapp_message_templates (template_name, template_type, language_code, subject, body_template) VALUES
('new_post_ar', 'new_post', 'ar', 'منشور جديد', 
 '🔔 *منشور جديد من {{author_name}}*\n\n📈 *الرمز:* {{symbol}} ({{company_name}})\n💰 *السعر الحالي:* {{current_price}}\n🎯 *الهدف:* {{target_price}}\n🛑 *وقف الخسارة:* {{stop_loss_price}}\n📊 *الاستراتيجية:* {{strategy}}\n\n📝 *المحتوى:*\n{{content}}\n\n🔗 اضغط هنا لمشاهدة المنشور كاملاً'),

('price_update_ar', 'price_update', 'ar', 'تحديث السعر',
 '📊 *تحديث سعر {{symbol}}*\n\n💰 *السعر الجديد:* {{new_price}}\n📈 *التغيير:* {{price_change}}%\n\n🔗 شاهد التفاصيل'),

('new_post_en', 'new_post', 'en', 'New Post', 
 '🔔 *New post from {{author_name}}*\n\n📈 *Symbol:* {{symbol}} ({{company_name}})\n💰 *Current Price:* {{current_price}}\n🎯 *Target:* {{target_price}}\n🛑 *Stop Loss:* {{stop_loss_price}}\n📊 *Strategy:* {{strategy}}\n\n📝 *Content:*\n{{content}}\n\n🔗 Click here to view full post');

-- إنشاء فهرس لجدول القوالب
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_type ON whatsapp_message_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_active ON whatsapp_message_templates(is_active);

-- إنشاء دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- تطبيق trigger على الجداول الجديدة
CREATE TRIGGER update_whatsapp_notifications_updated_at 
    BEFORE UPDATE ON whatsapp_notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at 
    BEFORE UPDATE ON whatsapp_message_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- دالة للحصول على المتابعين الذين لديهم إشعارات واتساب مفعلة
CREATE OR REPLACE FUNCTION get_followers_for_whatsapp_notifications(author_user_id UUID)
RETURNS TABLE (
    follower_id UUID,
    whatsapp_number VARCHAR(20),
    username VARCHAR(255),
    full_name VARCHAR(255),
    notification_preferences JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.whatsapp_number,
        p.username,
        p.full_name,
        p.notification_preferences
    FROM profiles p
    INNER JOIN user_followings uf ON p.id = uf.follower_id
    WHERE uf.following_id = author_user_id
      AND p.whatsapp_notifications_enabled = true
      AND p.whatsapp_number IS NOT NULL
      AND p.whatsapp_number != ''
      AND (p.notification_preferences->>'new_posts')::boolean = true;
END;
$$ LANGUAGE plpgsql;

-- دالة لحفظ سجل إشعار واتساب
CREATE OR REPLACE FUNCTION log_whatsapp_notification(
    p_recipient_id UUID,
    p_post_id UUID,
    p_message_content TEXT,
    p_message_type VARCHAR(50),
    p_whatsapp_message_id VARCHAR(255) DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'pending'
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO whatsapp_notifications (
        recipient_id,
        post_id,
        message_content,
        message_type,
        whatsapp_message_id,
        status
    ) VALUES (
        p_recipient_id,
        p_post_id,
        p_message_content,
        p_message_type,
        p_whatsapp_message_id,
        p_status
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- دالة لتحديث حالة إشعار واتساب
CREATE OR REPLACE FUNCTION update_whatsapp_notification_status(
    p_notification_id UUID,
    p_status VARCHAR(20),
    p_whatsapp_message_id VARCHAR(255) DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE whatsapp_notifications 
    SET 
        status = p_status,
        whatsapp_message_id = COALESCE(p_whatsapp_message_id, whatsapp_message_id),
        error_message = p_error_message,
        sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END,
        updated_at = NOW()
    WHERE id = p_notification_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- تعليقات للمطورين
COMMENT ON TABLE whatsapp_notifications IS 'جدول لتتبع إشعارات الواتساب المرسلة للمستخدمين';
COMMENT ON TABLE whatsapp_message_templates IS 'قوالب رسائل الواتساب للغات والأنواع المختلفة';
COMMENT ON FUNCTION get_followers_for_whatsapp_notifications(UUID) IS 'دالة للحصول على المتابعين المؤهلين لاستقبال إشعارات الواتساب';
COMMENT ON FUNCTION log_whatsapp_notification IS 'دالة لحفظ سجل إشعار واتساب جديد';
COMMENT ON FUNCTION update_whatsapp_notification_status IS 'دالة لتحديث حالة إشعار واتساب';