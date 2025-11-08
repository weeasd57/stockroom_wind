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
    const { order_id, metadata } = await request.json();

    if (!order_id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    if (!metadata || !metadata.user_id || !metadata.broker_id || !metadata.plan_type) {
      return NextResponse.json(
        { error: 'Subscription metadata is required' },
        { status: 400 }
      );
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Capture the PayPal order
    const captureResponse = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${order_id}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json();
      console.error('PayPal capture failed:', errorData);
      return NextResponse.json(
        { error: 'Failed to capture payment' },
        { status: 500 }
      );
    }

    const captureData = await captureResponse.json();

    // Verify capture was successful
    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // Calculate expiration date
    const expiresAt = new Date();
    if (metadata.plan_type === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Check if user already has an active subscription to this broker
    const { data: existingSub, error: checkError } = await supabase
      .from('broker_subscriptions')
      .select('id, status')
      .eq('user_id', metadata.user_id)
      .eq('broker_id', metadata.broker_id)
      .eq('status', 'active')
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing subscription:', checkError);
    }

    let subscription;
    
    if (existingSub) {
      // Update existing subscription (renewal)
      const { data, error: updateError } = await supabase
        .from('broker_subscriptions')
        .update({
          subscription_id: order_id,
          plan_type: metadata.plan_type,
          amount: metadata.amount,
          currency: metadata.currency,
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', existingSub.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update subscription:', updateError);
        return NextResponse.json(
          { error: 'Failed to update subscription', details: updateError.message },
          { status: 500 }
        );
      }
      subscription = data;
      console.log('[Broker Subscription] Renewed existing subscription:', existingSub.id);
    } else {
      // Create new subscription
      const { data, error: insertError } = await supabase
        .from('broker_subscriptions')
        .insert({
          user_id: metadata.user_id,
          broker_id: metadata.broker_id,
          subscription_id: order_id,
          plan_type: metadata.plan_type,
          amount: metadata.amount,
          currency: metadata.currency,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create subscription:', insertError);
        return NextResponse.json(
          { error: 'Failed to create subscription', details: insertError.message },
          { status: 500 }
        );
      }
      subscription = data;
      console.log('[Broker Subscription] Created new subscription');
    }

    console.log('[Broker Subscription] Payment captured and subscription activated:', {
      subscriptionId: subscription.id,
      orderId: order_id,
      userId: subscription.user_id,
      brokerId: subscription.broker_id,
      status: subscription.status
    });

    return NextResponse.json({
      success: true,
      subscription,
      capture: captureData,
    });

  } catch (error) {
    console.error('Broker subscription capture error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
