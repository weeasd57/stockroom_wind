'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, useEffect, useMemo } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import styles from '@/styles/view-profile.module.css';
import '@/styles/StrategyDetailsGlobal.css';
import { useFollow } from '@/providers/FollowProvider';
import PostCard from '@/components/posts/PostCard';
import PostsFeed from '@/components/home/PostsFeed';
import TelegramSubscribeButton from '@/components/telegram/TelegramSubscribeButton';
import SocialLinks from '@/components/profile/SocialLinks';
import StrategyDetailsModal from '@/components/profile/StrategyDetailsModal';

// Local cache for profile data
const profileCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
export default function ViewProfile({ params }) {
  const { supabase, isAuthenticated, user } = useSupabase();
  const router = useRouter();
  const { isFollowing, toggleFollow, checkIsFollowing, loading: followLoading, error: followError } = useFollow(); // Use useFollow hook
  const hasFetchedRef = useRef({});
  
  // Try to get ProfileProvider for updating follow counts
  let profileContext;
  try {
    profileContext = useProfile();
  } catch (e) {
    // ProfileProvider not available in this context, that's okay
    console.log('[VIEW-PROFILE] ProfileProvider not available');
  }
  
  // Make sure to extract the ID correctly from params
  const userId = params?.id;
  console.log("[VIEW-PROFILE] Component loaded with params:", params);
  console.log("[VIEW-PROFILE] Extracted userId:", userId);
  
  // Progressive loading states
  const [basicDataLoading, setBasicDataLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [backgroundUrl, setBackgroundUrl] = useState('https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
  const [error, setError] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [hasTelegramBot, setHasTelegramBot] = useState(false);
  const [telegramBotLoading, setTelegramBotLoading] = useState(true);
  const [postsViewMode, setPostsViewMode] = useState('table');
  const searchParams = useSearchParams();
  // Local tabs and strategies state for view-profile
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'strategies'
  const [strategies, setStrategies] = useState([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);
  const [strategyModalName, setStrategyModalName] = useState('');
  const [strategyPosts, setStrategyPosts] = useState([]);
  const [strategyPostsLoading, setStrategyPostsLoading] = useState(false);
  // Strategy filter for posts
  const [strategyFilter, setStrategyFilter] = useState('');

  // Derived stats for current strategy (for dialog results section)
  const strategyStats = useMemo(() => {
    const total = strategyPosts.length || 0;
    const success = strategyPosts.filter(p => !!p?.target_reached).length;
    const loss = strategyPosts.filter(p => !!p?.stop_loss_triggered).length;
    const active = Math.max(0, total - success - loss);
    const pct = (n) => (total ? Math.round((n * 100) / total) : 0);
    return {
      total,
      success,
      loss,
      active,
      successPct: pct(success),
      lossPct: pct(loss),
      activePct: pct(active),
      successRate: total ? Math.round((success / total) * 100) : 0,
    };
  }, [strategyPosts]);

  // Fetch profile data
  useEffect(() => {
    // Only redirect if there's definitely no user ID
    if (userId === undefined || userId === null) {
      router.push('/home');
      return;
    }

    // Wait until supabase client is ready
    if (!supabase) {
      return;
    }

    // Prevent double-fetch in React Strict Mode (dev)
    if (hasFetchedRef.current[userId]) {
      return;
    }
    hasFetchedRef.current[userId] = true;

    let isCancelled = false;
    const controller = new AbortController();

    const safeSetState = (setter) => {
      if (!isCancelled) setter();
    };

    const fetchProfileData = async () => {
      try {
        console.log('[VIEW-PROFILE] Starting to fetch profile data for userId:', userId);
        
        // Check cache first
        const cacheKey = `profile_${userId}`;
        const cached = profileCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
          console.log('[VIEW-PROFILE] Using cached profile data');
          setProfileData(cached.data);
          setAvatarUrl(cached.data.avatar_url || '/default-avatar.svg');
          setBackgroundUrl(cached.data.background_url || 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
          setBasicDataLoading(false);
          setShowSkeleton(false);
          // Still fetch fresh data in background
        }
        
        setError(null);
        const TIMEOUT_MS = 25000;
        const withTimeoutAbort = async (fn, ms = TIMEOUT_MS) => {
          const timeoutId = setTimeout(() => controller.abort(), ms);
          try {
            return await fn();
          } catch (e) {
            // Normalize abort/timeout errors
            if (
              (e && (e.name === 'AbortError' || e.message?.includes('aborted'))) ||
              e?.message === 'Failed to fetch'
            ) {
              throw new Error('Request timed out');
            }
            throw e;
          } finally {
            clearTimeout(timeoutId);
          }
        };
        
        // Fetch user profile
        console.log('[VIEW-PROFILE] Fetching profile from database...');
        let profile, profileError;
        try {
          const res = await withTimeoutAbort(
            () =>
              supabase
                .from('profiles')
                .select('id, username, avatar_url, background_url, bio, followers, following, created_at, experience_score, success_posts, loss_posts, facebook_url, telegram_url, youtube_url')
                .eq('id', userId)
                .maybeSingle()
                .abortSignal(controller.signal)
          );
          profile = res.data;
          profileError = res.error;
        } catch (e) {
          if (e && e.message === 'Request timed out') {
            // Single retry with a longer timeout
            const res = await withTimeoutAbort(
              () =>
                supabase
                  .from('profiles')
                  .select('id, username, avatar_url, background_url, bio, followers, following, created_at, experience_score, success_posts, loss_posts, facebook_url, telegram_url, youtube_url')
                  .eq('id', userId)
                  .maybeSingle()
                  .abortSignal(controller.signal),
              30000
            );
            profile = res.data;
            profileError = res.error;
          } else {
            throw e;
          }
        }
          
        console.log('[VIEW-PROFILE] Profile query result:', { profile: !!profile, error: profileError });
          
        if (profileError) {
          throw profileError;
        }
        
        if (!profile) {
          throw new Error('Profile not found');
        }
        
        // Set basic profile data immediately
        safeSetState(() => {
          setProfileData(profile);
          setBasicDataLoading(false);
          setShowSkeleton(false);
        });
        
        // Cache the basic profile data
        profileCache.set(cacheKey, {
          data: profile,
          timestamp: Date.now()
        });

        // Fetch additional stats in background (non-blocking)
        setTimeout(async () => {
          try {
            const { count: postsCount } = await supabase
              .from('posts')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId);
            safeSetState(() => {
              setProfileData(prev => prev ? { ...prev, posts_count: postsCount || 0 } : prev);
              setStatsLoading(false);
            });
          } catch (e) {
            console.log('[VIEW-PROFILE] Failed to fetch posts count:', e);
            safeSetState(() => {
              setProfileData(prev => prev ? { ...prev, posts_count: 0 } : prev);
              setStatsLoading(false);
            });
          }
        }, 100);
        
        // Try to get avatar and background images
        if (profile.avatar_url) {
          safeSetState(() => setAvatarUrl(profile.avatar_url));
        } else {
          try {
            const { data: avatarData } = await supabase
              .storage
              .from('avatars')
              .getPublicUrl(`${userId}/avatar.png`);
              
            if (avatarData?.publicUrl) {
              safeSetState(() => setAvatarUrl(`${avatarData.publicUrl}?t=${Date.now()}`));
            }
          } catch (e) {
            safeSetState(() => setAvatarUrl('/default-avatar.svg'));
          }
        }
        
        if (profile.background_url) {
          safeSetState(() => setBackgroundUrl(profile.background_url));
        } else {
          try {
            const { data: bgData } = await supabase
              .storage
              .from('backgrounds')
              .getPublicUrl(`${userId}/background.png`);
              
            if (bgData?.publicUrl) {
              safeSetState(() => setBackgroundUrl(`${bgData.publicUrl}?t=${Date.now()}`));
            }
          } catch (e) {
            // no-op
          }
        }
        
      } catch (error) {
        console.error('[VIEW-PROFILE] Error fetching profile:', error);
        safeSetState(() => {
          setError(error.message);
          setBasicDataLoading(false);
          setStatsLoading(false);
          setShowSkeleton(false);
        });
      }
    };

    fetchProfileData();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [userId, supabase]);

  // Apply view mode from query parameter (e.g. ?view=table or ?vm=grid)
  useEffect(() => {
    try {
      const v = (searchParams?.get('view') || searchParams?.get('vm') || '').toLowerCase();
      if (v === 'table' || v === 'grid' || v === 'list') {
        setPostsViewMode(v);
      }
    } catch {}
  }, [searchParams]);

  // Check if user has active Telegram bot
  useEffect(() => {
    if (!userId || !supabase) return;

    const checkTelegramBot = async () => {
      try {
        const { data, error } = await supabase
          .from('telegram_bots')
          .select('id, is_active, bot_token')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Error checking telegram bot:', error);
          setHasTelegramBot(false);
        } else {
          // User has telegram bot if data exists and has bot_token
          setHasTelegramBot(data && data.bot_token ? true : false);
        }
      } catch (error) {
        console.error('Error in checkTelegramBot:', error);
        setHasTelegramBot(false);
      } finally {
        setTelegramBotLoading(false);
      }
    };

    checkTelegramBot();
  }, [userId, supabase]);

  // Use effect to check follow status using the FollowProvider
  useEffect(() => {
    if (isAuthenticated && user?.id && userId) {
      console.log('[VIEW-PROFILE] Checking follow status for user:', userId);
      checkIsFollowing(userId)
        .then(result => {
          console.log('[VIEW-PROFILE] Follow status check completed:', result);
        })
        .catch(error => {
          console.error('[VIEW-PROFILE] Error checking follow status:', error);
        });
    } else {
      console.log('[VIEW-PROFILE] Skipping follow check - not authenticated or no userId');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, userId]);

  // Fetch strategies for this user (from posts)
  useEffect(() => {
    if (!userId || !supabase) return;
    let canceled = false;
    setStrategiesLoading(true);
    supabase
      .from('posts_with_stats')
      .select('strategy')
      .eq('user_id', userId)
      .not('strategy', 'is', null)
      .limit(500)
      .then(({ data, error }) => {
        if (canceled) return;
        if (error) {
          console.error('[VIEW-PROFILE] Failed to fetch strategies:', error);
          setStrategies([]);
          return;
        }
        const counts = new Map();
        (data || []).forEach((row) => {
          const name = String(row?.strategy || '').trim();
          if (!name) return;
          counts.set(name, (counts.get(name) || 0) + 1);
        });
        const list = Array.from(counts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        setStrategies(list);
      })
      .finally(() => { if (!canceled) setStrategiesLoading(false); });
    return () => { canceled = true; };
  }, [userId, supabase]);

  const handleSelectStrategy = (name) => {
    setSelectedStrategy(name);
    setStrategyModalName(name);
    setStrategyModalOpen(true);
  };

  // Load related posts for selected strategy in dialog (do not filter main feed)
  useEffect(() => {
    if (!strategyModalOpen || !strategyModalName || !supabase || !userId) return;
    let canceled = false;
    setStrategyPostsLoading(true);
    supabase
      .from('posts_with_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('strategy', strategyModalName)
      .order('created_at', { ascending: false })
      .limit(25)
      .then(({ data, error }) => {
        if (canceled) return;
        if (error) {
          console.error('[VIEW-PROFILE] Strategy posts fetch error:', error);
          setStrategyPosts([]);
          return;
        }
        setStrategyPosts(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!canceled) setStrategyPostsLoading(false);
      });
    return () => { canceled = true; };
  }, [strategyModalOpen, strategyModalName, supabase, userId]);

  const handleFollowClick = async () => {
    // Check if user is authenticated before following
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    console.log('[VIEW-PROFILE] Follow button clicked, isFollowing before:', isFollowing);
    
    const wasFollowing = isFollowing;
    
    try {
      await toggleFollow(userId);
      console.log('[VIEW-PROFILE] Toggle follow completed, isFollowing after:', isFollowing);
      
      // Update local counts immediately for better UX
      setProfileData(prev => {
        if (!prev) return prev;
        
        const newFollowerCount = wasFollowing 
          ? Math.max((prev.followers || 0) - 1, 0)
          : (prev.followers || 0) + 1;
          
        return {
          ...prev,
          followers: newFollowerCount
        };
      });
      
      // Update ProfileProvider if available (for current user's following count)
      if (profileContext && profileContext.updateFollowCounts && profileData) {
        const action = wasFollowing ? 'unfollow' : 'follow';
        const targetUserData = {
          username: profileData.username || 'User',
          avatar_url: profileData.avatar_url || '/default-avatar.svg'
        };
        profileContext.updateFollowCounts(action, userId, targetUserData);
        console.log('[VIEW-PROFILE] Updated ProfileProvider follow counts');
      }
      
    } catch (error) {
      console.error('[VIEW-PROFILE] Error in handleFollowClick:', error);
      // You might want to show an error message to the user here
    }
  };
  
  const handleBackClick = () => {
    router.back();
  };

  const handleAvatarError = () => {
    setAvatarError(true);
    setAvatarUrl('/default-avatar.svg');
  };

  // Skeleton Loading Component
  const ProfileSkeleton = () => (
    <div className={styles.profileContainer}>
      <button className={styles.backButton}>Back</button>
      
      <div className={`${styles.profileBackground} ${styles.skeletonGradient}`}></div>
      
      <div className={styles.profileHeader}>
        <div className={`${styles.profileAvatar} ${styles.skeletonCircle}`}></div>
        
        <div className={styles.profileInfo}>
          <div className={`${styles.skeletonText} ${styles.skeletonTitle}`}></div>
          <div className={`${styles.skeletonText} ${styles.skeletonSubtitle}`}></div>
          <div className={`${styles.skeletonText} ${styles.skeletonBio}`}></div>
          
          <div className={styles.profileActions}>
            <div className={`${styles.skeletonButton}`}></div>
          </div>
        </div>
      </div>
      
      <div className={styles.profileStats}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={styles.statItem}>
            <div className={`${styles.skeletonText} ${styles.skeletonStatValue}`}></div>
            <div className={`${styles.skeletonText} ${styles.skeletonStatLabel}`}></div>
          </div>
        ))}
      </div>
    </div>
  );
 
// Show skeleton while loading basic data
if (showSkeleton && basicDataLoading && !profileData) {
  return <ProfileSkeleton />;
}
if (error) {
  return (
    <div className={styles.errorContainer}>
      <h2>Error Loading Profile</h2>
      <p>{error}</p>
      <button onClick={handleBackClick} className={styles.backButton}>
        Go Back
      </button>
    </div>
  );
}

  // Guard against rendering placeholders if data failed to load silently
  if (!basicDataLoading && !error && !profileData) {
    return (
      <div className={styles.errorContainer}>
        <h2>Profile not found</h2>
        <p>This profile may be private or unavailable. Please try again later.</p>
        <button onClick={handleBackClick} className={styles.backButton}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className={styles.profileContainer}>
      <button onClick={handleBackClick} className={styles.backButton}>
        Back
      </button>
      
      <div 
        className={styles.profileBackground} 
        style={{ backgroundImage: `url(${backgroundUrl})` }}
      ></div>
      
      <div className={styles.profileHeader}>
        <div className={styles.profileAvatar}>
          {avatarError ? (
            <img 
              src="/default-avatar.svg" 
              alt={profileData?.username || 'User'}
              width={140}
              height={140}
            />
          ) : (
            <img 
              src={avatarUrl}
              alt={profileData?.username || 'User'}
              width={140}
              height={140}
              onError={handleAvatarError}
            />
          )}
        </div>
        
        <div className={styles.profileInfo}>
          <h1>{profileData?.username || 'User'}</h1>
          <p className={styles.username}>@{profileData?.username?.toLowerCase() || 'user'}</p>
          <p className={styles.bio}>{profileData?.bio || 'No bio available'}</p>
          
          <div className={styles.profileActions}>
            {isAuthenticated ? (
              user?.id !== userId && (
                <>
                  <button 
                    onClick={handleFollowClick} 
                    className={isFollowing ? styles.unfollowButton : styles.followButton}
                    disabled={followLoading} // Disable button during follow/unfollow operation
                  >
                    {followLoading ? (isFollowing ? 'Unfollowing...' : 'Following...') : (isFollowing ? 'Unfollow' : 'Follow')}
                  </button>
                  {/* Telegram button - always visible with not-available state when no bot */}
                  <TelegramSubscribeButton 
                    userId={userId} 
                    username={profileData?.username || 'User'} 
                    compact={true}
                    showNotAvailable={true}
                  />
                  <div style={{ marginTop: '1rem' }}>
                    <SocialLinks profile={profileData} size="small" />
                  </div>
                </>
              )
            ) : (
              <>
                <button 
                  onClick={() => router.push('/login')}
                  className={styles.loginToFollowButton}
                >
                  Login to follow
                </button>
                {/* Telegram button - always visible with not-available state when no bot */}
                <TelegramSubscribeButton 
                  userId={userId} 
                  username={profileData?.username || 'User'} 
                  compact={true}
                  showNotAvailable={true}
                />
                <div style={{ marginTop: '1rem' }}>
                  <SocialLinks profile={profileData} size="small" />
                </div>
              </>
            )}
          </div>
          {followError && (
            <p className={styles.followErrorText}>{followError}</p>
          )}
        </div>
      </div>
      <div className={styles.profileStats}>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${statsLoading ? styles.skeletonText : ''}`}>
            {statsLoading ? '...' : (profileData?.posts_count || 0)}
          </span>
          <span className={styles.statLabel}>Posts</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{profileData?.followers || 0}</span>
          <span className={styles.statLabel}>Followers</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{profileData?.following || 0}</span>
          <span className={styles.statLabel}>Following</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{profileData?.experience_score ?? 0}</span>
          <span className={styles.statLabel}>Experience Score</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{profileData?.success_posts ?? 0}</span>
          <span className={styles.statLabel}>Success Posts</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{profileData?.loss_posts ?? 0}</span>
          <span className={styles.statLabel}>Loss Posts</span>
        </div>
      </div>
      
      <div className={styles.profileTabs}>
        <div className={styles.tabsHeader}>
          <button
            className={`${styles.tab} ${activeTab === 'posts' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('posts')}
            type="button"
          >
            Posts
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'strategies' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('strategies')}
            type="button"
          >
            Strategies
          </button>
        </div>
        <div className={styles.tabContent}>
          {activeTab === 'posts' ? (
            <div className={styles.postsSection}>
              <div className={styles.postsHeaderRow}>
                <h2>Recent Posts</h2>
                {strategyFilter && (
                  <div className={styles.activeFilter}>
                    <span>Strategy: {strategyFilter}</span>
                    <button 
                      className={styles.clearFilterButton}
                      onClick={() => {
                        setStrategyFilter('');
                        console.log('[VIEW-PROFILE] Cleared strategy filter');
                      }}
                      type="button"
                      aria-label="Clear strategy filter"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewButton} ${postsViewMode === 'list' ? styles.viewButtonActive : ''}`}
                    onClick={() => setPostsViewMode('list')}
                    title="List View"
                    aria-label="List view"
                    type="button"
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
                    className={`${styles.viewButton} ${postsViewMode === 'grid' ? styles.viewButtonActive : ''}`}
                    onClick={() => setPostsViewMode('grid')}
                    title="Grid View"
                    aria-label="Grid view"
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                  </button>
                  <button
                    className={`${styles.viewButton} ${postsViewMode === 'table' ? styles.viewButtonActive : ''}`}
                    onClick={() => setPostsViewMode('table')}
                    title="Table View"
                    aria-label="Table view"
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="3" y1="9" x2="21" y2="9"></line>
                      <line x1="3" y1="15" x2="21" y2="15"></line>
                      <line x1="9" y1="3" x2="9" y2="21"></line>
                      <line x1="15" y1="3" x2="15" y2="21"></line>
                    </svg>
                  </button>
                </div>
              </div>
              <div className={styles.postsGrid}>
                <PostsFeed 
                  mode="view-profile" 
                  userId={userId} 
                  hideControls 
                  showFlagBackground 
                  viewMode={postsViewMode}
                  selectedStrategy={strategyFilter}
                />
              </div>
            </div>
          ) : (
            <div className={styles.strategiesSection}>
              <h2>Strategies</h2>
              {strategiesLoading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner} />
                  <p>Loading strategies...</p>
                </div>
              ) : strategies.length === 0 ? (
                <div className={styles.emptyStateContainer}>
                  <div className={styles.emptyState}>
                    <h3>No strategies used yet</h3>
                    <p>This user hasn't created posts with trading strategies yet</p>
                  </div>
                </div>
              ) : (
                <div className={styles.strategiesGrid}>
                  {strategies.map((strategy) => (
                    <div key={strategy.name} className={styles.strategyCard}>
                      <div className={styles.strategyHeader}>
                        <h3 className={styles.strategyName}>{strategy.name}</h3>
                        <span className={styles.strategyCount}>{strategy.count} post{strategy.count !== 1 ? 's' : ''}</span>
                      </div>
                      
                      <div className={styles.strategyActions}>
                        <button 
                          className={styles.viewPostsButton}
                          onClick={() => {
                            // Switch to posts tab and apply strategy filter
                            setActiveTab('posts');
                            setStrategyFilter(strategy.name);
                            console.log(`[VIEW-PROFILE] Applying strategy filter: ${strategy.name}`);
                          }}
                          type="button"
                        >
                          View Posts
                        </button>
                        <button 
                          className={styles.detailsButton}
                          onClick={() => handleSelectStrategy(strategy.name)}
                          type="button"
                        >
                          Show Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Strategy Documentation Dialog with related posts */}
      {strategyModalOpen && (
      <StrategyDetailsModal
        isOpen={strategyModalOpen}
        onClose={() => { setStrategyModalOpen(false); setSelectedStrategy(''); }}
        strategy={strategyModalName}
        userId={userId}
        readOnly
        fullScreen
      >
        <div className="smd-section">
          <h3 className="smd-sectionTitle">Results</h3>
          <div className="smd-metricsGrid">
            <div className="smd-metricCard">
              <div className="smd-metricLabel">Total Posts</div>
              <div className="smd-metricValue">{strategyStats.total}</div>
            </div>
            <div className="smd-metricCard">
              <div className="smd-metricLabel">Success</div>
              <div className="smd-metricValue">{strategyStats.success} ({strategyStats.successPct}%)</div>
            </div>
            <div className="smd-metricCard">
              <div className="smd-metricLabel">Loss</div>
              <div className="smd-metricValue">{strategyStats.loss} ({strategyStats.lossPct}%)</div>
            </div>
            <div className="smd-metricCard">
              <div className="smd-metricLabel">Active</div>
              <div className="smd-metricValue">{strategyStats.active} ({strategyStats.activePct}%)</div>
            </div>
            <div className="smd-metricCard">
              <div className="smd-metricLabel">Success Rate</div>
              <div className="smd-metricValue">{strategyStats.successRate}%</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="smd-stackedBar">
              <div className="smd-segSuccess" style={{ width: `${strategyStats.successPct}%` }} />
              <div className="smd-segLoss" style={{ width: `${strategyStats.lossPct}%` }} />
              <div className="smd-segActive" style={{ width: `${strategyStats.activePct}%` }} />
            </div>
            <div className="smd-chips" style={{ marginTop: 8 }}>
              <span className="smd-chip smd-chipSuccess">TargetReached: {strategyStats.success}</span>
              <span className="smd-chip smd-chipLoss">Stop Loss: {strategyStats.loss}</span>
              <span className="smd-chip smd-chipActive">Active: {strategyStats.active}</span>
            </div>
          </div>
        </div>

        <div className="smd-section">
          <h3 className="smd-sectionTitle">Related Posts</h3>
          {strategyPostsLoading ? (
            <p>Loading posts...</p>
          ) : strategyPosts.length === 0 ? (
            <p>No posts found for this strategy.</p>
          ) : (
            <div className="smd-postsList">
              {strategyPosts.map((p) => {
                const isSuccess = !!p?.target_reached;
                const isLoss = !!p?.stop_loss_triggered;
                return (
                  <div key={p.id} className="smd-postItem">
                    <div className="smd-postSymbol">{p.symbol || '-'}</div>
                    <div className="smd-postCompany">{p.company_name || ''}</div>
                    <div className="smd-postRight">
                      <span className={`smd-chip ${isSuccess ? 'smd-chipSuccess' : isLoss ? 'smd-chipLoss' : 'smd-chipActive'}`}>
                        {isSuccess ? 'Target' : isLoss ? 'Stop' : 'Active'}
                      </span>
                      <a
                        href={`/posts/${p.id}`}
                        className="smd-chip"
                        onClick={(e) => { e.preventDefault(); try { router.push(`/posts/${p.id}`); } catch {} }}
                      >
                        Open
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </StrategyDetailsModal>
    )}
  </div>
);
}