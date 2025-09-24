#!/bin/bash

# اختبار إلغاء الاشتراك
echo "🧪 Testing Subscription Cancellation..."

# تحتاج لاستبدال COOKIE_VALUE بالـ session cookie الفعلي
COOKIE_VALUE="your-session-cookie-here"

curl -X POST http://localhost:3000/api/subscription/manage \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE_VALUE}" \
  -d '{
    "action": "cancel",
    "reason": "Testing from curl",
    "shouldCancelPayPal": true,
    "metadata": {
      "test": true,
      "source": "curl_test"
    }
  }' | jq '.'

echo -e "\n\n🔄 Testing Switch to Free..."

curl -X POST http://localhost:3000/api/subscription/manage \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE_VALUE}" \
  -d '{
    "action": "switch_to_free",
    "confirmCancellation": true,
    "reason": "Testing switch from curl",
    "shouldCancelPayPal": true
  }' | jq '.'

echo -e "\n\n🔍 Testing PayPal Sync..."

curl -X POST http://localhost:3000/api/subscription/manage \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE_VALUE}" \
  -d '{
    "action": "sync_with_paypal"
  }' | jq '.'
