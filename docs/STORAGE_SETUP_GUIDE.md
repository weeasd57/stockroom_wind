# دليل إعداد Supabase Storage لرفع الصور

## الخطوات المطلوبة لإعداد Storage Buckets

### 1. إنشاء Bucket للصور

1. افتح **Supabase Dashboard**
2. اذهب إلى قسم **Storage** من القائمة الجانبية
3. اضغط على **New bucket**
4. أدخل المعلومات التالية:
   - **Name**: `post_images`
   - **Public bucket**: ✅ (مُفعّل)
   - اضغط **Create bucket**

### 2. إعداد سياسات الـ Storage

بعد إنشاء الـ bucket، تحتاج لإضافة السياسات التالية:

1. اضغط على bucket `post_images`
2. اذهب إلى تبويب **Policies**
3. اضغط **New Policy** وأضف السياسات التالية:

#### Policy 1: السماح للمستخدمين المُصادق عليهم برفع الصور
- **Name**: `Allow authenticated uploads`
- **Operation**: INSERT
- **Policy definition**:
```sql
(bucket_id = 'post_images'::text) AND (auth.role() = 'authenticated'::text)
```

#### Policy 2: السماح بالقراءة العامة للصور
- **Name**: `Public read access`
- **Operation**: SELECT
- **Policy definition**:
```sql
bucket_id = 'post_images'::text
```

#### Policy 3: السماح للمستخدمين بتحديث صورهم
- **Name**: `Allow authenticated updates`
- **Operation**: UPDATE
- **Policy definition**:
```sql
(bucket_id = 'post_images'::text) AND (auth.role() = 'authenticated'::text)
```

#### Policy 4: السماح للمستخدمين بحذف صورهم
- **Name**: `Allow authenticated deletes`
- **Operation**: DELETE
- **Policy definition**:
```sql
(bucket_id = 'post_images'::text) AND (auth.role() = 'authenticated'::text)
```

### 3. التحقق من الإعدادات

للتأكد من أن كل شيء يعمل بشكل صحيح:

1. اذهب إلى **SQL Editor** في Supabase Dashboard
2. شغّل هذا الاستعلام:
```sql
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
WHERE name = 'post_images';
```

يجب أن ترى bucket `post_images` مع `public = true`

### 4. اختبار رفع الصور

1. قم بتسجيل الدخول في التطبيق
2. اذهب لصفحة إنشاء منشور
3. اختر صورة من جهازك
4. املأ باقي البيانات المطلوبة
5. اضغط على "نشر"

### 5. التحقق من Console Logs

افتح Developer Console في المتصفح (F12) وابحث عن هذه الرسائل:

```
[uploadPostImageEnhanced] Upload successful
[BackgroundPostCreation] Post payload with image_url
[PostProvider] Creating post with data
[SupabaseProvider] Inserting post with data
[SupabaseProvider] Insert result
```

### 6. التحقق من قاعدة البيانات

في SQL Editor، شغّل:
```sql
SELECT 
    id,
    title,
    image_url,
    created_at
FROM posts
WHERE image_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

## حل المشاكل الشائعة

### المشكلة: "Bucket not found"
**الحل**: تأكد من إنشاء bucket `post_images` كما هو موضح في الخطوة 1

### المشكلة: "Policy violation"
**الحل**: تأكد من إضافة جميع السياسات الأربعة كما هو موضح في الخطوة 2

### المشكلة: الصورة ترفع لكن لا تُحفظ في قاعدة البيانات
**الحل**: تحقق من Console Logs للبحث عن أي أخطاء في عملية الإدراج

### المشكلة: "new row violates row-level security policy"
**الحل**: تأكد من أن المستخدم مُصادق عليه وأن `user_id` في المنشور يطابق `auth.uid()`

## ملاحظات مهمة

- الصور يتم ضغطها تلقائياً قبل الرفع لتوفير المساحة
- الحد الأقصى لحجم الصورة بعد الضغط هو 1MB
- الصور المدعومة: JPEG, PNG, GIF, WebP
- يتم حفظ الصور في مسار: `post_images/[userId]/[timestamp]_[filename]`

## الكود المُحدّث

تم تحديث الملفات التالية لإصلاح مشكلة رفع الصور:

1. **BackgroundPostCreationProvider.tsx**: إضافة logs لتتبع عملية الرفع
2. **PostProvider.tsx**: إضافة logs لتتبع إنشاء المنشور
3. **SupabaseProvider.tsx**: إضافة logs لتتبع الإدراج في قاعدة البيانات
4. **imageUpload.js**: إصلاح خطأ في الكود وإضافة logs

## للمساعدة

إذا واجهت أي مشاكل، تحقق من:
1. Console Logs في المتصفح
2. Network tab لرؤية طلبات API
3. Supabase Dashboard > Logs للتحقق من أخطاء الخادم

---

# Operational Runbook: Image Storage and URL Persistence

When image uploads succeed but posts end up without an `image_url`, or uploads fail due to storage configuration, use this checklist.

## Symptoms

- Image file appears in Storage, but `posts.image_url` is `NULL`.
- Upload fails with bucket/policy errors.
- UI shows image preview, but created post has no image.
- Network shows Storage upload success, but DB insert payload lacks `image_url`.

## Quick Triage (3–5 min)

1. Console: find `[uploadPostImageEnhanced]` and `[handleSubmit DEBUG] Post data being queued:`. Ensure `image_url` is an http(s) URL.
2. Background flow: `BackgroundPostCreationProvider` should log the final public URL or the existing URL when not uploading.
3. DB: verify `posts.image_url` column exists and type is `TEXT`.
4. Storage: bucket `post_images` exists and is Public; policies allow authenticated INSERT/SELECT.

## Bucket & Policy Verification

- Bucket name: `post_images` (Public = true)
- Path convention: `post_images/{userId}/{timestamp}_{filename}`
- Policies (see `SQL _CODE/storage_policies.sql`):

```sql
-- Public read
-- SELECT policy example:
-- bucket_id = 'post_images'

-- Authenticated writes
-- INSERT/UPDATE/DELETE policy example:
-- (bucket_id = 'post_images') AND auth.role() = 'authenticated'
```

## SQL Checks

```sql
-- Column exists and type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'posts' AND column_name = 'image_url';

-- Latest posts with image_url
SELECT id, image_url, created_at
FROM posts
WHERE image_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Find invalid (non-http) URLs
SELECT id, image_url FROM posts
WHERE image_url IS NOT NULL AND image_url NOT LIKE 'http%';
```

If missing, add the column or apply your migration (see `SQL _CODE/schema.sql`):

```sql
ALTER TABLE posts ADD COLUMN image_url TEXT;
```

## Client Integration Notes

- Persist only public http(s) URLs to `posts.image_url`. Never save `blob:`/`data:` preview URLs.
- The source of truth for the URL should be the upload result or a validated existing URL.
- Relevant code paths:
  - `src/components/posts/CreatePostForm.js` (builds `postData`, queues background task)
  - `src/providers/BackgroundPostCreationProvider.tsx` (uploads/derives final public URL)
  - `src/providers/SupabaseProvider.tsx` (inserts post into DB)
- Ensure `postData` uses `image_url` (exact field name).

Example expectation in background flow:

```ts
postData.image_url = uploadResult.publicUrl ?? existingImageUrl ?? null;
```

## Recovery Steps

- If a post was created without an image URL but the file exists in Storage, manually update it:

```sql
UPDATE posts
SET image_url = 'https://<your-supabase-domain>/storage/v1/object/public/post_images/<userId>/<file>'
WHERE id = '<post_id>';
```

## Verification Checklist

- [ ] New post with image has non-null `posts.image_url`.
- [ ] URL begins with `http` and resolves publicly.
- [ ] Console logs show upload success and DB insert payload includes `image_url`.
- [ ] Supabase Storage policies allow public read and authenticated writes for `post_images`.

## References

- Schema: `SQL _CODE/schema.sql`
- Policies: `SQL _CODE/storage_policies.sql`
- Upload flow: `docs/IMAGE_UPLOAD_SYSTEM.md`
