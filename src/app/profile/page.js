'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
// No longer needed since we're using the ProfileProvider
// import useProfileStore from '@/store/profileStore';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from '@/styles/profile.module.css';
import editStyles from '@/styles/editProfile.module.css';
import { CreatePostButton } from '@/components/posts/CreatePostButton';
import CreatePostForm from '@/components/posts/CreatePostForm';
import { uploadImage } from '@/utils/supabase';
import { useCreatePostForm } from '@/providers/CreatePostFormProvider';
import { createPortal } from 'react-dom';
import { PostsFeed } from '@/components/home/PostsFeed';
import CheckPostPricesButton from '@/components/profile/CheckPostPricesButton';
import StrategyDetailsModal from '@/components/profile/StrategyDetailsModal';
import TelegramBotManagement from '@/components/telegram/TelegramBotManagement';
import { DashboardSection } from '@/components/home/DashboardSection';
import { useTheme } from '@/providers/theme-provider';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import { useBackgroundProfileEdit } from '@/providers/BackgroundProfileEditProvider';
// Background indicators removed - now handled by UnifiedBackgroundProcessDrawer
import SocialLinks from '@/components/profile/SocialLinks';
import logger from '@/utils/logger';

export default function Profile() {
  const { user, isAuthenticated, loading: authLoading } = useSupabase();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { 
    subscriptionInfo,
    loading: subscriptionLoading,
    syncing: subscriptionSyncing,
    canPerformPriceCheck,
    canCreatePost,
    getUsageInfo,
    isPro,
    getSubscriptionMessage,
    refreshSubscription
  } = useSubscription();
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
  
  // Get dialog state at the component level - MUST be before any conditions
  const { isOpen, closeDialog } = useCreatePostForm();
  const { submitProfileEdit, isProcessing } = useBackgroundProfileEdit();

  // Debug authentication on mount
  useEffect(() => {
    logger.debug("Authentication Status:", { 
      isAuthenticated, 
      user: !!user, 
      userId: user?.id,
      authLoading,
      profileLoading
    }, 'AUTH');
    
    // Debug subscription data
    logger.debug("Subscription Info:", subscriptionInfo, 'AUTH');
    logger.debug("Subscription Info Details:", {
      remaining_checks: subscriptionInfo?.remaining_checks,
      price_checks_used: subscriptionInfo?.price_checks_used,
      price_check_limit: subscriptionInfo?.price_check_limit,
      subscriptionLoading
    }, 'AUTH');
    
    // Debug the profile data
    logger.debug("Profile data:", profile, 'AUTH');
    if (profile) {
      logger.debug("Username from profile:", profile.username, 'AUTH');
      logger.debug("Profile data type:", typeof profile, 'AUTH');
      logger.debug("Profile keys:", Object.keys(profile), 'AUTH');
      logger.debug("Experience score from database:", {
        experience_score: profile.experience_score,
        success_posts: profile.success_posts,
        loss_posts: profile.loss_posts
      }, 'AUTH');
    } else {
      logger.debug("No profile data available", null, 'AUTH');
    }
  }, [isAuthenticated, user, authLoading, profileLoading, profile, subscriptionInfo, subscriptionLoading]);

  // Initialize active tab from query param (e.g., /profile?tab=telegram)
  useEffect(() => {
    try {
      const tab = searchParams?.get('tab');
      const allowed = ['posts', 'followers', 'following', 'strategies', 'telegram'];
      if (tab && allowed.includes(tab) && tab !== activeTab) {
        setActiveTab(tab);
      }
    } catch {}
    // We intentionally depend on searchParams so this reacts to URL changes
  }, [searchParams, activeTab, setActiveTab]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: '',
    facebook_url: '',
    telegram_url: '',
    youtube_url: '',
    show_facebook: false,
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
  const [avatarUploadError, setAvatarUploadError] = useState(null);
  const [backgroundUploadError, setBackgroundUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const refreshInterval = useRef(null);
  const [localSelectedStrategy, setLocalSelectedStrategy] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [discoveredCountries, setDiscoveredCountries] = useState([]);
  const [discoveredSymbols, setDiscoveredSymbols] = useState([]);
  const [selectedStrategyForDetails, setSelectedStrategyForDetails] = useState(null);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [filterLoading, setFilterLoading] = useState(false);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState(0);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'

  // Helper function to ensure all values are strings for controlled inputs
  const sanitizeFormData = useCallback((profile) => ({
    username: profile?.username || '',
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
    facebook_url: profile?.facebook_url || '',
    telegram_url: profile?.telegram_url || '',
    youtube_url: profile?.youtube_url || '',
    show_facebook: Boolean(profile?.show_facebook),
  }), []);

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
      setFormData(sanitizeFormData(profile));
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

  // Derive discovered countries and symbols from posts when posts update
  useEffect(() => {
    try {
      const postsList = Array.isArray(posts) ? posts : [];
      const countrySet = new Set();
      const symbolMap = new Map();

      postsList.forEach((p) => {
        const symbol = p?.symbol || '';
        const company = p?.company_name || '';
        // Country derivation consistent with PostCard logic
        let code = '';
        if (p?.country) {
          const v = String(p.country).trim();
          if (v.length === 2) code = v.toLowerCase();
          else {
            const entry = Object.entries(COUNTRY_CODE_TO_NAME).find(([, name]) => String(name).toLowerCase() === v.toLowerCase());
            if (entry) code = entry[0];
          }
        } else if (symbol && String(symbol).includes('.')) {
          const parts = String(symbol).split('.');
          if (parts.length > 1 && parts[1].length === 2) code = parts[1].toLowerCase();
        }
        if (code) countrySet.add(code);

        if (symbol) {
          const key = symbol;
          if (!symbolMap.has(key)) {
            symbolMap.set(key, {
              Symbol: symbol,
              Name: company,
              Exchange: p?.exchange || '',
              Country: code || (p?.country || ''),
              uniqueId: `${symbol}-${code || 'xx'}`
            });
          }
        }
      });

      setDiscoveredCountries(Array.from(countrySet));
      setDiscoveredSymbols(Array.from(symbolMap.values()));
    } catch (e) {
      console.error('Error deriving discovered filters:', e);
      setDiscoveredCountries([]);
      setDiscoveredSymbols([]);
    }
  }, [posts]);

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
      setFormData(sanitizeFormData(profile));
    }
  }, [profile, sanitizeFormData]);

  // Memoized handlers
  const handleTabChange = useCallback((tab) => {
    // Block access to subscription tab (removed)
    if (tab === 'subscription') {
      console.warn('Subscription tab has been removed from profile');
      return;
    }
    
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

  const handleCloseModal = useCallback(() => {
    setShowEditModal(false);
    setSaveError(null);
    setAvatarFile(null);
    setBackgroundFile(null);
    setAvatarPreview(null);
    setBackgroundPreview(null);
    setFormData(sanitizeFormData(profile));
  }, [profile, sanitizeFormData]);

  const handleEditProfile = useCallback(() => {
    setShowEditModal(true);
  }, []);

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

  // Removed CountrySelectDialog counts loader (dialog replaced by select)

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
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : (value === '' ? null : value) // Allow null for empty social media URLs
    }));
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
      console.error('[PROFILE UPLOAD] ❌ File must be an image');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarUploadError('File must be less than 2MB');
      console.error('[PROFILE UPLOAD] ❌ File must be less than 2MB');
      return;
    }
    
    setAvatarFile(file);
    
    // Create and set preview immediately for instant feedback
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    
    // Log file details for debugging
    console.log(`[PROFILE UPLOAD] 📁 Selected avatar: ${file.name}, ${file.type}, ${Math.round(file.size / 1024)}KB`);
    console.log(`[PROFILE UPLOAD] 🖼️ Avatar preview URL created: ${previewUrl.substring(0, 50)}...`);
  };

  const handleBackgroundChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Clear previous errors
    setBackgroundUploadError(null);
    
    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      setBackgroundUploadError('File must be an image');
      console.error('[PROFILE UPLOAD] ❌ Background file must be an image');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setBackgroundUploadError('File must be less than 2MB');
      console.error('[PROFILE UPLOAD] ❌ Background file must be less than 2MB');
      return;
    }
    
    setBackgroundFile(file);
    
    // Create and set preview immediately for instant feedback
    const previewUrl = URL.createObjectURL(file);
    setBackgroundPreview(previewUrl);
    
    // Log file details for debugging
    console.log(`[PROFILE UPLOAD] 📁 Selected background: ${file.name}, ${file.type}, ${Math.round(file.size / 1024)}KB`);
    console.log(`[PROFILE UPLOAD] 🎨 Background preview URL created: ${previewUrl.substring(0, 50)}...`);
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

  // Updated handleSaveProfile to use background processing like create post
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setAvatarUploadError(null);
    setBackgroundUploadError(null);
    
    try {
      // Submit to background processing
      const taskId = await submitProfileEdit(formData, avatarFile, backgroundFile);
      
      console.log(`[PROFILE EDIT] 🚀 Profile edit submitted to background processing: ${taskId}`);
      console.log(`[PROFILE EDIT] 📋 Form data:`, formData);
      
      if (avatarFile) {
        console.log(`[PROFILE EDIT] 📁 Avatar file: ${avatarFile.name} (${Math.round(avatarFile.size / 1024)}KB)`);
      }
      
      if (backgroundFile) {
        console.log(`[PROFILE EDIT] 🎨 Background file: ${backgroundFile.name} (${Math.round(backgroundFile.size / 1024)}KB)`);
      }
      
      // Close modal immediately - user can continue using the app
      setShowEditModal(false);
      
      // Reset form state
      setAvatarFile(null);
      setBackgroundFile(null);
      setAvatarPreview(null);
      setBackgroundPreview(null);
      
      // Show success message
      if (typeof window !== 'undefined') {
        console.log('✅ Profile edit submitted to background processing - check floating indicator for progress');
      }
      
    } catch (error) {
      console.error('Error submitting profile edit:', error);
      setSaveError(error.message || 'Failed to submit profile update. Please try again.');
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
          
          {/* Social Links */}
          <div className={styles.socialLinksContainer}>
            <SocialLinks profile={profile} size="normal" />
          </div>
        </div>
      </div>
      {/* Subscription Details moved to Background Process Drawer - access via floating button */}

      {/* Unified Dashboard Section */}
      <DashboardSection />

      {/* Profile Stats removed intentionally to declutter profile header */}
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
        <button 
          className={`${styles.tabButton} ${activeTab === 'telegram' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('telegram')}
        >
          Telegram Bot
        </button>
      </div>

      {/* Content Section */}
      <div className={styles.contentSection}>
        {activeTab === 'posts' && (
          <>
            {/* زر التحقق من أسعار المنشورات */}
            <CheckPostPricesButton userId={user?.id} />
            
            {/* View Mode Toggle */}
            <div className={styles.viewControls}>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewButton} ${viewMode === 'list' ? styles.activeView : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                  List
                </button>
                <button
                  className={`${styles.viewButton} ${viewMode === 'grid' ? styles.activeView : ''}`}
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  Grid
                </button>
              </div>
            </div>

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
                  <select
                    id="countryFilter"
                    className={`${styles.filterSelect} ${selectedCountry ? styles.activeFilter : ''}`}
                    value={selectedCountry}
                    onChange={(e) => {
                      setSelectedCountry(e.target.value);
                      setFilterLoading(true);
                      setTimeout(() => setFilterLoading(false), 300);
                    }}
                    disabled={filterLoading}
                  >
                    <option value="">All Countries</option>
                    {discoveredCountries
                      .slice()
                      .sort()
                      .map((code) => (
                        <option key={code} value={code}>
                          {COUNTRY_CODE_TO_NAME[String(code).toLowerCase()] || String(code).toUpperCase()}
                        </option>
                      ))}
                  </select>

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
              </div>

              <div className={styles.filterItem}>
                <label htmlFor="symbolFilter" className={styles.filterLabel}>Symbol:</label>
                <div className={styles.filterSelectContainer}>
                  <select
                    id="symbolFilter"
                    className={`${styles.filterSelect} ${selectedSymbol ? styles.activeFilter : ''}`}
                    value={selectedSymbol}
                    onChange={(e) => {
                      setSelectedSymbol(e.target.value);
                      setFilterLoading(true);
                      setTimeout(() => setFilterLoading(false), 300);
                    }}
                    disabled={filterLoading}
                  >
                    <option value="">All Symbols</option>
                    {discoveredSymbols
                      .filter((s) => !selectedCountry || String(s.Country || '').toLowerCase() === String(selectedCountry).toLowerCase())
                      .map((s) => {
                        const countryCode = s.Country ? s.Country.toLowerCase() : null;
                        // Simple flag emoji mapping for common countries
                        const flagEmoji = countryCode === 'us' ? '🇺🇸' :
                                        countryCode === 'gb' ? '🇬🇧' :
                                        countryCode === 'de' ? '🇩🇪' :
                                        countryCode === 'fr' ? '🇫🇷' :
                                        countryCode === 'jp' ? '🇯🇵' :
                                        countryCode === 'cn' ? '🇨🇳' :
                                        countryCode === 'ca' ? '🇨🇦' :
                                        countryCode === 'au' ? '🇦🇺' :
                                        countryCode === 'in' ? '🇮🇳' :
                                        countryCode === 'br' ? '🇧🇷' :
                                        countryCode === 'mx' ? '🇲🇽' :
                                        countryCode === 'kr' ? '🇰🇷' :
                                        countryCode === 'it' ? '🇮🇹' :
                                        countryCode === 'es' ? '🇪🇸' :
                                        countryCode === 'nl' ? '🇳🇱' :
                                        countryCode === 'ch' ? '🇨🇭' :
                                        countryCode === 'se' ? '🇸🇪' :
                                        countryCode === 'no' ? '🇳🇴' :
                                        countryCode === 'dk' ? '🇩🇰' :
                                        countryCode === 'fi' ? '🇫🇮' :
                                        '🌍'; // Default globe emoji
                        
                        return (
                          <option key={s.uniqueId || s.Symbol} value={s.Symbol}>
                            {`${s.Symbol} ${flagEmoji}`}
                          </option>
                        );
                      })}
                  </select>

                  {selectedSymbol && !filterLoading && (
                    <button
                      className={styles.clearFilterButton}
                      onClick={() => {
                        setSelectedSymbol('');
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

            <PostsFeed
              mode="profile"
              userId={profile?.id || user?.id}
              hideControls={true}
              showFlagBackground={true}
              hideUserInfo={true}
              selectedStrategy={localSelectedStrategy || ''}
              selectedStatus={selectedStatus}
              selectedCountry={selectedCountry}
              selectedSymbol={selectedSymbol}
              viewMode={viewMode}
            />
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

        {activeTab === 'telegram' && (
          <TelegramBotManagement />
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
        <div className={editStyles.modalOverlay} onClick={handleCloseModal}>
          <div className={editStyles.modalContent} onClick={(e) => e.stopPropagation()}>
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
                <label>Social Links</label>
                <div className={editStyles.socialLinksSection}>
                  <div className={editStyles.socialInput}>
                    <label htmlFor="facebook_url">Facebook URL</label>
                    <input
                      type="url"
                      id="facebook_url"
                      name="facebook_url"
                      value={formData.facebook_url}
                      onChange={handleInputChange}
                      disabled={isSaving}
                      placeholder="https://facebook.com/your-profile"
                    />
                  </div>
                  <div className={editStyles.socialInput}>
                    <label htmlFor="telegram_url">Telegram URL</label>
                    <input
                      type="url"
                      id="telegram_url"
                      name="telegram_url"
                      value={formData.telegram_url}
                      onChange={handleInputChange}
                      disabled={isSaving}
                      placeholder="https://t.me/your-channel"
                    />
                  </div>
                  <div className={editStyles.socialInput}>
                    <label htmlFor="youtube_url">YouTube URL</label>
                    <input
                      type="url"
                      id="youtube_url"
                      name="youtube_url"
                      value={formData.youtube_url}
                      onChange={handleInputChange}
                      disabled={isSaving}
                      placeholder="https://youtube.com/@your-channel"
                    />
                  </div>
                </div>
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
      
      {/* Background indicators removed - now handled by UnifiedBackgroundProcessDrawer */}
    </div>
  );
}