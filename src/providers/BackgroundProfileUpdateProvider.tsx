"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { uploadImage, updateUserProfile } from "@/utils/supabase";
import { useSupabase } from "@/providers/SupabaseProvider";
import { toast } from 'sonner';

export type BackgroundProfileTaskStatus =
  | "pending"
  | "uploading_avatar"
  | "uploading_background"
  | "updating_profile"
  | "success"
  | "error"
  | "canceled";

export type BackgroundProfileTask = {
  id: string;
  createdAt: number;
  title?: string;
  status: BackgroundProfileTaskStatus;
  progress: number; // 0-100
  message?: string;
  error?: string | null;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  canCancel: boolean;
};

export type StartBackgroundProfileUpdateInput = {
  profileData: any; // profile fields to update
  avatarFile?: File | null;
  backgroundFile?: File | null;
  title?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
};

export type BackgroundProfileUpdateContextType = {
  tasks: BackgroundProfileTask[];
  startBackgroundProfileUpdate: (input: StartBackgroundProfileUpdateInput) => string;
  cancelTask: (taskId: string) => void;
  clearTask: (taskId: string) => void;
  clearAllCompleted: () => void;
};

const BackgroundProfileUpdateContext = createContext<BackgroundProfileUpdateContextType | undefined>(undefined);

export function BackgroundProfileUpdateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();

  const [tasks, setTasks] = useState<BackgroundProfileTask[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const canceledRef = useRef<Set<string>>(new Set());

  const updateTask = useCallback((taskId: string, patch: Partial<BackgroundProfileTask>) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...patch } : t)));
  }, []);

  const addTask = useCallback((task: BackgroundProfileTask) => {
    setTasks(prev => [task, ...prev]);
  }, []);

  const clearTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    const ctrl = controllersRef.current.get(taskId);
    if (ctrl) controllersRef.current.delete(taskId);
    canceledRef.current.delete(taskId);
  }, []);

  const clearAllCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== "success" && t.status !== "canceled" && t.status !== "error"));
  }, []);

  const cancelTask = useCallback((taskId: string) => {
    canceledRef.current.add(taskId);
    const ctrl = controllersRef.current.get(taskId);
    if (ctrl) {
      try { ctrl.abort(); } catch {}
    }
    updateTask(taskId, { status: "canceled", message: "Canceled by user", canCancel: false });
  }, [updateTask]);

  const startBackgroundProfileUpdate = useCallback((input: StartBackgroundProfileUpdateInput) => {
    const id = uuidv4();

    // Create task
    const initial: BackgroundProfileTask = {
      id,
      createdAt: Date.now(),
      title: input.title || "Updating profile",
      status: "pending",
      progress: 0,
      message: "Preparing...",
      error: null,
      avatarUrl: null,
      backgroundUrl: null,
      canCancel: true,
    };
    addTask(initial);

    // Spawn async worker
    const run = async () => {
      const ctrl = new AbortController();
      controllersRef.current.set(id, ctrl);
      const setProgress = (p: number) => updateTask(id, { progress: Math.max(0, Math.min(100, Math.round(p))) });
      const setStatus = (status: BackgroundProfileTaskStatus, message?: string) => updateTask(id, { status, message });

      try {
        // Ensure user exists
        if (!user?.id) {
          throw new Error("Not authenticated");
        }

        let newAvatarUrl: string | null = null;
        let newBackgroundUrl: string | null = null;
        let progress = 0;

        // Upload avatar if provided
        if (input.avatarFile && !canceledRef.current.has(id)) {
          setStatus("uploading_avatar", "Uploading avatar...");
          setProgress(10);

          try {
            const { publicUrl, error } = await uploadImage(
              input.avatarFile,
              'avatars',
              user.id,
              'avatar',
              {
                cacheControl: 'no-cache',
                upsert: true,
                onUploadProgress: (uploadProgress) => {
                  const percent = 10 + (uploadProgress.loaded / uploadProgress.total) * 30; // 10-40%
                  setProgress(percent);
                }
              }
            );

            if (error) {
              throw new Error(`Failed to upload avatar: ${error.message}`);
            }

            newAvatarUrl = publicUrl;
            updateTask(id, { avatarUrl: publicUrl });
            progress = 40;
            setProgress(progress);
          } catch (avatarError: any) {
            console.error('Avatar upload failed:', avatarError);
            // Continue with profile update even if avatar fails
            toast.error(`Warning: Failed to upload avatar: ${avatarError.message}`);
          }
        } else if (!input.avatarFile) {
          progress = 40;
          setProgress(progress);
        }

        // Upload background if provided
        if (input.backgroundFile && !canceledRef.current.has(id)) {
          setStatus("uploading_background", "Uploading background...");
          setProgress(progress + 5);

          try {
            const { publicUrl, error } = await uploadImage(
              input.backgroundFile,
              'backgrounds',
              user.id,
              'background',
              {
                cacheControl: 'no-cache',
                upsert: true,
                onUploadProgress: (uploadProgress) => {
                  const percent = progress + 5 + (uploadProgress.loaded / uploadProgress.total) * 30; // +30%
                  setProgress(percent);
                }
              }
            );

            if (error) {
              throw new Error(`Failed to upload background: ${error.message}`);
            }

            newBackgroundUrl = publicUrl;
            updateTask(id, { backgroundUrl: publicUrl });
            progress = 75;
            setProgress(progress);
          } catch (backgroundError: any) {
            console.error('Background upload failed:', backgroundError);
            // Continue with profile update even if background fails
            toast.error(`Warning: Failed to upload background: ${backgroundError.message}`);
          }
        } else if (!input.backgroundFile) {
          progress = 75;
          setProgress(progress);
        }

        if (canceledRef.current.has(id)) return; // stop silently

        // Update profile
        setStatus("updating_profile", "Saving changes...");
        setProgress(85);

        // Prepare update data
        const updateData = { ...input.profileData };
        
        if (newAvatarUrl) {
          updateData.avatar_url = newAvatarUrl.split('?')[0]; // Remove cache busting
        }
        
        if (newBackgroundUrl) {
          updateData.background_url = newBackgroundUrl.split('?')[0]; // Remove cache busting
        }

        console.log('[BackgroundProfileUpdate] Updating profile with data:', updateData);

        const { data, error } = await updateUserProfile(user.id, updateData);

        if (error) {
          throw new Error(error.message || 'Failed to update profile');
        }

        if (canceledRef.current.has(id)) return;

        // Refresh profile data by updating global cache if available
        setProgress(95);
        if (typeof window !== 'undefined' && (window as any).imageCacheManager) {
          if (newAvatarUrl) {
            (window as any).imageCacheManager.setAvatarUrl(user.id, newAvatarUrl);
          }
          if (newBackgroundUrl) {
            (window as any).imageCacheManager.setBackgroundUrl(user.id, newBackgroundUrl);
          }
        }

        // Success
        setProgress(100);
        updateTask(id, { status: "success", message: "Profile updated successfully", canCancel: false });

        // Show success toast
        toast.success("Profile updated successfully! ✅");

        // Call onSuccess callback if provided
        if (input.onSuccess) {
          try {
            input.onSuccess();
          } catch (err) {
            console.warn('[BackgroundProfileUpdate] onSuccess callback error:', err);
          }
        }

        // Auto-clear after some time
        setTimeout(() => {
          clearTask(id);
        }, 4000);

      } catch (err: any) {
        if (canceledRef.current.has(id)) {
          updateTask(id, { status: "canceled", message: "Canceled", canCancel: false });
          return;
        }
        
        const msg = err?.message || "Failed to update profile";
        updateTask(id, { status: "error", error: msg, message: msg, canCancel: false });
        
        // Show error toast
        toast.error(`Error: ${msg}`);
        
        // Call onError callback if provided
        if (input.onError) {
          try {
            input.onError(msg);
          } catch (err) {
            console.warn('[BackgroundProfileUpdate] onError callback error:', err);
          }
        }
      } finally {
        controllersRef.current.delete(id);
      }
    };

    // Fire and forget
    run();

    return id;
  }, [addTask, updateTask, user?.id, clearTask]);

  const value: BackgroundProfileUpdateContextType = useMemo(() => ({
    tasks,
    startBackgroundProfileUpdate,
    cancelTask,
    clearTask,
    clearAllCompleted,
  }), [tasks, startBackgroundProfileUpdate, cancelTask, clearTask, clearAllCompleted]);

  return (
    <BackgroundProfileUpdateContext.Provider value={value}>
      {children}
    </BackgroundProfileUpdateContext.Provider>
  );
}

export const useBackgroundProfileUpdate = () => {
  const ctx = useContext(BackgroundProfileUpdateContext);
  if (!ctx) throw new Error("useBackgroundProfileUpdate must be used within a BackgroundProfileUpdateProvider");
  return ctx;
};
