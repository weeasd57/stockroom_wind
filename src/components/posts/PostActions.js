'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useComments } from '@/providers/CommentProvider';
import styles from '../../styles/PostActions.module.css';

export default function PostActions({ postId, initialBuyCount = 0, initialSellCount = 0, onVoteChange }) {
  const { user, supabase } = useSupabase();
  const { getPostStats, fetchCommentsForPost } = useComments();
  const [userAction, setUserAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError] = useState(null);

  const postStats = getPostStats(postId);
  const buyCount = postStats.buyCount || initialBuyCount;
  const sellCount = postStats.sellCount || initialSellCount;

  // Bootstrap real-time subscriptions for this post even if comments are not opened
  useEffect(() => {
    if (postId) {
      fetchCommentsForPost(postId);
    }
  }, [postId, fetchCommentsForPost]);

  // Check user's current vote status
  useEffect(() => {
    async function checkUserVote() {
      if (!user || !supabase) return;

      try {
        const { data, error } = await supabase
          .rpc('get_user_post_action', { p_post_id: postId, p_user_id: user.id });
        if (!error && data) {
          setUserAction(data === 'none' ? null : data);
        } else {
          setUserAction(null);
        }
      } catch (e) {
        console.error('Error checking user vote:', e);
      }
    }

    checkUserVote();
  }, [user, supabase, postId]);

  // Utility: enforce a maximum wait to avoid infinite spinner on network stalls
  const withTimeout = (promise, ms = 12000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
    ]);
  };

  const handleAction = async (actionType) => {
    if (!user || !supabase) return;

    setIsLoading(true);
    setPendingAction(actionType);
    setError(null);

    try {
      // Toggle via RPC in a single round trip
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('toggle_post_action', {
          p_post_id: postId,
          p_user_id: user.id,
          p_action_type: actionType
        })
      );
      if (rpcError) throw rpcError;

      // Update UI immediately (server updates will sync via realtime)
      if (actionType === 'buy') {
        setUserAction(userAction === 'buy' ? null : 'buy');
      } else {
        setUserAction(userAction === 'sell' ? null : 'sell');
      }

      // Notify parent component when vote counts change
      if (onVoteChange) {
        const stats = getPostStats(postId);
        onVoteChange({
          buyCount: stats.buyCount,
          sellCount: stats.sellCount
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to update vote');
      console.error('Vote action error:', err);
    } finally {
      setIsLoading(false);
      setPendingAction(null);
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
          {isLoading && pendingAction === 'buy' && (
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
          {isLoading && pendingAction === 'sell' && (
            <div className={styles.loadingSpinner}></div>
          )}
        </button>
      </div>
    </div>
  );
}
