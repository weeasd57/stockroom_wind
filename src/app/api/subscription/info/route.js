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

    // Try to get subscription info - if it fails, create free plan
    let subscriptionData = null;
    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      console.log(`[SubscriptionInfo] Fetching subscription for user ${userId} at ${timestamp}`);
      
      const { data, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
      
      if (!subError && data) {
        console.log('[SubscriptionInfo] ✅ Subscription found:', {
          user_id: data.user_id,
          plan_name: data.subscription_plans?.name,
          price_checks_used: data.price_checks_used,
          posts_created: data.posts_created
        });
        subscriptionData = data;
      } else if (subError?.code === 'PGRST116') {
        // PGRST116 = No rows found - create free plan
        console.log('[SubscriptionInfo] No subscription found, creating free plan for user:', userId);
        
        // Get free plan ID
        const { data: freePlan, error: freePlanError } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('name', 'free')
          .single();
        
        if (!freePlanError && freePlan) {
          // Create free subscription
          const { data: newSub, error: createError } = await supabase
            .from('user_subscriptions')
            .insert({
              user_id: userId,
              plan_id: freePlan.id,
              status: 'active',
              price_checks_used: 0,
              posts_created: 0
            })
            .select(`
              *,
              subscription_plans(*)
            `)
            .single();
          
          if (!createError && newSub) {
            console.log('[SubscriptionInfo] ✅ Free plan created successfully');
            subscriptionData = newSub;
          } else if (createError?.code === '23505') {
            // 23505 = unique_violation - subscription already exists (race condition)
            console.log('[SubscriptionInfo] Subscription already exists (race condition), retrying fetch...');
            
            // Retry fetch
            const { data: retryData } = await supabase
              .from('user_subscriptions')
              .select(`
                *,
                subscription_plans(*)
              `)
              .eq('user_id', userId)
              .eq('status', 'active')
              .single();
            
            if (retryData) {
              subscriptionData = retryData;
            }
          } else {
            console.error('[SubscriptionInfo] ❌ Failed to create free plan:', createError);
          }
        } else {
          console.error('[SubscriptionInfo] ❌ Free plan not found:', freePlanError);
        }
      } else {
        // Other error
        console.error('[SubscriptionInfo] Subscription query error:', subError);
      }
    } catch (err) {
      console.error('[SubscriptionInfo] Error:', err);
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

