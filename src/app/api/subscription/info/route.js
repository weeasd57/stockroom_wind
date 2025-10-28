import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    // Prefer Authorization header if present (client-side Supabase token). Fallback to cookie auth.
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
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    const userId = user.id;

    // Try to get subscription info - if it fails, default to free plan
    let subscriptionData = null;
    try {
      const { data, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
      
      if (!subError) {
        subscriptionData = data;
      }
    } catch (err) {
      console.log('No active subscription found, defaulting to free plan');
    }

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
      (subscriptionInfo.price_check_limit || 0) - (subscriptionInfo.price_checks_used || 0), 
      0
    );
    subscriptionInfo.remaining_posts = Math.max(
      (subscriptionInfo.post_creation_limit || 0) - (subscriptionInfo.posts_created || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: subscriptionInfo
    });

  } catch (error) {
    console.error('Error fetching subscription info:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal Server Error' 
    }, { status: 500 });
  }
}

