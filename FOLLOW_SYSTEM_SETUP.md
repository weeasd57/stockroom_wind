# 🔧 Follow System Setup Guide

## المشكلة المكتشفة / Problem Identified
المشكلة في نظام الـ Follow هي **Row Level Security (RLS)** - الجداول موجودة لكن السياسات الأمنية تمنع الوصول للمستخدمين غير المصادق عليهم.

The Follow system issue is **Row Level Security (RLS)** - tables exist but security policies prevent access for unauthenticated users.

## 🛠️ الحل / Solution

### 1. تشغيل SQL في Supabase Dashboard
Go to **Supabase Dashboard > SQL Editor** and run:

```sql
-- إصلاح سياسات RLS للجداول الموجودة
-- Fix RLS policies for existing tables

-- 1. إصلاح سياسات user_followings
-- Fix user_followings policies
DROP POLICY IF EXISTS "Followings are viewable by everyone" ON user_followings;
DROP POLICY IF EXISTS "Users can follow others" ON user_followings;
DROP POLICY IF EXISTS "Users can unfollow others" ON user_followings;

-- سياسات جديدة تسمح بالوصول للمستخدمين المجهولين للقراءة
-- New policies allowing anonymous read access
CREATE POLICY "Anyone can view followings" ON user_followings
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can follow others" ON user_followings
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = follower_id
  );

CREATE POLICY "Authenticated users can unfollow others" ON user_followings
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND 
    auth.uid() = follower_id
  );

-- 2. إصلاح سياسات user_strategies
-- Fix user_strategies policies
DROP POLICY IF EXISTS "Users can view their own strategies" ON user_strategies;
DROP POLICY IF EXISTS "Users can insert their own strategies" ON user_strategies;

CREATE POLICY "Anyone can view strategies" ON user_strategies
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage their strategies" ON user_strategies
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    auth.uid() = user_id
  );

-- 3. التأكد من وجود الجداول بالهيكل الصحيح
-- Ensure tables exist with correct structure
CREATE TABLE IF NOT EXISTS user_followings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE TABLE IF NOT EXISTS user_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, strategy_name)
);

-- 4. إنشاء الفهارس
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_followings_follower_id ON user_followings(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_followings_following_id ON user_followings(following_id);
CREATE INDEX IF NOT EXISTS idx_user_strategies_user_id ON user_strategies(user_id);

-- 5. تحديث إحصائيات الـ followers في جدول profiles
-- Update follower statistics in profiles table
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update following count for follower
  UPDATE profiles 
  SET following = (
    SELECT COUNT(*) FROM user_followings 
    WHERE follower_id = COALESCE(NEW.follower_id, OLD.follower_id)
  )
  WHERE id = COALESCE(NEW.follower_id, OLD.follower_id);
  
  -- Update followers count for followed user
  UPDATE profiles 
  SET followers = (
    SELECT COUNT(*) FROM user_followings 
    WHERE following_id = COALESCE(NEW.following_id, OLD.following_id)
  )
  WHERE id = COALESCE(NEW.following_id, OLD.following_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- إنشاء المشغلات
-- Create triggers
DROP TRIGGER IF EXISTS update_follower_counts_trigger ON user_followings;
CREATE TRIGGER update_follower_counts_trigger
  AFTER INSERT OR DELETE ON user_followings
  FOR EACH ROW EXECUTE FUNCTION update_follower_counts();
```

### 2. تحديث الكود في التطبيق
Update the application code:

#### في ملف `src/utils/supabase.js`
In file `src/utils/supabase.js`, update the follow functions:

```javascript
// تحديث دالة followUser
export const followUser = async (followerId, followingId) => {
  try {
    // التحقق من المعاملات
    if (!followerId || !followingId) {
      return { data: null, error: { message: 'Missing required parameters' } };
    }
    
    if (followerId === followingId) {
      return { data: null, error: { message: 'Cannot follow yourself' } };
    }
    
    const { data, error } = await supabase
      .from('user_followings')
      .insert([{ follower_id: followerId, following_id: followingId }])
      .select();
      
    if (error) {
      console.error('Follow error:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (e) {
    console.error('Follow function error:', e);
    return { data: null, error: e };
  }
};

// تحديث دالة unfollowUser
export const unfollowUser = async (followerId, followingId) => {
  try {
    if (!followerId || !followingId) {
      return { data: null, error: { message: 'Missing required parameters' } };
    }
    
    const { data, error } = await supabase
      .from('user_followings')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .select();
      
    if (error) {
      console.error('Unfollow error:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (e) {
    console.error('Unfollow function error:', e);
    return { data: null, error: e };
  }
};
```

## 🧪 اختبار النظام / Testing

بعد تطبيق التغييرات، يمكنك اختبار النظام:

After applying changes, test the system:

```bash
# تشغيل اختبار النظام
node fix_follow_system.js
```

## 📊 النتيجة المتوقعة / Expected Result

- ✅ جداول user_followings و user_strategies تعمل بشكل صحيح
- ✅ يمكن للمستخدمين المصادق عليهم متابعة وإلغاء متابعة الآخرين
- ✅ يمكن لأي شخص عرض قوائم المتابعين والمتابَعين
- ✅ تحديث تلقائي لإحصائيات المتابعين في جدول profiles

Expected results:
- ✅ user_followings and user_strategies tables work correctly
- ✅ Authenticated users can follow/unfollow others
- ✅ Anyone can view followers/following lists
- ✅ Automatic update of follower statistics in profiles table

## 🔍 استكشاف الأخطاء / Troubleshooting

### إذا استمرت المشاكل:
If problems persist:

1. **تحقق من السياسات في Dashboard:**
   Go to Authentication > Policies and verify RLS policies

2. **تحقق من المصادقة:**
   Ensure users are properly authenticated when following

3. **تحقق من Foreign Keys:**
   Verify that user IDs exist in profiles table

4. **تحقق من Logs:**
   Check Supabase logs for detailed error messages

## 📝 ملاحظات مهمة / Important Notes

- نظام RLS يتطلب مصادقة للكتابة ولكن يسمح بالقراءة للجميع
- الإحصائيات تُحدث تلقائياً عند المتابعة/إلغاء المتابعة
- يجب التحقق من وجود المستخدمين قبل المتابعة

- RLS system requires authentication for writes but allows reads for everyone
- Statistics update automatically on follow/unfollow actions  
- Must verify users exist before following