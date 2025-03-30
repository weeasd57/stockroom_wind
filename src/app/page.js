"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/useAuth";
import { useFetchPosts } from "@/hooks/useFetchPosts";

export default function MainPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  
  // Use the useFetchPosts hook instead of implementing the fetchPosts function directly
  const { 
    posts, 
    isLoading, 
    error, 
    fetchPosts, 
    handleLoadMore 
  } = useFetchPosts();

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

  // Set error details when error changes
  useEffect(() => {
    if (error) {
      setErrorDetails({
        details: typeof error === 'object' ? error.details : error,
        hint: typeof error === 'object' ? error.hint : undefined
      });
    } else {
      setErrorDetails(null);
    }
  }, [error]);

  // Handle new post creation
  const handlePostCreated = (newPost) => {
    // We would need to update this to work with the posts from useFetchPosts
    // For now, just trigger a refetch
    fetchPosts(1);
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
            <h3 className="text-sm font-medium text-red-800">{typeof error === 'string' ? error : 'Error fetching posts'}</h3>
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
      fetchPosts(1);
    }
  }, [isAuthenticated, loading, fetchPosts]);

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
