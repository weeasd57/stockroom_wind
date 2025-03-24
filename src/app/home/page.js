'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import styles from '@/styles/home.module.css';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Redirect to landing page if not authenticated
    if (!loading && !isAuthenticated) {
      router.push('/landing');
    }
    
    // Animation effect
    setIsVisible(true);
  }, [isAuthenticated, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  // If not authenticated, don't render anything (we're redirecting)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`${styles.homePage} ${isVisible ? styles.visible : ''}`}>
      <div className={styles.emptyHomeContainer}>
        <div className={styles.createPostContainer}>
          <h1 className={styles.emptyHomeTitle}>Welcome to FireStocks</h1>
          <p className={styles.emptyHomeText}>Share your stock analysis with the community</p>
          <Link href="/create-post" className={styles.createPostButton}>
            Create Post
          </Link>
        </div>
      </div>
    </div>
  );
} 