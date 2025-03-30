'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from '@/styles/home.module.css';
import CreatePostButton from '@/components/posts/CreatePostButton';
import Image from 'next/image';
import HomeIcon from '../../components/home/Home';
import Sidebar from '../../components/sidebar/SideBar';

// Export a component that only renders on client side
export default function HomePage() {
  // Using useState ensures this component only renders on client side
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    // Mark component as mounted (client-side only)
    setMounted(true);

    // Only redirect if we're sure the user is not authenticated
    if (!loading && !isAuthenticated) {
      router.push('/landing');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading state during SSR or while checking authentication
  if (!mounted || loading) {
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
    <div className={styles.homeContainer}>
      <Sidebar />
      <div className={styles.content}>
        <HomeIcon />
        <div className={styles.emptyHomeContainer}>
          <div className={styles.createPostContainer}>
            <h1 className={styles.emptyHomeTitle}>Welcome to FireStocks</h1>
            <p className={styles.emptyHomeText}>Share your stock analysis with the community</p>
            <CreatePostButton className={styles.createPostButton} inDialog={true} />
          </div>
        </div>
      </div>
    </div>
  );
}