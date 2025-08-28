'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  console.log('[TRADERS PROVIDER] Component initialized');

  // Function to clear cache
  const clearCache = useCallback(() => {
    console.log('[TRADERS PROVIDER] Clearing cache');
    tradersCache.clear();
    failedProfiles.clear();
    setRetryCount(0);
  }, []);

  // Function to retry failed profiles
  const retryFailedProfiles = useCallback(async () => {
    if (failedProfiles.size === 0) return;
    
    console.log('[TRADERS PROVIDER] Retrying failed profiles:', failedProfiles.size);
    
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

  // Enhanced function to get post data with better error handling
  const enhanceProfilesWithPostData = useCallback(async (profiles: any[]) => {
    const enhancedProfiles = await Promise.allSettled(
      profiles.map(async (profile) => {
        try {
          // Use Promise.allSettled for better error handling
          const [postCountResult, latestPostResult] = await Promise.allSettled([
            supabase
              .from('posts')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', profile.id),
            supabase
              .from('posts')
              .select('id, symbol, country, image_url, created_at, description')
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
              .limit(1)
          ]);

          const postCount = postCountResult.status === 'fulfilled' 
            ? (postCountResult.value.count || 0) 
            : 0;

          const latestPost = latestPostResult.status === 'fulfilled' 
            ? (latestPostResult.value.data?.[0] || null)
            : null;

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
            latestPost: latestPost,
            isLoading: false,
            hasError: false
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
            isLoading: false,
            hasError: true
          };
        }
      })
    );

    return enhancedProfiles
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value);
  }, [supabase]);

  // Fetch traders function with improved error handling
  const fetchTraders = useCallback(async (pageNum = 1, isLoadMore = false) => {
    try {
      console.log(`[TRADERS PROVIDER] Fetching traders page ${pageNum}, loadMore: ${isLoadMore}`);
      
      if (!isLoadMore) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      setError(null);

      // Check cache first
      const cacheKey = `traders_page_${pageNum}_${ITEMS_PER_PAGE}_${filter}_${searchQuery}`;
      const cachedData = tradersCache.get(cacheKey);
      
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
        console.log(`[TRADERS PROVIDER] Using cached data for page ${pageNum}`);
        
        if (isLoadMore) {
          setTraders(prev => [...prev, ...cachedData.data]);
        } else {
          setTraders(cachedData.data);
        }
        
        setHasMore(cachedData.data.length === ITEMS_PER_PAGE);
        return;
      }

      console.log(`[TRADERS PROVIDER] Fetching from database for page ${pageNum}`);

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

      console.log(`[TRADERS PROVIDER] Database query completed. Error:`, profilesError);
      console.log(`[TRADERS PROVIDER] Found ${profilesData?.length || 0} profiles`);

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

      // Enhance profiles with post data
      const processedTraders = await enhanceProfilesWithPostData(profilesData);

      console.log(`[TRADERS PROVIDER] Processed ${processedTraders.length} traders`);

      // Cache the results
      tradersCache.set(cacheKey, {
        data: processedTraders,
        timestamp: Date.now()
      });

      if (isLoadMore) {
        setTraders(prev => [...prev, ...processedTraders]);
      } else {
        setTraders(processedTraders);
      }
      
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
        console.log(`[TRADERS PROVIDER] Retrying... attempt ${retryCount + 1}`);
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
      console.log(`[TRADERS PROVIDER] Setting loading states to false`);
      setLoading(false);
      setLoadingMore(false);
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
    const timeoutId = setTimeout(() => {
      setPage(1);
      setRetryCount(0);
      fetchTraders(1, false);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filter]);

  // Initial fetch
  useEffect(() => {
    fetchTraders(1, false);
  }, []);

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
