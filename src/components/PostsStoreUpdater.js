'use client';

import { useEffect, useRef } from 'react';
import { useCreatePostForm } from '@/contexts/CreatePostFormContext';
import { useAuth } from '@/hooks/useAuth';
import useProfileStore from '@/store/profileStore';

/**
 * PostsStoreUpdater component
 * 
 * This component listens for post creation events from the CreatePostFormContext
 * and updates the profile store accordingly.
 * 
 * It serves as a bridge between the post creation process and profile data,
 * ensuring that newly created posts appear immediately in the user's profile
 * without requiring a refresh.
 */
export default function PostsStoreUpdater() {
  const { globalStatus } = useCreatePostForm();
  const { user } = useAuth();
  const { addPost, refreshData } = useProfileStore();
  const previousStatusRef = useRef(null);

  // Listen for changes in the global status to detect when posts are created
  useEffect(() => {
    // Get the full status for comparison
    const currentStatus = {
      visible: globalStatus.visible,
      type: globalStatus.type,
      message: globalStatus.message,
    };

    // Only proceed if there's a change from previous status
    if (
      !previousStatusRef.current || 
      JSON.stringify(previousStatusRef.current) !== JSON.stringify(currentStatus)
    ) {
      // Check if a post was successfully created
      if (
        currentStatus.visible &&
        currentStatus.type === 'success' &&
        currentStatus.message?.includes('Post created successfully')
      ) {
        console.log('Post creation detected, refreshing profile store');
        
        // If user is logged in, refresh their posts in the profile store
        if (user?.id) {
          // We use refreshData here as a fallback in case the direct addPost in CreatePostForm didn't work
          // This ensures profile posts are always up-to-date
          refreshData(user.id);
        }
      }
      
      // Update the previous status reference
      previousStatusRef.current = currentStatus;
    }
  }, [globalStatus, user, refreshData]);

  // This component doesn't render anything
  return null;
} 