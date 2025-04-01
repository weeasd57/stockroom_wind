'use client';

import { lazy, Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useCreatePostForm } from '@/contexts/CreatePostFormContext';
import '@/styles/create-post-page.css';

// Lazy load CreatePostForm component
const CreatePostForm = lazy(() => import('./CreatePostForm'));

// Preload function for the form
const preloadCreatePostForm = () => {
  // This will trigger the import but not render anything
  import('./CreatePostForm');
};

export default function CreatePostButton({ className = '', inDialog = false, children }) {
  const { isAuthenticated } = useAuth();
  const { 
    dialogOpen, 
    openDialog, 
    closeDialog,
    isSubmitting = false 
  } = useCreatePostForm() || {};

  // If not using dialog mode, just render a link to the create post page
  if (!inDialog) {
    return (
      <Link 
        href="/create-post" 
        className={`createPostButton ${className}`}
        onMouseEnter={preloadCreatePostForm}
        onTouchStart={preloadCreatePostForm}
      >
        {children || "Create Post"}
      </Link>
    );
  }

  return (
    <>
      <button 
        onClick={() => {
          if (isAuthenticated) {
            openDialog();
          }
        }} 
        className={`createPostButton ${className}`}
        onMouseEnter={preloadCreatePostForm}
        onTouchStart={preloadCreatePostForm}
      >
        {children || "Create Post"}
      </button>

      {dialogOpen && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <div className="dialog-header">
              <h2>Create Post</h2>
              <button 
                className="dialog-close-button" 
                onClick={closeDialog}
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
                <CreatePostForm />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
