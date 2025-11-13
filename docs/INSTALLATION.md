# Installation Guide (Buyer)

This guide focuses on secure configuration and deployment. For local experimentation, configure `.env.local` but prefer deploying to a cloud provider (e.g., Vercel).

## 1) Prepare Supabase
1. Create a new Supabase project.
2. Copy project URL and anon key.
3. Open SQL editor and run the SQL files from `SQL _CODE/` (or the copied `sql/` folder in the release package) in order. Confirm tables like `profiles`, `posts`, `user_subscriptions`, `telegram_*` exist.

## 2) Configure Environment
1. Copy `.env.example` to `.env.local`.
2. Fill Supabase keys, PayPal (Sandbox first), Telegram, EODHD key, and `CRON_SECRET`.
3. Do not commit real secrets.

## 3) PayPal Setup (Sandbox)
- Create a PayPal Developer app, enable Checkout APIs.
- Set `PAYPAL_MODE=sandbox`.
- Provide client/secret and `NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX`.
- Create a Webhook in PayPal (events: payment + billing) pointing to `/api/webhooks/paypal`.
- Save `PAYPAL_SANDBOX_WEBHOOK_ID`.

## 4) Telegram Setup
- Create a bot via BotFather, get the token.
- Set `TELEGRAM_WEBHOOK_SECRET`.
- Deploy (see Deployment), then set webhook to `https://<your-domain>/api/telegram/webhook` with secret header.

## 5) Stocks API (EODHD)
- Get API key from eodhd.com and set `NEXT_PUBLIC_EOD_API_KEY`.

## 6) Demo Mode (Optional)
- Set `NEXT_PUBLIC_DEMO_MODE=true` to disable payments/webhooks and present safe demo behavior in UI.

Proceed to Deployment after completing configuration.
