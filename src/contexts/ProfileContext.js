"use client";

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  supabase, 
  getUserProfile, 
  updateUserProfile, 
  uploadImage,
  getAvatarImageUrl,
  getBackgroundImageUrl
} from '@/utils/supabase';
import logger from '@/utils/logger';

// Create the context
const ProfileContext = createContext(null);

// Provider component
export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Create refs to store cached image data
  const imageCache = useRef({
    avatars: new Map(),
    backgrounds: new Map(),
    lastFetched: new Map()
  });
  
  // Cache timeout (in milliseconds) - 5 minutes
  const CACHE_TIMEOUT = 5 * 60 * 1000;

  // Fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) {
        setProfile(null);
        setAvatarUrl(null);
        setBackgroundUrl(null);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch profile data
        const { data: profileData, error: profileError } = await getUserProfile(user.id);
        
        if (profileError) {
          logger.error('Error fetching profile data:', profileError);
          setError(profileError);
          return;
        }
        
        if (profileData) {
          // Merge auth user data with profile data
          const mergedProfile = {
            ...profileData,
            email: profileData.email || user.email,
            full_name: profileData.full_name || user.user_metadata?.full_name
          };
          setProfile(mergedProfile);
          
          // Directly get avatar and background URLs from storage and update profile if needed
          try {
            logger.debug('Directly fetching avatar and background from storage after profile load');
            const avatarUrl = await getAvatarImageUrl(user.id);
            const backgroundUrl = await getBackgroundImageUrl(user.id);
            
            logger.debug('Setting avatar URL from storage:', avatarUrl);
            logger.debug('Setting background URL from storage:', backgroundUrl);
            
            setAvatarUrl(avatarUrl);
            setBackgroundUrl(backgroundUrl);
          } catch (imageError) {
            logger.error('Error fetching images from storage:', imageError);
            
            // Fall back to profile URLs if available
            if (profileData.avatar_url) {
              const cacheParam = `?t=${Date.now()}`;
              setAvatarUrl(`${profileData.avatar_url.split('?')[0]}${cacheParam}`);
            } else {
              setAvatarUrl('/default-avatar.svg');
            }
            
            if (profileData.background_url) {
              const cacheParam = `?t=${Date.now()}`;
              setBackgroundUrl(`${profileData.background_url.split('?')[0]}${cacheParam}`);
            } else {
              setBackgroundUrl('/profile-bg.jpg');
            }
          }
        } else {
          // No profile found
          setProfile(null);
          setAvatarUrl('/default-avatar.svg');
          setBackgroundUrl('/profile-bg.jpg');
        }
      } catch (err) {
        logger.error('Error in fetchProfileData:', err);
        setError(err);
        setAvatarUrl('/default-avatar.svg');
        setBackgroundUrl('/profile-bg.jpg');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfileData();
  }, [user]);

  /**
   * Get image URL with caching
   * @param {string} imageType - 'avatar' or 'background'
   * @param {string} userId - User ID
   * @param {boolean} updateState - Whether to update component state (default: true)
   * @returns {Promise<string>} - Image URL
   */
  const getImageWithCaching = async (imageType, userId, updateState = true) => {
    const cacheKey = `${userId}-${imageType}`;
    const now = Date.now();
    const lastFetched = imageCache.current.lastFetched.get(cacheKey) || 0;
    const cacheMap = imageType === 'avatar' ? imageCache.current.avatars : imageCache.current.backgrounds;
    const defaultUrl = imageType === 'avatar' ? '/default-avatar.svg' : '/profile-bg.jpg';
    
    // Check if we have a cached value that's not expired
    if (cacheMap.has(userId) && (now - lastFetched < CACHE_TIMEOUT)) {
      const cachedUrl = cacheMap.get(userId);
      logger.debug(`Using cached ${imageType} URL for user ${userId}:`, cachedUrl);
      
      // Only update state if explicitly requested (to avoid updates during render)
      if (updateState) {
        if (imageType === 'avatar') {
          setAvatarUrl(cachedUrl);
        } else {
          setBackgroundUrl(cachedUrl);
        }
      }
      
      return cachedUrl;
    }
    
    // If not in cache or expired, fetch from Supabase
    try {
      const fetchFunction = imageType === 'avatar' ? getAvatarImageUrl : getBackgroundImageUrl;
      const imageUrl = await fetchFunction(userId);
      
      if (imageUrl && imageUrl !== defaultUrl) {
        // Ensure the URL is valid
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
          logger.error(`Invalid ${imageType} URL format:`, imageUrl);
          
          // Update cache with default
          cacheMap.set(userId, defaultUrl);
          imageCache.current.lastFetched.set(cacheKey, now);
          
          if (updateState) {
            if (imageType === 'avatar') {
              setAvatarUrl(defaultUrl);
            } else {
              setBackgroundUrl(defaultUrl);
            }
          }
          
          return defaultUrl;
        }
        
        // Add cache busting if needed - use a fixed value instead of changing daily
        // This prevents image transitions when navigating between tabs
        const cacheBuster = `?fixedRef=1`;
        const urlWithCacheBusting = imageUrl.includes('?') 
          ? imageUrl 
          : `${imageUrl}${cacheBuster}`;
        
        // Update cache
        cacheMap.set(userId, urlWithCacheBusting);
        imageCache.current.lastFetched.set(cacheKey, now);
        
        // Only update state if explicitly requested
        if (updateState) {
          if (imageType === 'avatar') {
            setAvatarUrl(urlWithCacheBusting);
          } else {
            setBackgroundUrl(urlWithCacheBusting);
          }
        }
        
        return urlWithCacheBusting;
      } else {
        // Update cache with default
        cacheMap.set(userId, defaultUrl);
        imageCache.current.lastFetched.set(cacheKey, now);
        
        // Only update state if explicitly requested
        if (updateState) {
          if (imageType === 'avatar') {
            setAvatarUrl(defaultUrl);
          } else {
            setBackgroundUrl(defaultUrl);
          }
        }
        
        return defaultUrl;
      }
    } catch (error) {
      logger.error(`Error fetching ${imageType} URL:`, error);
      
      // Only update state if explicitly requested
      if (updateState) {
        if (imageType === 'avatar') {
          setAvatarUrl(defaultUrl);
        } else {
          setBackgroundUrl(defaultUrl);
        }
      }
      
      return defaultUrl;
    }
  };

  // Update profile function
  const updateProfile = async (data) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    try {
      setLoading(true);
      const { error } = await updateUserProfile(user.id, data);
      
      if (error) throw error;
      
      // Update local state
      setProfile(prev => ({ ...prev, ...data }));
      
      // If avatar_url or background_url was updated, update cache
      if (data.avatar_url) {
        imageCache.current.avatars.set(user.id, data.avatar_url);
        imageCache.current.lastFetched.set(`${user.id}-avatar`, Date.now());
        setAvatarUrl(data.avatar_url);
      }
      
      if (data.background_url) {
        imageCache.current.backgrounds.set(user.id, data.background_url);
        imageCache.current.lastFetched.set(`${user.id}-background`, Date.now());
        setBackgroundUrl(data.background_url);
      }
      
      return { success: true };
    } catch (err) {
      logger.error('Error updating profile:', err);
      setError(err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get the effective avatar URL for a user
   * @param {string} userId - User ID (defaults to current user)
   * @returns {Promise<string>} - Avatar URL
   */
  const getEffectiveAvatarUrl = async (userId = null) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return '/default-avatar.svg';
    
    // When called during rendering, don't update state
    return getImageWithCaching('avatar', targetUserId, false);
  };
  
  /**
   * Get the effective background URL for a user
   * @param {string} userId - User ID (defaults to current user)
   * @returns {Promise<string>} - Background URL
   */
  const getEffectiveBackgroundUrl = async (userId = null) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return '/profile-bg.jpg';
    
    // When called during rendering, don't update state
    return getImageWithCaching('background', targetUserId, false);
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data: profileData, error } = await getUserProfile(user.id);
      
      if (error) {
        logger.error('Error refreshing profile:', error);
        setError(error);
        return null;
      }
      
      if (profileData) {
        // Update local state
        setProfile(profileData);
        
        // Clear cache for avatar only to force refresh
        imageCache.current.lastFetched.delete(`${user.id}-avatar`);
        
        // Refresh avatar URL only, not background
        await getImageWithCaching('avatar', user.id);
        
        return profileData;
      }
      
      return null;
    } catch (err) {
      logger.error('Error refreshing profile:', err);
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Clear image cache for testing or troubleshooting
  const clearImageCache = () => {
    imageCache.current.avatars.clear();
    imageCache.current.backgrounds.clear();
    imageCache.current.lastFetched.clear();
    logger.debug('Image cache cleared');
  };

  const value = {
    profile,
    loading,
    error,
    avatarUrl,
    backgroundUrl,
    updateProfile,
    refreshProfile,
    getEffectiveAvatarUrl,
    getEffectiveBackgroundUrl,
    clearImageCache
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

// Custom hook to use the profile context
export function useProfile() {
  const context = useContext(ProfileContext);
  
  if (context === null) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  
  return context;
}
