'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
// No longer needed since we're using the ProfileProvider
// import useProfileStore from '@/store/profileStore';
import Link from 'next/link';
import styles from '@/styles/profile.module.css';
import editStyles from '@/styles/editProfile.module.css';
import { CreatePostButton } from '@/components/posts/CreatePostButton';
import { uploadImage } from '@/utils/supabase';
import { CreatePostForm } from '@/components/posts/CreatePostForm';
import { useCreatePostForm } from '@/providers/CreatePostFormProvider';
import { createPortal } from 'react-dom';
import '@/styles/create-post-page.css';
import ProfilePostCard from '@/components/profile/ProfilePostCard';
import CheckPostPricesButton from '@/components/profile/CheckPostPricesButton';
import StrategyDetailsModal from '@/components/profile/StrategyDetailsModal';
import CountrySelectDialog from '@/components/ui/CountrySelectDialog';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import SymbolSearchDialog from '@/components/ui/SymbolSearchDialog';
import { getCountrySymbolCounts } from '@/utils/symbolSearch';

export default function Profile() {
  const { user, isAuthenticated, loading: authLoading } = useSupabase();
  const { 
    profile, 
    loading: profileLoading,
    avatarUrl: contextAvatarUrl,
    backgroundUrl: contextBackgroundUrl,
    updateProfile,
    // Additional values from ProfileProvider that were previously in useProfileStore
    posts,
    followers,
    following,
    activeTab,
    isLoading,
    error,
    isInitialized,
    setActiveTab,
    initializeData,
    refreshData,
    selectedStrategy,
    setSelectedStrategy,
    clearSelectedStrategy,
    strategies, // Add this line to get the strategies from the ProfileProvider
    lastFetched, // Added lastFetched
    isRefreshing // Added isRefreshing
  } = useProfile();

  // Debug authentication on mount
  useEffect(() => {
    console.log("[PROFILE] Authentication Status:", { 
      isAuthenticated, 
      user: !!user, 
      userId: user?.id,
      authLoading,
      profileLoading
    });
    
    // Debug the profile data
    console.log("[PROFILE] Profile data:", profile);
    if (profile) {
      console.log("[PROFILE] Username from profile:", profile.username);
      console.log("[PROFILE] Profile data type:", typeof profile);
      console.log("[PROFILE] Profile keys:", Object.keys(profile));
      console.log("[PROFILE] Experience score from database:", {
        experience_score: profile.experience_score,
        success_posts: profile.success_posts,
        loss_posts: profile.loss_posts
      });
    } else {
      console.log("[PROFILE] No profile data available");
    }
  }, [isAuthenticated, user, authLoading, profileLoading, profile]);

  
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState(0);
  const [avatarUploadError, setAvatarUploadError] = useState(null);
  const [backgroundUploadError, setBackgroundUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const refreshInterval = useRef(null);
  const [localSelectedStrategy, setLocalSelectedStrategy] = useState(null);
  const [selectedStrategyForDetails, setSelectedStrategyForDetails] = useState(null);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [isCountryDialogOpen, setIsCountryDialogOpen] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [isSymbolDialogOpen, setIsSymbolDialogOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [selectedSymbolLabel, setSelectedSymbolLabel] = useState('');
  const [countryCounts, setCountryCounts] = useState(null);

  // Initialize data once when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    // Initialize profile store if not already done
    if (!isInitialized) {
      console.log('Initializing profile data');
      initializeData(user.id);
    } else {
      console.log('Profile data already initialized');
    }
    
    // Force an immediate refresh to get latest experience data - only if not recently refreshed
    const getLatestExperienceData = async () => {
      // Check if we've already forced a refresh recently
      // const { lastFetched } = useProfile.getState(); // Removed: Violates Rules of Hooks
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000; // 1 minute ago
      
      // Only refresh if no data or data is older than 1 minute
      if (!lastFetched || lastFetched < oneMinuteAgo) {
        console.log('Forcing refresh to get latest experience data');
        await refreshData(user.id);
      } else {
        console.log('Skipping initial refresh - data was recently fetched');
      }
    };
    
    getLatestExperienceData();
    
    // Update form data with profile details when they become available
    if (profile && !profileLoading) {
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
      });
      setAvatarUrl(contextAvatarUrl || '/default-avatar.svg');
      setBackgroundUrl(contextBackgroundUrl || '/profile-bg.jpg');
      
      // Debug profile data for username display
      console.log('[DEBUG] Profile username:', profile.username);
      console.log('[DEBUG] Profile data for display:', {
        username: profile.username,
        userId: profile.id,
        dataAvailable: !!profile
      });
    }
  }, [user?.id, isAuthenticated, isInitialized, lastFetched, refreshData, profile, profileLoading, contextAvatarUrl, contextBackgroundUrl]);

  // Set up background refresh interval with reduced frequency
  useEffect(() => {
    if (user && isAuthenticated) {
      // Don't refresh immediately if data is less than 5 minutes old
      // const { lastFetched, isRefreshing } = useProfile.getState(); // Removed: Violates Rules of Hooks
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000; // 5 minutes in milliseconds
      
      if (!lastFetched || lastFetched < fiveMinutesAgo) {
        // Only refresh if data is stale
        console.log('Initial background refresh - data is stale or not loaded yet');
        refreshData(user.id);
      } else {
        console.log('Skipping initial refresh - data is recent');
      }

      // Set up interval for background refresh (every 5 minutes instead of 2 minutes)
      refreshInterval.current = setInterval(() => {
        // Get the latest lastFetched value
        // const { lastFetched, isRefreshing } = useProfile.getState(); // Removed: Violates Rules of Hooks
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        
        // Only refresh if not already refreshing and data is older than 5 minutes
        if (!isRefreshing && (!lastFetched || lastFetched < fiveMinutesAgo)) {
          console.log('Background refresh triggered');
          refreshData(user.id);
        } else {
          console.log('Skipping background refresh - data is recent or refresh in progress');
        }
      }, 300000); // 5 minutes interval instead of 2 minutes
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [user?.id, isAuthenticated, lastFetched, isRefreshing, refreshData]); // Depend on lastFetched and isRefreshing directly from hook

  // Update form data when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  // Memoized handlers
  const handleTabChange = useCallback((tab) => {
    // If we're coming from strategies tab to posts tab,
    // and there's a selectedStrategyForDetails, use that as the strategy filter
    if (tab === 'posts' && activeTab === 'strategies' && selectedStrategyForDetails) {
      console.log(`Setting strategy filter to ${selectedStrategyForDetails} from strategy details`);
      handleStrategyChange({ target: { value: selectedStrategyForDetails } });
      setSelectedStrategyForDetails(null); // Clear after using
    }
    
    // Always update the active tab
    setActiveTab(tab);
    
    // If switching to a tab other than posts, we don't need to do anything with filters
    // as they'll only apply when we come back to the posts tab
  }, [activeTab, selectedStrategyForDetails]);

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
      full_name: profile?.full_name || '',
      bio: profile?.bio || '',
    });
  }, [profile]);

  // Add this function at the top level of the component
  const addCacheBuster = useCallback((url) => {
    if (!url || url.startsWith('/')) return url;
    const cacheBuster = `?t=${Date.now()}`;
    return url.includes('?') ? url : `${url}${cacheBuster}`;
  }, []);

  // Synchronize avatar and background URLs from context
  useEffect(() => {
    // Set avatar URL if available from context or default
    if (contextAvatarUrl) {
      setAvatarUrl(contextAvatarUrl);
    } else {
      setAvatarUrl('/default-avatar.svg'); // Fallback default
    }

    // Set background URL if available from context or default
    if (contextBackgroundUrl) {
      setBackgroundUrl(contextBackgroundUrl);
    } else {
      setBackgroundUrl('/profile-bg.jpg'); // Fallback default
    }
  }, [contextAvatarUrl, contextBackgroundUrl]); // Dependencies: only re-run when context URLs change

  // Clear upload errors when modal opens/closes
  useEffect(() => {
    if (showEditModal) {
      setAvatarUploadError(null);
      setBackgroundUploadError(null);
    }
  }, [showEditModal]);

  // Load country symbol counts for CountrySelectDialog (used to display counts next to countries)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const counts = await getCountrySymbolCounts();
        if (mounted) setCountryCounts(counts);
      } catch (e) {
        console.error('Error loading country symbol counts:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Add a useEffect to update the local state when the store's selectedStrategy changes
  useEffect(() => {
    // Update local state when store state changes
    setLocalSelectedStrategy(selectedStrategy);
  }, [selectedStrategy]);

  // Only show loading state during initial load
  if (authLoading || (profileLoading && !isInitialized)) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.notAuthenticated}>
        <h1>Not Authenticated</h1>
        <p>You need to be logged in to view and manage your profile</p>
        
        {/* Debuging info in development */}
        {process.env.NODE_ENV !== 'production' && (
          <div className={styles.debugInfo}>
            <h3>Debug Information</h3>
            <ul>
              <li>Authentication State: {String(isAuthenticated)}</li>
              <li>User Present: {String(!!user)}</li>
              <li>Auth Loading: {String(authLoading)}</li>
              <li>Profile Loading: {String(profileLoading)}</li>
              <li>Session Time: {new Date().toISOString()}</li>
            </ul>
          </div>
        )}
        
        <div className={styles.authButtons}>
          <Link href="/login" className={styles.loginButton}>
            Log In to Continue
          </Link>
          <button 
            onClick={() => window.location.reload()} 
            className={styles.reloadButton}
          >
            Refresh Page
          </button>
        </div>
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
      
      // Update global avatar cache for immediate display throughout the app
      const baseUrl = publicUrl.split('?')[0]; // Remove cache params
      
      // Update the image in global cache manager for immediate display in navigation bar
      if (typeof window !== 'undefined' && window.imageCacheManager) {
        window.imageCacheManager.setAvatarUrl(user.id, publicUrl);
        window.imageCacheManager.preload(publicUrl);
        console.log('Updated global image cache with new avatar');
      }
      
      // Update ProfileProvider context with new avatar URL
      if (updateProfile) {
        updateProfile({ avatarUrl: publicUrl });
        console.log('Updated ProfileProvider context with new avatar URL');
      }
      
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
      
      // Update global background cache for immediate display throughout the app
      if (typeof window !== 'undefined' && window.imageCacheManager) {
        // Use the new setBackgroundUrl method instead of just preloading
        window.imageCacheManager.setBackgroundUrl(user.id, refreshedUrl);
        console.log('Updated global image cache with new background');
      }
      
      // Update ProfileProvider context with new background URL
      if (updateProfile) {
        updateProfile({ backgroundUrl: refreshedUrl });
        console.log('Updated ProfileProvider context with new background URL');
      }
      
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


  // Update the onChange handler in the select element
  const handleStrategyChange = (e) => {
    const value = e.target.value;
    console.log(`[UI DEBUG] 🔍 Strategy selection changed to: "${value || 'All Strategies'}"`);
    
    const selectionTime = new Date().toISOString();
    console.log(`[UI DEBUG] ⏱️ Strategy selection time: ${selectionTime}`);
    
    if (value === '') {
      console.log('[UI DEBUG] 🧹 Clearing strategy filter');
      console.time('[UI DEBUG] ⏱️ Clear strategy filter operation');
      clearSelectedStrategy();
      setLocalSelectedStrategy(null); // Also update local state
    } else {
      console.log(`[UI DEBUG] 🔎 Setting strategy filter to: ${value}`);
      console.time('[UI DEBUG] ⏱️ Set strategy filter operation');
      setSelectedStrategy(value);
      setLocalSelectedStrategy(value); // Also update local state
    }
    
    // Monitor when loading state changes back to false (completed)
    const checkLoadingComplete = () => {
      if (!isLoading) {
        console.timeEnd(value === '' 
          ? '[UI DEBUG] ⏱️ Clear strategy filter operation' 
          : '[UI DEBUG] ⏱️ Set strategy filter operation');
        console.log(`[UI DEBUG] ✅ Strategy filter operation completed at ${new Date().toISOString()}`);
        return;
      }
      
      // Check again in 100ms
      setTimeout(checkLoadingComplete, 100);
    };
    
    // Start monitoring
    setTimeout(checkLoadingComplete, 100);
  };

  // We'll handle the dialog rendering directly in the JSX rather than using portals
  // This avoids the need for additional hooks that might cause issues

  // Get dialog state at the component level to avoid hooks in render functions
  const { isOpen, closeDialog } = useCreatePostForm();

  // Add a helper function to determine if a post matches a given status
  const matchesStatus = (post, statusFilter) => {
    if (!statusFilter) {
      return true; // No filter applied, so it matches
    }
    
    if (statusFilter === 'success') {
      return post.status === 'success' || post.target_reached === true;
    } 
    
    if (statusFilter === 'loss') {
      return post.status === 'loss' || post.stop_loss_triggered === true;
    }
    
    if (statusFilter === 'open') {
      // A post is "open" if:
      // 1. It has an explicit "open" status, OR
      // 2. It has no status AND hasn't reached target or triggered stop loss
      return post.status === 'open' || 
            (!post.status && !post.target_reached && !post.stop_loss_triggered);
    }
    
    return false; // Unknown status filter
  };

  // Add a helper function to get country from a post
  const getPostCountry = (post) => {
    // Try to get country directly from post
    if (post.country) {
      return post.country;
    }
    
    // Try to extract from symbol if available
    if (post.symbol) {
      const parts = post.symbol.split('.');
      if (parts.length > 1) {
        return parts[1];
      }
    }
    
    return null;
  };

  // Add a function to check if a post matches a country filter (normalize to 2-letter codes)
  const matchesCountry = (post, countryFilter) => {
    if (!countryFilter) {
      return true; // No filter applied, so it matches
    }

    const toCode = (val) => {
      if (!val) return null;
      const v = String(val).trim();
      if (v.length === 2) return v.toLowerCase();
      // Try to map country name to code (case-insensitive)
      const lower = v.toLowerCase();
      const entry = Object.entries(COUNTRY_CODE_TO_NAME).find(([, name]) =>
        String(name).toLowerCase() === lower
      );
      return entry ? entry[0] : lower;
    };

    const postCountry = getPostCountry(post);
    return toCode(postCountry) === toCode(countryFilter);
  };

  // Check if a post matches the selected symbol (normalize to base symbol without exchange suffix)
  const matchesSymbol = (post, symbolFilter) => {
    if (!symbolFilter) return true;
    const normalize = (s) => String(s || '').toUpperCase().split('.')[0];
    return normalize(post.symbol) === normalize(symbolFilter);
  };

  return (
    <div className={styles.profileContainer}>
      {isSaving && (
        <div className={editStyles.savingOverlay}>
          <div className={editStyles.savingProgress}>
            <div className={editStyles.savingBar}></div>
            <p>Saving changes...</p>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorToast}>
          {typeof error === 'object' ? (error.message || JSON.stringify(error)) : error}
          <button onClick={() => useProfile.getState().setError(null)}>×</button>
        </div>
      )}

      {/* Profile Header */}
      <div 
        className={styles.profileHeader}
        style={{ 
          backgroundImage: `url(${backgroundPreview || backgroundUrl || '/profile-bg.jpg'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          imageRendering: 'auto',
        }}
        key="profile-background" // Use stable key instead of dynamic timestamp
        aria-label="Profile background image"
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
                key="profile-avatar" // Use stable key instead of dynamic timestamp
                onError={(e) => {
                  console.error('Error loading profile avatar image');
                  e.target.onerror = null;
                  e.target.src = '/default-avatar.svg';
                }}
              />
            </div>
            
            {/* User info section */}
            <div className={styles.nameSection}>
              <h1 className={styles.profileName}>
                {profile?.username || (user?.id ? `user_${user.id.substring(0, 8)}` : 'Trader')}
              </h1>
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
          <span className={styles.tradingInfoLabel}>Experience Score:</span>
          <span className={`${styles.tradingInfoValue} ${(profile?.experience_score || 0) > 0 ? styles.positiveScore : (profile?.experience_score || 0) < 0 ? styles.negativeScore : ''}`}>
            {profile?.experience_score !== undefined ? profile.experience_score : 0}
          </span>
        </div>
        <div className={styles.tradingInfoItem}>
          <span className={styles.tradingInfoLabel}>Success Posts:</span>
          <span className={`${styles.tradingInfoValue} ${styles.positiveScore}`}>{profile?.success_posts || 0}</span>
        </div>
        <div className={styles.tradingInfoItem}>
          <span className={styles.tradingInfoLabel}>Loss Posts:</span>
          <span className={`${styles.tradingInfoValue} ${styles.negativeScore}`}>{profile?.loss_posts || 0}</span>
        </div>
      </div>

      {/* Profile Stats */}
      <div className={styles.profileStats}>
        <div className={styles.statItem} onClick={() => handleTabChange('posts')}>
          <span className={styles.statValue}>{posts.length}</span>
          <span className={styles.statLabel}>Posts</span>
        </div>
        <div className={styles.statItem} onClick={() => handleTabChange('followers')}>
          <span className={styles.statValue}>{followers.length}</span>
          <span className={styles.statLabel}>Followers</span>
        </div>
        <div className={styles.statItem} onClick={() => handleTabChange('following')}>
          <span className={styles.statValue}>{following.length}</span>
          <span className={styles.statLabel}>Following</span>
        </div>
      </div>
            {/* createPostContainer */}

      <div className={styles.emptyHomeContainer}>
        <div className={styles.createPostContainer}>
          <h1 className={styles.emptyHomeTitle}>Create a New Post</h1>
          <p className={styles.emptyHomeText}>Share your stock analysis with the community</p>
          <CreatePostButton inDialog={true} />
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
          className={`${styles.tabButton} ${activeTab === 'strategies' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('strategies')}
        >
          Strategies
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
            {/* زر التحقق من أسعار المنشورات */}
            <CheckPostPricesButton userId={user?.id} />
            
            <div className={styles.filterControls}>
              <div className={styles.filterItem}>
                <label htmlFor="strategyFilter" className={styles.filterLabel}>Strategy:</label>
                <div className={styles.filterSelectContainer}>
                  <select
                    id="strategyFilter"
                    className={`${styles.filterSelect} ${localSelectedStrategy ? styles.activeFilter : ''}`}
                    value={localSelectedStrategy || ''}
                    onChange={handleStrategyChange}
                    disabled={filterLoading}
                  >
                    <option value="">All Strategies</option>
                    {Array.from(new Set(posts.map(post => post.strategy).filter(Boolean))).map(strategy => (
                      <option key={strategy} value={strategy}>{strategy}</option>
                    ))}
                  </select>
                  
                  {localSelectedStrategy && !isLoading && (
                    <button 
                      className={styles.clearFilterButton}
                      onClick={() => {
                        handleStrategyChange({ target: { value: '' } });
                      }}
                      aria-label="Clear strategy filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              
              <div className={styles.filterItem}>
                <label htmlFor="statusFilter" className={styles.filterLabel}>Status:</label>
                <div className={styles.filterSelectContainer}>
                  <select
                    id="statusFilter"
                    className={`${styles.filterSelect} ${selectedStatus ? styles.activeFilter : ''}`}
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setFilterLoading(true);
                      
                      // Debug the selected value
                      console.log(`Status filter changed to: ${e.target.value}`);
                      
                      // Set a short timeout to simulate loading and give UI time to update
                      setTimeout(() => setFilterLoading(false), 300);
                    }}
                    disabled={filterLoading}
                  >
                    <option value="">All Status</option>
                    <option value="success">Success</option>
                    <option value="loss">Loss</option>
                    <option value="open">Open</option>
                  </select>
                  
                  {selectedStatus && !filterLoading && (
                    <button 
                      className={styles.clearFilterButton}
                      onClick={() => {
                        setSelectedStatus('');
                        setFilterLoading(true);
                        setTimeout(() => setFilterLoading(false), 300);
                      }}
                      aria-label="Clear status filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              
              <div className={styles.filterItem}>
                <label htmlFor="countryFilter" className={styles.filterLabel}>Country:</label>
                <div className={styles.filterSelectContainer}>
                  <button
                    id="countryFilter"
                    className={`${styles.filterSelect} ${selectedCountry ? styles.activeFilter : ''}`}
                    onClick={() => setIsCountryDialogOpen(true)}
                    disabled={filterLoading}
                    aria-haspopup="dialog"
                    aria-expanded={isCountryDialogOpen}
                    type="button"
                  >
                    {selectedCountry ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span className={`fi fi-${String(selectedCountry).toLowerCase()} country-flag`}></span>
                        {COUNTRY_CODE_TO_NAME[String(selectedCountry).toLowerCase()] || selectedCountry}
                      </span>
                    ) : 'All Countries'}
                  </button>

                  {selectedCountry && !filterLoading && (
                    <button 
                      className={styles.clearFilterButton}
                      onClick={() => {
                        setSelectedCountry('');
                        setFilterLoading(true);
                        setTimeout(() => setFilterLoading(false), 300);
                      }}
                      aria-label="Clear country filter"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <CountrySelectDialog
                  isOpen={isCountryDialogOpen}
                  onClose={() => setIsCountryDialogOpen(false)}
                  onSelectCountry={(code) => {
                    setSelectedCountry(code);
                    setIsCountryDialogOpen(false);
                    // Auto-open symbol search dialog after selecting a country
                    setIsSymbolDialogOpen(true);
                    setFilterLoading(true);
                    setTimeout(() => setFilterLoading(false), 300);
                  }}
                  selectedCountry={selectedCountry || 'all'}
                  countryCounts={countryCounts}
                />
              </div>

              <div className={styles.filterItem}>
                <label htmlFor="symbolFilter" className={styles.filterLabel}>Symbol:</label>
                <div className={styles.filterSelectContainer}>
                  <button
                    id="symbolFilter"
                    className={`${styles.filterSelect} ${selectedSymbol ? styles.activeFilter : ''}`}
                    onClick={() => setIsSymbolDialogOpen(true)}
                    disabled={filterLoading}
                    aria-haspopup="dialog"
                    aria-expanded={isSymbolDialogOpen}
                    type="button"
                  >
                    {selectedSymbolLabel || selectedSymbol || 'All Symbols'}
                  </button>

                  {selectedSymbol && !filterLoading && (
                    <button
                      className={styles.clearFilterButton}
                      onClick={() => {
                        setSelectedSymbol('');
                        setSelectedSymbolLabel('');
                        setFilterLoading(true);
                        setTimeout(() => setFilterLoading(false), 300);
                      }}
                      aria-label="Clear symbol filter"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <SymbolSearchDialog
                  isOpen={isSymbolDialogOpen}
                  onClose={() => setIsSymbolDialogOpen(false)}
                  onSelectStock={(stock) => {
                    const sym = stock?.Symbol || stock?.symbol || '';
                    const name = stock?.Name || stock?.name || '';
                    if (sym) {
                      setSelectedSymbol(sym);
                      setSelectedSymbolLabel(name ? `${sym} - ${name}` : sym);
                    }
                    setIsSymbolDialogOpen(false);
                    setFilterLoading(true);
                    setTimeout(() => setFilterLoading(false), 300);
                  }}
                  initialStockSearch=""
                  selectedCountry={selectedCountry || 'all'}
                />
              </div>
              
              {(localSelectedStrategy || selectedStatus || selectedCountry || selectedSymbol) && !filterLoading && (
                <button 
                  className={styles.clearAllFiltersButton}
                  onClick={() => {
                    // Clear all filters
                    handleStrategyChange({ target: { value: '' } });
                    setSelectedStatus('');
                    setSelectedCountry('');
                    setSelectedSymbol('');
                    setSelectedSymbolLabel('');
                    setFilterLoading(true);
                    
                    // If we're not on the posts tab, switch to it to show all posts
                    if (activeTab !== 'posts') {
                      setActiveTab('posts');
                    }
                    
                    setTimeout(() => setFilterLoading(false), 300);
                  }}
                  aria-label="Clear all filters"
                >
                  Clear All Filters
                </button>
              )}
              
              {filterLoading && (
                <div className={styles.filterLoading}>
                  <div className={styles.filterSpinner}></div>
                </div>
              )}
            </div>

            <div className={styles.postsGrid}>
              {isLoading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner} />
                  <p>Loading posts...</p>
                </div>
              ) : error ? (
                <div className={styles.errorMessage}>
                  <p>Error loading posts. Please try again later.</p>
                  <button 
                    className={styles.retryButton}
                    onClick={() => refreshData(user.id)}
                  >
                    Retry
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <div className={styles.emptyStateContainer}>
                  <div className={styles.emptyState}>
                    <h3>No posts yet</h3>
                    <p>Start sharing your stock analysis and predictions</p>
                    <CreatePostButton />
                  </div>
                </div>
              ) : (
                <>
                  {/* Display posts */}
                  {posts
                    .filter(post => {
                      // Strategy filter
                      const strategyMatch = !localSelectedStrategy || post.strategy === localSelectedStrategy;
                      
                      // Status filter - use the helper function
                      const statusMatch = matchesStatus(post, selectedStatus);
                      
                      // Country filter - use the helper function
                      const countryMatch = matchesCountry(post, selectedCountry);
                      
                      // Symbol filter - use the helper function
                      const symbolMatch = matchesSymbol(post, selectedSymbol);
                      
                      // All filters must match
                      return strategyMatch && statusMatch && countryMatch && symbolMatch;
                    })
                    .map(post => (
                      <ProfilePostCard key={post.id} post={post} />
                    ))}
                </>
              )}
            </div>
          </>
        )}
        
        {activeTab === 'followers' && (
          <div className={styles.usersGrid}>
            {followers.length > 0 ? (
              followers.map((follower) => (
                <div key={follower.follower_id} className={styles.userCard}>
                  <Link href={`/view-profile/${follower.profiles?.id || follower.follower_id}`} className={styles.userLink}>
                    <div className={styles.userCardInner}>
                      <div className={styles.userAvatarContainer}>
                        <img 
                          src={follower.profiles?.avatar_url || '/default-avatar.svg'} 
                          alt={follower.profiles?.username || 'User'} 
                          className={styles.userAvatar}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default-avatar.svg';
                          }}
                        />
                      </div>
                      <div className={styles.userInfo}>
                        <h3 className={styles.userName}>{follower.profiles?.username || 'User'}</h3>
                      </div>
                    </div>
                  </Link>
                </div>
              ))
            ) : (
              <div className={styles.emptyStateContainer}>
                <div className={styles.emptyState}>
                  <h3>No followers yet</h3>
                  <p>When people follow you, they'll appear here</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'following' && (
          <div className={styles.usersGrid}>
            {following.length > 0 ? (
              following.map((follow) => (
                <div key={follow.following_id} className={styles.userCard}>
                  <Link href={`/view-profile/${follow.profiles?.id || follow.following_id}`} className={styles.userLink}>
                    <div className={styles.userCardInner}>
                      <div className={styles.userAvatarContainer}>
                        <img 
                          src={follow.profiles?.avatar_url || '/default-avatar.svg'} 
                          alt={follow.profiles?.username || 'User'} 
                          className={styles.userAvatar}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default-avatar.svg';
                          }}
                        />
                      </div>
                      <div className={styles.userInfo}>
                        <h3 className={styles.userName}>{follow.profiles?.username || 'User'}</h3>
                      </div>
                    </div>
                  </Link>
                </div>
              ))
            ) : (
              <div className={styles.emptyStateContainer}>
                <div className={styles.emptyState}>
                  <h3>You're not following anyone yet</h3>
                  <p>When you follow people, they'll appear here</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'strategies' && (
          <div className={styles.strategiesContainer}>
            {isLoading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner} />
                <p>Loading strategies...</p>
              </div>
            ) : (
              <>
                {/* Get unique strategies from posts */}
                {(() => {
                  // Extract all strategies from posts and count their occurrences
                  const strategyCounts = posts.reduce((acc, post) => {
                    if (post.strategy) {
                      acc[post.strategy] = (acc[post.strategy] || 0) + 1;
                    }
                    return acc;
                  }, {});
                  
                  // Convert to array and sort by count (descending)
                  const sortedStrategies = Object.entries(strategyCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([strategy, count]) => ({ strategy, count }));
                  
                  if (sortedStrategies.length === 0) {
                    return (
                      <div className={styles.emptyStateContainer}>
                        <div className={styles.emptyState}>
                          <h3>No strategies used yet</h3>
                          <p>Create posts with trading strategies to see them here</p>
                          <CreatePostButton />
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className={styles.strategiesGrid}>
                      {sortedStrategies.map(({ strategy, count }) => (
                        <div key={strategy} className={styles.strategyCard}>
                          <div className={styles.strategyHeader}>
                            <h3 className={styles.strategyName}>{strategy}</h3>
                            <span className={styles.strategyCount}>{count} post{count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className={styles.strategyActions}>
                            <button 
                              className={styles.viewPostsButton}
                              onClick={() => {
                                // Set the strategy filter
                                handleStrategyChange({ target: { value: strategy } });
                                
                                // Switch to posts tab if not already there
                                if (activeTab !== 'posts') {
                                  setActiveTab('posts');
                                }
                                
                                // Reset other filters for a cleaner view
                                setSelectedStatus('');
                                setSelectedCountry('');
                              }}
                            >
                              View Posts
                            </button>
                            <button 
                              className={styles.detailsButton}
                              onClick={() => {
                                setSelectedStrategyForDetails(strategy);
                                setIsStrategyModalOpen(true);
                              }}
                            >
                              Show Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()} 
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Strategy Details Modal */}
      <StrategyDetailsModal
        strategy={selectedStrategyForDetails}
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        onSave={(strategy, description) => {
          console.log(`Updated documentation for strategy: ${strategy}`);
          // Refresh data to get updated strategy information
          refreshData(user?.id);
        }}
      />
      
      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className={editStyles.modalOverlay}>
          <div className={editStyles.modalContent}>
            <div className={editStyles.modalHeader}>
              <h2 className={editStyles.modalTitle}>Edit Profile</h2>
              <button className={editStyles.closeButton} onClick={handleCloseModal} disabled={isSaving}>×</button>
            </div>
            
            {saveError && (
              <div className={editStyles.errorMessage}>
                {typeof saveError === 'object' ? (saveError.message || JSON.stringify(saveError)) : saveError}
                <button 
                  onClick={() => setSaveError(null)} 
                  className={editStyles.dismissError}
                >
                  ×
                </button>
              </div>
            )}
            
            <form onSubmit={handleSaveProfile} className={editStyles.editForm}>
              <div className={editStyles.formGroup}>
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
              
              <div className={editStyles.formGroup}>
                <label htmlFor="full_name">Full Name</label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  placeholder="Enter your full name"
                />
              </div>
              
              <div className={editStyles.formGroup}>
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
              
              <div className={editStyles.formGroup}>
                <label>Profile Picture</label>
                <div className={editStyles.avatarUpload}>
                  <div className={editStyles.avatarPreviewContainer}>
                    {avatarUploadProgress > 0 && (
                      <div className={editStyles.imageLoadingOverlay}>
                        <div className={editStyles.uploadProgress}>
                          <div className={editStyles.progressBar} style={{width: `${avatarUploadProgress}%`}}></div>
                          <span>{Math.round(avatarUploadProgress)}%</span>
                        </div>
                      </div>
                    )}
                    <img
                      src={avatarPreview || avatarUrl || '/default-avatar.svg'}
                      alt={profile?.username || 'User'}
                      className={editStyles.avatarPreview}
                      key="profile-avatar"
                      onError={(e) => {
                        console.error('Error loading avatar image in dialog');
                        e.target.onerror = null;
                        e.target.src = '/default-avatar.svg';
                      }}
                    />
                  </div>
                  {avatarUploadError && (
                    <p className={editStyles.uploadError}>
                      {typeof avatarUploadError === 'object' ? (avatarUploadError.message || JSON.stringify(avatarUploadError)) : avatarUploadError}
                    </p>
                  )}
                  <button 
                    type="button" 
                    className={editStyles.changeAvatarButton}
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
              
              <div className={editStyles.formGroup}>
                <label>Background Image</label>
                <div 
                  className={editStyles.backgroundPreview}
                  style={{
                    backgroundImage: `url(${backgroundPreview || backgroundUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative'
                  }}
                  onClick={() => backgroundUploadProgress === 0 && !isSaving && document.getElementById('background-file-input').click()}
                >
                  {backgroundUploadProgress > 0 && (
                    <div className={editStyles.imageLoadingOverlay}>
                      <div className={editStyles.uploadProgress}>
                        <div className={editStyles.progressBar} style={{width: `${backgroundUploadProgress}%`}}></div>
                        <span>{Math.round(backgroundUploadProgress)}%</span>
                      </div>
                    </div>
                  )}
                  <div className={editStyles.backgroundOverlay}>
                    <span>{backgroundUploadProgress > 0 ? `Uploading (${Math.round(backgroundUploadProgress)}%)` : 'Change Background'}</span>
                  </div>
                </div>
                {backgroundUploadError && (
                  <div className={editStyles.errorContainer}>
                    <p className={editStyles.uploadError}>
                      {typeof backgroundUploadError === 'object' ? (backgroundUploadError.message || JSON.stringify(backgroundUploadError)) : backgroundUploadError}
                    </p>
                    <button 
                      type="button" 
                      className={editStyles.dismissError} 
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
                  className={editStyles.changeBackgroundButton}
                  onClick={() => document.getElementById('background-file-input').click()}
                  disabled={isSaving || backgroundUploadProgress > 0}
                >
                  {backgroundUploadProgress > 0 ? `Uploading (${Math.round(backgroundUploadProgress)}%)` : 'Change Background'}
                </button>
              </div>
              
              <div className={editStyles.formActions}>
                <button 
                  type="button" 
                  className={editStyles.cancelButton}
                  onClick={handleCloseModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={editStyles.saveButton}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Create Post Dialog - rendered directly in the component */}
      {isOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <div className="dialog-header">
              <h2>Create Post</h2>
              <button 
                className="dialog-close-button" 
                onClick={closeDialog}
                aria-label="Close dialog"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="dialog-body">
              <CreatePostForm />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
