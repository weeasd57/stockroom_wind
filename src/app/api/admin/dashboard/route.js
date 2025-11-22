import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current date for filtering
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Fetch user statistics using admin helper RPC (does not require profiles.is_active column)
    const { data: userStats, error: userError } = await supabase
      .rpc('get_all_users_admin');

    if (userError) {
      console.error('Error fetching user stats:', userError);
    }

    // Calculate user metrics
    const totalUsers = userStats?.length || 0;
    const activeUsers = userStats?.filter(u => u.is_active).length || 0;
    const newUsersToday = userStats?.filter(u => 
      new Date(u.created_at) >= startOfToday
    ).length || 0;

    // Fetch post statistics (no dependency on posts.is_featured column)
    const { data: postStats, error: postError } = await supabase
      .from('posts')
      .select('id, created_at, status')
      .order('created_at', { ascending: false });

    if (postError) {
      console.error('Error fetching post stats:', postError);
    }

    // Calculate post metrics
    const totalPosts = postStats?.length || 0;
    const pendingPosts = postStats?.filter(p => p.status === 'pending').length || 0;
    const featuredPosts = 0;
    const postsToday = postStats?.filter(p => 
      new Date(p.created_at) >= startOfToday
    ).length || 0;

    // Fetch subscription data for revenue
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('started_at, expires_at, billing_period')
      .eq('status', 'active');

    if (subError) {
      console.error('Error fetching subscription data:', subError);
    }

    // Calculate revenue (simplified - you'll need to add actual pricing logic)
    const calculateRevenue = (subs, period) => {
      if (!subs) return 0;
      return subs.filter(sub => {
        const startDate = new Date(sub.started_at);
        return startDate >= period;
      }).reduce((total, sub) => {
        // Add your pricing logic here
        const monthlyPrice = sub.billing_period === 'yearly' ? 70 : 10;
        return total + monthlyPrice;
      }, 0);
    };

    const monthlyRevenue = calculateRevenue(subscriptions, startOfMonth);
    const yearlyRevenue = calculateRevenue(subscriptions, startOfYear);
    const totalRevenue = subscriptions?.reduce((total, sub) => {
      const monthlyPrice = sub.billing_period === 'yearly' ? 70 : 10;
      return total + monthlyPrice;
    }, 0) || 0;

    // Fetch recent activity
    const { data: recentPosts, error: activityError } = await supabase
      .from('posts_with_stats')
      .select(`
        id, 
        created_at, 
        content,
        profile:profiles(username)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (activityError) {
      console.error('Error fetching recent activity:', activityError);
    }

    // Format activity data
    const activity = recentPosts?.map(post => ({
      timestamp: post.created_at,
      message: `New post by ${post.profile?.username || 'Unknown'}: ${post.content?.substring(0, 50) || 'No content'}...`,
      type: 'post'
    })) || [];

    // Add user registration activity
    const recentUsers = userStats?.slice(0, 5).map(user => ({
      timestamp: user.created_at,
      message: `New user registered`,
      type: 'user'
    })) || [];

    // Combine and sort activity
    const allActivity = [...activity, ...recentUsers]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    // System status (you can enhance this with actual health checks)
    const systemStatus = {
      database: 'healthy',
      storage: 'healthy',
      api: 'healthy'
    };

    // Prepare response data
    const dashboardData = {
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsersToday,
        banned: totalUsers - activeUsers
      },
      posts: {
        total: totalPosts,
        pending: pendingPosts,
        featured: featuredPosts,
        today: postsToday
      },
      revenue: {
        monthly: monthlyRevenue,
        yearly: yearlyRevenue,
        total: totalRevenue
      },
      activity: allActivity,
      systemStatus
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Admin dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

// POST method for admin actions
export async function POST(request) {
  try {
    const { action, data } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    switch (action) {
      case 'refresh_cache':
        // Add cache refresh logic here
        return NextResponse.json({ success: true, message: 'Cache refreshed' });
      
      case 'system_maintenance':
        // Add maintenance mode logic here
        return NextResponse.json({ success: true, message: 'Maintenance mode updated' });
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Admin dashboard POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process admin action' },
      { status: 500 }
    );
  }
}
