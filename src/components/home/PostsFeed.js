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
  // Optional external viewMode (used by profile/view-profile)
  viewMode: externalViewMode = null,
} = {}) {
  
  // Get posts from PostProvider for real-time updates
  const { feedPosts: providerPosts, fetchPosts, loadMore, hasMore, loadingMore, loading: providerLoading, error: providerError } = usePosts();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('following'); // following, all, trending
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, engagement, price_change
  const [categoryFilter, setCategoryFilter] = useState('all'); // all, buy, sell, analysis
  const [internalViewMode, setInternalViewMode] = useState('list'); // list, grid
  // Use external viewMode if provided, otherwise use internal state
  const viewMode = externalViewMode || internalViewMode;
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

  // Fetch posts with the appropriate filter when filter changes
  useEffect(() => {
    console.log(`[PostsFeed] useEffect for fetching posts fired. Filter: ${filter}, FetchPosts changed: ${typeof fetchPosts === 'function'}`);
    if (userId) {
      // Profile/View-Profile: do not exclude current user's posts
      fetchPosts();
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
  }, [filter, fetchPosts, userId]);

  // Update loading and error states from PostProvider
  // Show skeleton only if we have no posts yet; otherwise keep rendering while background refreshes
  useEffect(() => {
    const derivedLoading = providerLoading && (Array.isArray(providerPosts) ? providerPosts.length === 0 : true);
    setLoading(derivedLoading);
    setError(providerError);
  }, [providerLoading, providerError, providerPosts]);

  // Filter and sort posts based on current settings
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = [...providerPosts];

    // Apply user-specific filter first when userId is provided
    if (userId) {
      filtered = filtered.filter(post => post.user_id === userId);
    }

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
  }, [providerPosts, filter, sortBy, categoryFilter, userId, selectedStrategy, selectedStatus, selectedCountry, selectedSymbol]);

  // Use filtered posts instead of local posts state
  const posts = filteredAndSortedPosts;

  // Throttle console logging to reduce spam (only log every 2 seconds)
  const logRenderRef = useRef(null);
  const lastLogTime = useRef(0);
  
  const throttledLog = () => {
    const now = Date.now();
    if (now - lastLogTime.current >= 2000) { // Only log every 2 seconds
      console.log(`[PostsFeed] Rendering with ${posts.length} posts. Loading: ${loading}, Filter: ${filter}`);
      lastLogTime.current = now;
    }
  };
  
  // Only log in development mode and throttled
  if (process.env.NODE_ENV === 'development') {
    throttledLog();
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
        <div className={`${styles.loadingContainer} ${viewMode === 'grid' ? styles.gridView : styles.listView}`}>
          {[...Array(viewMode === 'grid' ? 6 : 3)].map((_, i) => (
            <div key={i} className={`${styles.postSkeleton} ${viewMode === 'grid' ? styles.gridSkeleton : ''}`}>
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
            <div className={styles.filtersAndView}>
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
              {!externalViewMode && (
                <div className={styles.viewToggle}>
                  <button 
                    className={`${styles.viewButton} ${internalViewMode === 'list' ? styles.active : ''}`}
                    onClick={() => setInternalViewMode('list')}
                    title="List View"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3.01" y2="6"></line>
                      <line x1="3" y1="12" x2="3.01" y2="12"></line>
                      <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                  </button>
                  <button 
                    className={`${styles.viewButton} ${internalViewMode === 'grid' ? styles.active : ''}`}
                    onClick={() => setInternalViewMode('grid')}
                    title="Grid View"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div 
        className={`${styles.postsContainer} ${viewMode === 'grid' ? styles.gridView : styles.listView}`}
        style={viewMode === 'grid' ? {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px',
          alignItems: 'start'
        } : {}}
      >
        {posts.map((post) => (
          <PostCard key={post.id} post={post} showFlagBackground={showFlagBackground} hideUserInfo={hideUserInfo} viewMode={viewMode} />
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