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
          console.error('Error fetching profile data:', profileError);
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
          
          // Get avatar and background URLs with caching
          await Promise.all([
            getImageWithCaching('avatar', user.id),
            getImageWithCaching('background', user.id)
          ]);
          
          // Update profile in Supabase if needed
          const updatedFields = {};
          let needsUpdate = false;
          
          // If avatar_url is missing or different in the profile
          if (avatarUrl && avatarUrl !== '/default-avatar.svg' && profileData.avatar_url !== avatarUrl) {
            updatedFields.avatar_url = avatarUrl.includes('?') ? avatarUrl.split('?')[0] : avatarUrl; // Store without cache busting
            needsUpdate = true;
          }
          
          // If background_url is missing or different in the profile
          if (backgroundUrl && backgroundUrl !== '/profile-bg.jpg' && profileData.background_url !== backgroundUrl) {
            updatedFields.background_url = backgroundUrl.includes('?') ? backgroundUrl.split('?')[0] : backgroundUrl; // Store without cache busting
            needsUpdate = true;
          }
          
          // Update profile if needed
          if (needsUpdate) {
            try {
              await updateUserProfile(user.id, updatedFields);
              // Update local profile state with the updated fields
              setProfile(prev => ({ ...prev, ...updatedFields }));
            } catch (updateError) {
              console.error('Error updating profile with latest image URLs:', updateError);
            }
          }
        } else {
          // No profile found
          setProfile(null);
          setAvatarUrl('/default-avatar.svg');
          setBackgroundUrl('/profile-bg.jpg');
        }
      } catch (err) {
        console.error('Error in fetchProfileData:', err);
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
      console.log(`Using cached ${imageType} URL for user ${userId}:`, cachedUrl);
      
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
        // Add cache busting if needed
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const cacheBuster = `?t=${today}`;
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
      console.error(`Error fetching ${imageType} URL:`, error);
      
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
      console.error('Error updating profile:', err);
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
        console.error('Error refreshing profile:', error);
        setError(error);
        return null;
      }
      
      if (profileData) {
        // Update local state
        setProfile(profileData);
        
        // Clear cache for this user to force refresh
        imageCache.current.lastFetched.delete(`${user.id}-avatar`);
        imageCache.current.lastFetched.delete(`${user.id}-background`);
        
        // Refresh avatar and background URLs
        await Promise.all([
          getImageWithCaching('avatar', user.id),
          getImageWithCaching('background', user.id)
        ]);
        
        return profileData;
      }
      
      return null;
    } catch (err) {
      console.error('Error refreshing profile:', err);
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
    console.log('Image cache cleared');
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
