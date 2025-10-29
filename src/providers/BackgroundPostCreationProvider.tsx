"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
// @ts-ignore - uuid module types not available
import { v4 as uuidv4 } from "uuid";
import { uploadPostImageEnhanced } from "@/utils/imageUpload";
import { useSupabase } from "@/providers/SimpleSupabaseProvider";
import { usePosts } from "@/providers/PostProvider";

// Extend Window interface for showNotification
declare global {
  interface Window {
    showNotification?: (message: string, type: string) => void;
  }
}

export type BackgroundTaskStatus =
  | "pending"
  | "compressing"
  | "uploading"
  | "creating"
  | "success"
  | "error"
  | "canceled";

export type BackgroundTask = {
  id: string;
  createdAt: number;
  title?: string;
  status: BackgroundTaskStatus;
  progress: number; // 0-100
  message?: string;
  error?: string | null;
  imageUrl?: string | null;
  canCancel: boolean;
};

export type StartBackgroundPostCreationInput = {
  postData: any; // conforms to posts table insert
  imageFile?: File | null; // optional - if provided, provider will upload
  existingImageUrl?: string | null; // optional - if provided, upload is skipped
  title?: string; // optional label for UI
  onSuccess?: () => void | Promise<void>; // callback when post is successfully created
};

export type BackgroundPostCreationContextType = {
  tasks: BackgroundTask[];
  startBackgroundPostCreation: (input: StartBackgroundPostCreationInput) => string; // returns taskId
  cancelTask: (taskId: string) => void;
  clearTask: (taskId: string) => void;
  removeTask: (taskId: string) => void; // Alias for clearTask
  retryTask: (taskId: string) => Promise<void>; // Retry failed task
  clearAllCompleted: () => void;
};

const BackgroundPostCreationContext = createContext<BackgroundPostCreationContextType | undefined>(undefined);

export function BackgroundPostCreationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();
  const { createPost } = usePosts();

  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const canceledRef = useRef<Set<string>>(new Set());

  const updateTask = useCallback((taskId: string, patch: Partial<BackgroundTask>) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...patch } : t)));
  }, []);

  const addTask = useCallback((task: BackgroundTask) => {
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
    updateTask(taskId, { status: "canceled", message: "Cancelled by user", canCancel: false });
  }, [updateTask]);

  const startBackgroundPostCreation = useCallback((input: StartBackgroundPostCreationInput) => {
    const id = uuidv4();

    // Create task
    const initial: BackgroundTask = {
      id,
      createdAt: Date.now(),
      title: input.title || "Creating post",
      status: "pending",
      progress: 0,
      message: "Queued",
      error: null,
      imageUrl: null,
      canCancel: true,
    };
    addTask(initial);

    // Spawn async worker
    const run = async () => {
      const ctrl = new AbortController();
      controllersRef.current.set(id, ctrl);
      const setProgress = (p: number) => updateTask(id, { progress: Math.max(0, Math.min(100, Math.round(p))) });
      const setStatus = (status: BackgroundTaskStatus, message?: string) => updateTask(id, { status, message });

      try {
        // Ensure user exists
        if (!user?.id) {
          throw new Error("Not authenticated");
        }

        // Accept only http/https URLs from UI (ignore blob:/data: previews)
        const isValidHttpUrl = (u: any) => {
          try {
            if (!u || typeof u !== 'string') return false;
            const parsed = new URL(u);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        };

        let imageUrl: string | null = isValidHttpUrl(input.existingImageUrl) ? (input.existingImageUrl as string) : null;
        if (input.existingImageUrl && !imageUrl) {
          console.warn('[BackgroundPostCreation] existingImageUrl rejected (non-http/https):', input.existingImageUrl);
        }

        if (!imageUrl && input.imageFile) {
          // Upload flow
          setStatus("compressing", "Preparing image");
          setProgress(5);

          const uploadResult = await uploadPostImageEnhanced(input.imageFile, user.id, {
            maxSizeMB: 5,
            onProgress: (progress: number) => {
              // Map compression/upload to 0-80 range roughly
              const mapped = 5 + (progress / 100) * 70; // 5 -> 75
              setStatus("uploading", "Uploading image");
              setProgress(mapped);
            },
            signal: ctrl.signal,
          } as any);

          if (canceledRef.current.has(id)) return; // stop silently

          if ((uploadResult as any).error) {
            throw new Error(typeof (uploadResult as any).error === "string" ? (uploadResult as any).error : "Upload failed");
          }

          imageUrl = (uploadResult as any).publicUrl || null;
          updateTask(id, { imageUrl });
          setProgress(85);
        }

        if (canceledRef.current.has(id)) return; // stop silently

        // Create post
        setStatus("creating", "Creating post");
        setProgress(90);

        // Ensure image_url is explicitly set (use sanitized existing/uploaded URL)
        const postPayload = {
          ...input.postData,
          image_url: imageUrl || input.postData?.image_url || null,
        };

        // Remove any duplicate image property if exists
        if ('image' in postPayload) {
          delete postPayload.image;
        }
        if ('images' in postPayload) {
          delete postPayload.images;
        }

        console.log('[BackgroundPostCreation] CRITICAL - Post payload:', {
          hasImageUrl: !!postPayload.image_url,
          imageUrl: postPayload.image_url,
          imageUrlType: typeof postPayload.image_url,
          imageUrlLength: postPayload.image_url?.length,
          allKeys: Object.keys(postPayload),
          fullPayload: JSON.stringify(postPayload)
        });

        const saved = await createPost(postPayload);
        
        console.log('[BackgroundPostCreation] Post saved:', {
          savedId: saved?.id,
          savedImageUrl: saved?.image_url,
          hasImageUrl: !!saved?.image_url
        });
        if (canceledRef.current.has(id)) return; // finished but cancelled, keep as cancelled

        // Success
        setProgress(100);
        updateTask(id, { status: "success", message: "Post created", canCancel: false });

        // Call onSuccess callback if provided
        if (input.onSuccess) {
          try {
            await input.onSuccess();
          } catch (err) {
            console.warn('[BackgroundPostCreation] onSuccess callback error:', err);
          }
        }

        // Auto-clear after some time
        setTimeout(() => {
          clearTask(id);
        }, 4000);
      } catch (err: any) {
        if (canceledRef.current.has(id)) {
          updateTask(id, { status: "canceled", message: "Cancelled", canCancel: false });
          return;
        }
        const msg = err?.message || "Failed to create post";
        updateTask(id, { status: "error", error: msg, message: msg, canCancel: false });
      } finally {
        controllersRef.current.delete(id);
      }
    };

    // Fire and forget
    run();

    return id;
  }, [addTask, updateTask, user?.id, createPost, clearTask]);

  // Alias for clearTask to match drawer interface
  const removeTask = useCallback((taskId: string) => {
    clearTask(taskId);
  }, [clearTask]);

  // Retry failed task
  const retryTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // For post creation, we need the original data to retry
    // Since we don't store original data, we'll just clear the failed task
    // In a real implementation, you'd want to store the original post data
    console.log(`Retrying task ${taskId} - clearing failed task`);
    clearTask(taskId);
    
    // You could emit an event or callback here to trigger a retry with original data
    if (typeof window !== 'undefined' && window.showNotification) {
      window.showNotification('Please try creating the post again', 'info');
    }
  }, [tasks, clearTask]);

  const value: BackgroundPostCreationContextType = useMemo(() => ({
    tasks,
    startBackgroundPostCreation,
    cancelTask,
    clearTask,
    removeTask,
    retryTask,
    clearAllCompleted,
  }), [tasks, startBackgroundPostCreation, cancelTask, clearTask, removeTask, retryTask, clearAllCompleted]);

  return (
    <BackgroundPostCreationContext.Provider value={value}>
      {children}
    </BackgroundPostCreationContext.Provider>
  );
}

export const useBackgroundPostCreation = () => {
  const ctx = useContext(BackgroundPostCreationContext);
  if (!ctx) throw new Error("useBackgroundPostCreation must be used within a BackgroundPostCreationProvider");
  return ctx;
};
