/**
 * PayPal Webhook Route (Next.js App Router)
 *
 * Security:
 * - Verifies webhook signatures using the official paypal-rest-sdk.
 *
 * Environment variables:
 * - PAYPAL_CLIENT_ID
 * - PAYPAL_CLIENT_SECRET
 * - PAYPAL_WEBHOOK_ID
 * - PAYPAL_MODE (optional: 'live'|'sandbox' overrides NODE_ENV)
 *
 * Behavior:
 * - POST /api/webhooks/paypal
 * - Responds 200 OK after successful verification.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // ensure no caching

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const paypal = require('paypal-rest-sdk');

// ---- Configuration & Env Validation ----
const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_WEBHOOK_ID,
  PAYPAL_MODE,
  NODE_ENV,
} = process.env;

function ensureEnv() {
  const missing = [];
  if (!PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
  if (!PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');
  if (!PAYPAL_WEBHOOK_ID) missing.push('PAYPAL_WEBHOOK_ID');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
ensureEnv();

const normalizedMode = (PAYPAL_MODE || 'sandbox').toLowerCase();
// Default to 'sandbox' if PAYPAL_MODE is not provided, regardless of NODE_ENV.
// This prevents accidental 'live' verification during testing on production infra.
const mode = normalizedMode === 'live' ? 'live' : 'sandbox';
if (!PAYPAL_MODE) {
  console.warn('[PayPal] PAYPAL_MODE is not set. Falling back to "sandbox".');
}

paypal.configure({
  mode, // 'live' or 'sandbox'
  client_id: PAYPAL_CLIENT_ID,
  client_secret: PAYPAL_CLIENT_SECRET,
});

// ---- Verification Helper ----
async function verifyPaypalWebhook(request, body) {
  return new Promise((resolve, reject) => {
    const transmissionId = request.headers.get('paypal-transmission-id');
    const transmissionTime = request.headers.get('paypal-transmission-time');
    const certUrl = request.headers.get('paypal-cert-url');
    const authAlgo = request.headers.get('paypal-auth-algo');
    const transmissionSig = request.headers.get('paypal-transmission-sig');

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      const err = new Error('Missing PayPal verification headers');
      err.statusCode = 400;
      return reject(err);
    }

    const verificationHeaders = {
      'paypal-transmission-id': transmissionId,
      'paypal-transmission-time': transmissionTime,
      'paypal-transmission-sig': transmissionSig,
      'paypal-cert-url': certUrl,
      'paypal-auth-algo': authAlgo,
    };

    paypal.notification.webhookEvent.verify(
      verificationHeaders,
      body, // JSON object
      PAYPAL_WEBHOOK_ID,
      (error, response) => {
        if (error) return reject(error);
        if (response && response.verification_status === 'SUCCESS') {
          return resolve(response);
        }
        const err = new Error('Invalid webhook signature');
        err.statusCode = 400;
        return reject(err);
      }
    );
  });
}

function handleEvent(event) {
  try {
    const type = event?.event_type;
    const id = event?.id;
    console.log(`[PayPal] Verified event_id=${id} type=${type}`);

    switch (type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        console.log('→ Checkout order approved:', event?.resource?.id);
        // TODO: Capture the order and mark as paid in your DB.
        break;
      }
      case 'PAYMENT.SALE.COMPLETED': {
        console.log('→ Payment sale completed:', event?.resource?.id);
        // TODO: Mark invoice/order paid and provision access.
        break;
      }
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        console.log('→ Subscription activated:', event?.resource?.id);
        // TODO: Provision user access for the subscription.
        break;
      }
      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        console.log('→ Subscription cancelled:', event?.resource?.id);
        // TODO: Schedule access removal and notify user.
        break;
      }
      case 'BILLING.SUBSCRIPTION.CREATED': {
        console.log('→ Subscription created:', event?.resource?.id);
        // TODO: Initialize subscription record.
        break;
      }
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        console.log('→ Subscription expired:', event?.resource?.id);
        // TODO: Revoke access and notify user.
        break;
      }
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        console.log('→ Subscription payment failed:', event?.resource?.id);
        // TODO: Start dunning flow and apply grace period if needed.
        break;
      }
      case 'BILLING.SUBSCRIPTION.RE_ACTIVATED':
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED': {
        console.log('→ Subscription re-activated:', event?.resource?.id);
        // TODO: Restore user access and reset dunning flags.
        break;
      }
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        console.log('→ Subscription suspended:', event?.resource?.id);
        // TODO: Temporarily restrict access and notify user.
        break;
      }
      case 'BILLING.SUBSCRIPTION.UPDATED': {
        console.log('→ Subscription updated:', event?.resource?.id);
        // TODO: Sync plan/price/next billing date changes.
        break;
      }
      default: {
        console.log('→ Unhandled event type:', type);
        // TODO: Optionally log to monitoring or DLQ.
        break;
      }
    }

    // TODO: Implement idempotency using event.id to avoid duplicate processing.
  } catch (e) {
    console.error('[PayPal] Error handling event:', e?.message || e);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    // Diagnostic log (safe): print selected mode and a masked webhook id suffix
    console.log('[PayPal] Diagnostic', {
      mode,
      nodeEnv: NODE_ENV,
      webhookIdSuffix: PAYPAL_WEBHOOK_ID ? PAYPAL_WEBHOOK_ID.slice(-6) : 'none',
    });

    // Verify signature
    await verifyPaypalWebhook(request, body);

    // Light, synchronous handling (keep minimal in serverless)
    handleEvent(body);

    return new Response('OK', { status: 200 });
  } catch (err) {
    const code = err?.statusCode || 400;
    console.error('[PayPal] Webhook verification failed:', err?.message || err);
    return new Response('Invalid webhook', { status: code });
  }
}
