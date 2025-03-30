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
import CreatePostButton from '@/components/posts/CreatePostButton';
import { withClientOnly } from '@/components/ClientOnly';

function Profile() {
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
    experience_level: 'beginner',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(contextAvatarUrl || '/default-avatar.svg');
  const [backgroundUrl, setBackgroundUrl] = useState(contextBackgroundUrl || '/profile-bg.jpg');
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState(0);
  const [avatarUploadError, setAvatarUploadError] = useState(null);
  const [backgroundUploadError, setBackgroundUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const refreshInterval = useRef(null);

  // Initialize data once when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    // Initialize profile store if not already done
    if (!isInitialized) {
      initializeData(user.id);
    }
    
    // Update form data with profile details when they become available
    if (profile && !profileLoading) {
      setFormData({
        username: profile.username || '',
        bio: profile.bio || '',
        experience_level: profile.experience_level || 'beginner',
      });
      setAvatarUrl(contextAvatarUrl || '/default-avatar.svg');
      setBackgroundUrl(contextBackgroundUrl || '/profile-bg.jpg');
    }
  }, [user, contextAvatarUrl, contextBackgroundUrl, profile, profileLoading, isAuthenticated, isInitialized, initializeData]);

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

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        bio: profile.bio || '',
        experience_level: profile.experience_level || 'beginner',
      });
    }
  }, [profile]);

  // Add this effect to load images when profile or context data updates
  useEffect(() => {
    if (user && isAuthenticated) {
      // Set avatar URL from context when it becomes available
      if (contextAvatarUrl && contextAvatarUrl !== avatarUrl) {
        console.log('Updating avatar from context:', contextAvatarUrl);
        setAvatarUrl(contextAvatarUrl);
      }
      
      // Set background URL from context when it becomes available
      if (contextBackgroundUrl && contextBackgroundUrl !== backgroundUrl) {
        console.log('Updating background from context:', contextBackgroundUrl);
        setBackgroundUrl(contextBackgroundUrl);
      }
    }
  }, [user, isAuthenticated, contextAvatarUrl, contextBackgroundUrl, avatarUrl, backgroundUrl]);

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
      bio: profile?.bio || '',
      experience_level: profile?.experience_level || 'beginner',
    });
  }, [profile]);

  // Add this function at the top level of the component
  const addCacheBuster = (url) => {
    if (!url || url.startsWith('/')) return url;
    const cacheBuster = `?t=${Date.now()}`;
    return url.includes('?') ? url : `${url}${cacheBuster}`;
  };

  // Simplified function that doesn't refresh images automatically
  const refreshImages = useCallback(async () => {
    if (!user) return;
    
    try {
      // Only refresh context data
      await refreshData(user.id);
      // No longer refreshing avatar or background images here
    } catch (error) {
      console.error('Error refreshing profile data:', error);
    }
  }, [user, refreshData]);

  // Add this effect to load images only once when the page loads
  useEffect(() => {
    if (user && isAuthenticated && profile) {
      // Create a function that sets image URLs only once
      const loadImagesOnce = async () => {
        console.log('Loading profile images on page load');
        
        try {
          // Get the latest data from the database
          await refreshData(user.id);
          
          // Set avatar URL once without cache busting
          if (contextAvatarUrl) {
            console.log('Setting initial avatar URL:', contextAvatarUrl);
            setAvatarUrl(contextAvatarUrl);
          }
          
          // Set background image once
          if (contextBackgroundUrl) {
            console.log('Setting initial background URL:', contextBackgroundUrl);
            setBackgroundUrl(contextBackgroundUrl);
          }
        } catch (error) {
          console.error('Error loading initial images:', error);
        }
      };
      
      // Run the function
      loadImagesOnce();
    }
  }, [user, isAuthenticated, profile]);

  // Clear upload errors when modal opens/closes
  useEffect(() => {
    if (showEditModal) {
      setAvatarUploadError(null);
      setBackgroundUploadError(null);
    }
  }, [showEditModal]);

  // Force refresh the background image when needed
  const forceRefreshBackground = useCallback(() => {
    if (backgroundUrl) {
      console.log('Forcing background refresh');
      // Add a temporary cache buster to the URL to force a refresh
      const cacheBuster = `?t=${Date.now()}`;
      const baseUrl = backgroundUrl.split('?')[0];
      const tempUrl = `${baseUrl}${cacheBuster}`;
      
      // Set a temporary URL to force refresh, then revert back
      setBackgroundUrl(tempUrl);
      
      // After a short delay, revert to the clean URL
      setTimeout(() => {
        setBackgroundUrl(baseUrl);
      }, 100);
    }
  }, [backgroundUrl]);
  
  // Call force refresh after the background upload is complete
  useEffect(() => {
    if (backgroundUploadProgress === 100) {
      const timer = setTimeout(() => {
        forceRefreshBackground();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [backgroundUploadProgress, forceRefreshBackground]);

  // Add useEffect to periodically refresh posts
  useEffect(() => {
    // Initial load
    if (user && !isInitialized) {
      initializeData(user.id);
    }
    
    // Set up auto-refresh
    let refreshInterval;
    if (user && user.id) {
      refreshInterval = setInterval(() => {
        refreshData(user.id);
      }, 60000); // Refresh every minute
    }
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [user, isInitialized, initializeData, refreshData]);

  // Only show loading state during initial load
  if (authLoading || (profileLoading && !isInitialized)) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.notAuthenticated}>
        <h1>Not Authenticated</h1>
        <p>You need to be logged in to view and manage your profile</p>
        <Link href="/login" className={styles.loginButton}>
          Log In to Continue
        </Link>
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

  // Handle background image click to open file picker
  const handleBackgroundClick = () => {
    if (showEditModal) {
      document.getElementById('background-file-input').click();
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Clear previous errors
    setAvatarUploadError(null);
    
    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      setAvatarUploadError('File must be an image');
      console.error('File must be an image');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarUploadError('File must be less than 2MB');
      console.error('File must be less than 2MB');
      return;
    }
    
    setAvatarFile(file);
    
    // Create and set preview immediately for instant feedback
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    
    // Log file details for debugging
    console.log(`Selected avatar: ${file.name}, ${file.type}, ${Math.round(file.size / 1024)}KB`);
  };

  const handleBackgroundChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Clear previous errors
    setBackgroundUploadError(null);
    
    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      setBackgroundUploadError('File must be an image');
      console.error('File must be an image');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setBackgroundUploadError('File must be less than 2MB');
      console.error('File must be less than 2MB');
      return;
    }
    
    setBackgroundFile(file);
    
    // Create and set preview immediately for instant feedback
    const previewUrl = URL.createObjectURL(file);
    setBackgroundPreview(previewUrl);
    
    // Log file details for debugging
    console.log(`Selected background: ${file.name}, ${file.type}, ${Math.round(file.size / 1024)}KB`);
  };

  // Upload avatar with better error handling
  const uploadAvatar = async () => {
    if (!avatarFile) return null;
    
    console.log('Starting avatar upload', { 
      name: avatarFile.name, 
      type: avatarFile.type, 
      size: Math.round(avatarFile.size / 1024) + 'KB' 
    });
    
    setAvatarUploadError(null);
    setAvatarUploadProgress(0);
    
    try {
      // Generate a unique filename
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}-avatar-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      console.log(`Uploading avatar to ${filePath}`);
      
      // Upload the file to Supabase Storage
      const { data, error, publicUrl } = await uploadImage(
        avatarFile,
        'avatars',
        user.id,
        'avatar',
        {
          cacheControl: 'no-cache',
          upsert: true,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setAvatarUploadProgress(percent);
            console.log(`Avatar upload progress: ${percent}%`);
          }
        }
      );
      
      if (error) {
        console.error('Supabase avatar upload error:', error);
        let errorMessage = 'Failed to upload avatar image';
        
        // Provide more specific error messages based on error type
        if (error.statusCode === 413) {
          errorMessage = 'Avatar image is too large. Please choose a smaller file (max 2MB).';
        } else if (error.statusCode === 403) {
          errorMessage = 'Permission denied. You may not have access to upload images.';
        } else if (error.statusCode === 429) {
          errorMessage = 'Too many upload attempts. Please try again later.';
        } else if (error.message) {
          errorMessage = `Upload failed: ${error.message}`;
        }
        
        setAvatarUploadError(errorMessage);
        setAvatarUploadProgress(0);
        throw new Error(errorMessage);
      }
      
      console.log('Avatar upload completed successfully');
      
      if (!publicUrl) {
        console.error('No public URL returned from uploadImage');
        throw new Error('Failed to get public URL for avatar image');
      }
      
      console.log('Avatar public URL:', publicUrl);
      
      // Add a delay to ensure Supabase has processed the image
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update the avatar URL state
      setAvatarUrl(publicUrl);
      console.log('Setting avatar URL to:', publicUrl);
      
      // Clean up the preview
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
      
      // Only reset progress if there were no errors
      if (!avatarUploadError) {
        setTimeout(() => {
          setAvatarUploadProgress(0);
        }, 1000);
      }
      
      setAvatarFile(null);
      return publicUrl;
      
    } catch (error) {
      console.error('Avatar upload function error:', error);
      
      // Only set error if not already set
      if (!avatarUploadError) {
        setAvatarUploadError(error.message || 'Failed to upload avatar image. Please try again.');
      }
      
      setAvatarUploadProgress(0);
      throw error;
    }
  };
  
  // Upload background with better error handling and visual feedback
  const uploadBackground = async () => {
    if (!backgroundFile) return null;
    
    console.log('Starting background upload', { 
      name: backgroundFile.name, 
      type: backgroundFile.type, 
      size: Math.round(backgroundFile.size / 1024) + 'KB' 
    });
    
    setBackgroundUploadError(null);
    setBackgroundUploadProgress(0);
    setIsUploading(true);
    
    try {
      // Generate a unique filename
      const fileExt = backgroundFile.name.split('.').pop();
      const fileName = `${user.id}-background-${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;
      
      console.log(`Uploading background to ${filePath}`);
      
      // Upload the file to Supabase Storage
      const { data, error, publicUrl } = await uploadImage(
        backgroundFile,
        'backgrounds',
        user.id,
        'background',
        {
          cacheControl: 'no-cache',
          upsert: true,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setBackgroundUploadProgress(percent);
            console.log(`Background upload progress: ${percent}%`);
          }
        }
      );
      
      if (error) {
        console.error('Supabase background upload error:', error);
        let errorMessage = 'Failed to upload background image';
        
        // Provide more specific error messages based on error type
        if (error.statusCode === 413) {
          errorMessage = 'Background image is too large. Please choose a smaller file (max 2MB).';
        } else if (error.statusCode === 403) {
          errorMessage = 'Permission denied. You may not have access to upload images.';
        } else if (error.statusCode === 429) {
          errorMessage = 'Too many upload attempts. Please try again later.';
        } else if (error.message) {
          errorMessage = `Upload failed: ${error.message}`;
        }
        
        setBackgroundUploadError(errorMessage);
        setBackgroundUploadProgress(0);
        setIsUploading(false);
        throw new Error(errorMessage);
      }
      
      console.log('Background upload completed successfully');
      
      if (!publicUrl) {
        console.error('No public URL returned from uploadImage');
        setBackgroundUploadError('Failed to get public URL for background image');
        setBackgroundUploadProgress(0);
        setIsUploading(false);
        throw new Error('Failed to get public URL for background image');
      }
      
      console.log('Background public URL:', publicUrl);
      
      // Add a delay to ensure Supabase has processed the image
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Extract the base URL without cache busters
      const baseUrl = publicUrl.split('?')[0];
      // Add our own cache buster to force a fresh load
      const refreshedUrl = `${baseUrl}?refresh=${Date.now()}`;
      
      // Set the background URL directly with our cache buster
      setBackgroundUrl(refreshedUrl);
      console.log('Setting background URL to:', refreshedUrl);
      
      // Clean up the preview
      if (backgroundPreview) {
        URL.revokeObjectURL(backgroundPreview);
        setBackgroundPreview(null);
      }
      
      // Only reset progress if there were no errors
      if (!backgroundUploadError) {
        setTimeout(() => {
          setBackgroundUploadProgress(0);
        }, 1000);
      }
      
      setBackgroundFile(null);
      setIsUploading(false);
      return baseUrl; // Return the clean URL for the database
      
    } catch (error) {
      console.error('Background upload function error:', error);
      
      // Only set error if not already set
      if (!backgroundUploadError) {
        setBackgroundUploadError(error.message || 'Failed to upload background image. Please try again.');
      }
      
      setBackgroundUploadProgress(0);
      setIsUploading(false);
      throw error;
    }
  };

  // Update handleSaveProfile to handle image changes directly and display errors clearly
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setAvatarUploadError(null);
    setBackgroundUploadError(null);
    setIsSaving(true);
    setIsUploading(true);
    
    try {
      // Upload avatar and background images if selected
      let newAvatarUrl = null;
      let newBackgroundUrl = null;
      
      // Process uploads concurrently if both files are present
      if (avatarFile && backgroundFile) {
        try {
          console.log('Uploading both avatar and background files...');
          
          // Use Promise.allSettled to handle partial failures
          const results = await Promise.allSettled([
            uploadAvatar(),
            uploadBackground()
          ]);
          
          // Handle results
          if (results[0].status === 'fulfilled') {
            newAvatarUrl = results[0].value;
            console.log('Avatar upload succeeded:', newAvatarUrl);
          } else {
            console.error('Avatar upload failed:', results[0].reason);
            // Error is already set by uploadAvatar
          }
          
          if (results[1].status === 'fulfilled') {
            newBackgroundUrl = results[1].value;
            console.log('Background upload succeeded:', newBackgroundUrl);
          } else {
            console.error('Background upload failed:', results[1].reason);
            // Error is already set by uploadBackground
          }
          
          // If both failed, stop the save process
          if (results[0].status === 'rejected' && results[1].status === 'rejected') {
            setSaveError('Failed to upload images. Please try again.');
            setIsSaving(false);
            setIsUploading(false);
            return;
          }
          
        } catch (uploadError) {
          console.error('Error during file uploads:', uploadError);
          setSaveError('Error uploading images. Please try again.');
          setIsSaving(false);
          setIsUploading(false);
          return;
        }
      } else {
        // Process individual uploads if needed
        if (avatarFile) {
          try {
            console.log('Uploading only avatar file...');
            const url = await uploadAvatar();
            newAvatarUrl = url;
            console.log('Avatar URL after upload (for database):', newAvatarUrl);
            // URL is already set in uploadAvatar function
          } catch (avatarError) {
            console.error('Error uploading avatar:', avatarError);
            // Error is already set by uploadAvatar
            if (!backgroundFile) {
              setIsSaving(false);
              setIsUploading(false);
              return;
            }
          }
        }
        
        if (backgroundFile) {
          try {
            console.log('Uploading only background file...');
            const url = await uploadBackground();
            newBackgroundUrl = url;
            console.log('Background URL after upload (for database):', newBackgroundUrl);
            // URL is already set in uploadBackground function
          } catch (backgroundError) {
            console.error('Error uploading background:', backgroundError);
            // Error is already set by uploadBackground
            if (!avatarFile || avatarUploadError) {
              setIsSaving(false);
              setIsUploading(false);
              return;
            }
          }
        }
      }
      
      // Check if there are any successful uploads to continue with
      if (avatarFile && !newAvatarUrl && backgroundFile && !newBackgroundUrl) {
        console.log('No successful uploads to save');
        setIsSaving(false);
        setIsUploading(false);
        return;
      }
      
      // Prepare the profile update data
      const updateData = {
        ...formData
      };
      
      // Add any new image URLs to the update data
      if (newAvatarUrl) {
        updateData.avatar_url = newAvatarUrl.split('?')[0]; // Remove cache busting
        console.log('Adding avatar_url to update data:', updateData.avatar_url);
      }
      
      if (newBackgroundUrl) {
        updateData.background_url = newBackgroundUrl.split('?')[0]; // Remove cache busting
        console.log('Adding background_url to update data:', updateData.background_url);
      }
      
      console.log('Updating profile with data:', updateData);
      
      // Save the profile updates to Supabase
      const { success, error } = await updateProfile(updateData);
      
      if (error) {
        console.error('Error updating profile in Supabase:', error);
        setSaveError(error.message || 'Failed to update profile. Please try again.');
        setIsUploading(false);
        return;
      }
      
      console.log('Profile updated successfully in Supabase');
      
      // Just update the context data without refreshing images
      await refreshData(user.id);
      
      // Only close modal if there were no errors
      if (!avatarUploadError && !backgroundUploadError && !saveError) {
        setShowEditModal(false);
      }
      
    } catch (error) {
      console.error('Error in handleSaveProfile:', error);
      setSaveError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  // Update avatar img element to handle loading errors better
  const avatarImgElement = (imgSrc) => (
    <div className={styles.avatarPreviewContainer}>
      <img
        src={imgSrc || '/default-avatar.svg'}
        alt={profile?.username || 'User'}
        className={styles.avatarPreview}
        key={`avatar-${Date.now()}`} // Ensure re-render on URL change with unique key
        onError={(e) => {
          console.error('Error loading avatar image in dialog:', e);
          e.target.onerror = null; // Prevent infinite error loop
          e.target.src = '/default-avatar.svg';
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block'
        }}
      />
    </div>
  );

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
          backgroundImage: `url(${backgroundPreview || backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          imageRendering: 'auto',
        }}
        key={backgroundUrl} // Add a key attribute to force re-render when URL changes
        aria-label="Profile background image"
        onError={(e) => {
          console.error('Error loading background image');
          // Directly set the background to the default image in case of error
          e.target.style.backgroundImage = `url('/profile-bg.jpg')`;
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
                src={avatarPreview || avatarUrl || '/default-avatar.svg'} 
                alt={profile?.username || 'User'}
                className={styles.avatar}
                key={`profile-avatar-${Date.now()}`}
                onError={(e) => {
                  console.error('Error loading profile avatar image');
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
                <div className={styles.profileButtons}>
                  <button 
                    onClick={handleEditProfile} 
                    className={styles.editButton}
                  >
                    Edit Profile
                  </button>
                </div>
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
            {/* createPostContainer */}

      <div className={styles.emptyHomeContainer}>
        <div className={styles.createPostContainer}>
          <h1 className={styles.emptyHomeTitle}>Create a New Post</h1>
          <p className={styles.emptyHomeText}>Share your stock analysis with the community</p>
          <CreatePostButton className={styles.createPostButton} inDialog={true} />
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
          <>
            {isLoading && posts.length === 0 ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading posts...</p>
              </div>
            ) : (
              <div className={styles.postsGrid}>
                {posts.length > 0 ? (
                  posts.map(post => (
                    <div key={post.id} className={styles.postCard}>
                      {post.image_url && (
                        <div className={styles.postImageContainer}>
                          <img 
                            src={post.image_url} 
                            alt="Post" 
                            className={styles.postImage}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      <div className={styles.postContent}>
                        {post.content}
                      </div>
                      
                      {post.symbol && (
                        <div className={styles.stockInfo}>
                          <div className={styles.stockSymbol}>
                            {post.symbol}
                            {post.company_name && <span> - {post.company_name}</span>}
                          </div>
                          
                          {post.current_price && (
                            <div className={styles.priceInfo}>
                              <div className={styles.currentPrice}>
                                Current: {post.current_price}
                              </div>
                              
                              {post.target_price && (
                                <div className={styles.targetPrice}>
                                  Target: {post.target_price}
                                </div>
                              )}
                              
                              {post.stop_loss_price && (
                                <div className={styles.stopLossPrice}>
                                  Stop: {post.stop_loss_price}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {post.strategy && (
                            <div className={styles.strategy}>
                              Strategy: {post.strategy}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className={styles.postMeta}>
                        <span className={styles.postDate}>
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyPostsContainer}>
                    <p className={styles.emptyMessage}>No posts yet</p>
                    <p className={styles.createPostPrompt}>
                      Share your first trading idea with the community!
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
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
                <button 
                  className={styles.dismissError} 
                  onClick={() => setSaveError(null)}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
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
                    {avatarUploadProgress > 0 && (
                      <div className={styles.imageLoadingOverlay}>
                        <div className={styles.uploadProgress}>
                          <div className={styles.progressBar} style={{width: `${avatarUploadProgress}%`}}></div>
                          <span>{Math.round(avatarUploadProgress)}%</span>
                        </div>
                      </div>
                    )}
                    <img
                      src={avatarPreview || avatarUrl || '/default-avatar.svg'}
                      alt={profile?.username || 'User'}
                      className={styles.avatarPreview}
                      key={`avatar-${Date.now()}`}
                      onError={(e) => {
                        console.error('Error loading avatar image in dialog');
                        e.target.onerror = null;
                        e.target.src = '/default-avatar.svg';
                      }}
                    />
                  </div>
                  {avatarUploadError && (
                    <p className={styles.uploadError}>{avatarUploadError}</p>
                  )}
                  <button 
                    type="button" 
                    className={styles.changeAvatarButton}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving || avatarUploadProgress > 0}
                  >
                    {avatarUploadProgress > 0 ? `Uploading (${Math.round(avatarUploadProgress)}%)` : 'Change Avatar'}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={isSaving || avatarUploadProgress > 0}
                  />
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>Background Image</label>
                <div 
                  className={styles.backgroundPreview}
                  style={{
                    backgroundImage: `url(${backgroundPreview || backgroundUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative'
                  }}
                  onClick={() => backgroundUploadProgress === 0 && !isSaving && document.getElementById('background-file-input').click()}
                >
                  {backgroundUploadProgress > 0 && (
                    <div className={styles.imageLoadingOverlay}>
                      <div className={styles.uploadProgress}>
                        <div className={styles.progressBar} style={{width: `${backgroundUploadProgress}%`}}></div>
                        <span>{Math.round(backgroundUploadProgress)}%</span>
                      </div>
                    </div>
                  )}
                  <div className={styles.backgroundOverlay}>
                    <span>{backgroundUploadProgress > 0 ? `Uploading (${Math.round(backgroundUploadProgress)}%)` : 'Change Background'}</span>
                  </div>
                </div>
                {backgroundUploadError && (
                  <div className={styles.errorContainer}>
                    <p className={styles.uploadError}>{backgroundUploadError}</p>
                    <button 
                      type="button" 
                      className={styles.dismissError} 
                      onClick={() => setBackgroundUploadError(null)}
                      aria-label="Dismiss error"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  id="background-file-input"
                  onChange={handleBackgroundChange}
                  style={{ display: 'none' }}
                  disabled={isSaving || backgroundUploadProgress > 0}
                />
                <button 
                  type="button" 
                  className={styles.changeBackgroundButton}
                  onClick={() => document.getElementById('background-file-input').click()}
                  disabled={isSaving || backgroundUploadProgress > 0}
                >
                  {backgroundUploadProgress > 0 ? `Uploading (${Math.round(backgroundUploadProgress)}%)` : 'Change Background'}
                </button>
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

// Export wrapped version that only renders on the client side
export default withClientOnly(Profile,
  // Simple loading state for server-side rendering
  <div className="w-full h-screen flex items-center justify-center">
    <div className="animate-pulse text-center">
      <h2 className="text-2xl font-bold mb-4">Loading Profile...</h2>
      <p className="text-gray-500">Preparing your personalized experience</p>
    </div>
  </div>
);
