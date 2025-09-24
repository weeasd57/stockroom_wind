# Subscription Management System Documentation

## الملخص

تم توحيد نظام إلغاء الاشتراكات في التطبيق ليستخدم دالة واحدة موحدة بدلاً من تكرار نفس المنطق في أماكن متعددة.

## المشكلة السابقة

### كان لدينا 3 طرق مختلفة لإلغاء الاشتراك:

#### 1. `/api/subscription/cancel` 
- **الغرض**: إلغاء فوري بواسطة المستخدم
- **المشكلة**: لا يلغي من PayPal - يحدث قاعدة البيانات فقط

#### 2. `/api/subscription/switch-to-free`
- **الغرض**: التحويل للخطة المجانية مع تفاصيل
- **المشكلة**: كود مكرر + TODO لإلغاء PayPal

#### 3. `/webhooks/paypal` 
- **الغرض**: استقبال إشعارات إلغاء من PayPal
- **المشكلة**: يقرأ فقط - لا يلغي فعلياً من PayPal

## الحل الجديد

### تم إنشاء نظام موحد في `src/utils/subscription-manager.js`

#### **الميزات الرئيسية:**

1. **دالة موحدة**: `cancelSubscription()` تدير جميع حالات الإلغاء
2. **إلغاء PayPal حقيقي**: يستخدم PayPal REST API لإلغاء الاشتراك فعلياً  
3. **مرونة في الاستخدام**: يمكن تخصيص السلوك حسب المصدر
4. **تسجيل شامل**: يسجل جميع العمليات مع metadata مفصلة
5. **معالجة أخطاء قوية**: لا يفشل إذا فشل PayPal API

## كيفية الاستخدام

### استيراد الدالة
```javascript
import { cancelSubscription } from '@/utils/subscription-manager';
```

### الاستخدام الأساسي
```javascript
const result = await cancelSubscription({
  userId: 'user-id-here',
  reason: 'User requested cancellation',
  source: 'user_cancel_button',
  shouldCancelPayPal: true
});

if (result.success) {
  console.log('تم إلغاء الاشتراك بنجاح');
} else {
  console.error('فشل في إلغاء الاشتراك:', result.error);
}
```

### المعاملات المتاحة

| المعامل | النوع | مطلوب | الوصف |
|---------|------|-------|--------|
| `userId` | string | ✅ | معرف المستخدم |
| `reason` | string | ❌ | سبب الإلغاء |
| `source` | string | ❌ | مصدر الإلغاء |
| `paypalSubscriptionId` | string | ❌ | معرف اشتراك PayPal |
| `shouldCancelPayPal` | boolean | ❌ | هل يتم إلغاء PayPal؟ |
| `metadata` | object | ❌ | بيانات إضافية |

### قيم `source` المستخدمة

- `user_cancel_button` - من زر الإلغاء
- `user_switch_form` - من نموذج التحويل للمجاني  
- `paypal_webhook` - من webhook PayPal
- `paypal_webhook_refund` - من إشعار الاسترداد
- `admin` - من لوحة الإدارة
- `paypal_sync` - من مزامنة PayPal

## التحديثات على الـ Endpoints

### 1. `/api/subscription/cancel`
```javascript
// قبل: 100+ سطر من الكود المكرر
// بعد: استخدام الدالة الموحدة مع 5 أسطر فقط
const result = await cancelSubscription({
  userId: user.id,
  reason: 'User requested cancellation', 
  source: 'user_cancel_button',
  shouldCancelPayPal: true
});
```

### 2. `/api/subscription/switch-to-free`
```javascript
// قبل: كود مكرر + TODO لـ PayPal
// بعد: نفس الدالة مع source مختلف
const result = await cancelSubscription({
  userId: user.id,
  reason: reason || 'User switched to free plan',
  source: 'user_switch_form',
  shouldCancelPayPal: true
});
```

### 3. `/webhooks/paypal`
```javascript
// قبل: تحديث قاعدة البيانات فقط
// بعد: استخدام الدالة الموحدة
await cancelSubscription({
  userId: userSub.user_id,
  reason: 'PayPal subscription cancelled',
  source: 'paypal_webhook',
  shouldCancelPayPal: false // لأنه تم إلغاؤه من PayPal بالفعل
});
```

## الدوال المساعدة المتاحة

### 1. `validatePayPalSubscription(subscriptionId)`
```javascript
const validation = await validatePayPalSubscription('SUB-12345');
console.log(validation.valid); // true/false
console.log(validation.status); // 'ACTIVE', 'CANCELLED', etc.
```

### 2. `syncSubscriptionWithPayPal(userId)`
```javascript
const sync = await syncSubscriptionWithPayPal('user-id');
if (sync.synced && sync.changed) {
  console.log(`Status changed: ${sync.from} → ${sync.to}`);
}
```

## متطلبات البيئة

### متغيرات البيئة المطلوبة:
```env
# PayPal API
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret
PAYPAL_MODE=sandbox # أو live

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## الفوائد الجديدة

### ✅ **المشاكل المحلولة:**
1. **تكرار الكود** - دالة واحدة للجميع
2. **عدم إلغاء PayPal** - الآن يلغي فعلياً من PayPal
3. **عدم الاتساق** - نفس المنطق في كل مكان
4. **صعوبة الصيانة** - مكان واحد للتحديث

### ✅ **الميزات الجديدة:**
1. **إلغاء PayPal حقيقي** - يستخدم REST API
2. **تسجيل شامل** - كل العمليات مسجلة
3. **مرونة عالية** - يمكن تخصيص السلوك
4. **معالجة أخطاء قوية** - لا يفشل بسهولة

## الاختبار

### لاختبار النظام:
1. **إلغاء من التطبيق** - اضغط cancel في profile
2. **التحويل للمجاني** - استخدم switch to free form  
3. **إلغاء من PayPal** - ألغِ من لوحة PayPal
4. **طلب استرداد** - اطلب refund من PayPal

جميع الحالات ستستخدم نفس الدالة الموحدة وتعطي نتائج متسقة.

## الخطوات التالية

### يمكن إضافة:
1. **دعم اشتراكات متعددة** - إذا احتجت لخطط مختلفة
2. **جدولة الإلغاء** - إلغاء في تاريخ محدد
3. **إشعارات المستخدم** - إرسال ايميل عند الإلغاء
4. **تحليلات الإلغاء** - أسباب الإلغاء والإحصائيات

---

## الملخص النهائي

**السؤال الأصلي**: لماذا نحتاج 3 endpoints مختلفة؟

**الإجابة**: لم نعد نحتاجها! 

الآن لدينا نظام موحد يدير جميع حالات الإلغاء بطريقة ذكية ومتسقة، مع إلغاء حقيقي من PayPal وتسجيل شامل للعمليات.
