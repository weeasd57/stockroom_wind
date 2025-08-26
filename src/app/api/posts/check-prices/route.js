import { createClient } from '@supabase/supabase-js';
import { BASE_URL, API_KEY, hasValidApiKey } from '@/models/StockApiConfig';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Use environment variables for service role key (server-only)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Debug flag to reduce noisy logs in production
const DEBUG = process.env.PRICE_CHECK_DEBUG === '1' || process.env.PRICE_CHECK_DEBUG === 'true';

// Check if required environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required Supabase environment variables:', {
    supabaseUrl: !!supabaseUrl,
    supabaseAnonKey: !!supabaseAnonKey,
    serviceRoleKey: !!serviceRoleKey
  });
}

// Create admin client function to be called when needed
const createAdminClient = () => {
  // Use service role key if available, otherwise fall back to anon key
  const keyToUse = serviceRoleKey || supabaseAnonKey;
  const isServiceRole = !!serviceRoleKey && serviceRoleKey !== supabaseAnonKey;
  
  return createClient(supabaseUrl || '', keyToUse, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: isServiceRole ? {
        'x-supabase-role': 'service_role',
        'Authorization': `Bearer ${keyToUse}`
      } : {}
    }
  });
};

// Admin client is created lazily inside the POST handler to avoid build-time env errors

// Helper: log status update (gated by DEBUG)
async function logStatusUpdate(supabaseClient, postId, symbol, message, updateResult) {
  try {
    if (DEBUG) {
      console.log(`[DEBUG] Status update for post ${postId} (${symbol}): ${message}`);
      if (updateResult && updateResult.error) {
        console.log(`[DEBUG] Update error:`, updateResult.error);
      }
    }
    // Optional: persist to an audit table if available
    // await supabaseClient.from('status_logs').insert([{ post_id: postId, symbol, message }]);
  } catch (e) {
    console.error('[ERROR] logStatusUpdate failed:', e);
  }
}

// Helper: restrict upsert payload to allowed columns only
const ALLOWED_UPDATE_FIELDS = new Set([
  'id',
  'current_price',
  'high_price',
  'target_high_price',
  'target_reached',
  'stop_loss_triggered',
  'target_reached_date',
  'target_hit_time',
  'stop_loss_triggered_date',
  'last_price_check',
  'closed',
  'postdateafterpricedate',
  'postaftermarketclose',
  'nodataavailable',
  'status_message',
  'price_checks'
]);

function mapPostForDb(post) {
  const out = {};
  // Always include id for upsert target
  out.id = post.id;
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (key === 'id') continue;
    if (post[key] !== undefined) {
      out[key] = post[key];
    }
  }
  return out;
}

const MAX_DAILY_CHECKS = 100;

export async function POST(request) {
  if (DEBUG) console.log(`[DEBUG] Check-prices API route called at ${new Date().toISOString()}`);
  
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        message: 'Database configuration not available',
        error: 'missing_database_config'
      }, { status: 503 });
    }

    // Ensure service role key is available for admin operations
    if (!serviceRoleKey) {
      console.error('[ERROR] Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
      return NextResponse.json({
        success: false,
        message: 'Server misconfigured: missing service role key',
        error: 'missing_service_role_key'
      }, { status: 503 });
    }

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

    // Lazily create admin client after verifying env configuration
    const adminSupabase = createAdminClient();

    // Create public/anon client after validation
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const body = await request.json().catch(() => ({}));
    if (DEBUG) console.log(`[DEBUG] Request body:`, JSON.stringify(body));
    const cookieHeader = request.headers.get('cookie');
    if (DEBUG) console.log(`[DEBUG] Cookie header present: ${!!cookieHeader}`);

    // Check if includeApiDetails flag is set
    const includeApiDetails = body.includeApiDetails === true;
    if (DEBUG) console.log(`[DEBUG] Include API details: ${includeApiDetails}`);

    let userId = body.userId;
    let experienceUpdated = false;
    // Initialize array to track API request details
    const apiDetails = [];

    
    if (!userId) {
      if (DEBUG) console.log(`[DEBUG] No userId in request body, attempting to get from session`);
      
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
      if (DEBUG) console.log(`[DEBUG] Retrieved userId from session: ${userId}`);
    }
    
    
    
    
    if (!userId) {
      console.error('[ERROR] User ID not available after both checks');
      return NextResponse.json(
        { success: false, message: 'User ID not available' },
        { status: 401 }
      );
    }
    
    
    const today = new Date().toISOString().split('T')[0]; 
    if (DEBUG) console.log(`[DEBUG] Checking usage for user ${userId} on date ${today}`);
    
    // Reduce SELECT fields to improve performance
    const { data: usageData, error: usageError } = await adminSupabase
      .from('price_check_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('check_date', today)
      .single();
    
    
    if (!usageError && usageData) {
      if (DEBUG) console.log(`[DEBUG] Found existing usage record: ${JSON.stringify(usageData)}`);
      
      if (usageData.count >= MAX_DAILY_CHECKS) {
        if (DEBUG) console.log(`[DEBUG] User has reached maximum daily checks (${usageData.count}/${MAX_DAILY_CHECKS})`);
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
      
      if (DEBUG) console.log(`[DEBUG] Updating usage count from ${usageData.count} to ${usageData.count + 1}`);
      const { error: updateError } = await adminSupabase
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
      if (DEBUG) console.log(`[DEBUG] No existing usage record found, creating new record`);
      
      const { error: insertError } = await adminSupabase
        .from('price_check_usage')
        .insert([
          { user_id: userId, check_date: today, count: 1 }
        ]);
      
      if (insertError) {
        console.error('[ERROR] Error creating new usage record:', insertError);
      } else {
        if (DEBUG) console.log(`[DEBUG] Successfully created new usage record`);
      }
    }
    
    if (DEBUG) console.log(`[DEBUG] Fetching all posts to count closed posts`);
    const { data: allPosts, error: allPostsError } = await supabase
      .from('posts')
      .select('id, closed')
      .eq('user_id', userId);
      
    if (allPostsError) {
      console.error('[ERROR] Error fetching all posts:', allPostsError);
    }
    
    const closedPostsCount = allPosts?.filter(post => post.closed === true).length || 0;
    if (DEBUG) console.log(`[DEBUG] Found ${closedPostsCount} closed posts out of ${allPosts?.length || 0} total posts`);
    
    
    if (DEBUG) console.log(`[DEBUG] Fetching open posts for price check`);
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
        created_at,
        closed
      `)
      .eq('user_id', userId)
      .or('closed.is.null,closed.eq.false'); // Only open posts or null closed

    
    
    if (postsError) {
      console.error('[ERROR] Error fetching open posts:', postsError);
      throw postsError;
    }
    
    if (DEBUG) console.log(`[DEBUG] Found ${posts.length} open posts to check prices for`);
    
    const results = [];
    const updatedPosts = [];
    
    // Map to store historical data for each post
    const postHistoricalData = {};
    
    
    for (const post of posts) {
      try {
        if (DEBUG) console.log(`[DEBUG] Processing post ID ${post.id} for symbol ${post.symbol}`);
        
        if (!post.symbol || !post.target_price || !post.stop_loss_price) {
          console.warn(`[WARN] Skipping post ${post.id} - missing required fields (symbol: ${!!post.symbol}, target: ${!!post.target_price}, stop-loss: ${!!post.stop_loss_price})`);
          continue;
        }
        
        
        if (post.closed === true) {
          if (DEBUG) console.log(`[DEBUG] Skipping closed post ${post.id}`);
          continue;
        }
        
        
        const symbol = post.exchange ? `${post.symbol}.${post.exchange}` : post.symbol;
        if (DEBUG) console.log(`[DEBUG] Using symbol with exchange: ${symbol}`);
        
        
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
        if (DEBUG) console.log(`[DEBUG] Date range for historical data: ${fromDate} to ${toDate}`);

        // Record post creation date and time for comparison with price data later
        const postCreationDate = post.created_at ? new Date(post.created_at) : null;
        // Use UTC date for consistency with API data which is typically in UTC
        const postDateOnly = postCreationDate ? postCreationDate.toISOString().split('T')[0] : null;
        // Get hours in local time for market hours comparison
        const postTimeHours = postCreationDate ? postCreationDate.getHours() : 0;
        const postTimeMinutes = postCreationDate ? postCreationDate.getMinutes() : 0;

        // Additional logging to track timezone-related issues
        if (DEBUG) console.log(`[DEBUG] Post creation date/time: ${postCreationDate ? postCreationDate.toISOString() : 'none'}`);
        if (DEBUG) console.log(`[DEBUG] Post date only (UTC): ${postDateOnly}`);
        if (DEBUG) console.log(`[DEBUG] Post time (local): ${postTimeHours}:${postTimeMinutes}`);
        
        const historicalUrl = `${BASE_URL}/eod/${symbol}?from=${fromDate}&to=${toDate}&period=d&api_token=${API_KEY}&fmt=json`;
        if (DEBUG) console.log(`[DEBUG] Fetching historical data for ${symbol} from API`);

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
          if (DEBUG) console.log(`[DEBUG] Sending historical data API request for ${symbol}`);
          // Add timeout to fetch via AbortController
          const controller = new AbortController();
          const timeoutMs = parseInt(process.env.PRICE_CHECK_FETCH_TIMEOUT || '12000', 10);
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          const response = await fetch(historicalUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (DEBUG) console.log(`[DEBUG] API response received with status: ${response.status}`);
          
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
            if (DEBUG) console.log(`[DEBUG] Falling back to stored current price for ${symbol}: ${currentPriceValue}`);
            
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
              if (DEBUG) console.warn(`Empty historical data array returned for ${symbol}, falling back to stored current price`);
              
              // Fallback directly to using the current_price from the post record
              if (!post.current_price) {
                console.error(`No current price stored for stock ${symbol}`);
                continue;
              }
              
              // Create a minimal historical data object using the stored current_price
              const currentPriceValue = parseFloat(post.current_price);
              if (DEBUG) console.log(`Falling back to stored current price for ${symbol}: ${currentPriceValue}`);
              
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
        if (DEBUG) console.log(`[DEBUG] Post ${post.id}: Processing price data for ${symbol}`);
        if (DEBUG) console.log(`[DEBUG] - Target price: ${post.target_price}, Stop loss: ${post.stop_loss_price}`);
        
        // Check if we have valid historical data
        if (!Array.isArray(historicalData) || historicalData.length === 0) {
          console.error(`No historical data available for ${symbol}`);
          
          // Update the post with the status flag
          const updateResult = await adminSupabase
            .from('posts')
            .update({
              postdateafterpricedate: false,
              postaftermarketclose: false,
              nodataavailable: true,
              status_message: "No price data available",
              last_price_check: new Date().toISOString()
              // Do not update these fields to preserve their original values
              // country: post.country,
              // initial_price: post.initial_price
            })
            .eq('id', post.id);

          // Log the update operation
          await logStatusUpdate(adminSupabase, post.id, post.symbol, "No price data available", updateResult);

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
          if (DEBUG) {
            console.log(`[DEBUG] Historical data points: ${historicalData.length}`);
            console.log(`[DEBUG] First data point: ${JSON.stringify(historicalData[0])}`);
            console.log(`[DEBUG] Last data point: ${JSON.stringify(historicalData[historicalData.length - 1])}`);
          }
        } else {
          console.warn(`[WARN] No historical data points available for ${symbol}`);
        }

        // Get the last price date and check if it's valid for comparison with the post date
        const lastDataPoint = historicalData[historicalData.length - 1];
        const lastPriceDate = lastDataPoint ? new Date(lastDataPoint.date) : null;
        // Important: Get UTC date string for lastPriceDate to match postDateOnly format
        const lastPriceDateStr = lastPriceDate ? lastPriceDate.toISOString().split('T')[0] : null;

        // Log additional timezone information for debugging
        if (DEBUG) console.log(`[DEBUG] Last price date details: ${lastPriceDate} (${lastPriceDateStr})`);

        // Check if the post date is valid for comparison with the last price date
        if (postCreationDate && lastPriceDate) {
          // Log comparison details
          if (DEBUG) console.log(`[DEBUG] Comparing post date (${postDateOnly}) with last price date (${lastPriceDateStr})`);
          
          // If post date is after last price date, we can't check prices
          if (postDateOnly > lastPriceDateStr) {
            if (DEBUG) console.log(`[DEBUG] Post created after latest price data for ${symbol}, can't check prices accurately`);
            if (DEBUG) console.log(`[DEBUG] Post date: ${postDateOnly}, Last price date: ${lastPriceDateStr}`);
            
            // Update the post with the status flag
            const { error: updateError } = await adminSupabase
              .from('posts')
              .update({
                postdateafterpricedate: true,
                postaftermarketclose: false,
                nodataavailable: false,
                status_message: "Post created after latest price data - can't check target/stop loss",
                last_price_check: new Date().toISOString()
                // Do not update these fields to preserve their original values
                // country: post.country,
                // initial_price: post.initial_price
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
            if (DEBUG) console.log(`[DEBUG] Post created on the same day as last price data, checking time`);
            
            // Convert post creation time to the exchange's timezone
            // For simplicity, we're assuming market close is at 4 PM (16:00) local time
            // This can be adjusted for different markets in the future
            const marketCloseHour = 16;
            
            // Log detailed time information for debugging
            if (DEBUG) console.log(`[DEBUG] Post time: ${postTimeHours}:${postTimeMinutes}, Market close hour: ${marketCloseHour}:00`);
            
            // If post was created after market close, can't check prices accurately
            if (postTimeHours >= marketCloseHour) {
              if (DEBUG) console.log(`[DEBUG] Post created after market close on ${postDateOnly}, can't check prices accurately`);
              
              // Update the post with the status flag
              const { error: updateError } = await adminSupabase
                .from('posts')
                .update({
                  postdateafterpricedate: false,
                  postaftermarketclose: true,
                  nodataavailable: false,
                  status_message: "Post created after market close - recent price data not available",
                  last_price_check: new Date().toISOString()
                  // Do not update these fields to preserve their original values
                  // country: post.country,
                  // initial_price: post.initial_price
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
            
            if (DEBUG) console.log(`[DEBUG] Post created before market close on ${postDateOnly}, can check prices`);
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
        
        
        const shouldUpdate = targetReached || stopLossTriggered || (post.current_price !== lastPrice) || shouldClosePost;
        
        if (shouldUpdate) {
          // Only include fields that must change; avoid overwriting other columns
          updatedPosts.push({
            id: post.id,
            current_price: lastPrice,
            high_price: highestPrice,
            target_high_price: highPrice,
            target_reached: targetReached,
            stop_loss_triggered: stopLossTriggered,
            target_reached_date: targetReachedDate,
            target_hit_time: targetHitTime,
            stop_loss_triggered_date: stopLossTriggeredDate,
            last_price_check: new Date().toISOString(),
            closed: shouldClosePost ? true : undefined,
            postdateafterpricedate: false,
            postaftermarketclose: false,
            nodataavailable: false,
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
        if (DEBUG) console.log(`[DEBUG] Post ${post.id} price check results:`);
        if (DEBUG) console.log(`[DEBUG] - Symbol: ${symbol}, Last price: ${lastPrice}`);
        if (DEBUG) console.log(`[DEBUG] - Target reached: ${targetReached}, Stop loss triggered: ${stopLossTriggered}`);
        if (DEBUG) console.log(`[DEBUG] - Will close post: ${shouldClosePost}`);

        // Add near line ~600 where price processing happens
        if (DEBUG) console.log(`[DEBUG] Checking targets for post ${post.id}. Target: ${post.target_price}, Stop-loss: ${post.stop_loss_price}, Current: ${lastPrice}`);
        
        // Add near line ~700 where posts are being updated
        if (DEBUG) console.log(`[DEBUG] Updating post ${post.id}. Setting current_price: ${lastPrice}, target_reached: ${targetReached}, stop_loss_triggered: ${stopLossTriggered}`);

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
          
          // Update the profile with new counts using shared adminSupabase
          const { error: updateProfileError } = await adminSupabase
            .from('profiles')
            .update({
              success_posts: newSuccessPosts,
              loss_posts: newLossPosts,
              // Experience is calculated as successful posts minus lost posts
              experience_score: newSuccessPosts - newLossPosts
            })
            .eq('id', userId);
          
          if (updateProfileError) {
            console.error('Error updating user experience score:', updateProfileError);
          } else {
            experienceUpdated = true;
            if (DEBUG) console.log(`Updated user experience score: +${successfulPosts} success, +${lostPosts} loss`);
          }
        } else {
          console.error('Error fetching profile for experience score update:', profileError);
        }
      } catch (error) {
        console.error('Error in experience score calculation:', error);
      }
    }

    if (updatedPosts.length > 0) {
      if (DEBUG) console.log(`Attempting to update ${updatedPosts.length} posts in Supabase...`);
      
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
              price: postResult.currentPrice,
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
              if (DEBUG) console.log(`[DEBUG] Stored ${historicalData.length} historical data points in price_checks for post ${post.id}`);
            } else {
              if (DEBUG) console.warn(`[WARN] No historical data available for post ${post.id}, keeping existing price_checks`);
            }
            // Trim price_checks to a maximum length if needed
            const MAX_CHECKS = parseInt(process.env.MAX_PRICE_CHECKS || '365', 10);
            if (Array.isArray(post.price_checks) && post.price_checks.length > MAX_CHECKS) {
              post.price_checks = post.price_checks.slice(-MAX_CHECKS);
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
        try {
          // Upsert in batches to avoid timeouts and large payloads
          const UPSERT_BATCH = parseInt(process.env.PRICE_CHECK_UPSERT_BATCH || '100', 10);
          let updateError = null;
          for (let start = 0; start < updatedPosts.length; start += UPSERT_BATCH) {
            const batch = updatedPosts.slice(start, start + UPSERT_BATCH).map(mapPostForDb);
            const { error } = await adminSupabase
              .from('posts')
              .upsert(batch, { onConflict: 'id', returning: 'minimal' });
            if (error) {
              updateError = error;
              console.error('Error updating posts batch:', error);
              break;
            }
          }
          const updateData = null; // not used
          
          if (updateError) {
            console.error('Error updating posts:', updateError);
            console.error('Error details:', updateError.message);
            
            // Check for specific error types
            if (updateError.message && updateError.message.includes('permission denied')) {
              console.error('PERMISSION DENIED: The service role may not have proper access. Check RLS policies.');
            }
            
            retryCount++;
            
            if (retryCount <= maxRetries) {
              if (DEBUG) console.log(`Retrying update in ${1000 * retryCount}ms (attempt ${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          } else {
            if (DEBUG) console.log(`Successfully updated ${updatedPosts.length} posts in Supabase!`);
            updateSuccess = true;
            
            // Verify the updates by checking a sample of posts
            const sampleIds = updatedPosts.slice(0, 3).map(p => p.id); // Check up to 3 posts
            const { data: verifyData, error: verifyError } = await adminSupabase
              .from('posts')
              .select('id, target_reached, stop_loss_triggered, closed, postdateafterpricedate, postaftermarketclose, nodataavailable')
              .in('id', sampleIds);
              
            if (verifyError) {
              console.error('Error verifying update:', verifyError);
            } else {
              if (DEBUG) console.log(`Verification successful. Sample of updated posts:`, verifyData);
            }
          }
        } catch (error) {
          console.error(`Error updating posts (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
          console.error('Error type:', error.name, 'Message:', error.message);
          retryCount++;
          
          if (retryCount <= maxRetries) {
            if (DEBUG) console.log(`Retrying update in ${1000 * retryCount}ms...`);
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
                closed: post.closed,
                postdateafterpricedate: post.postdateafterpricedate,
                postaftermarketclose: post.postaftermarketclose,
                nodataavailable: post.nodataavailable,
                // persist price checks when falling back to individual updates
                price_checks: post.price_checks,
                status_message: post.status_message,
                // Do not update these fields to prevent them from being set to null
                // country: post.country,
                // initial_price: post.initial_price,
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
          if (DEBUG) console.log(`Successfully updated ${individualUpdateSuccess}/${updatedPosts.length} posts individually`);
          updateSuccess = individualUpdateSuccess === updatedPosts.length;
        }
      }
      
      results.updateSuccess = updateSuccess;
    }
    
    
    const { data: currentUsage, error: currentUsageError } = await adminSupabase
      .from('price_check_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('check_date', today)
      .single();
    
    const usageCount = currentUsage ? currentUsage.count : 1;
    const remainingChecks = MAX_DAILY_CHECKS - usageCount;
    
    if (DEBUG) console.log(`[DEBUG] Price check completed for ${posts.length} posts. Updated: ${updatedPosts.length}, Skipped: ${closedPostsCount}, Remaining checks today: ${remainingChecks}`);
    
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