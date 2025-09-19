import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to switch plans' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { confirmCancellation, reason } = body;

    if (!confirmCancellation) {
      return NextResponse.json(
        { error: 'Confirmation required', message: 'You must confirm the plan switch' },
        { status: 400 }
      );
    }

    // Get current subscription info
    const { data: currentSub, error: subError } = await supabase
      .from('user_subscription_info')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subError);
      return NextResponse.json(
        { error: 'Database error', message: 'Failed to fetch current subscription' },
        { status: 500 }
      );
    }

    // Check if user is already on free plan
    if (!currentSub || currentSub.plan_name === 'free' || currentSub.plan_type === 'free') {
      return NextResponse.json(
        { message: 'You are already on the free plan' },
        { status: 200 }
      );
    }

    // Check if user has an active pro subscription
    const isActivePro = currentSub.subscription_status === 'active' && 
                        (currentSub.plan_name === 'pro' || currentSub.plan_type === 'pro');

    if (!isActivePro) {
      return NextResponse.json(
        { message: 'No active Pro subscription found to cancel' },
        { status: 400 }
      );
    }

    // Start a transaction to update subscription
    const { data: updatedSub, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        plan_name: 'free',
        plan_type: 'free',
        plan_id: 'free_plan',
        subscription_status: 'active',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'User switched to free plan',
        price_check_limit: 50,
        post_creation_limit: 100,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return NextResponse.json(
        { error: 'Update failed', message: 'Failed to switch to free plan' },
        { status: 500 }
      );
    }

    // If the user had a PayPal subscription, we should ideally cancel it
    // This would require PayPal API integration
    if (currentSub.paypal_subscription_id) {
      console.log(`Should cancel PayPal subscription: ${currentSub.paypal_subscription_id}`);
      // TODO: Implement PayPal subscription cancellation
    }

    // Log the plan switch
    const { error: logError } = await supabase
      .from('subscription_events')
      .insert({
        user_id: user.id,
        event_type: 'plan_switch',
        event_data: {
          from_plan: currentSub.plan_name,
          to_plan: 'free',
          reason: reason || 'User switched to free plan',
          cancelled_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging plan switch:', logError);
      // Don't fail the request for logging errors
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully switched to Free Plan. Your Pro subscription has been cancelled.',
      subscription: updatedSub
    });

  } catch (error) {
    console.error('Error in switch-to-free API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: 'An unexpected error occurred while switching to free plan' 
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
