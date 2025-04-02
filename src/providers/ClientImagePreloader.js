'use client';

import { useEffect, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';

/**
 * Client component that preloads user images to ensure they're properly cached
 * This component doesn't render anything visible
 */
const ClientImagePreloader = () => {
  const { user } = useProfile();
  const { supabase } = useSupabase();
  const failedUrlsRef = useRef(new Set());
  const loadedImagesRef = useRef(new Set());

  useEffect(() => {
    if (!user) return;

    // First, ensure default images are loaded
    const preloadDefaultImages = async () => {
      try {
        // Default images with absolute paths
        const defaultImages = [
          '/default-avatar.svg',
          '/profile-bg.jpg',
          '/logo.png',
        ];
        
        // Use the cache manager if available, otherwise fallback
        if (window.imageCacheManager) {
          window.imageCacheManager.preload(defaultImages);
        } else {
          // Fallback to manual preloading
          await Promise.all(defaultImages.map(src => preloadImage(src, true)));
        }
        
        console.log('Default images preloaded successfully');
      } catch (error) {
        console.error('Error preloading default images:', error);
      }
    };
    
    // Then, try to load user-specific images
    const preloadUserImages = async () => {
      try {
        // Get the image URLs with proper error handling
        let avatarUrl = null;
        let backgroundUrl = null;
        
        try {
          avatarUrl = await getEffectiveAvatarUrl(user.id);
        } catch (error) {
          console.warn('Error getting avatar URL for preloading:', error);
          avatarUrl = null;
        }
        
        try {
          backgroundUrl = await getBackgroundImageUrl(user.id);
        } catch (error) {
          console.warn('Error getting background URL for preloading:', error);
          backgroundUrl = null;
        }
        
        // Cache the avatar URL for persistence
        if (avatarUrl && window.imageCacheManager) {
          window.imageCacheManager.setAvatarUrl(user.id, avatarUrl);
        }
        
        // Only preload user images that haven't failed before
        const userImages = [];
        
        if (avatarUrl && 
            avatarUrl !== '/default-avatar.svg' && 
            !avatarUrl.startsWith('/') && 
            !failedUrlsRef.current.has(avatarUrl.split('?')[0])) {
          userImages.push(avatarUrl);
        }
        
        if (backgroundUrl && 
            backgroundUrl !== '/profile-bg.jpg' && 
            !backgroundUrl.startsWith('/') && 
            !failedUrlsRef.current.has(backgroundUrl.split('?')[0])) {
          userImages.push(backgroundUrl);
        }
        
        // Preload user images
        if (userImages.length > 0) {
          if (window.imageCacheManager) {
            window.imageCacheManager.preload(userImages);
          } else {
            await Promise.all(userImages.map(src => preloadImage(src, false)));
          }
          console.log('User-specific images preloaded successfully');
        } else {
          console.log('No user-specific images to preload');
        }
      } catch (error) {
        console.error('Error preloading user images:', error);
      }
    };

    // Add a helper method to get effective avatar URL with caching
    const getEffectiveAvatarUrl = async (userId) => {
      // Try getting from cache first
      if (window.imageCacheManager) {
        const cachedUrl = window.imageCacheManager.getAvatarUrl(userId);
        if (cachedUrl) {
          // Validate cached URL is still valid
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatarUrl')
              .eq('user_id', userId)
              .single();
              
            // Check if cached URL matches current URL
            if (profile?.avatarUrl === cachedUrl) {
              return cachedUrl;
            }
          } catch (error) {
            console.warn('Error validating cached avatar URL:', error);
          }
        }
      }
      
      // If not in cache or validation failed, fetch from API
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatarUrl')
          .eq('user_id', userId)
          .single();
          
        return profile?.avatarUrl || '/default-avatar.svg';
      } catch (error) {
        console.error('Error fetching avatar URL:', error);
        return '/default-avatar.svg';
      }
    };
    
    // Helper to get background image
    const getBackgroundImageUrl = async (userId) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('backgroundUrl')
          .eq('user_id', userId)
          .single();
          
        return profile?.backgroundUrl || '/profile-bg.jpg';
      } catch (error) {
        console.error('Error fetching background URL:', error);
        return '/profile-bg.jpg';
      }
    };

    // Execute in sequence - first default images, then user images
    const loadAllImages = async () => {
      await preloadDefaultImages();
      await preloadUserImages();
    };
    
    loadAllImages();
  }, [user, supabase]);

  // Helper function to preload an image
  const preloadImage = (src, isDefaultImage = false) => {
    return new Promise((resolve, reject) => {
      if (!src) {
        resolve();
        return;
      }
      
      // Skip if already loaded
      if (loadedImagesRef.current.has(src)) {
        resolve(src);
        return;
      }
      
      // Extract base URL without cache busting for tracking failures
      const baseUrl = src.split('?')[0];
      
      // Skip if this URL has failed before
      if (!isDefaultImage && failedUrlsRef.current.has(baseUrl)) {
        console.log(`Skipping previously failed image: ${baseUrl}`);
        resolve();
        return;
      }
      
      const img = new window.Image();
      
      // Set a timeout to avoid hanging on slow loading images
      const timeoutId = setTimeout(() => {
        console.warn(`Image load timeout for ${baseUrl}`);
        img.src = ''; // Cancel the image request
        
        if (!isDefaultImage) {
          failedUrlsRef.current.add(baseUrl);
          resolve(); // Resolve anyway to not block the app
        } else {
          reject(new Error('Timeout loading default image'));
        }
      }, 10000); // 10 second timeout
      
      img.onload = () => {
        clearTimeout(timeoutId);
        loadedImagesRef.current.add(src);
        const sourceType = isDefaultImage ? 'default' : 'user';
        console.log(`Successfully preloaded ${sourceType} image: ${baseUrl}`);
        resolve(src);
      };
      
      img.onerror = (error) => {
        clearTimeout(timeoutId);
        const sourceType = isDefaultImage ? 'default' : 'user';
        console.warn(`Failed to preload ${sourceType} image: ${baseUrl}`);
        
        if (!isDefaultImage) {
          // Add to failed URLs set to avoid repeated attempts
          failedUrlsRef.current.add(baseUrl);
          resolve(); // Resolve anyway to not block the app
        } else {
          reject(error);
        }
      };
      
      // Apply cache busting for Supabase URLs - this ensures fresh content
      // but we still use browser caching for performance
      let finalSrc = src;
      if (src.includes('supabase') && !src.includes('?')) {
        finalSrc = `${src}?t=${Date.now()}`;
      }
      
      // Set the src after setting up event handlers
      img.src = finalSrc;
      img.crossOrigin = 'anonymous'; // Important for canvas operations later
    });
  };

  // This component doesn't render anything visible
  return null;
};

export default ClientImagePreloader;
