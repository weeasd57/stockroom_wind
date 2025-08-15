'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';

export function usePostActions(postId, initialBuyCount = 0, initialSellCount = 0, onSuccess) {
  const { user, supabase } = useSupabase();
  const [buyCount, setBuyCount] = useState(initialBuyCount);
  const [sellCount, setSellCount] = useState(initialSellCount);
  const [userAction, setUserAction] = useState('none');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch user's current action for this post
  const fetchUserAction = useCallback(async () => {
    if (!user || !supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('post_actions')
        .select('action_type')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setUserAction(data.action_type);
      } else {
        setUserAction('none');
      }
    } catch (error) {
      console.error('Error fetching user action:', error);
      setUserAction('none');
    }
  }, [user, supabase, postId]);

  // Handle buy/sell action
  const handleAction = useCallback(async (actionType) => {
    if (!user || !supabase) return;
    
    setIsLoading(true);
    setError(null);
    
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
          if (onSuccess) onSuccess(`📈 Voted Buy!`, 'success');
        } else {
          setSellCount(prev => prev + 1);
          if (userAction === 'buy') {
            setBuyCount(prev => prev - 1);
          }
          setUserAction('sell');
          if (onSuccess) onSuccess(`📉 Voted Sell!`, 'success');
        }
      } else {
        // Action was removed
        if (actionType === 'buy') {
          setBuyCount(prev => prev - 1);
          setUserAction('none');
          if (onSuccess) onSuccess(`Removed Buy vote`, 'info');
        } else {
          setSellCount(prev => prev - 1);
          setUserAction('none');
          if (onSuccess) onSuccess(`Removed Sell vote`, 'info');
        }
      }
    } catch (error) {
      console.error('Error toggling action:', error);
      setError(error.message || 'Failed to update vote');
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase, postId, userAction]);

  // Initialize user action on mount
  useEffect(() => {
    if (user) {
      fetchUserAction();
    }
  }, [user, fetchUserAction]);

  // Reset counts when initial values change (for real-time updates)
  useEffect(() => {
    setBuyCount(initialBuyCount);
    setSellCount(initialSellCount);
  }, [initialBuyCount, initialSellCount]);

  return {
    buyCount,
    sellCount,
    userAction,
    isLoading,
    error,
    handleAction,
    refetch: fetchUserAction
  };
}