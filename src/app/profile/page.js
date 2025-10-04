'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useBackgroundProfileUpdate } from '@/providers/BackgroundProfileUpdateProvider';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from '@/styles/profile.module.css';
import editStyles from '@/styles/editProfile.module.css';
import { CreatePostButton } from '@/components/posts/CreatePostButton';
import CreatePostForm from '@/components/posts/CreatePostForm';
import { uploadImage } from '@/utils/supabase';
import { useCreatePostForm } from '@/providers/CreatePostFormProvider';
import { createPortal } from 'react-dom';
import '@/styles/create-post-page.css';
import { PostsFeed } from '@/components/home/PostsFeed';
import CheckPostPricesButton from '@/components/profile/CheckPostPricesButton';
import StrategyDetailsModal from '@/components/profile/StrategyDetailsModal';
import TelegramBotManagement from '@/components/telegram/TelegramBotManagement';
import { DashboardSection } from '@/components/home/DashboardSection';
import { useTheme } from '@/providers/theme-provider';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';

// FIXED: Removed setProfile error - using background profile update system
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
  
  // Background profile update system
  const { startBackgroundProfileUpdate, tasks } = useBackgroundProfileUpdate();
  
  // Check if there's an active profile update task
  const hasActiveProfileUpdate = tasks.some(task => 
    task.status !== 'success' && task.status !== 'error' && task.status !== 'canceled'
  );

  // Debug authentication on mount
  useEffect(() => {
    console.log("[PROFILE] Authentication Status:", { 
      isAuthenticated, 
      user: !!user, 
      userId: user?.id,
      authLoading,
      profileLoading
    });
    
    // Debug subscription data
    console.log("[PROFILE] Subscription Info:", subscriptionInfo);
    console.log("[PROFILE] Subscription Info Details:", {
      remaining_checks: subscriptionInfo?.remaining_checks,
      price_checks_used: subscriptionInfo?.price_checks_used,
      price_check_limit: subscriptionInfo?.price_check_limit,
      subscriptionLoading
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
  const [filterLoading, setFilterLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [discoveredCountries, setDiscoveredCountries] = useState([]);
  const [discoveredSymbols, setDiscoveredSymbols] = useState([]);

  // Initialize data once when authenticated - Fixed infinite loop
  const initializationRef = useRef(false);
  const lastProfileIdRef = useRef(null);
  
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    // Initialize profile store if not already done
    if (!isInitialized && !initializationRef.current) {
      console.log('Initializing profile data');
      initializeData(user.id);
      initializationRef.current = true;
    }
  }, [user?.id, isAuthenticated, isInitialized, initializeData]);

  // Separate effect for profile data updates to prevent loops
  useEffect(() => {
    if (!profile || profileLoading) return;
    
    // Only update form data if profile ID changed (new profile loaded)
    if (lastProfileIdRef.current !== profile.id) {
      console.log('Profile data loaded - updating form:', profile.username);
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        facebook_url: profile.facebook_url || '',
        telegram_url: profile.telegram_url || '',
        youtube_url: profile.youtube_url || '',
      });
      setAvatarUrl(contextAvatarUrl || '/default-avatar.svg');
      setBackgroundUrl(contextBackgroundUrl || '/profile-bg.jpg');
      lastProfileIdRef.current = profile.id;
    }
  }, [profile?.id, contextAvatarUrl, contextBackgroundUrl]);

  // Single refresh effect separated from form updates
  useEffect(() => {
    if (!isAuthenticated || !user || !profile?.id) return;
    
    const performRefreshIfNeeded = async () => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000; // 5 minutes ago
      
      // Force refresh if no social URLs in profile yet
      const needsSocialRefresh = !profile?.facebook_url && !profile?.telegram_url && !profile?.youtube_url;
      
      // Only refresh if data is older than 5 minutes or we need social URLs  
      if (!lastFetched || lastFetched < fiveMinutesAgo || needsSocialRefresh) {
        console.log('Refreshing profile data');
        await refreshData(user.id);
      }
    };
    
    performRefreshIfNeeded();
  }, [user?.id, isAuthenticated, profile?.id]); // Minimal dependencies

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

  // Background refresh is handled in the refresh effect above - removed duplicate interval

  // Form data is already updated in the profile data effect above - removed duplicate

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
      facebook_url: profile?.facebook_url || '',
      telegram_url: profile?.telegram_url || '',
      youtube_url: profile?.youtube_url || '',
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

  // Removed CountrySelectDialog counts loader (dialog replaced by select)

  // Add a useEffect to update the local state when the store's selectedStrategy changes
  useEffect(() => {
    // Update local state when store state changes
    setLocalSelectedStrategy(selectedStrategy);
  }, [selectedStrategy]);

  // Ref for dialog element
  const dialogRef = useRef(null);

  // Handle clicking outside the dialog to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        closeDialog();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDialog]);

  // Handle escape key to close dialog
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        closeDialog();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, closeDialog]);

  // Prevent body scrolling when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('dialog-open');
    } else {
      document.body.classList.remove('dialog-open');
    }
    
    return () => {
      document.body.classList.remove('dialog-open');
    };
  }, [isOpen]);

  // Profile Skeleton Loading Component
  const ProfileSkeleton = () => (
    <div className={styles.profileContainer}>
      {/* Profile Header Skeleton */}
      <div className={`${styles.profileHeader} ${styles.skeletonGradient}`}>
        <div className={styles.profileHeaderOverlay}>
          <div className={styles.profileInfo}>
            {/* Avatar Skeleton */}
            <div className={`${styles.profileAvatar} ${styles.skeletonCircle}`}></div>
            
            {/* User info skeleton */}
            <div className={styles.nameSection}>
              <div className={`${styles.skeletonText} ${styles.skeletonTitle}`}></div>
              <div className={`${styles.skeletonText} ${styles.skeletonSubtitle}`}></div>
              
              <div className={styles.profileButtons}>
                <div className={`${styles.skeletonButton}`}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Info Skeleton */}
      <div className={styles.subscriptionInfo}>
        <div className={styles.subscriptionCard}>
          <div className={styles.planHeader}>
            <div className={`${styles.skeletonText} ${styles.skeletonPlanBadge}`}></div>
          </div>
          <div className={styles.modernCard}>
            <div className={`${styles.skeletonText} ${styles.skeletonDetailsTitle}`}></div>
            <div className={styles.detailsGrid}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className={styles.detailsRow}>
                  <div className={`${styles.skeletonText} ${styles.skeletonLabel}`}></div>
                  <div className={`${styles.skeletonText} ${styles.skeletonValue}`}></div>
                </div>
              ))}
            </div>
            
            {/* Progress bars skeleton */}
            {[...Array(2)].map((_, i) => (
              <div key={i} className={styles.progressBlock}>
                <div className={styles.progressHeader}>
                  <div className={`${styles.skeletonText} ${styles.skeletonProgressLabel}`}></div>
                  <div className={`${styles.skeletonText} ${styles.skeletonProgressCount}`}></div>
                </div>
                <div className={styles.progressTrack}>
                  <div className={`${styles.progressFill} ${styles.skeletonGradient}`} style={{ width: '60%' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dashboard Section Skeleton */}
      <div style={{ margin: '2rem 0' }}>
        <div className={`${styles.skeletonText} ${styles.skeletonSectionTitle}`}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ 
              padding: '1rem', 
              borderRadius: '8px', 
              border: '1px solid hsl(var(--border))', 
              backgroundColor: 'hsl(var(--background))' 
            }}>
              <div className={`${styles.skeletonText} ${styles.skeletonCardTitle}`}></div>
              <div className={`${styles.skeletonText} ${styles.skeletonCardValue}`}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Post Section Skeleton */}
      <div className={styles.emptyHomeContainer}>
        <div className={styles.createPostContainer}>
          <div className={`${styles.skeletonText} ${styles.skeletonTitle}`}></div>
          <div className={`${styles.skeletonText} ${styles.skeletonSubtitle}`}></div>
          <div className={`${styles.skeletonButton}`}></div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className={styles.contentTabs}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`${styles.skeletonButton} ${styles.skeletonTab}`}></div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div style={{ marginTop: '2rem' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ 
            padding: '1rem', 
            marginBottom: '1rem',
            borderRadius: '8px', 
            border: '1px solid hsl(var(--border))', 
            backgroundColor: 'hsl(var(--background))' 
          }}>
            <div className={`${styles.skeletonText} ${styles.skeletonTitle}`}></div>
            <div className={`${styles.skeletonText} ${styles.skeletonSubtitle}`}></div>
            <div className={`${styles.skeletonText} ${styles.skeletonBio}`}></div>
          </div>
        ))}
      </div>
    </div>
  );

  // Progressive Loading Logic
  const showSkeleton = authLoading || (profileLoading && !isInitialized && !profile);
  const showOptimisticData = profile && (isLoading || subscriptionLoading);
  
  // Show skeleton during initial load
  if (showSkeleton) {
    return <ProfileSkeleton />;
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
      [name]: type === 'checkbox' ? checked : value 
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

  // NEW: Background Profile Update Handler (using modern background processing)
  const handleSaveProfileBackground = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setAvatarUploadError(null);
    setBackgroundUploadError(null);
    
    // OPTIMISTIC UPDATE: Update profile immediately for real-time UI
    if (updateProfile && formData) {
      console.log('🔄 Applying optimistic updates...');
      updateProfile({
        username: formData.username,
        full_name: formData.full_name,
        bio: formData.bio,
        facebook_url: formData.facebook_url,
        telegram_url: formData.telegram_url,
        youtube_url: formData.youtube_url,
      });
    }
    
    // Close modal immediately for better UX
    setShowEditModal(false);
    
    // Clear preview files
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
    if (backgroundPreview) {
      URL.revokeObjectURL(backgroundPreview);
      setBackgroundPreview(null);
    }
    
    console.log('🚀 Starting background profile update...');
    
    // Start background profile update
    const taskId = startBackgroundProfileUpdate({
      profileData: formData,
      avatarFile: avatarFile,
      backgroundFile: backgroundFile,
      title: "Updating Profile",
      onSuccess: () => {
        console.log('✅ Profile updated successfully in background!');
        // Reset file states
        setAvatarFile(null);
        setBackgroundFile(null);
        // Don't reset form data to prevent loops - the profile provider will handle updates
      },
      onError: (error) => {
        console.error('❌ Profile update failed:', error);
        setSaveError(error);
        // Profile provider will revert changes automatically - no manual revert needed
      }
    });
    
    console.log(`📋 Background profile update task started with ID: ${taskId}`);
  };

  // Update handleSaveProfile to handle image changes directly and display errors clearly
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setAvatarUploadError(null);
    setBackgroundUploadError(null);
    
    // Close modal immediately and show optimistic UI
    setShowEditModal(false);
    // Show background saving indicator
    setIsSaving(true);
    setIsUploading(true);
    
    // Optimistically update profile data in UI using ProfileProvider
    if (profile && updateProfile) {
      updateProfile({ ...formData });
      console.log('Optimistically updated profile data in UI using ProfileProvider');
    }
    
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
      
      console.log('Profile updated successfully in background');
      
      // Show success notification
      if (typeof window !== 'undefined') {
        // You can implement a toast notification here
        console.log('✅ Profile updated successfully!');
      }
      
    } catch (error) {
      console.error('Error in handleSaveProfile:', error);
      
      // Revert optimistic update if failed
      if (profile) {
        await refreshData(user.id);
      }
      
      setSaveError(error.message || 'An unexpected error occurred. Please try again.');
      
      // Show error notification
      if (typeof window !== 'undefined') {
        console.error('❌ Failed to update profile:', error.message);
      }
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
          
          {/* Social Icons */}
          {(profile?.facebook_url || profile?.telegram_url || profile?.youtube_url) && (
            <div className={styles.socialIcons}>
              {profile?.facebook_url && (
                <a 
                  href={profile.facebook_url} 
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
              {profile?.telegram_url && (
                <a 
                  href={profile.telegram_url} 
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
              {profile?.youtube_url && (
                <a 
                  href={profile.youtube_url} 
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
      </div>
      {/* Subscription Info Section */}
      <div className={styles.subscriptionInfo}>
        <div className={styles.subscriptionCard}>
          <div className={styles.planHeader}>
            <span className={styles.planBadge} data-plan={subscriptionInfo?.plan_name || 'free'}>
              {isPro ? '⭐ Pro' : '🆓 Free'} Plan
            </span>
            {subscriptionInfo?.subscription_status === 'active' && (
              <span className={styles.statusBadge}>Active</span>
            )}
          </div>
          
          {subscriptionLoading && !subscriptionInfo ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner} />
              <p>Loading subscription info...</p>
            </div>
          ) : subscriptionLoading && subscriptionInfo ? (
            <div className={styles.syncingIndicator}>
              <div className={styles.syncingSpinner} />
              <span>Updating...</span>
            </div>
          ) : null}
          
          {!isPro && (
            <div className={styles.upgradePrompt}>
              <p>Upgrade to Pro for more features!</p>
              <Link href="/pricing" className={styles.upgradeButton}>
                Upgrade to Pro 🚀
              </Link>
            </div>
          )}
          
          {isPro && subscriptionInfo?.end_date && (
            <div className={styles.billingInfo}>
              <span>Next billing: {new Date(subscriptionInfo.end_date).toLocaleDateString()}</span>
            </div>
          )}
          
          {/* Modern Subscription Details */}
          {subscriptionInfo && !subscriptionLoading && (
            <div className={styles.modernCard} style={{ position: 'relative' }}>
              {subscriptionSyncing && (
                <div className={styles.syncingBadge}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: 'currentColor',
                    animation: 'pulse 1.5s ease-in-out infinite' 
                  }} />
                  Syncing...
                </div>
              )}
              <h4 className={styles.detailsTitle}>
                Subscription Details
              </h4>
              <div className={styles.detailsGrid}>
                {subscriptionInfo.plan_id && (
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>Plan ID</span>
                    <span className={`${styles.detailsValue} ${styles.mono}`}>
                      {subscriptionInfo.plan_id}
                    </span>
                  </div>
                )}
                
                {subscriptionInfo.user_id && (
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>User ID</span>
                    <span className={`${styles.detailsValue} ${styles.mono}`}>
                      {subscriptionInfo.user_id}
                    </span>
                  </div>
                )}
                
                <div className={styles.detailsRow}>
                  <span className={styles.detailsLabel}>Plan Name</span>
                  <span className={styles.detailsValue} style={{ color: isPro ? '#0f9d58' : undefined, textTransform: 'capitalize' }}>
                    {subscriptionInfo.plan_display_name || subscriptionInfo.plan_name || 'Free'}
                  </span>
                </div>
                
                <div className={styles.detailsRow}>
                  <span className={styles.detailsLabel}>Status</span>
                  <span className={`${styles.detailsValue} ${subscriptionInfo.subscription_status === 'active' ? styles.statusActive : styles.statusInactive}`} style={{ textTransform: 'capitalize' }}>
                    {subscriptionInfo.subscription_status || 'Active'}
                  </span>
                </div>
                
                {subscriptionInfo.start_date && (
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>Start Date</span>
                    <span className={styles.detailsValue}>
                      {new Date(subscriptionInfo.start_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short', 
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                
                {subscriptionInfo.end_date && (
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>End Date</span>
                    <span className={styles.detailsValue}>
                      {new Date(subscriptionInfo.end_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short', 
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}

                {/* Price Checks Progress Bar */}
                <div className={styles.progressBlock}>
                  <div className={styles.progressHeader}>
                    <span className={styles.progressLabel}>📊 Price Checks</span>
                    <span className={styles.progressCount} style={{ color: (subscriptionInfo.price_checks_used || 0) >= (subscriptionInfo.price_check_limit || 50) ? '#dc2626' : undefined }}>
                      {subscriptionInfo.price_checks_used || 0} / {subscriptionInfo.price_check_limit || 50}
                    </span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div
                      className={`${styles.progressFill} ${ (subscriptionInfo.price_checks_used || 0) >= (subscriptionInfo.price_check_limit || 50) ? styles.fillRed : (isPro ? styles.fillGreen : styles.fillBlue) }`}
                      style={{ width: `${((subscriptionInfo.price_checks_used || 0) / (subscriptionInfo.price_check_limit || 50)) * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* Posts Progress Bar */}
                <div className={styles.progressBlock}>
                  <div className={styles.progressHeader}>
                    <span className={styles.progressLabel}>📝 Posts Created</span>
                    <span className={styles.progressCount}>
                      {subscriptionInfo.posts_created || 0} / {subscriptionInfo.post_creation_limit || 100}
                    </span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div
                      className={`${styles.progressFill} ${ isPro ? styles.fillGreen : styles.fillBlue }`}
                      style={{ width: `${((subscriptionInfo.posts_created || 0) / (subscriptionInfo.post_creation_limit || 100)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
            {/* Check Post Prices Button */}
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
                      .map((s) => (
                        <option key={s.uniqueId || s.Symbol} value={s.Symbol}>
                          {`${s.Symbol} ${s.Name ? `— ${s.Name}` : ''}`}
                        </option>
                      ))}
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

            <div className={styles.postsGrid}>
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
              />
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
      
      {/* Create Post Dialog - rendered directly in the component */}
      {isOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content" ref={dialogRef}>
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

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className={editStyles.modalOverlay}>
          <div className={editStyles.modalContent}>
            <div className={editStyles.modalHeader}>
              <h2 className={editStyles.modalTitle}>Edit Profile</h2>
              <button className={editStyles.closeButton} onClick={handleCloseModal} disabled={hasActiveProfileUpdate}>×</button>
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
            
            <form onSubmit={handleSaveProfileBackground} className={editStyles.editForm}>
              <div className={editStyles.formGroup}>
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  disabled={hasActiveProfileUpdate}
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
                  disabled={hasActiveProfileUpdate}
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
                  disabled={hasActiveProfileUpdate}
                  placeholder="Tell us about yourself"
                />
              </div>
              
              <div className={editStyles.formGroup}>
                <label htmlFor="facebook_url">Facebook URL</label>
                <input
                  type="url"
                  id="facebook_url"
                  name="facebook_url"
                  value={formData.facebook_url}
                  onChange={handleInputChange}
                  disabled={hasActiveProfileUpdate}
                  placeholder="https://facebook.com/your-profile"
                />
                <small style={{color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block'}}>
                  Add your Facebook profile link to display it on your profile page
                </small>
              </div>
              
              <div className={editStyles.formGroup}>
                <label htmlFor="telegram_url">Telegram URL</label>
                <input
                  type="url"
                  id="telegram_url"
                  name="telegram_url"
                  value={formData.telegram_url}
                  onChange={handleInputChange}
                  disabled={hasActiveProfileUpdate}
                  placeholder="https://t.me/your-channel"
                />
                <small style={{color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block'}}>
                  Add your Telegram channel/profile link to display it on your profile page
                </small>
              </div>
              
              <div className={editStyles.formGroup}>
                <label htmlFor="youtube_url">YouTube URL</label>
                <input
                  type="url"
                  id="youtube_url"
                  name="youtube_url"
                  value={formData.youtube_url}
                  onChange={handleInputChange}
                  disabled={hasActiveProfileUpdate}
                  placeholder="https://youtube.com/@your-channel"
                />
                <small style={{color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block'}}>
                  Add your YouTube channel link to display it on your profile page
                </small>
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
                    disabled={hasActiveProfileUpdate}
                  >
                    Change Avatar
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={hasActiveProfileUpdate}
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
                  onClick={() => !hasActiveProfileUpdate && document.getElementById('background-file-input').click()}
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
                  disabled={hasActiveProfileUpdate}
                />
                <button 
                  type="button" 
                  className={editStyles.changeBackgroundButton}
                  onClick={() => document.getElementById('background-file-input').click()}
                  disabled={hasActiveProfileUpdate}
                >
                  Change Background
                </button>
              </div>
              
              {/* Form Actions */}
              <div className={editStyles.formActions}>
                <button 
                  type="button" 
                  className={editStyles.cancelButton}
                  onClick={handleCloseModal}
                  disabled={hasActiveProfileUpdate}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={editStyles.saveButton}
                  disabled={hasActiveProfileUpdate || isSaving}
                >
                  {hasActiveProfileUpdate || isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}