"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getUserProfile, updateUserProfile, getPosts, getFollowers, getFollowing } from '@/utils/supabase';
import styles from '@/styles/profile.module.css';

export default function Profile() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    trading_style: '',
    experience_level: 'beginner',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;
      
      try {
        // Fetch user profile
        const { data: profileData } = await getUserProfile(user.id);
        setProfile(profileData || {});
        
        if (profileData) {
          setFormData({
            username: profileData.username || '',
            bio: profileData.bio || '',
            trading_style: profileData.trading_style || '',
            experience_level: profileData.experience_level || 'beginner',
          });
        }
        
        // Fetch user posts
        const { data: postsData } = await getPosts(10, 0, user.id);
        setPosts(postsData || []);
        
        // Fetch followers
        const { data: followersData } = await getFollowers(user.id);
        // Transform followers data to access profiles correctly
        const transformedFollowers = followersData?.map(item => ({
          id: item.follower_id,
          profiles: item.profiles
        })) || [];
        setFollowers(transformedFollowers);
        
        // Fetch following
        const { data: followingData } = await getFollowing(user.id);
        // Transform following data to access profiles correctly
        const transformedFollowing = followingData?.map(item => ({
          id: item.following_id,
          profiles: item.profiles
        })) || [];
        setFollowing(transformedFollowing);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfileData();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      const { error } = await updateUserProfile(user.id, formData);
      if (error) throw error;
      
      // Update local profile state
      setProfile(prev => ({
        ...prev,
        ...formData
      }));
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.unauthorizedContainer}>
        <h1>Unauthorized</h1>
        <p>Please sign in to view your profile</p>
        <Link href="/login" className={styles.loginButton}>
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.profileHeader}>
        <div className={styles.coverPhoto}>
          <div className={styles.avatarContainer}>
            <Image 
              src={profile?.avatar_url || '/default-avatar.svg'} 
              alt="Profile" 
              width={120} 
              height={120}
              className={styles.avatar}
            />
          </div>
        </div>
        
        <div className={styles.profileInfo}>
          <div className={styles.nameSection}>
            <h1 className={styles.profileName}>{profile?.username || 'Trader'}</h1>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)} 
                className={styles.editButton}
              >
                Edit Profile
              </button>
            )}
          </div>
          
          <p className={styles.profileBio}>{profile?.bio || 'No bio yet'}</p>
          
          <div className={styles.profileStats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{posts.length}</span>
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
          
          <div className={styles.tradingInfo}>
            <div className={styles.tradingInfoItem}>
              <span className={styles.tradingInfoLabel}>Trading Style:</span>
              <span className={styles.tradingInfoValue}>{profile?.trading_style || 'Not specified'}</span>
            </div>
            <div className={styles.tradingInfoItem}>
              <span className={styles.tradingInfoLabel}>Experience:</span>
              <span className={styles.tradingInfoValue}>
                {profile?.experience_level === 'beginner' && 'Beginner'}
                {profile?.experience_level === 'intermediate' && 'Intermediate'}
                {profile?.experience_level === 'advanced' && 'Advanced'}
                {profile?.experience_level === 'professional' && 'Professional'}
                {!profile?.experience_level && 'Not specified'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {isEditing ? (
        <div className={styles.editProfileSection}>
          <h2>Edit Profile</h2>
          <form onSubmit={handleSubmit} className={styles.editForm}>
            <div className={styles.formGroup}>
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className={styles.input}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                className={styles.textarea}
                rows={3}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="trading_style">Trading Style</label>
              <input
                type="text"
                id="trading_style"
                name="trading_style"
                value={formData.trading_style}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="e.g., Day Trading, Swing Trading, Value Investing"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="experience_level">Experience Level</label>
              <select
                id="experience_level"
                name="experience_level"
                value={formData.experience_level}
                onChange={handleInputChange}
                className={styles.select}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="professional">Professional</option>
              </select>
            </div>
            
            <div className={styles.formActions}>
              <button type="submit" className={styles.saveButton}>Save Changes</button>
              <button 
                type="button" 
                onClick={() => setIsEditing(false)} 
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tabButton} ${activeTab === 'posts' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              Posts
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'followers' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('followers')}
            >
              Followers
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'following' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('following')}
            >
              Following
            </button>
          </div>
          
          <div className={styles.tabContent}>
            {activeTab === 'posts' && (
              <div className={styles.postsGrid}>
                {posts.length > 0 ? (
                  posts.map(post => (
                    <div key={post.id} className={styles.postCard}>
                      <h3 className={styles.postTitle}>{post.title}</h3>
                      <p className={styles.postExcerpt}>
                        {post.content.length > 100 
                          ? `${post.content.substring(0, 100)}...` 
                          : post.content}
                      </p>
                      <Link href={`/posts/${post.id}`} className={styles.readMoreLink}>
                        Read More
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <p>You haven't created any posts yet.</p>
                    <Link href="/create-post" className={styles.createPostButton}>
                      Create Your First Post
                    </Link>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'followers' && (
              <div className={styles.usersGrid}>
                {followers.length > 0 ? (
                  followers.map(follower => (
                    <div key={follower.id} className={styles.userCard}>
                      <Image 
                        src={follower.profiles?.avatar_url || '/default-avatar.svg'} 
                        alt={follower.profiles?.username || 'User'} 
                        width={50} 
                        height={50}
                        className={styles.userAvatar}
                      />
                      <div className={styles.userInfo}>
                        <h3 className={styles.userName}>{follower.profiles?.username || 'User'}</h3>
                        <Link href={`/profile/${follower.id}`} className={styles.viewProfileLink}>
                          View Profile
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <p>You don't have any followers yet.</p>
                    <p className={styles.emptyStateSubtext}>Share your profile to gain followers!</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'following' && (
              <div className={styles.usersGrid}>
                {following.length > 0 ? (
                  following.map(follow => (
                    <div key={follow.id} className={styles.userCard}>
                      <Image 
                        src={follow.profiles?.avatar_url || '/default-avatar.svg'} 
                        alt={follow.profiles?.username || 'User'} 
                        width={50} 
                        height={50}
                        className={styles.userAvatar}
                      />
                      <div className={styles.userInfo}>
                        <h3 className={styles.userName}>{follow.profiles?.username || 'User'}</h3>
                        <Link href={`/profile/${follow.id}`} className={styles.viewProfileLink}>
                          View Profile
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <p>You're not following anyone yet.</p>
                    <Link href="/" className={styles.exploreButton}>
                      Explore Traders
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
