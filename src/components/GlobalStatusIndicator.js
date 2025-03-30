'use client';

import { useCreatePostForm } from '@/contexts/CreatePostFormContext';
import { useState, useEffect } from 'react';
import '@/styles/globalStatusIndicator.css';

export default function GlobalStatusIndicator() {
  const { globalStatus, setGlobalStatusVisibility, resetSubmitState } = useCreatePostForm();
  const [isCancelling, setIsCancelling] = useState(false);

  // Reset isCancelling when globalStatus changes
  useEffect(() => {
    if (!globalStatus.visible) {
      setIsCancelling(false);
    }
  }, [globalStatus.visible]);

  // Auto-hide success message after delay
  useEffect(() => {
    if (globalStatus.visible && globalStatus.type === 'success') {
      const timer = setTimeout(() => {
        setGlobalStatusVisibility(false);
        if (resetSubmitState) {
          resetSubmitState();
        }
      }, 1000); // Hide after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [globalStatus.visible, globalStatus.type, setGlobalStatusVisibility, resetSubmitState]);

  // Ensure window.abortPostsFetch always exists
  useEffect(() => {
    // Safety check for SSR
    if (typeof window === 'undefined') return;
    
    // Ensure we have a fallback abort function if one doesn't exist
    if (typeof window.abortPostsFetch !== 'function') {
      console.log('GlobalStatusIndicator: Creating fallback abort function');
      window.abortPostsFetch = () => {
        console.log('GlobalStatusIndicator fallback abort function called');
        return Promise.resolve();
      };
    }
    
    return () => {
      // Don't clean up, let the useFetchPosts hook handle cleanup
    };
  }, []);
  
  if (!globalStatus.visible) {
    return null;
  }
  
  const handleCancel = async () => {
    console.log('Cancel button clicked, status type:', globalStatus.type);
    
    if (globalStatus.type === 'processing') {
      // Show cancelling state
      setIsCancelling(true);
      
      try {
        // Debug log to check if the abort function exists
        console.log('Checking for abort function:', window.abortPostsFetch);
        
        // Ensure we have an abort function, even if it's a dummy one
        if (typeof window.abortPostsFetch !== 'function') {
          console.warn('Creating fallback abort function');
          window.abortPostsFetch = () => {
            console.log('Fallback abort function called');
            return Promise.resolve();
          };
        }
        
        // Cancel the fetch operation using the global abort function
        console.log('Calling abort function...');
        await window.abortPostsFetch();
        console.log('Abort function called successfully');
        
        // Don't wait, hide immediately
        setGlobalStatusVisibility(false);
        
        // Wait a small amount before resetting state to allow UI to update
        setTimeout(() => {
          // Reset submit states completely
          if (resetSubmitState) {
            resetSubmitState();
          }
          setIsCancelling(false);
          
          console.log('Cancellation and state reset complete');
        }, 300);
      } catch (error) {
        console.error('Error during cancellation:', error);
        // Still hide the indicator even if there's an error
        setGlobalStatusVisibility(false);
        setIsCancelling(false);
        
        // Still reset state even if there's an error
        if (resetSubmitState) {
          resetSubmitState();
        }
      }
    } else {
      // For success or error, just hide the indicator
      setGlobalStatusVisibility(false);
      
      // Also reset form state
      if (resetSubmitState) {
        resetSubmitState();
      }
    }
  };
  
  return (
    <div className={`global-status-wrapper status-${isCancelling ? 'cancelling' : globalStatus.type}`}>
      {globalStatus.type === 'success' && !isCancelling ? (
        <div className="status-icon success-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
      ) : globalStatus.type === 'error' && !isCancelling ? (
        <div className="status-icon error-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
      ) : (
        <div className="status-icon spinner-icon"></div>
      )}
      
      <div className="status-content">
        <div className="status-title">
          {isCancelling ? 'Cancelling...' : 
           globalStatus.type === 'success' ? 'Success!' : 
           globalStatus.type === 'error' ? 'Error' : 
           'Fetching Posts'}
        </div>
        <div className="status-message">
          {isCancelling ? 'Stopping current operation...' : 
           globalStatus.message || 'Loading your posts...'}
        </div>
      </div>
      
      <button 
        className={`status-btn ${
          isCancelling ? 'cancelling-btn' :
          globalStatus.type === 'success' ? 'success-btn' : 
          globalStatus.type === 'error' ? 'error-btn' : 
          'cancel-btn'
        }`}
        onClick={handleCancel}
        aria-label={
          isCancelling ? 'Cancelling' :
          globalStatus.type === 'success' ? 'Close' : 
          globalStatus.type === 'error' ? 'Dismiss' : 
          'Cancel operation'
        }
        disabled={isCancelling}
      >
        {isCancelling ? (
          <>
            <svg className="btn-spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span>Cancelling</span>
          </>
        ) : globalStatus.type === 'success' ? (
          <>
            <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
            <span>Close</span>
          </>
        ) : globalStatus.type === 'error' ? (
          <>
            <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
            <span>Dismiss</span>
          </>
        ) : (
          <>
            <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Cancel</span>
          </>
        )}
      </button>
    </div>
  );
} 