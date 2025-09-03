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
    const { orderId, captureId, amount } = body;

    // Validate payment amount
    if (parseFloat(amount) !== 4.00) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
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

    // Create new pro subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: proPlans.id,
        status: 'active',
        paypal_order_id: orderId,
        price_checks_used: 0,
        price_checks_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
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
      subscription: subscription
    });

  } catch (error) {
    console.error('Checkout confirmation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
