import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_BASE = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getPayPalAccessToken() {
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(
        `${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request) {
  try {
    const { user_id, broker_id, plan_type } = await request.json();

    if (!user_id || !broker_id || !plan_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate plan_type
    if (!['monthly', 'yearly'].includes(plan_type)) {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    // Get broker's premium plan
    const { data: premiumPlan, error: planError } = await supabase
      .from('premium_plans')
      .select('*')
      .eq('user_id', broker_id)
      .eq('is_active', true)
      .maybeSingle();

    if (planError || !premiumPlan) {
      return NextResponse.json(
        { error: 'Broker premium plan not found' },
        { status: 404 }
      );
    }

    const pricing = premiumPlan.pricing || {};
    const amount = plan_type === 'monthly' ? pricing.monthly : pricing.yearly;
    const currency = pricing.currency || 'USD';

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid pricing configuration' },
        { status: 400 }
      );
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal order (one-time payment, not recurring subscription)
    const orderResponse = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          description: `${plan_type === 'monthly' ? 'Monthly' : 'Yearly'} Subscription to Premium Broker`,
          custom_id: JSON.stringify({ user_id, broker_id, plan_type }),
        }],
        application_context: {
          brand_name: 'Stock Trading Platform',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/broker-subscribe/${broker_id}?success=true`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/broker-subscribe/${broker_id}?cancelled=true`,
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error('PayPal order creation failed:', errorData);
      return NextResponse.json(
        { error: 'Failed to create PayPal order' },
        { status: 500 }
      );
    }

    const orderData = await orderResponse.json();

    // Store subscription metadata in PayPal order custom_id for later retrieval
    // We'll create the database record only after payment is confirmed in capture API
    console.log('[Broker Subscription] PayPal order created:', {
      orderId: orderData.id,
      user_id,
      broker_id,
      plan_type,
      amount
    });

    // Return PayPal order details
    return NextResponse.json({
      success: true,
      order_id: orderData.id,
      approval_url: orderData.links.find(link => link.rel === 'approve')?.href,
      // Pass metadata to frontend for capture API
      metadata: {
        user_id,
        broker_id,
        plan_type,
        amount,
        currency
      }
    });

  } catch (error) {
    console.error('Broker subscription creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
