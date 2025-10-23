"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPostById } from '@/utils/supabase';
import styles from '@/styles/PostDetails.module.css';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import { COUNTRY_ISO_CODES } from '@/models/CurrencyData';
import { getCountryForExchange } from '@/models/ExchangeData';
import 'flag-icons/css/flag-icons.min.css';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import { CommentProvider } from '@/providers/CommentProvider';
import PostActions from '@/components/posts/PostActions';
import PostSentiment from '@/components/posts/PostSentiment';
import Comments from '@/components/posts/Comments';

// Function to format date
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  // For display purposes, use a standardized format that matches API requests
  // This ensures date display is consistent with the date used in API calls
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC' // Use UTC timezone to match API date format
  });
}

export default function PostDetailsPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { user } = useSupabase();
  const { profile } = useProfile();
  
  // Get country code for flag display
  const getCountryCode = (post) => {
    if (!post) return 'us'; // Default
    
    let countryCode = null;
    
    // Try to get country from stock symbol (format: SYMBOL.COUNTRY)
    if (post.symbol) {
      try {
        const parts = post.symbol.split('.');
        if (parts.length > 1) {
          const extractedCountry = parts[1].toLowerCase();
          // If it's a 2-letter code, use it directly
          if (extractedCountry.length === 2) {
            countryCode = extractedCountry;
          }
          // Otherwise check if it exists in COUNTRY_ISO_CODES
          else if (COUNTRY_ISO_CODES[extractedCountry]) {
            countryCode = COUNTRY_ISO_CODES[extractedCountry];
          }
        }
      } catch (error) {
        console.error('Error processing stock symbol:', error);
      }
    }
    
    // If no country code from symbol, try post.country
    if (!countryCode && post.country) {
      const country = post.country;
      if (country.length === 2) {
        countryCode = country.toLowerCase();
      } else if (COUNTRY_ISO_CODES[country]) {
        countryCode = COUNTRY_ISO_CODES[country];
      }
    }
    
    // If still no country code, check if we can determine it from exchange
    if (!countryCode && post.exchange) {
      // Get country name from exchange
      const countryName = getCountryForExchange(post.exchange);
      
      if (countryName) {
        // Convert country name to country code
        Object.entries(COUNTRY_CODE_TO_NAME).forEach(([code, name]) => {
          if (name.toLowerCase() === countryName.toLowerCase()) {
            countryCode = code;
          }
        });
      }
    }
    
    // If we still don't have a country code, set a default
    if (!countryCode) {
      countryCode = 'us'; // Default to US
    }
    
    return countryCode;
  };
  
  // Calculate price change percentage
  const calculatePriceChange = (initialPrice, currentPrice) => {
    if (!initialPrice || !currentPrice) return { percentage: 0, isPositive: false };
    
    const initial = parseFloat(initialPrice);
    const current = parseFloat(currentPrice);
    
    if (isNaN(initial) || isNaN(current) || initial === 0) return { percentage: 0, isPositive: false };
    
    const change = ((current - initial) / initial) * 100;
    return {
      percentage: Math.abs(change).toFixed(2),
      isPositive: change >= 0
    };
  };
  
  // Calculate progress to target
  const calculateProgress = (post) => {
    if (!post || !post.target_price) {
      return { percentage: 0, isMovingTowardTarget: false };
    }
    
    const initialPrice = parseFloat(post.initial_price || post.current_price);
    const currentPrice = parseFloat(post.last_price);
    const targetPrice = parseFloat(post.target_price);
    
    if (isNaN(initialPrice) || isNaN(currentPrice) || isNaN(targetPrice)) {
      return { percentage: 0, isMovingTowardTarget: false };
    }
    
    const isUpwardTarget = targetPrice > initialPrice;
    
    // Calculate percentage to target
    let percentToTarget;
    if (targetPrice !== currentPrice) {
      if (isUpwardTarget) {
        percentToTarget = ((targetPrice - currentPrice) / currentPrice * 100).toFixed(2);
      } else {
        percentToTarget = ((currentPrice - targetPrice) / currentPrice * 100).toFixed(2);
      }
    } else {
      percentToTarget = '0.00';
    }
    
    // Determine if we're moving toward or away from target
    const isMovingTowardTarget = 
      (isUpwardTarget && currentPrice > initialPrice) || 
      (!isUpwardTarget && currentPrice < initialPrice);
    
    return {
      percentage: percentToTarget,
      isMovingTowardTarget
    };
  };
  
 
  
  // Function to format price check history
  const formatPriceHistory = (priceChecks) => {
    console.log('Formatting price history:', priceChecks);
    
    if (!priceChecks) return [];
    
    // Handle string format if the JSONB was returned as a string
    let parsedChecks = priceChecks;
    if (typeof priceChecks === 'string') {
      try {
        parsedChecks = JSON.parse(priceChecks);
      } catch (e) {
        console.error('Error parsing price_checks:', e);
        return [];
      }
    }
    
    if (!Array.isArray(parsedChecks) || parsedChecks.length === 0) {
      return [];
    }
    
    // Check if we have the new format (with OHLC data)
    const isNewFormat = parsedChecks[0] && ('close' in parsedChecks[0]);
    
    // If we have the new format, convert to a more readable display format
    if (isNewFormat) {
      return parsedChecks.map(check => ({
        price: check.close,
        date: check.date,
        open: check.open,
        high: check.high,
        low: check.low,
        volume: check.volume
      }));
    }
    
    // Sort by date descending (newest first)
    return [...parsedChecks].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  };
  
  useEffect(() => {
    // Wait until we have a valid id, then guard against double-fetch
    if (!id) return;

    async function fetchPost() {
      try {
        setLoading(true);
        const { data, error } = await getPostById(id);
        
        if (error) {
          throw error;
        }
        
        if (data) {
          // Process the price_checks field to ensure it's properly parsed
          if (data.price_checks) {
            if (typeof data.price_checks === 'string') {
              try {
                data.price_checks = JSON.parse(data.price_checks);
              } catch (e) {
                console.error('Error parsing price_checks in fetchPost:', e);
                data.price_checks = [];
              }
            }
          } else {
            data.price_checks = [];
          }
          
          console.log('Fetched post data:', data);
          setPost(data);
        } else {
          setError('Post not found');
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError(err.message || 'Failed to load post');
      } finally {
        setLoading(false);
      }
    }
    
    // id is guaranteed truthy here
    fetchPost();
  }, [id]);
  
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading post details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  if (!post) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2>Post Not Found</h2>
          <p>The post you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }
  
  // Process price_checks before using it
  if (post.price_checks && typeof post.price_checks === 'string') {
    try {
      post.price_checks = JSON.parse(post.price_checks);
    } catch (e) {
      console.error('Error parsing price_checks in render:', e);
      post.price_checks = [];
    }
  }
  
  const countryCode = getCountryCode(post);
  const priceChange = calculatePriceChange(post.initial_price || post.current_price, post.last_price);
  const progress = calculateProgress(post);
  const priceHistory = formatPriceHistory(post.price_checks);
  
  console.log('Price history:', priceHistory);
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Stock Analysis</h1>
      </div>
      
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.symbolContainer}>
            <span className={styles.stockSymbol}>
              {post.symbol || 'N/A'}
            </span>
          </div>
          
          {countryCode && (
            <div className={styles.flagContainer}>
              <span 
                className={`fi fi-${countryCode}`} 
                title={COUNTRY_CODE_TO_NAME[countryCode]}
              ></span>
              <span className={styles.countryName}>
                {COUNTRY_CODE_TO_NAME[countryCode] || 'Unknown'}
              </span>
            </div>
          )}
        </div>
        
        <h2 className={styles.companyName}>
          {post.company_name || 'Stock Analysis'}
        </h2>
        
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Price Information</h3>
          <div className={styles.priceGrid}>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Initial Price:</span>
              <span className={styles.priceValue}>{post.initial_price || post.current_price || 'N/A'}</span>
            </div>
            
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Current Price:</span>
              <span className={styles.priceValue}>
                {(() => {
                  // أولوية للسعر الأخير إذا كان متاحاً ومحدثاً
                  if (post.last_price && post.last_price_check) {
                    return post.last_price;
                  }
                  // ثم السعر الحالي إذا كان متاحاً
                  if (post.current_price) {
                    return post.current_price;
                  }
                  // وأخيراً السعر الابتدائي
                  if (post.initial_price) {
                    return post.initial_price;
                  }
                  // إذا لم يكن هناك أي سعر
                  return 'N/A';
                })()}
              </span>
              {(post.last_price_check || post.created_at) && (
                <span className={styles.priceDate}>
                  {formatDate(post.last_price_check || post.created_at)} (UTC)
                  {!post.last_price_check && ' (Initial)'}
                </span>
              )}
            </div>
            
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Target Price:</span>
              <span className={`${styles.priceValue} ${post.target_reached ? styles.targetReached : ''}`}>
                {post.target_price || 'N/A'}
                {post.target_reached && (
                  <span className={styles.statusBadge} title={`Target reached on ${formatDate(post.target_reached_date)}`}>
                    ✓
                  </span>
                )}
              </span>
            </div>
            
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Stop Loss:</span>
              <span className={`${styles.priceValue} ${post.stop_loss_triggered ? styles.stopLossTriggered : ''}`}>
                {post.stop_loss_price || 'N/A'}
                {post.stop_loss_triggered && (
                  <span className={styles.statusBadge} title={`Stop loss triggered on ${formatDate(post.stop_loss_triggered_date)}`}>
                    ⚠
                  </span>
                )}
              </span>
            </div>
          </div>
          
       
          
          {/* Display price status */}
          {post.closed && (
            <div className={`${styles.statusContainer} ${post.target_reached ? styles.success : post.stop_loss_triggered ? styles.failure : styles.neutral}`}>
              <span className={styles.statusIcon}>
                {post.target_reached ? '✓' : post.stop_loss_triggered ? '⚠' : '•'}
              </span>
              <span className={styles.statusText}>
                {post.target_reached 
                  ? `Target price reached on ${formatDate(post.target_reached_date)}`
                  : post.stop_loss_triggered
                    ? `Stop loss triggered on ${formatDate(post.stop_loss_triggered_date)}`
                    : `Closed on ${formatDate(post.closed_date)}`
                }
              </span>
            </div>
          )}
          
          {post.last_price && (post.initial_price || post.current_price) && (
            <div className={styles.priceChangeContainer}>
              <span className={styles.priceChangeLabel}>Price Change:</span>
              <span className={`${styles.priceChangeValue} ${priceChange.isPositive ? styles.positive : styles.negative}`}>
                {priceChange.isPositive ? '+' : '-'}{priceChange.percentage}%
              </span>
            </div>
          )}
          
          {!post.closed && post.last_price && post.target_price && !post.target_reached && (
            <div className={styles.progressContainer}>
              <div className={styles.progressHeader}>
                <span className={styles.progressLabel}>Progress to Target:</span>
                <span className={`${styles.progressPercentage} ${progress.isMovingTowardTarget ? styles.positive : styles.negative}`}>
                  {progress.percentage}%
                </span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={`${styles.progressFill} ${progress.isMovingTowardTarget ? styles.positive : styles.negative}`}
                  style={{ width: `${Math.min(100, Math.max(0, parseFloat(progress.percentage)))}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {/* Price history chart */}
          {priceHistory.length >= 2 && (
            <PriceHistoryChart 
              priceChecks={post.price_checks}
              targetPrice={post.target_price}
              stopLossPrice={post.stop_loss_price}
              initialPrice={post.initial_price || post.current_price}
            />
          )}
          
          {/* Price history list */}
          {priceHistory.length > 0 && (
            <div className={styles.priceHistoryContainer}>
              <div className={styles.priceHistoryHeader}>
                <h4 className={styles.priceHistoryTitle}>Price History Data</h4>
                
                <div className={styles.priceHistoryActions}>
                  <button 
                    className={styles.toggleHistoryButton}
                    onClick={() => setShowAllHistory(!showAllHistory)}
                  >
                    {showAllHistory ? 'Show Recent (5)' : `Show All (${priceHistory.length})`}
                  </button>
                </div>
              </div>
              
              <div className={styles.priceHistoryList}>
                {(showAllHistory ? priceHistory : priceHistory.slice(0, 5)).map((check, index) => (
                  <div key={index} className={styles.priceHistoryItem}>
                    {check.open ? (
                      <>
                        <div className={styles.priceHistoryDate}>
                          <strong>{formatDate(check.date)}</strong>
                        </div>
                        <div className={styles.priceHistoryOHLC}>
                          <span className={styles.priceHistoryValue}>Close: {check.price}</span>
                          <span className={styles.priceHistoryValue}>Open: {check.open}</span>
                          <span className={styles.priceHistoryValue}>High: {check.high}</span>
                          <span className={styles.priceHistoryValue}>Low: {check.low}</span>
                          <span className={styles.priceHistoryValue}>Vol: {check.volume ? check.volume.toLocaleString() : 'N/A'}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className={styles.priceHistoryValue}>{check.price}</span>
                        <span className={styles.priceHistoryDate}>{formatDate(check.date)}</span>
                      </>
                    )}
                  </div>
                ))}
                
                {!showAllHistory && priceHistory.length > 5 && (
                  <div className={styles.priceHistoryMore}>
                    + {priceHistory.length - 5} more entries available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {post.strategy && (
          <div className={styles.strategySection}>
            <div className={styles.strategyBadge}>
              <span className={styles.strategyIcon}>📊</span>
              <span className={styles.strategyName}>{post.strategy}</span>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Analysis Details</h3>
          
          {post.description && (
            <div className={styles.descriptionContainer}>
              <h4 className={styles.descriptionTitle}>Description</h4>
              <p className={styles.description}>{post.description}</p>
            </div>
          )}
          
          <div className={styles.detailsGrid}>
            {post.exchange && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Exchange:</span>
                <span className={styles.detailValue}>{post.exchange}</span>
              </div>
            )}
            
            {post.created_at && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Posted:</span>
                <span className={styles.detailValue}>{formatDate(post.created_at)} (UTC)</span>
              </div>
            )}
            
            {post.updated_at && post.updated_at !== post.created_at && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Last Updated:</span>
                <span className={styles.detailValue}>{formatDate(post.updated_at)} (UTC)</span>
              </div>
            )}
          </div>
        </div>
        
        {post.image_url && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Chart Image</h3>
            <div className={styles.imageContainer}>
              <img 
                src={post.image_url} 
                alt={`Chart for ${post.symbol || 'stock'}`} 
                className={styles.chartImage}
                onClick={() => window.open(post.image_url, '_blank')}
              />
              <div className={styles.imageOverlay}>
                <span className={styles.imageZoomHint}>Click to enlarge</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Community Interactions: Buy/Sell, Sentiment, and Comments */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Community</h3>
          <CommentProvider>
            <PostActions 
              postId={post.id}
              initialBuyCount={post.buy_count || 0}
              initialSellCount={post.sell_count || 0}
              autoSubscribe={true}
            />
            <PostSentiment 
              postId={post.id}
              buyCount={post.buy_count || 0}
              sellCount={post.sell_count || 0}
            />
            <Comments 
              postId={post.id}
              initialCommentCount={post.comment_count || 0}
              autoFetchOnMount={true}
            />
          </CommentProvider>
        </div>
        
        <div className={styles.footer}>
        </div>
      </div>
    </div>
  );
}