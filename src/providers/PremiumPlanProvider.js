'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSupabase } from './SimpleSupabaseProvider';

const PremiumPlanContext = createContext();

export function PremiumPlanProvider({ children }) {
  const { supabase, user } = useSupabase();
  
  // Premium Plan States
  const [planData, setPlanData] = useState({
    description: '',
    features: [],
    pricing: {
      monthly: 0,
      yearly: 0,
      currency: 'USD'
    },
    stats: {
      averagePostsPerMonth: 0,
      successRate: 0,
      totalSubscribers: 0,
      premiumSubscribers: 0
    },
    paypalAccount: '',
    isActive: false,
    createdAt: null,
    updatedAt: null
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fetch premium plan data from Supabase
  const fetchPremiumPlan = useCallback(async () => {
    if (!user?.id) {
      console.log('[PremiumPlan] No user ID, skipping fetch');
      return;
    }
    
    console.log('[PremiumPlan] Fetching plan for user:', user.id);
    setLoading(true);
    setError(null);
    
    try {
      // Fetch premium plan data
      const { data: planInfo, error: planError } = await supabase
        .from('premium_plans')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (planError && planError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw planError;
      }

      // Default features for premium brokers
      const defaultFeatures = [
        'Exclusive premium posts',
        'Strategy insights and analysis',
        'Priority support'
      ];

      // If no plan exists, create default structure
      if (!planInfo) {
        console.log('[PremiumPlan] No existing plan found, creating new one');
        const defaultPlan = {
          user_id: user.id,
          description: '',
          features: defaultFeatures,
          pricing: {
            monthly: 0,
            yearly: 0,
            currency: 'USD'
          },
          stats: {
            averagePostsPerMonth: 0,
            successRate: 0,
            totalSubscribers: 0,
            premiumSubscribers: 0
          },
          paypal_account: '',
          is_active: false
        };

        const { data: newPlan, error: createError } = await supabase
          .from('premium_plans')
          .insert(defaultPlan)
          .select()
          .single();

        if (createError) throw createError;
        
        setPlanData({
          description: newPlan.description || '',
          features: newPlan.features || [],
          pricing: newPlan.pricing || { monthly: 0, yearly: 0, currency: 'USD' },
          stats: newPlan.stats || { averagePostsPerMonth: 0, successRate: 0, totalSubscribers: 0, premiumSubscribers: 0 },
          paypalAccount: newPlan.paypal_account || '',
          isActive: newPlan.is_active || false,
          createdAt: newPlan.created_at,
          updatedAt: newPlan.updated_at
        });
      } else {
        console.log('[PremiumPlan] Loaded existing plan:', planInfo);
        // Ensure features exist, if empty add defaults
        const features = (planInfo.features && planInfo.features.length > 0) 
          ? planInfo.features 
          : defaultFeatures;
        
        setPlanData({
          description: planInfo.description || '',
          features: features,
          pricing: planInfo.pricing || { monthly: 0, yearly: 0, currency: 'USD' },
          stats: planInfo.stats || { averagePostsPerMonth: 0, successRate: 0, totalSubscribers: 0, premiumSubscribers: 0 },
          paypalAccount: planInfo.paypal_account || '',
          isActive: planInfo.is_active || false,
          createdAt: planInfo.created_at,
          updatedAt: planInfo.updated_at
        });
      }

      // Fetch calculated stats from posts and subscribers
      await fetchCalculatedStats();

    } catch (err) {
      console.error('Error fetching premium plan:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  // Fetch calculated stats from posts and telegram subscribers
  const fetchCalculatedStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get posts stats for the last 12 months
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { data: postsStats, error: postsError } = await supabase
        .from('posts_with_stats')
        .select('created_at, target_reached, stop_loss_triggered')
        .eq('user_id', user.id)
        .gte('created_at', oneYearAgo.toISOString());

      if (postsError) throw postsError;

      // Calculate average posts per month
      const monthsCount = 12;
      const averagePostsPerMonth = Math.round((postsStats?.length || 0) / monthsCount);

      // Calculate success rate
      const totalPosts = postsStats?.length || 0;
      const successfulPosts = postsStats?.filter(p => p.target_reached).length || 0;
      const successRate = totalPosts > 0 ? Math.round((successfulPosts / totalPosts) * 100) : 0;

      // Get telegram subscribers stats
      const { data: subscribersStats, error: subscribersError } = await supabase
        .from('telegram_subscribers_with_subscription')
        .select('subscription_tier')
        .eq('is_subscribed', true);
      
      // Note: This query returns an array, not a single object, so PGRST116 won't occur here

      if (subscribersError) throw subscribersError;

      const totalSubscribers = subscribersStats?.length || 0;
      const premiumSubscribers = subscribersStats?.filter(s => s.subscription_tier === 'premium').length || 0;

      // Update stats in state
      setPlanData(prev => ({
        ...prev,
        stats: {
          averagePostsPerMonth,
          successRate,
          totalSubscribers,
          premiumSubscribers
        }
      }));

    } catch (err) {
      console.error('Error fetching calculated stats:', err);
    }
  }, [user?.id, supabase]);

  // Save premium plan data to Supabase
  const savePremiumPlan = useCallback(async (updates) => {
    if (!user?.id) return false;

    setSaving(true);
    setError(null);

    try {
      const updateData = {
        description: updates.description,
        features: updates.features,
        pricing: updates.pricing,
        paypal_account: updates.paypalAccount,
        is_active: updates.isActive,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('premium_plans')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update profiles table with broker information (sync with SQL schema)
      const pricing = updates.pricing || { monthly: 0, yearly: 0, currency: 'USD' };
      const stats = planData.stats || { averagePostsPerMonth: 0 };
      
      await supabase
        .from('profiles')
        .update({
          broker_plan_description: updates.description || '',
          broker_average_posts_info: `Average ${stats.averagePostsPerMonth || 0} posts per month`,
          broker_price_plan_info: `$${pricing.monthly || 0}/month or $${pricing.yearly || 0}/year`
        })
        .eq('id', user.id);

      // Update local state
      setPlanData(prev => ({
        ...prev,
        description: data.description || '',
        features: data.features || [],
        pricing: data.pricing || { monthly: 0, yearly: 0, currency: 'USD' },
        paypalAccount: data.paypal_account || '',
        isActive: data.is_active || false,
        updatedAt: data.updated_at
      }));

      return true;
    } catch (err) {
      console.error('Error saving premium plan:', err);
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.id, supabase, planData.stats]);

  // Update specific field
  const updatePlanField = useCallback(async (field, value) => {
    const updates = { ...planData };
    
    if (field.includes('.')) {
      // Handle nested fields like 'pricing.monthly'
      const [parent, child] = field.split('.');
      updates[parent] = { ...updates[parent], [child]: value };
    } else {
      updates[field] = value;
    }

    return await savePremiumPlan(updates);
  }, [planData, savePremiumPlan]);

  // Add feature to the list
  const addFeature = useCallback(async (feature) => {
    const updatedFeatures = [...planData.features, feature];
    return await updatePlanField('features', updatedFeatures);
  }, [planData.features, updatePlanField]);

  // Remove feature from the list
  const removeFeature = useCallback(async (index) => {
    const updatedFeatures = planData.features.filter((_, i) => i !== index);
    return await updatePlanField('features', updatedFeatures);
  }, [planData.features, updatePlanField]);

  // Toggle plan active status
  const togglePlanStatus = useCallback(async () => {
    return await updatePlanField('isActive', !planData.isActive);
  }, [planData.isActive, updatePlanField]);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    await fetchCalculatedStats();
  }, [fetchCalculatedStats]);

  // Initialize data on mount
  useEffect(() => {
    if (user?.id) {
      fetchPremiumPlan();
    }
  }, [user?.id, fetchPremiumPlan]);

  // Set up real-time subscription for premium plans
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('premium_plans_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'premium_plans',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload) => {
          console.log('Premium plan changed:', payload);
          // Refetch data when changes occur
          fetchPremiumPlan();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, supabase, fetchPremiumPlan]);

  const value = {
    // Data
    planData,
    loading,
    saving,
    error,
    
    // Actions
    savePremiumPlan,
    updatePlanField,
    addFeature,
    removeFeature,
    togglePlanStatus,
    refreshStats,
    fetchPremiumPlan
  };

  return (
    <PremiumPlanContext.Provider value={value}>
      {children}
    </PremiumPlanContext.Provider>
  );
}

export function usePremiumPlan() {
  const context = useContext(PremiumPlanContext);
  if (!context) {
    throw new Error('usePremiumPlan must be used within a PremiumPlanProvider');
  }
  return context;
}
