'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useTraders } from '@/providers/TradersProvider';
import styles from '@/styles/traders.module.css';
import { calculateSuccessRate } from '@/lib/utils';

// Removed unused imports for cleaner code

export default function TradersPage() {
  const { supabase, isAuthenticated, user } = useSupabase();
  const {
    traders,
    loading,
    error,
    searchQuery,
    filter,
    hasMore,
    setSearchQuery,
    setFilter,
    loadMore,
    refreshTraders
  } = useTraders();
  
  const [visible, setVisible] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [sortKey, setSortKey] = useState('experience_score');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [country, setCountry] = useState('all');
  const [followings, setFollowings] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();

  // Animation effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Fetch user followings when authenticated
  useEffect(() => {
    const fetchFollowings = async () => {
      if (!isAuthenticated || !user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_followings')
          .select('following_id')
          .eq('follower_id', user.id);
          
        if (error) {
          console.error('Error fetching followings:', error);
          return;
        }
        
        const followingsMap = {};
        data.forEach(item => {
          followingsMap[item.following_id] = true;
        });
        
        setFollowings(followingsMap);
      } catch (error) {
        console.error('Error in fetchFollowings:', error);
      }
    };
    
    fetchFollowings();
  }, [supabase, isAuthenticated, user]);

  // Navigation functions
  const navigateToProfile = (userId) => {
    if (isAuthenticated && user && userId === user.id) {
      router.push('/profile');
      return;
    }
    
    if (userId) {
      router.push(`/view-profile/${userId}`);
    }
  };

  // Handle follow click
  const handleFollowClick = async (e, userId) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    try {
      const isFollowing = followings[userId];
      
      if (isFollowing) {
        // Unfollow
        const { error: deleteError } = await supabase
          .from('user_followings')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
          
        if (deleteError) {
          throw deleteError;
        }
        
        const updatedFollowings = { ...followings };
        delete updatedFollowings[userId];
        setFollowings(updatedFollowings);
        
        console.log('Unfollowed user:', userId);
      } else {
        // Follow
        const { error: insertError } = await supabase
          .from('user_followings')
          .insert([
            { follower_id: user.id, following_id: userId }
          ]);
          
        if (insertError) {
          throw insertError;
        }
        
        setFollowings({ ...followings, [userId]: true });
        
        console.log('Followed user:', userId);
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      alert('There was an error updating your following status');
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      loadMore();
      // Reset loading state after a delay
      setTimeout(() => setLoadingMore(false), 1000);
    }
  };

  // Lazy Image Component
  const LazyImage = ({ src, alt, profileId, onError }) => {
    return (
      <img 
        src={src || '/default-avatar.svg'}
        alt={alt}
        onError={onError}
      />
    );
  };

  // Build unique countries aggregated from all users' countryCounts
  const countries = useMemo(() => {
    const set = new Set();
    (traders || []).forEach(t => {
      const cc = t?.countryCounts || {};
      Object.keys(cc).forEach(code => {
        if (code && typeof code === 'string' && code.trim()) set.add(code.toUpperCase());
      });
    });
    return Array.from(set).sort();
  }, [traders]);

  // Derived list: filter by country and sort by selected key/order
  const displayedTraders = useMemo(() => {
    let list = Array.isArray(traders) ? [...traders] : [];

    if (country !== 'all') {
      const target = (country || '').toLowerCase();
      list = list.filter(t => (t?.countryCounts?.[target] || 0) > 0);
    }

    const key = sortKey;
    const dir = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = (a?.[key] ?? 0) || 0;
      const bv = (b?.[key] ?? 0) || 0;
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
    return list;
  }, [traders, country, sortKey, sortOrder]);

  // Show error state
  if (error) {
    return (
      <div className={`${styles.tradersPage} ${visible ? styles.visible : ''}`}>
        <div className={styles.pageHeader}>
          <h1>Top Traders</h1>
          <p>Follow and learn from successful traders in the community</p>
        </div>
        
        <div className={styles.errorContainer}>
          <p>Error loading traders: {error}</p>
          <button onClick={refreshTraders} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.tradersPage} ${visible ? styles.visible : ''}`}>
      <div className={styles.pageHeader}>
        <h1>Top Traders</h1>
        <p>Follow and learn from successful traders in the community</p>
      </div>
      
      <div className={styles.filtersContainer}>
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search traders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <div className={styles.filterButtons}>
          <button 
            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All Traders
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'top' ? styles.active : ''}`}
            onClick={() => setFilter('top')}
          >
            Top Traders
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'trending' ? styles.active : ''}`}
            onClick={() => setFilter('trending')}
          >
            Trending
          </button>
        </div>

        {/* Controls: view toggle, sort, order, country */}
        <div className={styles.controlsRow}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              className={`${styles.toggleButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
          <select
            className={styles.select}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            <option value="experience_score">Experience</option>
            <option value="success_posts">Success</option>
            <option value="loss_posts">Loss</option>
            <option value="followers">Followers</option>
            <option value="post_count">Posts</option>
          </select>
          <button
            className={styles.toggleButton}
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
          </button>
          <select
            className={styles.select}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      
      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading traders...</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? styles.tradersGrid : styles.tradersList}>
          {displayedTraders.length > 0 ? (
            displayedTraders.map(trader => (
              <div key={trader.id} className={`${styles.traderCard} ${viewMode === 'list' ? styles.traderCardRow : ''}`}>
                {/* Conditional layout based on view mode */}
                {viewMode === 'list' ? (
                  <>
                    {/* Two column layout for list view */}
                    {/* Column 1: User info, bio, and flags */}
                    <div className={styles.leftColumn}>
                      <div 
                        className={styles.traderHeader}
                        onClick={() => navigateToProfile(trader.id)}
                      >
                        <div className={styles.traderAvatar}>
                          <LazyImage
                            src={trader.avatar_url || '/default-avatar.svg'}
                            alt={trader.username}
                            profileId={trader.id}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/default-avatar.svg';
                            }}
                          />
                        </div>
                        <div className={styles.traderInfo}>
                          <h3>{trader.full_name || trader.username || 'Trader'}</h3>
                          <p className={styles.username}>@{trader.username || 'username'}</p>
                        </div>
                      </div>
                      
                      <p className={styles.traderBio}>{trader.bio || 'No bio available'}</p>
                      
                      {/* Country flags with counts (top 6 by count) */}
                      <div className={styles.countriesRow}>
                        {Object.entries(trader.countryCounts || {})
                          .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                          .slice(0, 6)
                          .map(([code, count]) => (
                            <div key={code} className={styles.countryBadge} title={`${code.toUpperCase()}: ${count}`}>
                              <span className={`fi fi-${String(code).toLowerCase()}`}></span>
                              <span className={styles.countryCount}>{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                    
                    {/* Column 2: Stats and follow button */}
                    <div className={styles.rightColumn}>
                      {/* Stats section */}
                      <div className={styles.traderStats}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Experience</span>
                          <span className={styles.statValue}>{Math.round(trader.experience_score || 0)}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Posts</span>
                          <span className={styles.statValue}>{trader.post_count || 0}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Followers</span>
                          <span className={styles.statValue}>{trader.followers || 0}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Success Rate</span>
                          <span className={styles.statValue}>
                            {`${calculateSuccessRate(trader.success_posts || 0, trader.loss_posts || 0)}%`}
                          </span>
                        </div>
                      </div>
                      
                      {/* Follow button */}
                      <div className={styles.cardActions}>
                        {isAuthenticated && user?.id !== trader.id && (
                          <button
                            className={followings[trader.id] ? styles.unfollowButton : styles.followButton}
                            onClick={(e) => handleFollowClick(e, trader.id)}
                          >
                            {followings[trader.id] ? 'Unfollow' : 'Follow'}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Grid layout: Keep original structure */}
                    <div 
                      className={styles.traderHeader}
                      onClick={() => navigateToProfile(trader.id)}
                    >
                      <div className={styles.traderAvatar}>
                        <LazyImage
                          src={trader.avatar_url || '/default-avatar.svg'}
                          alt={trader.username}
                          profileId={trader.id}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default-avatar.svg';
                          }}
                        />
                      </div>
                      <div className={styles.traderInfo}>
                        <h3>{trader.full_name || trader.username || 'Trader'}</h3>
                        <p className={styles.username}>@{trader.username || 'username'}</p>
                      </div>
                    </div>
                    
                    <div className={styles.traderStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Experience</span>
                        <span className={styles.statValue}>{Math.round(trader.experience_score || 0)}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Posts</span>
                        <span className={styles.statValue}>{trader.post_count || 0}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Followers</span>
                        <span className={styles.statValue}>{trader.followers || 0}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Success Rate</span>
                        <span className={styles.statValue}>
                          {`${calculateSuccessRate(trader.success_posts || 0, trader.loss_posts || 0)}%`}
                        </span>
                      </div>
                    </div>
                    
                    <p className={styles.traderBio}>{trader.bio || 'No bio available'}</p>
                    
                    {/* Country flags with counts (top 6 by count) */}
                    <div className={styles.countriesRow}>
                      {Object.entries(trader.countryCounts || {})
                        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                        .slice(0, 6)
                        .map(([code, count]) => (
                          <div key={code} className={styles.countryBadge} title={`${code.toUpperCase()}: ${count}`}>
                            <span className={`fi fi-${String(code).toLowerCase()}`}></span>
                            <span className={styles.countryCount}>{count}</span>
                          </div>
                        ))}
                    </div>
                    
                    {/* Actions at bottom of the card */}
                    <div className={styles.cardActions}>
                      {isAuthenticated && user?.id !== trader.id && (
                        <button
                          className={followings[trader.id] ? styles.unfollowButton : styles.followButton}
                          onClick={(e) => handleFollowClick(e, trader.id)}
                        >
                          {followings[trader.id] ? 'Unfollow' : 'Follow'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className={styles.noResults}>
              <p>No traders found matching your criteria</p>
            </div>
          )}
        </div>
      )}
      
      {/* Load More Button */}
      {!loading && hasMore && traders.length > 0 && (
        <div className={styles.loadMoreContainer}>
          <button 
            className={styles.loadMoreButton}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <div className={styles.buttonSpinner}></div>
                Loading more...
              </>
            ) : (
              'Load More Traders'
            )}
          </button>
        </div>
      )}
    </div>
  );
}