'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from '@/styles/home.module.css';
import CreatePostButton from '@/components/posts/CreatePostButton';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
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
          <CreatePostButton className={styles.createPostButton} inDialog={true} />
        </div>
      </div>
    </div>
  );
}