'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { useStrategies } from '@/providers/StrategiesProvider';
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
import FollowersDialog from '@/components/profile/FollowersDialog';
import logger from '@/utils/logger';
import SocialLinks from '@/components/profile/SocialLinks';
import { useBackgroundProfileEdit } from '@/providers/BackgroundProfileEditProvider';

export default function Profile() {
  const { supabase, user, isAuthenticated, isLoading: authLoading } = useSupabase();
  const { 
    profile, 
    posts, 
    followers, 
    following, 
    activeTab, 
    isLoading, 
    error, 
    isInitialized,
    setActiveTab, 
    refreshData,
    initializeData,
    lastFetched,
    isRefreshing,
    selectedStrategy,
    setSelectedStrategy,
    clearSelectedStrategy,
    updateProfile,
    avatarUrl: contextAvatarUrl,
    backgroundUrl: contextBackgroundUrl,
    getState,
    refreshPostsQuickly,
  } = useProfile();
  const { subscription, isLoading: subscriptionLoading } = useSubscription();
  const { strategies, createStrategy, deleteStrategy, fetchStrategies } = useStrategies();
  
  // Get dialog state at the component level - MUST be before any conditions
  const { isOpen, closeDialog } = useCreatePostForm();
  const { submitProfileEdit } = useBackgroundProfileEdit();
  // Read URL query params (e.g., ?tab=telegram)
  const searchParams = useSearchParams();

  // Debug authentication on mount
  useEffect(() => {
    logger.debug("Authentication Status:", { 
      isAuthenticated, 
      user: !!user, 
      userId: user?.id,
      authLoading,
      isLoading
    }, 'AUTH');
    
    // Debug subscription data
    logger.debug("Subscription Info:", subscription, 'AUTH');
    logger.debug("Subscription Info Details:", {
      // Price checks
      remaining_checks: subscription?.remaining_checks,
      price_checks_used: subscription?.price_checks_used,
      price_check_limit: subscription?.price_check_limit,
      // Post creation
      remaining_posts: subscription?.remaining_posts,
      posts_created: subscription?.posts_created,
      post_creation_limit: subscription?.post_creation_limit,
      // General
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
  }, [isAuthenticated, user, authLoading, isLoading, profile, subscription, subscriptionLoading]);

  // Initialize active tab from query param (e.g., /profile?tab=telegram)
  useEffect(() => {
    try {
      const tab = searchParams?.get('tab');
      const allowed = ['posts', 'strategies', 'telegram'];
      if (tab && allowed.includes(tab) && tab !== activeTab) {
        setActiveTab(tab);
      }
    } catch {}
    // We intentionally depend on searchParams so this reacts to URL changes
  }, [searchParams, activeTab, setActiveTab]);

  // Apply view mode from query param (?view=table|grid|list or ?vm=table)
  useEffect(() => {
    try {
      const v = (searchParams?.get('view') || searchParams?.get('vm') || '').toLowerCase();
      if (v === 'table' || v === 'grid' || v === 'list') {
        setViewMode(v);
      }
    } catch {}
  }, [searchParams]);

  // Guard: ensure activeTab is one of the allowed tabs
  useEffect(() => {
    const allowed = ['posts', 'strategies', 'telegram'];
    if (!allowed.includes(activeTab)) {
      setActiveTab('posts');
    }
  }, [activeTab, setActiveTab]);

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
  const [strategyModalPosts, setStrategyModalPosts] = useState([]);
  const [strategyModalLoading, setStrategyModalLoading] = useState(false);
  // Local overrides to reflect image updates instantly before provider refresh completes
  const [strategyImageOverrides, setStrategyImageOverrides] = useState({});
  
  // Add new strategy form states
  const [showCreateStrategyForm, setShowCreateStrategyForm] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [newStrategyDescription, setNewStrategyDescription] = useState('');
  const [newStrategyImage, setNewStrategyImage] = useState(null);
  const [newStrategyImagePreview, setNewStrategyImagePreview] = useState('');
  const [createStrategyError, setCreateStrategyError] = useState('');
  const [isCreatingStrategy, setIsCreatingStrategy] = useState(false);
  const [isDeletingStrategy, setIsDeletingStrategy] = useState({});
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [filterLoading, setFilterLoading] = useState(false);
  // Delete strategy dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [strategyToDelete, setStrategyToDelete] = useState(null);
  const [strategyPostsCount, setStrategyPostsCount] = useState(0);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState(0);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid' | 'list'
  const [mounted, setMounted] = useState(false);
  const [followersDialogOpen, setFollowersDialogOpen] = useState(false);
  const [followingDialogOpen, setFollowingDialogOpen] = useState(false);

  // View mode storage key
  const VIEW_MODE_STORAGE_KEY = "sharkszone-viewmode";

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

  // Initialize view mode from localStorage only after component is mounted
  useEffect(() => {
    setMounted(true);
    try {
      const storedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (storedViewMode && (storedViewMode === 'list' || storedViewMode === 'grid' || storedViewMode === 'table')) {
        setViewMode(storedViewMode);
      }
    } catch (error) {
      console.error("Error accessing localStorage for view mode:", error);
    }
  }, [VIEW_MODE_STORAGE_KEY]);

  // Save view mode to localStorage whenever it changes, but only after mounted
  useEffect(() => {
    if (!mounted) return;
    
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (error) {
      console.error("Error saving view mode to localStorage:", error);
    }
  }, [viewMode, mounted, VIEW_MODE_STORAGE_KEY]);

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
    if (profile && !isLoading) {
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
  }, [user?.id, isAuthenticated, isInitialized, lastFetched, refreshData, profile, isLoading, contextAvatarUrl, contextBackgroundUrl]);

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

    // Do not auto-apply strategy filters when switching tabs.
    // Only the "View Posts" button should set filters explicitly.
    setActiveTab(tab);
  }, [setActiveTab]);

  // Load related posts for the selected strategy to show stats & list in modal
  useEffect(() => {
    if (!isStrategyModalOpen || !selectedStrategyForDetails || !supabase || !user?.id) return;
    let canceled = false;
    setStrategyModalLoading(true);
    supabase
      .from('posts_with_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('strategy', selectedStrategyForDetails)
      .order('created_at', { ascending: false })
      .limit(25)
      .then(({ data, error }) => {
        if (canceled) return;
        if (error) {
          console.error('[PROFILE] Strategy posts fetch error:', error);
          setStrategyModalPosts([]);
          return;
        }
        setStrategyModalPosts(Array.isArray(data) ? data : []);
      })
      .finally(() => { if (!canceled) setStrategyModalLoading(false); });
    return () => { canceled = true; };
  }, [isStrategyModalOpen, selectedStrategyForDetails, supabase, user?.id]);

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
  if (authLoading || (isLoading && !isInitialized)) {
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
              <li>Profile Loading: {String(isLoading)}</li>
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

  // Handle strategy image upload
  const handleStrategyImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setCreateStrategyError('Please select a valid image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setCreateStrategyError('Image size must be less than 5MB');
      return;
    }
    
    setNewStrategyImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setNewStrategyImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Create new strategy handler
  const handleCreateNewStrategy = async (e) => {
    e.preventDefault();
    
    if (!newStrategyName.trim()) {
      setCreateStrategyError('Strategy name is required');
      return;
    }
    
    if (!newStrategyDescription.trim()) {
      setCreateStrategyError('Strategy description is required');
      return;
    }
    
    if (newStrategyName.trim().length < 3) {
      setCreateStrategyError('Strategy name must be at least 3 characters long');
      return;
    }
    
    if (newStrategyDescription.trim().length < 10) {
      setCreateStrategyError('Strategy description must be at least 10 characters long');
      return;
    }
    
    try {
      setIsCreatingStrategy(true);
      setCreateStrategyError('');
      
      let imageUrl = null;
      
      // Upload image if provided
      if (newStrategyImage) {
        try {
          console.log('[STRATEGY] Uploading strategy image...');
          
          // Generate stable filename for strategy (so new uploads replace the old)
          const fileExt = newStrategyImage.name.split('.').pop().toLowerCase();
          const safeStrategyName = newStrategyName.trim().replace(/\s+/g, '_');
          const fileName = `${user.id}/strategy_${safeStrategyName}.${fileExt}`;

          // Best-effort: remove any previous files for this strategy (different extensions or old timestamps)
          try {
            const { data: existingFiles } = await supabase.storage
              .from('strategy-images')
              .list(user.id);
            const toDelete = (existingFiles || [])
              .filter(f => f.name && f.name.startsWith(`strategy_${safeStrategyName}`))
              .map(f => `${user.id}/${f.name}`);
            if (toDelete.length > 0) {
              try { await supabase.storage.from('strategy-images').remove(toDelete); } catch {}
            }
          } catch {}

          // Upload strategy image to the dedicated bucket (stable path)
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('strategy-images')
            .upload(fileName, newStrategyImage, {
              cacheControl: '3600',
              upsert: true
            });
            
          if (uploadError) {
            console.error('Error uploading strategy image:', uploadError);
            setCreateStrategyError(`Failed to upload image: ${uploadError.message || 'Please try again.'}`);
            return;
          }
          
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('strategy-images')
            .getPublicUrl(fileName);
          
          if (!urlData?.publicUrl) {
            console.error('No public URL returned from image upload');
            setCreateStrategyError('Failed to get image URL. Please try again.');
            return;
          }
          
          imageUrl = urlData.publicUrl;
          console.log('[STRATEGY] Strategy image uploaded successfully:', imageUrl);
          
        } catch (uploadError) {
          console.error('Error uploading strategy image:', uploadError);
          setCreateStrategyError(`Upload failed: ${uploadError.message || 'Please try again.'}`);
          return;
        }
      }
      
      // Save strategy using provider
      const data = await createStrategy({
        strategy_name: newStrategyName.trim(),
        description: newStrategyDescription.trim(),
        image_url: imageUrl
      });
      
      console.log('Strategy created successfully:', data);
      // Ensure provider list is in sync
      if (fetchStrategies) {
        await fetchStrategies();
      }
      
      // Reset form
      setNewStrategyName('');
      setNewStrategyDescription('');
      setNewStrategyImage(null);
      setNewStrategyImagePreview('');
      setShowCreateStrategyForm(false);
      
      // Refresh posts to show the new strategy when used in posts
      if (refreshData) {
        refreshData(user?.id);
      }
      
    } catch (error) {
      console.error('Error creating strategy:', error);
      setCreateStrategyError('Failed to create strategy. Please try again.');
    } finally {
      setIsCreatingStrategy(false);
    }
  };

  // Open delete strategy dialog
  const handleDeleteStrategyClick = async (strategyName) => {
    try {
      // Immediate local count from current posts state (fallback in case DB count lags)
      const localCount = Array.isArray(posts)
        ? posts.filter(p => String(p.strategy || '') === String(strategyName)).length
        : 0;
      setStrategyPostsCount(localCount);

      // Also count posts using this strategy from DB to be precise
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user.id)
        .eq('strategy', strategyName);
      if (!postsError) {
        setStrategyPostsCount(postsData?.length || localCount);
      } else {
        console.error('Error counting strategy posts:', postsError);
      }
      
      setStrategyToDelete(strategyName);
      setShowDeleteDialog(true);
    } catch (error) {
      console.error('Error preparing delete dialog:', error);
      setStrategyPostsCount(0);
      setStrategyToDelete(strategyName);
      setShowDeleteDialog(true);
    }
  };

  // Confirm delete strategy
  const handleConfirmDeleteStrategy = async () => {
    if (!strategyToDelete) return;
    
    try {
      setIsDeletingStrategy(prev => ({ ...prev, [strategyToDelete]: true }));
      
      // If strategy has posts, move them to "BUY" strategy
      if (strategyPostsCount > 0) {
        console.log(`[STRATEGY] Moving ${strategyPostsCount} posts from "${strategyToDelete}" to "BUY" strategy`);
        
        const { error: updatePostsError } = await supabase
          .from('posts')
          .update({ strategy: 'BUY' })
          .eq('user_id', user.id)
          .eq('strategy', strategyToDelete);
          
        if (updatePostsError) {
          console.error('Error moving posts to BUY strategy:', updatePostsError);
          throw new Error('Failed to move posts to BUY strategy');
        }
        
        console.log('[STRATEGY] Posts moved to BUY strategy successfully');
      }
      
      // Get strategy details first to get image URL
      const { data: strategyData, error: fetchError } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('user_id', user.id)
        .eq('strategy_name', strategyToDelete)
        .single();
        
      if (fetchError) {
        console.error('Error fetching strategy for deletion:', fetchError);
        throw new Error('Failed to fetch strategy details');
      }
      
      // Delete from database using provider
      await deleteStrategy(strategyToDelete);
      // Refresh provider list after deletion
      if (fetchStrategies) {
        await fetchStrategies();
      }
      
      // Delete associated image if exists
      if (strategyData.image_url) {
        try {
          // Extract bucket and object path from public URL
          const urlObj = new URL(strategyData.image_url);
          const segments = urlObj.pathname.split('/');
          // Expected: /storage/v1/object/public/{bucket}/{userId}/filename
          const bucketName = segments[5];
          const objectPath = segments.slice(6).join('/');
          
          if (bucketName && objectPath) {
            console.log('[STRATEGY] Deleting strategy image:', { bucketName, objectPath });
            const { error: imageDeleteError } = await supabase.storage
              .from(bucketName)
              .remove([objectPath]);
            if (imageDeleteError) {
              console.error('Error deleting strategy image:', imageDeleteError);
            } else {
              console.log('[STRATEGY] Strategy image deleted successfully');
            }
          }
        } catch (imageError) {
          console.error('Error deleting strategy image:', imageError);
        }
      }
      
      console.log('[STRATEGY] Strategy deleted successfully:', strategyToDelete);
      
      // Close dialog
      setShowDeleteDialog(false);
      setStrategyToDelete(null);
      setStrategyPostsCount(0);
      
      // Refresh data
      if (refreshData) {
        refreshData(user?.id);
      }
      // Force a quick posts refresh to reflect new BUY strategies immediately
      if (refreshPostsQuickly) {
        refreshPostsQuickly(user?.id);
      }
      // If the deleted strategy is currently selected as a filter, switch to BUY so posts remain visible
      if (localSelectedStrategy && localSelectedStrategy === strategyToDelete) {
        handleStrategyChange({ target: { value: 'BUY' } });
      }
      
    } catch (error) {
      console.error('Error deleting strategy:', error);
      setCreateStrategyError(`Failed to delete strategy: ${error.message}`);
    } finally {
      setIsDeletingStrategy(prev => ({ ...prev, [strategyToDelete]: false }));
    }
  };

  // Cancel delete strategy
  const handleCancelDeleteStrategy = () => {
    setShowDeleteDialog(false);
    setStrategyToDelete(null);
    setStrategyPostsCount(0);
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
          <button onClick={() => getState && getState().setError(null)}>×</button>
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
          
          {/* Social Links with Follow Stats */}
          <div className={styles.socialLinksContainer}>
            <div className={styles.followStatsContainer}>
              <button 
                className={styles.followStat}
                onClick={() => setFollowersDialogOpen(true)}
              >
                <span className={styles.followNumber}>{followers?.length || 0}</span>
                <span className={styles.followLabel}>Followers</span>
              </button>
              <button 
                className={styles.followStat}
                onClick={() => setFollowingDialogOpen(true)}
              >
                <span className={styles.followNumber}>{following?.length || 0}</span>
                <span className={styles.followLabel}>Following</span>
              </button>
            </div>
            <div className={styles.socialLinksWrapper}>
              <SocialLinks profile={profile} size="normal" />
            </div>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
          Posts
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'strategies' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('strategies')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          Strategies
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'telegram' ? styles.activeTab : ''}`}
          onClick={() => handleTabChange('telegram')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <path d="M8 10h.01"></path>
            <path d="M12 10h.01"></path>
            <path d="M16 10h.01"></path>
          </svg>
          Telegram Bot
        </button>
      </div>

      {/* Content Section */}
      <div className={styles.contentSection}>
        {activeTab === 'posts' && (
          <>
            {/* زر التحقق من أسعار المنشورات */}
            <CheckPostPricesButton userId={user?.id} />
            
            {/* Filters and View Controls Container */}
            <div className={styles.filtersAndViewContainer}>
              {/* Filters Section */}
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
              
            </div>
            {/* Posts header with view toggle (same style as view-profile) */}
            <div className={styles.postsHeaderRow}>
              <h2>Recent Posts</h2>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewButton} ${viewMode === 'list' ? styles.viewButtonActive : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                  aria-label="List view"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                </button>
                <button
                  className={`${styles.viewButton} ${viewMode === 'grid' ? styles.viewButtonActive : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                  aria-label="Grid view"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </button>
                <button
                  className={`${styles.viewButton} ${viewMode === 'table' ? styles.viewButtonActive : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                  aria-label="Table view"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                  </svg>
                </button>
              </div>
            </div>

            <PostsFeed
              mode="profile"
              title=" "
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
        


        {activeTab === 'strategies' && (
          <div className={styles.strategiesContainer}>
            {isLoading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner} />
                <p>Loading strategies...</p>
              </div>
            ) : (
              <>
                {/* Create New Strategy Button */}
                <div className={styles.strategiesHeader}>
                  <h2>My Trading Strategies</h2>
                  <button 
                    className={styles.createStrategyButton}
                    onClick={() => setShowCreateStrategyForm(true)}
                    disabled={isCreatingStrategy}
                  >
                    {isCreatingStrategy ? 'Creating...' : '+ Create New Strategy'}
                  </button>
                </div>

                {/* Create Strategy Form */}
                {showCreateStrategyForm && (
                  <div className={styles.createStrategyForm}>
                    <div className={styles.formCard}>
                      <h3>Create New Trading Strategy</h3>
                      <form onSubmit={handleCreateNewStrategy}>
                        <div className={styles.formGroup}>
                          <label htmlFor="strategyName" className={styles.formLabel}>
                            Strategy Name <span className={styles.required}>*</span>
                          </label>
                          <input
                            type="text"
                            id="strategyName"
                            value={newStrategyName}
                            onChange={(e) => setNewStrategyName(e.target.value)}
                            placeholder="e.g., Day Trading, Swing Trading, Breakout Strategy"
                            className={styles.formInput}
                            maxLength={50}
                            required
                          />
                          <small className={styles.formHint}>
                            Minimum 3 characters, maximum 50 characters
                          </small>
                        </div>

                        <div className={styles.formGroup}>
                          <label htmlFor="strategyDescription" className={styles.formLabel}>
                            Strategy Description <span className={styles.required}>*</span>
                          </label>
                          <textarea
                            id="strategyDescription"
                            value={newStrategyDescription}
                            onChange={(e) => setNewStrategyDescription(e.target.value)}
                            placeholder="Describe your trading strategy, including entry/exit rules, risk management, and key indicators you use..."
                            className={styles.formTextarea}
                            rows={4}
                            maxLength={500}
                            required
                          />
                          <small className={styles.formHint}>
                            Minimum 10 characters, maximum 500 characters ({newStrategyDescription.length}/500)
                          </small>
                        </div>

                        <div className={styles.formGroup}>
                          <label htmlFor="strategyImage" className={styles.formLabel}>
                            Strategy Image (Optional)
                          </label>
                          <input
                            type="file"
                            id="strategyImage"
                            accept="image/*"
                            onChange={handleStrategyImageChange}
                            className={styles.formInput}
                          />
                          <small className={styles.formHint}>
                            Upload an image to represent your strategy (JPG, PNG, GIF - Max 5MB)
                          </small>
                          {newStrategyImagePreview && (
                            <div className={styles.imagePreview}>
                              <img src={newStrategyImagePreview} alt="Strategy preview" />
                            </div>
                          )}
                        </div>

                        {createStrategyError && (
                          <div className={styles.errorMessage}>
                            {createStrategyError}
                          </div>
                        )}

                        <div className={styles.formActions}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateStrategyForm(false);
                              setNewStrategyName('');
                              setNewStrategyDescription('');
                              setNewStrategyImage(null);
                              setNewStrategyImagePreview('');
                              setCreateStrategyError('');
                            }}
                            className={styles.cancelButton}
                            disabled={isCreatingStrategy}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={isCreatingStrategy || !newStrategyName.trim() || !newStrategyDescription.trim()}
                          >
                            {isCreatingStrategy ? 'Creating Strategy...' : 'Create Strategy'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Strategies list: merge provider strategies with post usage counts */}
                {(() => {
                  // 1) Count occurrences from posts
                  const strategyCounts = posts.reduce((acc, post) => {
                    const name = post?.strategy;
                    if (name) acc[name] = (acc[name] || 0) + 1;
                    return acc;
                  }, {});

                  // 2) Collect all strategy names from provider and posts
                  const providerNames = Array.isArray(strategies)
                    ? strategies.map(s => s.strategy_name).filter(Boolean)
                    : [];
                  const postNames = Object.keys(strategyCounts);
                  const allNamesSet = new Set([...providerNames, ...postNames]);

                  // 3) Build combined list with counts (0 default) and provider data
                  const combined = Array.from(allNamesSet).map(name => ({
                    strategy: name,
                    count: strategyCounts[name] || 0,
                    data: Array.isArray(strategies) ? strategies.find(s => s.strategy_name === name) : null,
                  }));

                  // 4) Sort by count desc then by name asc
                  const sortedCombined = combined.sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    return String(a.strategy).localeCompare(String(b.strategy));
                  });

                  if (sortedCombined.length === 0) {
                    return (
                      <div className={styles.emptyStateContainer}>
                        <div className={styles.emptyState}>
                          <h3>No strategies yet</h3>
                          <p>Create a strategy or add one while creating a post</p>
                          <CreatePostButton />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className={styles.strategiesGrid}>
                      {sortedCombined.map(({ strategy, count, data: strategyData }) => (
                        <div key={strategy} className={styles.strategyCard}>
                          {/* Strategy Image */}
                          {strategyData?.image_url && (
                            <div className={styles.strategyImageContainer}>
                              <img 
                                src={strategyData.image_url} 
                                alt={`${strategy} strategy`}
                                className={styles.strategyImage}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          )}

                          <div className={styles.strategyHeader}>
                            <h3 className={styles.strategyName}>{strategy}</h3>
                            <div className={styles.strategyHeaderActions}>
                              <span className={styles.strategyCount}>{count} post{count !== 1 ? 's' : ''}</span>
                              {strategyData && (
                                <button
                                  className={styles.deleteStrategyButton}
                                  onClick={() => handleDeleteStrategyClick(strategy)}
                                  disabled={isDeletingStrategy[strategy]}
                                  title="Delete Strategy"
                                >
                                  {isDeletingStrategy[strategy] ? '⏳' : '🗑️'}
                                </button>
                              )}
                            </div>
                          </div>

                          {strategyData?.description && (
                            <div className={styles.strategyDescription}>
                              <p>{strategyData.description}</p>
                            </div>
                          )}

                          <div className={styles.strategyActions}>
                            <button 
                              className={styles.viewPostsButton}
                              onClick={() => {
                                handleStrategyChange({ target: { value: strategy } });
                                if (activeTab !== 'posts') setActiveTab('posts');
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
        userId={user?.id}
        onSave={(strategy, description, meta) => {
          console.log(`Updated documentation for strategy: ${strategy}`);
          // If image updated/removed, optimistically reflect it in the modal children
          if (meta && Object.prototype.hasOwnProperty.call(meta, 'imageUrl')) {
            setStrategyImageOverrides(prev => ({
              ...prev,
              [strategy]: meta.imageUrl ? addCacheBuster(meta.imageUrl) : null,
            }));
          }
          // Refresh data to get updated strategy information
          if (refreshData) {
            refreshData(user?.id);
          }
          // Also refetch strategies to sync provider state
          if (fetchStrategies) {
            fetchStrategies();
          }
        }}
      >
        {(() => {
          // compute stats
          const total = strategyModalPosts.length || 0;
          const success = strategyModalPosts.filter(p => !!p?.target_reached).length;
          const loss = strategyModalPosts.filter(p => !!p?.stop_loss_triggered).length;
          const active = Math.max(0, total - success - loss);
          const pct = (n) => (total ? Math.round((n * 100) / total) : 0);
          const successPct = pct(success);
          const lossPct = pct(loss);
          const activePct = pct(active);
          const successRate = total ? Math.round((success / total) * 100) : 0;

          const strategyData = Array.isArray(strategies)
            ? strategies.find(s => s.strategy_name === selectedStrategyForDetails)
            : null;

          return (
            <>
              {/* Optional strategy image */}
              {(strategyImageOverrides?.[selectedStrategyForDetails] ?? strategyData?.image_url) && (
                <div className="smd-section" style={{ marginTop: 8 }}>
                  <img 
                    src={strategyImageOverrides?.[selectedStrategyForDetails] ?? strategyData.image_url}
                    alt={`${selectedStrategyForDetails} strategy`}
                    style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              )}

              <div className="smd-section">
                <h3 className="smd-sectionTitle">Results</h3>
                <div className="smd-metricsGrid">
                  <div className="smd-metricCard">
                    <div className="smd-metricLabel">Total Posts</div>
                    <div className="smd-metricValue">{total}</div>
                  </div>
                  <div className="smd-metricCard">
                    <div className="smd-metricLabel">Success</div>
                    <div className="smd-metricValue">{success} ({successPct}%)</div>
                  </div>
                  <div className="smd-metricCard">
                    <div className="smd-metricLabel">Loss</div>
                    <div className="smd-metricValue">{loss} ({lossPct}%)</div>
                  </div>
                  <div className="smd-metricCard">
                    <div className="smd-metricLabel">Active</div>
                    <div className="smd-metricValue">{active} ({activePct}%)</div>
                  </div>
                  <div className="smd-metricCard">
                    <div className="smd-metricLabel">Success Rate</div>
                    <div className="smd-metricValue">{successRate}%</div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="smd-stackedBar">
                    <div className="smd-segSuccess" style={{ width: `${successPct}%` }} />
                    <div className="smd-segLoss" style={{ width: `${lossPct}%` }} />
                    <div className="smd-segActive" style={{ width: `${activePct}%` }} />
                  </div>
                  <div className="smd-chips" style={{ marginTop: 8 }}>
                    <span className="smd-chip smd-chipSuccess">TargetReached: {success}</span>
                    <span className="smd-chip smd-chipLoss">Stop Loss: {loss}</span>
                    <span className="smd-chip smd-chipActive">Active: {active}</span>
                  </div>
                </div>
              </div>

              <div className="smd-section">
                <h3 className="smd-sectionTitle">Related Posts</h3>
                {strategyModalLoading ? (
                  <p>Loading posts...</p>
                ) : total === 0 ? (
                  <p>No posts found for this strategy.</p>
                ) : (
                  <div className="smd-postsList">
                    {strategyModalPosts.map((p) => {
                      const isSuccess = !!p?.target_reached;
                      const isLoss = !!p?.stop_loss_triggered;
                      return (
                        <div key={p.id} className="smd-postItem">
                          <div className="smd-postSymbol">{p.symbol || '-'}</div>
                          <div className="smd-postCompany">{p.company_name || ''}</div>
                          <div className="smd-postRight">
                            <span className={`smd-chip ${isSuccess ? 'smd-chipSuccess' : isLoss ? 'smd-chipLoss' : 'smd-chipActive'}`}>
                              {isSuccess ? 'Target' : isLoss ? 'Stop' : 'Active'}
                            </span>
                            <a href={`/posts/${p.id}`} className="smd-chip">Open</a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </StrategyDetailsModal>
      
      {/* Followers/Following Dialogs */}
      <FollowersDialog
        isOpen={followersDialogOpen}
        onClose={() => setFollowersDialogOpen(false)}
        followers={followers}
        following={following}
        type="followers"
        loading={isLoading}
      />
      
      <FollowersDialog
        isOpen={followingDialogOpen}
        onClose={() => setFollowingDialogOpen(false)}
        followers={followers}
        following={following}
        type="following"
        loading={isLoading}
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
      
      {/* Delete Strategy Confirmation Dialog (rendered via portal to avoid stacking issues) */}
      {showDeleteDialog && typeof document !== 'undefined' && createPortal(
        (
          <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-label="Delete Strategy Confirmation">
            <div className={styles.confirmDialog}>
              <h4>Delete Strategy "{strategyToDelete}"?</h4>
              {strategyPostsCount > 0 ? (
                <p>
                  This strategy is used in <strong>{strategyPostsCount}</strong> post{strategyPostsCount !== 1 ? 's' : ''}. 
                  These posts will be moved to the <strong>"BUY"</strong> strategy before deletion.
                </p>
              ) : (
                <p>
                  Are you sure you want to delete this strategy? This action cannot be undone.
                </p>
              )}
              <div className={styles.dialogActions}>
                <button 
                  className={styles.cancelDialogButton}
                  onClick={handleCancelDeleteStrategy}
                  disabled={isDeletingStrategy[strategyToDelete]}
                >
                  Cancel
                </button>
                <button 
                  className={styles.confirmButton}
                  onClick={handleConfirmDeleteStrategy}
                  disabled={isDeletingStrategy[strategyToDelete]}
                >
                  {isDeletingStrategy[strategyToDelete] ? 'Deleting...' : 'Delete Strategy'}
                </button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}

      {/* Background indicators removed - now handled by UnifiedBackgroundProcessDrawer */}
    </div>
  );
}