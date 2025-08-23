'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useComments } from '@/providers/CommentProvider';
import styles from '../../styles/PostActions.module.css';

export default function PostActions({ postId, initialBuyCount = 0, initialSellCount = 0, onVoteChange }) {
  const { user, supabase } = useSupabase();
  const { getPostStats, fetchCommentsForPost, toggleBuyVote, toggleSellVote } = useComments();
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
          .from('post_actions')
          .select('action_type')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        setUserAction(data?.action_type ?? null);
      } catch (e) {
        console.error('Error checking user vote:', e);
      }
    }

    checkUserVote();
  }, [user, supabase, postId]);

  const handleAction = async (actionType) => {
    if (!user || !supabase) return;

    setIsLoading(true);
    setPendingAction(actionType);
    setError(null);

    const prevAction = userAction;
    try {
      // Optimistic local toggle for per-user action
      if (actionType === 'buy') {
        setUserAction(prevAction === 'buy' ? null : 'buy');
        await toggleBuyVote(postId, prevAction);
      } else {
        setUserAction(prevAction === 'sell' ? null : 'sell');
        await toggleSellVote(postId, prevAction);
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
      // Rollback optimistic user action on failure
      setUserAction(prevAction);
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
