'use client';

import { useSupabase } from '@/providers/SupabaseProvider';
import { usePostActions } from '@/hooks/usePostActions';
import styles from '../../styles/PostActions.module.css';

export default function PostActions({ postId, initialBuyCount = 0, initialSellCount = 0, onVoteChange }) {
  const { user } = useSupabase();
  const {
    buyCount,
    sellCount,
    userAction,
    isLoading,
    error,
    handleAction
  } = usePostActions(postId, initialBuyCount, initialSellCount);

  // Notify parent component when vote counts change
  const handleVote = async (actionType) => {
    await handleAction(actionType);
    
    // Call the callback to update parent component if provided
    if (onVoteChange) {
      onVoteChange({
        buyCount: actionType === 'buy' ? buyCount + 1 : buyCount,
        sellCount: actionType === 'sell' ? sellCount + 1 : sellCount
      });
    }
  };

  if (!user) {
    return (
      <div className={styles.actionsContainer}>
        <div className={styles.buttonsContainer}>
          <div className={styles.actionButton}>
            <span className={styles.iconEmoji}>👍</span>
            <span className={styles.actionText}>
              <span className={styles.actionLabel}>Buy</span>
              <span className={styles.actionCount}>{buyCount}</span>
            </span>
          </div>
          <div className={styles.actionButton}>
            <span className={styles.iconEmoji}>👎</span>
            <span className={styles.actionText}>
              <span className={styles.actionLabel}>Sell</span>
              <span className={styles.actionCount}>{sellCount}</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.actionsContainer}>
      {error && (
        <div className={styles.errorMessage}>
          <span className={styles.errorText}>⚠️ {error}</span>
        </div>
      )}
      
      <div className={styles.buttonsContainer}>
        <button
          className={`${styles.actionButton} ${userAction === 'buy' ? styles.active : ''}`}
          onClick={() => handleAction('buy')}
          disabled={isLoading}
          title={userAction === 'buy' ? 'Remove Buy Vote' : 'Vote Buy'}
        >
          <span className={styles.iconEmoji}>👍</span>
          <span className={styles.actionText}>
            <span className={styles.actionLabel}>Buy</span>
            <span className={styles.actionCount}>{buyCount}</span>
          </span>
          {isLoading && userAction !== 'sell' && (
            <div className={styles.loadingSpinner}></div>
          )}
        </button>
        
        <button
          className={`${styles.actionButton} ${userAction === 'sell' ? styles.active : ''}`}
          onClick={() => handleAction('sell')}
          disabled={isLoading}
          title={userAction === 'sell' ? 'Remove Sell Vote' : 'Vote Sell'}
        >
          <span className={styles.iconEmoji}>👎</span>
          <span className={styles.actionText}>
            <span className={styles.actionLabel}>Sell</span>
            <span className={styles.actionCount}>{sellCount}</span>
          </span>
          {isLoading && userAction !== 'buy' && (
            <div className={styles.loadingSpinner}></div>
          )}
        </button>
      </div>
    </div>
  );
}
