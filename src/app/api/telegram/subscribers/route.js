import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const cookieStore = cookies();
    let supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    let user = null;
    let authError = null;
    
    // التحقق من المصادقة - جرب cookies أولاً
    const cookieAuth = await supabase.auth.getUser();
    user = cookieAuth.data?.user;
    authError = cookieAuth.error;
    
    // إذا فشلت cookies، جرب Authorization header
    if (authError || !user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          
          if (supabaseUrl && supabaseAnonKey) {
            const tokenSupabase = createClient(supabaseUrl, supabaseAnonKey, {
              global: { headers: { Authorization: `Bearer ${token}` } }
            });
            const tokenAuth = await tokenSupabase.auth.getUser();
            
            if (tokenAuth.data?.user && !tokenAuth.error) {
              user = tokenAuth.data.user;
              authError = null;
              supabase = tokenSupabase;
            }
          }
        } catch (tokenError) {
          console.error('Token auth error:', tokenError);
        }
      }
    }
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // الحصول على بوت المستخدم
    const { data: userBot, error: botError } = await supabase
      .from('telegram_bots')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (botError || !userBot) {
      return NextResponse.json({
        followers: [],
        subscribers: [],
        message: 'No active bot found'
      });
    }

    // الحصول على المتابعين المشتركين في التليجرام
    const { data: followerSubscribers, error: followersError } = await supabase
      .rpc('get_follower_telegram_subscribers', {
        p_user_id: user.id,
        p_bot_id: userBot.id
      });

    if (followersError) {
      console.error('Error fetching follower subscribers:', followersError);
    }

    // الحصول على جميع المشتركين في البوت
    const { data: allSubscribers, error: subscribersError } = await supabase
      .from('telegram_subscribers')
      .select(`
        id,
        telegram_user_id,
        telegram_username,
        telegram_first_name,
        telegram_last_name,
        platform_user_id,
        subscribed_at,
        last_interaction,
        profiles(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('bot_id', userBot.id)
      .eq('is_subscribed', true)
      .order('subscribed_at', { ascending: false });

    if (subscribersError) {
      console.error('Error fetching all subscribers:', subscribersError);
    }

    return NextResponse.json({
      followers: followerSubscribers || [],
      subscribers: allSubscribers || [],
      stats: {
        totalSubscribers: allSubscribers?.length || 0,
        followerSubscribers: followerSubscribers?.length || 0
      }
    });

  } catch (error) {
    console.error('Error fetching subscribers:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

// إحصائيات المشتركين
export async function POST(request) {
  try {
    const cookieStore = cookies();
    let supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    let user = null;
    let authError = null;
    
    // التحقق من المصادقة - جرب cookies أولاً
    const cookieAuth = await supabase.auth.getUser();
    user = cookieAuth.data?.user;
    authError = cookieAuth.error;
    
    // إذا فشلت cookies، جرب Authorization header
    if (authError || !user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          
          if (supabaseUrl && supabaseAnonKey) {
            const tokenSupabase = createClient(supabaseUrl, supabaseAnonKey, {
              global: { headers: { Authorization: `Bearer ${token}` } }
            });
            const tokenAuth = await tokenSupabase.auth.getUser();
            
            if (tokenAuth.data?.user && !tokenAuth.error) {
              user = tokenAuth.data.user;
              authError = null;
              supabase = tokenSupabase;
            }
          }
        } catch (tokenError) {
          console.error('Token auth error:', tokenError);
        }
      }
    }
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action } = await request.json();

    if (action === 'get_stats') {
      // الحصول على بوت المستخدم
      const { data: userBot } = await supabase
        .from('telegram_bots')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!userBot) {
        return NextResponse.json({
          stats: {
            totalSubscribers: 0,
            activeSubscribers: 0,
            recentBroadcasts: 0,
            lastWeekNewSubscribers: 0
          }
        });
      }

      // إحصائيات مفصلة
      const [
        { count: totalSubscribers },
        { count: activeSubscribers },
        { data: recentBroadcasts },
        { count: lastWeekNewSubscribers }
      ] = await Promise.all([
        // إجمالي المشتركين
        supabase
          .from('telegram_subscribers')
          .select('*', { count: 'exact', head: true })
          .eq('bot_id', userBot.id),

        // المشتركين النشطين
        supabase
          .from('telegram_subscribers')
          .select('*', { count: 'exact', head: true })
          .eq('bot_id', userBot.id)
          .eq('is_subscribed', true),

        // البرودكاستات الأخيرة (آخر 30 يوم)
        supabase
          .from('telegram_broadcasts')
          .select('id, title, status, sent_count, created_at')
          .eq('bot_id', userBot.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(5),

        // مشتركين جدد آخر أسبوع
        supabase
          .from('telegram_subscribers')
          .select('*', { count: 'exact', head: true })
          .eq('bot_id', userBot.id)
          .eq('is_subscribed', true)
          .gte('subscribed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      return NextResponse.json({
        stats: {
          totalSubscribers: totalSubscribers || 0,
          activeSubscribers: activeSubscribers || 0,
          recentBroadcasts: recentBroadcasts?.length || 0,
          lastWeekNewSubscribers: lastWeekNewSubscribers || 0
        },
        recentBroadcasts: recentBroadcasts || []
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
