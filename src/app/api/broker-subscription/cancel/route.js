import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { subscription_id, user_id } = await request.json();

    if (!subscription_id || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify subscription belongs to user
    const { data: subscription, error: fetchError } = await supabase
      .from('broker_subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .eq('user_id', user_id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Idempotent: already cancelled
    if (subscription.status === 'cancelled') {
      return NextResponse.json({ success: true, subscription }, { status: 200 });
    }

    // Clear any existing 'cancelled' rows for same (user, broker) to avoid UNIQUE constraint conflicts
    const { error: clearError } = await supabase
      .from('broker_subscriptions')
      .update({ status: 'expired' })
      .eq('user_id', user_id)
      .eq('broker_id', subscription.broker_id)
      .eq('status', 'cancelled')
      .neq('id', subscription_id);

    if (clearError) {
      console.error('Failed to clear duplicate cancelled rows:', clearError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }

    // Cancel subscription
    const { data: updated, error: updateError } = await supabase
      .from('broker_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscription_id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to cancel subscription:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }

    console.log('[Broker Subscription] Subscription cancelled:', {
      subscriptionId: subscription_id,
      userId: user_id,
      brokerId: subscription.broker_id
    });

    return NextResponse.json({
      success: true,
      subscription: updated,
    });

  } catch (error) {
    console.error('Broker subscription cancellation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
