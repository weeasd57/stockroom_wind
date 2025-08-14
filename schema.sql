-- ===================================================================
-- Schema SQL للتطبيق المالي / Trading App SQL Schema
-- ===================================================================

-- إنشاء قاعدة البيانات
-- CREATE DATABASE trading_app;
-- USE trading_app;

-- ===================================================================
-- جدول المستخدمين / Users Table
-- ===================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    website VARCHAR(500),
    background_url TEXT,
    favorite_markets TEXT[], -- Array of market symbols
    success_posts INTEGER DEFAULT 0,
    loss_posts INTEGER DEFAULT 0,
    experience_score INTEGER DEFAULT 0,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    last_sign_in TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- إعدادات إضافية للمستخدم
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    profile_visibility VARCHAR(20) DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private', 'followers'))
);

-- ===================================================================
-- جدول الاستراتيجيات المخصصة / User Strategies Table
-- ===================================================================
CREATE TABLE user_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- ===================================================================
-- جدول المنشورات / Posts Table
-- ===================================================================
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    
    -- معلومات السهم / Stock Information
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    exchange VARCHAR(100) NOT NULL,
    
    -- معلومات التداول / Trading Information
    current_price DECIMAL(15,4) NOT NULL,
    target_price DECIMAL(15,4) NOT NULL,
    stop_loss_price DECIMAL(15,4) NOT NULL,
    initial_price DECIMAL(15,4) NOT NULL,
    high_price DECIMAL(15,4) DEFAULT 0,
    target_high_price DECIMAL(15,4) DEFAULT 0,
    last_price DECIMAL(15,4),
    
    -- الاستراتيجية / Strategy
    strategy VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- حالة التداول / Trading Status
    target_reached BOOLEAN DEFAULT FALSE,
    stop_loss_triggered BOOLEAN DEFAULT FALSE,
    closed BOOLEAN DEFAULT FALSE,
    target_reached_date TIMESTAMP WITH TIME ZONE,
    stop_loss_triggered_date TIMESTAMP WITH TIME ZONE,
    target_hit_time TIMESTAMP WITH TIME ZONE,
    last_price_check TIMESTAMP WITH TIME ZONE,
    
    -- معلومات إضافية / Additional Information
    post_date_after_price_date BOOLEAN DEFAULT FALSE,
    post_after_market_close BOOLEAN DEFAULT FALSE,
    no_data_available BOOLEAN DEFAULT FALSE,
    status_message TEXT,
    
    -- التواريخ / Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- إعدادات الخصوصية
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'followers')),
    
    -- فهارس للبحث السريع
    CONSTRAINT valid_prices CHECK (
        current_price > 0 AND 
        target_price > 0 AND 
        stop_loss_price > 0 AND
        initial_price > 0
    )
);

-- ===================================================================
-- جدول التعليقات / Comments Table
-- ===================================================================
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- للردود المتداخلة
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- حالة التعليق
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- ===================================================================
-- جدول الإعجابات / Likes Table
-- ===================================================================
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- يجب أن يكون الإعجاب إما على منشور أو تعليق وليس كليهما
    CONSTRAINT like_target CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),
    
    -- منع الإعجاب المكرر
    UNIQUE(user_id, post_id),
    UNIQUE(user_id, comment_id)
);

-- ===================================================================
-- جدول المتابعة / Followers Table
-- ===================================================================
CREATE TABLE user_followings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- منع متابعة النفس
    CONSTRAINT no_self_follow CHECK (follower_id != following_id),
    
    -- منع المتابعة المكررة
    UNIQUE(follower_id, following_id)
);

-- ===================================================================
-- جدول المحفظة / Portfolio Table
-- ===================================================================
CREATE TABLE portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    shares DECIMAL(15,4) NOT NULL,
    avg_purchase_price DECIMAL(15,4) NOT NULL,
    current_price DECIMAL(15,4),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, symbol)
);

-- ===================================================================
-- جدول الإشعارات / Notifications Table
-- ===================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'like', 'comment', 'follow', 'target_reached', 'stop_loss'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    related_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- جدول تقييم الأداء / Performance Tracking Table
-- ===================================================================
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_posts INTEGER DEFAULT 0,
    successful_predictions INTEGER DEFAULT 0,
    failed_predictions INTEGER DEFAULT 0,
    avg_return_percentage DECIMAL(5,2) DEFAULT 0,
    total_return_percentage DECIMAL(8,2) DEFAULT 0,
    risk_score DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, period_start, period_end)
);

-- ===================================================================
-- الفهارس / Indexes
-- ===================================================================

-- فهارس المستخدمين
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- فهارس المنشورات
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_symbol ON posts(symbol);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_target_reached ON posts(target_reached);
CREATE INDEX idx_posts_closed ON posts(closed);
CREATE INDEX idx_posts_country_exchange ON posts(country, exchange);

-- فهارس التعليقات
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- فهارس الإعجابات
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);

-- فهارس المتابعة
CREATE INDEX idx_followers_follower_id ON user_followings(follower_id);
CREATE INDEX idx_followers_following_id ON user_followings(following_id);

-- فهارس المحفظة
CREATE INDEX idx_portfolio_user_id ON portfolio(user_id);
CREATE INDEX idx_portfolio_symbol ON portfolio(symbol);

-- فهارس الإشعارات
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ===================================================================
-- العروض / Views
-- ===================================================================

-- عرض إحصائيات المستخدمين
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.username,
    u.full_name,
    COUNT(DISTINCT p.id) as total_posts,
    COUNT(DISTINCT CASE WHEN p.target_reached = true THEN p.id END) as successful_posts,
    COUNT(DISTINCT CASE WHEN p.stop_loss_triggered = true THEN p.id END) as failed_posts,
    COUNT(DISTINCT f1.follower_id) as followers_count,
    COUNT(DISTINCT f2.following_id) as following_count,
    u.experience_score,
    u.created_at
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN user_followings f1 ON u.id = f1.following_id
LEFT JOIN user_followings f2 ON u.id = f2.follower_id
GROUP BY u.id, u.username, u.full_name, u.experience_score, u.created_at;

-- عرض المنشورات مع تفاصيل المستخدم
CREATE VIEW posts_with_user AS
SELECT 
    p.*,
    u.username,
    u.full_name,
    u.avatar_url,
    COUNT(DISTINCT l.id) as likes_count,
    COUNT(DISTINCT c.id) as comments_count
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN likes l ON p.id = l.post_id
LEFT JOIN comments c ON p.id = c.post_id
GROUP BY p.id, u.username, u.full_name, u.avatar_url;

-- ===================================================================
-- الإجراءات المحفوظة / Stored Procedures
-- ===================================================================

-- إجراء لتحديث عدد المتابعين
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- زيادة عدد المتابعين للمستخدم المتابَع
        UPDATE users SET followers = followers + 1 WHERE id = NEW.following_id;
        -- زيادة عدد المتابعين للمستخدم المتابِع
        UPDATE users SET following = following + 1 WHERE id = NEW.follower_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- تقليل عدد المتابعين للمستخدم المتابَع
        UPDATE users SET followers = GREATEST(0, followers - 1) WHERE id = OLD.following_id;
        -- تقليل عدد المتابعين للمستخدم المتابِع
        UPDATE users SET following = GREATEST(0, following - 1) WHERE id = OLD.follower_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ربط الإجراء بجدول المتابعة
CREATE TRIGGER follow_counts_trigger
    AFTER INSERT OR DELETE ON user_followings
    FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- إجراء لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الإجراء بالجداول المناسبة
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- بيانات أولية / Initial Data
-- ===================================================================

-- إدراج الاستراتيجيات الافتراضية (اختياري - يمكن إدارتها من التطبيق)
-- INSERT INTO user_strategies (user_id, name) VALUES 
-- (uuid_generate_v4(), 'Long Term Investment'),
-- (uuid_generate_v4(), 'Swing Trading'),
-- (uuid_generate_v4(), 'Day Trading'),
-- (uuid_generate_v4(), 'Value Investing'),
-- (uuid_generate_v4(), 'Growth Investing');

-- ===================================================================
-- الأذونات / Permissions (اختياري)
-- ===================================================================

-- CREATE ROLE trading_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading_app_user;

-- ===================================================================
-- النهاية / End of Schema
-- ===================================================================