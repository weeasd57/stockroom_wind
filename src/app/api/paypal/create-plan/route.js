import { NextResponse } from 'next/server';

// PayPal API base URLs
const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
const PAYPAL_BASE = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Get PayPal access token
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  console.log('[CreatePlan] PayPal credentials check:', {
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
    console.error('[CreatePlan] Failed to get PayPal access token', {
      status: response.status,
      statusText: response.statusText,
      error: errBody,
    });
    throw new Error(`Failed to get PayPal access token (${response.status})`);
  }

  const data = await response.json();
  return data.access_token;
}

// Create a product first (required for plan)
async function createProduct(accessToken) {
  const productData = {
    name: 'SharksZone Pro Plan',
    description: 'Monthly Pro subscription for SharksZone platform',
    type: 'SERVICE', // or 'DIGITAL_GOODS'
    category: 'SOFTWARE',
  };

  const response = await fetch(`${PAYPAL_BASE}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });

  const result = await safeJson(response);

  if (!response.ok) {
    console.error('[CreatePlan] Failed to create product', {
      status: response.status,
      error: result,
    });
    throw new Error(`Failed to create product (${response.status}): ${result?.message || 'Unknown error'}`);
  }

  console.log('[CreatePlan] Product created successfully:', result.id);
  return result.id; // Product ID
}

// Create a billing plan
async function createPlan(accessToken, productId) {
  const planData = {
    product_id: productId,
    name: 'SharksZone Pro Monthly Plan',
    description: 'Monthly Pro subscription - $7.00/month',
    billing_cycles: [
      {
        frequency: {
          interval_unit: 'MONTH',
          interval_count: 1,
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // Infinite cycles
        pricing_scheme: {
          fixed_price: {
            value: '7.00',
            currency_code: 'USD',
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '0.00',
        currency_code: 'USD',
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
    taxes: {
      percentage: '0.00',
      inclusive: false,
    },
  };

  const response = await fetch(`${PAYPAL_BASE}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(planData),
  });

  const result = await safeJson(response);

  if (!response.ok) {
    console.error('[CreatePlan] Failed to create plan', {
      status: response.status,
      error: result,
    });
    throw new Error(`Failed to create plan (${response.status}): ${result?.message || 'Unknown error'}`);
  }

  console.log('[CreatePlan] Plan created successfully:', result.id);
  return result; // Full plan object
}

// Activate the plan (plans are created in CREATED status, need to be activated)
async function activatePlan(accessToken, planId) {
  const response = await fetch(`${PAYPAL_BASE}/v1/billing/plans/${planId}/activate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      activate: true,
    }),
  });

  if (!response.ok) {
    const error = await safeJson(response);
    console.error('[CreatePlan] Failed to activate plan', {
      status: response.status,
      error,
    });
    throw new Error(`Failed to activate plan (${response.status}): ${error?.message || 'Unknown error'}`);
  }

  console.log('[CreatePlan] Plan activated successfully:', planId);
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
    console.log('[CreatePlan] Starting plan creation process...');
    
    const accessToken = await getPayPalAccessToken();
    
    // Step 1: Create product
    const productId = await createProduct(accessToken);
    
    // Step 2: Create plan
    const plan = await createPlan(accessToken, productId);
    
    // Step 3: Activate plan (optional - many plans are auto-active)
    let activationStatus = 'CREATED';
    try {
      await activatePlan(accessToken, plan.id);
      activationStatus = 'ACTIVE';
      console.log('[CreatePlan] Plan activated successfully');
    } catch (activationError) {
      console.warn('[CreatePlan] Plan activation failed, but plan may already be usable:', activationError.message);
      // Many plans don't need explicit activation in Sandbox
    }
    
    console.log('[CreatePlan] Complete plan creation successful');
    
    return NextResponse.json({
      success: true,
      plan_id: plan.id,
      product_id: productId,
      status: activationStatus,
      plan_status: plan.status || 'CREATED',
      plan: plan,
      instructions: {
        message: 'Plan created successfully! Add this plan_id to your .env.local file:',
        env_variable: `NEXT_PUBLIC_PAYPAL_PLAN_ID=${plan.id}`,
      },
    });
  } catch (error) {
    console.error('[CreatePlan] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return NextResponse.json({
    message: 'Use POST to create a new PayPal plan',
    example: 'POST /api/paypal/create-plan',
    note: 'This will create both a product and a billing plan for $7.00/month',
  });
}
