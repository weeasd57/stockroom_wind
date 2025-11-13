# SharksZone – Social Trading & Stock Analysis (Next.js + Supabase)

Welcome! This package contains the source code for SharksZone. Please read the docs in the `docs/` folder:

- docs/ENVIRONMENT.md – Full list of environment variables
- docs/INSTALLATION.md – How to configure Supabase, PayPal, Telegram, EODHD
- docs/DEPLOYMENT.md – Deployment to Vercel + webhooks and cron
- docs/TESTING.md – cURL test commands to verify endpoints
- docs/BRANDING.md – How to change logo, colors, and text

Security note: Never share your `.env.local`. Rotate secrets after tests.

To prepare a distributable folder (no secrets), run:
```
node scripts/prepare-codecanyon.js
```
Then zip `dist/codecanyon/sharkszone` for CodeCanyon.
