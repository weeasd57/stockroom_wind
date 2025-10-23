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
  | 'failed';

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
}

const BackgroundPriceCheckContext = createContext<BackgroundPriceCheckContextType | undefined>(undefined);

interface BackgroundPriceCheckProviderProps {
  children: React.ReactNode;
}

export function BackgroundPriceCheckProvider({ children }: BackgroundPriceCheckProviderProps) {
  const { user, supabase } = useSupabase();
  
  const [tasks, setTasks] = useState<PriceCheckTask[]>([]);
  const processingRef = useRef(false);

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
        
        // Set 3-minute timeout for background price check
        const timeoutId = setTimeout(() => {
          console.log('[BackgroundPriceCheck] Request timed out after 3 minutes');
          controller.abort();
        }, 3 * 60 * 1000); // 3 minutes
        
        try {
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
          
          // Show success notification
          if (typeof window !== 'undefined' && window.showNotification) {
            const message = checkedCount === 0 
              ? 'No posts found to check prices 📊'
              : `✅ Price check completed! Checked ${checkedCount} posts, updated ${updatedCount} prices. ${remainingChecks} checks remaining.`;
            
            window.showNotification(message, checkedCount === 0 ? 'info' : 'success');
          }

          // Show detailed results dialog if there are results to show
          if (result.results && result.results.length > 0 && typeof window !== 'undefined' && window.showPriceCheckResults) {
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
          }

        } catch (fetchError: unknown) {
          // Clear timeout on error
          clearTimeout(timeoutId);
          
          // Handle specific timeout error
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error('Request timed out after 3 minutes. Please try again.');
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

  // Remove a task
  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

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
