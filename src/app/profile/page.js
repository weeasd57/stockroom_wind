"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { 
  updateProfile,
  uploadImage
} from '@/utils/supabase';
import styles from '@/styles/profile.module.css';
import useProfileStore from '@/store/profileStore';

export default function Profile() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { 
    profile, 
    loading: profileLoading,
    avatarUrl: contextAvatarUrl,
    backgroundUrl: contextBackgroundUrl,
    updateProfile
  } = useProfile();

  // Profile store state and actions
  const {
    posts,
    followers,
    following,
    activeTab,
    isLoading,
    error,
    isInitialized,
    setActiveTab,
    initializeData,
    refreshData
  } = useProfileStore();

  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(contextAvatarUrl || '/default-avatar.svg');
  const [backgroundUrl, setBackgroundUrl] = useState(contextBackgroundUrl || '/profile-bg.jpg');
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const refreshInterval = useRef(null);

  // Initialize data once when authenticated
  useEffect(() => {
    if (user && isAuthenticated && !isInitialized) {
      initializeData(user.id);
    }
  }, [user, isAuthenticated, isInitialized, initializeData]);

  // Set up background refresh interval
  useEffect(() => {
    if (user && isAuthenticated) {
      // Initial background refresh
      refreshData(user.id);

      // Set up interval for background refresh (every 30 seconds)
      refreshInterval.current = setInterval(() => {
        refreshData(user.id);
      }, 30000);
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [user, isAuthenticated, refreshData]);

  // Update profile images when context changes
  useEffect(() => {
    if (user) {
      setAvatarUrl(contextAvatarUrl || '/default-avatar.svg');
      setBackgroundUrl(contextBackgroundUrl || '/profile-bg.jpg');
    }
  }, [user, contextAvatarUrl, contextBackgroundUrl]);

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  // Memoized handlers
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, [setActiveTab]);

  const handleEditProfile = useCallback(() => {
    setShowEditModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowEditModal(false);
    setAvatarFile(null);
    setBackgroundFile(null);
    setAvatarPreview(null);
    setBackgroundPreview(null);
    setFormData({
      username: profile?.username || '',
      bio: profile?.bio || ''
    });
  }, [profile]);

  // Only show loading state during initial load
  if (authLoading || (profileLoading && !isInitialized)) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.notAuthenticated}>
        <h1>Not Authenticated</h1>
        <p>Please <Link href="/login">login</Link> to view your profile.</p>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleBackgroundClick = () => {
    backgroundInputRef.current.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBackgroundChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBackgroundFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return null;
    
    try {
      console.log('Uploading avatar image...');
      const { publicUrl, error } = await uploadImage(
        avatarFile,
        'avatars',
        user.id,
        'avatar'
      );
      
      if (error) {
        console.error('Error uploading avatar:', error);
        throw error;
      }
      
      console.log('Avatar uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error in uploadAvatar:', error);
      throw error;
    }
  };

  const uploadBackground = async () => {
    if (!backgroundFile) return null;
    
    try {
      console.log('Uploading background image...');
      const { publicUrl, error } = await uploadImage(
        backgroundFile,
        'backgrounds',
        user.id,
        'background'
      );
      
      if (error) {
        console.error('Error uploading background:', error);
        throw error;
      }
      
      console.log('Background uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error in uploadBackground:', error);
      throw error;
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    
    try {
      // Upload avatar and background in parallel if selected
      const uploadPromises = [];
      let newAvatarUrl = null;
      let newBackgroundUrl = null;
      
      if (avatarFile) {
        uploadPromises.push(
          uploadAvatar()
            .then(url => {
              newAvatarUrl = url;
              console.log('Avatar URL after upload:', newAvatarUrl);
            })
            .catch(error => {
              console.error('Avatar upload failed:', error);
              setSaveError(prev => prev || 'Failed to upload avatar image. Please try again.');
            })
        );
      }
      
      if (backgroundFile) {
        uploadPromises.push(
          uploadBackground()
            .then(url => {
              newBackgroundUrl = url;
              console.log('Background URL after upload:', newBackgroundUrl);
            })
            .catch(error => {
              console.error('Background upload failed:', error);
              setSaveError(prev => prev || 'Failed to upload background image. Please try again.');
            })
        );
      }
      
      // Wait for all uploads to complete
      if (uploadPromises.length > 0) {
        await Promise.allSettled(uploadPromises);
      }
      
      // Prepare update data
      const updateData = {
        ...formData
      };
      
      // Only update avatar_url if a new file was uploaded successfully
      if (newAvatarUrl) {
        updateData.avatar_url = newAvatarUrl;
      }
      
      // Add background URL if uploaded successfully
      if (newBackgroundUrl) {
        updateData.background_url = newBackgroundUrl;
      }
      
      console.log('Updating profile with data:', updateData);
      
      // Update profile
      const { success, error } = await updateProfile(updateData);
      
      if (!success) {
        setSaveError('Failed to update profile information. Please try again.');
        throw error || new Error('Failed to update profile');
      }
      
      console.log('Profile updated successfully');
      
      // Reset files
      setAvatarFile(null);
      setAvatarPreview(null);
      setBackgroundFile(null);
      setBackgroundPreview(null);
      
      setShowEditModal(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveError(saveError || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.profileContainer}>
      {isSaving && (
        <div className={styles.savingOverlay}>
          <div className={styles.savingProgress}>
            <div className={styles.savingBar}></div>
            <p>Saving changes...</p>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorToast}>
          {error}
          <button onClick={() => useProfileStore.getState().setError(null)}>×</button>
        </div>
      )}

      {/* Profile Header */}
      <div 
        className={styles.profileHeader}
        style={{ 
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'background-image 0.3s ease-in-out'
        }}
      >
        <div className={styles.profileHeaderOverlay}>
          <div className={styles.profileInfo}>
            {/* Avatar with overlay for editing */}
            <div className={styles.profileAvatar} onClick={showEditModal ? handleAvatarClick : undefined}>
              {showEditModal && (
                <div className={styles.avatarOverlay}>
                  <span>Change</span>
                </div>
              )}
              <img
                src={avatarPreview || avatarUrl}
                alt={profile?.username || 'User'}
                width={100}
                height={100}
                className={styles.avatar}
                onError={(e) => {
                  console.error('Error loading avatar image:', e);
                  e.target.onerror = null;
                  e.target.src = '/default-avatar.svg';
                }}
              />
            </div>
            
            {/* User info section */}
            <div className={styles.nameSection}>
              <h1 className={styles.profileName}>{profile?.username || 'Trader'}</h1>
              <p className={styles.profileBio}>{profile?.bio || 'No bio yet'}</p>
              
              {!showEditModal && (
                <button 
                  onClick={handleEditProfile} 
                  className={styles.editButton}
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Trading Statistics */}
      <div className={styles.tradingInfo}>
        <div className={styles.tradingInfoItem}>
          <span className={styles.tradingInfoLabel}>Experience:</span>
          <span className={styles.tradingInfoValue}>
            {profile?.experience_level ? 
              profile.experience_level.charAt(0).toUpperCase() + profile.experience_level.slice(1) : 
              'Beginner'}
          </span>
        </div>
        <div className={styles.tradingInfoItem}>
          <span className={styles.tradingInfoLabel}>Success Posts:</span>
          <span className={styles.tradingInfoValue}>{profile?.success_posts || 0}</span>
        </div>
        <div className={styles.tradingInfoItem}>
          <span className={styles.tradingInfoLabel}>Loss Posts:</span>
          <span className={styles.tradingInfoValue}>{profile?.loss_posts || 0}</span>
        </div>
      </div>

      {/* Profile Stats */}
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

      {/* Content Tabs */}
      <div className={styles.contentTabs}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'posts' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('posts')}
        >
          Posts
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'followers' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('followers')}
        >
          Followers
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'following' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('following')}
        >
          Following
        </button>
      </div>

      {/* Content Section */}
      <div className={styles.contentSection}>
        {activeTab === 'posts' && (
          <div className={styles.postsGrid}>
            {posts.length > 0 ? (
              posts.map(post => (
                <div key={post.id} className={styles.postCard}>
                  <p className={styles.postContent}>{post.content}</p>
                  <div className={styles.postMeta}>
                    <span className={styles.postDate}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.emptyMessage}>No posts yet</p>
            )}
          </div>
        )}
        
        {activeTab === 'followers' && (
          <div className={styles.usersGrid}>
            {followers.length > 0 ? (
              followers.map(follower => (
                <div key={follower.id} className={styles.userCard}>
                  <img 
                    src={follower.profiles?.avatar_url || '/default-avatar.svg'} 
                    alt={follower.profiles?.username || 'User'} 
                    width={50} 
                    height={50}
                    className={styles.userAvatar}
                  />
                  <span className={styles.userName}>{follower.profiles?.username || 'User'}</span>
                </div>
              ))
            ) : (
              <p className={styles.emptyMessage}>No followers yet</p>
            )}
          </div>
        )}
        
        {activeTab === 'following' && (
          <div className={styles.usersGrid}>
            {following.length > 0 ? (
              following.map(follow => (
                <div key={follow.id} className={styles.userCard}>
                  <img 
                    src={follow.profiles?.avatar_url || '/default-avatar.svg'} 
                    alt={follow.profiles?.username || 'User'} 
                    width={50} 
                    height={50}
                    className={styles.userAvatar}
                  />
                  <span className={styles.userName}>{follow.profiles?.username || 'User'}</span>
                </div>
              ))
            ) : (
              <p className={styles.emptyMessage}>Not following anyone yet</p>
            )}
          </div>
        )}
      </div>
      
      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit Profile</h2>
              <button className={styles.closeButton} onClick={handleCloseModal} disabled={isSaving}>×</button>
            </div>
            
            {saveError && (
              <div className={styles.errorMessage}>
                {saveError}
              </div>
            )}
            
            <form onSubmit={handleSaveProfile} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  disabled={isSaving}
                  placeholder="Enter your username"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows={4}
                  disabled={isSaving}
                  placeholder="Tell us about yourself"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Profile Picture</label>
                <div className={styles.avatarUpload}>
                  <div className={styles.avatarPreviewContainer}>
                    <img
                      src={avatarPreview || avatarUrl}
                      alt="Avatar Preview"
                      width={100}
                      height={100}
                      className={styles.avatarPreview}
                      onError={(e) => {
                        console.error('Error loading avatar image:', e);
                        e.target.onerror = null;
                        e.target.src = '/default-avatar.svg';
                      }}
                    />
                  </div>
                  <button 
                    type="button" 
                    className={styles.changeAvatarButton}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                  >
                    Change Avatar
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={isSaving}
                  />
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>Background Image</label>
                <div className={styles.backgroundUpload}>
                  <div className={styles.backgroundPreviewContainer}>
                    <div 
                      className={styles.backgroundPreview}
                      style={{ 
                        backgroundImage: `url(${backgroundPreview || backgroundUrl})` 
                      }}
                    />
                  </div>
                  <button 
                    type="button" 
                    className={styles.changeBackgroundButton}
                    onClick={() => backgroundInputRef.current?.click()}
                    disabled={isSaving}
                  >
                    Change Background
                  </button>
                  <input
                    type="file"
                    ref={backgroundInputRef}
                    onChange={handleBackgroundChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={isSaving}
                  />
                </div>
              </div>
              
              <div className={styles.formActions}>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={handleCloseModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.saveButton}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
