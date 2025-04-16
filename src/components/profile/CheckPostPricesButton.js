'use client';

import { useState } from 'react';
import styles from '@/styles/profile.module.css';
import { useProfile } from '@/providers/ProfileProvider';



export default function CheckPostPricesButton({ userId }) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkStats, setCheckStats] = useState(null);
  const [error, setError] = useState(null);
  const { refreshData } = useProfile();
  
  const checkPostPrices = async () => {
    setIsChecking(true);
    setCheckStats(null);
    setError(null);
    
    try {
      const response = await fetch('/api/posts/check-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId }), 
        credentials: 'include' 
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'An error occurred while checking prices');
      }
      
      
      setCheckStats({
        usageCount: data.usageCount,
        remainingChecks: data.remainingChecks,
        checkedPosts: data.checkedPosts,
        updatedPosts: data.updatedPosts,
        closedPostsSkipped: data.closedPostsSkipped
      });
      
      
      
      if (userId) {
        refreshData(userId);
      }
      
      
      setTimeout(() => {
        setCheckStats(null);
      }, 5000); 
      
    } catch (err) {
      setError(err.message || 'An error occurred while checking prices');
    } finally {
      setIsChecking(false);
    }
  };
  
  return (
    <div className={styles.priceCheckContainer}>
      <button 
        onClick={checkPostPrices}
        disabled={isChecking}
        className={styles.checkPricesButton}
        aria-label="Check post prices"
      >
        {isChecking ? 'Checking...' : '📈 Check Post Prices'}
      </button>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      {checkStats && (
        <div className={styles.checkStatsContainer}>
          <div className={styles.usageInfo}>
            <p>
              Checks today: <strong>{checkStats.usageCount}</strong> of <strong>100</strong>
              <br />
              Checked <strong>{checkStats.checkedPosts}</strong> posts
              {checkStats.updatedPosts > 0 && (
                <> | Updated <strong>{checkStats.updatedPosts}</strong> posts</>  
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
