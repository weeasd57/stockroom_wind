'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSupabase } from './SupabaseProvider';

interface Trader {
  id: string;
  username: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  created_at: string;
  post_count: number;
  followers: number;
  following: number;
  experience_score?: number;
  success_posts?: number;
  loss_posts?: number;
  latestPost?: {
    id: string;
    symbol: string;
    country: string;
    image_url?: string;
    created_at: string;
    description?: string;
  } | null;
  isLoading?: boolean;
  hasError?: boolean;
  countryCounts?: Record<string, number>;
  // Telegram bot badge fields
  hasTelegramBot?: boolean;
  botUsername?: string | null;
}

interface TradersContextType {
  traders: Trader[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filter: string;
  hasMore: boolean;
  // Actions
  setSearchQuery: (query: string) => void;
  setFilter: (filter: string) => void;
  loadMore: () => void;
  refreshTraders: () => void;
  clearCache: () => void;
  retryFailedProfiles: () => void;
}

const TradersContext = createContext<TradersContextType | undefined>(undefined);

// Enhanced cache with error tracking
const tradersCache = new Map();
const failedProfiles = new Set();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (increased)
const ITEMS_PER_PAGE = 20; // Increased page size
const MAX_RETRIES = 3;

export const TradersProvider = ({ children }: { children: ReactNode }) => {
  const { supabase, isAuthenticated, user } = useSupabase();
  const pathname = usePathname();
  const enabled = Boolean(pathname && pathname.startsWith('/traders'));
  
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const inFlightRef = useRef(false);

  // Component initialized

  // Function to clear cache
  const clearCache = useCallback(() => {
    // Clearing cache
    tradersCache.clear();
    failedProfiles.clear();
    setRetryCount(0);
  }, []);

  // Function to retry failed profiles
  const retryFailedProfiles = useCallback(async () => {
    if (failedProfiles.size === 0) return;
    
    // Retrying failed profiles
    
    // Convert failed profiles to array and clear the set
    const failedIds = Array.from(failedProfiles);
    failedProfiles.clear();
    
    try {
      setLoading(true);
      
      // Fetch failed profiles with retries
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, bio, avatar_url, created_at, followers, following')
        .in('id', failedIds);

      if (profilesError) throw profilesError;

      if (profilesData && profilesData.length > 0) {
        const enhancedProfiles = await enhanceProfilesWithPostData(profilesData);
        
        // Update existing traders list
        setTraders(prev => prev.map(trader => {
          const updated = enhancedProfiles.find(p => p.id === trader.id);
          return updated ? { ...updated, isLoading: false, hasError: false } : trader;
        }));
      }
    } catch (error) {
      console.error('[TRADERS PROVIDER] Failed to retry profiles:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Enhanced function to get post data with better error handling and limited concurrency
  const enhanceProfilesWithPostData = useCallback(async (profiles: any[], concurrency = 3) => {
    const processProfile = async (profile: any) => {
      try {
        // For each profile, run the 3 queries in parallel
        const [postCountResult, latestPostResult, countriesResult] = await Promise.allSettled([
          supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id),
          supabase
            .from('posts')
            .select('id, symbol, country, image_url, created_at, description')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1),
          // Fetch countries for this user's posts (client-side aggregate to counts)
          supabase
            .from('posts')
            .select('country')
            .eq('user_id', profile.id)
            .not('country', 'is', null)
            .limit(500)
        ]);

        const postCount = postCountResult.status === 'fulfilled'
          ? (postCountResult.value.count || 0)
          : 0;

        const latestPost = latestPostResult.status === 'fulfilled'
          ? (latestPostResult.value.data?.[0] || null)
          : null;

        // Build country counts map
        const countryCounts: Record<string, number> = countriesResult.status === 'fulfilled'
          ? (countriesResult.value.data || []).reduce((acc: Record<string, number>, row: any) => {
              const code = String(row?.country || '').toLowerCase().trim();
              if (!code) return acc;
              acc[code] = (acc[code] || 0) + 1;
              return acc;
            }, {})
          : {};

        return {
          ...profile,
          avatar_url: profile.avatar_url || '/default-avatar.svg',
          bio: profile.bio || '',
          full_name: profile.full_name || profile.username || 'Unknown User',
          post_count: postCount,
          followers: profile.followers || 0,
          following: profile.following || 0,
          experience_score: profile.experience_score ?? 0,
          success_posts: profile.success_posts ?? 0,
          loss_posts: profile.loss_posts ?? 0,
          latestPost,
          countryCounts,
          isLoading: false,
          hasError: false,
        };
      } catch (error) {
        console.warn(`[TRADERS PROVIDER] Failed to enhance profile ${profile.id}:`, error);
        failedProfiles.add(profile.id);
        return {
          ...profile,
          avatar_url: profile.avatar_url || '/default-avatar.svg',
          bio: profile.bio || '',
          full_name: profile.full_name || profile.username || 'Unknown User',
          post_count: 0,
          followers: profile.followers || 0,
          following: profile.following || 0,
          experience_score: profile.experience_score ?? 0,
          success_posts: profile.success_posts ?? 0,
          loss_posts: profile.loss_posts ?? 0,
          latestPost: null,
          countryCounts: {},
          isLoading: false,
          hasError: true,
        };
      }
    };

    const results: any[] = new Array(profiles.length);
    let index = 0;

    const worker = async () => {
      while (true) {
        const i = index++;
        if (i >= profiles.length) break;
        results[i] = await processProfile(profiles[i]);
      }
    };

    const pool = Math.max(1, Math.min(concurrency, profiles.length));
    await Promise.all(Array.from({ length: pool }, () => worker()));
    return results;
  }, [supabase]);

  // Fetch traders function with improved error handling
  const fetchTraders = useCallback(async (pageNum = 1, isLoadMore = false) => {
    try {
      // Fetching traders

      // Check cache first (avoid spinner flicker on cache hits)
      const cacheKey = `traders_page_${pageNum}_${ITEMS_PER_PAGE}_${filter}_${searchQuery}`;
      const cachedData = tradersCache.get(cacheKey);

      if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
        if (isLoadMore) {
          setTraders(prev => [...prev, ...cachedData.data]);
        } else {
          setTraders(cachedData.data);
        }
        setHasMore(cachedData.data.length === ITEMS_PER_PAGE);
        return;
      }

      // Prevent overlapping non-loadMore fetches
      if (!isLoadMore && inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;

      if (!isLoadMore) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      // Fetching from database

      // Calculate offset for pagination
      const offset = (pageNum - 1) * ITEMS_PER_PAGE;

      // Build query with filters
      let query = supabase
        .from('profiles')
        .select('id, username, full_name, bio, avatar_url, created_at, followers, following, experience_score, success_posts, loss_posts')
        .order('created_at', { ascending: false });

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`);
      }

      // Apply filters
      if (filter === 'trending') {
        query = query.order('followers', { ascending: false });
      } else if (filter === 'new') {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + ITEMS_PER_PAGE - 1);

      const { data: profilesData, error: profilesError } = await query;

      // Database query completed

      if (profilesError) {
        throw profilesError;
      }

      if (!profilesData || profilesData.length === 0) {
        if (isLoadMore) {
          setHasMore(false);
        } else {
          setTraders([]);
        }
        return;
      }

      // Progressive: set minimal list immediately for faster first paint
      if (!isLoadMore) {
        setTraders(
          profilesData.map((profile: any) => ({
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name || profile.username || 'Unknown User',
            bio: profile.bio || '',
            avatar_url: profile.avatar_url || '/default-avatar.svg',
            created_at: profile.created_at,
            post_count: 0,
            followers: profile.followers || 0,
            following: profile.following || 0,
            experience_score: profile.experience_score ?? 0,
            success_posts: profile.success_posts ?? 0,
            loss_posts: profile.loss_posts ?? 0,
            latestPost: null,
            countryCounts: {},
            isLoading: true,
            hasError: false,
          }))
        );
      }

      // Enhance profiles with post data (limited concurrency)
      const processedTraders = await enhanceProfilesWithPostData(profilesData, 3);

      // Immediately update UI with processed traders (without telegram badges yet)
      if (isLoadMore) {
        setTraders(prev => [...prev, ...processedTraders]);
      } else {
        const enhancedMap = new Map<string, any>(processedTraders.map((t: any) => [t.id, t]));
        setTraders(prev => prev.map(p => enhancedMap.get(p.id) || p));
      }

      // Store interim result in cache
      tradersCache.set(cacheKey, {
        data: processedTraders,
        timestamp: Date.now()
      });

      // Fetch telegram bot badges in background to avoid blocking UI
      (async () => {
        try {
          const userIds = processedTraders.map((t: Trader) => t.id);
          const { data: botsData, error: botsError } = await supabase
            .rpc('public_get_users_with_active_bots', { p_user_ids: userIds });

          if (botsError) {
            console.warn('[TRADERS PROVIDER] Failed to fetch telegram bots info:', botsError);
            return;
          }

          const botMap = new Map<string, { user_id: string; bot_username: string; is_active: boolean }>(
            (botsData || []).map((b: any) => [b.user_id, b])
          );
          const mergedTraders: Trader[] = processedTraders.map((t: Trader) => {
            const bot = botMap.get(t.id);
            return {
              ...t,
              hasTelegramBot: !!bot?.is_active,
              botUsername: bot?.bot_username || null,
            } as Trader;
          });

          // Update cache with merged data
          tradersCache.set(cacheKey, {
            data: mergedTraders,
            timestamp: Date.now()
          });

          // Apply bot flags to UI
          if (isLoadMore) {
            setTraders(prev => {
              const existing = new Map(prev.map((t: any) => [t.id, t]));
              mergedTraders.forEach(mt => existing.set(mt.id, mt));
              return Array.from(existing.values());
            });
          } else {
            const enhancedMapWithBots = new Map<string, any>(mergedTraders.map((t: any) => [t.id, t]));
            setTraders(prev => prev.map(p => enhancedMapWithBots.get(p.id) || p));
          }
        } catch (e) {
          console.warn('[TRADERS PROVIDER] Error merging telegram bot badges:', e);
        }
      })();
      
      // Check if there are more items
      setHasMore(processedTraders.length === ITEMS_PER_PAGE);

    } catch (error: any) {
      console.error('[TRADERS PROVIDER] Error fetching traders:', error);
      
      const errorMessage = error.message || 'Failed to load traders';
      setError(errorMessage);
      
      // Implement retry logic for transient errors
      if (retryCount < MAX_RETRIES && (
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection')
      )) {
        // Retrying connection
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          fetchTraders(pageNum, isLoadMore);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      if (!isLoadMore) {
        setTraders([]);
      }
      setRetryCount(0);
    } finally {
      // Setting loading states to false
      setLoading(false);
      setLoadingMore(false);
      inFlightRef.current = false;
    }
  }, [searchQuery, filter, supabase, retryCount, enhanceProfilesWithPostData]);

  // Filter traders
  const filteredTraders = traders.filter(trader => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return trader.username.toLowerCase().includes(query) ||
             trader.full_name?.toLowerCase().includes(query);
    }
    return true;
  });

  // Load more function
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTraders(nextPage, true);
    }
  }, [page, loadingMore, hasMore, fetchTraders]);

  // Refresh traders
  const refreshTraders = useCallback(() => {
    clearCache();
    setPage(1);
    setRetryCount(0);
    fetchTraders(1, false);
  }, [fetchTraders, clearCache]);

  // Effect to fetch traders when dependencies change
  useEffect(() => {
    if (!enabled) return; // only fetch on traders page
    const timeoutId = setTimeout(() => {
      setPage(1);
      setRetryCount(0);
      fetchTraders(1, false);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [enabled, searchQuery, filter]);

  // Keep provider idle when disabled (no initial fetch here to avoid double calls with the debounced effect)
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
    }
  }, [enabled]);

  const value = {
    traders: filteredTraders,
    loading,
    error,
    searchQuery,
    filter,
    hasMore,
    setSearchQuery,
    setFilter,
    loadMore,
    refreshTraders,
    clearCache,
    retryFailedProfiles,
  };

  return <TradersContext.Provider value={value}>{children}</TradersContext.Provider>;
};

export const useTraders = () => {
  const context = useContext(TradersContext);
  if (context === undefined) {
    throw new Error('useTraders must be used within a TradersProvider');
  }
  return context;
};
