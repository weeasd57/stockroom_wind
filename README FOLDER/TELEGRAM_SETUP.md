# Telegram Bot Integration Setup Guide

## 1. إعداد البوت على التليجرام

### خطوات إنشاء البوت:
1. افتح التليجرام وابحث عن `@BotFather`
2. أرسل `/newbot`
3. اختر اسم للبوت (مثل: Stock Trading Bot)
4. اختر username للبوت (يجب أن ينتهي بـ bot، مثل: `stocktrading_bot`)
5. احفظ الـ **Bot Token** الذي ستحصل عليه

## 2. إعداد متغيرات البيئة

أضف هذه المتغيرات في ملف `.env.local`:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_WEBHOOK_SECRET=your-random-secret-string
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Example:
# TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
# TELEGRAM_WEBHOOK_SECRET=my-super-secret-webhook-key-2024
# NEXT_PUBLIC_APP_URL=https://stockroom.com
```

### توليد Secret عشوائي:
```bash
# في Terminal:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. كيفية استخدام الميزة

### للبروكر (صاحب البوت):
1. اذهب إلى صفحة Profile
2. اضغط على تاب "Telegram Bot"
3. اضغط "إعداد البوت"
4. أدخل Bot Token واسم البوت
5. اضغط "إعداد البوت"

### إرسال إشعارات:
1. اضغط على "إرسال إشعار جديد"
2. اكتب عنوان ونص الرسالة
3. اختر البوستات المرفقة (اختياري)
4. اختر المستقبلين (المتابعين)
5. اضغط إرسال

### للمتابعين:
1. ابحث عن بوت البروكر في التليجرام
2. اضغط Start
3. اختر "اشترك" لتلقي الإشعارات

## 4. أوامر البوت المتاحة

- `/start` - البدء والاشتراك
- `/subscribe` - الاشتراك في الإشعارات
- `/unsubscribe` - إلغاء الاشتراك
- `/settings` - إعدادات الإشعارات

## 5. SQL Schema

إذا لم تكن قد أضفت الـ Schema بعد، قم بتنفيذ هذا في Supabase SQL Editor:

```sql
-- انظر الملف: SQL_CODE/telegram_schema.sql
```

## 6. اختبار النظام

### اختبار الـ Webhook:
```bash
curl -X POST https://yourdomain.com/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: your-webhook-secret" \
  -d '{"message": {"text": "/start", "from": {"id": 123, "first_name": "Test"}}}'
```

### اختبار إعداد البوت:
1. تأكد من أن البوت يرد على `/start`
2. تحقق من ظهور المشتركين في لوحة التحكم
3. جرب إرسال إشعار تجريبي

## 7. الأمان

- لا تشارك Bot Token مع أي شخص
- استخدم HTTPS دائماً للـ webhook
- قم بتغيير TELEGRAM_WEBHOOK_SECRET بشكل دوري
- راقب سجلات الإشعارات للكشف عن أي نشاط مشبوه

## 8. استكشاف الأخطاء

### البوت لا يستجيب:
- تأكد من صحة Bot Token
- تحقق من أن الـ webhook مُعد بشكل صحيح
- تأكد من أن السيرفر يعمل

### لا تصل الإشعارات:
- تحقق من أن المستخدم مشترك
- تأكد من عدم حظر البوت
- راجع سجلات الأخطاء في `/api/telegram/send-broadcast`

### أخطاء في قاعدة البيانات:
- تأكد من تطبيق جميع جداول SQL
- تحقق من صلاحيات RLS
- راجع سجلات Supabase

## مصادر مفيدة

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
