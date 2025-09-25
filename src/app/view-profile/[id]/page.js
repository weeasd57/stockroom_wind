'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import styles from '@/styles/view-profile.module.css';
import { useFollow } from '@/providers/FollowProvider';
import PostCard from '@/components/posts/PostCard';
import PostsFeed from '@/components/home/PostsFeed';
import TelegramSubscribeButton from '@/components/telegram/TelegramSubscribeButton';

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
                .select('id, username, avatar_url, background_url, bio, followers, following, created_at, experience_score, success_posts, loss_posts')
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
                  .select('id, username, avatar_url, background_url, bio, followers, following, created_at, experience_score, success_posts, loss_posts')
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
                  <TelegramSubscribeButton 
                    userId={userId} 
                    username={profileData?.username || 'User'} 
                  />
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
                <TelegramSubscribeButton 
                  userId={userId} 
                  username={profileData?.username || 'User'} 
                />
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
      
      <div className={styles.postsSection}>
        <h2>Recent Posts</h2>
        <div className={styles.postsGrid}>
          <PostsFeed mode="view-profile" userId={userId} hideControls showFlagBackground />
        </div>
      </div>
    </div>
  );
}