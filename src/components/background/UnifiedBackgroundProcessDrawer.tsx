'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useBackgroundPostCreation } from '@/providers/BackgroundPostCreationProvider';
import { useBackgroundProfileEdit } from '@/providers/BackgroundProfileEditProvider';
import { useBackgroundPriceCheck } from '@/providers/BackgroundPriceCheckProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import logger from '@/utils/logger';
import styles from '@/styles/UnifiedBackgroundProcessDrawer.module.css';
import { getCombinedPriceCheckHistory } from '@/utils/priceCheckHistory';
import PriceCheckResultsDialog from '@/components/dialogs/PriceCheckResultsDialog';

// Augment window type for optional showNotification helper used in the client
declare global {
  interface Window {
    showNotification?: (message: string, type: string) => void;
  }
}

interface TelegramDetails {
  channel?: string;
  messageType?: string;
  postId?: string;
  messageLength?: number;
}

interface CheckPostsDetails {
  checkType?: string;
  postsFound?: number;
  issuesFound?: number;
  timeRange?: string;
}

interface Process {
  id: string;
  type: 'post' | 'profile' | 'price-check' | 'telegram' | 'check-posts';
  title: string;
  status: string;
  progress: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  icon: string;
  details?: any | TelegramDetails | CheckPostsDetails;
  logs?: string[];
  debugInfo?: any;
}

type TabType = 'processes' | 'subscription' | 'history';
type HistoryTabType = 'processes' | 'posts' | 'activity';

interface HistoricalProcess extends Process {
  completedAt: Date;
  duration: number;
}

export default function UnifiedBackgroundProcessDrawer() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('processes');
  const [activeHistoryTab, setActiveHistoryTab] = useState<HistoryTabType>('posts');
  const [processes, setProcesses] = useState<Process[]>([]);
  const [processHistory, setProcessHistory] = useState<HistoricalProcess[]>([]);
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showPriceCheckDialog, setShowPriceCheckDialog] = useState(false);
  const [selectedPriceCheckData, setSelectedPriceCheckData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historicalPosts, setHistoricalPosts] = useState<any[]>([]);
  const [historicalPriceChecks, setHistoricalPriceChecks] = useState<any[]>([]);
  const [lastHistoryFetch, setLastHistoryFetch] = useState<Record<string, number>>({});
  const [telegramTasks, setTelegramTasks] = useState<Process[]>([]);
  const [manuallyClosedForSession, setManuallyClosedForSession] = useState(false);
  
  // Get subscription data with proper typing
  let subscription: any;
  try {
    subscription = useSubscription();
  } catch (e: unknown) {
    // Subscription provider not available
    subscription = null;
  }
  
  // Get Supabase context with safe fallback
  let user: any = null;
  let supabase: any = null;
  try {
    const supabaseContext = useSupabase();
    user = supabaseContext.user;
    supabase = supabaseContext.supabase;
  } catch (e: unknown) {
    // Supabase provider not available
  }
  
  // Get data from all providers with safe fallbacks
  let postTasks: any[] = [];
  let profileTasks: any[] = [];
  let priceCheckTasks: any[] = [];
  let removePostTask: ((id: string) => void) | undefined;
  let removeProfileTask: ((id: string) => void) | undefined;
  let removePriceTask: ((id: string) => void) | undefined;
  let retryPostTask: ((id: string) => Promise<void>) | undefined;
  let retryProfileTask: ((id: string) => Promise<void>) | undefined;
  let retryPriceTask: ((id: string) => Promise<void>) | undefined;
  let cancelPostTask: ((id: string) => void) | undefined;
  let cancelProfileTask: ((id: string) => void) | undefined;
  let cancelPriceTask: ((id: string) => void) | undefined;
  let submitProfileEdit: ((formData: any, avatarFile?: File, backgroundFile?: File) => Promise<string>) | undefined;

  try {
    const postContext = useBackgroundPostCreation();
    postTasks = postContext?.tasks || [];
    removePostTask = postContext?.removeTask;
    retryPostTask = postContext?.retryTask;
    cancelPostTask = postContext?.cancelTask;
  } catch (e) {
    // Provider not available
  }

  try {
    const profileContext = useBackgroundProfileEdit();
    profileTasks = profileContext?.tasks || [];
    removeProfileTask = profileContext?.removeTask;
    retryProfileTask = profileContext?.retryTask;
    cancelProfileTask = profileContext?.cancelTask;
    submitProfileEdit = profileContext?.submitProfileEdit;
  } catch (e) {
    // Provider not available
  }

  try {
    const priceContext = useBackgroundPriceCheck();
    priceCheckTasks = priceContext?.tasks || [];
    removePriceTask = priceContext?.removeTask;
    retryPriceTask = priceContext?.retryTask;
    cancelPriceTask = priceContext?.cancelTask;
  } catch (e) {
    // Provider not available
  }
  
  // Format duration for history display
  const formatDuration = useCallback((duration: number): string => {
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }, []);
  
  // Helper function to safely convert createdAt to Date - memoized to prevent re-renders
  const ensureDate = useCallback((dateValue: any): Date => {
    return dateValue instanceof Date ? dateValue : new Date(dateValue);
  }, []);
  
  // Local storage helpers
  const getFromLocalStorage = useCallback((key: string) => {
    if (typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem(`drawer_${key}`);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn(`Failed to read from localStorage: ${key}`, error);
      return null;
    }
  }, []);
  
  const saveToLocalStorage = useCallback((key: string, data: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`drawer_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn(`Failed to save to localStorage: ${key}`, error);
    }
  }, []);
  
  const isDataFresh = useCallback((key: string, maxAge: number = 60000) => { // 1 minute default
    const stored = getFromLocalStorage(key);
    if (!stored || !stored.timestamp) return false;
    return Date.now() - stored.timestamp < maxAge;
  }, [getFromLocalStorage]);
  
  // Debug error logger
  const logDebugError = useCallback((source: string, error: any, context?: any) => {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      source,
      error: error?.message || error,
      stack: error?.stack,
      user_id: user?.id,
      context,
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
    };
    console.error(`🚨 [DEBUG] ${source}:`, errorInfo);
    
    // Store for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('drawer_debug_errors') || '[]');
      errors.unshift(errorInfo);
      localStorage.setItem('drawer_debug_errors', JSON.stringify(errors.slice(0, 10)));
    } catch (e) {}
  }, [user?.id]);
  
  // Fetch historical posts from Supabase
  const fetchHistoricalPosts = useCallback(async () => {
    if (!user || historyLoading) return;
    
    const cacheKey = `historical_posts_${user.id}`;
    
    // Check cache first
    if (isDataFresh(cacheKey)) {
      const cached = getFromLocalStorage(cacheKey);
      if (cached?.data) {
        setHistoricalPosts(cached.data);
        console.log(`[Drawer] 📦 Loaded ${cached.data.length} historical posts from cache`);
        return;
      }
    }
    
    setHistoryLoading(true);
    try {
      console.log('[Drawer] 🔄 Fetching historical posts from Supabase...');
      
      // Get posts from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Try different possible table names for posts
      let posts: any[] = [];
      let postsError: any = null;
      
      const possiblePostTables = [
        'posts_with_stats',
        'posts',
        'user_posts'
      ];
      
      for (const tableName of possiblePostTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select(`*`)
            .eq('user_id', user.id)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(50);
            
          if (!error && data) {
            posts = data;
            console.log(`[Drawer] ✅ Found posts in table: ${tableName}`);
            break;
          }
        } catch (tableError) {
          postsError = tableError;
          continue;
        }
      }
      
      if (!posts.length && postsError) {
        throw postsError;
      }
      
      const processedPosts = (posts || []).map((post: any) => ({
        ...post,
        type: 'post',
        icon: '📝',
        created_at: new Date(post.created_at)
      }));
      
      setHistoricalPosts(processedPosts);
      saveToLocalStorage(cacheKey, processedPosts);
      setLastHistoryFetch(prev => ({ ...prev, posts: Date.now() }));
      
      console.log(`[Drawer] ✅ Fetched ${processedPosts.length} historical posts`);
      
    } catch (error) {
      console.error('[Drawer] ❌ Failed to fetch historical posts:', error);
      logDebugError('fetchHistoricalPosts', error, { 
        user_id: user?.id, 
        cacheKey,
        timestamp: new Date().toISOString(),
        supabaseConnected: !!supabase
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [user, historyLoading, isDataFresh, getFromLocalStorage, saveToLocalStorage, supabase, logDebugError]);
  
  // Fetch historical activity using the price-check-history API for better grouping
  const fetchHistoricalActivity = useCallback(async () => {
    if (!user || historyLoading) return;
    
    const cacheKey = `historical_activity_${user.id}`;
    
    // Check cache first
    if (isDataFresh(cacheKey)) {
      const cached = getFromLocalStorage(cacheKey);
      if (cached?.data) {
        setHistoricalPriceChecks(cached.data);
        console.log(`[Drawer] 📦 Loaded ${cached.data.length} historical activities from cache`);
        return;
      }
    }
    
    setHistoryLoading(true);
    try {
      console.log('[Drawer] 🔄 Fetching historical activity from price-check-history API...');
      
      // Use the price-check-history API for better grouped data
      const apiResponse = await fetch(`/api/price-check-history?userId=${user.id}&days=30`);
      let activities: any[] = [];
      
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        if (apiData.success && apiData.activities) {
          // Transform API data to our format
          activities = apiData.activities.map((activity: any) => ({
            ...activity,
            created_at: new Date(activity.timestamp),
            icon: activity.type === 'price-check' ? '📈' : 
                  activity.type === 'closed-post' ? '🔒' : '📊'
          }));
          
          console.log(`[Drawer] ✅ Loaded ${activities.length} activities from API`);
        }
      }
      
      // If API didn't return data, fall back to direct queries
      if (activities.length === 0) {
        console.log('[Drawer] 🔄 API returned no data, falling back to direct Supabase queries...');
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      try {
        // 1. Get post actions history with full post data
        const { data: postActions } = await supabase
          .from('post_actions')
          .select(`
            id,
            action_type,
            created_at,
            posts!inner(
              id,
              symbol,
              company_name,
              current_price,
              target_price,
              stop_loss_price,
              exchange,
              country,
              target_reached,
              stop_loss_triggered,
              last_price_check,
              status,
              closed_date,
              price_checks
            )
          `)
          .eq('user_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (postActions) {
          activities.push(...postActions.map((action: any) => ({
            id: `action-${action.id}`,
            type: 'action',
            action_type: action.action_type,
            symbol: action.posts?.symbol || 'Unknown',
            company_name: action.posts?.company_name || 'Unknown Company',
            current_price: action.posts?.current_price,
            target_price: action.posts?.target_price,
            stop_loss_price: action.posts?.stop_loss_price,
            exchange: action.posts?.exchange,
            country: action.posts?.country,
            target_reached: action.posts?.target_reached,
            stop_loss_triggered: action.posts?.stop_loss_triggered,
            last_price_check: action.posts?.last_price_check,
            post_status: action.posts?.status,
            closed_date: action.posts?.closed_date,
            price_checks: action.posts?.price_checks,
            created_at: action.created_at,
            icon: action.action_type === 'buy' ? '💰' : action.action_type === 'sell' ? '📈' : '👁️',
            title: `${action.action_type?.toUpperCase()} - ${action.posts?.symbol || 'Unknown'}`
          })));
        }
      } catch (error) {
        console.warn('[Drawer] Could not fetch post actions:', error);
      }
      
      try {
        // 2. Get comments history with full post data
        const { data: comments } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            updated_at,
            is_edited,
            posts!inner(
              id,
              symbol,
              company_name,
              current_price,
              target_price,
              stop_loss_price,
              exchange,
              country,
              target_reached,
              stop_loss_triggered,
              last_price_check,
              status,
              closed_date,
              price_checks
            )
          `)
          .eq('user_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(15);
          
        if (comments) {
          activities.push(...comments.map((comment: any) => ({
            id: `comment-${comment.id}`,
            type: 'comment',
            content: comment.content?.substring(0, 50) + (comment.content?.length > 50 ? '...' : ''),
            full_content: comment.content,
            is_edited: comment.is_edited,
            updated_at: comment.updated_at,
            symbol: comment.posts?.symbol || 'Unknown',
            company_name: comment.posts?.company_name || 'Unknown Company',
            current_price: comment.posts?.current_price,
            target_price: comment.posts?.target_price,
            stop_loss_price: comment.posts?.stop_loss_price,
            exchange: comment.posts?.exchange,
            country: comment.posts?.country,
            target_reached: comment.posts?.target_reached,
            stop_loss_triggered: comment.posts?.stop_loss_triggered,
            last_price_check: comment.posts?.last_price_check,
            post_status: comment.posts?.status,
            closed_date: comment.posts?.closed_date,
            price_checks: comment.posts?.price_checks,
            created_at: comment.created_at,
            icon: '💬',
            title: `Comment on ${comment.posts?.symbol || 'Unknown'}`
          })));
        }
      } catch (error) {
        console.warn('[Drawer] Could not fetch comments:', error);
      }
      
      try {
        // 3. Get closed/completed posts with full data
        const { data: closedPosts } = await supabase
          .from('posts_with_stats')
          .select(`
            id,
            symbol,
            company_name,
            current_price,
            target_price,
            stop_loss_price,
            exchange,
            country,
            target_reached,
            stop_loss_triggered,
            last_price_check,
            closed,
            closed_date,
            price_checks,
            buy_count,
            sell_count,
            comment_count,
            initial_price,
            high_price,
            target_high_price,
            target_hit_time,
            postDateAfterPriceDate,
            postAfterMarketClose,
            noDataAvailable,
            status_message
          `)
          .eq('user_id', user.id)
          .eq('closed', true)
          .gte('closed_date', thirtyDaysAgo.toISOString())
          .order('closed_date', { ascending: false })
          .limit(10);
          
        if (closedPosts) {
          activities.push(...closedPosts.map((post: any) => ({
            id: `closed-post-${post.id}`,
            type: 'closed-post',
            symbol: post.symbol,
            company_name: post.company_name,
            current_price: post.current_price,
            target_price: post.target_price,
            stop_loss_price: post.stop_loss_price,
            exchange: post.exchange,
            country: post.country,
            target_reached: post.target_reached,
            stop_loss_triggered: post.stop_loss_triggered,
            last_price_check: post.last_price_check,
            post_status: post.closed ? 'closed' : 'active',
            closed_date: post.closed_date,
            price_checks: post.price_checks,
            buy_count: post.buy_count,
            sell_count: post.sell_count,  
            comment_count: post.comment_count,
            initial_price: post.initial_price,
            high_price: post.high_price,
            target_high_price: post.target_high_price,
            target_hit_time: post.target_hit_time,
            postDateAfterPriceDate: post.postDateAfterPriceDate,
            postAfterMarketClose: post.postAfterMarketClose,
            noDataAvailable: post.noDataAvailable,
            status_message: post.status_message,
            created_at: post.closed_date,
            icon: post.target_reached ? '🎯' : post.stop_loss_triggered ? '🛑' : '📋',
            title: `Closed: ${post.symbol} - ${post.target_reached ? 'Target Hit' : post.stop_loss_triggered ? 'Stop Loss' : 'Manual Close'}`
          })));
        }
      } catch (error) {
        console.warn('[Drawer] Could not fetch closed posts:', error);
      }

      try {
        // 4. Get price check history from posts with recent price updates
        const { data: priceUpdates } = await supabase
          .from('posts_with_stats')
          .select(`
            id,
            symbol,
            company_name,
            current_price,
            target_price,
            stop_loss_price,
            exchange,
            country,
            target_reached,
            stop_loss_triggered,
            last_price_check,
            closed,
            closed_date,
            price_checks,
            buy_count,
            sell_count,
            comment_count,
            initial_price,
            high_price,
            status_message,
            postDateAfterPriceDate,
            postAfterMarketClose,
            noDataAvailable
          `)
          .eq('user_id', user.id)
          .not('last_price_check', 'is', null)
          .gte('last_price_check', thirtyDaysAgo.toISOString())
          .order('last_price_check', { ascending: false })
          .limit(15);
          
        if (priceUpdates) {
          activities.push(...priceUpdates.map((post: any) => ({
            id: `price-check-${post.id}`,
            type: 'price-check',
            symbol: post.symbol,
            company_name: post.company_name,
            current_price: post.current_price,
            target_price: post.target_price,
            stop_loss_price: post.stop_loss_price,
            exchange: post.exchange,
            country: post.country,
            target_reached: post.target_reached,
            stop_loss_triggered: post.stop_loss_triggered,
            last_price_check: post.last_price_check,
            post_status: post.closed ? 'closed' : 'active',
            closed_date: post.closed_date,
            price_checks: post.price_checks,
            buy_count: post.buy_count,
            sell_count: post.sell_count,
            comment_count: post.comment_count,
            initial_price: post.initial_price,
            high_price: post.high_price,
            status_message: post.status_message,
            postDateAfterPriceDate: post.postDateAfterPriceDate,
            postAfterMarketClose: post.postAfterMarketClose,
            noDataAvailable: post.noDataAvailable,
            created_at: post.last_price_check,
            icon: '💹',
            title: `Price Check: ${post.symbol} - ${post.status_message || 'Updated'}`
          })));
        }
      } catch (error) {
        console.warn('[Drawer] Could not fetch price updates:', error);
      }
      
      } // End of fallback queries
      
      // Sort all activities by date
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const processedActivities = activities.map((activity: any) => ({
        ...activity,
        created_at: new Date(activity.created_at || activity.timestamp)
      }));
      
      setHistoricalPriceChecks(processedActivities);
      saveToLocalStorage(cacheKey, processedActivities);
      setLastHistoryFetch(prev => ({ ...prev, activity: Date.now() }));
      
      console.log(`[Drawer] ✅ Processed ${processedActivities.length} historical activities (${processedActivities.filter(a => a.type === 'price-check').length} price checks)`);
      
    } catch (error) {
      console.error('[Drawer] ❌ Failed to fetch historical activity:', error);
      logDebugError('fetchHistoricalActivity', error, {
        user_id: user?.id,
        cacheKey,
        timestamp: new Date().toISOString(),
        supabaseConnected: !!supabase,
        apiUsed: true,
        fallbackAttempted: true
      });
      setHistoricalPriceChecks([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user, historyLoading, isDataFresh, getFromLocalStorage, saveToLocalStorage, supabase, logDebugError]);
  
  // Enhanced fetch for price check history with Telegram support
  const fetchEnhancedPriceCheckHistory = useCallback(async () => {
    if (!user || historyLoading) return;
    
    const cacheKey = `enhanced_price_check_history_${user.id}`;
    
    // Check cache first
    if (isDataFresh(cacheKey)) {
      const cached = getFromLocalStorage(cacheKey);
      if (cached?.data) {
        setHistoricalPriceChecks(cached.data);
        console.log(`[Drawer] 📦 Loaded ${cached.data.length} enhanced price check entries from cache`);
        return;
      }
    }
    
    setHistoryLoading(true);
    try {
      console.log('[Drawer] 🔄 Fetching enhanced price check history...');
      
      // Get combined history from localStorage + Supabase
      const combinedHistory = await getCombinedPriceCheckHistory(user.id);
      
      // Transform for display with Telegram support
      const enhancedEntries = combinedHistory.map((entry: any) => ({
        ...entry,
        created_at: new Date(entry.timestamp),
        canSendTelegram: entry.posts ? entry.posts.some((p: any) => 
          p.target_reached || p.stop_loss_triggered
        ) : false,
        telegramEligiblePosts: entry.posts ? entry.posts.filter((p: any) => 
          p.target_reached || p.stop_loss_triggered
        ).length : 0
      }));
      
      setHistoricalPriceChecks(enhancedEntries);
      saveToLocalStorage(cacheKey, enhancedEntries);
      setLastHistoryFetch(prev => ({ ...prev, activity: Date.now() }));
      
      console.log(`[Drawer] ✅ Enhanced price check history: ${enhancedEntries.length} entries, ${enhancedEntries.filter((e: any) => e.canSendTelegram).length} eligible for Telegram`);
      
    } catch (error) {
      console.error('[Drawer] ❌ Failed to fetch enhanced price check history:', error);
      logDebugError('fetchEnhancedPriceCheckHistory', error, {
        user_id: user?.id,
        cacheKey,
        timestamp: new Date().toISOString()
      });
      setHistoricalPriceChecks([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user, historyLoading, isDataFresh, getFromLocalStorage, saveToLocalStorage, logDebugError]);
  
  // Determine if an activity.type represents a price check, supporting multiple naming styles
  const isPriceCheckType = useCallback((t: any) => {
    const type = String(t || '').toLowerCase();
    return type === 'price-check' || type === 'price_check' || type === 'price_check_group' || type === 'price_check_result' || type === 'pricecheck';
  }, []);
  
  // Handle clicking on historical price check task
  const handlePriceCheckTaskClick = useCallback((activity: any) => {
    if (!activity || !isPriceCheckType(activity.type)) return;
    
    console.log('[Drawer] 🔍 Opening price check dialog for activity:', activity);
    
    // Results may come as `posts` (snake_case) from Supabase or `results` (camelCase) from local history
    const resultsFromPosts = Array.isArray(activity.posts) ? activity.posts.map((post: any) => ({
      id: post.id,
      symbol: post.symbol,
      companyName: post.company_name,
      currentPrice: post.current_price,
      targetPrice: post.target_price,
      stopLossPrice: post.stop_loss_price,
      targetReached: post.target_reached,
      stopLossTriggered: post.stop_loss_triggered,
      closed: post.closed || post.post_status === 'closed',
      message: post.status_message,
      noDataAvailable: post.noDataAvailable,
      postAfterMarketClose: post.postAfterMarketClose,
      exchange: post.exchange,
      country: post.country
    })) : [];

    const resultsFromResults = Array.isArray(activity.results) ? activity.results.map((r: any) => ({
      id: r.id,
      symbol: r.symbol,
      companyName: r.companyName,
      currentPrice: r.currentPrice,
      targetPrice: r.targetPrice,
      stopLossPrice: r.stopLossPrice,
      targetReached: r.targetReached,
      stopLossTriggered: r.stopLossTriggered,
      closed: r.closed,
      message: r.message,
      noDataAvailable: r.noDataAvailable,
      postAfterMarketClose: r.postAfterMarketClose,
      exchange: r.exchange,
      country: r.country
    })) : [];

    const results = resultsFromResults.length > 0 ? resultsFromResults : resultsFromPosts;
    
    // Build stats with robust fallbacks (prefer summary if present)
    const summary = activity.summary || {};
    const checksCount = summary.checkedPosts ?? activity.checkedPosts ?? results.length;
    const updatedCount = summary.updatedPosts ?? activity.updatedPosts ?? results.filter((r: any) => r.targetReached || r.stopLossTriggered).length;
    const usageCount = summary.usageCount ?? activity.usageCount ?? (subscription?.getUsageInfo?.()?.priceChecksToday || 0);
    const remainingChecks = summary.remainingChecks ?? activity.remainingChecks ?? subscription?.getUsageInfo?.()?.remainingPriceChecks;

    const stats = {
      checkedPosts: checksCount,
      updatedPosts: updatedCount,
      targetReached: results.filter((r: any) => r.targetReached).length,
      stopLossTriggered: results.filter((r: any) => r.stopLossTriggered).length,
      usageCount,
      remainingChecks
    };
    
    setSelectedPriceCheckData({ results, stats });
    setShowPriceCheckDialog(true);
  }, [subscription, isPriceCheckType]);
  
  // Enhanced Send historical Telegram notifications for all activity types
  const handleSendHistoricalTelegram = useCallback(async (activity: any, existingTaskId?: string) => {
    if (!activity || !user) return;
    
    // Create or reuse a telegram process
    const id = existingTaskId || `telegram-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const startedAt = new Date();
    const baseTask: Process = {
      id,
      type: 'telegram',
      title: 'Sending Telegram Notification',
      status: 'pending',
      progress: 5,
      createdAt: startedAt,
      icon: '📱',
      details: {
        messageType: activity.type,
        postId: activity.id
      },
      logs: [
        `Preparing payload at ${startedAt.toLocaleTimeString()}`
      ],
      debugInfo: {
        activity
      }
    };

    if (!existingTaskId) {
      setTelegramTasks(prev => [baseTask, ...prev]);
    } else {
      setTelegramTasks(prev => prev.map(p => p.id === id ? baseTask : p));
    }

    try {
      console.log(`[Drawer] 📢 Sending Telegram notification for activity: ${activity.id} (${activity.type})`);
      setTelegramTasks(prev => prev.map(p => p.id === id ? { ...p, status: 'sending', progress: 25, logs: [...(p.logs||[]), 'Formatting message...'] } : p));
      
      // Create a standardized notification payload based on activity type
      let notificationData: any = {
        id: activity.id,
        type: activity.type,
        symbol: activity.symbol,
        company_name: activity.company_name,
        current_price: activity.current_price,
        target_price: activity.target_price,
        stop_loss_price: activity.stop_loss_price,
        target_reached: activity.target_reached,
        stop_loss_triggered: activity.stop_loss_triggered,
        timestamp: activity.created_at,
        user_id: user.id
      };
      
      // Add type-specific data
      switch (activity.type) {
        case 'action':
          notificationData.action_type = activity.action_type;
          notificationData.message = `${activity.action_type?.toUpperCase()} signal for ${activity.symbol}`;
          break;
        case 'comment':
          notificationData.content = activity.full_content || activity.content;
          notificationData.message = `New comment on ${activity.symbol}: ${activity.content}`;
          break;
        case 'closed-post':
          notificationData.message = `Position closed for ${activity.symbol} - ${activity.target_reached ? 'Target Hit 🎯' : activity.stop_loss_triggered ? 'Stop Loss 🛑' : 'Manual Close 📋'}`;
          break;
        case 'price-check':
          notificationData.message = `Price update for ${activity.symbol}: $${activity.current_price}`;
          notificationData.status_message = activity.status_message;
          break;
        default:
          if (activity.posts) {
            notificationData.posts = activity.posts;
          }
          notificationData.message = `Price check results for ${activity.posts?.length || 1} positions`;
      }

      // Acquire Supabase access token for Authorization header
      let authHeader: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const sessionRes = await supabase?.auth?.getSession?.();
        const token = sessionRes?.data?.session?.access_token;
        if (token) {
          authHeader = { ...authHeader, Authorization: `Bearer ${token}` };
        }
      } catch {}
      
      setTelegramTasks(prev => prev.map(p => p.id === id ? { ...p, progress: 50, logs: [...(p.logs||[]), 'Calling API...'] } : p));

      // Call the Telegram notification API
      const response = await fetch('/api/telegram/send-historical', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(notificationData)
      });
      
      const result: any = await response.json();
      
      if (result.success) {
        setTelegramTasks(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', progress: 100, logs: [...(p.logs||[]), `Sent. telegram_message_id=${result.telegram_message_id}`] } : p));
        if (typeof window !== 'undefined' && window.showNotification) {
          window.showNotification(
            `✅ Sent Telegram notification for ${activity.symbol || 'activity'}`, 
            'success'
          );
        }
        console.log(`[Drawer] ✅ Telegram notification sent for ${activity.type}: ${activity.symbol}`);
      } else {
        throw new Error(result.error || 'Failed to send notification');
      }
      
    } catch (error: any) {
      console.error('[Drawer] ❌ Failed to send Telegram notification:', error);
      setTelegramTasks(prev => prev.map(p => p.id === id ? { ...p, status: 'failed', error: error?.message || 'Failed to send', progress: 100, logs: [...(p.logs||[]), `Error: ${error?.message}`] } : p));
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(
          `❌ Failed to send Telegram notification: ${error.message}`, 
          'error'
        );
      }
    }
  }, [user, supabase]);
  
  // Debug tests removed
  
  // Removed console exposure and auto help logs

  // Combine all tasks into unified format
  useEffect(() => {
    const unifiedProcesses: Process[] = [];
    
    // Add post creation tasks
    postTasks.forEach(task => {
      unifiedProcesses.push({
        id: `post-${task.id}`,
        type: 'post',
        title: 'Creating Post',
        status: task.status,
        progress: task.progress,
        error: task.error,
        createdAt: task.createdAt,
        icon: '📝',
        details: {
          content: task.title || 'Creating post...',
          hasImage: !!task.imageUrl,
          status: task.status
        },
        logs: task.logs || [`Started creating post at ${new Date().toLocaleTimeString()}`],
        debugInfo: {
          taskId: task.id,
          imageUrl: task.imageUrl,
          formData: task.formData,
          timestamp: task.createdAt
        }
      });
    });

    // Merge locally tracked telegram tasks
    if (telegramTasks.length > 0) {
      unifiedProcesses.push(...telegramTasks);
    }
    
    // Add profile edit tasks
    profileTasks.forEach(task => {
      unifiedProcesses.push({
        id: `profile-${task.id}`,
        type: 'profile',
        title: 'Updating Profile',
        status: task.status,
        progress: task.progress,
        error: task.error,
        createdAt: task.createdAt,
        icon: '👤',
        details: {
          hasAvatar: !!task.avatarFile,
          hasBackground: !!task.backgroundFile,
          formData: task.formData
        },
        logs: task.logs || [`Started profile update at ${new Date().toLocaleTimeString()}`],
        debugInfo: {
          taskId: task.id,
          avatarFile: task.avatarFile ? { name: task.avatarFile.name, size: task.avatarFile.size } : null,
          backgroundFile: task.backgroundFile ? { name: task.backgroundFile.name, size: task.backgroundFile.size } : null,
          formData: task.formData,
          timestamp: task.createdAt
        }
      });
    });
    
    // Add price check tasks
    priceCheckTasks.forEach(task => {
      unifiedProcesses.push({
        id: `price-${task.id}`,
        type: 'price-check',
        title: 'Checking Prices',
        status: task.status,
        progress: task.progress,
        error: task.error,
        createdAt: task.createdAt,
        icon: '💹',
        details: {
          symbol: task.symbol,
          postsCount: task.postsToCheck?.length || 0
        },
        logs: task.logs || [`Started price check for ${task.symbol} at ${new Date().toLocaleTimeString()}`],
        debugInfo: {
          taskId: task.id,
          symbol: task.symbol,
          postsToCheck: task.postsToCheck,
          apiEndpoint: task.apiEndpoint,
          timestamp: task.createdAt
        }
      });
    });
    
    // Deduplicate by id to avoid duplicate key warnings
    const uniqueMap = new Map<string, Process>();
    for (const p of unifiedProcesses) {
      uniqueMap.set(p.id, p);
    }
    const uniqueProcesses = Array.from(uniqueMap.values());
    // Sort by creation date (newest first)
    uniqueProcesses.sort((a, b) => ensureDate(b.createdAt).getTime() - ensureDate(a.createdAt).getTime());
    setProcesses(uniqueProcesses);
  }, [postTasks, profileTasks, priceCheckTasks, telegramTasks, ensureDate]);

  // Auto-opening disabled to prevent floating progress interruption
  // useEffect(() => {
  //   const hasActiveProcesses = processes.some(p => 
  //     ['pending', 'compressing', 'uploading', 'creating', 'processing', 'saving', 'uploading_avatar', 'uploading_background', 'saving_profile', 'checking_prices', 'fetching_posts', 'updating_database'].includes(p.status)
  //   );
  //   
  //   if (hasActiveProcesses && !isOpen && !manuallyClosedForSession) {
  //     setIsOpen(true);
  //     setActiveTab('processes');
  //   }
  // }, [processes, isOpen, manuallyClosedForSession]);

  // Auto-cleanup stuck processes after 1 minute
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 1 * 60 * 1000;
      
      setProcesses(prev => {
        const stuckProcesses = prev.filter(p => {
          const createdTime = ensureDate(p.createdAt).getTime();
          const isStuck = createdTime < oneMinuteAgo && 
            ['pending', 'compressing', 'uploading', 'creating', 'processing', 'saving', 'checking_prices'].includes(p.status);
          
          if (isStuck) {
            const debugInfo = {
              title: p.title,
              type: p.type,
              id: p.id,
              status: p.status,
              createdAt: p.createdAt,
              progress: p.progress,
              error: p.error,
              details: p.details,
              timeAlive: Math.round((now - ensureDate(p.createdAt).getTime()) / 1000) + 's'
            };
            console.log(`🧹 Auto-cleaning stuck process:`, debugInfo);
            logDebugError('auto-cleanup', `Process stuck: ${p.title} (${p.type}) - Status: ${p.status}, Time alive: ${debugInfo.timeAlive}`, debugInfo);
          }
          
          return isStuck;
        });
        
        // Move stuck processes to history
        if (stuckProcesses.length > 0) {
          const stuckHistory: HistoricalProcess[] = stuckProcesses.map(p => ({
            id: p.id,
            type: p.type,
            title: p.title,
            status: 'canceled' as const,
            progress: p.progress || 0,
            icon: p.icon,
            createdAt: ensureDate(p.createdAt),
            completedAt: new Date(),
            duration: now - ensureDate(p.createdAt).getTime(),
            error: `Process timed out after 1 minute - Status: ${p.status}, Progress: ${p.progress}%, Details: ${JSON.stringify(p.details || {})}`
          }));
          
          setProcessHistory(prevHistory => [...stuckHistory, ...prevHistory]);
        }
        
        return prev.filter(p => {
          const createdTime = ensureDate(p.createdAt).getTime();
          return !(createdTime < oneMinuteAgo && 
            ['pending', 'compressing', 'uploading', 'creating', 'processing', 'saving', 'checking_prices'].includes(p.status));
        });
      });
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(cleanup);
  }, [ensureDate]);

  // Automated tests removed

  // Auto tests disabled
  
  // Fetch historical data when history tab becomes active (with debouncing)
  useEffect(() => {
    if (activeTab === 'history' && user) {
      // Prevent multiple rapid calls
      const lastFetch = lastHistoryFetch[activeHistoryTab === 'activity' ? 'activity' : activeHistoryTab];
      const now = Date.now();
      if (lastFetch && now - lastFetch < 10000) { // 10 second cooldown
        console.log(`[Drawer] ⏱️ Skipping fetch for ${activeHistoryTab} - too recent`);
        return;
      }
      
      // Fetch based on active history tab
      switch (activeHistoryTab) {
        case 'posts':
          fetchHistoricalPosts();
          break;
        case 'activity':
          fetchEnhancedPriceCheckHistory();
          break;
        default:
          // 'processes' tab doesn't need external data fetch
          break;
      }
    }
  }, [activeTab, activeHistoryTab, user]);
  
  // Add to process history when processes complete
  useEffect(() => {
    processes.forEach(process => {
      if (['completed', 'success', 'failed', 'error', 'canceled'].includes(process.status)) {
        const existingHistoryItem = processHistory.find(h => h.id === process.id);
        if (!existingHistoryItem) {
          const completedAt = new Date();
          const createdAt = ensureDate(process.createdAt);
          const duration = completedAt.getTime() - createdAt.getTime();
          const historicalProcess: HistoricalProcess = {
            ...process,
            createdAt,
            completedAt,
            duration
          };
          setProcessHistory(prev => [historicalProcess, ...prev.slice(0, 49)]); // Keep last 50
        }
      }
    });
  }, [processes, processHistory]);

  // Define remove process handler with useCallback to prevent unnecessary re-renders
  const handleRemoveProcess = useCallback((processId: string, type: string) => {
    // Extract original task id after the first hyphen to preserve full UUIDs with hyphens
    const hyphenIndex = processId.indexOf('-');
    const taskId = hyphenIndex >= 0 ? processId.substring(hyphenIndex + 1) : processId;
    
    switch (type) {
      case 'post':
        removePostTask?.(taskId);
        break;
      case 'profile':
        removeProfileTask?.(taskId);
        break;
      case 'price-check':
        removePriceTask?.(taskId);
        break;
      case 'telegram':
        setTelegramTasks(prev => prev.filter(p => p.id !== processId));
        break;
    }
  }, [removePostTask, removeProfileTask, removePriceTask, setTelegramTasks]);

  // Auto-remove completed tasks after 8 seconds (increased for better UX)
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    processes.forEach(process => {
      if (['completed', 'success'].includes(process.status)) {
        const timer = setTimeout(() => {
          handleRemoveProcess(process.id, process.type);
        }, 8000);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [processes, handleRemoveProcess]);

  const handleRetryProcess = useCallback(async (processId: string, type: string) => {
    const hyphenIndex = processId.indexOf('-');
    const taskId = hyphenIndex >= 0 ? processId.substring(hyphenIndex + 1) : processId;
    
    switch (type) {
      case 'post':
        await retryPostTask?.(taskId);
        break;
      case 'profile':
        await retryProfileTask?.(taskId);
        break;
      case 'price-check':
        await retryPriceTask?.(taskId);
        break;
      case 'telegram': {
        // Find existing telegram task and resend using stored activity payload
        const existing = telegramTasks.find(t => t.id === processId);
        const activity = existing?.debugInfo?.activity;
        if (activity) {
          await handleSendHistoricalTelegram(activity, processId);
        }
        break;
      }
    }
  }, [retryPostTask, retryProfileTask, retryPriceTask, telegramTasks, handleSendHistoricalTelegram]);

  const handleCancelProcess = useCallback((processId: string, type: string) => {
    // Check if process is already canceled or completed
    const currentProcess = processes.find(p => p.id === processId);
    if (!currentProcess || ['canceled', 'completed', 'failed', 'success', 'error'].includes(currentProcess.status)) {
      console.log(`[Drawer] ⚠️ Process ${processId} is already ${currentProcess?.status || 'not found'}, skipping cancel`);
      return;
    }
    
    const taskId = processId.split('-')[1];
    console.log(`[Drawer] 🚫 Canceling process: ${processId} (type: ${type}, taskId: ${taskId})`);
    
    try {
      switch (type) {
        case 'post':
          if (cancelPostTask) {
            console.log(`[Drawer] 📝 Canceling post task: ${taskId}`);
            cancelPostTask(taskId);
          } else {
            console.warn(`[Drawer] ⚠️ cancelPostTask function not available`);
            // Force cancel by updating process status
            setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status: 'canceled', error: 'User canceled', progress: p.progress ?? 0 } : p));
          }
          break;
        case 'profile':
          if (cancelProfileTask) {
            console.log(`[Drawer] 👤 Canceling profile task: ${taskId}`);
            cancelProfileTask(taskId);
          } else {
            console.warn(`[Drawer] ⚠️ cancelProfileTask function not available`);
            setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status: 'canceled', error: 'User canceled', progress: p.progress ?? 0 } : p));
          }
          break;
        case 'price-check':
          if (cancelPriceTask) {
            console.log(`[Drawer] 💹 Canceling price check task: ${taskId}`);
            cancelPriceTask(taskId);
          } else {
            console.warn(`[Drawer] ⚠️ cancelPriceTask function not available, using fallback`);
            setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status: 'canceled', error: 'User canceled', progress: p.progress ?? 0 } : p));
          }
          break;
        case 'telegram':
          console.log(`[Drawer] 📱 Canceling telegram task: ${processId}`);
          setTelegramTasks(prev => prev.map(p => p.id === processId ? { ...p, status: 'canceled', error: 'User canceled', progress: p.progress ?? 0 } : p));
          break;
        case 'check-posts':
          console.log(`[Drawer] 🔍 Canceling check-posts task: ${processId}`);
          setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status: 'canceled', error: 'User canceled', progress: p.progress ?? 0 } : p));
          break;
        default:
          console.log(`[Drawer] ⚠️ Unknown process type: ${type}, force canceling: ${processId}`);
          // Force cancel by removing from active processes
          setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status: 'canceled', error: 'Unknown process type - User canceled', progress: p.progress ?? 0 } : p));
          break;
      }
      
      // Show success notification
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(`🚫 Process canceled successfully`, 'info');
      }
      
      console.log(`[Drawer] ✅ Successfully canceled process: ${processId}`);
      
    } catch (error) {
      console.error(`[Drawer] ❌ Failed to cancel process ${processId}:`, error);
      logDebugError('handleCancelProcess', error, { processId, type, taskId });
      
      // Fallback: Force update status
      setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status: 'canceled', error: 'Cancel failed, but marked as canceled', progress: p.progress ?? 0 } : p));
      
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(`⚠️ Process canceled with fallback method`, 'warning');
      }
    }
  }, [processes, cancelPostTask, cancelProfileTask, cancelPriceTask, setTelegramTasks, logDebugError]);

  const getStatusText = (status: string, type: string) => {
    // Type-specific status messages
    if (type === 'telegram') {
      const telegramStatusMap: Record<string, string> = {
        'pending': 'Preparing Telegram message...',
        'formatting': 'Formatting message...',
        'sending': 'Sending to Telegram...',
        'success': 'Sent to Telegram ✅',
        'completed': 'Sent to Telegram ✅',
        'error': 'Failed to send to Telegram ❌',
        'failed': 'Failed to send to Telegram ❌',
        'canceled': 'Telegram send canceled ⏹️'
      };
      if (telegramStatusMap[status]) return telegramStatusMap[status];
    }

    if (type === 'check-posts') {
      const checkPostsStatusMap: Record<string, string> = {
        'pending': 'Preparing posts check...',
        'scanning': 'Scanning posts...',
        'analyzing': 'Analyzing data...',
        'generating_report': 'Generating report...',
        'success': 'Posts check completed ✅',
        'completed': 'Posts check completed ✅',
        'error': 'Posts check failed ❌',
        'failed': 'Posts check failed ❌',
        'canceled': 'Posts check canceled ⏹️'
      };
      if (checkPostsStatusMap[status]) return checkPostsStatusMap[status];
    }

    // General status messages
    const statusMap: Record<string, string> = {
      'pending': 'Preparing...',
      'compressing': 'Compressing image...',
      'uploading': 'Uploading content...',
      'creating': 'Creating post...',
      'success': 'Completed successfully ✅',
      'error': 'Failed ❌',
      'canceled': 'Canceled ⏹️',
      'uploading_avatar': 'Uploading avatar...',
      'uploading_background': 'Uploading background...',
      'saving_profile': 'Saving profile...',
      'checking_prices': 'Fetching latest prices...',
      'fetching_posts': 'Loading posts...',
      'updating_database': 'Updating database...',
      'completed': 'Completed successfully ✅',
      'failed': 'Failed ❌'
    };
    
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return '#10b981';
      case 'failed':
      case 'error':
        return '#ef4444';
      case 'canceled':
        return '#f59e0b';
      default:
        return 'hsl(var(--primary))';
    }
  };

  const toggleProcessExpansion = (processId: string) => {
    const newExpanded = new Set(expandedProcesses);
    if (newExpanded.has(processId)) {
      newExpanded.delete(processId);
    } else {
      newExpanded.add(processId);
    }
    setExpandedProcesses(newExpanded);
  };

  const copyLogsToClipboard = async (process: Process) => {
    try {
      const logContent = [
        `=== ${process.title} Debug Log ===`,
        `Process ID: ${process.id}`,
        `Type: ${process.type}`,
        `Status: ${process.status}`,
        `Progress: ${process.progress}%`,
        `Created: ${ensureDate(process.createdAt).toLocaleString()}`,
        '',
        '--- Process Details ---',
        JSON.stringify(process.details, null, 2),
        '',
        '--- Debug Info ---',
        JSON.stringify(process.debugInfo, null, 2),
        '',
        '--- Logs ---',
        ...(process.logs || ['No logs available']),
        '',
        process.error ? `--- Error ---\n${process.error}` : ''
      ].filter(Boolean).join('\n');

      await navigator.clipboard.writeText(logContent);
      
      // Show feedback (you could use a toast here)
      console.log('Logs copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const clearAllProcesses = useCallback(() => {
    processes.forEach(process => {
      handleRemoveProcess(process.id, process.type);
    });
  }, [processes, handleRemoveProcess]);
  
  // Enhanced close function with proper state management
  const handleCloseDrawer = useCallback(() => {
    logger.debug('Closing drawer...', null, 'DRAWER');
    setIsOpen(false);
    // Ensure any child dialogs are closed when drawer closes
    setShowActivityDialog(false);
    setSelectedActivity(null);
    setShowPriceCheckDialog(false);
    setSelectedPriceCheckData(null);
    setManuallyClosedForSession(true);
    // Reset manual close flag after 30 seconds
    setTimeout(() => {
      setManuallyClosedForSession(false);
    }, 30000);
  }, []);
  
  // Force open drawer (can be called anytime)
  const handleForceOpenDrawer = useCallback(() => {
    logger.debug('Force opening drawer...', null, 'DRAWER');
    setIsOpen(true);
    setManuallyClosedForSession(false);
  }, []);

  // Close drawer and any dialogs when navigating between routes
  useEffect(() => {
    // On route change, ensure everything is closed/cleared
    setIsOpen(false);
    setShowActivityDialog(false);
    setSelectedActivity(null);
    setShowPriceCheckDialog(false);
    setSelectedPriceCheckData(null);
  }, [pathname]);

  // Listen for completed background tasks and show results dialog
  const showCompletedTaskResults = useCallback((completedTask: any) => {
    if (completedTask.type === 'price-check' && completedTask.details?.resultsSummary) {
      console.log('[Drawer] 📊 Showing completed price check results:', completedTask);
      
      // Use browser notification or custom notification system
      if (typeof window !== 'undefined' && window.showNotification) {
        const summary = completedTask.details.resultsSummary;
        const message = `✅ Price Check Complete!\n📝 ${summary.postsChecked || 0} posts checked\n✅ ${summary.postsUpdated || 0} posts updated\n🔄 ${summary.remainingChecks || 0} checks remaining`;
        window.showNotification(message, 'success');
      }
    }
  }, []);

  // 🔄 Real-time subscription refresh when processes complete
  useEffect(() => {
    if (!subscription?.refreshSubscription) return;
    
    const hasCompletedPriceCheck = priceCheckTasks.some(task => 
      ['completed', 'success'].includes(task.status)
    );
    
    const hasCompletedPost = postTasks.some(task => 
      ['completed', 'success'].includes(task.status)
    );
    
    if (hasCompletedPriceCheck || hasCompletedPost) {
      console.log('[Drawer] ✅ Process completed, refreshing subscription...');
      subscription.refreshSubscription();
    }
  }, [priceCheckTasks, postTasks, subscription]);

  // 🔄 Listen for plan upgrade events
  useEffect(() => {
    if (!subscription?.refreshSubscription) return;

    const handlePlanChange = () => {
      console.log('[Drawer] 🔄 Plan changed, refreshing subscription...');
      subscription.refreshSubscription();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('subscriptionUpgraded', handlePlanChange);
      window.addEventListener('subscriptionChanged', handlePlanChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('subscriptionUpgraded', handlePlanChange);
        window.removeEventListener('subscriptionChanged', handlePlanChange);
      }
    };
  }, [subscription]);

  // Watch for completed processes
  useEffect(() => {
    const recentlyCompleted = processes.filter(p => 
      p.status === 'completed' && 
      p.type === 'price-check' &&
      p.details?.resultsSummary
    );
    
    if (recentlyCompleted.length > 0) {
      const latestCompleted = recentlyCompleted[recentlyCompleted.length - 1];
      showCompletedTaskResults(latestCompleted);
    }
  }, [processes, showCompletedTaskResults]);

  // Refresh history data based on active tab
  const refreshHistoryData = useCallback(() => {
    // Clear cache for fresh data
    const cacheKeys = [
      `historical_posts_${user?.id}`,
      `historical_activity_${user?.id}`
    ];
    
    cacheKeys.forEach(key => {
      try {
        localStorage.removeItem(`drawer_${key}`);
      } catch (error) {
        console.warn(`Failed to clear cache for ${key}:`, error);
      }
    });

    // Reset last fetch timestamps to force refresh
    setLastHistoryFetch({});
    
    // Fetch based on active tab
    switch (activeHistoryTab) {
      case 'posts':
        fetchHistoricalPosts();
        break;
      case 'activity':
        fetchEnhancedPriceCheckHistory();
        break;
      case 'processes':
        // Background tasks are real-time, no need to fetch
        console.log('[Drawer] 🔄 Background tasks are real-time updated');
        break;
      default:
        console.log(`[Drawer] ⚠️ Unknown history tab: ${activeHistoryTab}`);
        break;
    }
    
    console.log(`[Drawer] 🔄 Refreshing ${activeHistoryTab} data...`);
  }, [activeHistoryTab, user?.id, fetchHistoricalPosts, fetchEnhancedPriceCheckHistory]);

  // Export history data as JSON
  const exportHistoryData = useCallback(() => {
    try {
      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user?.id,
        export_type: 'comprehensive_history',
        data: {
          background_tasks: processHistory.map(task => ({
            ...task,
            // Convert dates to ISO strings for JSON compatibility
            createdAt: task.createdAt?.toISOString?.() || task.createdAt,
            completedAt: task.completedAt?.toISOString?.() || task.completedAt
          })),
          posts: historicalPosts.map(post => ({
            ...post,
            created_at: post.created_at?.toISOString?.() || post.created_at
          })),
          activities: historicalPriceChecks.map(activity => ({
            ...activity,
            created_at: activity.created_at?.toISOString?.() || activity.created_at,
            last_price_check: activity.last_price_check,
            closed_date: activity.closed_date,
            updated_at: activity.updated_at
          }))
        },
        stats: {
          total_background_tasks: processHistory.length,
          total_posts: historicalPosts.length,
          total_activities: historicalPriceChecks.length,
          active_tab: activeHistoryTab
        }
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stockroom_history_${activeHistoryTab}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`[Drawer] 📤 Exported ${activeHistoryTab} history data`);

      // Show success notification
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(`✅ History data exported successfully! Downloaded as JSON file.`, 'success');
      }
      
    } catch (error) {
      console.error('[Drawer] ❌ Failed to export history data:', error);
      logDebugError('exportHistoryData', error, {
        user_id: user?.id,
        active_tab: activeHistoryTab,
        data_counts: {
          background_tasks: processHistory.length,
          posts: historicalPosts.length,
          activities: historicalPriceChecks.length
        }
      });

      // Show error notification
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification('❌ Failed to export history data', 'error');
      }
    }
  }, [activeHistoryTab, processHistory, historicalPosts, historicalPriceChecks, user?.id, logDebugError]);
  
  // Handle clicking on activity to show details
  const handleActivityClick = useCallback((activity: any) => {
    console.log('[Drawer] 🔍 Activity clicked:', activity.type, activity);
    
    // Handle price-check activities with specialized dialog (supports multiple type variants)
    if (isPriceCheckType(activity.type)) {
      handlePriceCheckTaskClick(activity);
      return;
    }
    
    // Handle other activity types with general dialog
    setSelectedActivity(activity);
    setShowActivityDialog(true);
  }, [handlePriceCheckTaskClick, isPriceCheckType]);
  
  // Handle closing activity dialog
  const handleCloseActivityDialog = useCallback(() => {
    setShowActivityDialog(false);
    setSelectedActivity(null);
  }, []);
  
  // Don't show drawer if user is not logged in
  if (!user) {
    return null;
  }
  
  // Get tab icon
  const getTabIcon = (tab: TabType): string => {
    switch (tab) {
      case 'processes': return '⚙️';
      case 'subscription': return '💎';
      case 'history': return '📊';
      default: return '📋';
    }
  };

  // Get tab label
  const getTabLabel = (tab: TabType): string => {
    switch (tab) {
      case 'processes': return 'Processes';
      case 'subscription': return 'Subscription';
      case 'history': return 'History';
      default: return tab;
    }
  };
  
  // Always show toggle button (even with no processes) 
  const activeProcessCount = processes.filter(p => !['completed', 'failed', 'success', 'error', 'canceled'].includes(p.status)).length;
  
  // Force drawer to be visible for debugging
  const shouldShowDrawer = true; // Always show for debugging
  
  // Drawer starts closed by default
  // Removed auto-open debug code
  
  // Add telegram and check-posts process types
  const getProcessTypeIcon = (type: string) => {
    switch (type) {
      case 'post': return '📝';
      case 'profile': return '👤';  
      case 'price-check': return '💹';
      case 'telegram': return '📱';
      case 'check-posts': return '🔍';
      default: return '⚙️';
    }
  };

  return (
    <>
      {/* Modern Drawer Toggle Button - Theme-aware */}
      <button 
        className={`${styles.modernToggle} ${isOpen ? styles.toggleOpen : ''}`}
        onClick={isOpen ? handleCloseDrawer : handleForceOpenDrawer}
        aria-label="Background Processes"
        title={isOpen ? 'Close Panel' : 'Open Process Panel'}
      >
        <div className={styles.toggleContent}>
          <span className={styles.toggleIcon}>
            {isOpen ? '→' : '←'}
          </span>
          <div className={styles.toggleLabels}>
            <span className={styles.toggleLabel}>⚙️</span>
            <span className={styles.toggleLabel}>💎</span>
            <span className={styles.toggleLabel}>📊</span>
          </div>
          {activeProcessCount > 0 && (
            <span className={styles.toggleBadge}>{activeProcessCount}</span>
          )}
        </div>
      </button>
      
      {/* Drawer Overlay */}
      {isOpen && (
        <div 
          className={styles.overlay} 
          onClick={handleCloseDrawer}
        />
      )}

      {/* Drawer Content */}
      <div 
        className={`${styles.drawer} ${isOpen ? styles.open : ''} ${activeTab === 'history' ? styles.historyActive : ''}`}
      >
        {/* Modern Horizontal Tabs */}
        <div className={styles.modernTabs}>
          <div className={styles.tabsWrapper}>
            {(['processes', 'subscription', 'history'] as TabType[]).map(tab => (
              <button
                key={tab}
                className={`${styles.modernTabButton} ${activeTab === tab ? styles.activeTab : ''}`}
                onClick={() => setActiveTab(tab)}
                aria-label={getTabLabel(tab)}
              >
                <span className={styles.tabIconWrapper}>
                  <span className={styles.tabIcon}>{getTabIcon(tab)}</span>
                </span>
                <span className={styles.tabLabel}>
                  {getTabLabel(tab)}
                </span>
                {tab === 'processes' && activeProcessCount > 0 && (
                  <span className={styles.modernBadge}>{activeProcessCount}</span>
                )}
                {tab === 'history' && processHistory.length > 0 && (
                  <span className={styles.modernBadge}>{processHistory.length}</span>
                )}
              </button>
            ))}
            <div 
              className={styles.tabIndicator}
              style={{
                transform: `translateX(${
                  activeTab === 'processes' ? '0%' :
                  activeTab === 'subscription' ? '100%' :
                  '200%'
                })`
              }}
            />
          </div>
        </div>
        
        {/* Content Area */}
        <div className={styles.contentArea}>
          {/* Modern Header for current tab */}
          <div className={styles.contentHeader}>
            <h3 className={styles.contentTitle}>
              {activeTab === 'processes' ? 'Background Processes' :
               activeTab === 'subscription' ? 'Subscription Details' :
               'Process History'}
              {activeTab === 'processes' && processes.length > 0 && (
                <span className={styles.processCount}>{processes.length}</span>
              )}
            </h3>
            
            <div className={styles.headerActions}>
              {activeTab === 'processes' && (
                <>
                  <button 
                    className={styles.clearAllButton}
                    onClick={clearAllProcesses}
                    title="Clear all processes"
                  >
                    🗑️
                  </button>
                </>
              )}
              <button 
                className={styles.closeButton}
                onClick={handleCloseDrawer}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {activeTab === 'processes' && (
              <div className={styles.processesTab}>
                {processes.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>✨</span>
                    <p>No background processes running</p>
                    <button 
                      className={styles.viewHistoryButton}
                      onClick={() => setActiveTab('history')}
                    >
                      📊 View Process History
                    </button>
                  </div>
                ) : (
                  <div className={styles.processList}>
                    {processes.map((process) => (
                <div 
                  key={process.id} 
                  className={`${styles.processCard} ${
                    ['completed', 'success'].includes(process.status) ? styles.completed :
                    ['failed', 'error'].includes(process.status) ? styles.failed :
                    process.status === 'canceled' ? styles.canceled :
                    styles.active
                  }`}
                >
                  <div className={styles.processHeader}>
                    <div className={styles.processInfo}>
                      <span className={styles.processIcon}>{process.icon}</span>
                      <div className={styles.processDetails}>
                        <h4 className={styles.processTitle}>{process.title}</h4>
                        <p className={styles.processStatus}>
                          {getStatusText(process.status, process.type)}
                        </p>
                      </div>
                    </div>
                    
                    <div className={styles.processActions}>
                      <button 
                        className={`${styles.expandButton} ${expandedProcesses.has(process.id) ? styles.expanded : ''}`}
                        onClick={() => toggleProcessExpansion(process.id)}
                        title="Toggle details"
                        aria-label="Toggle details"
                      >
                        {expandedProcesses.has(process.id) ? '📄' : '📋'}
                      </button>
                      
                      {['failed', 'error'].includes(process.status) && (
                        <button 
                          className={styles.retryButton}
                          onClick={() => handleRetryProcess(process.id, process.type)}
                          aria-label="Retry"
                        >
                          🔄
                        </button>
                      )}
                      <button 
                        className={styles.removeButton}
                        onClick={() => {
                          // If process is running, cancel it. Otherwise, remove it.
                          if (!['completed', 'failed', 'success', 'error', 'canceled'].includes(process.status)) {
                            handleCancelProcess(process.id, process.type);
                          } else {
                            handleRemoveProcess(process.id, process.type);
                          }
                        }}
                        title={
                          !['completed', 'failed', 'success', 'error', 'canceled'].includes(process.status) 
                            ? "Cancel this process" 
                            : "Remove from list"
                        }
                        aria-label={
                          !['completed', 'failed', 'success', 'error', 'canceled'].includes(process.status) 
                            ? "Cancel process" 
                            : "Remove process"
                        }
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {!['completed', 'failed', 'success', 'error', 'canceled'].includes(process.status) && (
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill}
                          style={{ 
                            width: `${process.progress}%`,
                            backgroundColor: getStatusColor(process.status)
                          }}
                        />
                      </div>
                      <span className={styles.progressText}>
                        {Math.round(process.progress)}%
                      </span>
                    </div>
                  )}

                  {/* Process Details */}
                  <div className={styles.processDetailsContent}>
                    {process.type === 'post' && process.details && (
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailItem}>
                          📄 Content: {process.details.content}
                        </div>
                        {process.details.hasImage && (
                          <div className={styles.detailItem}>🖼️ Has Image</div>
                        )}
                        {process.details.hasStock && (
                          <div className={styles.detailItem}>📈 Has Stock Data</div>
                        )}
                      </div>
                    )}

                    {process.type === 'profile' && process.details && (
                      <div className={styles.detailsGrid}>
                        {process.details.hasAvatar && (
                          <div className={styles.detailItem}>🖼️ Updating Avatar</div>
                        )}
                        {process.details.hasBackground && (
                          <div className={styles.detailItem}>🎨 Updating Background</div>
                        )}
                        <div className={styles.detailItem}>
                          ✏️ Profile Data: {Object.keys(process.details.formData || {}).length} fields
                        </div>
                      </div>
                    )}

                    {process.type === 'price-check' && (
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailItem}>
                          📈 Symbol: {process.details?.symbol || 'Multiple'}
                        </div>
                        <div className={styles.detailItem}>
                          📝 Posts Checked: {process.details?.resultsSummary?.postsChecked || process.details?.checkedPosts || process.details?.totalPosts || 0}
                        </div>
                        <div className={styles.detailItem}>
                          ✅ Posts Updated: {process.details?.resultsSummary?.postsUpdated || process.details?.updatedPosts || 0}
                        </div>
                        {(process.details?.remainingChecks !== undefined || process.details?.resultsSummary?.remainingChecks !== undefined) && (
                          <div className={styles.detailItem}>
                            🔄 Checks Remaining: {process.details?.resultsSummary?.remainingChecks || process.details?.remainingChecks}
                          </div>
                        )}
                      </div>
                    )}

                    {process.type === 'telegram' && process.details && (
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailItem}>
                          📱 Channel: {process.details.channel || 'N/A'}
                        </div>
                        <div className={styles.detailItem}>
                          📝 Message Type: {process.details.messageType || 'Post'}
                        </div>
                        {process.details.postId && (
                          <div className={styles.detailItem}>
                            🔗 Post ID: {process.details.postId}
                          </div>
                        )}
                        {process.details.messageLength && (
                          <div className={styles.detailItem}>
                            📊 Message Length: {process.details.messageLength} chars
                          </div>
                        )}
                      </div>
                    )}

                    {process.type === 'check-posts' && process.details && (
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailItem}>
                          🔍 Check Type: {process.details.checkType || 'General'}
                        </div>
                        <div className={styles.detailItem}>
                          📝 Posts Found: {process.details.postsFound || 0}
                        </div>
                        <div className={styles.detailItem}>
                          ⚠️ Issues Found: {process.details.issuesFound || 0}
                        </div>
                        {process.details.timeRange && (
                          <div className={styles.detailItem}>
                            📅 Time Range: {process.details.timeRange}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Price Check Results Summary */}
                    {process.type === 'price-check' && process.details?.resultsSummary && process.status === 'completed' && (
                      <div className={styles.processDetailsContent}>
                        <h6 style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
                          📊 Results Summary
                        </h6>
                        <div className={styles.detailsGrid}>
                          <div className={styles.detailItem} style={{ backgroundColor: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
                            ✅ Successful: {process.details.resultsSummary.postsChecked} posts checked
                          </div>
                          <div className={styles.detailItem} style={{ backgroundColor: 'hsl(var(--success) / 0.1)', border: '1px solid hsl(var(--success) / 0.3)' }}>
                            📈 Updated: {process.details.resultsSummary.postsUpdated} prices updated
                          </div>
                          <div className={styles.detailItem}>
                            🔄 Remaining: {process.details.resultsSummary.remainingChecks} checks this month
                          </div>
                          <div className={styles.detailItem}>
                            ⏰ Completed: {new Date(process.details.resultsSummary.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error Display */}
                  {process.error && (
                    <div className={styles.errorContainer}>
                      <span className={styles.errorIcon}>⚠️</span>
                      <span className={styles.errorText}>{process.error}</span>
                    </div>
                  )}

                  {/* Debug View - Expanded */}
                  {expandedProcesses.has(process.id) && (
                    <div className={styles.debugView}>
                      <div className={styles.debugHeader}>
                        <h5>📊 Debug Information</h5>
                      </div>
                      
                      {/* Process Logs */}
                      {process.logs && process.logs.length > 0 && (
                        <div className={styles.debugSection}>
                          <h6>📜 Logs</h6>
                          <div className={styles.logsContainer}>
                            {process.logs.map((log, index) => (
                              <div key={index} className={styles.logEntry}>
                                <span className={styles.logIndex}>[{index + 1}]</span>
                                <span className={styles.logText}>{log}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      

                      

                      {/* Copy Actions */}
                      <div className={styles.debugActions}>
                        <button 
                          className={styles.copyDebugButton}
                          onClick={() => copyLogsToClipboard(process)}
                        >
                          📋 Copy All Debug Info
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className={styles.timestamp}>
                    {ensureDate(process.createdAt).toLocaleString()}
                  </div>
                </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'subscription' && (
              <div className={styles.subscriptionTab}>
                {subscription?.subscriptionInfo ? (
                  <div className={styles.modernSubscriptionContainer}>
                    {/* Modern Plan Card with Gradient */}
                    <div className={`${styles.modernPlanCard} ${subscription.isPro ? styles.proPlan : styles.freePlan}`}>
                      <div className={styles.planBadge}>
                        <span className={styles.badgeIcon}>{subscription.isPro ? '⭐' : '🆓'}</span>
                        <span className={styles.badgeText}>
                          {subscription.isPro ? 'PRO' : 'FREE'}
                        </span>
                      </div>
                      
                      <div className={styles.planInfo}>
                        <h3 className={styles.planName}>
                          {subscription.subscriptionInfo.plan_display_name || subscription.subscriptionInfo.plan_name || 'Free Plan'}
                        </h3>
                        <p className={styles.planTagline}>
                          {subscription.isPro ? '🚀 All premium features unlocked' : '📦 Essential features for getting started'}
                        </p>
                      </div>

                      <div className={styles.planStatus}>
                        <span className={`${styles.modernStatusBadge} ${subscription.subscriptionInfo.subscription_status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                          <span className={styles.statusDot}></span>
                          {subscription.subscriptionInfo.subscription_status || 'Active'}
                        </span>
                      </div>
                    </div>
                      
                    {/* Modern Usage Cards */}
                    <div className={styles.modernUsageGrid}>
                      {/* Price Checks Card */}
                      <div className={styles.modernUsageCard}>
                        <div className={styles.usageCardHeader}>
                          <div className={styles.usageIcon}>💹</div>
                          <div className={styles.usageTitle}>
                            <h4>Price Checks</h4>
                            <p>Monthly usage tracking</p>
                          </div>
                        </div>
                        
                        <div className={styles.usageStats}>
                          <div className={styles.usageNumbers}>
                            <span className={styles.usedCount}>
                              {subscription.subscriptionInfo.price_checks_used || 0}
                            </span>
                            <span className={styles.usageSeparator}>/</span>
                            <span className={styles.limitCount}>
                              {subscription.subscriptionInfo.price_check_limit || 50}
                            </span>
                          </div>
                          
                          <div className={styles.modernProgressBar}>
                            <div 
                              className={`${styles.modernProgressFill} ${
                                ((subscription.subscriptionInfo.price_checks_used || 0) / (subscription.subscriptionInfo.price_check_limit || 50)) >= 0.9 
                                ? styles.progressDanger 
                                : subscription.isPro ? styles.progressSuccess : styles.progressPrimary
                              }`}
                              style={{ 
                                width: `${Math.min(((subscription.subscriptionInfo.price_checks_used || 0) / (subscription.subscriptionInfo.price_check_limit || 50)) * 100, 100)}%` 
                              }}
                            />
                          </div>
                          
                          <div className={styles.usageFooter}>
                            <span className={styles.remainingBadge}>
                              {subscription.subscriptionInfo.price_check_limit - (subscription.subscriptionInfo.price_checks_used || 0)} remaining
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Posts Created Card */}
                      <div className={styles.modernUsageCard}>
                        <div className={styles.usageCardHeader}>
                          <div className={styles.usageIcon}>📝</div>
                          <div className={styles.usageTitle}>
                            <h4>Posts Created</h4>
                            <p>Content creation limit</p>
                          </div>
                        </div>
                        
                        <div className={styles.usageStats}>
                          <div className={styles.usageNumbers}>
                            <span className={styles.usedCount}>
                              {subscription.subscriptionInfo.posts_created || 0}
                            </span>
                            <span className={styles.usageSeparator}>/</span>
                            <span className={styles.limitCount}>
                              {subscription.subscriptionInfo.post_creation_limit || 100}
                            </span>
                          </div>
                          
                          <div className={styles.modernProgressBar}>
                            <div 
                              className={`${styles.modernProgressFill} ${
                                ((subscription.subscriptionInfo.posts_created || 0) / (subscription.subscriptionInfo.post_creation_limit || 100)) >= 0.9 
                                ? styles.progressDanger 
                                : subscription.isPro ? styles.progressSuccess : styles.progressPrimary
                              }`}
                              style={{ 
                                width: `${Math.min(((subscription.subscriptionInfo.posts_created || 0) / (subscription.subscriptionInfo.post_creation_limit || 100)) * 100, 100)}%` 
                              }}
                            />
                          </div>
                          
                          <div className={styles.usageFooter}>
                            <span className={styles.remainingBadge}>
                              {(subscription.subscriptionInfo.post_creation_limit || 100) - (subscription.subscriptionInfo.posts_created || 0)} remaining
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pro Benefits Section for Free Users */}
                    {!subscription.isPro && (
                      <div className={styles.modernProBenefitsSection}>
                        <div className={styles.proBenefitsHeader}>
                          <h4 className={styles.sectionTitle}>⭐ Unlock Pro Benefits</h4>
                          <p className={styles.sectionSubtitle}>Get 6x more price checks and enhanced features</p>
                        </div>
                        
                        <div className={styles.benefitsGrid}>
                          <div className={styles.benefitCard}>
                            <div className={styles.benefitIcon}>💹</div>
                            <div className={styles.benefitContent}>
                              <h5>300 Price Checks</h5>
                              <p>vs 50 on Free plan</p>
                            </div>
                          </div>
                          
                          <div className={styles.benefitCard}>
                            <div className={styles.benefitIcon}>📝</div>
                            <div className={styles.benefitContent}>
                              <h5>500 Posts/Month</h5>
                              <p>vs 100 on Free plan</p>
                            </div>
                          </div>
                          
                          <div className={styles.benefitCard}>
                            <div className={styles.benefitIcon}>⚡</div>
                            <div className={styles.benefitContent}>
                              <h5>Priority Support</h5>
                              <p>Faster response times</p>
                            </div>
                          </div>
                          
                          <div className={styles.benefitCard}>
                            <div className={styles.benefitIcon}>🎯</div>
                            <div className={styles.benefitContent}>
                              <h5>Advanced Analytics</h5>
                              <p>Coming soon</p>
                            </div>
                          </div>
                        </div>

                        <div className={styles.upgradeCallToAction}>
                          <button 
                            className={styles.ctaUpgradeButton}
                            onClick={() => {
                              if (typeof window !== 'undefined' && window.showNotification) {
                                window.showNotification('🚀 Redirecting to upgrade page...', 'info');
                              }
                              setTimeout(() => {
                                if (typeof window !== 'undefined') {
                                  window.location.href = '/pricing';
                                }
                              }, 500);
                            }}
                          >
                            <span className={styles.ctaIcon}>⭐</span>
                            <span>Upgrade to Pro for $7/month</span>
                            <span className={styles.ctaArrow}>→</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Modern Info Timeline */}
                    <div className={styles.modernInfoSection}>
                      <h4 className={styles.sectionTitle}>📋 Subscription Details</h4>
                      
                      <div className={styles.modernInfoGrid}>
                        {subscription.subscriptionInfo.plan_id && (
                          <div className={styles.modernInfoCard}>
                            <div className={styles.infoCardIcon}>🆔</div>
                            <div className={styles.infoCardContent}>
                              <span className={styles.infoCardLabel}>Plan ID</span>
                              <span className={styles.infoCardValue}>{subscription.subscriptionInfo.plan_id}</span>
                            </div>
                          </div>
                        )}
                        
                        {subscription.subscriptionInfo.start_date && (
                          <div className={styles.modernInfoCard}>
                            <div className={styles.infoCardIcon}>📅</div>
                            <div className={styles.infoCardContent}>
                              <span className={styles.infoCardLabel}>Started</span>
                              <span className={styles.infoCardValue}>
                                {new Date(subscription.subscriptionInfo.start_date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {subscription.subscriptionInfo.end_date && (
                          <div className={styles.modernInfoCard}>
                            <div className={styles.infoCardIcon}>⏰</div>
                            <div className={styles.infoCardContent}>
                              <span className={styles.infoCardLabel}>Expires</span>
                              <span className={styles.infoCardValue}>
                                {new Date(subscription.subscriptionInfo.end_date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Modern Action Buttons */}
                    <div className={styles.modernActionButtons}>
                      <button 
                        className={styles.modernRefreshButton}
                        onClick={() => subscription.refreshSubscription?.()}
                        disabled={subscription.loading}
                      >
                        <span className={styles.buttonIcon}>🔄</span>
                        <span>Refresh Data</span>
                      </button>
                      
                      {!subscription.isPro && (
                        <button 
                          className={styles.modernUpgradeButton}
                          onClick={() => {
                            // Show notification about redirect
                            if (typeof window !== 'undefined' && window.showNotification) {
                              window.showNotification('🚀 Redirecting to upgrade page...', 'info');
                            }
                            
                            // Navigate to pricing page
                            setTimeout(() => {
                              if (typeof window !== 'undefined') {
                                window.location.href = '/pricing';
                              }
                            }, 500);
                          }}
                        >
                          <span className={styles.buttonIcon}>⭐</span>
                          <span>Upgrade to Pro</span>
                          <span className={styles.upgradeArrow}>→</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={styles.modernEmptyState}>
                    <div className={styles.emptyAnimation}>
                      <span className={styles.emptyIcon}>💎</span>
                    </div>
                    <h3>Loading Subscription</h3>
                    <p>Fetching your subscription details...</p>
                    <button 
                      className={styles.modernRetryButton}
                      onClick={() => subscription?.refreshSubscription?.()}
                    >
                      <span>🔄</span> Try Again
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'history' && (
              <div className={styles.historyTab}>
                {/* Horizontal History Tabs */}
                <div className={styles.historyTabsContainer}>
                  {(['processes', 'posts', 'activity'] as HistoryTabType[]).map(tab => (
                    <button
                      key={tab}
                      className={`${styles.historyTabButton} ${activeHistoryTab === tab ? styles.active : ''}`}
                      onClick={() => setActiveHistoryTab(tab)}
                    >
                      <span className={styles.historyTabIcon}>
                        {tab === 'processes' ? '⚙️' : tab === 'posts' ? '📝' : '💹'}
                      </span>
                      <span className={styles.historyTabLabel}>
                        {tab === 'processes' ? 'Background Tasks' :
                         tab === 'posts' ? 'Posted Content' : 'Recent Activity'}
                      </span>
                      <span className={styles.historyTabCount}>
                        {tab === 'processes' ? processHistory.length :
                         tab === 'posts' ? historicalPosts.length :
                         historicalPriceChecks.length}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Smart History Content - Full Width Display */}
                <div className={styles.historyContent}>
                  {/* Data Summary Bar with Export Actions */}
                  <div className={styles.historyStatsBar}>
                    <div className={styles.statCard}>
                      <span className={styles.statIcon}>⚙️</span>
                      <div className={styles.statInfo}>
                        <span className={styles.statNumber}>{processHistory.length}</span>
                        <span className={styles.statLabel}>Background Tasks</span>
                      </div>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statIcon}>📝</span>
                      <div className={styles.statInfo}>
                        <span className={styles.statNumber}>{historicalPosts.length}</span>
                        <span className={styles.statLabel}>Posts Created</span>
                      </div>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statIcon}>📉</span>
                      <div className={styles.statInfo}>
                        <span className={styles.statNumber}>{historicalPriceChecks.length}</span>
                        <span className={styles.statLabel}>Activities</span>
                      </div>
                    </div>
                    
                    {/* Additional stats for price check activities */}
                    {historicalPriceChecks.some(a => a.type === 'price-check') && (
                      <>
                        <div className={styles.statCard}>
                          <span className={styles.statIcon}>🎯</span>
                          <div className={styles.statInfo}>
                            <span className={styles.statNumber}>
                              {historicalPriceChecks.reduce((sum, a) => sum + (a.targetReached || 0), 0)}
                            </span>
                            <span className={styles.statLabel}>Targets Hit</span>
                          </div>
                        </div>
                        <div className={styles.statCard}>
                          <span className={styles.statIcon}>🛑</span>
                          <div className={styles.statInfo}>
                            <span className={styles.statNumber}>
                              {historicalPriceChecks.reduce((sum, a) => sum + (a.stopLossTriggered || 0), 0)}
                            </span>
                            <span className={styles.statLabel}>Stop Losses</span>
                          </div>
                        </div>
                        <div className={styles.statCard}>
                          <span className={styles.statIcon}>📢</span>
                          <div className={styles.statInfo}>
                            <span className={styles.statNumber}>
                              {historicalPriceChecks.filter(a => a.canSendTelegram).length}
                            </span>
                            <span className={styles.statLabel}>Telegram Ready</span>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* Export Actions */}
                    <div className={styles.exportActions}>
                      <button 
                        className={styles.exportButton}
                        onClick={() => exportHistoryData()}
                        title="Export history data as JSON"
                      >
                        📤 Export JSON
                      </button>
                      <button 
                        className={styles.refreshButton}
                        onClick={() => refreshHistoryData()}
                        disabled={historyLoading}
                        title={`Refresh ${activeHistoryTab === 'processes' ? 'background tasks' : activeHistoryTab === 'posts' ? 'posts' : 'activity'} data`}
                      >
                        {historyLoading ? (
                          <>
                            <span className={styles.loadingSpinner}>⏳</span>
                            Refreshing...
                          </>
                        ) : (
                          <>
                            🔄 Refresh
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {historyLoading && (
                    <div className={styles.loadingState}>
                      <span className={styles.loadingIcon}>🔄</span>
                      <p>Loading history...</p>
                    </div>
                  )}

                  {/* Background Tasks History */}
                  {activeHistoryTab === 'processes' && (
                    <div className={styles.historyList}>
                      {processHistory.length === 0 ? (
                        <div className={styles.emptyState}>
                          <span className={styles.emptyIcon}>⚙️</span>
                          <p>No background task history available</p>
                        </div>
                      ) : (
                        (() => {
                          const m = new Map<string, any>();
                          for (const p of processHistory) {
                            if (!m.has(p.id)) m.set(p.id, p); // keep first (newest)
                          }
                          return Array.from(m.values());
                        })().map((process) => (
                          <div key={process.id} className={`${styles.historyCard} ${styles[process.status]}`}>
                            <div className={styles.historyHeader}>
                              <span className={styles.processIcon}>{process.icon}</span>
                              <div className={styles.historyInfo}>
                                <h4>{process.title}</h4>
                                <p className={styles.historyStatus}>
                                  {getStatusText(process.status, process.type)}
                                </p>
                              </div>
                              <div className={styles.historyMeta}>
                                <span className={styles.duration}>{formatDuration(process.duration)}</span>
                                <span className={styles.timestamp}>
                                  {process.completedAt.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            
                            {process.error && (
                              <div className={styles.errorSummary}>
                                <span className={styles.errorIcon}>⚠️</span>
                                <span className={styles.errorText}>{process.error}</span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Posted Content History */}
                  {activeHistoryTab === 'posts' && (
                    <div className={styles.historyList}>
                      {historicalPosts.length === 0 ? (
                        <div className={styles.emptyState}>
                          <span className={styles.emptyIcon}>📝</span>
                          <p>No posts found in the last 30 days</p>
                        </div>
                      ) : (
                        (() => {
                          const m = new Map<string, any>();
                          for (const post of historicalPosts) {
                            if (!m.has(post.id)) m.set(post.id, post);
                          }
                          return Array.from(m.values());
                        })().map((post) => (
                          <div key={post.id} className={`${styles.historyCard} ${styles.post}`}>
                            <div className={styles.historyHeader}>
                              <span className={styles.processIcon}>📝</span>
                              <div className={styles.historyInfo}>
                                <h4>{post.title || 'Untitled Post'}</h4>
                                <p className={styles.historyStatus}>
                                  {post.symbol} - {post.status || 'Active'}
                                </p>
                                <div className={styles.postStats}>
                                  <span>👍 {post.buy_count}</span>
                                  <span>👎 {post.sell_count}</span>
                                  <span>💬 {post.comment_count}</span>
                                </div>
                              </div>
                              <div className={styles.historyMeta}>
                                <span className={styles.timestamp}>
                                  {post.created_at.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            
                            {post.current_price && (
                              <div className={styles.priceInfo}>
                                <span>Current: ${post.current_price}</span>
                                {post.target_price && <span>Target: ${post.target_price}</span>}
                                {post.stop_loss_price && <span>Stop: ${post.stop_loss_price}</span>}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Activity History */}
                  {activeHistoryTab === 'activity' && (
                    <div className={styles.historyList}>
                      {historicalPriceChecks.length === 0 ? (
                        <div className={styles.emptyState}>
                          <span className={styles.emptyIcon}>💹</span>
                          <p>No recent activity found in the last 30 days</p>
                        </div>
                      ) : (
                        (() => {
                          const m = new Map<string, any>();
                          for (const a of historicalPriceChecks) {
                            if (!m.has(a.id)) m.set(a.id, a);
                          }
                          return Array.from(m.values());
                        })().map((activity) => (
                          <div 
                            key={activity.id} 
                            className={`${styles.historyCard} ${styles.activity} ${styles.clickable}`}
                            onClick={() => handleActivityClick(activity)}
                          >
                            <div className={styles.historyHeader}>
                              <span className={styles.processIcon}>{activity.icon}</span>
                              <div className={styles.historyInfo}>
                                <h4>{activity.title}</h4>
                                <p className={styles.historyStatus}>
                                  {activity.type === 'action' ? `${activity.action_type?.toUpperCase()} action on ${activity.symbol}` :
                                   activity.type === 'comment' ? `Comment: ${activity.content}` :
                                   activity.type === 'closed-post' ? `Post closed: ${activity.symbol}` : 
                                   activity.type === 'price-check' ? `Checked ${activity.checkedPosts || 0} symbols` :
                                   activity.status || 'Completed'}
                                </p>
                                
                                {/* Enhanced details for different activity types */}
                                {activity.type === 'price-check' && (
                                  <div className={styles.priceCheckDetails}>
                                    <span className={styles.detailBadge}>
                                      📊 Symbols: {activity.checkedPosts || 0}
                                    </span>
                                    <span className={styles.detailBadge}>
                                      📈 Updates: {activity.updatedPosts || 0}
                                    </span>
                                    {activity.targetReached > 0 && (
                                      <span className={`${styles.detailBadge} ${styles.successBadge}`}>
                                        🎯 Targets: {activity.targetReached}
                                      </span>
                                    )}
                                    {activity.stopLossTriggered > 0 && (
                                      <span className={`${styles.detailBadge} ${styles.dangerBadge}`}>
                                        🛑 Stop Loss: {activity.stopLossTriggered}
                                      </span>
                                    )}
                                    {activity.canSendTelegram && (
                                      <span className={`${styles.detailBadge} ${styles.telegramEligible}`}>
                                        📢 {activity.telegramEligiblePosts} Ready for Telegram
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Show sample symbols for price-check activities */}
                                {activity.type === 'price-check' && activity.posts && activity.posts.length > 0 && (
                                  <div className={styles.symbolsList}>
                                    <span className={styles.symbolsLabel}>Symbols:</span>
                                    <div className={styles.symbolsContainer}>
                                      {activity.posts.slice(0, 3).map((post: any, idx: number) => (
                                        <span key={idx} className={styles.symbolTag}>
                                          {post.symbol}
                                          {post.target_reached && <span className={styles.symbolStatus}>🎯</span>}
                                          {post.stop_loss_triggered && <span className={styles.symbolStatus}>🛑</span>}
                                        </span>
                                      ))}
                                      {activity.posts.length > 3 && (
                                        <span className={styles.moreSymbols}>
                                          +{activity.posts.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Company info for single-symbol activities */}
                                {activity.type !== 'price-check' && activity.company_name && (
                                  <div className={styles.companyInfo}>
                                    <span className={styles.companyName}>{activity.company_name}</span>
                                    {activity.exchange && (
                                      <span className={styles.exchangeTag}>
                                        {activity.exchange}
                                      </span>
                                    )}
                                    {activity.country && (
                                      <span className={styles.countryTag}>
                                        {activity.country}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className={styles.historyMeta}>
                                <span className={styles.timestamp}>
                                  {activity.created_at.toLocaleString()}
                                </span>
                                {activity.last_price_check && activity.type === 'price-check' && (
                                  <span className={styles.lastCheck}>
                                    Last Check: {new Date(activity.last_price_check).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Additional Details for Price Checks */}
                            {activity.type === 'price-check' && activity.price_checks && (
                              <div className={styles.priceHistorySection}>
                                <details className={styles.priceHistoryDetails}>
                                  <summary className={styles.priceHistorySummary}>
                                    📊 Price History & Details
                                  </summary>
                                  <div className={styles.priceHistoryContent}>
                                    {activity.status_message && (
                                      <p className={styles.statusMessage}>
                                        <strong>Status:</strong> {activity.status_message}
                                      </p>
                                    )}
                                    {activity.initial_price && (
                                      <p><strong>Initial Price:</strong> ${activity.initial_price}</p>
                                    )}
                                    {activity.high_price && (
                                      <p><strong>High Price:</strong> ${activity.high_price}</p>
                                    )}
                                    {activity.buy_count !== undefined && (
                                      <p><strong>Community Sentiment:</strong> 👍 {activity.buy_count} Buy | 👎 {activity.sell_count} Sell | 💬 {activity.comment_count} Comments</p>
                                    )}
                                    {activity.postDateAfterPriceDate && (
                                      <p className={styles.warningText}>⚠️ Post created after price date</p>
                                    )}
                                    {activity.postAfterMarketClose && (
                                      <p className={styles.warningText}>⚠️ Post created after market close</p>
                                    )}
                                    {activity.noDataAvailable && (
                                      <p className={styles.errorText}>❌ No price data available</p>
                                    )}
                                  </div>
                                </details>
                              </div>
                            )}
                            
                            {/* Enhanced Telegram Actions for All Activity Types */}
                            {(activity.type === 'price_check_group' || activity.type === 'price_check_result' || 
                              activity.type === 'price-check' || activity.type === 'closed-post' || 
                              activity.type === 'action' || activity.type === 'comment') && 
                              (activity.canSendTelegram || activity.target_reached || activity.stop_loss_triggered) && (
                              <div className={styles.telegramActions}>
                                <button
                                  className={styles.telegramButton}
                                  onClick={() => handleSendHistoricalTelegram(activity)}
                                  title={`Send Telegram notification for ${activity.symbol || 'this activity'}`}
                                >
                                  📢 Send to Telegram
                                  {activity.telegramEligiblePosts && (
                                    <span className={styles.telegramBadge}>
                                      {activity.telegramEligiblePosts}
                                    </span>
                                  )}
                                  {(activity.target_reached || activity.stop_loss_triggered) && (
                                    <span className={styles.alertBadge}>
                                      {activity.target_reached ? '🎯' : '🛑'}
                                    </span>
                                  )}
                                </button>
                                
                                {/* Activity Type Specific Info */}
                                <div className={styles.activityTypeInfo}>
                                  {activity.type === 'action' && (
                                    <span className={styles.actionTypeTag}>
                                      {activity.action_type === 'buy' ? '💰 Buy Signal' : '📈 Sell Signal'}
                                    </span>
                                  )}
                                  {activity.type === 'comment' && (
                                    <span className={styles.commentTypeTag}>
                                      💬 Comment Activity
                                    </span>
                                  )}
                                  {activity.type === 'closed-post' && (
                                    <span className={styles.closedTypeTag}>
                                      📋 Position Closed
                                    </span>
                                  )}
                                  {activity.type === 'price-check' && (
                                    <span className={styles.priceCheckTypeTag}>
                                      💹 Price Update
                                    </span>
                                  )}
                                </div>
                                
                                {activity.summary && (
                                  <div className={styles.priceCheckSummary}>
                                    <span className={styles.summaryItem}>
                                      📊 Checked: {activity.summary.checkedPosts || 0}
                                    </span>
                                    <span className={styles.summaryItem}>
                                      ⚡ Updated: {activity.summary.updatedPosts || 0}
                                    </span>
                                    {activity.summary.targetReached > 0 && (
                                      <span className={styles.summaryItem}>
                                        🎯 Targets: {activity.summary.targetReached}
                                      </span>
                                    )}
                                    {activity.summary.stopLossTriggered > 0 && (
                                      <span className={styles.summaryItem}>
                                        🛑 Stop Losses: {activity.summary.stopLossTriggered}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {activity.error_message && (
                              <div className={styles.errorSummary}>
                                <span className={styles.errorIcon}>⚠️</span>
                                <span className={styles.errorText}>{activity.error_message}</span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            
          </div>
        </div>
      </div>

      {/* Activity Details Dialog */}
      {showActivityDialog && selectedActivity && (
        <div className={styles.dialogOverlay} onClick={handleCloseActivityDialog}>
          <div className={styles.dialogContent} onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h3>Activity Details</h3>
              <button 
                className={styles.closeButton}
                onClick={handleCloseActivityDialog}
              >
                ✕
              </button>
            </div>
            
            <div className={styles.dialogBody}>
              <div className={styles.activityDetails}>
                <div className={styles.activityHeader}>
                  <span className={styles.activityIcon}>{selectedActivity.icon}</span>
                  <div>
                    <h4>{selectedActivity.title}</h4>
                    <p className={styles.activityType}>
                      {selectedActivity.type === 'price-check' ? 'Price Check' :
                       selectedActivity.type === 'action' ? 'Trading Action' :
                       selectedActivity.type === 'comment' ? 'Comment' :
                       selectedActivity.type === 'closed-post' ? 'Closed Position' : 
                       'Activity'}
                    </p>
                  </div>
                </div>

                {/* Symbol and Company Info */}
                {selectedActivity.symbol && (
                  <div className={styles.symbolInfo}>
                    <div className={styles.symbolHeader}>
                      <span className={styles.symbol}>{selectedActivity.symbol}</span>
                      {selectedActivity.company_name && (
                        <span className={styles.companyName}>{selectedActivity.company_name}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Price Information */}
                {selectedActivity.type === 'price-check' && (
                  <div className={styles.priceInfo}>
                    <div className={styles.priceGrid}>
                      <div className={styles.priceItem}>
                        <span className={styles.priceLabel}>Current Price</span>
                        <span className={styles.priceValue}>${selectedActivity.current_price || 'N/A'}</span>
                      </div>
                      <div className={styles.priceItem}>
                        <span className={styles.priceLabel}>Target Price</span>
                        <span className={styles.priceValue}>${selectedActivity.target_price || 'N/A'}</span>
                      </div>
                      <div className={styles.priceItem}>
                        <span className={styles.priceLabel}>Stop Loss</span>
                        <span className={styles.priceValue}>${selectedActivity.stop_loss_price || 'N/A'}</span>
                      </div>
                      <div className={styles.priceItem}>
                        <span className={styles.priceLabel}>Status</span>
                        <span className={`${styles.priceValue} ${
                          selectedActivity.target_reached ? styles.success :
                          selectedActivity.stop_loss_triggered ? styles.danger :
                          styles.neutral
                        }`}>
                          {selectedActivity.target_reached ? '🎯 Target Reached' :
                           selectedActivity.stop_loss_triggered ? '🛑 Stop Loss Hit' :
                           '📊 Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity Content */}
                {selectedActivity.content && (
                  <div className={styles.activityContent}>
                    <h5>Description</h5>
                    <p>{selectedActivity.content}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className={styles.timestamps}>
                  <div className={styles.timestamp}>
                    <span className={styles.timestampLabel}>Created:</span>
                    <span>{new Date(selectedActivity.created_at).toLocaleString()}</span>
                  </div>
                  {selectedActivity.last_price_check && (
                    <div className={styles.timestamp}>
                      <span className={styles.timestampLabel}>Last Check:</span>
                      <span>{new Date(selectedActivity.last_price_check).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.dialogFooter}>
              {/* Send to Telegram Button */}
              {selectedActivity.symbol && (
                <button 
                  className={styles.telegramButton}
                  onClick={() => handleSendHistoricalTelegram(selectedActivity)}
                >
                  📢 Send to Telegram
                </button>
              )}
              <button 
                className={styles.cancelButton}
                onClick={handleCloseActivityDialog}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Price Check Results Dialog */}
      {showPriceCheckDialog && selectedPriceCheckData && (
        <PriceCheckResultsDialog
          isOpen={showPriceCheckDialog}
          onClose={() => {
            setShowPriceCheckDialog(false);
            setSelectedPriceCheckData(null);
          }}
          results={selectedPriceCheckData.results}
          stats={selectedPriceCheckData.stats}
        />
      )}
    </>
  );
}
