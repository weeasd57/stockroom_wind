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

// Helper function to check if param is UUID or username
const isUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Helper function to validate and sanitize username for security
const isValidUsername = (str) => {
  if (!str || typeof str !== 'string') return false;
  
  // Username should only contain letters, numbers, spaces, underscores, and hyphens
  // No special characters that could cause SQL injection
  const validUsernameRegex = /^[a-zA-Z0-9\s_-]+$/;
  
  // Check length (reasonable limits)
  if (str.length < 1 || str.length > 50) return false;
  
  // Check for valid characters only
  return validUsernameRegex.test(str);
};

export default function ViewProfile({ params }) {
  // Fixed: All userId references changed to actualUserId
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
  
  // Extract ID/Username from params and determine type
  // Decode URL-encoded username (handles spaces and special characters)
  const userIdOrUsername = params?.id ? decodeURIComponent(params.id) : null;
  const isUserUUID = isUUID(userIdOrUsername);
  
  // Security check: Validate username to prevent SQL injection
  if (userIdOrUsername && !isUserUUID && !isValidUsername(userIdOrUsername)) {
    console.error('[VIEW-PROFILE] Invalid username detected:', userIdOrUsername);
    // Don't proceed with potentially dangerous username
    return (
      <div className={styles.errorContainer}>
        <h2>Invalid Profile URL</h2>
        <p>The profile URL contains invalid characters. Please check the URL and try again.</p>
        <button onClick={() => router.push('/home')} className={styles.backButton}>
          Go Home
        </button>
      </div>
    );
  }
  
  console.log("[VIEW-PROFILE] Component loaded with params:", params);
  console.log("[VIEW-PROFILE] Extracted param:", userIdOrUsername);
  console.log("[VIEW-PROFILE] Is UUID:", isUserUUID, "| Is Username:", !isUserUUID);
  if (userIdOrUsername && !isUserUUID) {
    console.log("[VIEW-PROFILE] Username validation:", isValidUsername(userIdOrUsername) ? "VALID" : "INVALID");
  }
  
  // Progressive loading states
  const [basicDataLoading, setBasicDataLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [actualUserId, setActualUserId] = useState(null); // The real UUID from profile (not username)
  const [premiumPostsCount, setPremiumPostsCount] = useState(0);
  const [premiumFeatures, setPremiumFeatures] = useState([]);
  const [premiumPlanData, setPremiumPlanData] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [backgroundUrl, setBackgroundUrl] = useState('https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
  const [error, setError] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [hasTelegramBot, setHasTelegramBot] = useState(false);
  const [telegramBotLoading, setTelegramBotLoading] = useState(true);
  const [postsViewMode, setPostsViewMode] = useState('grid');
  const searchParams = useSearchParams();
  // Local tabs and strategies state for view-profile
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'strategies'
  // Subscription state
  const [isSubscribedToBroker, setIsSubscribedToBroker] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
    // Only redirect if there's definitely no user ID/username
    if (userIdOrUsername === undefined || userIdOrUsername === null) {
      router.push('/home');
      return;
    }

    // Wait until supabase client is ready
    if (!supabase) {
      return;
    }

    // Prevent double-fetch in React Strict Mode (dev)
    if (hasFetchedRef.current[userIdOrUsername]) {
      return;
    }
    hasFetchedRef.current[userIdOrUsername] = true;

    let isCancelled = false;
    const controller = new AbortController();

    const safeSetState = (setter) => {
      if (!isCancelled) setter();
    };

    const fetchProfileData = async () => {
      try {
        console.log('[VIEW-PROFILE] Starting to fetch profile data for:', userIdOrUsername);
        
        // Check cache first
        const cacheKey = `profile_${userIdOrUsername}`;
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
        const TIMEOUT_MS = 20000; // Increased timeout to 20 seconds
        const withTimeoutAbort = async (fn, ms = TIMEOUT_MS) => {
          const timeoutId = setTimeout(() => {
            console.log('[VIEW-PROFILE] Request timeout after', ms, 'ms - will abort next request');
          }, ms);
          try {
            return await fn();
          } catch (e) {
            console.log('[VIEW-PROFILE] Query error:', e);
            // Check for timeout or network errors
            if (e.name === 'AbortError' || e.message?.includes('AbortError') || e.message?.includes('timeout')) {
              throw new Error('Request timed out');
            }
            throw e;
          } finally {
            clearTimeout(timeoutId);
          }
        };
        
        // Fetch user profile
        console.log('[VIEW-PROFILE] Fetching profile from database...');
        console.log('[VIEW-PROFILE] Query type:', isUserUUID ? 'by ID' : 'by Username');
        console.log('[VIEW-PROFILE] Searching for:', userIdOrUsername);
        console.log('[VIEW-PROFILE] Original param:', params?.id);
        console.log('[VIEW-PROFILE] After decoding:', userIdOrUsername);
        let profile, profileError;
        try {
          const res = await withTimeoutAbort(
            () => {
              // Query by UUID or username
              const query = supabase
                .from('profiles')
                .select('id, username, avatar_url, background_url, bio, followers, following, created_at, experience_score, success_posts, loss_posts, facebook_url, telegram_url, youtube_url, is_broker, paypal_email, broker_plan_description, broker_average_posts_info, broker_price_plan_info');
              
              if (isUserUUID) {
                return query.eq('id', userIdOrUsername).maybeSingle();
              } else {
                return query.eq('username', userIdOrUsername).maybeSingle();
              }
            }
          );
          profile = res.data;
          profileError = res.error;
        } catch (e) {
          if (e && e.message === 'Request timed out') {
            // Single retry with a longer timeout
            const res = await withTimeoutAbort(
              () => {
                const query = supabase
                  .from('profiles')
                  .select('id, username, avatar_url, background_url, bio, followers, following, created_at, experience_score, success_posts, loss_posts, facebook_url, telegram_url, youtube_url, is_broker, paypal_email, broker_plan_description, broker_average_posts_info, broker_price_plan_info');
                
                if (isUserUUID) {
                  return query.eq('id', userIdOrUsername).maybeSingle();
                } else {
                  return query.eq('username', userIdOrUsername).maybeSingle();
                }
              },
              30000
            );
            profile = res.data;
            profileError = res.error;
          } else {
            throw e;
          }
        }
          
        console.log('[VIEW-PROFILE] Profile query result:', { 
          profile: !!profile, 
          error: profileError,
          profileData: profile ? { id: profile.id, username: profile.username } : null,
          searchedFor: userIdOrUsername,
          queryType: isUserUUID ? 'UUID' : 'username'
        });
          
        if (profileError) {
          throw profileError;
        }
        
        if (!profile) {
          // Debug: Let's see what usernames actually exist in the database
          try {
            const { data: allProfiles } = await supabase
              .from('profiles')
              .select('username')
              .limit(10);
            console.log('[VIEW-PROFILE] Available usernames in database:', allProfiles?.map(p => p.username));
          } catch (e) {
            console.log('[VIEW-PROFILE] Could not fetch available usernames:', e);
          }
          throw new Error('Profile not found');
        }
        
        // IMPORTANT: Use the actual user ID from profile (not the param which could be username)
        const resolvedUserId = profile.id;
        
        // Set basic profile data and actualUserId immediately
        safeSetState(() => {
          setProfileData(profile);
          setActualUserId(resolvedUserId);
          setBasicDataLoading(false);
          setShowSkeleton(false);
        });
        
        // Cache the basic profile data
        profileCache.set(cacheKey, {
          data: profile,
          timestamp: Date.now()
        });
        
        // Fetch stats asynchronously (non-blocking)
        setTimeout(async () => {
          try {
            // Fetch posts count
            const { count: postsCount } = await supabase
              .from('posts')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', resolvedUserId);
            
            // Fetch premium posts count
            const { count: premiumCount } = await supabase
              .from('posts')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', resolvedUserId)
              .eq('is_premium_only', true);
            
            // Fetch premium plan features if broker (only active plans)
            if (profile?.is_broker) {
              const { data: premiumPlan, error: planError } = await supabase
                .from('premium_plans')
                .select('features, pricing, paypal_account, is_active')
                .eq('user_id', resolvedUserId)
                .eq('is_active', true)
                .maybeSingle();
              
              if (!planError && premiumPlan) {
                safeSetState(() => {
                  setPremiumFeatures(premiumPlan.features || []);
                  setPremiumPlanData(premiumPlan);
                });
              }
            }
            
            safeSetState(() => {
              setProfileData(prev => ({
                ...prev,
                posts_count: postsCount || 0
              }));
              setPremiumPostsCount(premiumCount || 0);
              setStatsLoading(false);
            });
          } catch (e) {
            console.log('[VIEW-PROFILE] Failed to fetch posts count:', e);
            safeSetState(() => {
              setProfileData(prev => ({
                ...prev,
                posts_count: 0
              }));
              setPremiumPostsCount(0);
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
              .getPublicUrl(`${resolvedUserId}/avatar.png`);
              
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
              .getPublicUrl(`${resolvedUserId}/background.png`);
              
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
  }, [userIdOrUsername, supabase]);

  // Apply view mode from query parameter (e.g. ?view=table or ?vm=grid)
  useEffect(() => {
    try {
      const v = (searchParams?.get('view') || searchParams?.get('vm') || '').toLowerCase();
      if (v === 'table' || v === 'grid' || v === 'list') {
        setPostsViewMode(v);
      }
    } catch (err) {
      console.error('[VIEW-PROFILE] Error parsing view mode:', err);
    }
  }, [searchParams]);

// Check if user has telegram bot
useEffect(() => {
  if (!actualUserId || !supabase) return;
  
  const checkTelegramBot = async () => {
    try {
      const { data, error } = await supabase
        .from('telegram_bots')
        .select('bot_token')
        .eq('user_id', actualUserId)
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
}, [actualUserId, supabase]);

// Check if current user is subscribed to this broker
useEffect(() => {
  if (!isAuthenticated || !user?.id || !actualUserId || !profileData?.is_broker) {
    setSubscriptionLoading(false);
    return;
  }

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('broker_id', actualUserId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error checking subscription:', error);
      } else if (data) {
        // Check if subscription is still valid (not expired)
        const now = new Date();
        const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
        
        if (!expiresAt || expiresAt > now) {
          setIsSubscribedToBroker(true);
          setCurrentSubscription(data);
        }
      }
    } catch (error) {
      console.error('Error in checkSubscription:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  checkSubscription();
}, [isAuthenticated, user?.id, actualUserId, profileData?.is_broker, supabase]);

// Use effect to check follow status using the FollowProvider
useEffect(() => {
  if (isAuthenticated && user?.id && actualUserId) {
    console.log('[VIEW-PROFILE] Checking follow status for user:', actualUserId);
    checkIsFollowing(actualUserId)
      .then(result => {
        console.log('[VIEW-PROFILE] Follow status check completed:', result);
      })
      .catch(error => {
        console.error('[VIEW-PROFILE] Error checking follow status:', error);
      });
  }
}, [isAuthenticated, user?.id, actualUserId, checkIsFollowing]);

// Handle follow button click
const handleFollowClick = async () => {
  if (!isAuthenticated || !actualUserId) {
    return;
  }
  
  console.log('[VIEW-PROFILE] Follow button clicked, isFollowing before:', isFollowing);
  
  const wasFollowing = isFollowing;
  
  try {
    await toggleFollow(actualUserId);
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
        profileContext.updateFollowCounts(action, actualUserId, targetUserData);
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
              user?.id !== actualUserId && (
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
                    userId={actualUserId} 
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
                  userId={actualUserId} 
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
      
      {/* Premium Stats Section - Show if broker has premium plan setup */}
      {profileData?.is_broker && (
        <div id="premium-broker" className={styles.premiumStatsSection} style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#78350f',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ⭐ Premium Broker
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#92400e',
                marginBottom: '0.25rem'
              }}>
                {statsLoading ? '...' : premiumPostsCount}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#92400e',
                fontWeight: '500'
              }}>
                Premium Posts
              </div>
            </div>
            
            <div style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#78350f',
                marginBottom: '0.5rem'
              }}>
                🎯 Success Rate
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#92400e'
              }}>
                {(() => {
                  const s = profileData?.success_posts || 0;
                  const l = profileData?.loss_posts || 0;
                  const total = s + l;
                  return total ? `${Math.round((s * 100) / total)}%` : '0%';
                })()}
              </div>
            </div>

            <div style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#78350f',
                marginBottom: '0.5rem'
              }}>
                👥 Followers
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#92400e'
              }}>
                {profileData?.followers || 0}
              </div>
            </div>
          </div>
          
          {profileData?.broker_plan_description && (
            <div style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: '1rem'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#78350f',
                marginBottom: '0.5rem'
              }}>
                📋 Plan Description
              </div>
              <div style={{
                fontSize: '14px',
                color: '#92400e',
                lineHeight: '1.6'
              }}>
                {profileData.broker_plan_description}
              </div>
            </div>
          )}
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            
            {profileData?.broker_price_plan_info && (
              <div style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.6)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#78350f',
                  marginBottom: '0.5rem'
                }}>
                  💎 Pricing & Features
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#92400e',
                  lineHeight: '1.6'
                }}>
                  {profileData.broker_price_plan_info}
                  {premiumFeatures.length > 0 && (
                    <ul style={{ marginTop: '0.75rem', paddingLeft: '1rem', color: '#78350f', listStyle: 'disc' }}>
                      {premiumFeatures.map((feature, idx) => (
                        <li key={idx}>{feature}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Subscribe/Cancel Button - Only show if not viewing own profile */}
          {user && user.id !== actualUserId && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              {subscriptionLoading ? (
                <div style={{
                  padding: '1rem 2.5rem',
                  background: 'hsl(var(--muted))',
                  color: 'hsl(var(--muted-foreground))',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '700'
                }}>
                  Checking subscription...
                </div>
              ) : isSubscribedToBroker ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  alignItems: 'center'
                }}>
                  <div style={{
                    padding: '1rem 2rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Active Subscription
                  </div>
                  {currentSubscription && (
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Plan:</strong> {currentSubscription.plan_type === 'monthly' ? 'Monthly' : 'Yearly'}
                      </div>
                      {currentSubscription.expires_at && (
                        <div>
                          <strong>Expires:</strong> {new Date(currentSubscription.expires_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    style={{
                      padding: '0.75rem 2rem',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.5)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Cancel Subscription
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push(`/broker-subscribe/${profileData?.username || actualUserId}`)}
                  style={{
                    padding: '1rem 2.5rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.5)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Subscribe to Premium Plan
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
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
                  userId={actualUserId} 
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
        userId={actualUserId}
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

      {/* Cancel Subscription Confirmation Dialog */}
      {showCancelDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'hsl(var(--card))',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: 'hsl(var(--foreground))',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Cancel Subscription?
            </h3>
            <p style={{
              fontSize: '1rem',
              color: 'hsl(var(--muted-foreground))',
              marginBottom: '1.5rem',
              lineHeight: '1.6'
            }}>
              Are you sure you want to cancel your subscription to this broker's premium plan? 
              You will lose access to premium posts immediately.
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowCancelDialog(false)}
                disabled={cancelling}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'hsl(var(--secondary))',
                  color: 'hsl(var(--secondary-foreground))',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  opacity: cancelling ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                Keep Subscription
              </button>
              <button
                onClick={async () => {
                  if (!currentSubscription || cancelling) return;
                  
                  try {
                    setCancelling(true);
                    
                    const response = await fetch('/api/broker-subscription/cancel', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        subscription_id: currentSubscription.id,
                        user_id: user.id
                      }),
                    });

                    const data = await response.json();

                    if (response.ok && data.success) {
                      // Update local state
                      setIsSubscribedToBroker(false);
                      setCurrentSubscription(null);
                      setShowCancelDialog(false);
                      
                      // Show success message (you can use a toast library here)
                      alert('Subscription cancelled successfully');
                    } else {
                      throw new Error(data.error || 'Failed to cancel subscription');
                    }
                  } catch (error) {
                    console.error('Cancel subscription error:', error);
                    alert('Failed to cancel subscription. Please try again.');
                  } finally {
                    setCancelling(false);
                  }
                }}
                disabled={cancelling}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: cancelling ? 'hsl(var(--muted))' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  boxShadow: cancelling ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
  </div>
);
}