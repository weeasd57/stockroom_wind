import React from 'react';
import styles from '@/styles/ProfilePostCard.module.css';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import { COUNTRY_ISO_CODES } from '@/models/CurrencyData';
import 'flag-icons/css/flag-icons.min.css';

export const ProfilePostCard = ({ post }) => {
  // Get country code from stock symbol if available (format: SYMBOL.COUNTRY)
  const getCountryCode = () => {
    if (!post.stock_symbol) {
      return null;
    }
    const parts = post.stock_symbol.split('.');
    const extractedCountry = parts.length > 1 ? parts[1].toLowerCase() : null;
    return extractedCountry;
  };



  // Function to convert full country name to ISO code
  const getCountryIsoCode = (countryName) => {
    if (!countryName) return null;
    
    // If it's already a 2-letter code, return it lowercase
    if (countryName.length === 2) {
      return countryName.toLowerCase();
    }
    
    // Check if the country name exists in COUNTRY_ISO_CODES
    if (COUNTRY_ISO_CODES[countryName]) {
      return COUNTRY_ISO_CODES[countryName];
    }
    
    return null;
  };
  
  // Get the country code, either directly or by converting from name
  const rawCountryCode = post.country || getCountryCode();
  const countryCode = getCountryIsoCode(rawCountryCode);
  

  
  return (
    <div className={styles.postCard}>
      {countryCode && (
        <div className={styles.flagBackground}>
          <span className={`fi fi-${countryCode}`}></span>
        </div>
      )}
      <div className={styles.postHeader}>
        <div className={styles.headerRow}>
          {post.stock_symbol && (
            <div className={styles.symbolContainer}>
              <span className={styles.stockSymbol}>{post.stock_symbol}</span>
            </div>
          )}
          
          {countryCode && COUNTRY_CODE_TO_NAME[countryCode] && (
            <div className={styles.stockFlag}>
              <span 
                className={`fi fi-${countryCode}`} 
                title={COUNTRY_CODE_TO_NAME[countryCode]}
              ></span>
            </div>
          )}
          
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
      
      <p className={styles.postContent}>
        {post.content || 'No content provided'}
      </p>
      
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
