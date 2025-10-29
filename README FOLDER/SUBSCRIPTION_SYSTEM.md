# نظام الاشتراكات والدفع - PayPal Integration

## نظرة عامة
تم تنفيذ نظام اشتراكات متكامل مع PayPal للسماح للمستخدمين بالترقية من الخطة المجانية إلى الخطط المدفوعة (Pro أو Enterprise).

## الميزات الرئيسية

### 1. خطط الاشتراك
- **Free Plan**: 2 فحص أسعار يومياً (مجاني)
- **Pro Plan**: 10 فحص أسعار يومياً ($9.99/شهر)
- **Enterprise Plan**: فحص غير محدود ($29.99/شهر)

### 2. المكونات

#### قاعدة البيانات (Supabase)
- `subscription_plans`: جدول الخطط المتاحة
- `user_subscriptions`: اشتراكات المستخدمين
- `payment_transactions`: سجل المعاملات المالية

#### الصفحات
- `/pricing`: عرض الخطط المتاحة
- `/checkout`: صفحة الدفع بـ PayPal
- `/checkout/success`: صفحة تأكيد الدفع الناجح

#### API Routes
- `/api/checkout/confirm`: تأكيد الدفع وتفعيل الاشتراك
- `/api/webhooks/paypal`: معالجة إشعارات PayPal
- `/api/posts/check-prices`: API فحص الأسعار مع حدود الخطط

## التكوين المطلوب

### متغيرات البيئة
```env
# PayPal Configuration
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_WEBHOOK_ID=your_webhook_id
PAYPAL_MODE=sandbox # أو live للإنتاج

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## إعداد قاعدة البيانات

1. قم بتشغيل SQL schema:
```sql
-- تشغيل الملف SQL_CODE/subscription_schema.sql في Supabase SQL Editor
```

2. أدخل بيانات الخطط الأساسية:
```sql
INSERT INTO subscription_plans (name, price, price_checks_per_day, features) VALUES
('Free', 0, 2, '["2 price checks per day", "Basic features"]'),
('Pro', 9.99, 10, '["10 price checks per day", "Priority support", "Advanced analytics"]'),
('Enterprise', 29.99, 999999, '["Unlimited price checks", "24/7 support", "Custom integrations"]');
```

3. قم بتفعيل pg_cron extension لإعادة تعيين الاستخدام اليومي:
```sql
-- في Supabase Dashboard > Database > Extensions
-- قم بتفعيل pg_cron
-- ثم قم بجدولة المهمة:
SELECT cron.schedule('reset-daily-checks', '0 0 * * *', 'SELECT reset_daily_price_checks();');
```

## سير العمل

### 1. عملية الترقية
1. المستخدم يزور `/pricing`
2. يختار خطة ويضغط "Upgrade"
3. يتم توجيهه إلى `/checkout`
4. يدفع عبر PayPal
5. بعد الدفع الناجح:
   - PayPal يرسل webhook
   - يتم تفعيل الاشتراك
   - المستخدم يُوجه إلى `/checkout/success`

### 2. حدود فحص الأسعار
- يتم فحص حدود المستخدم عند كل طلب فحص
- يتم تحديث العداد في `user_subscriptions.price_checks_used`
- يتم إعادة تعيين العداد يومياً عند منتصف الليل

## الأمان

### Webhook Verification
- يتم التحقق من توقيع PayPal للتأكد من صحة الإشعارات
- استخدام idempotency لمنع معالجة نفس الحدث مرتين

### صلاحيات قاعدة البيانات
- RLS policies مفعلة على جميع الجداول
- Service role key يُستخدم فقط في server-side
- المستخدمون يمكنهم فقط عرض وتحديث بياناتهم

## الاختبار

### بيئة Sandbox
1. استخدم حساب PayPal Sandbox
2. قم بإنشاء test buyers من PayPal Developer Dashboard
3. اختبر عمليات الدفع والاشتراكات

### اختبار الحدود
```javascript
// اختبر API فحص الأسعار
fetch('/api/posts/check-prices', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
}).then(res => res.json())
  .then(data => console.log('Usage:', data));
```

## الصيانة

### مراقبة الاشتراكات
```sql
-- الاشتراكات النشطة مع تفاصيل الخطة
SELECT s.user_id, s.status, s.price_checks_used, s.posts_created,
       p.name AS plan_name, p.display_name, p.price_check_limit, p.post_creation_limit
FROM user_subscriptions s
JOIN subscription_plans p ON p.id = s.plan_id
WHERE s.status = 'active';

-- استخدام حدود الفحص (شهرياً)
SELECT s.user_id,
       p.price_check_limit,
       s.price_checks_used,
       GREATEST(p.price_check_limit - s.price_checks_used, 0) AS remaining_checks
FROM user_subscriptions s
JOIN subscription_plans p ON p.id = s.plan_id
WHERE s.status = 'active' AND s.price_checks_used > 0;
```

### إدارة الاشتراكات المنتهية
```sql
-- تحديث الاشتراكات المنتهية
UPDATE user_subscriptions 
SET status = 'expired' 
WHERE expires_at < NOW() AND status = 'active';
```

## استكشاف الأخطاء

### المستخدم لا يستطيع الدفع
- تحقق من PayPal Client ID
- تأكد من أن المستخدم مسجل دخول
- راجع console logs للأخطاء

### الاشتراك لم يتم تفعيله
- تحقق من webhook URL في PayPal
- راجع logs في `/api/webhooks/paypal`
- تأكد من webhook verification

### حدود الفحص لا تعمل
- تأكد أن `user_subscriptions.price_checks_used` يتم تحديثه (RPC `log_price_check`)
- راجع أن `subscription_plans.price_check_limit` مظبوط
- راجع job إعادة التعيين الشهري `reset_monthly_usage`

## المراجع
- [PayPal JavaScript SDK](https://developer.paypal.com/docs/checkout/)
- [PayPal Webhooks](https://developer.paypal.com/docs/api/webhooks/)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
