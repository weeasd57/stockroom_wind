'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePosts } from '@/providers/PostProvider'; // Add PostProvider for real-time updates
import PostCard from '@/components/posts/PostCard';
import styles from '@/styles/home/PostsFeed.module.css';

// Unified PostsFeed component reusable across Home/Profile/View-Profile
// Props:
// - mode: 'home' | 'profile' | 'view-profile' (affects title copy only)
// - userId: when provided, feed will show posts for that user and hide controls
// - title: optional override title
// - hideControls: force hide header controls
// - showFlagBackground: pass-through to PostCard for future styling
export function PostsFeed({
  mode = 'home',
  userId,
  title,
  hideControls = false,
  showFlagBackground = true,
  hideUserInfo = false,
  // Optional external filters (used by profile/view-profile)
  selectedStrategy = '',
  selectedStatus = '',
  selectedCountry = '',
  selectedSymbol = '',
} = {}) {
  
  // Get posts from PostProvider for real-time updates
  const { feedPosts: providerPosts, fetchPosts, loadMore, hasMore, loadingMore, loading: providerLoading, error: providerError } = usePosts();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('following'); // following, all, trending
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, engagement, price_change
  const [categoryFilter, setCategoryFilter] = useState('all'); // all, buy, sell, analysis
  // Removed local following cache; PostProvider handles 'following' filtering

  // Helpers for external filters
  const matchesStatus = (post, statusFilter) => {
    if (!statusFilter) return true;
    if (statusFilter === 'success') return post.status === 'success' || post.target_reached === true;
    if (statusFilter === 'loss') return post.status === 'loss' || post.stop_loss_triggered === true;
    if (statusFilter === 'open') {
      return post.status === 'open' || (!post.status && !post.target_reached && !post.stop_loss_triggered);
    }
    return true;
  };

  const getPostCountry = (post) => {
    if (post.country) return String(post.country);
    if (post.symbol) {
      const parts = String(post.symbol).split('.');
      if (parts.length > 1) return parts[1];
    }
    return '';
  };

  const normalizeCountryCode = (val) => {
    if (!val) return '';
    const v = String(val).trim();
    if (v.length === 2) return v.toLowerCase();
    // if value is a name, we can't map here without a dict; fallback to lowercased value
    return v.toLowerCase();
  };

  const matchesCountry = (post, countryFilter) => {
    if (!countryFilter) return true;
    return normalizeCountryCode(getPostCountry(post)) === normalizeCountryCode(countryFilter);
  };

  const normalizeBaseSymbol = (s) => String(s || '').toUpperCase().split('.')[0];
  const matchesSymbol = (post, symbolFilter) => {
    if (!symbolFilter) return true;
    return normalizeBaseSymbol(post.symbol) === normalizeBaseSymbol(symbolFilter);
  };

  // Local following list removed to prevent double-filtering and races

  // Throttle fetch posts to prevent excessive calls
  const lastFetchRef = useRef(null);
  const fetchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Fetch posts with the appropriate filter when filter changes
  useEffect(() => {
    // Abort any pending fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const now = Date.now();
    if (lastFetchRef.current && (now - lastFetchRef.current) < 1000) {
      // Throttle to prevent rapid successive calls
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => {
        performFetch();
      }, 500);
      return;
    }
    
    performFetch();

    function performFetch() {
      lastFetchRef.current = Date.now();
      console.log(`[PostsFeed] Fetching posts. Filter: ${filter}, userId: ${userId || 'none'}`);
      
      if (userId) {
        // Profile/View-Profile: fetch only this user's posts
        fetchPosts(undefined, { userId });
      } else if (filter === 'following') {
        // Following feed: normally won't include self; keep explicit mode
        fetchPosts('following', { excludeCurrentUser: false });
      } else if (filter === 'trending') {
        // Home Trending: exclude current user's posts
        fetchPosts('trending', { excludeCurrentUser: true });
      } else {
        // Home All: exclude current user's posts
        fetchPosts('all', { excludeCurrentUser: true });
      }
    }

    // Cleanup timeout and abort controller on unmount
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filter, fetchPosts, userId]);

  // Update loading and error states from PostProvider
  // Show skeleton only if we have no posts yet; otherwise keep rendering while background refreshes
  useEffect(() => {
    const derivedLoading = providerLoading && (Array.isArray(providerPosts) ? providerPosts.length === 0 : true);
    setLoading(derivedLoading);
    setError(providerError);
  }, [providerLoading, providerError, providerPosts]);

  // Memoize posts array length to prevent unnecessary re-renders
  const postsLength = useMemo(() => providerPosts?.length || 0, [providerPosts]);
  const postsDataHash = useMemo(() => 
    providerPosts?.map(p => `${p.id}-${p.updated_at || p.created_at}`).join(',') || '',
    [providerPosts]
  );

  // Filter and sort posts based on current settings
  const filteredAndSortedPosts = useMemo(() => {
    if (!Array.isArray(providerPosts) || providerPosts.length === 0) {
      return [];
    }

    let filtered = [...providerPosts];

    // Skip client-side user filtering when userId provided - PostProvider already filtered
    // This prevents unnecessary re-filtering that was causing lag

    // Apply main filter
    // Note: When filter === 'following', PostProvider already fetched posts for followed users.
    // Avoid client-side re-filtering here to prevent timing issues.
    // For 'all' filter, we show all posts (no additional filtering)
    // For 'trending' filter, we'll sort by engagement later

    // Apply category filter
    if (categoryFilter === 'buy') {
      filtered = filtered.filter(post => post.sentiment === 'bullish');
    } else if (categoryFilter === 'sell') {
      filtered = filtered.filter(post => post.sentiment === 'bearish');
    }

    // Apply external filters when provided (profile/view-profile)
    if (selectedStrategy) {
      filtered = filtered.filter(post => String(post.strategy || '') === String(selectedStrategy));
    }
    if (selectedStatus) {
      filtered = filtered.filter(post => matchesStatus(post, selectedStatus));
    }
    if (selectedCountry) {
      filtered = filtered.filter(post => matchesCountry(post, selectedCountry));
    }
    if (selectedSymbol) {
      filtered = filtered.filter(post => matchesSymbol(post, selectedSymbol));
    }

    // Apply sorting
    switch (sortBy) {
      case 'date_asc':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'engagement':
        filtered.sort((a, b) => {
          const aEngagement = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
          const bEngagement = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
          return bEngagement - aEngagement;
        });
        break;
      case 'price_change':
        filtered.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
        break;
      default: // date_desc
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // For trending filter, prioritize by engagement regardless of sort
    if (!userId && filter === 'trending') {
      filtered.sort((a, b) => {
        const aEngagement = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
        const bEngagement = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
        return bEngagement - aEngagement;
      });
    }

    return filtered; // No client-side limit; pagination handled via PostProvider + Load More
  }, [postsDataHash, filter, sortBy, categoryFilter, userId, selectedStrategy, selectedStatus, selectedCountry, selectedSymbol]);

  // Use filtered posts instead of local posts state
  const posts = filteredAndSortedPosts;

  // Throttled console logging to prevent spam
  const lastLogRef = useRef(null);
  const logStateRef = useRef({ lastPostsLength: 0, lastFilter: '', lastLoading: false });

  if (posts.length !== logStateRef.current.lastPostsLength || 
      filter !== logStateRef.current.lastFilter || 
      loading !== logStateRef.current.lastLoading) {
    const now = Date.now();
    if (!lastLogRef.current || (now - lastLogRef.current) > 2000) {
      console.log(`[PostsFeed] Rendering with ${posts.length} posts. Loading: ${loading}, Filter: ${filter}`);
      lastLogRef.current = now;
    }
    logStateRef.current = { lastPostsLength: posts.length, lastFilter: filter, lastLoading: loading };
  }

  // (refactor) helpers moved into PostCard

  if (loading) {
    return (
      <div className={styles.postsFeed}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {title
              || (userId
                ? (mode === 'profile' || mode === 'view-profile' ? 'Recent Posts' : 'User Posts')
                : (filter === 'following' ? 'Following Posts' : 'Recent Posts'))}
          </h2>
        </div>
        <div className={styles.loadingContainer}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className={styles.postSkeleton}>
              <div className={styles.skeletonHeader}></div>
              <div className={styles.skeletonContent}></div>
              <div className={styles.skeletonFooter}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.postsFeed}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {title
              || (userId
                ? (mode === 'profile' || mode === 'view-profile' ? 'Recent Posts' : 'User Posts')
                : (filter === 'following' ? 'Following Posts' : 'Recent Posts'))}
          </h2>
        </div>
        <div className={styles.errorMessage}>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className={styles.postsFeed}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {title
              || (userId
                ? (mode === 'profile' || mode === 'view-profile' ? 'Recent Posts' : 'User Posts')
                : (filter === 'following' ? 'Following Posts' : 'Recent Posts'))}
          </h2>
          {!(hideControls || userId) && (
            <div className={styles.controls}>
              <div className={styles.filters}>
                <button 
                  className={`${styles.filterButton} ${filter === 'following' ? styles.active : ''}`}
                  onClick={() => setFilter('following')}
                >
                  Following
                </button>
                <button 
                  className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All
                </button>
                <button 
                  className={`${styles.filterButton} ${filter === 'trending' ? styles.active : ''}`}
                  onClick={() => setFilter('trending')}
                >
                  Trending
                </button>
              </div>
            </div>
          )}
        </div>
        <div className={styles.emptyState}>
          <p>
            {userId
              ? "This user hasn't posted anything yet."
              : (filter === 'following' 
                  ? "No posts from users you follow yet. Follow some traders to see their insights!" 
                  : "No posts yet. Be the first to share your trading insights!")
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.postsFeed}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {title
            || (userId
              ? (mode === 'profile' || mode === 'view-profile' ? 'Recent Posts' : 'User Posts')
              : (filter === 'following' ? 'Following Posts' : 'Recent Posts'))}
        </h2>
        {!(hideControls || userId) && (
          <div className={styles.controls}>
            <div className={styles.filters}>
              <button 
                className={`${styles.filterButton} ${filter === 'following' ? styles.active : ''}`}
                onClick={() => setFilter('following')}
              >
                Following
              </button>
              <button
                className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`${styles.filterButton} ${filter === 'trending' ? styles.active : ''}`}
                onClick={() => setFilter('trending')}
              >
                Trending
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.postsContainer}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} showFlagBackground={showFlagBackground} hideUserInfo={hideUserInfo} />
        ))}
      </div>

      {!userId && hasMore && (
        <div className={styles.loadMore}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className={styles.loadMoreButton}
          >
            {loadingMore ? 'Loading…' : 'Load More Posts'}
          </button>
        </div>
      )}
    </div>
  );
}

export default PostsFeed;