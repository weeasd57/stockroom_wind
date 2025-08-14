'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import styles from './PostActions.module.css';

export default function PostActions({ postId, initialBuyCount = 0, initialSellCount = 0 }) {
  const { user } = useSupabase();
  const [buyCount, setBuyCount] = useState(initialBuyCount);
  const [sellCount, setSellCount] = useState(initialSellCount);
  const [userAction, setUserAction] = useState('none');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserAction();
    }
  }, [user, postId]);

  const fetchUserAction = async () => {
    try {
      const { data, error } = await supabase
        .from('post_actions')
        .select('action_type')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setUserAction(data.action_type);
      }
    } catch (error) {
      console.error('Error fetching user action:', error);
    }
  };

  const handleAction = async (actionType) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('toggle_post_action', {
        p_post_id: postId,
        p_user_id: user.id,
        p_action_type: actionType
      });

      if (error) throw error;

      // Update local state based on the result
      if (data) {
        // Action was added
        if (actionType === 'buy') {
          setBuyCount(prev => prev + 1);
          if (userAction === 'sell') {
            setSellCount(prev => prev - 1);
          }
          setUserAction('buy');
        } else {
          setSellCount(prev => prev + 1);
          if (userAction === 'buy') {
            setBuyCount(prev => prev - 1);
          }
          setUserAction('sell');
        }
      } else {
        // Action was removed
        if (actionType === 'buy') {
          setBuyCount(prev => prev - 1);
          setUserAction('none');
        } else {
          setSellCount(prev => prev - 1);
          setUserAction('none');
        }
      }
    } catch (error) {
      console.error('Error toggling action:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.actionsContainer}>
        <div className={styles.actionButton}>
          <ThumbsUp className={styles.icon} />
          <span>{buyCount}</span>
        </div>
        <div className={styles.actionButton}>
          <ThumbsDown className={styles.icon} />
          <span>{sellCount}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.actionsContainer}>
      <button
        className={`${styles.actionButton} ${userAction === 'buy' ? styles.active : ''}`}
        onClick={() => handleAction('buy')}
        disabled={isLoading}
        title="Vote Buy"
      >
        <ThumbsUp className={styles.icon} />
        <span>{buyCount}</span>
      </button>
      
      <button
        className={`${styles.actionButton} ${userAction === 'sell' ? styles.active : ''}`}
        onClick={() => handleAction('sell')}
        disabled={isLoading}
        title="Vote Sell"
      >
        <ThumbsDown className={styles.icon} />
        <span>{sellCount}</span>
      </button>
    </div>
  );
}