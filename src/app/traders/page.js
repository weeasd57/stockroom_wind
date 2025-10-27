'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useTraders } from '@/providers/TradersProvider';
import styles from '@/styles/traders.module.css';
import { calculateSuccessRate } from '@/lib/utils';
import TelegramSubscribeButton from '@/components/telegram/TelegramSubscribeButton';

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
  const [telegramBots, setTelegramBots] = useState({}); // Track telegram bot status
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

  // Fetch telegram bot status for all traders
  useEffect(() => {
    const fetchTelegramBots = async () => {
      if (!traders || traders.length === 0) return;
      
      try {
        const traderIds = traders.map(t => t.id);
        
        const { data, error } = await supabase
          .from('telegram_bots')
          .select('user_id, bot_token, is_active')
          .in('user_id', traderIds)
          .eq('is_active', true);
          
        if (error) {
          console.error('Error fetching telegram bots:', error);
          return;
        }
        
        const botsMap = {};
        data.forEach(bot => {
          botsMap[bot.user_id] = {
            hasBot: true,
            isActive: bot.is_active,
            hasToken: !!bot.bot_token
          };
        });
        
        setTelegramBots(botsMap);
      } catch (error) {
        console.error('Error in fetchTelegramBots:', error);
      }
    };
    
    fetchTelegramBots();
  }, [supabase, traders]);

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

  // Derived list: filter by country, telegram bot, and sort by selected key/order
  const displayedTraders = useMemo(() => {
    let list = Array.isArray(traders) ? [...traders] : [];

    // Filter by country
    if (country !== 'all') {
      const target = (country || '').toLowerCase();
      list = list.filter(t => (t?.countryCounts?.[target] || 0) > 0);
    }

    // Filter by telegram bot status
    if (filter === 'telegram') {
      list = list.filter(t => telegramBots[t.id]?.hasBot);
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
  }, [traders, country, sortKey, sortOrder, filter, telegramBots]);

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
        
        {/* Row 1: Main filters centered */}
        <div className={styles.mainFiltersRow}>
          <button 
            className={`${styles.filterButton} ${filter === 'telegram' ? styles.active : ''}`}
            onClick={() => setFilter(filter === 'telegram' ? '' : 'telegram')}
          >
            📱 With Telegram Bot
          </button>
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

        {/* Row 2: View controls on the right */}
        <div className={styles.viewControlsRow}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              className={`${styles.viewToggleButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
          <button
            className={`${styles.sortButton} ${sortOrder === 'desc' ? styles.active : ''}`}
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 16 4 4 4-4"></path>
                <path d="M7 20V4"></path>
                <path d="m21 8-4-4-4 4"></path>
                <path d="M17 4v16"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 8 4-4 4 4"></path>
                <path d="M7 4v16"></path>
                <path d="m21 16-4 4-4-4"></path>
                <path d="M17 20V4"></path>
              </svg>
            )}
          </button>
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
                          <div className={styles.traderNameRow}>
                            <h3>{trader.full_name || 'Trader'}</h3>
                            {telegramBots[trader.id]?.hasBot && (
                              <div className={styles.telegramBadge} title="Has active Telegram bot">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                </svg>
                              </div>
                            )}
                          </div>
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
                      
                      {/* Follow button and Telegram Subscribe */}
                      <div className={styles.cardActions}>
                        {isAuthenticated && user?.id !== trader.id && (
                          <>
                            <button
                              className={followings[trader.id] ? styles.unfollowButton : styles.followButton}
                              onClick={(e) => handleFollowClick(e, trader.id)}
                            >
                              {followings[trader.id] ? 'Unfollow' : 'Follow'}
                            </button>
                            <div style={{ marginTop: '8px' }}>
                              <TelegramSubscribeButton 
                                brokerUserId={trader.id} 
                                brokerName={trader.full_name || trader.username}
                                compact={true}
                              />
                            </div>
                          </>
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
                        <div className={styles.traderNameRow}>
                          <h3>{trader.full_name || 'Trader'}</h3>
                          {telegramBots[trader.id]?.hasBot && (
                            <div className={styles.telegramBadge} title="Has active Telegram bot">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                              </svg>
                            </div>
                          )}
                        </div>
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
                        <>
                          <button
                            className={followings[trader.id] ? styles.unfollowButton : styles.followButton}
                            onClick={(e) => handleFollowClick(e, trader.id)}
                          >
                            {followings[trader.id] ? 'Unfollow' : 'Follow'}
                          </button>
                          <div style={{ marginTop: '8px', width: '100%' }}>
                            <TelegramSubscribeButton 
                              brokerUserId={trader.id} 
                              brokerName={trader.full_name || trader.username}
                              compact={true}
                            />
                          </div>
                        </>
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