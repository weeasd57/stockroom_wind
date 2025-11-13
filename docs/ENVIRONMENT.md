# Environment Variables

This project uses environment variables to configure backend services and integrations. Create a `.env.local` from `.env.example` and populate with your values (never commit real secrets).

- **NEXT_PUBLIC_APP_URL**: Public base URL of your site (e.g., https://yourdomain.com)
- **NEXT_PUBLIC_DEMO_MODE**: `true` disables payments/webhooks and shows safe mock UI for demos

## Supabase
- **NEXT_PUBLIC_SUPABASE_URL**: Supabase project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabase anon key (client-side)
- **SUPABASE_SERVICE_ROLE_KEY**: Service role key (server-only, used in admin/cron endpoints)

## PayPal
- **PAYPAL_MODE**: `sandbox` or `live`
- Sandbox
  - **PAYPAL_SANDBOX_CLIENT_ID** / **PAYPAL_SANDBOX_CLIENT_SECRET**
  - **NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX** (frontend SDK)
  - **PAYPAL_SANDBOX_WEBHOOK_ID**
- Live
  - **PAYPAL_LIVE_CLIENT_ID** / **PAYPAL_LIVE_CLIENT_SECRET**
  - **NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE** (frontend SDK)
  - **PAYPAL_LIVE_WEBHOOK_ID**
- Legacy (fallbacks still supported)
  - **NEXT_PUBLIC_PAYPAL_CLIENT_ID**, **PAYPAL_CLIENT_SECRET**, **PAYPAL_WEBHOOK_ID**

## Telegram
- **TELEGRAMBOT_TOKEN** (or `TELEGRAM_BOT_TOKEN`): Bot token
- **TELEGRAM_WEBHOOK_SECRET**: Shared secret header for Telegram webhook
- Contact bridge (optional):
  - **TELEGRAM_CONTACT_BOT_TOKEN**, **TELEGRAM_CONTACT_CHAT_ID**

## Stocks API
- **NEXT_PUBLIC_EOD_API_KEY**: EODHD API key (used by server route `src/app/api/stocks/price/route.js`)

## Cron
- **CRON_SECRET**: Bearer token to protect `/api/cron/renew-subscriptions`

## Optional
- **GOOGLE_CLIENT_ID**, **GOOGLE_CLIENT_SECRET**
- **DEBUG**: `true/false`
