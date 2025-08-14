# إعداد Supabase للمشروع

## الخطوات المطلوبة

### 1. إنشاء مشروع Supabase
- اذهب إلى [https://supabase.com](https://supabase.com)
- سجل دخول أو أنشئ حساب جديد
- أنشئ مشروع جديد

### 2. الحصول على المفاتيح
- في لوحة التحكم، اذهب إلى **Settings** > **API**
- انسخ **Project URL** و **anon/public key**

### 3. إعداد المتغيرات البيئية
- انسخ ملف `.env.example` إلى `.env.local`
- استبدل القيم بالمفاتيح الفعلية:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

### 4. إنشاء قاعدة البيانات
- اذهب إلى **SQL Editor** في لوحة التحكم
- نفذ ملف `schema.sql` الموجود في المشروع

### 5. إعداد Storage Buckets
- اذهب إلى **Storage** في لوحة التحكم
- أنشئ Buckets التالية:
  - `avatars` - لصور الملفات الشخصية
  - `backgrounds` - لصور الخلفية
  - `post_images` - لصور المنشورات

### 6. اختبار الاتصال
- شغل المشروع: `npm run dev`
- تحقق من وحدة التحكم للتأكد من عدم وجود أخطاء في الاتصال

## ملاحظات مهمة
- **لا تشارك** ملف `.env.local` أبداً
- الملف محمي في `.gitignore`
- استخدم دائماً **anon key** وليس **service role key** في الواجهة الأمامية

## استكشاف الأخطاء
إذا واجهت مشاكل في الاتصال:
1. تحقق من صحة المفاتيح
2. تأكد من أن المشروع نشط
3. تحقق من إعدادات RLS (Row Level Security)
4. راجع سجلات المشروع في Supabase