# دليل إعداد خدمة WhatsApp للإشعارات

## نظرة عامة
هذا الدليل يوضح كيفية إعداد خدمة إشعارات WhatsApp لإرسال رسائل للمتابعين عند نشر منشورات جديدة.

## الخيارات المتاحة

### الخيار 1: Meta WhatsApp Business API (موصى به) 🆓

#### المميزات:
- ✅ مجاني (1000 رسالة شهرياً)
- ✅ API رسمي من فيسبوك
- ✅ موثوق ومستقر
- ✅ يدعم الرسائل النصية والوسائط

#### خطوات الإعداد:

1. **إنشاء حساب Facebook Developer**
   - اذهب إلى [Facebook Developers](https://developers.facebook.com/)
   - انقر على "Get Started"
   - أكمل التسجيل وتأكيد الحساب

2. **إنشاء تطبيق Facebook**
   - انقر على "Create App"
   - اختر "Business" كنوع التطبيق
   - أدخل اسم التطبيق (مثل: "SharksZone Notifications")
   - اختر الغرض: "Other"

3. **إضافة منتج WhatsApp**
   - في لوحة التحكم، انقر على "Add Product"
   - ابحث عن "WhatsApp" وانقر على "Set up"

4. **إعداد WhatsApp Business Account**
   - انقر على "Create Business Account" أو استخدم حساب موجود
   - أدخل معلومات الشركة
   - تحقق من رقم الهاتف

5. **الحصول على البيانات المطلوبة**
   ```
   WHATSAPP_API_TOKEN = "متاح في WhatsApp > Getting Started > Temporary Access Token"
   WHATSAPP_PHONE_NUMBER_ID = "متاح في WhatsApp > Getting Started > Phone Number ID"
   ```

6. **إعداد متغيرات البيئة**
   ```env
   WHATSAPP_PROVIDER=meta
   WHATSAPP_API_URL=https://graph.facebook.com/v18.0
   WHATSAPP_API_TOKEN=EAAxxxxxxxxxxxxx
   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   ```

#### اختبار الإعداد:
```bash
curl -X POST \
  "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "966501234567",
    "type": "text",
    "text": {
      "body": "Hello from SharksZone!"
    }
  }'
```

---

### الخيار 2: Twilio WhatsApp API 💰

#### المميزات:
- ✅ سهل الإعداد
- ✅ دعم فني ممتاز
- ✅ دوكيومنتشن واضح
- ❌ مدفوع ($0.0055 لكل رسالة)

#### خطوات الإعداد:

1. **إنشاء حساب Twilio**
   - اذهب إلى [Twilio Console](https://console.twilio.com/)
   - أنشئ حساب جديد
   - تحقق من رقم الهاتف

2. **تفعيل WhatsApp Sandbox**
   - اذهب إلى Console > Messaging > Try it out > Send a WhatsApp message
   - اتبع التعليمات لربط رقم WhatsApp بـ Sandbox

3. **الحصول على البيانات المطلوبة**
   ```
   TWILIO_ACCOUNT_SID = "متاح في Console Dashboard"
   TWILIO_AUTH_TOKEN = "متاح في Console Dashboard"
   TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155238886" (رقم Twilio Sandbox)
   ```

4. **إعداد متغيرات البيئة**
   ```env
   WHATSAPP_PROVIDER=twilio
   WHATSAPP_API_TOKEN=your_twilio_auth_token
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

#### اختبار الإعداد:
```bash
curl -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json" \
  --data-urlencode "From=whatsapp:+14155238886" \
  --data-urlencode "To=whatsapp:+966501234567" \
  --data-urlencode "Body=Hello from SharksZone!" \
  -u YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN
```

---

## إعداد قاعدة البيانات

1. **تشغيل SQL Script**
   ```bash
   # تنفيذ في Supabase SQL Editor
   psql -f SQL_CODE/whatsapp_notifications.sql
   ```

2. **التحقق من الجداول الجديدة**
   - `whatsapp_notifications`
   - `whatsapp_message_templates`
   - تحديثات على جدول `profiles`

---

## اختبار النظام

### 1. تحديث ملف شخصي برقم WhatsApp
```sql
UPDATE profiles 
SET whatsapp_number = '966501234567',
    whatsapp_notifications_enabled = true,
    notification_preferences = '{"new_posts": true, "price_updates": false, "strategy_updates": false}'
WHERE id = 'user_id_here';
```

### 2. إنشاء منشور جديد
استخدم API إنشاء المنشورات العادي - سيتم إرسال الإشعارات تلقائياً.

### 3. اختبار الإعدادات
```bash
# GET للحصول على الإعدادات
curl -X GET "http://localhost:3000/api/whatsapp/settings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# PUT لتحديث الإعدادات
curl -X PUT "http://localhost:3000/api/whatsapp/settings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "whatsapp_number": "966501234567",
    "notifications_enabled": true,
    "notification_preferences": {
      "new_posts": true,
      "price_updates": false
    }
  }'

# POST لإرسال رسالة اختبار
curl -X POST "http://localhost:3000/api/whatsapp/settings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "test_message"}'
```

---

## استكشاف الأخطاء

### مشاكل شائعة:

1. **"Invalid phone number format"**
   - تأكد من تنسيق الرقم: 966xxxxxxxxx
   - تحقق من صحة رقم الهاتف

2. **"API token not configured"**
   - تأكد من إعداد متغيرات البيئة بشكل صحيح
   - أعد تشغيل الخادم بعد تحديث .env

3. **"Phone number not verified"**
   - تأكد من تأكيد رقم الهاتف في إعدادات WhatsApp Business

4. **"Rate limit exceeded"**
   - تحقق من حدود الإرسال (1000 رسالة/شهر لـ Meta)
   - انتظر قبل المحاولة مرة أخرى

### فحص السجلات:
```bash
# مراقبة السجلات في الوقت الفعلي
tail -f logs/whatsapp.log

# فحص قاعدة البيانات
SELECT * FROM whatsapp_notifications 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## الأمان وأفضل الممارسات

1. **حماية API Keys**
   - لا تضع API keys في الكود المصدري
   - استخدم متغيرات البيئة فقط
   - استخدم secrets manager في الإنتاج

2. **التحقق من صحة البيانات**
   - تحقق من تنسيق أرقام الهواتف
   - فلترة المحتوى قبل الإرسال
   - تحديد حد أقصى لطول الرسائل

3. **إدارة المعدل**
   - احترم حدود API
   - تنفيذ queue للرسائل الكثيرة
   - إضافة retry logic للرسائل الفاشلة

4. **خصوصية المستخدمين**
   - إعطاء المستخدمين السيطرة الكاملة على الإشعارات
   - إمكانية إلغاء الاشتراك بسهولة
   - عدم حفظ أرقام الهواتف بدون موافقة

---

## المراجع المفيدة

- [Meta WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Twilio WhatsApp API Documentation](https://www.twilio.com/docs/whatsapp)
- [WhatsApp Business API Pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- [Phone Number Formats](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers)