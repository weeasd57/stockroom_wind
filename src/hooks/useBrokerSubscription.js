import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';

/**
 * Hook to check if current user is subscribed to a specific broker
 * Returns subscribed broker IDs for efficient checking
 */
export function useBrokerSubscription() {
  const { user } = useSupabase();
  const [subscribedBrokerIds, setSubscribedBrokerIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setSubscribedBrokerIds(new Set());
      setLoading(false);
      return;
    }

    const fetchSubscriptions = async () => {
      try {
        const { supabase } = await import('@/utils/supabase');
        
        const { data, error } = await supabase
          .from('broker_subscriptions')
          .select('broker_id, expires_at, cancelled_at, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('cancelled_at', null); // Only non-cancelled subscriptions

        if (error) {
          console.error('Error fetching broker subscriptions:', error);
          setLoading(false);
          return;
        }

        // Filter out expired subscriptions
        const now = new Date();
        const validSubscriptions = (data || []).filter(sub => {
          // Must not be cancelled
          if (sub.cancelled_at) return false;
          // If no expiry date, assume valid
          if (!sub.expires_at) return true;
          // Check if not expired
          return new Date(sub.expires_at) > now;
        });

        const brokerIds = new Set(validSubscriptions.map(sub => sub.broker_id));
        setSubscribedBrokerIds(brokerIds);
        setLoading(false);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[useBrokerSubscription] Valid subscriptions:', {
            total: data?.length || 0,
            valid: validSubscriptions.length,
            brokerIds: Array.from(brokerIds)
          });
        }
      } catch (err) {
        console.error('Error in useBrokerSubscription:', err);
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, [user?.id]);

  const isSubscribedToBroker = (brokerId) => {
    const isSubscribed = subscribedBrokerIds.has(brokerId);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[useBrokerSubscription] Check access:', {
        brokerId,
        isSubscribed,
        subscribedBrokerIds: Array.from(subscribedBrokerIds),
        userId: user?.id
      });
    }
    
    return isSubscribed;
  };

  return {
    isSubscribedToBroker,
    subscribedBrokerIds,
    loading,
  };
}
