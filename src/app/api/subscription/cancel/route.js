import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ 
        success: false, 
        message: 'Server configuration error', 
        error: 'missing_config' 
      }, { status: 503 });
    }

    const adminSupabase = createAdminClient();
    
    // Get user from request
    const { searchParams } = new URL(request.url);
    const cookieHeader = request.headers.get('cookie');
    
    // Parse user session from cookies
    let userId = null;
    try {
      const { data: { user }, error: authError } = await adminSupabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ 
          success: false, 
          message: 'Authentication required', 
          error: 'auth_required' 
        }, { status: 401 });
      }
      userId = user.id;
    } catch (e) {
      return NextResponse.json({ 
        success: false, 
        message: 'Authentication failed', 
        error: 'auth_failed' 
      }, { status: 401 });
    }

    // Get current subscription info
    const { data: currentSub, error: fetchError } = await adminSupabase
      .from('user_subscription_info')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching current subscription:', fetchError);
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to fetch subscription info', 
        error: 'fetch_failed' 
      }, { status: 500 });
    }

    // Check if user has an active subscription to cancel
    if (!currentSub || currentSub.plan_type === 'free') {
      return NextResponse.json({ 
        success: false, 
        message: 'No active subscription to cancel', 
        error: 'no_subscription' 
      }, { status: 400 });
    }

    // Cancel the subscription by updating to free plan
    const { error: updateError } = await adminSupabase
      .from('user_subscriptions')
      .update({
        plan_type: 'free',
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error cancelling subscription:', updateError);
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to cancel subscription', 
        error: 'update_failed' 
      }, { status: 500 });
    }

    // Log the cancellation
    console.log(`[SUBSCRIPTION] User ${userId} cancelled subscription, downgraded to free plan`);

    return NextResponse.json({ 
      success: true, 
      message: 'Subscription cancelled successfully. You have been downgraded to the free plan.',
      data: {
        previous_plan: currentSub.plan_type,
        new_plan: 'free',
        cancelled_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Subscription cancellation error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error', 
      error: 'server_error' 
    }, { status: 500 });
  }
}
