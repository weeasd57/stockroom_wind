'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { useFollow } from '@/providers/FollowProvider';
import styles from '@/styles/view-profile.module.css';
import PostCard from '@/components/posts/PostCard';
import PostsFeed from '@/components/home/PostsFeed';
import TelegramSubscribeButton from '@/components/telegram/TelegramSubscribeButton';

// Local cache for profile data
  const profileCache = new Map();
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function ViewProfile() {
  const { supabase, isAuthenticated, user } = useSupabase();
  const router = useRouter();
  const paramsFromHook = useParams();
  const rawId = paramsFromHook?.id;
  const userId = Array.isArray(rawId) ? rawId[0] : rawId;
  console.log("[VIEW-PROFILE] Extracted userId:", userId);
  const { isFollowing, toggleFollow, checkIsFollowing, loading: followLoading, error: followError } = useFollow();
  const hasFetchedRef = useRef({});
  
  // Try to get ProfileProvider for updating follow counts
  let profileContext;
  try {
    profileContext = useProfile();
  } catch (e) {
    // ProfileProvider not available in this context, that's okay
    console.log('[VIEW-PROFILE] ProfileProvider not available');
  }
  
  // Progressive loading states
  const [basicDataLoading, setBasicDataLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [backgroundUrl, setBackgroundUrl] = useState('https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
  const [error, setError] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [postsReady, setPostsReady] = useState(false); // Delay posts loading
  const controllerRef = useRef(null);

  // Fetch profile data with optimized parallel loading
  useEffect(() => {
    // Only redirect if there's definitely no user ID
    if (!userId) {
      console.warn('[VIEW-PROFILE] No user ID provided, redirecting to home');
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
    // Ensure no previous in-flight request keeps running
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = null;

    const safeSetState = (setter) => {
      if (!isCancelled) setter();
    };

    const fetchProfileData = async () => {
      try {
        console.log('[VIEW-PROFILE] Starting to fetch profile data for userId:', userId);
        
        // Check cache first and use immediately if available
        const cacheKey = `profile_${userId}`;
        const cached = profileCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
          console.log('[VIEW-PROFILE] Using cached profile data');
          setProfileData(cached.data);
          setAvatarUrl(cached.data.avatar_url || '/default-avatar.svg');
          setBackgroundUrl(cached.data.background_url || 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
          setBasicDataLoading(false);
          setShowSkeleton(false);
          // Enable posts immediately from cache
          setPostsReady(true);
          return; // Exit early if cache is valid
        }
        
        setError(null);
        
        // Set immediate fallback data for instant UI
        const immediateProfile = {
          id: userId,
          username: 'Loading...',
          avatar_url: '/default-avatar.svg', 
          background_url: 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop',
          bio: 'Loading profile information...',
          followers: 0,
          following: 0,
          experience_score: 0,
          success_posts: 0,
          loss_posts: 0,
          created_at: new Date().toISOString()
        };
        
        // Show immediate UI to prevent blank screen
        setProfileData(immediateProfile);
        setAvatarUrl('/default-avatar.svg');
        setBackgroundUrl('https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
        setBasicDataLoading(false);
        setShowSkeleton(false);
        setPostsReady(true);
        
        const TIMEOUT_MS = 8000; // reduced timeout (8s) for faster fail and retry
        
        // Robust timeout: race the request with a timeout and abort on timeout (per-attempt controller)
        const fetchWithTimeout = async (promise, abortController, ms = TIMEOUT_MS) => {
          let timeoutId;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              try { abortController?.abort(); } catch {}
              reject(new Error('Request timed out. Please try again.'));
            }, ms);
          });
          try {
            const result = await Promise.race([promise, timeoutPromise]);
            return result;
          } finally {
            clearTimeout(timeoutId);
          }
        };
        
        // Fetch user profile with reduced fields for speed
        console.log('[VIEW-PROFILE] Fetching profile from database...');
        
        // Start fetching profile with more retries on timeout
        const maxRetries = 2;
        let attempt = 0;
        let profile = null;
        let profileError = null;
        while (attempt <= maxRetries) {
          console.log(`[VIEW-PROFILE] Fetch attempt ${attempt + 1}/${maxRetries + 1}`);
          // Abort any previous attempt
          if (controllerRef.current) {
            try { controllerRef.current.abort(); } catch {}
          }
          const attemptController = new AbortController();
          controllerRef.current = attemptController;
          
          // Use minimal fields on first attempt for speed, full fields on retries
          const selectFields = attempt === 0 
            ? 'id, username, avatar_url, followers, following' // minimal essential fields first
            : 'id, username, avatar_url, background_url, bio, facebook_url, telegram_url, youtube_url, followers, following, created_at, experience_score, success_posts, loss_posts';
          
          const timeoutMs = TIMEOUT_MS + attempt * 3000; // 8s, 11s, 14s - faster retries
          const profilePromise = fetchWithTimeout(
            supabase
              .from('profiles')
              .select(selectFields)
              .eq('id', userId)
              .maybeSingle()
              .abortSignal(attemptController.signal),
            attemptController,
            timeoutMs
          );
          const { data, error } = await profilePromise;
          if (!error && data) {
            profile = data;
            profileError = null;
            break;
          }
          profileError = error;
          if (error?.message?.includes('timed out') && attempt < maxRetries) {
            // backoff before retry with longer delays
            const retryDelay = 1500 + attempt * 1500;
            console.log(`[VIEW-PROFILE] Attempt ${attempt + 1} timed out. Retrying in ${retryDelay}ms...`);
            await new Promise((r) => setTimeout(r, retryDelay));
            attempt += 1;
            continue;
          }
          // non-timeout errors or last attempt - log for debugging
          console.error(`[VIEW-PROFILE] Attempt ${attempt + 1} failed:`, error?.message || 'Unknown error');
          break;
        }
          
        console.log('[VIEW-PROFILE] Profile query result:', { profile: !!profile, error: profileError });
          
        if (profileError) {
          // Handle timeout errors specifically
          if (profileError.message && profileError.message.includes('timeout')) {
            throw new Error('Request timed out while fetching profile. Please try again.');
          }
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
          // Use existing avatar/background URLs from profile
          setAvatarUrl(profile.avatar_url || '/default-avatar.svg');
          setBackgroundUrl(profile.background_url || 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
        });
        
        // Cache the basic profile data
        profileCache.set(cacheKey, {
          data: profile,
          timestamp: Date.now()
        });

        // Enable posts loading immediately after profile is ready
        safeSetState(() => setPostsReady(true));
        
        // Skip storage checks entirely - rely on profile data only
        // This eliminates 2 unnecessary storage queries
        
      } catch (error) {
        console.error('[VIEW-PROFILE] Error fetching profile:', error);
        safeSetState(() => {
          // Create fallback profile data for better UX
          const fallbackProfile = {
            id: userId,
            username: 'User',
            avatar_url: '/default-avatar.svg',
            background_url: 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop',
            bio: 'Profile information temporarily unavailable',
            followers: 0,
            following: 0,
            experience_score: 0,
            success_posts: 0,
            loss_posts: 0,
            created_at: new Date().toISOString()
          };
          
          // Set fallback data for partial functionality
          setProfileData(fallbackProfile);
          setAvatarUrl('/default-avatar.svg');
          setBackgroundUrl('https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
          
          if (error.message.includes('timed out')) {
            setError('Connection timeout. Showing limited profile information. Please refresh to try again.');
          } else {
            setError('Unable to load complete profile. Showing basic information.');
          }
          setBasicDataLoading(false);
          setShowSkeleton(false);
          // Enable posts even with fallback data
          setPostsReady(true);
        });
      }
    };

    fetchProfileData();

    return () => {
      isCancelled = true;
      if (controllerRef.current) {
        try { controllerRef.current.abort(); } catch {}
      }
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
  
  // Back navigation removed per design

  const handleAvatarError = () => {
    setAvatarError(true);
    setAvatarUrl('/default-avatar.svg');
  };

  // Helper: check if a social link exists (non-empty string after trim)
  const hasLink = (value) => typeof value === 'string' && value.trim().length > 0;

  // Normalize social URLs to ensure they include protocol and valid paths
  const normalizeUrl = (url, type) => {
    if (!url) return '';
    let trimmed = String(url).trim();
    // Telegram: accept @username or username and convert to https://t.me/username
    if (type === 'telegram') {
      // Convert tg:// links to https://t.me/
      if (/^tg:\/\//i.test(trimmed)) {
        const domainMatch = trimmed.match(/[?&]domain=([^&]+)/i);
        const startMatch = trimmed.match(/[?&]start=([^&]+)/i);
        const domain = domainMatch ? decodeURIComponent(domainMatch[1]) : '';
        const handle = domain.replace(/^@+/, '');
        const start = startMatch ? decodeURIComponent(startMatch[1]) : '';
        return start ? `https://t.me/${handle}?start=${start}` : `https://t.me/${handle}`;
      }
      // If it's already a full URL, just ensure protocol
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      // If it contains t.me without protocol
      if (/^t\.me\//i.test(trimmed)) return `https://${trimmed}`;
      // If it's @username or plain username
      const handle = trimmed.replace(/^@+/, '');
      return `https://t.me/${handle}`;
    }
    // Default: ensure protocol
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed.replace(/^\/+/, '')}`;
  };

  // Skeleton Loading Component
  const ProfileSkeleton = () => (
    <div className={styles.profileContainer}>
      
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

  // Only show error page if we have no fallback data
  if (error && !profileData) {
    return (
      <div className={styles.errorContainer}>
        <h2>Unable to Load Profile</h2>
        <p>{error}</p>
        {error.includes('timed out') && (
          <button 
            onClick={() => window.location.reload()} 
            className={styles.retryButton}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // Guard against rendering placeholders if data failed to load silently
  if (!basicDataLoading && !error && !profileData) {
    return (
      <div className={styles.errorContainer}>
        <h2>Profile not found</h2>
        <p>This profile may be private or unavailable. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className={styles.profileContainer}>
      <div 
        className={styles.profileBackground} 
        style={{ backgroundImage: `url(${backgroundUrl})` }}
      >
        {(hasLink(profileData?.facebook_url) || hasLink(profileData?.telegram_url) || hasLink(profileData?.youtube_url)) && (
          <div className={styles.socialIcons}>
            {hasLink(profileData?.facebook_url) && (
              <a
                href={normalizeUrl(profileData.facebook_url)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialIcon}
                aria-label="Facebook Profile"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            )}
            {hasLink(profileData?.telegram_url) && (
              <a
                href={normalizeUrl(profileData.telegram_url, 'telegram')}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialIcon}
                aria-label="Telegram Channel"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
            )}
            {hasLink(profileData?.youtube_url) && (
              <a
                href={normalizeUrl(profileData.youtube_url)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialIcon}
                aria-label="YouTube Channel"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
      
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
                    language="en"
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
                  language="en"
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
          {postsReady ? (
            <PostsFeed mode="view-profile" userId={userId} hideControls showFlagBackground />
          ) : (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>Loading posts...</p>
              <p className={styles.loadingHint}>This may take a few moments...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}