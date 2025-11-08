# Monthly & Yearly Subscription System

## Overview
This document explains the complete implementation of monthly and yearly subscription billing periods with automatic renewal for monthly subscriptions.

---

## 🎯 Features

### 1. **Monthly Subscriptions**
- **Price**: $7/month
- **Duration**: 30 days
- **Auto-Renewal**: ✅ Automatic (renews every month without user action)
- **Expiry Behavior**: Subscription extends by 1 month automatically
- **Usage Reset**: Price checks and post limits reset monthly

### 2. **Yearly Subscriptions**
- **Price**: $70/year (save $14 vs monthly)
- **Duration**: 365 days
- **Auto-Renewal**: ❌ Manual (user must renew after 1 year)
- **Expiry Behavior**: Subscription expires after 1 year
- **Usage Reset**: Price checks and post limits reset yearly

---

## 📁 Database Schema Changes

### New Field: `billing_period`

**Migration File**: `SQL _CODE/subscription/add_billing_period.sql`

```sql
ALTER TABLE user_subscriptions 
ADD COLUMN billing_period VARCHAR(20) DEFAULT 'monthly' 
CHECK (billing_period IN ('monthly', 'yearly'));
```

**Fields Added**:
- `billing_period`: `'monthly'` or `'yearly'`
- Index for performance: `idx_user_subscriptions_billing_period`

---

## 🔧 API Updates

### 1. **POST /api/checkout/confirm**

**Request Body**:
```json
{
  "orderId": "5K760005VE523691F",
  "captureId": "6BW93612ND079744X",
  "amount": 7.00,  // or 70.00 for yearly
  "billingPeriod": "monthly"  // or "yearly"
}
```

**Response**:
```json
{
  "success": true,
  "subscription": { ... },
  "billingPeriod": "monthly",
  "expiresAt": "2025-12-08T14:15:22.749Z"
}
```

**Validation**:
- Monthly: $7.00
- Yearly: $70.00
- Throws error if amount doesn't match billing period

---

### 2. **POST /api/subscription/upgrade**

**Request Body**:
```json
{
  "orderId": "5K760005VE523691F",
  "captureId": "6BW93612ND079744X",
  "amount": 70.00,
  "billingPeriod": "yearly"
}
```

**Behavior**:
- Cancels existing subscription
- Creates new Pro subscription with correct expiry
- Resets usage counters

---

### 3. **POST /api/webhooks/paypal**

**Auto-Detection**:
- Detects billing period from payment amount:
  - `amount >= 70` → yearly
  - `amount < 70` → monthly

**Webhook Events**:
- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`

---

### 4. **GET /api/cron/renew-subscriptions** (NEW)

**Purpose**: Automatic subscription management

**Runs Daily**: Every day at 00:00 UTC

**Actions**:
1. **Renew Monthly**: Auto-extends monthly subscriptions by 30 days
2. **Expire Yearly**: Marks expired yearly subscriptions as `'expired'`

**Security**:
```bash
Authorization: Bearer <CRON_SECRET>
```

**Response**:
```json
{
  "success": true,
  "timestamp": "2025-11-08T00:00:00.000Z",
  "results": {
    "monthly_renewed": 15,
    "yearly_expired": 3
  },
  "statistics": [
    {
      "billing_period": "monthly",
      "total_subscriptions": 120,
      "active_subscriptions": 95
    },
    {
      "billing_period": "yearly",
      "total_subscriptions": 45,
      "active_subscriptions": 38
    }
  ]
}
```

---

## 🔄 Database Functions

### 1. **calculate_subscription_expiry()**

```sql
SELECT calculate_subscription_expiry(NOW(), 'monthly');
-- Returns: NOW() + 1 month

SELECT calculate_subscription_expiry(NOW(), 'yearly');
-- Returns: NOW() + 1 year
```

---

### 2. **renew_monthly_subscriptions()**

**What it does**:
- Finds monthly subscriptions expiring within 1 day
- Extends `expires_at` by 1 month
- Resets `price_checks_used` and `posts_created` to 0
- Updates reset timestamps

**Usage**:
```sql
SELECT * FROM renew_monthly_subscriptions();
-- Returns: { renewed_count: 15 }
```

---

### 3. **expire_yearly_subscriptions()**

**What it does**:
- Finds yearly subscriptions past expiry date
- Updates status to `'expired'`

**Usage**:
```sql
SELECT * FROM expire_yearly_subscriptions();
-- Returns: { expired_count: 3 }
```

---

### 4. **get_subscription_info()** (Updated)

**Now includes**:
- `billing_period` field
- Correct expiry calculations

**Response**:
```json
{
  "user_id": "9cfe737f-2b0d-4947-ac9b-90c193d7c735",
  "plan_name": "pro",
  "billing_period": "yearly",
  "start_date": "2025-11-08T14:15:22.749Z",
  "end_date": "2026-11-08T14:15:22.749Z",
  "price_check_limit": 300,
  "price_checks_used": 0
}
```

---

## ⚙️ Setup Instructions

### 1. **Run Database Migration**

```bash
# Connect to your Supabase project
psql -U postgres -h db.your-project.supabase.co

# Run migration
\i SQL_CODE/subscription/add_billing_period.sql
```

---

### 2. **Set Environment Variables**

Add to `.env.local`:
```bash
CRON_SECRET=your-secure-random-secret-here
```

Generate secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 3. **Deploy to Vercel**

**File**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/renew-subscriptions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Deploy**:
```bash
vercel --prod
```

---

### 4. **Test Cron Job Manually**

```bash
curl -X GET https://your-app.vercel.app/api/cron/renew-subscriptions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 📊 Subscription Lifecycle

### Monthly Subscription Flow

```
Day 0:  User subscribes → status: 'active', expires_at: Day 30
Day 29: Cron runs → extends expires_at to Day 60, resets usage
Day 59: Cron runs → extends expires_at to Day 90, resets usage
...continues indefinitely
```

### Yearly Subscription Flow

```
Day 0:   User subscribes → status: 'active', expires_at: Day 365
Day 364: No action (1 day before expiry)
Day 365: Cron runs → status: 'expired'
```

---

## 🧪 Testing

### Test Monthly Subscription

```sql
-- Create test monthly subscription
INSERT INTO user_subscriptions (
  user_id, plan_id, status, billing_period, 
  started_at, expires_at
) VALUES (
  'test-user-id',
  (SELECT id FROM subscription_plans WHERE name = 'pro'),
  'active',
  'monthly',
  NOW(),
  NOW() + INTERVAL '1 day'  -- Will be renewed by cron
);

-- Run cron manually
SELECT * FROM renew_monthly_subscriptions();

-- Check result
SELECT expires_at FROM user_subscriptions WHERE user_id = 'test-user-id';
-- Should be extended by 1 month
```

---

### Test Yearly Subscription

```sql
-- Create test yearly subscription (already expired)
INSERT INTO user_subscriptions (
  user_id, plan_id, status, billing_period,
  started_at, expires_at
) VALUES (
  'test-user-id-2',
  (SELECT id FROM subscription_plans WHERE name = 'pro'),
  'active',
  'yearly',
  NOW() - INTERVAL '366 days',
  NOW() - INTERVAL '1 day'  -- Already expired
);

-- Run cron manually
SELECT * FROM expire_yearly_subscriptions();

-- Check result
SELECT status FROM user_subscriptions WHERE user_id = 'test-user-id-2';
-- Should be 'expired'
```

---

## 📈 Monitoring

### View Subscription Statistics

```sql
SELECT * FROM subscription_stats;
```

**Output**:
```
billing_period | total_subscriptions | active | expired | cancelled
---------------|---------------------|--------|---------|----------
monthly        | 120                 | 95     | 10      | 15
yearly         | 45                  | 38     | 5       | 2
```

---

### Check Upcoming Renewals

```sql
-- Monthly subscriptions expiring in next 7 days
SELECT user_id, expires_at 
FROM user_subscriptions
WHERE status = 'active'
AND billing_period = 'monthly'
AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY expires_at;
```

---

### Check Expired Yearly Subscriptions

```sql
SELECT user_id, expires_at
FROM user_subscriptions
WHERE status = 'expired'
AND billing_period = 'yearly'
ORDER BY expires_at DESC;
```

---

## ⚠️ Important Notes

### 1. **Cron Job Timing**
- Runs daily at 00:00 UTC
- Monthly renewals happen 1 day before expiry
- Yearly expirations happen on exact expiry date

### 2. **Usage Reset**
- Monthly: Resets every 30 days automatically
- Yearly: Resets every 365 days automatically

### 3. **Payment Integration**
- Monthly: Auto-charges every month (implement with PayPal subscriptions)
- Yearly: One-time charge for full year

### 4. **Security**
- Always use CRON_SECRET for cron endpoints
- Never expose admin endpoints publicly
- Validate billing_period in all APIs

---

## 🔍 Troubleshooting

### Monthly subscriptions not renewing?

1. Check cron job is running:
```bash
curl -X GET https://your-app.vercel.app/api/cron/renew-subscriptions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

2. Check database function:
```sql
SELECT * FROM renew_monthly_subscriptions();
```

3. Verify expires_at timestamps:
```sql
SELECT user_id, expires_at, billing_period 
FROM user_subscriptions 
WHERE status = 'active' AND billing_period = 'monthly';
```

---

### Yearly subscriptions not expiring?

1. Check cron job output
2. Verify function:
```sql
SELECT * FROM expire_yearly_subscriptions();
```

3. Check for subscriptions past expiry:
```sql
SELECT user_id, expires_at 
FROM user_subscriptions 
WHERE status = 'active' 
AND billing_period = 'yearly' 
AND expires_at <= NOW();
```

---

## 📝 Summary

✅ **Implemented**:
- Monthly subscriptions with auto-renewal
- Yearly subscriptions with manual renewal
- Automatic cron job for subscription management
- Full API support for both billing periods
- Database functions for renewal logic
- Monitoring and statistics

✅ **Next Steps**:
1. Run database migration
2. Deploy to Vercel with cron configuration
3. Set CRON_SECRET environment variable
4. Test with real subscriptions
5. Monitor cron job logs

---

**Last Updated**: 2025-11-08
**Version**: 1.0.0
