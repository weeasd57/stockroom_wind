'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePosts } from '@/providers/PostProvider'; // Add PostProvider for real-time updates
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
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
  const { 
    fetchPosts, 
    loading: providerLoading, 
    posts: providerPosts, 
    error: providerError,
    onPostCreated,
    myPosts,
    myLoading,
    myHasMore,
    loadMoreMyPosts,
    updateUserPosts,
    hasMore,
    loadMore,
    loadingMore 
  } = usePosts();
  const { getPostsPage, user } = useSupabase();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('following'); // following, all, trending
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, engagement, price_change
  const [categoryFilter, setCategoryFilter] = useState('all'); // all, buy, sell, analysis
  const [internalViewMode, setInternalViewMode] = useState('list'); // list, grid
  const [mounted, setMounted] = useState(false);
  // Use external viewMode if provided, otherwise use internal state
  const viewMode = externalViewMode || internalViewMode;
  // In profile page, we always render the current user's posts
  const isSelfProfile = mode === 'profile';

  // User-specific feed (for profile/view-profile). We fetch directly by userId to avoid pagination mismatch.
  const [userPosts, setUserPosts] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userHasMore, setUserHasMore] = useState(false);
  const userBeforeCursorRef = useRef(null);
  
  // View mode storage key
  const VIEW_MODE_STORAGE_KEY = "sharkszone-viewmode";
  // Removed local following cache; PostProvider handles 'following' filtering

  const matchesStatus = (post, statusFilter) => {
    if (!statusFilter) return true;
    if (statusFilter === 'success') return post.status === 'success' || post.target_reached === true;
    if (statusFilter === 'loss') return post.status === 'loss' || post.stop_loss_triggered === true;
    if (statusFilter === 'open') {
      return post.status === 'open' || (!post.status && !post.target_reached && !post.stop_loss_triggered);
    }
    return true;
  };

  // Extract country code from post (either explicit country or from symbol suffix like AAPL.US)
  const getPostCountry = (post) => {
    if (post?.country) return String(post.country);
    if (post?.symbol) {
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

  // Initialize view mode from localStorage only after component is mounted
  useEffect(() => {
    setMounted(true);
    try {
      const storedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (storedViewMode && (storedViewMode === 'list' || storedViewMode === 'grid')) {
        setInternalViewMode(storedViewMode);
      }
    } catch (error) {
      console.error("Error accessing localStorage for view mode:", error);
    }
  }, [VIEW_MODE_STORAGE_KEY]);

  // Save view mode to localStorage whenever it changes, but only after mounted
  useEffect(() => {
    if (!mounted) return;
    
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, internalViewMode);
    } catch (error) {
      console.error("Error saving view mode to localStorage:", error);
    }
  }, [internalViewMode, mounted, VIEW_MODE_STORAGE_KEY]);

  // Fetch posts with the appropriate filter when filter changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PostsFeed] useEffect for fetching posts fired. Filter: ${filter}, FetchPosts changed: ${typeof fetchPosts === 'function'}`);
    }
    if (isSelfProfile || userId) {
      // For profile/view-profile, we fetch directly via getPostsPage in a separate effect.
      return;
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

  // Fetch user posts directly when userId is provided (profile/view-profile)
  useEffect(() => {
    if (!userId || isSelfProfile) return;
    let canceled = false;
    const PAGE_SIZE = 20;

    const run = async () => {
      setUserLoading(true);
      try {
        const page = await getPostsPage({ limit: PAGE_SIZE, before: null, userIds: [userId] });
        if (canceled) return;
        const list = Array.isArray(page) ? page : [];
        setUserPosts(list);
        userBeforeCursorRef.current = list.length > 0 ? String(list[list.length - 1].created_at) : null;
        setUserHasMore(list.length === PAGE_SIZE);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[PostsFeed] User posts fetched:', {
            userId,
            fetchedCount: list.length,
            mode,
            updatedProvider: false
          });
        }
      } catch (e) {
        console.error('[PostsFeed] Failed to fetch user posts:', e);
        setUserPosts([]);
        setUserHasMore(false);
      } finally {
        if (!canceled) setUserLoading(false);
      }
    };

    run();
    return () => { canceled = true; };
  }, [userId, isSelfProfile, getPostsPage]);

  // Update loading and error states from PostProvider
  // Show skeleton only if we have no posts yet; otherwise keep rendering while background refreshes
  useEffect(() => {
    let derivedLoading;
    if (isSelfProfile) {
      derivedLoading = myLoading && (Array.isArray(myPosts) ? myPosts.length === 0 : true);
    } else if (userId) {
      derivedLoading = userLoading && (Array.isArray(userPosts) ? userPosts.length === 0 : true);
    } else {
      derivedLoading = providerLoading && (Array.isArray(providerPosts) ? providerPosts.length === 0 : true);
    }
    setLoading(derivedLoading);
    setError(providerError);
  }, [providerLoading, providerError, providerPosts, isSelfProfile, userId, myLoading, myPosts, userLoading, userPosts]);

  // Listen for new posts to update userPosts when in profile/view-profile mode
  useEffect(() => {
    if (!onPostCreated || !userId) return;

    const unsubscribe = onPostCreated((newPost) => {
      // Only update if it's a post from the user we're viewing
      if (newPost.user_id === userId) {
        console.log('[PostsFeed] New post created for viewed user, updating userPosts');
        setUserPosts(prev => [newPost, ...prev]);
      }
    });

    return unsubscribe;
  }, [onPostCreated, userId]);

  // Provider owns myPosts now; no external sync from PostsFeed

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

  // Source posts for profile mode (provider-owned for self, local for others)
  const profileSourcePosts = isSelfProfile ? myPosts : userPosts;

  // Filtered user posts for profile mode with external filters
  const filteredUserPosts = useMemo(() => {
    if (!userId || profileSourcePosts.length === 0) return profileSourcePosts;
    
    let filtered = [...profileSourcePosts];

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

    if (process.env.NODE_ENV === 'development') {
      console.log('[PostsFeed] Profile filters applied:', {
        originalCount: profileSourcePosts.length,
        filteredCount: filtered.length,
        filters: {
          selectedStrategy,
          selectedStatus,
          selectedCountry,
          selectedSymbol,
          categoryFilter,
          sortBy
        }
      });
    }

    return filtered;
  }, [profileSourcePosts, myPosts, userPosts, sortBy, categoryFilter, selectedStrategy, selectedStatus, selectedCountry, selectedSymbol]);

  // Use filtered posts - either filteredUserPosts for profile mode or filteredAndSortedPosts for home mode
  const posts = (isSelfProfile || userId) ? filteredUserPosts : filteredAndSortedPosts;
  
  // Debug post count differences (throttled)
  const lastPostCountLogTime = useRef(0);
  const logPostCountComparison = () => {
    const now = Date.now();
    if (now - lastPostCountLogTime.current >= 3000) { // Only log every 3 seconds
      console.log('[PostsFeed] Post count comparison:', {
        userId,
        mode,
        userPostsCount: (isSelfProfile ? (myPosts?.length || 0) : (userPosts?.length || 0)),
        providerPostsCount: providerPosts.length,
        selectedUserId: userId,
        usingSelfProvider: isSelfProfile
      });
      lastPostCountLogTime.current = now;
    }
  };
  
  if (userId && process.env.NODE_ENV === 'development') {
    logPostCountComparison();
  }

  // Throttle console logging to reduce spam (only log every 2 seconds)
  const logRenderRef = useRef(null);
  const lastLogTime = useRef(0);
  
  const throttledLog = () => {
    const now = Date.now();
    if (now - lastLogTime.current >= 5000) { // Only log every 5 seconds (less frequent)
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

      {(isSelfProfile || userId) ? (
        isSelfProfile
          ? (
            myHasMore && (
              <div className={styles.loadMore}>
                <button
                  onClick={loadMoreMyPosts}
                  disabled={myLoading}
                  className={styles.loadMoreButton}
                >
                  {myLoading ? 'Loading…' : 'Load More Posts'}
                </button>
              </div>
            )
          ) : (
            userHasMore && (
              <div className={styles.loadMore}>
                <button
                  onClick={async () => {
                    if (userLoading) return;
                    const before = userBeforeCursorRef.current;
                    if (!before) { setUserHasMore(false); return; }
                    setUserLoading(true);
                    try {
                      const PAGE_SIZE = 20;
                      const page = await getPostsPage({ limit: PAGE_SIZE, before, userIds: [userId] });
                      const list = Array.isArray(page) ? page : [];
                      setUserPosts(prev => [...prev, ...list]);
                      userBeforeCursorRef.current = list.length > 0 ? String(list[list.length - 1].created_at) : null;
                      setUserHasMore(list.length === PAGE_SIZE);
                    } catch (e) {
                      console.error('[PostsFeed] Failed to load more user posts:', e);
                    } finally {
                      setUserLoading(false);
                    }
                  }}
                  disabled={userLoading}
                  className={styles.loadMoreButton}
                >
                  {userLoading ? 'Loading…' : 'Load More Posts'}
                </button>
              </div>
            )
          )
      ) : (
        hasMore && (
          <div className={styles.loadMore}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={styles.loadMoreButton}
            >
              {loadingMore ? 'Loading…' : 'Load More Posts'}
            </button>
          </div>
        )
      )}
    </div>
  );
}

export default PostsFeed;