'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import Image from 'next/image';
import styles from '@/styles/view-profile.module.css';
import Link from 'next/link';
import { useFollow } from '@/providers/FollowProvider'; // Import useFollow

export default function ViewProfile({ params }) {
  const { supabase, isAuthenticated, user } = useSupabase();
  const router = useRouter();
  const { isFollowing, toggleFollow, checkIsFollowing, loading: followLoading, error: followError } = useFollow(); // Use useFollow hook
  
  // Make sure to extract the ID correctly from params
  const userId = params?.id;
  // console.log("Received params:", params);
  // console.log("User ID from URL:", userId);
  
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [backgroundUrl, setBackgroundUrl] = useState('https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
  const [postCount, setPostCount] = useState(0);
  const [error, setError] = useState(null);
  const [avatarError, setAvatarError] = useState(false);

  // Fetch profile data
  useEffect(() => {
    // Only redirect if there's definitely no user ID
    if (userId === undefined || userId === null) {
      // console.error("No user ID found in params, redirecting to home");
      router.push('/home');
      return;
    }

    // console.log("Fetching profile data for user ID:", userId);
    
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (profileError) {
          // console.error('Profile error:', profileError);
          throw profileError;
        }
        
        if (!profile) {
          throw new Error('Profile not found');
        }
        
        // console.log("Profile data fetched successfully:", profile);
        setProfileData(profile);
        
        // Fetch user posts
        const { data: posts, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
          
        if (postsError) {
          // console.error('Error fetching posts:', postsError);
        } else {
          // console.log("Posts fetched:", posts?.length || 0);
          setProfilePosts(posts || []);
          setPostCount(posts?.length || 0);
        }
        
        // Fetch followers
        const { data: followersData, error: followersError } = await supabase
          .from('user_followings')
          .select('follower_id, profiles!user_followings_follower_id_fkey(id, username, avatar_url)')
          .eq('following_id', userId);
          
        if (followersError) {
          // console.error('Error fetching followers:', followersError);
        } else {
          // console.log("Followers fetched:", followersData?.length || 0);
          // setFollowers(followersData || []); // This state is now managed by FollowProvider
        }
        
        // Fetch following
        const { data: followingData, error: followingError } = await supabase
          .from('user_followings')
          .select('following_id, profiles!user_followings_following_id_fkey(id, username, avatar_url)')
          .eq('follower_id', userId);
          
        if (followingError) {
          // console.error('Error fetching following:', followingError);
        } else {
          // console.log("Following fetched:", followingData?.length || 0);
          // setFollowing(followingData || []); // This state is now managed by FollowProvider
        }
        
        // Try to get avatar and background images
        if (profile.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        } else {
          try {
            const { data: avatarData } = await supabase
              .storage
              .from('avatars')
              .getPublicUrl(`${userId}/avatar.png`);
              
            if (avatarData?.publicUrl) {
              setAvatarUrl(`${avatarData.publicUrl}?t=${Date.now()}`);
            }
          } catch (e) {
            // console.log('No custom avatar found');
            setAvatarUrl('/default-avatar.svg');
          }
        }
        
        if (profile.background_url) {
          setBackgroundUrl(profile.background_url);
        } else {
          try {
            const { data: bgData } = await supabase
              .storage
              .from('backgrounds')
              .getPublicUrl(`${userId}/background.png`);
              
            if (bgData?.publicUrl) {
              setBackgroundUrl(`${bgData.publicUrl}?t=${Date.now()}`);
            }
          } catch (e) {
            // console.log('No custom background found');
          }
        }
        
      } catch (error) {
        // console.error('Error fetching profile:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [userId, supabase, router]);

  // Use effect to check follow status using the FollowProvider
  useEffect(() => {
    if (isAuthenticated && user && userId) {
      checkIsFollowing(userId);
    }
  }, [isAuthenticated, user, userId, checkIsFollowing]);

  const handleFollowClick = async () => {
    // Check if user is authenticated before following
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    await toggleFollow(userId);
    // Re-fetch profile data to get updated followers/following counts
    // This might be redundant if the ProfileProvider or useFollow updates it
    // but it ensures immediate UI consistency if not.
    // Consider if this is truly needed or if a more granular update is better.
    // For now, re-fetching profile data after a follow/unfollow is a simple solution.
    // (Could be optimized by updating local state for followers/following counts)
    const fetchUpdatedCounts = async () => {
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .select('followers, following')
        .eq('id', userId)
        .single();

      if (updatedProfile) {
        setProfileData(prev => ({
          ...prev,
          followers: updatedProfile.followers,
          following: updatedProfile.following,
        }));
        // Also update the local followers/following state which is used for the lists
        // This part would need actual user data from the followings table to update lists correctly.
        // For a quick fix, if `followers` and `following` are just numbers, update them directly.
        // If they are lists of profile objects, a more complex re-fetch or state manipulation is needed.
        // Given the current structure, let's assume direct number update is sufficient for now.
      }
    };
    fetchUpdatedCounts();
  };
  
  const handleBackClick = () => {
    router.back();
  };

  const handleAvatarError = () => {
    setAvatarError(true);
    setAvatarUrl('/default-avatar.svg');
  };

  if (loading || followLoading) { // Include followLoading in overall loading state
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || followError) { // Include followError in overall error state
    return (
      <div className={styles.errorContainer}>
        <h2>Error Loading Profile</h2>
        <p>{error || followError}</p>
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
          
          {isAuthenticated ? (
            user?.id !== userId && (
              <button 
                onClick={handleFollowClick} 
                className={isFollowing ? styles.unfollowButton : styles.followButton}
                disabled={followLoading} // Disable button during follow/unfollow operation
              >
                {followLoading ? (isFollowing ? 'Unfollowing...' : 'Following...') : (isFollowing ? 'Unfollow' : 'Follow')}
              </button>
            )
          ) : (
            <button 
              onClick={() => router.push('/login')} 
              className={styles.loginToFollowButton}
            >
              Login to follow
            </button>
          )}
        </div>
      </div>
      
      <div className={styles.profileStats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{postCount}</span>
          <span className={styles.statLabel}>Posts</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{profileData?.followers || 0}</span>{/* Use profileData.followers */}
          <span className={styles.statLabel}>Followers</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{profileData?.following || 0}</span>{/* Use profileData.following */}
          <span className={styles.statLabel}>Following</span>
        </div>
      </div>
      
      <div className={styles.postsSection}>
        <h2>Recent Posts</h2>
        
        {profilePosts.length > 0 ? (
          <div className={styles.postsGrid}>
            {profilePosts.map(post => (
              <div key={post.id} className={styles.postCard}>
                <div 
                  className={styles.postImage} 
                  style={{ 
                    backgroundImage: `url(${post.image_url || '/default-post-bg.svg'})`
                  }}
                ></div>
                <h3>{post.title || 'Untitled Post'}</h3>
                <p>
                  {post.content?.length > 100
                    ? `${post.content.substring(0, 100)}...`
                    : post.content || 'No content'}
                </p>
                <Link href={`/posts/${post.id}`} className={styles.viewPostLink}>
                  View Post
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyPosts}>
            <p>This user hasn't posted anything yet.</p>
          </div>
        )}
      </div>
    </div>
  );
} 