import { NextResponse } from 'next/server';

// PayPal API base URLs
// Prefer explicit PAYPAL_MODE to avoid coupling to NODE_ENV.
// PAYPAL_MODE should be either 'live' or 'sandbox' (defaults to 'sandbox').
const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
const PAYPAL_BASE = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Get PayPal access token
async function getPayPalAccessToken() {
  // Prefer server-only PAYPAL_CLIENT_ID; fallback to NEXT_PUBLIC for compatibility
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  console.log('PayPal credentials check:', {
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
    console.error('Failed to get PayPal access token', {
      status: response.status,
      statusText: response.statusText,
      error: errBody,
    });
    throw new Error(`Failed to get PayPal access token (${response.status})`);
  }

  const data = await response.json();
  return data.access_token;
}

// Capture PayPal order
async function capturePayPalOrder(orderId, accessToken) {
  const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
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
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Capture the order
    const result = await capturePayPalOrder(orderId, accessToken);

    // Check if capture was successful
    if (result.ok) {
      const captureData = result.data;
      if (captureData.status === 'COMPLETED') {
        console.log('PayPal capture successful:', captureData);
      
        // Extract payment details
        const capture = captureData.purchase_units[0]?.payments?.captures?.[0];
        const customerId = captureData.purchase_units[0]?.custom_id;
        
        return NextResponse.json({
          success: true,
          captureId: capture?.id,
          amount: capture?.amount,
          customerId,
          captureData
        });
      }
      // If PayPal responded ok but not COMPLETED
      return NextResponse.json(
        { error: 'Payment capture not completed', status: captureData.status, captureData },
        { status: 400 }
      );
    }

    // Propagate PayPal error details to client (e.g., 422 UNPROCESSABLE_ENTITY)
    const err = result.error || {};
    const debug_id = err?.debug_id;
    const details = err?.details;
    const name = err?.name;
    const message = err?.message;
    console.error('PayPal capture failed', { status: result.status, name, message, debug_id, details });
    return NextResponse.json(
      { success: false, name, message, debug_id, details },
      { status: result.status || 500 }
    );

  } catch (error) {
    console.error('PayPal capture error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

