'use client';

import { useMemo } from 'react';
import { useComments } from '@/providers/CommentProvider';
import styles from '../../styles/PostSentiment.module.css';

export default function PostSentiment({ postId, buyCount = 0, sellCount = 0 }) {
  const { getPostStats } = useComments();
  const stats = postId ? getPostStats(postId) : null;
  const effectiveBuy = stats?.buyCount ?? buyCount;
  const effectiveSell = stats?.sellCount ?? sellCount;

  const { buyPercentage, sellPercentage, sentiment, totalVotes } = useMemo(() => {
    const total = effectiveBuy + effectiveSell;
    
    if (total === 0) {
      return {
        buyPercentage: 50,
        sellPercentage: 50,
        sentiment: 'neutral',
        totalVotes: 0
      };
    }
    
    const buyPct = Math.round((effectiveBuy / total) * 100);
    const sellPct = 100 - buyPct;
    
    let sentimentType = 'neutral';
    if (buyPct > 60) sentimentType = 'bullish';
    else if (sellPct > 60) sentimentType = 'bearish';
    
    return {
      buyPercentage: buyPct,
      sellPercentage: sellPct,
      sentiment: sentimentType,
      totalVotes: total
    };
  }, [effectiveBuy, effectiveSell]);

  const getSentimentIcon = () => {
    switch (sentiment) {
      case 'bullish': return '📈';
      case 'bearish': return '📉';
      default: return '⚖️';
    }
  };

  const getSentimentText = () => {
    switch (sentiment) {
      case 'bullish': return 'Bullish Sentiment';
      case 'bearish': return 'Bearish Sentiment';
      default: return 'Neutral Sentiment';
    }
  };

  const getSentimentColor = () => {
    switch (sentiment) {
      case 'bullish': return '#10b981';
      case 'bearish': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (totalVotes === 0) {
    return (
      <div className={styles.sentimentContainer}>
        <div className={styles.sentimentHeader}>
          <span className={styles.sentimentIcon}>⚖️</span>
          <span className={styles.sentimentText}>No votes yet</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressFill}
              style={{ 
                width: '50%',
                background: '#e5e7eb'
              }}
            />
          </div>
        </div>
        <div className={styles.percentageLabels}>
          <span className={styles.buyLabel}>Buy 0%</span>
          <span className={styles.sellLabel}>Sell 0%</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sentimentContainer}>
      <div className={styles.sentimentHeader}>
        <span className={styles.sentimentIcon}>{getSentimentIcon()}</span>
        <span 
          className={styles.sentimentText}
          style={{ color: getSentimentColor() }}
        >
          {getSentimentText()}
        </span>
        <span className={styles.totalVotes}>({totalVotes} votes)</span>
      </div>
      
      <div className={styles.progressBar}>
        <div className={styles.progressTrack}>
          <div 
            className={`${styles.progressFill} ${styles.buyFill}`}
            style={{ 
              width: `${buyPercentage}%`,
              background: `linear-gradient(90deg, #10b981 0%, #059669 100%)`
            }}
          />
          <div 
            className={`${styles.progressFill} ${styles.sellFill}`}
            style={{ 
              width: `${sellPercentage}%`,
              background: `linear-gradient(90deg, #ef4444 0%, #dc2626 100%)`,
              marginLeft: `${buyPercentage}%`
            }}
          />
        </div>
      </div>
      
      <div className={styles.percentageLabels}>
        <span className={styles.buyLabel}>
          📈 Buy {buyPercentage}%
        </span>
        <span className={styles.sellLabel}>
          📉 Sell {sellPercentage}%
        </span>
      </div>
    </div>
  );
}