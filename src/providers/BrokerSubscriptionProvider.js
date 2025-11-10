'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';

const BrokerSubscriptionContext = createContext(null);

export function BrokerSubscriptionProvider({ children }) {
  const { user, supabase } = useSupabase();
  const [subscribedBrokerIds, setSubscribedBrokerIds] = useState(new Set());
  const [brokerSubscriptions, setBrokerSubscriptions] = useState([]); // Full subscription data with broker details
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  const fetchSubscriptions = useCallback(async (force = false) => {
    // Fixed: Using manual join instead of PostgREST embedded resource
    if (!user?.id) {
      setSubscribedBrokerIds(new Set());
      setLoading(false);
      return;
    }

    // Cache for 30 seconds to avoid excessive API calls
    const now = Date.now();
    if (!force && lastFetchTime && (now - lastFetchTime) < 30000) {
      return;
    }

    try {
      setLoading(true);
      
      // First, get broker subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('broker_subscriptions')
        .select('broker_id, expires_at, cancelled_at, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('cancelled_at', null);

      if (subError) {
        console.error('[BrokerSubscriptionProvider] Error fetching subscriptions:', subError);
        setLoading(false);
        return;
      }

      // Filter out expired subscriptions
      const now = new Date();
      const validSubscriptions = (subscriptions || []).filter(sub => {
        if (sub.cancelled_at) return false;
        if (!sub.expires_at) return true;
        return new Date(sub.expires_at) > now;
      });

      // Get broker profile details for valid subscriptions
      const brokerIds = validSubscriptions.map(sub => sub.broker_id);
      
      let enrichedSubscriptions = validSubscriptions;
      if (brokerIds.length > 0) {
        const { data: brokers, error: brokerError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_broker')
          .in('id', brokerIds);

        if (!brokerError && brokers) {
          // Merge broker data with subscriptions
          enrichedSubscriptions = validSubscriptions.map(sub => ({
            ...sub,
            broker: brokers.find(b => b.id === sub.broker_id) || null
          }));
        }
      }

      const brokerIdSet = new Set(brokerIds);
      setSubscribedBrokerIds(brokerIdSet);
      setBrokerSubscriptions(enrichedSubscriptions); // Store full subscription data with broker details
      setLastFetchTime(Date.now());
      setLoading(false);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[BrokerSubscriptionProvider] Fetched subscriptions:', {
          total: subscriptions?.length || 0,
          valid: validSubscriptions.length,
          brokerIds: Array.from(brokerIdSet)
        });
      }
    } catch (err) {
      console.error('[BrokerSubscriptionProvider] Error:', err);
      setLoading(false);
    }
  }, [user?.id, supabase, lastFetchTime]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchSubscriptions();
  }, [user?.id]);

  const isSubscribedToBroker = useCallback((brokerId) => {
    return subscribedBrokerIds.has(brokerId);
  }, [subscribedBrokerIds]);

  const refreshSubscriptions = useCallback(() => {
    return fetchSubscriptions(true);
  }, [fetchSubscriptions]);

  const value = {
    isSubscribedToBroker,
    subscribedBrokerIds,
    brokerSubscriptions, // Full subscription data with broker details
    loading,
    refreshSubscriptions,
  };

  return (
    <BrokerSubscriptionContext.Provider value={value}>
      {children}
    </BrokerSubscriptionContext.Provider>
  );
}

export function useBrokerSubscription() {
  const context = useContext(BrokerSubscriptionContext);
  if (!context) {
    throw new Error('useBrokerSubscription must be used within BrokerSubscriptionProvider');
  }
  return context;
}
