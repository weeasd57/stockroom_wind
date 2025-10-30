import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!bearerToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken);
    
    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Use Service Role with VOLATILE RPC function (no caching)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { 
        auth: { 
          persistSession: false, 
          autoRefreshToken: false, 
          detectSessionInUrl: false 
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      }
    );

    // Call RPC function - it will auto-create free subscription if needed
    const { data: rpcData, error: adminError } = await admin
      .rpc('get_subscription_info', { p_user_id: userId });

    if (adminError) {
      console.error('[Subscription API] RPC Error:', adminError.message);
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to fetch subscription',
        error: adminError.message 
      }, { status: 500 });
    }

    if (!rpcData) {
      console.error(`[Subscription API] No data for user ${userId} - Run DIAGNOSE_ISSUE.sql`);
      
      return NextResponse.json({ 
        success: false, 
        message: 'No subscription data found',
        debug: {
          userId,
          hint: 'Run SQL _CODE/subscription/DIAGNOSE_ISSUE.sql in Supabase SQL Editor',
          possibleCauses: [
            'Function did not auto-create subscription',
            'Free plan missing in subscription_plans table',
            'Old function version still active (not VOLATILE)',
            'APPLY_FIX_NOW.sql was not executed in Supabase'
          ]
        }
      }, { status: 500 });
    }

    // Data comes DIRECTLY from database (no fallbacks, no native code)
    const subscriptionInfo = {
      user_id: rpcData.user_id,
      plan_id: rpcData.plan_id,
      plan_name: rpcData.plan_name,
      plan_display_name: rpcData.plan_display_name,
      price_check_limit: rpcData.price_check_limit,
      price_checks_used: rpcData.price_checks_used,
      post_creation_limit: rpcData.post_creation_limit,
      posts_created: rpcData.posts_created,
      subscription_status: rpcData.subscription_status,
      start_date: rpcData.start_date,
      end_date: rpcData.end_date,
      fetched_at: new Date().toISOString()
    };

    // Calculate remaining usage from database values
    subscriptionInfo.remaining_checks = Math.max(
      subscriptionInfo.price_check_limit - subscriptionInfo.price_checks_used, 0
    );
    subscriptionInfo.remaining_posts = Math.max(
      subscriptionInfo.post_creation_limit - subscriptionInfo.posts_created, 0
    );

    // Success - silent (no logging unless DEBUG=true)
    if (process.env.DEBUG === 'true') {
      console.log(`[Subscription API] ✓ ${subscriptionInfo.plan_name} - ${subscriptionInfo.remaining_checks}/${subscriptionInfo.price_check_limit} checks`);
    }

    return NextResponse.json(
      { success: true, data: subscriptionInfo }, 
      {
        headers: { 
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('[Subscription API] Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal Server Error' 
    }, { status: 500 });
  }
}

