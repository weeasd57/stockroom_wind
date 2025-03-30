import { useState, useCallback, useRef, useEffect } from 'react';
import { getPosts } from '@/utils/supabase';
import { useCreatePostForm } from '@/contexts/CreatePostFormContext';

/**
 * Custom hook to fetch posts with integrated global status indicator
 */
export function useFetchPosts() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const abortControllerRef = useRef(null);
  
  const { setGlobalStatusVisibility, globalStatus } = useCreatePostForm();

  // Initialize the global abort function immediately
  useEffect(() => {
    console.log('useFetchPosts hook mounted - initializing global abort function');
    
    // Implementation that works safely server-side and client-side
    if (typeof window !== 'undefined') {
      // Only overwrite if it's not already a function (could happen if two instances of hook run)
      if (typeof window.abortPostsFetch !== 'function') {
        console.log('Setting initial abort function');
        window.abortPostsFetch = () => {
          console.log('Default abort handler called before real handler was set');
          return Promise.resolve();
        };
      } else {
        console.log('Abort function already exists, not overwriting initial value');
      }
    }
  }, []);

  // Expose a cancel function to abort ongoing requests
  const cancelFetch = useCallback(() => {
    console.log('Cancel fetch function called, abort controller exists:', !!abortControllerRef.current);
    
    // Clear the global status indicator FIRST, before doing anything else
    setGlobalStatusVisibility(false);
    
    // Reset all states related to fetching
    setIsLoading(false);
    setError(null);
    
    if (abortControllerRef.current) {
      console.log('Aborting fetch operation...');
      abortControllerRef.current.abort();
      // Important: Set to null after aborting to allow new fetch operations
      abortControllerRef.current = null;
      
      console.log('Fetch operation cancelled by user');
    } else {
      console.warn('No active fetch operation to cancel');
    }
    
    // Reset page to 1 to restart fetching from the beginning next time
    setPage(1);
    // Reset hasMore to restore the default state
    setHasMore(true);
    
    return Promise.resolve();
  }, [setGlobalStatusVisibility]);
  
  // Register the cancel function with the global context
  useEffect(() => {
    // Safety check for SSR
    if (typeof window === 'undefined') return;
    
    // Always make the cancel function available when this hook is used
    console.log('Registering actual abort function (cancelFetch)');
    
    // Store previous function for cleanup
    const prevAbortFunc = window.abortPostsFetch;
    
    // Set our actual abort function
    window.abortPostsFetch = cancelFetch;
    
    // Test that it's set properly
    console.log('Abort function set:', typeof window.abortPostsFetch === 'function');
    
    return () => {
      // Clean up on unmount - restore previous function if it exists
      console.log('Cleaning up global abort function');
      
      // Only restore if our function is still the current one (not overwritten by another instance)
      if (window.abortPostsFetch === cancelFetch) {
        if (typeof prevAbortFunc === 'function') {
          console.log('Restoring previous abort function');
          window.abortPostsFetch = prevAbortFunc;
        } else {
          // Set to a dummy function rather than null
          console.log('Setting dummy abort function on cleanup');
          window.abortPostsFetch = () => {
            console.log('Abort called after component unmounted');
            return Promise.resolve();
          };
        }
      } else {
        console.log('Not cleaning up abortPostsFetch as it was replaced by another instance');
      }
    };
  }, [cancelFetch]);

  const fetchPosts = useCallback(async (pageNum = 1) => {
    try {
      // Cancel any ongoing fetch before starting a new one
      if (abortControllerRef.current) {
        console.log('Cancelling previous fetch before starting new one');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Create a new AbortController for this fetch
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      console.log('Starting new fetch operation with page:', pageNum);
      
      // Make sure we reset state for a new fetch
      if (pageNum === 1) {
        // Reset posts array when fetching first page
        setPosts([]);
      }
      
      setIsLoading(true);
      setError(null);
      
      // Show global status indicator specifically for fetching posts
      setGlobalStatusVisibility(true, 'Fetching posts from your profile...', 'processing');
      
      // Verify the abort function is set
      console.log('Starting fetchPosts, verify abort function exists:', typeof window.abortPostsFetch === 'function');
      
      // Add a small delay to ensure UI updates are visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if the request was aborted during the delay
      if (signal.aborted) {
        console.log('Fetch aborted before API call');
        return;
      }
      
      // Pass the signal to the getPosts function if it supports it
      const { data, error, hasMorePages } = await getPosts(pageNum, 10, signal);
      
      // If aborted, don't continue processing
      if (signal.aborted) {
        console.log('Fetch was aborted during API call');
        return;
      }
      
      if (error) {
        console.error('Error fetching posts:', error);
        setError(error.message || 'Failed to load posts');
        // Show error in global status
        setGlobalStatusVisibility(true, `Error: ${error.message || 'Failed to load posts'}`, 'error');
        return;
      }
      
      if (pageNum === 1) {
        setPosts(data || []);
      } else {
        setPosts(prev => [...prev, ...(data || [])]);
      }
      
      setHasMore(hasMorePages || false);
      setPage(pageNum);
      
      // Show success in global status briefly then hide it
      setGlobalStatusVisibility(true, 'Posts loaded successfully from your profile!', 'success');
      setTimeout(() => {
        setGlobalStatusVisibility(false);
      }, 1500);
      
    } catch (error) {
      // Don't show error if it was just an abort
      if (error.name === 'AbortError') {
        console.log('Fetch operation was aborted');
        return;
      }
      
      console.error('Unexpected error fetching posts:', error);
      setError('An unexpected error occurred while fetching posts');
      
      // Show error in global status
      setGlobalStatusVisibility(true, `Error fetching posts: ${error.message || 'An unexpected error occurred'}`, 'error');
    } finally {
      // Only update loading state if not aborted and still have a reference to the current controller
      if (!abortControllerRef.current?.signal.aborted) {
        setIsLoading(false);
      }
      
      // Clear controller reference unless it was already replaced with a new one
      if (abortControllerRef.current?.signal.aborted) {
        abortControllerRef.current = null;
      }
    }
  }, [setGlobalStatusVisibility]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchPosts(page + 1);
    }
  }, [fetchPosts, hasMore, isLoading, page]);

  return {
    posts,
    isLoading,
    error,
    page,
    hasMore,
    fetchPosts,
    handleLoadMore,
    cancelFetch
  };
} 