'use client';

import { useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { CreatePostButton } from '@/components/posts/CreatePostButton';
import { CreatePostForm } from '@/components/posts/CreatePostForm';
import { useCreatePostForm } from '@/providers/CreatePostFormProvider';
import { DashboardSection } from '@/components/home/DashboardSection';
import { createPortal } from 'react-dom';
import styles from '@/styles/home.module.css';
import '@/styles/create-post-page.css'; 

export default function HomePage() {
  const { user } = useSupabase();
  const profile = useProfile();
  const { isOpen, closeDialog } = useCreatePostForm();
  const [visible, setVisible] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [portalContainer, setPortalContainer] = useState(null);
  const dialogRef = useRef(null);

  // Reference to track if component is mounted
  const isMounted = useRef(false);

  // Set up portal container on component mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // Check if portal container already exists
      let container = document.getElementById('dialog-portal-container');
      if (!container) {
        // Create a container for our portal if it doesn't exist
        container = document.createElement('div');
        container.id = 'dialog-portal-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.zIndex = '10000'; // Extremely high z-index
        container.style.pointerEvents = 'none'; // Don't block clicks by default
        document.body.appendChild(container);
      }
      setPortalContainer(container);
    }
    
    return () => {
      // Clean up portal container on component unmount if we created it
      if (typeof document !== 'undefined') {
        const container = document.getElementById('dialog-portal-container');
        if (container && container.childNodes.length === 0) {
          document.body.removeChild(container);
        }
      }
    };
  }, []);

  // Animation effect
  useEffect(() => {
    // Short delay to ensure smooth animation
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Handle clicking outside the dialog to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        closeDialog();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDialog]);

  // Handle escape key to close dialog
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        closeDialog();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, closeDialog]);

  // Track window size for responsive components
  useEffect(() => {
    // Mark component as mounted
    isMounted.current = true;
    
    // Set initial window width
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
      
      // Check for dark mode
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDarkMode(darkModeQuery.matches);
      
      // Listen for dark mode changes
      const handleDarkModeChange = (e) => {
        if (isMounted.current) {
          setIsDarkMode(e.matches);
        }
      };
      
      darkModeQuery.addEventListener('change', handleDarkModeChange);
    }
    
    // Add window resize listener
    const handleResize = () => {
      if (isMounted.current) {
        setWindowWidth(window.innerWidth);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      isMounted.current = false;
      window.removeEventListener('resize', handleResize);
      
      if (typeof window !== 'undefined') {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeQuery.removeEventListener('change', handleResize);
      }
    };
  }, []);

  // Determine button size based on window width
  const getButtonSize = () => {
    if (windowWidth < 640) {
      return 'default';
    } else if (windowWidth < 1024) {
      return 'default';
    } else {
      return 'large';
    }
  };

  // Prevent body scrolling when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('dialog-open');
      if (portalContainer) {
        portalContainer.style.pointerEvents = 'auto';
      }
    } else {
      document.body.classList.remove('dialog-open');
      if (portalContainer) {
        portalContainer.style.pointerEvents = 'none';
      }
    }
    
    return () => {
      document.body.classList.remove('dialog-open');
      if (portalContainer) {
        portalContainer.style.pointerEvents = 'none';
      }
    };
  }, [isOpen, portalContainer]);

  // Dialog content that will be rendered in the portal
  const renderDialog = () => {
    if (!isOpen) return null;
    
    return (
      <div className="dialog-overlay">
        <div className="dialog-content" ref={dialogRef}>
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
            <CreatePostForm />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.homePage} ${visible ? styles.visible : ''}`}>
      <div className={styles.homeContent}>
        {/* Dashboard Section */}
        <DashboardSection />

        {/* Create Post Section */}
        <div className={styles.createPostSection}>
          <div className={styles.createPostContainer}>
            <h2 className={styles.emptyHomeTitle}>Share your insights</h2>
            <p className={styles.emptyHomeText}>Create a post to share your stock analysis, trading ideas, or market updates with the community</p>
            <CreatePostButton size={getButtonSize()} />
          </div>
        </div>
      </div>

      {/* Portal for dialog */}
      {portalContainer && isOpen && createPortal(renderDialog(), portalContainer)}
    </div>
  );
}