"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';

import { 
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
  const { user } = useSupabase();
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastImageRefresh = useRef(Date.now());
  const imageCache = useRef(new Map()); // Local cache for image URLs

  useEffect(() => {
    if (user) {
      console.log('Fetching user profile data for user ID:', user.id);
      getUserProfile(user.id)
        .then((response) => {
          console.log('Profile response received:', response);
          if (response.data) {
            setProfile(response.data);
            console.log('Profile data set:', response.data);
          } else if (response.error) {
            setError(response.error);
            console.error('Error in profile response:', response.error);
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching profile data:', error);
          setError(error);
          setLoading(false);
        });
    } else {
      // Reset profile when user is not available
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      // Check if we have cached images first
      if (user?.id) {
        // Try to use the imageCacheManager for persistent caching
        if (typeof window !== 'undefined' && window.imageCacheManager) {
          const cachedAvatar = window.imageCacheManager.getAvatarUrl(user.id);
          if (cachedAvatar) {
            console.log('Using cached avatar from global cache manager');
            setAvatarUrl(cachedAvatar);
          }
        }
        
        // Local cache as fallback
        if (!avatarUrl && imageCache.current.has(`avatar_${user.id}`)) {
          const cached = imageCache.current.get(`avatar_${user.id}`);
          console.log('Using cached avatar from local cache');
          setAvatarUrl(cached);
        }
        
        if (!backgroundUrl && imageCache.current.has(`background_${user.id}`)) {
          const cached = imageCache.current.get(`background_${user.id}`);
          console.log('Using cached background from local cache');
          setBackgroundUrl(cached);
        }
      }
      
      // Only fetch new images if it's been more than 5 minutes since last fetch
      // or if we don't have urls yet
      const now = Date.now();
      const shouldRefresh = !avatarUrl || !backgroundUrl || now - lastImageRefresh.current > 300000; // 5 minutes
      
      if (shouldRefresh) {
        console.log('Refreshing profile images - time elapsed or first load');
        const fetchImages = async () => {
          try {
            if (user && profile) {
              // Get avatar image
              const avatar = await getAvatarImageUrl(user.id);
              // Store in both local and persistent cache
              imageCache.current.set(`avatar_${user.id}`, avatar);
              if (typeof window !== 'undefined' && window.imageCacheManager) {
                window.imageCacheManager.setAvatarUrl(user.id, avatar);
                window.imageCacheManager.preload(avatar);
              }
              
              // Get background image
              const background = await getBackgroundImageUrl(user.id);
              imageCache.current.set(`background_${user.id}`, background);
              if (typeof window !== 'undefined' && window.imageCacheManager) {
                window.imageCacheManager.preload(background);
              }
              
              // Set state
              setAvatarUrl(avatar);
              setBackgroundUrl(background);
              lastImageRefresh.current = now;
              console.log('Profile images refreshed from server');
            }
          } catch (error) {
            console.error('Error loading profile images:', error);
            // Fallback to defaults
            setAvatarUrl('/default-avatar.svg');
            setBackgroundUrl('/profile-bg.jpg');
          }
        };
        
        fetchImages();
      } else {
        console.log('Skipping image refresh - recently refreshed');
      }
    }
  }, [profile, user, avatarUrl, backgroundUrl]);

  const updateProfile = async (updates) => {
    setLoading(true);
    try {
      console.log('Updating profile with data:', updates);
      const { data, error } = await updateUserProfile(user.id, updates);
      
      if (error) {
        console.error('Error updating profile:', error);
        setError(error);
        return { success: false, error };
      }
      
      console.log('Profile updated successfully:', data);
      setProfile(data);
      
      // If avatar was updated, refresh it but maintain cached URLs
      if (updates.avatarUrl) {
        // Update in cache
        imageCache.current.set(`avatar_${user.id}`, updates.avatarUrl);
        if (typeof window !== 'undefined' && window.imageCacheManager) {
          window.imageCacheManager.setAvatarUrl(user.id, updates.avatarUrl);
          window.imageCacheManager.preload(updates.avatarUrl);
        }
        setAvatarUrl(updates.avatarUrl);
      }
      
      // If background was updated
      if (updates.backgroundUrl) {
        // Update in cache
        imageCache.current.set(`background_${user.id}`, updates.backgroundUrl);
        if (typeof window !== 'undefined' && window.imageCacheManager) {
          window.imageCacheManager.preload(updates.backgroundUrl);
        }
        setBackgroundUrl(updates.backgroundUrl);
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Exception in updateProfile:', error);
      setError(error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  const uploadProfileImage = async (image) => {
    setLoading(true);
    try {
      const url = await uploadImage(image);
      
      // Update in cache immediately to prevent flashing
      imageCache.current.set(`avatar_${user.id}`, url);
      if (typeof window !== 'undefined' && window.imageCacheManager) {
        window.imageCacheManager.setAvatarUrl(user.id, url);
        window.imageCacheManager.preload(url);
      }
      
      setAvatarUrl(url);
      return url;
    } catch (error) {
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveAvatarUrl = async () => {
    if (!user || !profile) return '/default-avatar.svg';
    
    // First try the imageCacheManager
    if (typeof window !== 'undefined' && window.imageCacheManager) {
      const cachedUrl = window.imageCacheManager.getAvatarUrl(user.id);
      if (cachedUrl) {
        return cachedUrl;
      }
    }
    
    // Then try our local cache
    if (imageCache.current.has(`avatar_${user.id}`)) {
      return imageCache.current.get(`avatar_${user.id}`);
    }
    
    // If not in cache, fetch from server
    try {
      const url = await getAvatarImageUrl(user.id);
      
      // Cache for future use
      if (url) {
        imageCache.current.set(`avatar_${user.id}`, url);
        if (typeof window !== 'undefined' && window.imageCacheManager) {
          window.imageCacheManager.setAvatarUrl(user.id, url);
        }
      }
      
      return url || '/default-avatar.svg';
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      return '/default-avatar.svg';
    }
  };

  return (
    <ProfileContext.Provider value={{
      profile,
      avatarUrl,
      backgroundUrl,
      loading,
      error,
      updateProfile,
      uploadProfileImage,
      getEffectiveAvatarUrl
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

// Custom hook to use the ProfileContext
export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}