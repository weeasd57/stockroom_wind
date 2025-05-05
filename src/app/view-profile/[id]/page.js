'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import Image from 'next/image';
import styles from '@/styles/view-profile.module.css';
import Link from 'next/link';

export default function ViewProfile({ params }) {
  const { supabase, isAuthenticated, user } = useSupabase();
  const router = useRouter();
  
  // Make sure to extract the ID correctly from params
  const userId = params?.id;
  console.log("Received params:", params);
  console.log("User ID from URL:", userId);
  
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [backgroundUrl, setBackgroundUrl] = useState('https://images.unsplash.com/photo-1579546929662-711aa81148cf?q=80&w=1200&auto=format&fit=crop');
  const [postCount, setPostCount] = useState(0);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [avatarError, setAvatarError] = useState(false);

  // Fetch profile data
  useEffect(() => {
    // Only redirect if there's definitely no user ID
    if (userId === undefined || userId === null) {
      console.error("No user ID found in params, redirecting to home");
      router.push('/home');
      return;
    }

    console.log("Fetching profile data for user ID:", userId);
    
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
          console.error('Profile error:', profileError);
          throw profileError;
        }
        
        if (!profile) {
          throw new Error('Profile not found');
        }
        
        console.log("Profile data fetched successfully:", profile);
        setProfileData(profile);
        
        // Fetch user posts
        const { data: posts, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
          
        if (postsError) {
          console.error('Error fetching posts:', postsError);
        } else {
          console.log("Posts fetched:", posts?.length || 0);
          setProfilePosts(posts || []);
          setPostCount(posts?.length || 0);
        }
        
        // Fetch followers
        const { data: followersData, error: followersError } = await supabase
          .from('user_followings')
          .select('follower_id, profiles!user_followings_follower_id_fkey(id, username, avatar_url)')
          .eq('following_id', userId);
          
        if (followersError) {
          console.error('Error fetching followers:', followersError);
        } else {
          console.log("Followers fetched:", followersData?.length || 0);
          setFollowers(followersData || []);
        }
        
        // Fetch following
        const { data: followingData, error: followingError } = await supabase
          .from('user_followings')
          .select('following_id, profiles!user_followings_following_id_fkey(id, username, avatar_url)')
          .eq('follower_id', userId);
          
        if (followingError) {
          console.error('Error fetching following:', followingError);
        } else {
          console.log("Following fetched:", followingData?.length || 0);
          setFollowing(followingData || []);
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
            console.log('No custom avatar found');
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
            console.log('No custom background found');
          }
        }
        
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [userId, supabase, router]);

  // Add effect to check if user is following this profile
  useEffect(() => {
    const checkFollowStatus = async () => {
      // Skip follow status check for unauthenticated users
      if (!isAuthenticated || !user || !userId) return;
      
      try {
        const { data, error } = await supabase
          .from('user_followings')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', userId)
          .single();
          
        if (error && error.code !== 'PGRST116') { // PGRST116 is the "no rows returned" error
          console.error('Error checking follow status:', error);
          return;
        }
        
        setIsFollowing(!!data);
      } catch (error) {
        console.error('Error in checkFollowStatus:', error);
      }
    };
    
    checkFollowStatus();
  }, [supabase, isAuthenticated, user, userId]);

  const handleFollowClick = async () => {
    // Check if user is authenticated before following
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    try {
      if (isFollowing) {
        // Unfollow: Delete the relationship
        const { error: deleteError } = await supabase
          .from('user_followings')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
          
        if (deleteError) {
          throw deleteError;
        }
        
        // Update UI state
        setIsFollowing(false);
        
        console.log('Unfollowed user:', userId);
      } else {
        // Follow: Create the relationship
        const { error: insertError } = await supabase
          .from('user_followings')
          .insert([
            { follower_id: user.id, following_id: userId }
          ]);
          
        if (insertError) {
          throw insertError;
        }
        
        // Update UI state
        setIsFollowing(true);
        
        console.log('Followed user:', userId);
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      alert('There was an error updating your following status');
    }
  };
  
  const handleBackClick = () => {
    router.back();
  };

  const handleAvatarError = () => {
    setAvatarError(true);
    setAvatarUrl('/default-avatar.svg');
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading profile...</p>
      </div>
    );
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
              >
                {isFollowing ? 'Unfollow' : 'Follow'}
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
          <span className={styles.statValue}>{followers.length}</span>
          <span className={styles.statLabel}>Followers</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{following.length}</span>
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