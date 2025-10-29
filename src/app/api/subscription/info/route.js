import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    // Use RPC for atomic read - bypasses Supabase query cache
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_subscription_info', { p_user_id: userId });
    
    if (rpcError) {
      console.error('[API] RPC error:', rpcError);
      return NextResponse.json({ success: false, message: 'Failed to fetch subscription' }, { status: 500 });
    }
    
    const subscriptionData = rpcData ? {
      user_id: rpcData.user_id,
      plan_id: rpcData.plan_id,
      subscription_plans: {
        name: rpcData.plan_name,
        display_name: rpcData.plan_display_name,
        price_check_limit: rpcData.price_check_limit,
        post_creation_limit: rpcData.post_creation_limit
      },
      price_checks_used: rpcData.price_checks_used,
      posts_created: rpcData.posts_created,
      status: rpcData.subscription_status,
      started_at: rpcData.start_date,
      expires_at: rpcData.end_date
    } : null;
    
    console.log(`[API] posts_created from RPC: ${subscriptionData?.posts_created}`);

    // Default to free plan if no active subscription
    const subscriptionInfo = {
      user_id: userId,
      plan_id: subscriptionData?.plan_id || null,
      plan_name: subscriptionData?.subscription_plans?.name || 'free',
      plan_display_name: subscriptionData?.subscription_plans?.display_name || 'Free',
      // price checks
      price_check_limit: subscriptionData?.subscription_plans?.price_check_limit ?? 50,
      price_checks_used: subscriptionData?.price_checks_used ?? 0,
      // posts limits
      post_creation_limit: subscriptionData?.subscription_plans?.post_creation_limit ?? 100,
      posts_created: subscriptionData?.posts_created ?? 0,
      // status and dates
      subscription_status: subscriptionData?.status || null,
      start_date: subscriptionData?.started_at || null,
      end_date: subscriptionData?.expires_at || null
    };

    // Calculate remaining usage
    subscriptionInfo.remaining_checks = Math.max(
      (subscriptionInfo.price_check_limit || 0) - (subscriptionInfo.price_checks_used || 0), 0
    );
    subscriptionInfo.remaining_posts = Math.max(
      (subscriptionInfo.post_creation_limit || 0) - (subscriptionInfo.posts_created || 0), 0
    );

    return NextResponse.json({ success: true, data: subscriptionInfo }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });

  } catch (error) {
    console.error('Error fetching subscription info:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal Server Error' 
    }, { status: 500 });
  }
}

