import React from 'react';
import styles from '@/styles/ProfilePostCard.module.css';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import { COUNTRY_ISO_CODES } from '@/models/CurrencyData';
import { getCountryForExchange, EXCHANGE_COUNTRIES } from '@/models/ExchangeData';
import 'flag-icons/css/flag-icons.min.css';

// Function to format date
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export const ProfilePostCard = ({ post = {} }) => {
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
              <div className={styles.statusBadge} title={`Target reached on ${formatDate(post.target_reached_date)}`}>
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
              <div className={`${styles.statusBadge} ${styles.stopLossBadge}`} title={`Stop loss triggered on ${formatDate(post.stop_loss_triggered_date)}`}>
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
            {post.created_at && (
              <div className={styles.lastCheckDate} title="Post creation date">
                {formatDate(post.created_at)}
              </div>
            )}
          </div>
        )}

        {/* Current price (latest update) */}
        {post.last_price && (
          <div className={`${styles.priceItem} ${styles.currentPriceItem}`}>
            <span className={styles.priceLabel}>Current Price:</span>
            <span className={styles.priceValue}>{post.last_price}</span>
            {post.last_price_check && (
              <div className={styles.lastCheckDate} title="Last price update">
                {formatDate(post.last_price_check)}
              </div>
            )}
            
            {/* Price change display removed as requested */}
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
          // Difference: targetPrice - currentPrice
          // Divide by target price: difference / targetPrice
          // Multiply by 100: result * 100
          let percentToTarget = Math.abs(((targetPrice - currentPrice) / targetPrice) * 100).toFixed(2);
          
          // Determine if we're moving toward or away from target
          const isMovingTowardTarget = 
            (isUpwardTarget && currentPrice > initialPrice) || 
            (!isUpwardTarget && currentPrice < initialPrice);
          
          return (
            <div className={styles.progressContainer}>
             
              {/* Simple progress bar with container and fill */}
              <div style={{
                height: '8px',
                marginTop: '8px',
                marginBottom: '5px',
                borderRadius: '4px',
                backgroundColor: '#e0e0e0',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${Math.min(Math.max(0, parseFloat(percentToTarget)), 100)}%`,
                  backgroundColor: isMovingTowardTarget ? '#4caf50' : '#f44336'
                }}></div>
              </div>
              
              {/* Progress display with percentage */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.7rem',
                color: '#666',
                marginTop: '4px',
              }}>
                <span>0%</span>
                <span style={{
                  color: isMovingTowardTarget ? '#4caf50' : '#f44336',
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}>
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
              ? `on ${formatDate(post.target_reached_date)}`
              : `on ${formatDate(post.stop_loss_triggered_date)}`
            }
          </span>
        </div>
      )}
      
      {/* Price check status for open posts */}
      {!post.closed && post.last_price_check && (
        <div className={styles.priceCheckStatus}>
          <span className={styles.priceCheckIcon}>📈</span>
          <span className={styles.priceCheckText}>Last price update: {formatDate(post.last_price_check)}</span>
        </div>
      )}
      
      {/* Description/content hidden as requested */}
      
      <div className={styles.postMeta}>
        <div className={styles.metaRow}>
          {post.created_at && (
            <span className={styles.postDate}>
              {new Date(post.created_at).toLocaleDateString(undefined, { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
          )}
          
          {post.strategy && (
            <span className={styles.strategy}>
              Strategy: {post.strategy}
            </span>
          )}
        </div>
        
        <div className={styles.postActions}>
          <button className={styles.viewButton}>
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePostCard;
