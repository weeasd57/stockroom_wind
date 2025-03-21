"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/useAuth";
import Image from "next/image";
import Link from "next/link";
import { getPosts } from "@/utils/supabase";
import PostCard from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import CreatePostButton from "@/components/posts/CreatePostButton";

export default function MainPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  useEffect(() => {
    if (!loading) {
      // Redirect based on authentication status
      if (isAuthenticated) {
        router.push('/home');
      } else {
        router.push('/landing');
      }
    }
  }, [isAuthenticated, loading, router]);

  // Fetch posts when authenticated
  const fetchPosts = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      setError(null); // Reset error state
      setErrorDetails(null); // Reset error details
      
      const { data, error, hasMorePages } = await getPosts(pageNum);
      
      if (error) {
        console.error('Error fetching posts:', error);
        setError(error.message || 'Failed to load posts');
        setErrorDetails({
          details: error.details,
          hint: error.hint
        });
        return;
      }
      
      if (pageNum === 1) {
        setPosts(data || []);
      } else {
        setPosts(prev => [...prev, ...(data || [])]);
      }
      
      setHasMore(hasMorePages || false);
      setPage(pageNum);
    } catch (error) {
      console.error('Unexpected error fetching posts:', error);
      setError('An unexpected error occurred while fetching posts');
      setErrorDetails({
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new post creation
  const handlePostCreated = (newPost) => {
    setPosts(prevPosts => [newPost, ...(prevPosts || [])]);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      fetchPosts(page + 1);
    }
  };

  // Render error message
  const renderErrorMessage = () => {
    if (!error) return null;
    
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
            {errorDetails && (
              <div className="mt-2 text-sm text-red-700">
                {errorDetails.hint && <p className="mb-1"><strong>Hint:</strong> {errorDetails.hint}</p>}
                {errorDetails.details && <p className="mb-1"><strong>Details:</strong> {errorDetails.details}</p>}
                {process.env.NODE_ENV === 'development' && errorDetails.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs">Stack trace</summary>
                    <pre className="mt-1 text-xs overflow-auto p-2 bg-red-100 rounded">{errorDetails.stack}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Only fetch posts if authenticated
    if (!loading && isAuthenticated) {
      fetchPosts();
    }
  }, [isAuthenticated, loading]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Show loading spinner while checking auth and redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-primary rounded-full"></div>
    </div>
  );
}
