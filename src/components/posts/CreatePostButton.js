'use client';

import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/create-post-page.css';

// Lazy load CreatePostForm component
const CreatePostForm = lazy(() => import('./CreatePostForm'));

// Preload function for the form
const preloadCreatePostForm = () => {
  // This will trigger the import but not render anything
  import('./CreatePostForm');
};

export default function CreatePostButton({ className = '', inDialog = false }) {
  const { isAuthenticated } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleOpenDialog = () => {
    if (isAuthenticated) {
      setShowDialog(true);
    }
  };

  const handleCloseDialog = () => {
    // Allow closing even if submitting - handled by CreatePostForm
    setShowDialog(false);
  };

  const handlePostCreated = () => {
    isSubmittingRef.current = false;
    setShowDialog(false);
    // You could add a callback here to refresh posts if needed
  };

  // Track submission state
  const handleSubmissionState = (isSubmitting) => {
    isSubmittingRef.current = isSubmitting;
  };

  // Initialize dialog when it shows
  useEffect(() => {
    if (showDialog) {
      // Prevent scrolling when dialog is open
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Allow scrolling when dialog is closed
        document.body.style.overflow = '';
      };
    }
  }, [showDialog]);

  // If not using dialog mode, just render a link to the create post page
  if (!inDialog) {
    return (
      <Link 
        href="/create-post" 
        className={`createPostButton ${className}`}
        onMouseEnter={preloadCreatePostForm}
        onTouchStart={preloadCreatePostForm}
      >
        Create Post
      </Link>
    );
  }

  return (
    <>
      <button 
        onClick={handleOpenDialog} 
        className={`createPostButton ${className}`}
        onMouseEnter={preloadCreatePostForm}
        onTouchStart={preloadCreatePostForm}
      >
        Create Post
      </button>

      {showDialog && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <div className="dialog-header">
              <h2>Create Post</h2>
              <button 
                className="dialog-close-button" 
                onClick={handleCloseDialog}
                aria-label="Close dialog"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="dialog-body">
              <Suspense fallback={
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading form...</p>
                </div>
              }>
                <CreatePostForm 
                  onPostCreated={handlePostCreated} 
                  onCancel={handleCloseDialog}
                  onSubmittingChange={handleSubmissionState}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
