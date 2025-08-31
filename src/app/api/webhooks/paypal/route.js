/**
 * PayPal Webhook Route (Next.js App Router)
 *
 * Security:
 * - Verifies webhook signatures using the official @paypal/paypal-server-sdk.
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

const normalizedMode = (PAYPAL_MODE || 'sandbox').toLowerCase();
// Default to 'sandbox' if PAYPAL_MODE is not provided, regardless of NODE_ENV.
// This prevents accidental 'live' verification during testing on production infra.
const mode = normalizedMode === 'live' ? 'live' : 'sandbox';
if (!PAYPAL_MODE) {
  console.warn('[PayPal] PAYPAL_MODE is not set. Falling back to "sandbox".');
}

// ---- PayPal REST Helpers (manual, since SDK doesn't expose webhooks verify) ----
function paypalBaseUrl(mode) {
  return mode === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';
}

async function getAccessToken() {
  const base = paypalBaseUrl(mode);
  const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to obtain PayPal access token (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ---- Verification Helper ----
async function verifyPaypalWebhook(request, body) {
  // Required headers from PayPal
  const transmissionId = request.headers.get('paypal-transmission-id');
  const transmissionTime = request.headers.get('paypal-transmission-time');
  const certUrl = request.headers.get('paypal-cert-url');
  const authAlgo = request.headers.get('paypal-auth-algo');
  const transmissionSig = request.headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    const err = new Error('Missing PayPal verification headers');
    err.statusCode = 400;
    throw err;
  }

  const accessToken = await getAccessToken();
  const base = paypalBaseUrl(mode);

  const payload = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: PAYPAL_WEBHOOK_ID,
    webhook_event: body,
  };

  const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`PayPal verify-webhook-signature HTTP ${res.status}: ${text}`);
    err.statusCode = 400;
    throw err;
  }
  const json = await res.json();
  if (json.verification_status !== 'SUCCESS') {
    const err = new Error('Invalid webhook signature');
    err.statusCode = 400;
    throw err;
  }
  return json;
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
    // Validate env at request time (avoid build-time failures)
    ensureEnv();
    // Read raw body first (best practice for webhook handlers)
    const raw = await request.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      console.error('[PayPal] Invalid JSON body');
      return new Response('Invalid JSON', { status: 400 });
    }
    // Diagnostic log (safe): print selected mode and a masked webhook id suffix
    console.log('[PayPal] Diagnostic', {
      mode,
      nodeEnv: NODE_ENV,
      webhookIdSuffix: PAYPAL_WEBHOOK_ID ? PAYPAL_WEBHOOK_ID.slice(-6) : 'none',
    });

    // Light diagnostics for headers presence (no secrets)
    const diagHeaders = {
      hasTransmissionId: !!request.headers.get('paypal-transmission-id'),
      hasTransmissionTime: !!request.headers.get('paypal-transmission-time'),
      hasCertUrl: !!request.headers.get('paypal-cert-url'),
      hasAuthAlgo: !!request.headers.get('paypal-auth-algo'),
      hasTransmissionSig: !!request.headers.get('paypal-transmission-sig'),
    };
    console.log('[PayPal] Header presence', diagHeaders);

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
