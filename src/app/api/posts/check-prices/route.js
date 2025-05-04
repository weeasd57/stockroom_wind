import { createClient } from '@supabase/supabase-js';
import { BASE_URL, API_KEY, hasValidApiKey } from '@/models/StockApiConfig';
import { NextResponse } from 'next/server';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2VlY3BydmhwcWZpcnhtcGt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTE5MjI5MSwiZXhwIjoyMDUwNzY4MjkxfQ.HRkWciT9LzUF3b1zh-SdpdsQH2OaRqlnUpw7_73sJls';


const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');


const adminSupabase = createClient(supabaseUrl || '', serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'x-supabase-role': 'service_role',
      'Authorization': `Bearer ${serviceRoleKey}`
    },
  }
});

// Helper function to log status updates and DB operations
const logStatusUpdate = async (postId, symbol, status, result) => {
  const timestamp = new Date().toISOString();
  console.log(`[STATUS UPDATE][${timestamp}] Post ${postId} (${symbol}): ${status}`);
  
  // Log more detailed information if result contains data
  if (result.data) {
    console.log(`[STATUS DATA][${timestamp}] Post ${postId}: ${JSON.stringify(result.data).substring(0, 200)}${result.data.length > 200 ? '...' : ''}`);
  }
  
  // Log errors more clearly
  if (result.error) {
    console.error(`[STATUS ERROR][${timestamp}] Post ${postId}: ${result.error.message}`);
    if (result.error.details) {
      console.error(`[STATUS ERROR DETAILS][${timestamp}] Post ${postId}: ${JSON.stringify(result.error.details)}`);
    }
  }
  
  // Log to database if needed
  try {
    const logStartTime = Date.now();
    const { error } = await adminSupabase
      .from('operation_logs')
      .insert({
        operation_type: 'post_status_update',
        post_id: postId,
        symbol: symbol,
        status: status,
        success: !result.error,
        error_message: result.error ? result.error.message : null,
        data_summary: result.data ? JSON.stringify(result.data).substring(0, 1000) : null,
        created_at: timestamp
      })
      .select();
    const logDuration = Date.now() - logStartTime;
      
    if (error) {
      console.error(`[ERROR] Failed to log operation for post ${postId}: ${error.message}`);
    } else {
      console.log(`[DEBUG] Successfully logged operation for post ${postId} in ${logDuration}ms`);
    }
  } catch (err) {
    console.error(`[ERROR] Exception logging operation for post ${postId}: ${err.message}`);
    // Continue execution even if logging fails
  }
};

const MAX_DAILY_CHECKS = 100;

export async function POST(request) {
  console.log(`[DEBUG] Check-prices API route called at ${new Date().toISOString()}`);
  try {
    // Check if API key is configured
    if (!hasValidApiKey()) {
      console.error('[ERROR] EOD Historical Data API key is not configured');
      return NextResponse.json(
        { 
          success: false, 
          message: 'API key not configured. Please add NEXT_PUBLIC_EOD_API_KEY to your environment variables.',
          error: 'missing_api_key' 
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    console.log(`[DEBUG] Request body:`, JSON.stringify(body));
    const cookieHeader = request.headers.get('cookie');
    console.log(`[DEBUG] Cookie header present: ${!!cookieHeader}`);

    // Check if includeApiDetails flag is set
    const includeApiDetails = body.includeApiDetails === true;
    console.log(`[DEBUG] Include API details: ${includeApiDetails}`);

    let userId = body.userId;
    let experienceUpdated = false;
    // Initialize array to track API request details
    const apiDetails = [];

    
    if (!userId) {
      console.log(`[DEBUG] No userId in request body, attempting to get from session`);
      
      const { data: { session }, error: authError } = await supabase.auth.getSession({
        cookieHeader
      });
      
      if (authError) {
        console.error('[ERROR] Error verifying authentication:', authError.message);
        return NextResponse.json(
          { success: false, message: 'Authentication error', details: authError.message },
          { status: 401 }
        );
      }
      
      if (!session || !session.user) {
        console.error('[ERROR] No active user session found');
        return NextResponse.json(
          { success: false, message: 'Unauthorized', details: 'No active session' },
          { status: 401 }
        );
      }
      
      userId = session.user.id;
      console.log(`[DEBUG] Retrieved userId from session: ${userId}`);
    }
    
    
    
    
    if (!userId) {
      console.error('[ERROR] User ID not available after both checks');
      return NextResponse.json(
        { success: false, message: 'User ID not available' },
        { status: 401 }
      );
    }
    
    
    const today = new Date().toISOString().split('T')[0]; 
    console.log(`[DEBUG] Checking usage for user ${userId} on date ${today}`);
    
    const { data: usageData, error: usageError } = await supabase
      .from('price_check_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('check_date', today)
      .single();
    
    
    if (!usageError && usageData) {
      console.log(`[DEBUG] Found existing usage record: ${JSON.stringify(usageData)}`);
      
      if (usageData.count >= MAX_DAILY_CHECKS) {
        console.log(`[DEBUG] User has reached maximum daily checks (${usageData.count}/${MAX_DAILY_CHECKS})`);
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
      
      console.log(`[DEBUG] Updating usage count from ${usageData.count} to ${usageData.count + 1}`);
      const { error: updateError } = await supabase
        .from('price_check_usage')
        .update({ 
          count: usageData.count + 1,
          last_check: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('check_date', today);
      
      if (updateError) {
        console.error('[ERROR] Error updating usage count:', updateError);
      }
    } else {
      console.log(`[DEBUG] No existing usage record found, creating new record`);
      
      const { error: insertError } = await supabase
        .from('price_check_usage')
        .insert([
          { user_id: userId, check_date: today, count: 1 }
        ]);
      
      if (insertError) {
        console.error('[ERROR] Error creating new usage record:', insertError);
      } else {
        console.log(`[DEBUG] Successfully created new usage record`);
      }
    }
    
    console.log(`[DEBUG] Fetching all posts to count closed posts`);
    const { data: allPosts, error: allPostsError } = await supabase
      .from('posts')
      .select('id, closed')
      .eq('user_id', userId);
      
    if (allPostsError) {
      console.error('[ERROR] Error fetching all posts:', allPostsError);
    }
    
    const closedPostsCount = allPosts?.filter(post => post.closed === true).length || 0;
    console.log(`[DEBUG] Found ${closedPostsCount} closed posts out of ${allPosts?.length || 0} total posts`);
    
    
    console.log(`[DEBUG] Fetching open posts for price check`);
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
      console.error('[ERROR] Error fetching open posts:', postsError);
      throw postsError;
    }
    
    console.log(`[DEBUG] Found ${posts.length} open posts to check prices for`);
    
    const results = [];
    const updatedPosts = [];
    
    // Map to store historical data for each post
    const postHistoricalData = {};
    
    
    for (const post of posts) {
      try {
        console.log(`[DEBUG] Processing post ID ${post.id} for symbol ${post.symbol}`);
        
        if (!post.symbol || !post.target_price || !post.stop_loss_price) {
          console.warn(`[WARN] Skipping post ${post.id} - missing required fields (symbol: ${!!post.symbol}, target: ${!!post.target_price}, stop-loss: ${!!post.stop_loss_price})`);
          continue;
        }
        
        
        if (post.closed === true) {
          console.log(`[DEBUG] Skipping closed post ${post.id}`);
          continue;
        }
        
        
        const symbol = post.exchange ? `${post.symbol}.${post.exchange}` : post.symbol;
        console.log(`[DEBUG] Using symbol with exchange: ${symbol}`);
        
        
        // Get the date from the request or use today's date
        const requestDate = body.requestDate ? new Date(body.requestDate) : new Date();
        const todayDate = requestDate;

        // For the fromDate, use the post creation date without going back 30 days
        // This ensures we don't incorrectly go back to the previous month
        const createdAt = post.created_at ? new Date(post.created_at) : new Date(todayDate);

        // Adjust for timezone differences to ensure proper date comparison
        // When post is created at late night hours, the date conversion might result in a different day
        // Format dates for API request, using UTC to avoid timezone issues
        const fromDate = createdAt.toISOString().split('T')[0];
        const toDate = todayDate.toISOString().split('T')[0];
        console.log(`[DEBUG] Date range for historical data: ${fromDate} to ${toDate}`);

        // Record post creation date and time for comparison with price data later
        const postCreationDate = post.created_at ? new Date(post.created_at) : null;
        // Use UTC date for consistency with API data which is typically in UTC
        const postDateOnly = postCreationDate ? postCreationDate.toISOString().split('T')[0] : null;
        // Get hours in local time for market hours comparison
        const postTimeHours = postCreationDate ? postCreationDate.getHours() : 0;
        const postTimeMinutes = postCreationDate ? postCreationDate.getMinutes() : 0;

        // Additional logging to track timezone-related issues
        console.log(`[DEBUG] Post creation date/time: ${postCreationDate ? postCreationDate.toISOString() : 'none'}`);
        console.log(`[DEBUG] Post date only (UTC): ${postDateOnly}`);
        console.log(`[DEBUG] Post time (local): ${postTimeHours}:${postTimeMinutes}`);
        
        const historicalUrl = `${BASE_URL}/eod/${symbol}?from=${fromDate}&to=${toDate}&period=d&api_token=${API_KEY}&fmt=json`;
        console.log(`[DEBUG] Fetching historical data for ${symbol} from API`);

        // Record API request details
        const apiRequestInfo = {
          symbol: post.symbol,
          exchange: post.exchange || '',
          requestType: 'Historical prices',
          requestUrl: historicalUrl,
          timestamp: new Date().toISOString()
        };
        
        let historicalData;
        try {
          console.log(`[DEBUG] Sending historical data API request for ${symbol}`);
          
          const response = await fetch(historicalUrl);
          console.log(`[DEBUG] API response received with status: ${response.status}`);
          
          // Update API tracking with response info
          apiRequestInfo.responseStatus = response.status;
          
          if (!response.ok) {
            console.error(`[ERROR] API error for ${symbol}: ${response.status} ${response.statusText}`);
            apiRequestInfo.responseType = 'Error';
            apiRequestInfo.errorCode = response.status;
            
            if (includeApiDetails) {
              apiDetails.push(apiRequestInfo);
            }
            
            // Fallback directly to using the current_price from the post record
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
          } else {
            // Parse the response
            historicalData = await response.json();
            
            // Check if the response is valid
            if (!Array.isArray(historicalData) || historicalData.length === 0) {
              console.warn(`Empty historical data array returned for ${symbol}, falling back to stored current price`);
              
              // Fallback directly to using the current_price from the post record
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
            } else {
              // Record successful API response with historical data
              apiRequestInfo.responseType = 'Historical prices';
              apiRequestInfo.dataPoints = historicalData.length;
              if (includeApiDetails) {
                apiDetails.push(apiRequestInfo);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing stock ${post.symbol}:`, error);
          
          // Record error in API details
          if (includeApiDetails) {
            apiDetails.push({
              symbol: post.symbol,
              exchange: post.exchange || '',
              requestType: 'Error',
              responseType: 'Processing Error',
              errorDetails: error.message,
              timestamp: new Date().toISOString()
            });
          }
        }
        
        // Insert before the code that processes price data
        console.log(`[DEBUG] Post ${post.id}: Processing price data for ${symbol}`);
        console.log(`[DEBUG] - Target price: ${post.target_price}, Stop loss: ${post.stop_loss_price}`);
        
        // Check if we have valid historical data
        if (!Array.isArray(historicalData) || historicalData.length === 0) {
          console.error(`No historical data available for ${symbol}`);
          
          // Update the post with the status flag
          const updateResult = await adminSupabase
            .from('posts')
            .update({
              postDateAfterPriceDate: false,
              postAfterMarketClose: false,
              noDataAvailable: true,
              status_message: "No price data available",
              last_price_check: new Date().toISOString()
            })
            .eq('id', post.id);

          // Log the update operation
          await logStatusUpdate(post.id, post.symbol, "No price data available", updateResult);

          if (updateResult.error) {
            console.error(`Error updating post status for ${symbol}:`, updateResult.error);
          }
          
          results.push({
            id: post.id,
            symbol: post.symbol,
            companyName: post.company_name,
            currentPrice: post.current_price,
            targetPrice: post.target_price,
            stopLossPrice: post.stop_loss_price,
            message: "No price data available",
            noDataAvailable: true
          });
          
          continue;
        }

        // Insert at the point where historical data is processed
        if (historicalData && historicalData.length > 0) {
          console.log(`[DEBUG] Historical data points: ${historicalData.length}`);
          console.log(`[DEBUG] First data point: ${JSON.stringify(historicalData[0])}`);
          console.log(`[DEBUG] Last data point: ${JSON.stringify(historicalData[historicalData.length - 1])}`);
        } else {
          console.warn(`[WARN] No historical data points available for ${symbol}`);
        }

        // Get the last price date and check if it's valid for comparison with the post date
        const lastDataPoint = historicalData[historicalData.length - 1];
        const lastPriceDate = lastDataPoint ? new Date(lastDataPoint.date) : null;
        // Important: Get UTC date string for lastPriceDate to match postDateOnly format
        const lastPriceDateStr = lastPriceDate ? lastPriceDate.toISOString().split('T')[0] : null;

        // Log additional timezone information for debugging
        console.log(`[DEBUG] Last price date details: ${lastPriceDate} (${lastPriceDateStr})`);

        // Check if the post date is valid for comparison with the last price date
        if (postCreationDate && lastPriceDate) {
          // Log comparison details
          console.log(`[DEBUG] Comparing post date (${postDateOnly}) with last price date (${lastPriceDateStr})`);
          
          // If post date is after last price date, we can't check prices
          if (postDateOnly > lastPriceDateStr) {
            console.log(`[DEBUG] Post created after latest price data for ${symbol}, can't check prices accurately`);
            console.log(`[DEBUG] Post date: ${postDateOnly}, Last price date: ${lastPriceDateStr}`);
            
            // Update the post with the status flag
            const { error: updateError } = await adminSupabase
              .from('posts')
              .update({
                postDateAfterPriceDate: true,
                postAfterMarketClose: false,
                noDataAvailable: false,
                status_message: "Post created after latest price data - can't check target/stop loss",
                last_price_check: new Date().toISOString()
              })
              .eq('id', post.id);

            if (updateError) {
              console.error(`Error updating post status for ${symbol}:`, updateError);
            }
            
            results.push({
              id: post.id,
              symbol: post.symbol,
              companyName: post.company_name,
              currentPrice: post.current_price,
              targetPrice: post.target_price,
              stopLossPrice: post.stop_loss_price,
              message: "Post created after latest price data - can't check target/stop loss",
              postDateAfterPriceDate: true
            });
            
            continue;
          }
          
          // If post date is the same as last price date, check the time
          // Market data is usually end-of-day, so if post was created before market close,
          // we can compare, otherwise we can't check prices for the same day
          if (postDateOnly === lastPriceDateStr) {
            console.log(`[DEBUG] Post created on the same day as last price data, checking time`);
            
            // Convert post creation time to the exchange's timezone
            // For simplicity, we're assuming market close is at 4 PM (16:00) local time
            // This can be adjusted for different markets in the future
            const marketCloseHour = 16;
            
            // Log detailed time information for debugging
            console.log(`[DEBUG] Post time: ${postTimeHours}:${postTimeMinutes}, Market close hour: ${marketCloseHour}:00`);
            
            // If post was created after market close, can't check prices accurately
            if (postTimeHours >= marketCloseHour) {
              console.log(`[DEBUG] Post created after market close on ${postDateOnly}, can't check prices accurately`);
              
              // Update the post with the status flag
              const { error: updateError } = await adminSupabase
                .from('posts')
                .update({
                  postDateAfterPriceDate: false,
                  postAfterMarketClose: true,
                  noDataAvailable: false,
                  status_message: "Post created after market close - recent price data not available",
                  last_price_check: new Date().toISOString()
                })
                .eq('id', post.id);

              if (updateError) {
                console.error(`Error updating post status for ${symbol}:`, updateError);
              }
              
              results.push({
                id: post.id,
                symbol: post.symbol,
                companyName: post.company_name,
                currentPrice: post.current_price,
                targetPrice: post.target_price,
                stopLossPrice: post.stop_loss_price,
                message: "Post created after market close - recent price data not available",
                postAfterMarketClose: true
              });
              
              continue;
            }
            
            console.log(`[DEBUG] Post created before market close on ${postDateOnly}, can check prices`);
          }
        }
        
        // Continue with normal price checking if we've passed the date validation checks
        const targetPrice = parseFloat(post.target_price);
        const stopLossPrice = parseFloat(post.stop_loss_price);
        
        // Track if target has been hit
        let targetReachedDate = null;
        let stopLossTriggeredDate = null;
        let targetReached = false;
        let stopLossTriggered = false;
        let highPrice = null; // Store the high price when target is reached
        let targetHitTime = null; // Store the time of day when target was hit (if available)
        
        for (const dayData of historicalData) {
          const date = dayData.date;
          const high = parseFloat(dayData.high);
          const low = parseFloat(dayData.low);
          const close = parseFloat(dayData.close);
          
          // First check if target is reached - this has priority
          if (!targetReached && high >= targetPrice) {
            targetReached = true;
            targetReachedDate = date;
            highPrice = high; // Store the high price that reached the target
            
            // Try to extract time if it's included in the date string
            if (date.includes('T')) {
              try {
                const dateObj = new Date(date);
                targetHitTime = dateObj.toTimeString().split(' ')[0]; // Format as HH:MM:SS
              } catch (e) {
                // If date parsing fails, leave targetHitTime as null
              }
            }
            
            // Do not check for stop loss once target is reached
            continue;
          }
          
          // Only check for stop loss if target hasn't been reached
          if (!targetReached && !stopLossTriggered && low <= stopLossPrice) {
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
        
        // Find the highest price in the historical data
        const highestPrice = historicalData.reduce((max, data) => {
          const dataHigh = parseFloat(data.high);
          return dataHigh > max ? dataHigh : max;
        }, 0);
        
        
        const shouldClosePost = targetReached || stopLossTriggered;
        
        
        const shouldUpdate = targetReached || stopLossTriggered || (post.last_price !== lastPrice) || shouldClosePost;
        
        if (shouldUpdate) {
          // Keep original target, stop loss and initial prices intact
          // Only update the current price with the last available price
          updatedPosts.push({
            id: post.id,
            user_id: userId, 
            
            // Keep original content information
            content: post.content || '', 
            company_name: post.company_name || '',
            symbol: post.symbol || '',
            strategy: post.strategy || '',
            description: post.description || '',
            
            // Keep original metadata
            image_url: post.image_url,
            country: post.country,
            exchange: post.exchange,
            
            // Update current price but preserve target, stop loss, and initial price
            current_price: lastPrice,
            target_price: post.target_price, // Keep original target price
            stop_loss_price: post.stop_loss_price, // Keep original stop loss
            initial_price: post.initial_price, // Never change the initial price once set
            high_price: highestPrice, // Store the highest price in the period
            target_high_price: highPrice, // Store the high price when target was reached
            
            // Update status information
            target_reached: targetReached,
            stop_loss_triggered: stopLossTriggered,
            target_reached_date: targetReachedDate,
            target_hit_time: targetHitTime, // Add the time when target was hit
            stop_loss_triggered_date: stopLossTriggeredDate,
            last_price_check: new Date().toISOString(),
            last_price: lastPrice,
            closed: shouldClosePost ? true : null,
            postDateAfterPriceDate: false,
            postAfterMarketClose: false,
            noDataAvailable: false,
            status_message: shouldClosePost ? "Post closed" : "Post still active"
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

        // Insert right before the post is updated
        console.log(`[DEBUG] Post ${post.id} price check results:`);
        console.log(`[DEBUG] - Symbol: ${symbol}, Last price: ${lastPrice}`);
        console.log(`[DEBUG] - Target reached: ${targetReached}, Stop loss triggered: ${stopLossTriggered}`);
        console.log(`[DEBUG] - Will close post: ${shouldClosePost}`);

        // Add near line ~600 where price processing happens
        console.log(`[DEBUG] Checking targets for post ${post.id}. Target: ${post.target_price}, Stop-loss: ${post.stop_loss_price}, Current: ${lastPrice}`);
        
        // Add near line ~700 where posts are being updated
        console.log(`[DEBUG] Updating post ${post.id}. Setting current_price: ${lastPrice}, target_reached: ${targetReached}, stop_loss_triggered: ${stopLossTriggered}`);

        // Store historical data in the map
        postHistoricalData[post.id] = historicalData;
      } catch (error) {
        console.error(`Error processing stock ${post.symbol}:`, error);
        
        // Record error in API details
        if (includeApiDetails) {
          apiDetails.push({
            symbol: post.symbol,
            exchange: post.exchange || '',
            requestType: 'Error',
            responseType: 'Processing Error',
            errorDetails: error.message,
            timestamp: new Date().toISOString()
          });
        }
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
      console.log(`Attempting to update ${updatedPosts.length} posts in Supabase...`);
      
      // Update each post with its price check results
      for (let i = 0; i < updatedPosts.length; i++) {
        try {
          const post = updatedPosts[i];
          const postResult = results.find(r => r.id === post.id);
          
          if (postResult) {
            // Get the current price_checks array or initialize if not present
            let priceChecks = post.price_checks || [];
            
            // Handle string format if the JSONB was returned as a string
            if (typeof priceChecks === 'string') {
              try {
                priceChecks = JSON.parse(priceChecks);
              } catch (e) {
                console.error(`Error parsing price_checks for post ${post.id}:`, e);
                priceChecks = [];
              }
            }
            
            // If it's not an array, initialize it
            if (!Array.isArray(priceChecks)) {
              priceChecks = [];
            }
            
            // Add the new price check entry
            priceChecks.push({
              price: post.last_price,
              date: new Date().toISOString(),
              target_reached: post.target_reached,
              stop_loss_triggered: post.stop_loss_triggered,
              percent_to_target: postResult.percentToTarget,
              percent_to_stop_loss: postResult.percentToStopLoss
            });
            
            // Update the post with the updated price_checks array
            post.price_checks = priceChecks;
            
            // Get the historical data we already fetched
            const historicalData = postHistoricalData[post.id];
            
            if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
              // Store the historical data directly in the price_checks field instead of creating a summary
              post.price_checks = historicalData;
              console.log(`[DEBUG] Stored ${historicalData.length} historical data points in price_checks for post ${post.id}`);
            } else {
              console.warn(`[WARN] No historical data available for post ${post.id}, keeping existing price_checks`);
            }
          }
        } catch (error) {
          console.error(`Error updating price_checks for post ${updatedPosts[i]?.id}:`, error);
        }
      }
      
      let retryCount = 0;
      const maxRetries = 2;
      
      // Log a sample post update for debugging
      if (updatedPosts.length > 0) {
        const samplePost = updatedPosts[0];
        console.log(`Sample post update - ID: ${samplePost.id}`);
        console.log(`Status flags: noDataAvailable=${samplePost.noDataAvailable}, postDateAfterPriceDate=${samplePost.postDateAfterPriceDate}, postAfterMarketClose=${samplePost.postAfterMarketClose}`);
      }
      
      while (!updateSuccess && retryCount <= maxRetries) {
        try {
          const { data: updateData, error: updateError } = await adminSupabase
            .from('posts')
            .upsert(updatedPosts, { onConflict: 'id', returning: 'minimal' });
          
          if (updateError) {
            console.error('Error updating posts:', updateError);
            console.error('Error details:', updateError.message);
            
            // Check for specific error types
            if (updateError.message && updateError.message.includes('permission denied')) {
              console.error('PERMISSION DENIED: The service role may not have proper access. Check RLS policies.');
            }
            
            retryCount++;
            
            if (retryCount <= maxRetries) {
              console.log(`Retrying update in ${1000 * retryCount}ms (attempt ${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          } else {
            console.log(`Successfully updated ${updatedPosts.length} posts in Supabase!`);
            updateSuccess = true;
            
            // Verify the updates by checking a sample of posts
            const sampleIds = updatedPosts.slice(0, 3).map(p => p.id); // Check up to 3 posts
            const { data: verifyData, error: verifyError } = await adminSupabase
              .from('posts')
              .select('id, target_reached, stop_loss_triggered, last_price, closed, postDateAfterPriceDate, postAfterMarketClose, noDataAvailable')
              .in('id', sampleIds);
              
            if (verifyError) {
              console.error('Error verifying update:', verifyError);
            } else {
              console.log(`Verification successful. Sample of updated posts:`, verifyData);
            }
          }
        } catch (error) {
          console.error(`Error updating posts (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
          console.error('Error type:', error.name, 'Message:', error.message);
          retryCount++;
          
          if (retryCount <= maxRetries) {
            console.log(`Retrying update in ${1000 * retryCount}ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
      // If all attempts failed, try one more time with a different approach
      if (!updateSuccess) {
        console.error(`Failed to update posts with upsert. Trying individual updates...`);
        
        let individualUpdateSuccess = 0;
        
        // Try updating posts one by one
        for (const post of updatedPosts) {
          try {
            const { error: singleUpdateError } = await adminSupabase
              .from('posts')
              .update({
                current_price: post.current_price,
                target_reached: post.target_reached,
                stop_loss_triggered: post.stop_loss_triggered,
                target_reached_date: post.target_reached_date,
                stop_loss_triggered_date: post.stop_loss_triggered_date,
                last_price_check: post.last_price_check,
                last_price: post.last_price,
                closed: post.closed,
                postDateAfterPriceDate: post.postDateAfterPriceDate,
                postAfterMarketClose: post.postAfterMarketClose,
                noDataAvailable: post.noDataAvailable,
                status_message: post.status_message
              })
              .eq('id', post.id);
            
            if (singleUpdateError) {
              console.error(`Error updating post ${post.id}:`, singleUpdateError);
            } else {
              individualUpdateSuccess++;
            }
          } catch (err) {
            console.error(`Exception updating post ${post.id}:`, err);
          }
        }
        
        if (individualUpdateSuccess > 0) {
          console.log(`Successfully updated ${individualUpdateSuccess}/${updatedPosts.length} posts individually`);
          updateSuccess = individualUpdateSuccess === updatedPosts.length;
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
    
    console.log(`[DEBUG] Price check completed for ${posts.length} posts. Updated: ${updatedPosts.length}, Skipped: ${closedPostsCount}, Remaining checks today: ${remainingChecks}`);
    
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
      results,
      apiDetails: includeApiDetails ? apiDetails : []
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
