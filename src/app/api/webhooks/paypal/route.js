/**
 * PayPal Webhook Route (Next.js App Router)
 *
 * Security:
 * - Verifies webhook signatures using the official @paypal/paypal-server-sdk.
 * - Get credentials based on environment
 * - PAYPAL_WEBHOOK_ID
 * - PAYPAL_MODE (optional: 'live'|'sandbox' overrides NODE_ENV)
 *
 * Behavior:
 * - POST /api/webhooks/paypal
 * - Responds 200 OK after successful verification.
 */

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // ensure no caching

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


// ---- Configuration & Env Validation ----
const {
  NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_WEBHOOK_ID,
  PAYPAL_MODE,
  NODE_ENV,
} = process.env;

function ensureEnv() {
  const missing = [];
  if (!NEXT_PUBLIC_PAYPAL_CLIENT_ID) missing.push('NEXT_PUBLIC_PAYPAL_CLIENT_ID');
  if (!PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');
  if (!PAYPAL_WEBHOOK_ID) missing.push('PAYPAL_WEBHOOK_ID');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const mode = (PAYPAL_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
console.log(`[PayPal] Using ${mode} mode${!PAYPAL_MODE ? ' (default)' : ''}`);

// The credentials work for both live and sandbox based on PAYPAL_MODE
const credentials = {
  clientId: NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  clientSecret: PAYPAL_CLIENT_SECRET,
  webhookId: PAYPAL_WEBHOOK_ID,
  mode
};

const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');

// ---- PayPal REST Helpers (manual, since SDK doesn't expose webhooks verify) ----
function paypalBaseUrl(mode) {
  // Use modern api-m domains per PayPal docs
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(targetMode) {
  const base = paypalBaseUrl(targetMode || mode);
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

  // Detect event environment from cert_url host
  let eventEnv = 'sandbox';
  try {
    const host = new URL(certUrl).hostname || '';
    eventEnv = host.includes('sandbox') ? 'sandbox' : 'live';
    console.log('[PayPal] Cert URL analysis', { 
      certUrl: certUrl,
      hostname: host,
      detectedEnv: eventEnv,
      configuredMode: mode
    });
  } catch (e) {
    console.warn('[PayPal] Failed to parse cert_url', { certUrl, error: e.message });
    // keep default sandbox if parsing fails
  }

  // Use detected environment from cert URL for verification
  // This ensures webhook signature verification works for both environments
  const verificationMode = eventEnv;
  const accessToken = await getAccessToken(verificationMode);
  const base = paypalBaseUrl(verificationMode);
  
  console.log(`[PayPal] Using ${verificationMode} mode for webhook verification (detected from cert URL)`);

  const payload = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: credentials.webhookId,
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
  console.log('[PayPal] verify-webhook-signature result', {
    verification_status: json?.verification_status,
  });
  if (json.verification_status !== 'SUCCESS') {
    const err = new Error('Invalid webhook signature');
    err.statusCode = 400;
    throw err;
  }
  return json;
}

// --- Diagnostics helpers (called only on failures) ---
async function listWebhooks(targetMode) {
  const base = paypalBaseUrl(targetMode || mode);
  const accessToken = await getAccessToken(targetMode || mode);
  const res = await fetch(`${base}/v1/notifications/webhooks`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to list webhooks (${res.status}): ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data?.webhooks) ? data.webhooks : [];
}

async function diagnoseWebhookConfigFromRequest(request) {
  const certUrl = request.headers.get('paypal-cert-url');
  let eventEnv = 'sandbox';
  try {
    const host = new URL(certUrl).hostname || '';
    eventEnv = host.includes('sandbox') ? 'sandbox' : 'live';
  } catch (_) {}

  try {
    // Use configured mode instead of auto-detected eventEnv
    const hooks = await listWebhooks(mode);
    const configuredId = credentials.webhookId;
    const found = hooks.find((h) => h?.id === configuredId);
    const summary = {
      eventEnv,
      configuredMode: mode,
      usingMode: mode,
      configuredIdSuffix: configuredId ? configuredId.slice(-6) : 'none',
      totalHooks: hooks.length,
      foundConfiguredId: !!found,
      matchedHookUrl: found?.url || null,
    };
    console.warn('[PayPal] Webhook config diagnostic', summary);
  } catch (e) {
    console.warn('[PayPal] Webhook config diagnostic failed:', e?.message || e);
  }
}

async function handleEvent(event) {
  try {
    const type = event?.event_type;
    const id = event?.id;
    console.log(`[PayPal] Verified event_id=${id} type=${type}`);

    // Check for idempotency
    const { data: existingEvent } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('paypal_event_id', id)
      .single();

    if (existingEvent) {
      console.log(`[PayPal] Event ${id} already processed, skipping`);
      return;
    }

    switch (type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        console.log('→ Checkout order approved:', event?.resource?.id);
        // Order approved, waiting for capture
        break;
      }
      case 'PAYMENT.CAPTURE.COMPLETED': {
        console.log('→ Payment capture completed:', event?.resource?.id);
        const orderId = event?.resource?.supplementary_data?.related_ids?.order_id;
        const captureId = event?.resource?.id;
        const amount = event?.resource?.amount?.value;
        const payerEmail = event?.resource?.payer?.email_address;
        
        if (payerEmail && amount) {
          // Find user by email
          const { data: userData } = await supabase.auth.admin.getUserByEmail(payerEmail);
          
          if (userData?.user) {
            // Get pro plan
            const { data: proPlan } = await supabase
              .from('subscription_plans')
              .select('id')
              .eq('name', 'pro')
              .single();
            
            if (proPlan) {
              // Cancel existing subscription
              await supabase
                .from('user_subscriptions')
                .update({ 
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString()
                })
                .eq('user_id', userData.user.id)
                .eq('status', 'active');
              
              // Create new pro subscription
              const { data: subscription } = await supabase
                .from('user_subscriptions')
                .insert({
                  user_id: userData.user.id,
                  plan_id: proPlan.id,
                  status: 'active',
                  paypal_order_id: orderId,
                  price_checks_used: 0,
                  posts_created: 0,
                  price_checks_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  posts_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                })
                .select()
                .single();
              
              // Log transaction
              await supabase
                .from('payment_transactions')
                .insert({
                  user_id: userData.user.id,
                  subscription_id: subscription?.id,
                  amount: parseFloat(amount),
                  currency: 'USD',
                  payment_method: 'paypal',
                  paypal_order_id: orderId,
                  paypal_capture_id: captureId,
                  paypal_event_id: id,
                  status: 'completed',
                  transaction_data: event
                });
              
              console.log(`→ Pro subscription activated for user ${userData.user.id}`);
            }
          }
        }
        break;
      }
      case 'PAYMENT.SALE.COMPLETED': {
        console.log('→ Payment sale completed:', event?.resource?.id);
        // Similar to capture completed
        break;
      }
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        console.log('→ Subscription activated:', event?.resource?.id);
        // Handle recurring subscription activation
        break;
      }
      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        console.log('→ Subscription cancelled:', event?.resource?.id);
        const subscriptionId = event?.resource?.id;
        
        if (subscriptionId) {
          await supabase
            .from('user_subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString()
            })
            .eq('paypal_subscription_id', subscriptionId);
        }
        break;
      }
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        console.log('→ Subscription expired:', event?.resource?.id);
        const subscriptionId = event?.resource?.id;
        
        if (subscriptionId) {
          await supabase
            .from('user_subscriptions')
            .update({
              status: 'expired',
              expired_at: new Date().toISOString()
            })
            .eq('paypal_subscription_id', subscriptionId);
        }
        break;
      }
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        console.log('→ Subscription payment failed:', event?.resource?.id);
        // Log failed payment attempt
        break;
      }
      default: {
        console.log('→ Unhandled event type:', type);
        break;
      }
    }
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
      mode: credentials.mode,
      nodeEnv: NODE_ENV,
      webhookIdSuffix: credentials.webhookId ? credentials.webhookId.slice(-6) : 'none',
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
    // Extra diagnostics to help identify config mismatches (non-fatal for response)
    try { await diagnoseWebhookConfigFromRequest(request); } catch (_) {}
    return new Response('Invalid webhook', { status: code });
  }
}
