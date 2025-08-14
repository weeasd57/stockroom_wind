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
}

const TradersContext = createContext<TradersContextType | undefined>(undefined);

// Cache for traders data
const tradersCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ITEMS_PER_PAGE = 12;

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

  console.log('[TRADERS PROVIDER] Component initialized');

  // Function to clear cache
  const clearCache = useCallback(() => {
    console.log('[TRADERS PROVIDER] Clearing cache');
    tradersCache.clear();
  }, []);

  // Fetch traders function
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
      const cacheKey = `traders_page_${pageNum}_${ITEMS_PER_PAGE}`;
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

      // Fetch profiles from database
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, bio, avatar_url, created_at, followers, following')
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      console.log(`[TRADERS PROVIDER] Database query completed. Error:`, profilesError);
      console.log(`[TRADERS PROVIDER] Found ${profilesData?.length || 0} profiles`);

      if (profilesError) {
        throw profilesError;
      }

      // Get post counts for each user (simplified version)
      const postCountsPromises = (profilesData || []).map(async (profile) => {
        try {
          const { count } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);
          
          return { userId: profile.id, count: count || 0 };
        } catch (error) {
          console.warn(`[TRADERS PROVIDER] Failed to get post count for user ${profile.id}:`, error);
          return { userId: profile.id, count: 0 };
        }
      });

      const postCounts = await Promise.all(postCountsPromises);
      const postCountsMap = postCounts.reduce((acc, { userId, count }) => {
        acc[userId] = count;
        return acc;
      }, {} as Record<string, number>);

      // Process the data
      const processedTraders = (profilesData || []).map(profile => ({
        ...profile,
        avatar_url: profile.avatar_url || '/default-avatar.svg',
        post_count: postCountsMap[profile.id] || 0,
        followers: profile.followers || 0,
        following: profile.following || 0,
      }));

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
      setError(error.message || 'Failed to load traders');
      
      if (!isLoadMore) {
        setTraders([]);
      }
    } finally {
      console.log(`[TRADERS PROVIDER] Setting loading states to false`);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [supabase]);

  // Load more function
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTraders(nextPage, true);
    }
  }, [page, loadingMore, hasMore, loading, fetchTraders]);

  // Refresh traders function
  const refreshTraders = useCallback(() => {
    console.log('[TRADERS PROVIDER] Refreshing traders');
    clearCache();
    setPage(1);
    fetchTraders(1, false);
  }, [fetchTraders, clearCache]);

  // Initial load
  useEffect(() => {
    console.log('[TRADERS PROVIDER] Initial load triggered');
    fetchTraders(1, false);
  }, [fetchTraders]);

  // Filter traders based on search query and filter
  const filteredTraders = React.useMemo(() => {
    let filtered = traders;

    // Exclude current user if authenticated
    if (isAuthenticated && user) {
      filtered = filtered.filter(trader => trader.id !== user.id);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(trader => 
        trader.full_name?.toLowerCase().includes(query) || 
        trader.username?.toLowerCase().includes(query) ||
        trader.bio?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filter === 'top') {
      filtered = filtered.filter(trader => trader.post_count > 0);
      filtered.sort((a, b) => b.post_count - a.post_count);
    } else if (filter === 'trending') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      filtered = filtered.filter(trader => 
        new Date(trader.created_at) > oneMonthAgo
      );
    }

    console.log(`[TRADERS PROVIDER] Filtered to ${filtered.length} traders from ${traders.length} total`);
    return filtered;
  }, [traders, isAuthenticated, user, searchQuery, filter]);

  const value = {
    traders: filteredTraders,
    loading,
    error,
    searchQuery,
    filter,
    hasMore: hasMore && !searchQuery && filter === 'all', // Only show load more for unfiltered results
    // Actions
    setSearchQuery,
    setFilter,
    loadMore,
    refreshTraders,
    clearCache,
  };

  return (
    <TradersContext.Provider value={value}>
      {children}
    </TradersContext.Provider>
  );
};

export const useTraders = () => {
  const context = useContext(TradersContext);
  if (context === undefined) {
    throw new Error('useTraders must be used within a TradersProvider');
  }
  return context;
};
