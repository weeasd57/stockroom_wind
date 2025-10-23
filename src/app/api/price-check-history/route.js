import { createClient } from '@supabase/supabase-js';

// Use anon key for API routes (safer and more compatible)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Check if environment variables are available
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('[Price Check History API] Missing Supabase environment variables');
}

export async function GET(request) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[Price Check History API] Missing Supabase environment variables');
      return Response.json({ 
        error: 'Service configuration error', 
        success: false 
      }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`[Price Check History API] Fetching history for user ${userId}, last ${days} days`);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);

    // Fetch price check related data from multiple sources
    const priceCheckActivities = [];

    try {
      // 1. Get posts that had price updates in the last N days
      const { data: updatedPosts, error: postsError } = await supabase
        .from('posts_with_stats')
        .select(`
          id,
          symbol,
          company_name,
          current_price,
          initial_price,
          target_price,
          stop_loss_price,
          exchange,
          country,
          target_reached,
          stop_loss_triggered,
          last_price_check,
          price_checks,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .gte('last_price_check', pastDate.toISOString())
        .order('last_price_check', { ascending: false });

      if (postsError) {
        console.error('[Price Check History API] Posts fetch error:', postsError);
      } else if (updatedPosts) {
        // Group posts by price check date (approximately)
        const groupedByDate = {};
        
        updatedPosts.forEach(post => {
          if (!post.last_price_check) return;
          
          // Round to nearest hour to group checks that happened around the same time
          const checkDate = new Date(post.last_price_check);
          const roundedHour = new Date(checkDate);
          const dateKey = roundedHour.toISOString();
          
          if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = {
              id: `price_check_${checkDate.getTime()}`,
              type: 'price-check',
              timestamp: checkDate.toISOString(),
              title: `Price Check - ${checkDate.toLocaleDateString()}`,
              posts: [],
              checkedPosts: 0,
              updatedPosts: 0,
              targetReached: 0,
              stopLossTriggered: 0,
              source: 'supabase',
              canSendTelegram: false,
              telegramEligiblePosts: 0
            };
          }
          
          groupedByDate[dateKey].posts.push({
            ...post,
            id: post.id,
            symbol: post.symbol,
            company_name: post.company_name,
            current_price: post.current_price,
            target_price: post.target_price,
            stop_loss_price: post.stop_loss_price,
            target_reached: post.target_reached,
            stop_loss_triggered: post.stop_loss_triggered,
            closed: post.closed,
            exchange: post.exchange,
            country: post.country,
            status_message: post.status_message || null,
            noDataAvailable: post.noDataAvailable || false,
            postAfterMarketClose: post.postAfterMarketClose || false
          });
          groupedByDate[dateKey].checkedPosts++;
          
          // Check if this was an actual update (price change, target/stop loss)
          if (post.target_reached || post.stop_loss_triggered || post.price_checks > 0) {
            groupedByDate[dateKey].updatedPosts++;
          }
          
          if (post.target_reached) {
            groupedByDate[dateKey].targetReached++;
          }
          
          if (post.stop_loss_triggered) {
            groupedByDate[dateKey].stopLossTriggered++;
          }
          
          // Track Telegram eligibility
          if (post.target_reached || post.stop_loss_triggered) {
            groupedByDate[dateKey].telegramEligiblePosts++;
            groupedByDate[dateKey].canSendTelegram = true;
          }
        });
        
        // Convert grouped data to array
        priceCheckActivities.push(...Object.values(groupedByDate));
      }

      // 2. Also get any closed posts that might have been affected by price checks
      const { data: closedPosts, error: closedError } = await supabase
        .from('posts_with_stats')
        .select(`
          id,
          symbol,
          company_name,
          current_price,
          target_price,
          stop_loss_price,
          target_reached,
          stop_loss_triggered,
          closed_date,
          closed
        `)
        .eq('user_id', userId)
        .eq('closed', true)
        .gte('closed_date', pastDate.toISOString())
        .order('closed_date', { ascending: false });

      if (closedError) {
        console.error('[Price Check History API] Closed posts fetch error:', closedError);
      } else if (closedPosts && closedPosts.length > 0) {
        // Add closed posts as separate activities
        closedPosts.forEach(post => {
          if (!post.closed_date) return;
          
          priceCheckActivities.push({
            id: `post_closed_${post.id}`,
            type: 'closed-post',
            timestamp: post.closed_date,
            title: `Post Closed - ${post.symbol}`,
            posts: [{
              ...post,
              id: post.id,
              symbol: post.symbol,
              company_name: post.company_name,
              current_price: post.current_price,
              target_price: post.target_price,
              stop_loss_price: post.stop_loss_price,
              target_reached: post.target_reached,
              stop_loss_triggered: post.stop_loss_triggered,
              closed: true,
              exchange: post.exchange,
              country: post.country
            }],
            checkedPosts: 1,
            updatedPosts: 1,
            targetReached: post.target_reached ? 1 : 0,
            stopLossTriggered: post.stop_loss_triggered ? 1 : 0,
            source: 'supabase',
            canSendTelegram: post.target_reached || post.stop_loss_triggered,
            telegramEligiblePosts: (post.target_reached || post.stop_loss_triggered) ? 1 : 0
          });
        });
      }

    } catch (dbError) {
      console.error('[Price Check History API] Database query error:', dbError);
      return Response.json({ 
        error: 'Failed to fetch price check history',
        details: dbError.message 
      }, { status: 500 });
    }

    // Sort all activities by timestamp (newest first)
    priceCheckActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Log summary with Telegram eligibility info
    const telegramEligible = priceCheckActivities.filter(a => a.canSendTelegram).length;
    console.log(`[Price Check History API] ✅ Found ${priceCheckActivities.length} price check activities, ${telegramEligible} eligible for Telegram broadcast`);

    try {
      return Response.json({
        success: true,
        activities: priceCheckActivities
      });
    } catch (supabaseError) {
      console.error('[Price Check History API] Supabase error:', supabaseError);
      
      // Return empty results instead of error if Supabase is not available
      // This allows frontend to fallback to localStorage gracefully
      return Response.json({ 
        success: true,
        activities: [],
        message: 'Supabase not available, using localStorage only',
        fallback: true
      }, { status: 200 });
    }
  } catch (error) {
    console.error('[Price Check History API] Unexpected error:', error);
    
    // Graceful fallback for any other errors
    return Response.json({ 
      success: true,
      activities: [],
      message: 'API error, using localStorage only',
      fallback: true
    }, { status: 200 });
  }
}
