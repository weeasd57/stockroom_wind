import { NextResponse } from 'next/server';

// PayPal API base URLs
// Prefer explicit PAYPAL_MODE to avoid coupling to NODE_ENV.
// PAYPAL_MODE should be either 'live' or 'sandbox' (defaults to 'sandbox').
const PAYPAL_MODE = ((process.env.PAYPAL_MODE || process.env.NEXT_PUBLIC_PAYPAL_MODE || 'sandbox').toLowerCase() === 'live') ? 'live' : 'sandbox';
const PAYPAL_BASE = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function getCredentials() {
  const isLive = PAYPAL_MODE === 'live';
  const clientId = isLive
    ? (process.env.PAYPAL_LIVE_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE || process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)
    : (process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX || process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);
  const clientSecret = isLive
    ? (process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET)
    : (process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET);
  return { clientId, clientSecret };
}

// Get PayPal access token (server credentials only)
async function getPayPalAccessToken() {
  const { clientId, clientSecret } = getCredentials();

  console.log('[VerifySubscription] PayPal credentials check:', {
    mode: PAYPAL_MODE,
    clientId: clientId ? 'Present' : 'Missing',
    clientSecret: clientSecret ? 'Present' : 'Missing'
  });

  if (!clientId) {
    throw new Error('PayPal Client ID not configured');
  }
  if (!clientSecret) {
    throw new Error('PayPal Client Secret not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errBody = await safeJson(response);
    console.error('[VerifySubscription] Failed to get PayPal access token', {
      status: response.status,
      statusText: response.statusText,
      error: errBody,
    });
    throw new Error(`Failed to get PayPal access token (${response.status})`);
  }

  const data = await response.json();
  return data.access_token;
}

// Retrieve subscription details
async function getSubscriptionDetails(subscriptionId, accessToken) {
  const response = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await safeJson(response);
    return {
      ok: false,
      status: response.status,
      error,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: await response.json(),
  };
}

// Helper to safely parse JSON error responses
async function safeJson(res) {
  try {
    return await res.json();
  } catch (_) {
    try { return await res.text(); } catch (_) { return null; }
  }
}

export async function POST(request) {
  try {
    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    const accessToken = await getPayPalAccessToken();

    const result = await getSubscriptionDetails(subscriptionId, accessToken);

    if (result.ok) {
      const sub = result.data;
      console.log('[VerifySubscription] Subscription details:', {
        id: sub.id,
        status: sub.status,
        plan_id: sub.plan_id,
      });

      return NextResponse.json({
        success: true,
        id: sub.id,
        status: sub.status,
        plan_id: sub.plan_id,
        subscription: sub,
      });
    }

    const err = result.error || {};
    const debug_id = err?.debug_id;
    const details = err?.details;
    const name = err?.name;
    const message = err?.message;
    console.error('[VerifySubscription] PayPal verify failed', { status: result.status, name, message, debug_id, details });
    return NextResponse.json(
      { success: false, name, message, debug_id, details },
      { status: result.status || 500 }
    );
  } catch (error) {
    console.error('[VerifySubscription] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
