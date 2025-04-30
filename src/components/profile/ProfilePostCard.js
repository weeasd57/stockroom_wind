import React from 'react';
import styles from '@/styles/ProfilePostCard.module.css';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import { COUNTRY_ISO_CODES } from '@/models/CurrencyData';
import { getCountryForExchange, EXCHANGE_COUNTRIES } from '@/models/ExchangeData';
import 'flag-icons/css/flag-icons.min.css';
import { useRouter } from 'next/navigation';

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
    hour12: true,
    timeZone: 'UTC' // Use UTC timezone to match API date format
  });
}

export const ProfilePostCard = ({ post = {} }) => {
  const router = useRouter();
  // Add default empty object to prevent errors if post is undefined
  
  // Check for stock_symbol in different possible locations based on API response structure
  const stockSymbol = post?.symbol || '';
  
  // Extract country code directly in component body
  let countryCode = null;
  
  // Try to get country from stock symbol (format: SYMBOL.COUNTRY)
  if (stockSymbol) {
    try {
      const parts = stockSymbol.split('.');
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
  if (!countryCode && post?.country) {
    const country = post.country;
    if (country.length === 2) {
      countryCode = country.toLowerCase();
    } else if (COUNTRY_ISO_CODES[country]) {
      countryCode = COUNTRY_ISO_CODES[country];
    }
  }
  
  // If still no country code, check if we can determine it from exchange
  if (!countryCode && post?.exchange) {
    // Get country name from exchange using the ExchangeData model
    const countryName = getCountryForExchange(post.exchange);
    
    if (countryName) {
      // Convert country name to country code
      // Find the matching country code from COUNTRY_CODE_TO_NAME
      Object.entries(COUNTRY_CODE_TO_NAME).forEach(([code, name]) => {
        if (name.toLowerCase() === countryName.toLowerCase()) {
          countryCode = code;
        }
      });
    }
  }
  
  // If we still don't have a country code, set a default
  if (!countryCode) {
    // Default to US for stocks without country info
    countryCode = 'us';
  }
  
  return (
    <div className={styles.postCard}>
      {countryCode && (
        <div className={styles.flagBackground}>
          <span className={`fi fi-${countryCode}`}></span>
        </div>
      )}
      <div className={styles.postHeader}>
        {/* Top row with symbol and flag */}
        <div className={styles.headerRow}>
          <div className={styles.symbolContainer}>
            <span className={styles.stockSymbol}>
              {post.title ? post.title.split(' ')[0] : (stockSymbol ? stockSymbol : 'N/A')}
            </span>
          </div>
          
          {countryCode && COUNTRY_CODE_TO_NAME[countryCode] && (
            <div className={styles.stockFlag}>
              <span 
                className={`fi fi-${countryCode}`} 
                title={COUNTRY_CODE_TO_NAME[countryCode]}
              ></span>
            </div>
          )}
        </div>
        
        {/* Description row */}
        <div className={styles.descriptionRow}>
          <h3 className={styles.postTitle}>
            {post.title || (post.content && post.content.substring(0, 40) + '...') || 'Stock Analysis'}
          </h3>
        </div>
      </div>
      
      <div className={styles.priceContainer}>
        {post.target_price && (
          <div className={`${styles.priceItem} ${post.target_reached ? styles.targetReached : ''}`}>
            <span className={styles.priceLabel}>Target:</span>
            <span className={styles.priceValue}>{post.target_price}</span>
            {post.target_reached && (
              <div 
                className={styles.statusBadge} 
                title={`Target reached on ${formatDate(post.target_reached_date)} (UTC)`}
              >
                ✓
              </div>
            )}
          </div>
        )}
        
        {post.stop_loss_price && (
          <div className={`${styles.priceItem} ${post.stop_loss_triggered ? styles.stopLossTriggered : ''}`}>
            <span className={styles.priceLabel}>Stop Loss:</span>
            <span className={styles.priceValue}>{post.stop_loss_price}</span>
            {post.stop_loss_triggered && (
              <div className={`${styles.statusBadge} ${styles.stopLossBadge}`} title={`Stop loss triggered on ${formatDate(post.stop_loss_triggered_date)} (UTC)`}>
                ⚠
              </div>
            )}
          </div>
        )}

        {/* Initial price (when post was created) */}
        {post.current_price && (
          <div className={`${styles.priceItem} ${styles.initialPriceItem}`}>
            <span className={styles.priceLabel}>Initial Price:</span>
            <span className={styles.priceValue}>{post.current_price}</span>
          </div>
        )}

        {/* High price display - Show the highest price if available */}
        {(post.high_price || post.target_high_price) && (
          <div className={`${styles.priceItem} ${styles.highPriceItem}`}>
            <span className={styles.priceLabel}>High Price:</span>
            <span className={styles.priceValue}>{post.high_price || post.target_high_price}</span>
            {post.target_reached && post.target_hit_time && (
              <div className={styles.lastCheckDate} title="Time when target was hit">
                Hit at {post.target_hit_time}
              </div>
            )}
          </div>
        )}
        
        {/* Text-based progress indicator with percentage difference */}
        {!post.closed && post.last_price && post.target_price && !post.target_reached && (() => {
          // Parse values as numbers to ensure correct calculation
          const initialPrice = parseFloat(post.current_price);
          const currentPrice = parseFloat(post.last_price);
          const targetPrice = parseFloat(post.target_price);
          const isUpwardTarget = targetPrice > initialPrice;
          
          // Calculate percentage to target using formula:
          // For upward targets: ((Target Price - Current Price) / Current Price) × 100%
          // For downward targets: ((Current Price - Target Price) / Current Price) × 100%
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
          
          return (
            <div className={styles.progressContainer}>
             
              {/* Simple progress bar with container and fill */}
              <div className={styles.progressBarOuter}>
                <div 
                  className={`${styles.progressBarInner} ${isMovingTowardTarget ? styles.progressBarInnerPositive : styles.progressBarInnerNegative}`}
                  style={{ width: `${Math.min(Math.max(0, parseFloat(percentToTarget)), 100)}%` }}
                ></div>
              </div>
              
              {/* Progress display with percentage */}
              <div className={styles.progressTextContainer}>
                <span>0%</span>
                <span className={`${styles.progressPercentText} ${isMovingTowardTarget ? styles.progressPercentTextPositive : styles.progressPercentTextNegative}`}>
                  {Math.max(1, Math.round(parseFloat(percentToTarget)))}% to target
                </span>
                <span>100%</span>
              </div>
            </div>
          );
        })()}
      </div>
      
      {/* Status indicator for closed posts */}
      {post.closed && (
        <div className={`${styles.postStatus} ${post.target_reached ? styles.successStatus : styles.dangerStatus}`}>
          {post.target_reached ? 'Target Reached' : 'Stop Loss Triggered'}
          <span className={styles.statusDate}>
            {post.target_reached 
              ? `on ${formatDate(post.target_reached_date)} (UTC)`
              : `on ${formatDate(post.stop_loss_triggered_date)} (UTC)`
            }
          </span>
        </div>
      )}
      
      {/* Price check status for open posts */}
      {!post.closed && post.last_price_check && (
        <div className={styles.priceCheckStatus}>
          <span className={styles.priceCheckIcon}>📈</span>
          <span className={styles.priceCheckText}>Last price update: {formatDate(post.last_price_check)} (UTC)</span>
        </div>
      )}
      
      {/* Display message when post was created after latest price data */}
      {post.postDateAfterPriceDate && (
        <div className={`${styles.priceCheckStatus} ${styles.warningStatus}`}>
          <span className={styles.priceCheckIcon}>⚠️</span>
          <span className={styles.priceCheckText}>Post created after latest price data - can't check target/stop loss</span>
        </div>
      )}
      
      {/* Display message when post was created after market close on the same day */}
      {post.postAfterMarketClose && (
        <div className={`${styles.priceCheckStatus} ${styles.warningStatus}`}>
          <span className={styles.priceCheckIcon}>⚠️</span>
          <span className={styles.priceCheckText}>Post created after market close - recent price data not available</span>
        </div>
      )}
      
      {/* Display message when no price data is available */}
      {post.noDataAvailable && (
        <div className={`${styles.priceCheckStatus} ${styles.errorStatus}`}>
          <span className={styles.priceCheckIcon}>❌</span>
          <span className={styles.priceCheckText}>No price data available for this stock</span>
        </div>
      )}
      
      {/* Description/content hidden as requested */}
      
      <div className={styles.postMeta}>
        <div className={styles.metaRow}>
          {post.created_at && (
            <span className={styles.postDate}>
              {new Date(post.created_at).toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'UTC' // Use UTC timezone to match API date format
              })} (UTC)
            </span>
          )}
          
          {post.exchange && (
            <span className={styles.postExchange}>
              {post.exchange}
            </span>
          )}
          
          {post.strategy && (
            <span className={styles.postStrategy}>
              {post.strategy}
            </span>
          )}
        </div>
        
        <button 
          className={styles.showDetailsButton}
          onClick={() => router.push(`/posts/${post.id}`)}
        >
          Show Details
        </button>
      </div>
    </div>
  );
};

export default ProfilePostCard;
