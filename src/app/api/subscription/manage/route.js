import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

async function getSubscriptionManager() {
  // Always use real subscription manager
  const manager = await import('@/utils/subscription-manager');
  return manager;
}

/**
 * Unified Subscription Management API
 * يدير جميع عمليات الاشتراكات من endpoint واحد
 */

export async function POST(request) {
  try {
    let supabase;
    let session = null;
    let sessionError = null;

    // Try Authorization header first (client-side token)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (bearerToken) {
      console.log('🔑 Using Authorization header for auth');
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
      );
      const { data, error } = await supabase.auth.getUser(bearerToken);
      if (!error && data?.user) {
        session = { user: data.user };
      } else {
        sessionError = error;
      }
    } else {
      console.log('🍪 Using cookies for auth');
      const cookieStore = cookies();
      supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      const { data, error } = await supabase.auth.getSession();
      session = data?.session;
      sessionError = error;
    }
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json({
        success: false,
        message: 'Session error: ' + sessionError.message,
        error: 'session_error'
      }, { status: 401 });
    }

    if (!session?.user) {
      console.log('No active session found');
      return NextResponse.json({
        success: false,
        message: 'No active session. Please log in again.',
        error: 'no_session'
      }, { status: 401 });
    }

    const user = session.user;
    console.log('🔑 Authenticated user:', user.id);

    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'cancel':
        return await handleCancel(user.id, params, request);
      
      case 'switch_to_free':
        return await handleSwitchToFree(user.id, params, request);
      
      case 'sync_with_paypal':
        return await handleSyncWithPayPal(user.id, params);
      
      case 'validate_paypal':
        return await handleValidatePayPal(params.subscriptionId, params);
      
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Supported actions: cancel, switch_to_free, sync_with_paypal, validate_paypal',
          error: 'invalid_action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Subscription management error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: 'server_error'
    }, { status: 500 });
  }
}

/**
 * Handle subscription cancellation
 */
async function handleCancel(userId, params, request) {
  const manager = await getSubscriptionManager();
  // Inject server supabase client for RLS-aware operations
  try {
    const { cookies } = await import('next/headers');
    const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs');
    const supabase = createRouteHandlerClient({ cookies: () => cookies() });
    manager.setSupabaseClient && manager.setSupabaseClient(supabase);
  } catch {}
  const result = await manager.cancelSubscription({
    userId,
    reason: params.reason || 'User requested cancellation',
    source: 'user_cancel_button',
    shouldCancelPayPal: params.shouldCancelPayPal !== false, // default true
    metadata: {
      user_agent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      ...params.metadata
    }
  });

  if (!result.success) {
    return NextResponse.json({
      success: false,
      message: result.message || 'Failed to cancel subscription',
      error: result.error || 'cancellation_failed'
    }, { status: 400 });
  }

  if (result.alreadyFree) {
    return NextResponse.json({
      success: true,
      message: 'You are already on the free plan',
      data: { plan_type: 'free' }
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Subscription cancelled successfully. You have been downgraded to the free plan.',
    data: result.data
  });
}

/**
 * Handle switch to free plan with confirmation
 */
async function handleSwitchToFree(userId, params, request) {
  if (!params.confirmCancellation) {
    return NextResponse.json({
      success: false,
      message: 'You must confirm the plan switch',
      error: 'confirmation_required'
    }, { status: 400 });
  }

  const manager = await getSubscriptionManager();
  // Inject server supabase client for RLS-aware operations
  try {
    const { cookies } = await import('next/headers');
    const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs');
    const supabase = createRouteHandlerClient({ cookies: () => cookies() });
    manager.setSupabaseClient && manager.setSupabaseClient(supabase);
  } catch {}
  const result = await manager.cancelSubscription({
    userId,
    reason: params.reason || 'User switched to free plan',
    source: 'user_switch_form',
    shouldCancelPayPal: params.shouldCancelPayPal !== false, // default true
    metadata: {
      confirmation_provided: true,
      user_agent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      ...params.metadata
    }
  });

  if (!result.success) {
    return NextResponse.json({
      success: false,
      message: result.message || 'Failed to switch to free plan',
      error: result.error || 'switch_failed'
    }, { status: 400 });
  }

  if (result.alreadyFree) {
    return NextResponse.json({
      success: true,
      message: 'You are already on the free plan'
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Successfully switched to Free Plan. Your Pro subscription has been cancelled.',
    data: result.data
  });
}
/**
 * Handle PayPal synchronization
 */
async function handleSyncWithPayPal(userId, params = {}) {
  const manager = await getSubscriptionManager();
  const result = await manager.syncSubscriptionWithPayPal(userId);

  return NextResponse.json({
    success: result.synced,
    message: result.synced
      ? (result.changed ? `Status synchronized: ${result.from} → ${result.to}` : 'Subscription is already in sync')
      : result.reason || 'Failed to sync with PayPal',
    data: result
  });
}

/**
 * Handle PayPal subscription validation
 */
async function handleValidatePayPal(subscriptionId, params = {}) {
  if (!subscriptionId) {
    return NextResponse.json({
      success: false,
      message: 'PayPal subscription ID is required',
      error: 'missing_subscription_id'
    }, { status: 400 });
  }

  const manager = await getSubscriptionManager();
  const result = await manager.validatePayPalSubscription(subscriptionId);

  return NextResponse.json({
    success: result.valid,
    message: result.valid
      ? `PayPal subscription is ${result.status}`
      : result.reason || 'PayPal subscription not found',
    data: result
  });
}
// Handle CORS preflight
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
