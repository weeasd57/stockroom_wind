'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
// @ts-ignore - uuid module types not available
import { v4 as uuidv4 } from 'uuid';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { savePriceCheckResult } from '@/utils/priceCheckHistory';

// Extend Window interface for showNotification and showPriceCheckResults
declare global {
  interface Window {
    showNotification?: (message: string, type: string) => void;
    showPriceCheckResults?: (results: any[], stats: any) => void;
  }
}

export type PriceCheckTaskStatus = 
  | 'pending'
  | 'fetching_posts'
  | 'checking_prices'
  | 'updating_database'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface PriceCheckTask {
  id: string;
  status: PriceCheckTaskStatus;
  progress: number;
  error?: string;
  userId?: string;
  symbol?: string;
  postsToCheck?: any[];
  totalPosts?: number;
  checkedPosts?: number;
  updatedPosts?: number;
  remainingChecks?: number;
  historyId?: string;
  resultsSummary?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface BackgroundPriceCheckContextType {
  tasks: PriceCheckTask[];
  isProcessing: boolean;
  submitPriceCheck: (userId: string) => Promise<string>;
  removeTask: (taskId: string) => void;
  retryTask: (taskId: string) => Promise<void>;
  clearCompletedTasks: () => void;
  cancelTask: (taskId: string) => void;
}

const BackgroundPriceCheckContext = createContext<BackgroundPriceCheckContextType | undefined>(undefined);

interface BackgroundPriceCheckProviderProps {
  children: React.ReactNode;
}

export function BackgroundPriceCheckProvider({ children }: BackgroundPriceCheckProviderProps) {
  const { user, supabase } = useSupabase();
  
  const [tasks, setTasks] = useState<PriceCheckTask[]>([]);
  const processingRef = useRef(false);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Keep a live reference to tasks to avoid stale closures in async handlers
  const tasksRef = useRef<PriceCheckTask[]>([]);
  React.useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Track user-canceled tasks to suppress post-response UI (notifications/results)
  const canceledTaskIdsRef = useRef<Set<string>>(new Set());

  // Check if we're currently processing any tasks
  const isProcessing = tasks.some(task => 
    ['pending', 'fetching_posts', 'checking_prices', 'updating_database'].includes(task.status)
  );

  // Submit a new price check task
  const submitPriceCheck = useCallback(async (userId: string): Promise<string> => {
    const taskId = uuidv4();
    
    const newTask: PriceCheckTask = {
      id: taskId,
      status: 'pending',
      progress: 0,
      userId,
      totalPosts: 0,
      checkedPosts: 0,
      updatedPosts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTasks(prev => [...prev, newTask]);
    
    // Start processing after state commit to ensure the task can be found
    setTimeout(() => {
      processTask(taskId);
    }, 0);
    
    return taskId;
  }, []);

  // Process a single task
  const processTask = useCallback(async (taskId: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      let task: PriceCheckTask | undefined;
      // Read from state setter to avoid stale closure
      setTasks(prev => {
        task = prev.find(t => t.id === taskId);
        return prev;
      });
      
      // Fallback: allow a microtask, then try reading the task again once
      if (!task || !user) {
        await new Promise(res => setTimeout(res, 0));
        setTasks(prev => {
          task = prev.find(t => t.id === taskId);
          return prev;
        });
      }
      if (!task || !user) {
        console.error(`[BackgroundPriceCheck] ❌ Task ${taskId} not found or no user - Task: ${!!task}, User: ${!!user}`);
        return;
      }

      console.log(`[BackgroundPriceCheck] Processing task ${taskId}`);
      // If user canceled before processing begins, exit early
      if (canceledTaskIdsRef.current.has(taskId)) {
        setTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { ...t, status: 'canceled', error: 'User canceled', updatedAt: new Date() }
            : t
        ));
        processingRef.current = false;
        return;
      }

      // Update task status
      const updateTaskStatus = (status: PriceCheckTaskStatus, progress: number, updates?: Partial<PriceCheckTask>) => {
        setTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { ...t, status, progress, updatedAt: new Date(), ...updates }
            : t
        ));
      };

      // Step 1: Call the price check API
      updateTaskStatus('fetching_posts', 10);
      
      try {
        console.log(`[BackgroundPriceCheck] Starting price check for user ${task.userId}`);
        
        // Create AbortController for timeout and cancellation
        const controller = new AbortController();
        abortControllersRef.current.set(taskId, controller);
        
        // Set 3-minute timeout for background price check
        const timeoutId = setTimeout(() => {
          console.log(`[BackgroundPriceCheck] Request timed out after 3 minutes for task ${taskId}`);
          controller.abort();
          abortControllersRef.current.delete(taskId);
        }, 3 * 60 * 1000); // 3 minutes
        
        try {
          // Guard again right before network call in case user canceled during preparation
          if (canceledTaskIdsRef.current.has(taskId)) {
            updateTaskStatus('canceled', 0, { error: 'User canceled' });
            return;
          }

          // Call the price check API route
          const response = await fetch('/api/posts/check-prices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: task.userId,
              includeApiDetails: false
            }),
            signal: controller.signal
          });
          
          // Clear timeout on successful response
          clearTimeout(timeoutId);
          abortControllersRef.current.delete(taskId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message || `HTTP ${response.status}`);
          }

          updateTaskStatus('checking_prices', 50);
          
          const result = await response.json();
          
          if (!result.success) {
            throw new Error(result.message || 'Price check failed');
          }

          updateTaskStatus('updating_database', 85);
          
          // Extract results from the API response
          const checkedCount = result.checkedPosts || 0;
          const updatedCount = result.updatedPosts || 0;
          const remainingChecks = result.remainingChecks || 0;

          // Save results to localStorage for history
          const historyEntryId = savePriceCheckResult({
            checkedPosts: checkedCount,
            updatedPosts: updatedCount,
            usageCount: result.usageCount || 0,
            remainingChecks: remainingChecks,
            results: result.results || [],
            userId: task.userId,
            processType: 'background'
          });
          
          console.log(`[BackgroundPriceCheck] Saved to history with ID: ${historyEntryId}`);
          
          // Complete the task with detailed results
          updateTaskStatus('completed', 100, { 
            totalPosts: checkedCount,
            checkedPosts: checkedCount,
            updatedPosts: updatedCount,
            symbol: checkedCount > 0 ? 'Multiple' : 'None',
            remainingChecks: remainingChecks,
            historyId: historyEntryId, // Link to history entry
            // Add results summary for UI display
            resultsSummary: {
              postsChecked: checkedCount,
              postsUpdated: updatedCount,
              remainingChecks: remainingChecks,
              success: true,
              timestamp: new Date().toISOString(),
              historyId: historyEntryId
            }
          });
          
          console.log(`[BackgroundPriceCheck] Price check completed successfully. Checked: ${checkedCount}, Updated: ${updatedCount}`);
          
          // Show success notification only if task is not canceled
          if (typeof window !== 'undefined' && window.showNotification) {
            if (!canceledTaskIdsRef.current.has(taskId)) {
              const currentTask = tasksRef.current.find(t => t.id === taskId);
              if (currentTask && currentTask.status !== 'canceled') {
                const message = checkedCount === 0 
                  ? 'No posts found to check prices 📊'
                  : `✅ Price check completed! Checked ${checkedCount} posts, updated ${updatedCount} prices. ${remainingChecks} checks remaining.`;
                window.showNotification(message, checkedCount === 0 ? 'info' : 'success');
              } else {
                console.log(`[BackgroundPriceCheck] Task ${taskId} marked canceled, skipping success notification`);
              }
            } else {
              console.log(`[BackgroundPriceCheck] Task ${taskId} canceled by user, skipping success notification`);
            }
          }

          // Show detailed results dialog if there are results to show AND task is not canceled
          if (result.results && result.results.length > 0 && typeof window !== 'undefined' && window.showPriceCheckResults) {
            if (!canceledTaskIdsRef.current.has(taskId)) {
              const currentTask = tasksRef.current.find(t => t.id === taskId);
              if (currentTask && currentTask.status !== 'canceled') {
                console.log(`[BackgroundPriceCheck] Showing results dialog with ${result.results.length} results`);
                // Prepare stats for dialog
                const statsForDialog = {
                  usageCount: result.usageCount || 0,
                  remainingChecks: remainingChecks,
                  checkedPosts: checkedCount,
                  updatedPosts: updatedCount
                };
                // Show the results dialog
                window.showPriceCheckResults(result.results, statsForDialog);
              } else {
                console.log(`[BackgroundPriceCheck] Task ${taskId} status is canceled, skipping results dialog`);
              }
            } else {
              console.log(`[BackgroundPriceCheck] Task ${taskId} canceled by user, skipping results dialog`);
            }
          }

        } catch (fetchError: unknown) {
          // Clear timeout on error
          clearTimeout(timeoutId);
          abortControllersRef.current.delete(taskId);
          
          // Handle specific timeout/cancellation error
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            // Check if this was a user cancellation vs timeout
            const controller = abortControllersRef.current.get(taskId);
            if (!controller) {
              // Controller was removed = user cancellation
              updateTaskStatus('canceled', 0, { error: 'User canceled' });
              console.log(`[BackgroundPriceCheck] Task ${taskId} was canceled by user`);
              return; // Exit early, don't throw error
            } else {
              // Controller still exists = timeout
              throw new Error('Request timed out after 3 minutes. Please try again.');
            }
          }
          
          // Re-throw the error with proper handling
          if (fetchError instanceof Error) {
            throw fetchError;
          } else {
            throw new Error('An unknown error occurred during price check');
          }
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Price check failed:', error);
        updateTaskStatus('failed', 0, { error: errorMessage });
        
        // Show error notification  
        if (typeof window !== 'undefined' && window.showNotification) {
          window.showNotification('❌ Price check failed', 'error');
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
  }, [tasks, user, supabase]);

  // Cancel a running task
  const cancelTask = useCallback((taskId: string) => {
    console.log(`[BackgroundPriceCheck] 🚫 Canceling task: ${taskId}`);
    // Mark task as user-canceled (used to suppress any late success handlers)
    canceledTaskIdsRef.current.add(taskId);
    
    // Abort the ongoing request if it exists
    const controller = abortControllersRef.current.get(taskId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(taskId);
      console.log(`[BackgroundPriceCheck] ✅ Aborted API request for task: ${taskId}`);
    }
    
    // Update task status to canceled
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'canceled', error: 'User canceled', progress: t.progress, updatedAt: new Date() }
        : t
    ));
    
    // Reset processing ref if this was the current task
    processingRef.current = false;
    
    // Show cancellation notification
    if (typeof window !== 'undefined' && window.showNotification) {
      window.showNotification('🚫 Price check cancelled', 'info');
    }
  }, []);

  // Remove a task
  const removeTask = useCallback((taskId: string) => {
    // Cancel first if task is still running
    const task = tasks.find(t => t.id === taskId);
    if (task && ['pending', 'fetching_posts', 'checking_prices', 'updating_database'].includes(task.status)) {
      cancelTask(taskId);
    }
    
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, [tasks, cancelTask]);

  // Retry a failed task
  const retryTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Reset task status
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { 
            ...t, 
            status: 'pending', 
            progress: 0, 
            error: undefined, 
            checkedPosts: 0,
            updatedPosts: 0,
            updatedAt: new Date() 
          }
        : t
    ));

    // Process the task again
    await processTask(taskId);
  }, [tasks, processTask]);

  // Clear all completed tasks
  const clearCompletedTasks = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed'));
  }, []);

  const value: BackgroundPriceCheckContextType = {
    tasks,
    isProcessing,
    submitPriceCheck,
    removeTask,
    retryTask,
    clearCompletedTasks,
    cancelTask,
  };

  return (
    <BackgroundPriceCheckContext.Provider value={value}>
      {children}
    </BackgroundPriceCheckContext.Provider>
  );
}

export const useBackgroundPriceCheck = () => {
  const context = useContext(BackgroundPriceCheckContext);
  if (context === undefined) {
    throw new Error('useBackgroundPriceCheck must be used within a BackgroundPriceCheckProvider');
  }
  return context;
};
