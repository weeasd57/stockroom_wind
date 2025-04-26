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

    // Check if includeApiDetails flag is set
    const includeApiDetails = body.includeApiDetails === true;

    let userId = body.userId;
    let experienceUpdated = false;
    // Initialize array to track API request details
    const apiDetails = [];

    
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
        
        
        // Get the date from the request or use today's date
        const requestDate = body.requestDate ? new Date(body.requestDate) : new Date();
        const todayDate = requestDate;
        
        // Use the created_at date from post or one month before request date if not available
        const createdAt = post.created_at ? new Date(post.created_at) : new Date(todayDate);
        createdAt.setDate(createdAt.getDate() - 30); // Ensure we have at least some historical data
        
        // Format dates for API request
        const fromDate = createdAt.toISOString().split('T')[0];
        const toDate = todayDate.toISOString().split('T')[0];
        
        // Record post creation date and time for comparison with price data later
        const postCreationDate = post.created_at ? new Date(post.created_at) : null;
        const postDateOnly = postCreationDate ? postCreationDate.toISOString().split('T')[0] : null;
        const postTimeHours = postCreationDate ? postCreationDate.getHours() : 0;
        const postTimeMinutes = postCreationDate ? postCreationDate.getMinutes() : 0;
        
        const historicalUrl = `${BASE_URL}/eod/${symbol}?from=${fromDate}&to=${toDate}&period=d&api_token=${API_KEY}&fmt=json`;

        // Record API request details
        const apiRequestInfo = {
          symbol: post.symbol,
          exchange: post.exchange || '',
          requestType: 'Historical prices',
          requestUrl: historicalUrl,
          timestamp: new Date().toISOString()
        };
        
        let historicalData;  // Declare historicalData variable here
        
        try {
          // Fetch historical data
          console.log(`Fetching EOD data for ${symbol} from ${fromDate} to ${toDate}`);
          const response = await fetch(historicalUrl);
          
          if (!response.ok) {
            console.error(`Error getting stock data for ${symbol}:`, response.statusText);
            
            // Record failed API response
            if (includeApiDetails) {
              apiRequestInfo.responseType = 'API Error';
              apiRequestInfo.errorDetails = response.statusText;
              apiDetails.push(apiRequestInfo);
            }
            
            // Instead of continuing, try to get data from previous days
            let fallbackDate = new Date(requestDate);
            let fallbackData = null;
            let attempts = 0;
            const maxAttempts = 5; // Try up to 5 previous days
            
            while (!fallbackData && attempts < maxAttempts) {
              // Move back one day
              fallbackDate.setDate(fallbackDate.getDate() - 1);
              const fallbackFromDate = fallbackDate.toISOString().split('T')[0];
              
              // Try to get historical data from the previous day
              const fallbackUrl = `${BASE_URL}/eod/${symbol}?from=${fallbackFromDate}&to=${fallbackFromDate}&period=d&api_token=${API_KEY}&fmt=json`;
              
              try {
                console.log(`Attempting fallback request for ${symbol} on date: ${fallbackFromDate}`);
                const fallbackResponse = await fetch(fallbackUrl);
                
                if (fallbackResponse.ok) {
                  const data = await fallbackResponse.json();
                  if (Array.isArray(data) && data.length > 0) {
                    fallbackData = data;
                    console.log(`Successfully retrieved fallback data for ${symbol} from ${fallbackFromDate}`);
                    
                    // Record successful fallback API request
                    if (includeApiDetails) {
                      apiDetails.push({
                        symbol: post.symbol,
                        exchange: post.exchange || '',
                        requestType: 'Fallback historical price',
                        requestUrl: fallbackUrl,
                        responseType: 'Success',
                        dataPoints: data.length,
                        timestamp: new Date().toISOString()
                      });
                    }
                  }
                }
              } catch (fallbackError) {
                console.error(`Error in fallback request for ${symbol}:`, fallbackError);
              }
              
              attempts++;
            }
            
            if (fallbackData) {
              historicalData = fallbackData;
            } else {
              // If still no data, try using generateEodLastCloseUrl
              console.warn(`No historical data found for stock ${symbol}, trying to get last close price`);
              
              // Update API request info for fallback request
              apiRequestInfo.responseType = 'No historical data';
              
              try {
                // Import the generateEodLastCloseUrl function and ExchangeData
                const { generateEodLastCloseUrl } = require('@/utils/stockApi');
                const { getExchangeForCountry } = require('@/models/ExchangeData');
                
                // Get the exchange from the post or determine it from the country
                const exchange = post.exchange || (post.country ? getExchangeForCountry(post.country) : '');
                
                // Create the symbol with exchange if available
                const symbolWithExchange = exchange ? `${post.symbol}.${exchange}` : post.symbol;
                
                // Generate URL for last close price
                const lastCloseUrl = generateEodLastCloseUrl(symbolWithExchange, post.country);
                console.log(`Trying to get last close price from: ${lastCloseUrl}`);
                
                // Update API tracking for fallback request
                const fallbackRequestInfo = {
                  symbol: post.symbol,
                  exchange: exchange || '',
                  requestType: 'Last close price fallback',
                  requestUrl: lastCloseUrl,
                  timestamp: new Date().toISOString()
                };
                
                // Fetch the last close price
                const lastCloseResponse = await fetch(lastCloseUrl);
                
                if (!lastCloseResponse.ok) {
                  throw new Error(`API error: ${lastCloseResponse.statusText}`);
                }
                
                const lastCloseData = await lastCloseResponse.json();
                
                if (lastCloseData && lastCloseData.close) {
                  // Update fallback request info with success
                  fallbackRequestInfo.responseType = 'Last price only';
                  if (includeApiDetails) {
                    apiDetails.push(fallbackRequestInfo);
                  }
                  
                  historicalData = [{
                    date: new Date().toISOString().split('T')[0],
                    close: lastCloseData.close,
                    high: lastCloseData.high || lastCloseData.close,
                    low: lastCloseData.low || lastCloseData.close,
                    open: lastCloseData.open || lastCloseData.close,
                    volume: lastCloseData.volume || 0
                  }];
                } else {
                  throw new Error('Invalid data format in fallback API response');
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
          } else {
            // Parse the response
            historicalData = await response.json();
            
            // Check if the response is valid
            if (!Array.isArray(historicalData) || historicalData.length === 0) {
              console.warn(`Empty historical data array returned for ${symbol}, trying to get last close price`);
              
              try {
                // Import the generateEodLastCloseUrl function and ExchangeData
                const { generateEodLastCloseUrl } = require('@/utils/stockApi');
                const { getExchangeForCountry } = require('@/models/ExchangeData');
                
                // Get the exchange from the post or determine it from the country
                const exchange = post.exchange || (post.country ? getExchangeForCountry(post.country) : '');
                
                // Create the symbol with exchange if available
                const symbolWithExchange = exchange ? `${post.symbol}.${exchange}` : post.symbol;
                
                // Generate URL for last close price
                const lastCloseUrl = generateEodLastCloseUrl(symbolWithExchange, post.country);
                console.log(`Trying to get last close price from: ${lastCloseUrl}`);
                
                // Fetch the last close price
                const lastCloseResponse = await fetch(lastCloseUrl);
                
                if (!lastCloseResponse.ok) {
                  throw new Error(`API error: ${lastCloseResponse.statusText}`);
                }
                
                const lastCloseData = await lastCloseResponse.json();
                
                if (lastCloseData && lastCloseData.close) {
                  historicalData = [{
                    date: new Date().toISOString().split('T')[0],
                    close: lastCloseData.close,
                    high: lastCloseData.high || lastCloseData.close,
                    low: lastCloseData.low || lastCloseData.close,
                    open: lastCloseData.open || lastCloseData.close,
                    volume: lastCloseData.volume || 0
                  }];
                } else {
                  throw new Error('Invalid data format in fallback API response');
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
        
        // Check if we have valid historical data
        if (!Array.isArray(historicalData) || historicalData.length === 0) {
          console.error(`No historical data available for ${symbol}`);
          
          // Update the post with the status flag
          const { error: updateError } = await supabase
            .from('posts')
            .update({
              postDateAfterPriceDate: false,
              postAfterMarketClose: false,
              noDataAvailable: true,
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
            message: "No price data available",
            noDataAvailable: true
          });
          
          continue;
        }

        // Get the last price date and check if it's valid for comparison with the post date
        const lastDataPoint = historicalData[historicalData.length - 1];
        const lastPriceDate = lastDataPoint ? new Date(lastDataPoint.date) : null;
        const lastPriceDateStr = lastPriceDate ? lastPriceDate.toISOString().split('T')[0] : null;
        
        // Check if the post date is valid for comparison with the last price date
        if (postCreationDate && lastPriceDate) {
          console.log(`Comparing post date (${postDateOnly}) with last price date (${lastPriceDateStr})`);
          
          // If post date is after last price date, we can't check prices
          if (postDateOnly > lastPriceDateStr) {
            console.log(`Post created after latest price data for ${symbol}, can't check prices accurately`);
            
            // Update the post with the status flag
            const { error: updateError } = await supabase
              .from('posts')
              .update({
                postDateAfterPriceDate: true,
                postAfterMarketClose: false,
                noDataAvailable: false,
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
            console.log(`Post created on the same day as last price data, checking time`);
            
            // Assume market close is at 4 PM (16:00) - this can be adjusted for different markets
            const marketCloseHour = 16;
            
            // If post was created after market close, can't check prices accurately
            if (postTimeHours >= marketCloseHour) {
              console.log(`Post created after market close on ${postDateOnly}, can't check prices accurately`);
              
              // Update the post with the status flag
              const { error: updateError } = await supabase
                .from('posts')
                .update({
                  postDateAfterPriceDate: false,
                  postAfterMarketClose: true,
                  noDataAvailable: false,
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
            } else {
              console.log(`Post created before market close on ${postDateOnly}, can check prices`);
            }
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
            noDataAvailable: false
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
