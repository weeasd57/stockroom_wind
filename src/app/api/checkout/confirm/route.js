import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let supabase;
    let user = null;
    let authError = null;
    if (bearerToken) {
      supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearerToken}` } }
      });
      const { data, error } = await supabase.auth.getUser(bearerToken);
      user = data?.user ?? null;
      authError = error ?? null;
    } else {
      supabase = createRouteHandlerClient({ cookies });
      const resp = await supabase.auth.getUser();
      user = resp.data?.user ?? null;
      authError = resp.error ?? null;
    }
    
    // Get authenticated user
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, captureId, amount, billingPeriod } = body;

    // Validate billing period
    const validBillingPeriod = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    
    // Validate payment amount based on billing period
    const expectedAmount = validBillingPeriod === 'yearly' ? 70.00 : 7.00;
    if (parseFloat(amount) !== expectedAmount) {
      return NextResponse.json({ 
        error: `Invalid payment amount for ${validBillingPeriod} subscription. Expected: $${expectedAmount}` 
      }, { status: 400 });
    }

    // Start transaction
    const { data: proPlans, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', 'pro')
      .single();

    if (planError || !proPlans) {
      console.error('Error fetching pro plan:', planError);
      return NextResponse.json({ error: 'Pro plan not found' }, { status: 500 });
    }

    // Cancel existing subscription
    await supabase
      .from('user_subscriptions')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('status', 'active');

    // Calculate expiry date based on billing period
    const now = new Date();
    const expiryDate = validBillingPeriod === 'yearly' 
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);  // 1 month
    
    const resetDate = validBillingPeriod === 'yearly'
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Create new pro subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: proPlans.id,
        status: 'active',
        billing_period: validBillingPeriod,
        paypal_order_id: orderId,
        started_at: now.toISOString(),
        expires_at: expiryDate.toISOString(),
        price_checks_used: 0,
        posts_created: 0,
        price_checks_reset_at: resetDate.toISOString(),
        posts_reset_at: resetDate.toISOString()
      })
      .select()
      .single();

    if (subError) {
      console.error('Error creating subscription:', subError);
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }

    // Create payment transaction record
    const { error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        amount: parseFloat(amount),
        currency: 'USD',
        payment_method: 'paypal',
        paypal_order_id: orderId,
        paypal_capture_id: captureId,
        status: 'completed',
        transaction_data: body
      });

    if (txError) {
      console.error('Error creating transaction:', txError);
      // Don't fail the request, subscription is already created
    }

    return NextResponse.json({ 
      success: true,
      subscription: subscription,
      billingPeriod: validBillingPeriod,
      expiresAt: expiryDate.toISOString()
    });

  } catch (error) {
    console.error('Checkout confirmation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
