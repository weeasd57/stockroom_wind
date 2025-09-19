# PayPal Subscriptions Setup

This guide explains how to configure PayPal Subscriptions (Plans + Subscriptions) and unify environment variables for both client (SDK) and server (OAuth).

## 1) Environment Variables
Create `.env.local` in the project root (do NOT commit it) and set:

```
# PayPal mode: sandbox or live
PAYPAL_MODE=sandbox

# PayPal Client for server-side OAuth (use the same app as the client SDK)
PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_SANDBOX_SECRET

# PayPal Client for the browser SDK
NEXT_PUBLIC_PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID

# Optional: set a Plan ID to enable Subscription flow in the checkout page
NEXT_PUBLIC_PAYPAL_PLAN_ID=YOUR_SANDBOX_PLAN_ID
```

Notes:
- Make sure `PAYPAL_CLIENT_ID` and `NEXT_PUBLIC_PAYPAL_CLIENT_ID` refer to the same PayPal app (same account). Mixing different apps/accounts will lead to 422 and compliance errors.
- For Live, switch `PAYPAL_MODE=live` and provide live credentials. Live Client IDs often start with `A...`.

## 2) Create a PayPal Plan
You need to create both a Product and a Plan in your PayPal Developer account:

### Option A: Via PayPal Dashboard (Sandbox)
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/developer/applications/) 
2. Select your app → Products & Plans
3. Create Product:
   - Name: "SharksZone Pro Plan"
   - Type: "SERVICE" or "DIGITAL_GOODS"
   - Category: "SOFTWARE"
   - Description: "Monthly Pro subscription"
4. Create Plan:
   - Product: Select the product you just created
   - Plan Name: "Monthly Pro Plan"
   - Billing Cycles: 
     - Regular: $7.00 USD every 1 month, no trial
   - Setup fee: $0 (optional)
   - Click Create → Copy the `plan_id` (starts with `P-` for plans)
5. Put the `plan_id` in `.env.local` as `NEXT_PUBLIC_PAYPAL_PLAN_ID=P-xxxxx`

### Option B: Create via API (Use the helper endpoint)
We've added `/api/paypal/create-plan` - call it once to generate a plan programmatically.

### Common Issues:
- **INVALID_PARAMETER_SYNTAX**: Plan ID format wrong or from different environment
- **RESOURCE_NOT_FOUND**: Plan doesn't exist in current environment (sandbox/live)
- Make sure the plan is ACTIVE status before using it

## 3) Client: Checkout Page
The file `src/app/checkout/page.js` now supports two flows:
- If `NEXT_PUBLIC_PAYPAL_PLAN_ID` is set: subscription flow (`intent=subscription`, `vault=true`) using `createSubscription`.
- Otherwise: one-time payment flow using order `createOrder` + `capture`.

The subscription flow calls `POST /api/paypal/verify-subscription` to verify status (ACTIVE/APPROVAL_PENDING) and then upgrades the user to Pro by calling `upgradeToProSubscription` with `transaction_type='subscription'`.

## 4) Server: Verify Subscription
We added `src/app/api/paypal/verify-subscription/route.js` which:
- Uses `PAYPAL_MODE`, `PAYPAL_CLIENT_ID`, and `PAYPAL_CLIENT_SECRET` to request an OAuth token.
- Calls PayPal `GET /v1/billing/subscriptions/{id}` to retrieve subscription status.
- Returns structured errors (name, details, debug_id) on failure.

## 5) One-time Flow Improvements
- `src/app/api/paypal/capture-order/route.js` now surfaces detailed PayPal errors and uses explicit `PAYPAL_MODE`.
- The checkout page passes detailed payment info to `upgradeToProSubscription` for proper logging.

## 6) Troubleshooting
- `422 UNPROCESSABLE_ENTITY` with `COMPLIANCE_VIOLATION`: often compliance or account mismatch. Ensure client and server use the same PayPal app/account and try a different Sandbox buyer.
- `PAYEE_ACCOUNT_MISMATCH`: the order was created for a different merchant than the server OAuth credentials. Align both to the same app/account.
- `CANNOT_PAY_SELF`: do not pay to the same account you are logged in as.

## 7) Moving to Live
- Switch `PAYPAL_MODE=live` and set live credentials.
- Set `NEXT_PUBLIC_PAYPAL_CLIENT_ID` to the live client.
- Create a live plan and set `NEXT_PUBLIC_PAYPAL_PLAN_ID` to that plan id.
- Test with a real buyer in production.
