'use client';

import { useState, useEffect } from 'react';
import styles from '@/styles/PriceUpdateIndicator.module.css';

export default function PriceUpdateIndicator({ isUpdating, lastUpdate, currentPrice, previousPrice }) {
  const [showIndicator, setShowIndicator] = useState(false);
  const [priceChange, setPriceChange] = useState(null);

  useEffect(() => {
    if (isUpdating) {
      setShowIndicator(true);
    } else if (lastUpdate) {
      // Keep indicator visible permanently after update
      setShowIndicator(true);
      // Removed auto-hide timer - indicator stays visible
    }
  }, [isUpdating, lastUpdate]);

  useEffect(() => {
    if (currentPrice && previousPrice && currentPrice !== previousPrice) {
      const change = ((currentPrice - previousPrice) / previousPrice) * 100;
      setPriceChange(change);
    }
  }, [currentPrice, previousPrice]);

  if (!showIndicator) return null;

  const getChangeIcon = () => {
    if (priceChange === null) return '📈';
    if (priceChange > 0) return '📈';
    if (priceChange < 0) return '📉';
    return '➖';
  };

  const getChangeClass = () => {
    if (priceChange === null) return '';
    if (priceChange > 0) return styles.positive;
    if (priceChange < 0) return styles.negative;
    return styles.neutral;
  };

  return (
    <div className={`${styles.indicator} ${isUpdating ? styles.updating : styles.updated} ${getChangeClass()}`}>
      <span className={styles.icon}>{getChangeIcon()}</span>
      <span className={styles.text}>
        {isUpdating ? 'Updating prices...' : 
         priceChange !== null ? `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%` : 'Updated'}
      </span>
      {!isUpdating && (
        <span className={styles.timestamp}>
          {new Date(lastUpdate).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}