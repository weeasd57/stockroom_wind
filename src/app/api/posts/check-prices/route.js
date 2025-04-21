import { createClient } from '@supabase/supabase-js';
import { BASE_URL, API_KEY } from '@/models/StockApiConfig';
import { NextResponse } from 'next/server';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2VlY3BydmhwcWZpcnhtcGt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTE5MjI5MSwiZXhwIjoyMDUwNzY4MjkxfQ.HRkWciT9LzUF3b1zh-SdpdsQH2OaRqlnUpw7_73sJls';


const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');


const adminSupabase = createClient(supabaseUrl || '', serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const MAX_DAILY_CHECKS = 100;

export async function POST(request) {
  try {
    
    const body = await request.json().catch(() => ({}));
    const cookieHeader = request.headers.get('cookie');

    
    let userId = body.userId;
    let experienceUpdated = false;

    
    if (!userId) {
      
      const { data: { session }, error: authError } = await supabase.auth.getSession({
        cookieHeader
      });
      
      if (authError) {
        console.error('Error verifying authentication:', authError.message);
        return NextResponse.json(
          { success: false, message: 'Authentication error', details: authError.message },
          { status: 401 }
        );
      }
      
      if (!session || !session.user) {
        console.error('No active user session found');
        return NextResponse.json(
          { success: false, message: 'Unauthorized', details: 'No active session' },
          { status: 401 }
        );
      }
      
      userId = session.user.id;
    }
    
    
    
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID not available' },
        { status: 401 }
      );
    }
    
    
    const today = new Date().toISOString().split('T')[0]; 
    
    const { data: usageData, error: usageError } = await supabase
      .from('price_check_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('check_date', today)
      .single();
    
    
    if (!usageError && usageData) {
      
      if (usageData.count >= MAX_DAILY_CHECKS) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'You have reached the maximum checks for today. Try again tomorrow.', 
            remainingChecks: 0,
            usageCount: usageData.count
          },
          { status: 429 }
        );
      }
      
      
      const { error: updateError } = await supabase
        .from('price_check_usage')
        .update({ 
          count: usageData.count + 1,
          last_check: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('check_date', today);
      
      if (updateError) {
        console.error('Error updating usage count:', updateError);
      }
    } else {
      
      const { error: insertError } = await supabase
        .from('price_check_usage')
        .insert([
          { user_id: userId, check_date: today, count: 1 }
        ]);
      
      if (insertError) {
        console.error('Error creating new usage record:', insertError);
      }
    }
    
    
    await ensurePostTableColumns();
    
    
    
    
    const { data: allPosts, error: allPostsError } = await supabase
      .from('posts')
      .select('id, closed')
      .eq('user_id', userId);
      
    
    const closedPostsCount = allPosts?.filter(post => post.closed === true).length || 0;
    
    
    
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        id, 
        company_name,
        symbol,
        target_price, 
        stop_loss_price, 
        current_price,
        exchange,
        target_reached,
        stop_loss_triggered,
        created_at,
        target_reached_date,
        stop_loss_triggered_date,
        closed
      `)
      .eq('user_id', userId)
      .is('closed', null); 

    
    
    if (postsError) {
      throw postsError;
    }
    
    const results = [];
    const updatedPosts = [];
    
    
    for (const post of posts) {
      try {
        
        if (!post.symbol || !post.target_price || !post.stop_loss_price) {
          
          continue;
        }
        
        
        if (post.closed === true) {
          
          continue;
        }
        
        
        const symbol = post.exchange ? `${post.symbol}.${post.exchange}` : post.symbol;
        
        
        const createdAt = new Date(post.created_at);
        const todayDate = new Date();
        
        
        const fromDate = createdAt.toISOString().split('T')[0];
        const toDate = todayDate.toISOString().split('T')[0];
        
        
        const historicalUrl = `${BASE_URL}/eod/${symbol}?from=${fromDate}&to=${toDate}&period=d&api_token=${API_KEY}&fmt=json`;
        
        
        
        const response = await fetch(historicalUrl);
        
        if (!response.ok) {
          console.error(`Error getting stock data for ${symbol}:`, response.statusText);
          continue;
        }
        
        let historicalData = await response.json();
        
        if (!Array.isArray(historicalData) || historicalData.length === 0) {
          console.warn(`No historical data found for stock ${symbol}, trying to get last close price`);
          
          try {
            // Import the generateEodLastCloseUrl function
            const { generateEodLastCloseUrl } = require('@/utils/stockApi');
            
            // Get the country from the post
            const country = post.country || '';
            
            // Generate URL for last close price
            const lastCloseUrl = generateEodLastCloseUrl(post.symbol, country);
            console.log(`Trying to get last close price from: ${lastCloseUrl}`);
            
            // Fetch the last close price
            const lastCloseResponse = await fetch(lastCloseUrl);
            
            if (lastCloseResponse.ok) {
              const lastCloseData = await lastCloseResponse.json();
              
              if (lastCloseData && (typeof lastCloseData === 'number' || 
                  (Array.isArray(lastCloseData) && lastCloseData.length > 0 && lastCloseData[0].close))) {
                
                // Extract the close price from the response
                const closePrice = typeof lastCloseData === 'number' ? 
                  lastCloseData : 
                  parseFloat(lastCloseData[0].close);
                
                console.log(`Successfully got last close price for ${symbol}: ${closePrice}`);
                
                // Create a minimal historical data object using the last close price
                historicalData = [{
                  date: new Date().toISOString().split('T')[0],
                  close: closePrice,
                  high: closePrice,
                  low: closePrice,
                  open: closePrice,
                  volume: 0
                }];
              } else {
                throw new Error('Invalid last close price data format');
              }
            } else {
              throw new Error(`Failed to get last close price: ${lastCloseResponse.status}`);
            }
          } catch (lastCloseError) {
            console.error(`Error getting last close price for ${symbol}:`, lastCloseError);
            
            // Fallback to using the current_price from the post record
            if (!post.current_price) {
              console.error(`No current price stored for stock ${symbol}`);
              continue;
            }
            
            // Create a minimal historical data object using the stored current_price
            const currentPriceValue = parseFloat(post.current_price);
            console.log(`Falling back to stored current price for ${symbol}: ${currentPriceValue}`);
            
            historicalData = [{
              date: new Date().toISOString().split('T')[0],
              close: currentPriceValue,
              high: currentPriceValue,
              low: currentPriceValue,
              open: currentPriceValue,
              volume: 0
            }];
          }
        }
        
        
        historicalData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        
        const targetPrice = parseFloat(post.target_price);
        const stopLossPrice = parseFloat(post.stop_loss_price);
        
        
        let targetReachedDate = null;
        let stopLossTriggeredDate = null;
        let targetReached = false;
        let stopLossTriggered = false;
        
        for (const dayData of historicalData) {
          const date = dayData.date;
          const high = parseFloat(dayData.high);
          const low = parseFloat(dayData.low);
          const close = parseFloat(dayData.close);
          
          
          if (!targetReached && high >= targetPrice) {
            targetReached = true;
            targetReachedDate = date;
            
          }
          
          
          if (!stopLossTriggered && low <= stopLossPrice) {
            stopLossTriggered = true;
            stopLossTriggeredDate = date;
            
          }
        }
        
        
        const lastPrice = historicalData.length > 0 
          ? parseFloat(historicalData[historicalData.length - 1].close) 
          : null;
        
        if (!lastPrice) {
          console.warn(`No recent closing price found for stock ${symbol}`);
          continue;
        }
        
        
        const shouldClosePost = targetReached || stopLossTriggered;
        
        
        const shouldUpdate = targetReached || stopLossTriggered || (post.last_price !== lastPrice) || shouldClosePost;
        
        if (shouldUpdate) {
          
          
          
          updatedPosts.push({
            id: post.id,
            user_id: userId, 
            
            
            content: post.content || '', 
            company_name: post.company_name || '',
            symbol: post.symbol || '',
            strategy: post.strategy || '',
            description: post.description || '',
            
            
            image_url: post.image_url,
            country: post.country,
            exchange: post.exchange,
            
            
            current_price: lastPrice,
            target_price: post.target_price,
            stop_loss_price: post.stop_loss_price,
            
            
            target_reached: targetReached,
            stop_loss_triggered: stopLossTriggered,
            target_reached_date: targetReachedDate,
            stop_loss_triggered_date: stopLossTriggeredDate,
            last_price_check: new Date().toISOString(),
            last_price: lastPrice,
            closed: shouldClosePost ? true : null
          });
        }
        
        
        results.push({
          id: post.id,
          symbol: post.symbol,
          companyName: post.company_name,
          currentPrice: lastPrice,
          targetPrice,
          stopLossPrice,
          targetReached,
          stopLossTriggered,
          targetReachedDate,
          stopLossTriggeredDate,
          closed: shouldClosePost,
          percentToTarget: (() => {
            // Determine if this is an upward target (target price > initial price when post was created)
            const isUpwardTarget = targetPrice > post.current_price;
            
            if (targetPrice !== lastPrice) {
              if (isUpwardTarget) {
                return ((targetPrice - lastPrice) / lastPrice * 100).toFixed(2);
              } else {
                return ((lastPrice - targetPrice) / lastPrice * 100).toFixed(2);
              }
            } else {
              return '0.00';
            }
          })(),
          percentToStopLoss: !stopLossTriggered && stopLossPrice < lastPrice
            ? ((lastPrice - stopLossPrice) / lastPrice * 100).toFixed(2)
            : 0
        });
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
      }
    }
    
    
    let updateSuccess = false;
    
    // Track successful and lost posts for experience calculation
    let successfulPosts = 0;
    let lostPosts = 0;
    
    // Count newly closed posts for experience calculation
    for (const post of updatedPosts) {
      // Only count posts that were just closed (not previously closed)
      if (post.closed === true) {
        if (post.target_reached) {
          successfulPosts++;
        } else if (post.stop_loss_triggered) {
          lostPosts++;
        }
      }
    }
    
    // Update user experience if any posts were closed
    if (successfulPosts > 0 || lostPosts > 0) {
      try {
        // First get current profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('success_posts, loss_posts')
          .eq('id', userId)
          .single();
        
        if (!profileError && profileData) {
          // Calculate new totals
          const newSuccessPosts = (profileData.success_posts || 0) + successfulPosts;
          const newLossPosts = (profileData.loss_posts || 0) + lostPosts;
          
          // Update the profile with new counts
          const { error: updateProfileError } = await adminSupabase
            .from('profiles')
            .update({
              success_posts: newSuccessPosts,
              loss_posts: newLossPosts,
              // Experience is calculated as successful posts minus lost posts
              experience_Score: newSuccessPosts - newLossPosts
            })
            .eq('id', userId);
          
          if (updateProfileError) {
            console.error('Error updating user experience score:', updateProfileError);
          } else {
            experienceUpdated = true;
            console.log(`Updated user experience score: +${successfulPosts} success, +${lostPosts} loss`);
          }
        } else {
          console.error('Error fetching profile for experience score update:', profileError);
        }
      } catch (error) {
        console.error('Error in experience score calculation:', error);
      }
    }
    
    if (updatedPosts.length > 0) {
      
      
      
      
      
      
      
      let retryCount = 0;
      const maxRetries = 2;
      
      while (!updateSuccess && retryCount <= maxRetries) {
        try {
          const { data: updateData, error: updateError } = await adminSupabase
            .from('posts')
            .upsert(updatedPosts, { onConflict: 'id', returning: 'minimal' });
          
          if (updateError) {
            console.error('Error updating posts:', updateError);
            retryCount++;
            
            if (retryCount <= maxRetries) {
              
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              
            }
          } else {
            
            updateSuccess = true;
            
            
            const updatedIds = updatedPosts.map(p => p.id);
            const { data: verifyData, error: verifyError } = await adminSupabase
              .from('posts')
              .select('id, target_reached, stop_loss_triggered, last_price, closed')
              .in('id', updatedIds);
              
            if (verifyError) {
              console.error('Error verifying update:', verifyError);
            } else {
              
              
            }
          }
        } catch (error) {
          console.error(`Error updating posts (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
          retryCount++;
          
          if (retryCount <= maxRetries) {
            
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            
          }
        }
      }
      
      
      results.updateSuccess = updateSuccess;
    }
    
    
    const { data: currentUsage, error: currentUsageError } = await supabase
      .from('price_check_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('check_date', today)
      .single();
    
    const usageCount = currentUsage ? currentUsage.count : 1;
    const remainingChecks = MAX_DAILY_CHECKS - usageCount;
    
    return NextResponse.json({
      success: true,
      message: 'Price check completed successfully',
      remainingChecks,
      usageCount,
      checkedPosts: results.length,
      updatedPosts: updatedPosts.length,
      closedPostsSkipped: closedPostsCount,
      updateSuccess,
      experienceUpdated,
      results
    });
  } catch (error) {
    console.error('Error checking post prices:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error checking post prices',
        error: error.message
      },
      { status: 500 }
    );
  }
}


async function ensurePostTableColumns() {
  try {
    // Define the required columns we need to ensure exist
    const requiredColumns = [
      { name: 'target_reached', type: 'boolean', default: null },
      { name: 'stop_loss_triggered', type: 'boolean', default: null },
      { name: 'target_reached_date', type: 'timestamptz', default: null },
      { name: 'stop_loss_triggered_date', type: 'timestamptz', default: null },
      { name: 'last_price_check', type: 'timestamptz', default: null },
      { name: 'last_price', type: 'decimal(15,4)', default: null },
      { name: 'closed', type: 'boolean', default: null }
    ];
    
    // Try to directly add each column without checking if it exists first
    // The add_column_if_not_exists RPC function will handle the existence check
    for (const column of requiredColumns) {
      const { error: alterError } = await supabase
        .rpc('add_column_if_not_exists', { 
          p_table_name: 'posts',
          p_column_name: column.name,
          p_data_type: column.type,
          p_default_value: column.default
        });
      
      if (alterError) {
        console.error(`Error adding column ${column.name}:`, alterError);
      }
    }
    
    // Ensure experience_Score column exists in profiles table
    const { error: experienceError } = await supabase
      .rpc('add_column_if_not_exists', { 
        p_table_name: 'profiles',
        p_column_name: 'experience_Score',
        p_data_type: 'integer',
        p_default_value: 0
      });
    
    if (experienceError) {
      console.error('Error adding experience_Score column to profiles table:', experienceError);
    }
  } catch (error) {
    console.error('Error ensuring table columns:', error);
  }
}
