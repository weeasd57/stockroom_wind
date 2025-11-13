# Testing (cURL)

Replace `<domain>` with your deployment domain.

- Home: `curl -I https://<domain>/`
- Login: `curl -I https://<domain>/login`
- Traders: `curl -I https://<domain>/traders`
- Profile: `curl -I https://<domain>/profile`
- Pricing: `curl -I https://<domain>/pricing`
- API Subscription Info (logged out): `curl -i https://<domain>/api/subscription/info` (expect 401)
- PayPal Webhook (should be POST only): `curl -I https://<domain>/api/webhooks/paypal`
- Telegram Webhook Status (if implemented): `curl -i https://<domain>/api/telegram/webhook/status`
- Cron Endpoint (protected): `curl -H "Authorization: Bearer <CRON_SECRET>" -i https://<domain>/api/cron/renew-subscriptions`
- 404 Test: `curl -I https://<domain>/nonexistent`

Check response headers and status codes. Confirm CSP headers if you add a CSP.
