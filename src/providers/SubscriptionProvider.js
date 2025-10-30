'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSupabase } from './SimpleSupabaseProvider';

const SubscriptionContext = createContext({});

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  const hasProvider = Boolean(context && context.__isSubscriptionProvider);
  const { supabase, user, isAuthenticated } = useSupabase();

  // Standalone fallback state (used when no Provider is mounted)
  const [subInfo, setSubInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);
  const lastFetchTime = useRef(0);

  const fallbackDefault = useMemo(() => ({
    user_id: null,
    plan_id: null,
    plan_name: 'free',
    plan_display_name: 'Free',
    price_check_limit: 50,
    price_checks_used: 0,
    remaining_checks: 50,
    post_creation_limit: 100,
    posts_created: 0,
    remaining_posts: 100,
    subscription_status: 'active',
    start_date: null,
    end_date: null
  }), []);

  const fetchInfo = useCallback(async (forceRefresh = false, options = { silent: false }) => {
    if (hasProvider) return;
    if (!user?.id || !supabase) {
      setSubInfo(fallbackDefault);
      setLoading(false);
      return;
    }
    if (fetchingRef.current) return;
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchTime.current) < 10000) return;
    
    try {
      fetchingRef.current = true;
      if (options.silent) setSyncing(true); else setLoading(true);
      setError(null);
      
      // Get access token from session or localStorage
      let accessToken = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token;
      } catch (e) {
        console.warn('[useSubscription] getSession failed, trying localStorage:', e);
      }
      
      // Fallback: read from localStorage if session is not available
      if (!accessToken && typeof window !== 'undefined') {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] || '';
          const storageKey = `sb-${projectRef}-auth-token`;
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
          }
        } catch (e) {
          console.warn('[useSubscription] localStorage read failed:', e);
        }
      }
      
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      
      const res = await fetch('/api/subscription/info', {
        method: 'GET',
        headers: {
          ...headers,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
        cache: 'no-store' // مهم جداً - يعطل cache المتصفح
      });
      
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const json = await res.json();
      
      if (json.success && json.data) {
        setSubInfo((prev) => {
          const prevUsed = prev?.posts_created ?? 0;
          const apiUsed = json.data.posts_created ?? 0;
          const used = Math.max(prevUsed, apiUsed);
          const limit = json.data.post_creation_limit ?? prev?.post_creation_limit ?? 100;
          return {
            ...json.data,
            posts_created: used,
            post_creation_limit: limit,
            remaining_posts: Math.max(limit - used, 0)
          };
        });
        lastFetchTime.current = now;
      } else {
        setSubInfo({ ...fallbackDefault, user_id: user.id });
      }
    } catch (e) {
      setError(e.message);
      setSubInfo({ ...fallbackDefault, user_id: user?.id || null });
    } finally {
      setLoading(false);
      setSyncing(false);
      fetchingRef.current = false;
    }
  }, [hasProvider, user?.id, supabase, fallbackDefault]);

  const refresh = useCallback(async () => {
    if (hasProvider) return;
    await fetchInfo(true);
  }, [hasProvider, fetchInfo]);

  const getRemainingPosts = useCallback(() => {
    const s = hasProvider ? context.subscriptionInfo : subInfo;
    if (!s) return 100;
    const used = s.posts_created || 0;
    const limit = s.post_creation_limit || 100;
    return Math.max(0, limit - used);
  }, [hasProvider, context, subInfo]);

  const canPerformPriceCheck = useCallback(() => {
    const s = hasProvider ? context.subscriptionInfo : subInfo;
    if (!s) return false;
    return (s.remaining_checks || 0) > 0;
  }, [hasProvider, context, subInfo]);

  const getUsageInfo = useCallback(() => {
    const s = hasProvider ? context.subscriptionInfo : subInfo;
    if (!s) return null;
    return {
      priceChecks: {
        used: s.price_checks_used || 0,
        limit: s.price_check_limit || 50,
        remaining: s.remaining_checks || Math.max((s.price_check_limit || 0) - (s.price_checks_used || 0), 0)
      },
      posts: {
        used: s.posts_created || 0,
        limit: s.post_creation_limit || 100,
        remaining: getRemainingPosts()
      },
      planName: s.plan_name || 'free',
      planDisplayName: s.plan_display_name || 'Free',
      subscriptionStatus: s.subscription_status,
      startDate: s.start_date,
      endDate: s.end_date
    };
  }, [hasProvider, context, subInfo, getRemainingPosts]);

  const incrementPostUsage = useCallback(async () => {
    console.log('[incrementPostUsage] Called', { hasProvider, userId: user?.id });
    if (hasProvider) return context.incrementPostUsage();
    if (!user?.id) return { success: false, error: 'No user logged in' };
    try {
      console.log('[incrementPostUsage] Calling log_post_creation RPC...');
      const { data: rpcData, error: rpcError } = await supabase.rpc('log_post_creation', { p_user_id: user.id });
      console.log('[incrementPostUsage] RPC result:', { rpcData, rpcError });
      if (rpcError) throw rpcError;

      // Optimistic UI: apply server-returned posts_created immediately
      if (rpcData && typeof rpcData.posts_created === 'number') {
        setSubInfo((prev) => {
          const limit = prev?.post_creation_limit ?? (typeof rpcData.post_creation_limit === 'number' ? rpcData.post_creation_limit : 100);
          const used = rpcData.posts_created;
          return {
            ...(prev || {}),
            user_id: user.id,
            posts_created: used,
            post_creation_limit: limit,
            remaining_posts: Math.max(limit - used, 0),
            plan_name: rpcData.plan_name || prev?.plan_name || 'free'
          };
        });
      }

      await fetchInfo(true, { silent: true });
      return { success: true };
    } catch (e) {
      console.error('[incrementPostUsage] Error:', e);
      await fetchInfo(true, { silent: true });
      return { success: false, error: e.message };
    }
  }, [hasProvider, context, user?.id, supabase, fetchInfo]);

  const incrementPriceCheckUsage = useCallback(async () => {
    if (hasProvider) return context.incrementPriceCheckUsage();
    if (!user?.id) return { success: false, error: 'No user logged in' };
    try {
      const { data: canCheck, error: checkError } = await supabase.rpc('check_price_limit', { p_user_id: user.id });
      if (checkError) throw checkError;
      if (canCheck === false) return { success: false, error: 'Price check limit exceeded' };
      const { error: logError } = await supabase.rpc('log_price_check', { p_user_id: user.id, p_symbol: 'API_CALL', p_exchange: null, p_country: null });
      if (logError) throw logError;
      await fetchInfo(true, { silent: true });
      return { success: true };
    } catch (e) {
      await fetchInfo(true, { silent: true });
      return { success: false, error: e.message };
    }
  }, [hasProvider, context, user?.id, supabase, fetchInfo]);

  useEffect(() => {
    if (hasProvider) return;
    if (user?.id) {
      fetchInfo(false, { silent: true });
    } else {
      setSubInfo(fallbackDefault);
      setLoading(false);
      setError(null);
    }
  }, [hasProvider, user?.id, fetchInfo, fallbackDefault]);

  const fallbackValue = useMemo(() => {
    const currentInfo = subInfo || fallbackDefault;
    // Removed verbose logging to reduce console noise
    
    return {
      subscriptionInfo: currentInfo,
      subscription: currentInfo,
      loading,
      isLoading: loading,
      syncing,
      error,
      analytics: { postsCount: 0, successPosts: 0, lossPosts: 0, experienceScore: 0 },
      fetchSubscriptionInfo: fetchInfo,
      refreshSubscription: refresh,
      upgradeToProSubscription: async () => ({ success: false, error: 'Not implemented' }),
      cancelSubscription: async () => ({ success: false, error: 'Not implemented' }),
      canPerformPriceCheck,
      canCreatePost: () => (getRemainingPosts() > 0),
      isProPlan: () => ((currentInfo?.plan_name || 'free') === 'pro'),
      getRemainingPriceChecks: () => (currentInfo?.remaining_checks || 0),
      getRemainingPosts,
      getUsageInfo,
      getSubscriptionMessage: () => null,
      remaining_checks: currentInfo?.remaining_checks,
      price_checks_used: currentInfo?.price_checks_used,
      price_check_limit: currentInfo?.price_check_limit,
      remaining_posts: currentInfo?.remaining_posts ?? Math.max(0, (currentInfo?.post_creation_limit || 100) - (currentInfo?.posts_created || 0)),
      posts_created: currentInfo?.posts_created,
      post_creation_limit: currentInfo?.post_creation_limit,
      subscriptionLoading: loading,
      incrementPostUsage,
      incrementPriceCheckUsage,
      isPro: (currentInfo?.plan_name || 'free') === 'pro',
      usageInfo: getUsageInfo(),
      subscriptionMessage: null
    };
  }, [subInfo, fallbackDefault, loading, syncing, error, fetchInfo, refresh, canPerformPriceCheck, getRemainingPosts, getUsageInfo, incrementPostUsage, incrementPriceCheckUsage]);

  const value = hasProvider ? context : fallbackValue;

  return value;
};

export function SubscriptionProvider({ children }) {
  const { supabase, user, isAuthenticated } = useSupabase();
  
  // Debug logging
  console.log('[SUBSCRIPTION PROVIDER] Component initialized', { 
    hasUser: !!user, 
    userId: user?.id, 
    hasSupabase: !!supabase,
    isAuthenticated 
  });
  
  // Default free plan state for immediate UI response (memoized)
  const defaultFreePlan = useMemo(() => ({
    user_id: null,
    plan_id: null,
    plan_name: 'free',
    plan_display_name: 'Free',
    price_check_limit: 50,
    price_checks_used: 0,
    remaining_checks: 50,
    post_creation_limit: 100,
    posts_created: 0,
    remaining_posts: 100,
    subscription_status: 'active',
    start_date: null,
    end_date: null
  }), []);

  // State for subscription info - start with default free plan
  const [subscriptionInfo, setSubscriptionInfo] = useState(defaultFreePlan);
  const [loading, setLoading] = useState(false); // Start as false since we have default data
  const [syncing, setSyncing] = useState(false); // Background sync
  const [error, setError] = useState(null);
  
  // State for user analytics
  const [analytics, setAnalytics] = useState({
    postsCount: 0,
    successPosts: 0,
    lossPosts: 0,
    experienceScore: 0
  });

  // Cache and optimization
  const fetchingRef = useRef(false);
  const lastFetchTime = useRef(0);

  // Optimized fetch subscription info from API with caching
  const fetchSubscriptionInfo = useCallback(async (forceRefresh = false, options = { silent: false }) => {
    console.log('[SUBSCRIPTION PROVIDER] fetchSubscriptionInfo called', { 
      userId: user?.id, 
      hasSupabase: !!supabase,
      forceRefresh,
      silent: options.silent
    });

    if (!user?.id || !supabase) {
      console.log('[SUBSCRIPTION PROVIDER] No user or supabase, skipping fetch');
      // Keep a valid default structure so downstream consumers don't see undefined
      setSubscriptionInfo(prev => prev || defaultFreePlan);
      setLoading(false);
      return;
    }

    // Prevent concurrent fetches (even if forceRefresh)
    if (fetchingRef.current) {
      console.log('[SUBSCRIPTION PROVIDER] Fetch already in progress, skipping');
      return;
    }

    // Cache for 10 seconds to avoid excessive API calls (reduced from 30s)
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchTime.current) < 10000) {
      console.log('[SUBSCRIPTION PROVIDER] Cache still valid, skipping fetch');
      return;
    }

    try {
      fetchingRef.current = true;
      
      // Show appropriate loading state
      if (options.silent || (subscriptionInfo && forceRefresh)) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      
      setError(null);

      console.log('[SUBSCRIPTION PROVIDER] Starting API call to /api/subscription/info');

      // Use the existing API endpoint for subscription info
      const response = await fetch('/api/subscription/info', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store' // مهم جداً - يعطل cache المتصفح
      });

      console.log('[SUBSCRIPTION PROVIDER] API response received', { status: response.status, ok: response.ok });

      if (!response.ok) {
        // Handle unauthorized error - redirect to login if session expired
        if (response.status === 401) {
          console.warn('[SUBSCRIPTION PROVIDER] Unauthorized - session may have expired');
          // Don't redirect here as this is a provider, let the UI components handle it
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('[SUBSCRIPTION PROVIDER] API response data:', result);
      
      if (result.success && result.data) {
        setSubscriptionInfo((prev) => {
          const prevUsed = prev?.posts_created ?? 0;
          const apiUsed = result.data.posts_created ?? 0;
          const used = Math.max(prevUsed, apiUsed);
          const limit = result.data.post_creation_limit ?? prev?.post_creation_limit ?? 100;
          return {
            ...result.data,
            posts_created: used,
            post_creation_limit: limit,
            remaining_posts: Math.max(limit - used, 0)
          };
        });
        lastFetchTime.current = now;
      } else {
        console.log('[SUBSCRIPTION PROVIDER] API response invalid or no data, using fallback');
        // Fallback to default free plan
        const defaultInfo = {
          user_id: user.id,
          plan_name: 'free',
          plan_display_name: 'Free',
          price_check_limit: 50,
          price_checks_used: 0,
          remaining_checks: 50,
          post_creation_limit: 100,
          posts_created: 0,
          remaining_posts: 100,
          subscription_status: null,
          start_date: null,
          end_date: null
        };
        setSubscriptionInfo(defaultInfo);
      }
    } catch (err) {
      console.error('Error fetching subscription info:', err);
      setError(err.message);
      
      // Set default free plan on error
      const defaultInfo = {
        user_id: user.id,
        plan_name: 'free',
        plan_display_name: 'Free',
        price_check_limit: 50,
        price_checks_used: 0,
        remaining_checks: 50,
        post_creation_limit: 100,
        posts_created: 0,
        remaining_posts: 100,
        subscription_status: null,
        start_date: null,
        end_date: null
      };
      setSubscriptionInfo(defaultInfo);
    } finally {
      setLoading(false);
      setSyncing(false);
      fetchingRef.current = false;
    }
  }, [user?.id, supabase]);

  // Fetch user analytics from profile and posts
  const fetchAnalytics = useCallback(async () => {
    if (!user?.id || !supabase) return;

    try {
      // Get profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('success_posts, loss_posts, experience_score')
        .eq('id', user.id)
        .single();

      // Get posts count by counting user's posts
      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!profileError && profile) {
        setAnalytics({
          postsCount: postsCount || 0,
          successPosts: profile.success_posts || 0,
          lossPosts: profile.loss_posts || 0,
          experienceScore: profile.experience_score || 0
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }, [user?.id, supabase]);

  // Refresh subscription data (public method)
  const refreshSubscription = useCallback(async () => {
    await Promise.all([
      fetchSubscriptionInfo(true), // Force refresh
      fetchAnalytics()
    ]);
  }, [fetchSubscriptionInfo, fetchAnalytics]);

  // Upgrade to Pro subscription with enhanced error handling
  const upgradeToProSubscription = useCallback(async (paymentDetails) => {
    console.log('[SUBSCRIPTION] Starting upgradeToProSubscription with details:', paymentDetails);
    
    if (!user?.id) {
      console.error('[SUBSCRIPTION] No user logged in');
      return { success: false, error: 'المستخدم غير مسجل دخول' };
    }

    if (!supabase) {
      console.error('[SUBSCRIPTION] Supabase client not available');
      return { success: false, error: 'اتصال قاعدة البيانات غير متاح' };
    }

    try {
      console.log('[SUBSCRIPTION] Calling create_pro_subscription RPC function');
      
      // Add timeout to RPC call to prevent hanging
      const rpcPromise = supabase.rpc('create_pro_subscription', {
        p_user_id: user.id,
        p_paypal_order_id: paymentDetails.paypal_order_id || 'manual'
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout after 60 seconds')), 60000)
      );

      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

      console.log('[SUBSCRIPTION] RPC response:', { data, error });

      if (error) {
        console.error('[SUBSCRIPTION] RPC function failed:', error);
        console.error('[SUBSCRIPTION] Error details:', JSON.stringify(error, null, 2));
        
        // Check if it's a permissions error
        if (error.code === 'PGRST116' || error.message?.includes('permission')) {
          throw new Error('ليس لديك صلاحية لترقية الاشتراك. تحقق من تسجيل الدخول.');
        }
        
        throw new Error(`خطأ في قاعدة البيانات: ${error.message || error}`);
      }

      console.log('[SUBSCRIPTION] Subscription created with ID:', data);

      // Log payment transaction
      console.log('[SUBSCRIPTION] Logging payment transaction');
      const { error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: user.id,
          subscription_id: data,
          amount: parseFloat(paymentDetails.amount) || 7.00,
          currency: paymentDetails.currency || 'USD',
          paypal_order_id: paymentDetails.paypal_order_id,
          paypal_capture_id: paymentDetails.paypal_capture_id,
          status: 'completed',
          transaction_type: paymentDetails.transaction_type || 'payment',
          metadata: paymentDetails
        });

      if (transactionError) {
        console.warn('[SUBSCRIPTION] Failed to log transaction:', transactionError);
        // Don't fail the upgrade if transaction logging fails
      } else {
        console.log('[SUBSCRIPTION] Payment transaction logged successfully');
      }

      // Force refresh subscription state
      console.log('[SUBSCRIPTION] Refreshing subscription info');
      await fetchSubscriptionInfo(true);
      
      return { success: true, subscriptionId: data };
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      return { success: false, error: error.message };
    }
  }, [user?.id, supabase, fetchSubscriptionInfo]);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    if (!subscriptionInfo?.plan_id) {
      return { success: false, error: 'No active subscription to cancel' };
    }

    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ status: 'cancelled' })
        .eq('plan_id', subscriptionInfo.plan_id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Force refresh subscription state
      await fetchSubscriptionInfo(true);
      return { success: true };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return { success: false, error: error.message };
    }
  }, [subscriptionInfo?.plan_id, user?.id, supabase, fetchSubscriptionInfo]);

  // Helper functions for subscription limits
  const canPerformPriceCheck = useCallback(() => {
    if (!subscriptionInfo) return false;
    return (subscriptionInfo.remaining_checks || 0) > 0;
  }, [subscriptionInfo]);

  const canCreatePost = useCallback(() => {
    if (!subscriptionInfo) return false;
    return (subscriptionInfo.remaining_posts || subscriptionInfo.post_creation_limit || 100) > 0;
  }, [subscriptionInfo]);

  const getRemainingPriceChecks = useCallback(() => {
    if (!subscriptionInfo) return 0;
    return subscriptionInfo.remaining_checks || 0;
  }, [subscriptionInfo]);

  const getRemainingPosts = useCallback(() => {
    if (!subscriptionInfo) return 100; // Default for free users
    const used = subscriptionInfo.posts_created || 0;
    const limit = subscriptionInfo.post_creation_limit || 100;
    return Math.max(0, limit - used);
  }, [subscriptionInfo]);

  const isProPlan = useCallback(() => {
    return subscriptionInfo?.plan_name === 'pro';
  }, [subscriptionInfo]);

  const getUsageInfo = useCallback(() => {
    if (!subscriptionInfo) return null;
    
    return {
      priceChecks: {
        used: subscriptionInfo.price_checks_used || 0,
        limit: subscriptionInfo.price_check_limit || 50,
        remaining: subscriptionInfo.remaining_checks || 0
      },
      posts: {
        used: subscriptionInfo.posts_created || 0,
        limit: subscriptionInfo.post_creation_limit || 100,
        remaining: getRemainingPosts()
      },
      planName: subscriptionInfo.plan_name || 'free',
      planDisplayName: subscriptionInfo.plan_display_name || 'Free',
      subscriptionStatus: subscriptionInfo.subscription_status,
      startDate: subscriptionInfo.start_date,
      endDate: subscriptionInfo.end_date
    };
  }, [subscriptionInfo, getRemainingPosts]);

  // Increment post usage and refresh state with optimistic update
  const incrementPostUsage = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'No user logged in' };
    
    try {
      // Optimistic update: immediately update local state
      if (subscriptionInfo) {
        const optimisticUpdate = {
          ...subscriptionInfo,
          posts_created: (subscriptionInfo.posts_created || 0) + 1,
          remaining_posts: Math.max((subscriptionInfo.remaining_posts || 0) - 1, 0)
        };
        setSubscriptionInfo(optimisticUpdate);
        console.log('[SUBSCRIPTION PROVIDER] Optimistic post increment:', optimisticUpdate.posts_created);
      }
      
      // Atomically log post creation usage via RPC to avoid race conditions
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('log_post_creation', { p_user_id: user.id });

      if (rpcError) {
        console.error('[SUBSCRIPTION PROVIDER] Failed to log_post_creation RPC:', rpcError);
        throw rpcError;
      }

      if (rpcData) {
        setSubscriptionInfo(prev => {
          const used = typeof rpcData.posts_created === 'number' ? rpcData.posts_created : (prev?.posts_created || 0);
          const limit = typeof rpcData.post_creation_limit === 'number' ? rpcData.post_creation_limit : (prev?.post_creation_limit || 100);
          return {
            ...prev,
            posts_created: used,
            post_creation_limit: limit,
            remaining_posts: Math.max(limit - used, 0),
            plan_name: rpcData.plan_name || prev?.plan_name
          };
        });
      }
      
      // Silent refresh to sync with server
      console.log('[SUBSCRIPTION PROVIDER] Refreshing subscription info from API...');
      await fetchSubscriptionInfo(true, { silent: true });
      console.log('[SUBSCRIPTION PROVIDER] ✅ Subscription info refreshed');
      
      return { success: true };
    } catch (error) {
      console.error('Error incrementing post usage:', error);
      // Revert optimistic update on error
      await fetchSubscriptionInfo(true, { silent: true });
      return { success: false, error: error.message };
    }
  }, [user?.id, supabase, fetchSubscriptionInfo, subscriptionInfo]);

  // Increment price check usage and refresh state with optimistic update
  const incrementPriceCheckUsage = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'No user logged in' };
    
    try {
      // Check if we can perform price check first
      const { data: canCheck, error: checkError } = await supabase
        .rpc('check_price_limit', { p_user_id: user.id });
      
      if (checkError) {
        throw checkError;
      }
      
      if (canCheck === false) {
        return { success: false, error: 'Price check limit exceeded' };
      }
      
      // Optimistic update: immediately update local state
      if (subscriptionInfo) {
        const optimisticUpdate = {
          ...subscriptionInfo,
          price_checks_used: (subscriptionInfo.price_checks_used || 0) + 1,
          remaining_checks: Math.max((subscriptionInfo.remaining_checks || 0) - 1, 0)
        };
        setSubscriptionInfo(optimisticUpdate);
        console.log('[SUBSCRIPTION PROVIDER] Optimistic price check increment:', optimisticUpdate.price_checks_used);
      }
      
      // Log the price check using the existing RPC function
      const { error: logError } = await supabase
        .rpc('log_price_check', { 
          p_user_id: user.id,
          p_symbol: 'API_CALL',
          p_exchange: null,
          p_country: null
        });
      
      if (logError) {
        throw logError;
      }
      
      // Silent refresh to sync with server
      await fetchSubscriptionInfo(true, { silent: true });
      
      return { success: true };
    } catch (error) {
      console.error('Error incrementing price check usage:', error);
      // Revert optimistic update on error
      await fetchSubscriptionInfo(true, { silent: true });
      return { success: false, error: error.message };
    }
  }, [user?.id, supabase, fetchSubscriptionInfo, subscriptionInfo]);

  // Get subscription status message
  const getSubscriptionMessage = useCallback(() => {
    if (!subscriptionInfo) return null;
    
    const { plan_name, remaining_checks, remaining_posts } = subscriptionInfo;
    const remainingChecks = remaining_checks || 0;
    const remainingPostsCount = getRemainingPosts();
    
    if (plan_name === 'free') {
      if (remainingChecks === 0) {
        return {
          type: 'warning',
          message: 'لقد استنفدت عدد فحصات الأسعار المتاحة. قم بالترقية إلى Pro للحصول على المزيد.',
          message_en: 'You have used all your price checks. Upgrade to Pro for more.'
        };
      }
      if (remainingPostsCount === 0) {
        return {
          type: 'warning', 
          message: 'لقد استنفدت عدد المنشورات المتاحة. قم بالترقية إلى Pro للحصول على المزيد.',
          message_en: 'You have used all your posts. Upgrade to Pro for more.'
        };
      }
      return {
        type: 'info',
        message: `الخطة المجانية: ${remainingChecks} فحص أسعار و ${remainingPostsCount} منشور متبقي`,
        message_en: `Free plan: ${remainingChecks} price checks and ${remainingPostsCount} posts remaining`
      };
    }
    
    return {
      type: 'success',
      message: `خطة Pro: ${remainingChecks} فحص أسعار و ${remainingPostsCount} منشور متبقي`,
      message_en: `Pro plan: ${remainingChecks} price checks and ${remainingPostsCount} posts remaining`
    };
  }, [subscriptionInfo, getRemainingPosts]);

  // Auto-fetch subscription info when user changes
  useEffect(() => {
    console.log('[SUBSCRIPTION PROVIDER] useEffect triggered - user change detected', { 
      userId: user?.id, 
      hasUser: !!user,
      isAuthenticated 
    });

    if (user?.id) {
      console.log('[SUBSCRIPTION PROVIDER] User found, updating default plan and fetching in background');
      // Update default plan with actual user ID
      const userDefaultPlan = {
        ...defaultFreePlan,
        user_id: user.id
      };
      setSubscriptionInfo(userDefaultPlan);
      
      // Fetch real data in background without blocking UI
      fetchSubscriptionInfo(false, { silent: true });
      fetchAnalytics();
    } else {
      console.log('[SUBSCRIPTION PROVIDER] No user found, resetting to default');
      setSubscriptionInfo(defaultFreePlan);
      setLoading(false);
      setError(null);
    }
  }, [user?.id, fetchSubscriptionInfo, fetchAnalytics]);

  // Set up real-time subscription for changes
  useEffect(() => {
    if (!user?.id || !supabase) {
      return;
    }

    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Real-time subscription change detected:', payload);
          // Refresh subscription info when changes occur (silently)
          fetchSubscriptionInfo(true, { silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, fetchSubscriptionInfo]);

  const value = {
    __isSubscriptionProvider: true,
    // State
    subscriptionInfo,
    // Backward-compat alias for legacy consumers expecting 'subscription'
    subscription: subscriptionInfo,
    loading,
    // Backward-compat alias for components destructuring { isLoading }
    isLoading: loading,
    syncing,
    error,
    analytics,
    
    // Methods
    fetchSubscriptionInfo,
    refreshSubscription,
    upgradeToProSubscription,
    cancelSubscription,
    
    // Checkers
    canPerformPriceCheck,
    canCreatePost,
    isProPlan,
    
    // Getters
    getRemainingPriceChecks,
    getRemainingPosts,
    getUsageInfo,
    getSubscriptionMessage,
    
    // Backward-compat proxy fields (for existing consumers expecting flat fields)
    // Price checks
    remaining_checks: subscriptionInfo?.remaining_checks,
    price_checks_used: subscriptionInfo?.price_checks_used,
    price_check_limit: subscriptionInfo?.price_check_limit,
    // Post creation
    remaining_posts: subscriptionInfo?.remaining_posts,
    posts_created: subscriptionInfo?.posts_created,
    post_creation_limit: subscriptionInfo?.post_creation_limit,
    // Loading state
    subscriptionLoading: loading,
    
    // Usage incrementers
    incrementPostUsage,
    incrementPriceCheckUsage,
    
    // Computed values
    isPro: isProPlan(),
    usageInfo: getUsageInfo(),
    subscriptionMessage: getSubscriptionMessage()
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export default SubscriptionProvider;
