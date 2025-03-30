'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCreatePostForm } from '@/contexts/CreatePostFormContext';
import styles from '@/styles/home.module.css';
import CreatePostButton from '@/components/posts/CreatePostButton';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const { formState } = useCreatePostForm();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Only redirect if we're sure the user is not authenticated
    if (!loading && !isAuthenticated) {
      router.push('/landing');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className={`${styles.homePage} ${styles.visible}`}>
        <div className={styles.emptyHomeContainer}>
          <div className={styles.createPostContainer}>
            <h1 className={styles.emptyHomeTitle}>Welcome to FireStocks</h1>
            <p className={styles.emptyHomeText}>Share your stock analysis with the community</p>
            <div className={styles.loadingSpinner}></div>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render anything (we're redirecting)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`${styles.homePage} ${styles.visible}`}>
      <div className={styles.emptyHomeContainer}>
        <div className={styles.createPostContainer}>
          <h1 className={styles.emptyHomeTitle}>Welcome to FireStocks</h1>
          <p className={styles.emptyHomeText}>Share your stock analysis with the community</p>
          <CreatePostButton className={styles.createPostButton} inDialog={true}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Post
          </CreatePostButton>
        </div>
      </div>
    </div>
  );
}