'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import styles from '@/styles/view-profile.module.css';
import Link from 'next/link';

export default function ViewProfile() {
  const { supabase, isAuthenticated, user } = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [backgroundUrl, setBackgroundUrl] = useState('/profile-bg.jpg');
  const [postCount, setPostCount] = useState(0);
  const [error, setError] = useState(null);

  // Fetch profile data
  useEffect(() => {
    if (!userId) return;

    const fetchProfileData = async () => {
      try {
        setLoading(true);
        
        // Create an anonymous Supabase client if user is not authenticated
        const client = isAuthenticated ? supabase : supabase;
        
        // Fetch user profile
        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (profileError) {
          throw profileError;
        }
        
        if (!profile) {
          throw new Error('Profile not found');
        }
        
        setProfileData(profile);
        
        // Fetch user posts
        const { data: posts, error: postsError } = await client
          .from('posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
          
        if (postsError) {
          console.error('Error fetching posts:', postsError);
        } else {
          setProfilePosts(posts || []);
          setPostCount(posts?.length || 0);
        }
        
        // Try to get avatar and background images
        try {
          const { data: avatarData } = await client
            .storage
            .from('avatars')
            .getPublicUrl(`${userId}/avatar.png`);
            
          if (avatarData?.publicUrl) {
            setAvatarUrl(`${avatarData.publicUrl}?t=${Date.now()}`);
          }
        } catch (e) {
          console.log('No custom avatar found');
        }
        
        try {
          const { data: bgData } = await client
            .storage
            .from('backgrounds')
            .getPublicUrl(`${userId}/background.png`);
            
          if (bgData?.publicUrl) {
            setBackgroundUrl(`${bgData.publicUrl}?t=${Date.now()}`);
          }
        } catch (e) {
          console.log('No custom background found');
        }
        
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [userId, supabase, isAuthenticated]);

  const handleFollowClick = () => {
    // Check if user is authenticated before following
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    // Follow logic would go here
    console.log('Follow user:', userId);
  };
  
  const handleBackClick = () => {
    router.back();
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
      {/* Background Image */}
      <div 
        className={styles.profileBackground}
        style={{ backgroundImage: `url(${backgroundUrl})` }}
      />
      
      {/* Back Button */}
      <button onClick={handleBackClick} className={styles.backButton}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </button>
      
      {/* Profile Header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileAvatar}>
          <img src={avatarUrl} alt={profileData?.username || 'Profile'} />
        </div>
        
        <div className={styles.profileInfo}>
          <h1>{profileData?.full_name || 'Trader'}</h1>
          <p className={styles.username}>@{profileData?.username || 'username'}</p>
          <p className={styles.bio}>{profileData?.bio || 'No bio available'}</p>
          
          <div className={styles.profileStats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{postCount}</span>
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
          </div>
          
          <button 
            className={`${styles.followButton} ${!isAuthenticated ? styles.disabledButton : ''}`} 
            onClick={handleFollowClick}
          >
            {isAuthenticated ? 'Follow' : 'Log in to Follow'}
          </button>
        </div>
      </div>
      
      {/* Posts Section */}
      <div className={styles.postsSection}>
        <h2>Recent Posts</h2>
        
        {profilePosts.length > 0 ? (
          <div className={styles.postsGrid}>
            {profilePosts.map(post => (
              <div key={post.id} className={styles.postCard}>
                <h3>{post.title}</h3>
                <p>{post.content?.substring(0, 100)}...</p>
                <Link href={`/posts/${post.id}`} className={styles.viewPostLink}>
                  View Post
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyPosts}>
            <p>No posts yet</p>
          </div>
        )}
      </div>
    </div>
  );
} 