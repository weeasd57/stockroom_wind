'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAvatarImageUrl, getBackgroundImageUrl } from '@/utils/supabase';

/**
 * Component that preloads user images to ensure they're properly cached
 * This component doesn't render anything visible
 */
const ImagePreloader = () => {
  const { user } = useAuth();
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;

    const preloadImages = async () => {
      try {
        // Get the image URLs
        const avatarUrl = await getAvatarImageUrl(user.id);
        const backgroundUrl = await getBackgroundImageUrl(user.id);
        
        // Create an array of promises to preload images
        const imagesToPreload = [
          avatarUrl && preloadImage(avatarUrl),
          backgroundUrl && preloadImage(backgroundUrl),
          // Add default images to ensure they're loaded
          preloadImage('/default-avatar.svg'),
          preloadImage('/profile-bg.jpg')
        ].filter(Boolean); // Filter out null promises
        
        // Wait for all images to load
        await Promise.all(imagesToPreload);
        setImagesLoaded(true);
        console.log('All user images preloaded successfully');
      } catch (error) {
        console.error('Error preloading images:', error);
      }
    };

    preloadImages();
  }, [user]);

  // Helper function to preload an image
  const preloadImage = (src) => {
    return new Promise((resolve, reject) => {
      if (!src) {
        resolve();
        return;
      }
      
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(src);
      img.onerror = () => {
        console.warn(`Failed to preload image: ${src}`);
        resolve(); // Resolve anyway to not block other images
      };
    });
  };

  // This component doesn't render anything visible
  return null;
};

export default ImagePreloader;
