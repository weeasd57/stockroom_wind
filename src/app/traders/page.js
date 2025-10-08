'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useSupabase } from '@/providers/SupabaseProvider';
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
  const [firstPaintLogged, setFirstPaintLogged] = useState(false);
  const mountStartRef = useMemo(() => (typeof performance !== 'undefined' ? performance.now() : 0), []);

  // Animation effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Log mount to first visible paint
  useEffect(() => {
    if (visible && !firstPaintLogged) {
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      const delta = Math.max(0, Math.round(now - mountStartRef));
      console.log('[TRADERS] First visible paint after', `${delta}ms`);
      setFirstPaintLogged(true);
    }
  }, [visible, firstPaintLogged, mountStartRef]);

  // Fetch user followings when authenticated
  useEffect(() => {
    const fetchFollowings = async () => {
      if (!isAuthenticated || !user) return;
      
      try {
        const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
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
        const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
        console.log('[TRADERS] Followings fetched in', `${Math.max(0, Math.round(t1 - t0))}ms`, 'items:', data?.length || 0);
      } catch (error) {
        console.error('Error in fetchFollowings:', error);
      }
    };
    
    // Defer followings fetch slightly to avoid competing with initial paint
    const id = setTimeout(fetchFollowings, 200);
    return () => clearTimeout(id);
  }, [supabase, isAuthenticated, user]);

  // Navigation functions - Native navigation to avoid Next.js RSC prefetch
  const navigateToProfile = (userId) => {
    if (isAuthenticated && user && userId === user.id) {
      window.location.href = '/profile';
      return;
    }

    if (userId) {
      window.location.href = `/view-profile/${userId}`;
    }
  };

  // Handle follow click
  const handleFollowClick = async (e, userId) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      window.location.href = '/login';
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

  // Avatar Image Component using next/image with fixed dimensions
  const LazyImage = ({ src, alt, onError }) => {
    const safeSrc = src || '/default-avatar.svg';
    return (
      <Image
        src={safeSrc}
        alt={alt}
        width={64}
        height={64}
        sizes="64px"
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
                          <h3>{trader.username || 'username'}</h3>
                          <p className={styles.username}>{trader.full_name || (trader.username ? `@${trader.username}` : 'User')}</p>
                          {/* Telegram bot badge (list view) */}
                          {trader.hasTelegramBot && trader.botUsername && (
                            <a
                              href={`https://t.me/${String(trader.botUsername).replace(/^@/, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.telegramBadge}
                              onClick={(e) => e.stopPropagation()}
                              title={`Open ${String(trader.botUsername).replace(/^@/, '')} on Telegram`}
                            >
                              <svg
                                className={styles.telegramIcon}
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                aria-hidden="true"
                              >
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.37 6.79l-1.7 8.02c-.13.6-.48.75-.97.47l-2.67-1.97-1.29 1.25c-.14.14-.26.26-.53.26l.19-2.74 4.99-4.51c.22-.19-.05-.3-.34-.11l-6.16 3.88-2.66-.83c-.58-.18-.59-.58.12-.85l10.38-4c.48-.18.9.11.74.83z" />
                              </svg>
                              <span>Telegram bot</span>
                            </a>
                          )}
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
                        <h3>{trader.username || 'username'}</h3>
                        <p className={styles.username}>{trader.full_name || (trader.username ? `@${trader.username}` : 'User')}</p>
                        {/* Telegram bot badge (grid view) */}
                        {trader.hasTelegramBot && trader.botUsername && (
                          <a
                            href={`https://t.me/${String(trader.botUsername).replace(/^@/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.telegramBadge}
                            onClick={(e) => e.stopPropagation()}
                            title={`Open ${String(trader.botUsername).replace(/^@/, '')} on Telegram`}
                          >
                            <svg
                              className={styles.telegramIcon}
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
                              aria-hidden="true"
                            >
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.37 6.79l-1.7 8.02c-.13.6-.48.75-.97.47l-2.67-1.97-1.29 1.25c-.14.14-.26.26-.53.26l.19-2.74 4.99-4.51c.22-.19-.05-.3-.34-.11l-6.16 3.88-2.66-.83c-.58-.18-.59-.58.12-.85l10.38-4c.48-.18.9.11.74.83z" />
                            </svg>
                            <span>Telegram bot</span>
                          </a>
                        )}
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