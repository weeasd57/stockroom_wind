'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAvatarImageUrl, getBackgroundImageUrl } from '@/utils/supabase';
import logger from '@/utils/logger';

/**
 * Client component that preloads user images to ensure they're properly cached
 * This component doesn't render anything visible
 */
const ClientImagePreloader = () => {
  const { user } = useAuth();
  const [imagesLoaded, setImagesLoaded] = useState(false);
  // Keep track of failed URLs to avoid repeated attempts
  const failedUrlsRef = useRef(new Set());
  
  useEffect(() => {
    if (!user) return;

    // First, ensure default images are loaded
    const preloadDefaultImages = async () => {
      try {
        // Preload default images first and make sure they're fully loaded
        await Promise.all([
          preloadImage('/default-avatar.svg', true),
          preloadImage('/profile-bg.jpg', true)
        ]);
        
        logger.log('Default images preloaded successfully');
      } catch (error) {
        logger.error('Error preloading default images:', error);
      }
    };
    
    // Then, try to load user-specific images
    const preloadUserImages = async () => {
      try {
        // Get the image URLs with proper error handling
        let avatarUrl = null;
        let backgroundUrl = null;
        
        try {
          avatarUrl = await getAvatarImageUrl(user.id);
        } catch (error) {
          logger.warn('Error getting avatar URL for preloading:', error);
          avatarUrl = null;
        }
        
        try {
          backgroundUrl = await getBackgroundImageUrl(user.id);
        } catch (error) {
          logger.warn('Error getting background URL for preloading:', error);
          backgroundUrl = null;
        }
        
        // Only preload non-default user images that haven't failed before
        const userImagesPromises = [];
        
        if (avatarUrl && 
            avatarUrl !== '/default-avatar.svg' && 
            !avatarUrl.startsWith('/') && 
            !failedUrlsRef.current.has(avatarUrl.split('?')[0])) {
          userImagesPromises.push(preloadImage(avatarUrl, false, 'avatar'));
        }
        
        if (backgroundUrl && 
            backgroundUrl !== '/profile-bg.jpg' && 
            !backgroundUrl.startsWith('/') && 
            !failedUrlsRef.current.has(backgroundUrl.split('?')[0])) {
          userImagesPromises.push(preloadImage(backgroundUrl, false, 'background'));
        }
        
        // Wait for user images to load if there are any
        if (userImagesPromises.length > 0) {
          await Promise.all(userImagesPromises);
          logger.log('User-specific images preloaded successfully');
        } else {
          logger.log('No user-specific images to preload');
        }
        
        setImagesLoaded(true);
      } catch (error) {
        logger.error('Error preloading user images:', error);
        setImagesLoaded(true);
      }
    };

    // Execute in sequence - first default images, then user images
    const loadAllImages = async () => {
      await preloadDefaultImages();
      await preloadUserImages();
    };
    
    loadAllImages();
    
    // Clean up failed URLs when component unmounts
    return () => {
      failedUrlsRef.current.clear();
    };
  }, [user]);

  // Helper function to preload an image
  const preloadImage = (src, isDefaultImage = false, imageType = '') => {
    return new Promise((resolve, reject) => {
      if (!src) {
        resolve();
        return;
      }
      
      // Extract base URL without cache busting for tracking failures
      const baseUrl = src.split('?')[0];
      
      // Skip if this URL has failed before
      if (!isDefaultImage && failedUrlsRef.current.has(baseUrl)) {
        logger.log(`Skipping previously failed image: ${baseUrl}`);
        resolve();
        return;
      }
      
      const img = new window.Image();
      
      // Set a timeout to avoid hanging on slow loading images
      const timeoutId = setTimeout(() => {
        logger.warn(`Image load timeout for ${baseUrl}`);
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
        const sourceType = isDefaultImage ? 'default' : 'user';
        logger.log(`Successfully preloaded ${sourceType} ${imageType} image: ${baseUrl}`);
        resolve(src);
      };
      
      img.onerror = (error) => {
        clearTimeout(timeoutId);
        const sourceType = isDefaultImage ? 'default' : 'user';
        logger.warn(`Failed to preload ${sourceType} ${imageType} image: ${baseUrl}`);
        
        if (!isDefaultImage) {
          // Add to failed URLs set to avoid repeated attempts
          failedUrlsRef.current.add(baseUrl);
          
          if (imageType === 'background') {
            logger.log('Using default background image as fallback');
          } else if (imageType === 'avatar') {
            logger.log('Using default avatar image as fallback');
          }
          resolve(); // Resolve anyway to not block the app
        } else {
          reject(error);
        }
      };
      
      // Set the src after setting up event handlers
      img.src = src;
    });
  };

  // This component doesn't render anything visible
  return null;
};

export default ClientImagePreloader;
