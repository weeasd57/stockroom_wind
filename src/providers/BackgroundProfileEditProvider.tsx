'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
// @ts-ignore - uuid module types not available
import { v4 as uuidv4 } from 'uuid';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { uploadImage } from '@/utils/supabase';

export type ProfileEditTaskStatus = 
  | 'pending'
  | 'uploading_avatar'
  | 'uploading_background' 
  | 'saving_profile'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface ProfileEditTask {
  id: string;
  status: ProfileEditTaskStatus;
  progress: number;
  error?: string;
  formData?: any;
  avatarFile?: File;
  backgroundFile?: File;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  abortController?: AbortController;
}

interface BackgroundProfileEditContextType {
  tasks: ProfileEditTask[];
  isProcessing: boolean;
  submitProfileEdit: (formData: any, avatarFile?: File, backgroundFile?: File) => Promise<string>;
  removeTask: (taskId: string) => void;
  retryTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
}

const BackgroundProfileEditContext = createContext<BackgroundProfileEditContextType | undefined>(undefined);

interface BackgroundProfileEditProviderProps {
  children: React.ReactNode;
}

export function BackgroundProfileEditProvider({ children }: BackgroundProfileEditProviderProps) {
  const { user, supabase } = useSupabase();
  
  // Get profile context with safe fallbacks and explicit typing
  const profileContext: any = (() => {
    try {
      return useProfile();
    } catch (e) {
      console.warn('Profile provider not available in BackgroundProfileEditProvider');
      return null;
    }
  })();
  
  const updateProfile = profileContext?.updateProfile;
  const refreshData = profileContext?.refreshData;
  
  const [tasks, setTasks] = useState<ProfileEditTask[]>([]);
  const processingRef = useRef(false);

  // Check if we're currently processing any tasks
  const isProcessing = tasks.some(task => 
    ['pending', 'uploading_avatar', 'uploading_background', 'saving_profile'].includes(task.status)
  );

  // Submit a new profile edit task
  const submitProfileEdit = useCallback(async (
    formData: any, 
    avatarFile?: File, 
    backgroundFile?: File
  ): Promise<string> => {
    const taskId = uuidv4();
    
    const newTask: ProfileEditTask = {
      id: taskId,
      status: 'pending',
      progress: 0,
      formData,
      avatarFile,
      backgroundFile,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTasks(prev => [...prev, newTask]);
    
    console.log(`[BackgroundProfileEdit] ✅ New task created: ${taskId}`);
    console.log('[BackgroundProfileEdit] 📋 Form data:', formData);
    console.log('[BackgroundProfileEdit] 🖼️ Avatar file:', avatarFile ? `${avatarFile.name} (${avatarFile.size} bytes)` : 'None');
    console.log('[BackgroundProfileEdit] 🎨 Background file:', backgroundFile ? `${backgroundFile.name} (${backgroundFile.size} bytes)` : 'None');
    
    // Start processing after state flush to ensure the task exists when read
    setTimeout(() => {
      processTask(taskId);
    }, 0);
    
    return taskId;
  }, []);

  // Process a single task
  const processTask = useCallback(async (taskId: string) => {
    if (processingRef.current) {
      console.log(`[BackgroundProfileEdit] ⚠️ Already processing another task, skipping ${taskId}`);
      return;
    }
    processingRef.current = true;
    console.log(`[BackgroundProfileEdit] 🚀 Starting to process task: ${taskId}`);
    console.log(`[BackgroundProfileEdit] 🔍 Debug info: user=${!!user}, supabase=${!!supabase}, updateProfile=${!!updateProfile}`);

    try {
      // Get current tasks from state setter callback to avoid stale closure
      let currentTask: ProfileEditTask | undefined;
      setTasks(prev => {
        currentTask = prev.find(t => t.id === taskId);
        return prev;
      });
      
      // Fallback: allow one microtask for state commit then retry fetching the task
      if (!currentTask || !user) {
        await new Promise(res => setTimeout(res, 0));
        setTasks(prev => {
          currentTask = prev.find(t => t.id === taskId);
          return prev;
        });
      }
      
      if (!currentTask || !user) {
        console.error(`[BackgroundProfileEdit] ❌ Task ${taskId} not found or no user - Task: ${!!currentTask}, User: ${!!user}`);
        processingRef.current = false;
        return;
      }

      console.log(`[BackgroundProfileEdit] ✅ Processing task ${taskId} - Avatar: ${!!currentTask.avatarFile}, Background: ${!!currentTask.backgroundFile}`);

      // Update task status
      const updateTaskStatus = (status: ProfileEditTaskStatus, progress: number, updates?: Partial<ProfileEditTask>) => {
        setTasks(prev => prev.map(t => 
          t.id === taskId
            ? { ...t, status, progress, updatedAt: new Date(), ...updates }
            : t
        ));
      };

      let newAvatarUrl: string | null = null;
      let newBackgroundUrl: string | null = null;

      // Upload avatar if provided
      if (currentTask.avatarFile) {
        updateTaskStatus('uploading_avatar', 10);
        
        try {
          console.log('Uploading avatar file...');
          
          const { data, error, publicUrl } = await uploadImage(
            currentTask.avatarFile,
            'avatars',
            user.id,
            'avatar',
            {
              cacheControl: 'no-cache',
              upsert: true,
            }
          );

          if (error) throw error;
          
          newAvatarUrl = publicUrl;
          updateTaskStatus('uploading_avatar', 40, { avatarUrl: newAvatarUrl });
          
          console.log('Avatar uploaded successfully:', newAvatarUrl);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error('Avatar upload failed:', error);
          updateTaskStatus('failed', 0, { error: `Avatar upload failed: ${errorMessage}` });
          return;
        }
      }

      // Upload background if provided
      if (currentTask.backgroundFile) {
        updateTaskStatus('uploading_background', 50);
        
        try {
          console.log('Uploading background file...');
          
          const { data, error, publicUrl } = await uploadImage(
            currentTask.backgroundFile,
            'backgrounds',
            user.id,
            'background',
            {
              cacheControl: 'no-cache',
              upsert: true,
            }
          );

          if (error) throw error;
          
          newBackgroundUrl = publicUrl;
          updateTaskStatus('uploading_background', 70, { backgroundUrl: newBackgroundUrl });
          
          console.log('Background uploaded successfully:', newBackgroundUrl);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error('Background upload failed:', error);
          updateTaskStatus('failed', 0, { error: `Background upload failed: ${errorMessage}` });
          return;
        }
      }

      // Save profile data
      console.log(`[BackgroundProfileEdit] 💾 Starting to save profile data for task ${taskId}`);
      updateTaskStatus('saving_profile', 80);
      
      try {
        const updateData = {
          ...currentTask.formData
        };

        // Add image URLs if uploaded
        if (newAvatarUrl) {
          updateData.avatar_url = newAvatarUrl.split('?')[0]; // Remove cache busting
          // Clear avatar from local storage to force refresh
          if (typeof window !== 'undefined') {
            const oldAvatarKeys = Object.keys(localStorage).filter(key => 
              key.startsWith(`avatar_${user.id}`) || 
              key.startsWith(`cached_avatar_${user.id}`) ||
              key.includes('avatar_url')
            );
            oldAvatarKeys.forEach(key => localStorage.removeItem(key));
            console.log('🗑️ Cleared avatar cache from localStorage');
          }
        }
        if (newBackgroundUrl) {
          updateData.background_url = newBackgroundUrl.split('?')[0]; // Remove cache busting
          // Clear background from local storage to force refresh
          if (typeof window !== 'undefined') {
            const oldBackgroundKeys = Object.keys(localStorage).filter(key => 
              key.startsWith(`background_${user.id}`) || 
              key.startsWith(`cached_background_${user.id}`) ||
              key.includes('background_url')
            );
            oldBackgroundKeys.forEach(key => localStorage.removeItem(key));
            console.log('🗑️ Cleared background cache from localStorage');
          }
        }

        console.log('Saving profile data:', updateData);
        
        if (!updateProfile) {
          throw new Error('Profile update function not available');
        }
        
        const { success, error } = await updateProfile(updateData);
        
        if (error) throw new Error((error as any).message || 'Failed to update profile');

        // Clear any profile cache to ensure immediate updates
        if (typeof window !== 'undefined') {
          const profileCacheKeys = Object.keys(localStorage).filter(key => 
            key.includes(`profile_${user.id}`) || 
            key.includes('cached_profile') ||
            key.includes('user_profile')
          );
          profileCacheKeys.forEach(key => localStorage.removeItem(key));
          console.log('🗑️ Cleared profile cache from localStorage for real-time update');
          
          // Force refresh all images with the user's avatar URL to bust browser cache
          const timestamp = Date.now();
          const avatarImages = document.querySelectorAll(`img[src*="${user.id}/avatar"]`);
          avatarImages.forEach((img) => {
            const htmlImg = img as HTMLImageElement;
            const currentSrc = htmlImg.src;
            const baseSrc = currentSrc.split('?')[0]; // Remove existing query params
            htmlImg.src = `${baseSrc}?t=${timestamp}`;
            console.log('🔄 Force refreshed avatar image:', htmlImg.src);
          });
          
          // Also force refresh background images
          const backgroundElements = document.querySelectorAll(`[style*="${user.id}/background"]`);
          backgroundElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const style = htmlEl.style.backgroundImage;
            if (style.includes(user.id)) {
              const urlMatch = style.match(/url\(['"]?(.*?)['"]?\)/);
              if (urlMatch) {
                const currentUrl = urlMatch[1];
                const baseUrl = currentUrl.split('?')[0];
                htmlEl.style.backgroundImage = `url("${baseUrl}?t=${timestamp}")`;
                console.log('🔄 Force refreshed background image:', htmlEl.style.backgroundImage);
              }
            }
          });
        }

        // Refresh profile data
        if (refreshData) {
          await refreshData(user.id);
        }
        
        // Trigger a window event to notify other components about profile update
        if (typeof window !== 'undefined') {
          const profileUpdateEvent = new CustomEvent('avatarUpdated', {
            detail: { 
              userId: user.id, 
              newAvatarUrl: newAvatarUrl,
              newBackgroundUrl: newBackgroundUrl,
              profileData: updateData, // Include all updated profile data
              timestamp: Date.now()
            }
          });
          window.dispatchEvent(profileUpdateEvent);
          console.log('📡 Dispatched avatarUpdated event with complete profile data for real-time UI updates');
          
          // Dispatch specific event for social links update
          // Always dispatch social links event whether values are present or not
          // This ensures empty strings are properly handled and not converted to null
          const socialLinksUpdateEvent = new CustomEvent('socialLinksUpdated', {
            detail: {
              userId: user.id,
              // Use empty string as fallback to prevent null values
              facebook_url: updateData.facebook_url || '',
              telegram_url: updateData.telegram_url || '',
              youtube_url: updateData.youtube_url || '',
              timestamp: Date.now()
            }
          });
          window.dispatchEvent(socialLinksUpdateEvent);
          console.log('📡 Dispatched socialLinksUpdated event for social media icons refresh', {
            facebook: updateData.facebook_url || '',
            telegram: updateData.telegram_url || '',
            youtube: updateData.youtube_url || ''
          });
        }
        
        updateTaskStatus('completed', 100);
        
        console.log('Profile updated successfully');
        
        // Show success notification
        if (typeof window !== 'undefined' && window.showNotification) {
          window.showNotification('Profile updated successfully! ✅', 'success');
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Profile save failed:', error);
        updateTaskStatus('failed', 0, { error: `Failed to save profile: ${errorMessage}` });
        
        // Show error notification  
        if (typeof window !== 'undefined' && window.showNotification) {
          window.showNotification('Failed to update profile ❌', 'error');
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Task processing failed:', error);
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'failed', error: errorMessage, updatedAt: new Date() }
          : t
      ));
    } finally {
      processingRef.current = false;
    }
  }, [user, updateProfile, refreshData]);

  // Remove a task
  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, [tasks]);
  // Retry a failed task
  const retryTask = useCallback(async (taskId: string) => {
    // Check if task exists using state setter callback
    let taskExists = false;
    setTasks(prev => {
      taskExists = prev.some(t => t.id === taskId);
      return prev;
    });
    
    if (!taskExists) {
      console.warn(`[BackgroundProfileEdit] Task ${taskId} not found for retry`);
      return;
    }

    // Reset task status
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'pending', progress: 0, error: undefined, updatedAt: new Date() }
        : t
    ));

    // Process the task again
    await processTask(taskId);
  }, [processTask]);

  // Clear all completed tasks
  // Cancel a task
  const cancelTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        // Abort any ongoing operations
        if (t.abortController) {
          t.abortController.abort();
        }
        return { 
          ...t, 
          status: 'canceled', 
          error: 'Task canceled by user',
          progress: 0,
          updatedAt: new Date() 
        };
      }
      return t;
    }));
  }, []);

  // Clear all completed tasks
  const clearCompletedTasks = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'canceled'));
  }, []);

  const value: BackgroundProfileEditContextType = {
    tasks,
    isProcessing,
    submitProfileEdit,
    removeTask,
    retryTask,
    cancelTask,
    clearCompletedTasks,
  };

  return (
    <BackgroundProfileEditContext.Provider value={value}>
      {children}
    </BackgroundProfileEditContext.Provider>
  );
}

export const useBackgroundProfileEdit = () => {
  const context = useContext(BackgroundProfileEditContext);
  if (context === undefined) {
    throw new Error('useBackgroundProfileEdit must be used within a BackgroundProfileEditProvider');
  }
  return context;
};
