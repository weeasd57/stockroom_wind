'use strict';

/**
 * PayPal Webhook Handler (Express)
 *
 * Security:
 * - Verifies webhook signatures using the official paypal-rest-sdk.
 * - Rejects requests missing required verification headers.
 *
 * Environment variables (sensitive):
 * - PAYPAL_CLIENT_ID
 * - PAYPAL_CLIENT_SECRET
 * - PAYPAL_WEBHOOK_ID
 * - PAYPAL_MODE (optional: 'live'|'sandbox' overrides NODE_ENV for SDK mode)
 *
 * Behavior:
 * - POST /api/webhooks/paypal
 * - Verifies signature, logs event, stubs TODO business logic, responds 200 OK on success.
 *
 * Notes:
 * - Mode: respects PAYPAL_MODE if set; else NODE_ENV: 'production' => 'live', otherwise 'sandbox'.
 * - Exports the Express app for testing; starts server only when run directly.
 */

// Load environment variables; prefer .env.local if present (Next.js style)
const path = require('path');
const fs = require('fs');
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

const express = require('express');
const paypal = require('paypal-rest-sdk');

// ---- Configuration & Env Validation ----
const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_WEBHOOK_ID,
  PAYPAL_MODE,
  NODE_ENV,
  PORT,
} = process.env;

function ensureEnv() {
  const missing = [];
  if (!PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
  if (!PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');
  if (!PAYPAL_WEBHOOK_ID) missing.push('PAYPAL_WEBHOOK_ID');
  if (missing.length) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    throw new Error(msg);
  }
}
ensureEnv();

const normalizedPAYPALMode = (PAYPAL_MODE || '').toLowerCase();
const mode =
  normalizedPAYPALMode === 'live'
    ? 'live'
    : normalizedPAYPALMode === 'sandbox'
    ? 'sandbox'
    : NODE_ENV === 'production'
    ? 'live'
    : 'sandbox';
paypal.configure({
  mode, // 'live' or 'sandbox'
  client_id: PAYPAL_CLIENT_ID,
  client_secret: PAYPAL_CLIENT_SECRET,
});

// ---- App Setup ----
const app = express();

// Only accept JSON; limit size to reduce risk of abuse
app.use(
  express.json({
    type: 'application/json',
    limit: '1mb',
  })
);

// Handle invalid JSON early
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).send('Payload too large');
  }
  if (err instanceof SyntaxError) {
    return res.status(400).send('Invalid JSON payload');
  }
  return next(err);
});

// Optional: basic health check
app.get('/healthz', (_req, res) => res.status(200).send('OK'));

// ---- PayPal Webhook Verification Helper ----
/**
 * Verifies PayPal webhook using paypal-rest-sdk.
 * Relies on PayPal verification headers and the event payload.
 * @param {import('express').Request} req
 * @returns {Promise<object>} verification response
 */
function verifyPaypalWebhook(req) {
  return new Promise((resolve, reject) => {
    const transmissionId = req.get('paypal-transmission-id');
    const transmissionTime = req.get('paypal-transmission-time');
    const certUrl = req.get('paypal-cert-url');
    const authAlgo = req.get('paypal-auth-algo');
    const transmissionSig = req.get('paypal-transmission-sig');

    // Validate presence of required headers
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

    // SDK calls PayPal's verify-webhook-signature under the hood
    paypal.notification.webhookEvent.verify(
      verificationHeaders,
      req.body, // webhook_event (JSON object)
      PAYPAL_WEBHOOK_ID, // your registered webhook ID
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

// ---- Event Dispatcher (runs after ACK) ----
function dispatchPaypalEvent(event) {
  try {
    const eventType = event?.event_type;
    const eventId = event?.id;
    console.log(`[PayPal] Processing event_id=${eventId} type=${eventType}`);

    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED': {
        console.log('→ Checkout order approved:', event?.resource?.id);
        // TODO: Capture the order if applicable, then mark the order as paid in your DB.
        // TODO: Enqueue fulfillment tasks (email, provisioning, etc.).
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        console.log('→ Payment sale completed:', event?.resource?.id);
        // TODO: Mark the associated invoice/order as paid and grant access.
        // TODO: Reconcile payment in your accounting system.
        break;
      }

      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        console.log('→ Subscription activated:', event?.resource?.id);
        // TODO: Provision user access for the new subscription.
        // TODO: Store subscription status = active with renewals metadata.
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        console.log('→ Subscription cancelled:', event?.resource?.id);
        // TODO: Schedule access removal at period end (or immediate if required).
        // TODO: Notify user and update subscription status in DB.
        break;
      }

      case 'BILLING.SUBSCRIPTION.CREATED': {
        console.log('→ Subscription created:', event?.resource?.id);
        // TODO: Initialize subscription record, await activation/payment to grant access.
        break;
      }

      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        console.log('→ Subscription expired:', event?.resource?.id);
        // TODO: Revoke access, notify user, and offer renewal options.
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        console.log('→ Subscription payment failed:', event?.resource?.id);
        // TODO: Start dunning flow, send email/SMS, set grace period if applicable.
        break;
      }

      case 'BILLING.SUBSCRIPTION.RE_ACTIVATED': {
        console.log('→ Subscription re-activated:', event?.resource?.id);
        // TODO: Restore user access and reset dunning flags.
        break;
      }

      // Some integrations may send a hyphenated variant
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED': {
        console.log('→ Subscription re-activated (hyphenated):', event?.resource?.id);
        // TODO: Restore user access and reset dunning flags.
        break;
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        console.log('→ Subscription suspended:', event?.resource?.id);
        // TODO: Temporarily restrict access; notify and guide user to resolve.
        break;
      }

      case 'BILLING.SUBSCRIPTION.UPDATED': {
        console.log('→ Subscription updated:', event?.resource?.id);
        // TODO: Sync plan/price/next billing date changes; adjust proration if needed.
        break;
      }

      default: {
        console.log('→ Unhandled event type:', eventType);
        // TODO: Optionally log to an observability tool or dead-letter queue.
        break;
      }
    }

    // TODO: Implement idempotency check using event.id to avoid duplicate processing.
  } catch (e) {
    console.error('[PayPal] Error processing event:', e?.message || e);
  }
}

// ---- Webhook Endpoint ----
app.post('/api/webhooks/paypal', async (req, res) => {
  try {
    // 1) Verify signature first
    await verifyPaypalWebhook(req);

    const event = req.body || {};
    const eventType = event.event_type;
    const eventId = event.id;

    console.log(`[PayPal] Verified event_id=${eventId} type=${eventType}`);

    // 2) Immediately acknowledge receipt per best practice
    res.status(200).send('OK');

    // 3) Process business logic asynchronously after ACK
    process.nextTick(() => dispatchPaypalEvent(event));
  } catch (err) {
    const code = err?.statusCode || 400;
    console.error('[PayPal] Webhook verification failed:', err?.message || err);
    return res.status(code).send('Invalid webhook');
  }
});

// Optional: explicit 405 for non-POST on webhook route
app.all('/api/webhooks/paypal', (_req, res) => res.sendStatus(405));

// Global error handler (fallback)
app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// Start server only if run directly (keeps it testable/importable)
if (require.main === module) {
  const port = Number(PORT) || 3000;
  app.listen(port, () => {
    console.log(`PayPal webhook server listening on port ${port} (mode=${mode})`);
  });
}

module.exports = { app };
