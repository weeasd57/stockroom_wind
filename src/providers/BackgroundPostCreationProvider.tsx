"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { uploadPostImageEnhanced } from "@/utils/imageUpload";
import { useSupabase } from "@/providers/SupabaseProvider";
import { usePosts } from "@/providers/PostProvider";

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
};

export type BackgroundPostCreationContextType = {
  tasks: BackgroundTask[];
  startBackgroundPostCreation: (input: StartBackgroundPostCreationInput) => string; // returns taskId
  cancelTask: (taskId: string) => void;
  clearTask: (taskId: string) => void;
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

        let imageUrl: string | null = input.existingImageUrl || null;

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

          if (uploadResult.error) {
            throw new Error(typeof uploadResult.error === "string" ? uploadResult.error : "Upload failed");
          }

          imageUrl = uploadResult.publicUrl || null;
          updateTask(id, { imageUrl });
          setProgress(85);
        }

        if (canceledRef.current.has(id)) return; // stop silently

        // Create post
        setStatus("creating", "Creating post");
        setProgress(90);

        const postPayload = {
          ...input.postData,
          image_url: imageUrl ?? input.postData?.image_url ?? null,
        };

        const saved = await createPost(postPayload);
        if (canceledRef.current.has(id)) return; // finished but cancelled, keep as cancelled

        // Success
        setProgress(100);
        updateTask(id, { status: "success", message: "Post created", canCancel: false });

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

  const value: BackgroundPostCreationContextType = useMemo(() => ({
    tasks,
    startBackgroundPostCreation,
    cancelTask,
    clearTask,
    clearAllCompleted,
  }), [tasks, startBackgroundPostCreation, cancelTask, clearTask, clearAllCompleted]);

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
