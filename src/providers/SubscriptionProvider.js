'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from './SupabaseProvider';

const SubscriptionContext = createContext({});

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export function SubscriptionProvider({ children }) {
  const { supabase, user, isAuthenticated } = useSupabase();
  
  const [subscription, setSubscription] = useState({
    tier: 'free', // 'free' | 'pro'
    status: 'inactive', // 'active' | 'inactive' | 'expired' | 'cancelled'
    priceChecks: 0,
    maxPriceChecks: 5, // Free tier limit
    billingPeriod: null,
    nextBillingDate: null,
    subscriptionId: null,
    loading: true,
    error: null
  });

  const [analytics, setAnalytics] = useState({
    postsCount: 0,
    successPosts: 0,
    lossPosts: 0,
    experienceScore: 0
  });

  // Refresh subscription data
  const refreshSubscription = async () => {
    if (!isAuthenticated || !user?.id) {
      setSubscription(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setSubscription(prev => ({ ...prev, loading: true, error: null }));

      // Get subscription info from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        throw profileError;
      }

      // Update analytics
      setAnalytics({
        postsCount: profile.posts_count || 0,
        successPosts: profile.success_posts || 0,
        lossPosts: profile.loss_posts || 0,
        experienceScore: profile.experience_score || 0
      });

      // Get subscription info directly from tables instead of view
      let subscriptionInfo = null;
      const { data: userSubs, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!subError && userSubs && userSubs.length > 0) {
        const userSub = userSubs[0]; // Get the first active subscription
        subscriptionInfo = {
          user_id: user.id,
          plan_name: userSub.subscription_plans?.name || 'free',
          plan_display_name: userSub.subscription_plans?.display_name || 'Free',
          price_check_limit: userSub.subscription_plans?.price_check_limit || 2,
          price_checks_used: userSub.price_checks_used || 0,
          subscription_status: userSub.status,
          start_date: userSub.started_at,
          end_date: userSub.expires_at
        };
      } else {
        // User has no active subscription, use free defaults
        subscriptionInfo = {
          user_id: user.id,
          plan_name: 'free',
          plan_display_name: 'Free',
          price_check_limit: 2,
          price_checks_used: 0,
          subscription_status: 'inactive'
        };
      }

      const priceCheckCount = subscriptionInfo?.price_checks_used || 0;

      // Update subscription state using existing schema
      const isPro = subscriptionInfo?.plan_name === 'pro';
      setSubscription({
        tier: subscriptionInfo?.plan_name || 'free',
        status: subscriptionInfo?.subscription_status || 'inactive',
        priceChecks: priceCheckCount,
        maxPriceChecks: subscriptionInfo?.price_check_limit || 2,
        billingPeriod: 'monthly', // Based on existing schema
        nextBillingDate: subscriptionInfo?.end_date || null,
        subscriptionId: subscriptionInfo?.plan_id || null,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error refreshing subscription:', error);
      setSubscription(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // Update subscription after successful payment using existing function
  const upgradeToProSubscription = async (paymentDetails) => {
    try {
      // Use the existing create_pro_subscription function
      const { data, error } = await supabase.rpc('create_pro_subscription', {
        p_user_id: user.id,
        p_paypal_order_id: paymentDetails.paypal_order_id || 'manual'
      });

      if (error) throw error;

      // Log payment transaction
      const { error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: user.id,
          amount: paymentDetails.amount || 1.00,
          currency: paymentDetails.currency || 'USD',
          paypal_order_id: paymentDetails.paypal_order_id,
          paypal_capture_id: paymentDetails.paypal_order_id,
          status: 'completed',
          transaction_type: 'payment',
          metadata: paymentDetails
        });

      if (transactionError) {
        console.warn('Failed to log transaction:', transactionError);
      }

      // Refresh subscription state
      await refreshSubscription();
      
      return { success: true, subscriptionId: data };
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      return { success: false, error: error.message };
    }
  };

  // Cancel subscription
  const cancelSubscription = async () => {
    if (!subscription.subscriptionId) return { success: false, error: 'No active subscription' };

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscription.subscriptionId);

      if (error) throw error;

      await refreshSubscription();
      return { success: true };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return { success: false, error: error.message };
    }
  };

  // Check if user can perform price check
  const canPerformPriceCheck = () => {
    return subscription.priceChecks < subscription.maxPriceChecks;
  };

  // Get remaining price checks
  const getRemainingPriceChecks = () => {
    return Math.max(0, subscription.maxPriceChecks - subscription.priceChecks);
  };

  // Check if user is Pro
  const isPro = () => {
    return subscription.tier === 'pro' && subscription.status === 'active';
  };

  // Load subscription on mount and when user changes
  useEffect(() => {
    refreshSubscription();
  }, [isAuthenticated, user?.id]);

  const value = {
    // Subscription state
    subscription,
    analytics,
    
    // Actions
    refreshSubscription,
    upgradeToProSubscription,
    cancelSubscription,
    
    // Helpers
    canPerformPriceCheck,
    getRemainingPriceChecks,
    isPro,
    
    // Quick access
    isLoading: subscription.loading,
    error: subscription.error,
    tier: subscription.tier,
    priceChecks: subscription.priceChecks,
    maxPriceChecks: subscription.maxPriceChecks
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}
