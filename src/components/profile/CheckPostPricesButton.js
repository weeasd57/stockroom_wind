'use client';

import { useState } from 'react';
import styles from '@/styles/profile.module.css';
import { useProfile } from '@/providers/ProfileProvider';
import dialogStyles from '@/styles/ProfilePostCard.module.css';



export default function CheckPostPricesButton({ userId }) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkStats, setCheckStats] = useState(null);
  const [error, setError] = useState(null);
  const { refreshData } = useProfile();
  const [abortController, setAbortController] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  
  const cancelCheck = () => {
    if (abortController) {
      // Mark as cancelled before aborting to prevent processing response
      setIsCancelled(true);
      abortController.abort();
      setIsChecking(false);
      setError('Price check cancelled');
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };
  
  const checkPostPrices = async () => {
    setIsChecking(true);
    setCheckStats(null);
    setError(null);
    setIsCancelled(false);
    
    // Create a new AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      const response = await fetch('/api/posts/check-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId }), 
        credentials: 'include',
        signal: controller.signal // Add the abort signal to the fetch request
      });
      
      // Check if cancelled before processing response
      if (isCancelled) {
        console.log('Request was cancelled, ignoring response');
        return;
      }
      
      const data = await response.json();
      
      // Check again if cancelled after parsing JSON
      if (isCancelled) {
        console.log('Request was cancelled while parsing response, ignoring data');
        return;
      }
      
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
      
      if (userId && !isCancelled) {
        refreshData(userId);
      }
      
      // Show the stats dialog
      if (!isCancelled) {
        setShowStatsDialog(true);
      } 
      
    } catch (err) {
      if (err.name === 'AbortError') {
        // This is expected when the request is aborted
        console.log('Request aborted');
        // Error is already set in cancelCheck
      } else if (!isCancelled) {
        // Only set error if not cancelled
        setError(err.message || 'An error occurred while checking prices');
      }
    } finally {
      setIsChecking(false);
      setAbortController(null);
      // Reset cancelled state if it was an error other than abort
      if (!isCancelled) {
        setIsCancelled(false);
      }
    }
  };
  
  return (
    <div className={styles.priceCheckContainer}>
      <div className={styles.priceCheckButtonGroup}>
        <button 
          onClick={checkPostPrices}
          disabled={isChecking}
          className={styles.checkPricesButton}
          aria-label="Check post prices"
        >
          {isChecking ? 'Checking...' : '📈 Check Post Prices'}
        </button>
        
        {isChecking && (
          <button 
            onClick={cancelCheck}
            className={styles.cancelCheckButton}
            aria-label="Cancel price check"
          >
            Cancel
          </button>
        )}
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      {/* Stats Dialog */}
      {showStatsDialog && checkStats && (
        <div className={dialogStyles.dialogOverlay} onClick={() => setShowStatsDialog(false)}>
          <div className={dialogStyles.statusDialog} onClick={(e) => e.stopPropagation()}>
            <div className={dialogStyles.dialogHeader}>
              <h3>Price Check Results</h3>
              <button className={dialogStyles.closeButton} onClick={() => setShowStatsDialog(false)}>×</button>
            </div>
            <div className={dialogStyles.dialogContent}>
              <div className={dialogStyles.dialogItem}>
                <span className={dialogStyles.dialogLabel}>Checks Today:</span>
                <span className={dialogStyles.dialogValue}>{checkStats.usageCount} of 100</span>
              </div>
              
              <div className={dialogStyles.dialogItem}>
                <span className={dialogStyles.dialogLabel}>Checked Posts:</span>
                <span className={dialogStyles.dialogValue}>{checkStats.checkedPosts}</span>
              </div>
              
              <div className={dialogStyles.dialogItem}>
                <span className={dialogStyles.dialogLabel}>Updated Posts:</span>
                <span className={dialogStyles.dialogValue}>{checkStats.updatedPosts}</span>
              </div>
              
              {checkStats.closedPostsSkipped > 0 && (
                <div className={dialogStyles.dialogItem}>
                  <span className={dialogStyles.dialogLabel}>Skipped Posts:</span>
                  <span className={dialogStyles.dialogValue}>{checkStats.closedPostsSkipped} (closed)</span>
                </div>
              )}
              
              <div className={styles.statsActions}>
                <button 
                  className={styles.closeStatsButton}
                  onClick={() => setShowStatsDialog(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
