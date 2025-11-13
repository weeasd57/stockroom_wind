# Deployment Guide

We recommend deploying to Vercel.

## Environment
- Add all variables from `.env.example` to your Vercel project settings.
- Ensure `NEXT_PUBLIC_APP_URL` matches your production domain.

## Vercel Cron
- `vercel.json` includes a daily cron hitting `/api/cron/renew-subscriptions`.
- Protect it with `CRON_SECRET` and configure the deployment to send the header `Authorization: Bearer <CRON_SECRET>` if using external schedulers.

## PayPal Webhook
- Configure PayPal Webhook URL: `https://<your-domain>/api/webhooks/paypal`.
- Set the correct Webhook ID env var (sandbox/live accordingly).

## Telegram Webhook
- Set Telegram webhook to: `https://<your-domain>/api/telegram/webhook`.
- Provide header `X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>`.

## Notes
- If `NEXT_PUBLIC_DEMO_MODE=true`, payments are disabled on the Checkout page and PayPal routes should not be used for real transactions.
- Keep Service Role key server-side only.
