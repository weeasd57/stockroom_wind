import React from 'react';
import styles from '@/styles/ProfilePostCard.module.css';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import { COUNTRY_ISO_CODES } from '@/models/CurrencyData';
import 'flag-icons/css/flag-icons.min.css';

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
          
          <div className={styles.priceItem}>
            <span className={styles.priceLabel}>Target:</span>
            <span className={styles.priceValue}>{post.target_price}</span>
          </div>
        )}
        
        {post.stop_loss_price && (
          <div className={styles.priceItem}>
            <span className={styles.priceLabel}>Stop Loss:</span>
            <span className={styles.priceValue}>{post.stop_loss_price}</span>
          </div>
        )}
      </div>
      
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
