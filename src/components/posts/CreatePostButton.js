'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import CreatePostForm from './CreatePostForm';
import '@/styles/create-post-page.css';

export default function CreatePostButton({ className = '', inDialog = false }) {
  const { isAuthenticated } = useAuth();
  const [showDialog, setShowDialog] = useState(false);

  const handleOpenDialog = () => {
    if (isAuthenticated) {
      setShowDialog(true);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
  };

  const handlePostCreated = () => {
    setShowDialog(false);
    // You could add a callback here to refresh posts if needed
  };

  // If not using dialog mode, just render a link to the create post page
  if (!inDialog) {
    return (
      <Link href="/create-post" className={`createPostButton ${className}`}>
        Create Post
      </Link>
    );
  }

  return (
    <>
      <button 
        onClick={handleOpenDialog} 
        className={`createPostButton ${className}`}
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
              <CreatePostForm 
                onPostCreated={handlePostCreated} 
                onCancel={handleCloseDialog} 
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
