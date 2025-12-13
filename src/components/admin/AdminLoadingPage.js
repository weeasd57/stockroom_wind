'use client';

import { useEffect, useState } from 'react';
import styles from '@/styles/admin/loading.module.css';

export default function AdminLoadingPage({ message = "Loading Admin Dashboard..." }) {
  const [dots, setDots] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animated dots
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    // Progress simulation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => {
      clearInterval(dotsInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingContent}>
        {/* Logo/Icon */}
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}>
            <div className={styles.iconInner}>📊</div>
          </div>
          <h1 className={styles.logoText}>TradingHub Admin</h1>
        </div>

        {/* Loading Animation */}
        <div className={styles.loadingAnimation}>
          <div className={styles.spinner}>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerRing}></div>
            <div className={styles.spinnerRing}></div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className={styles.progressText}>
            {Math.round(progress)}%
          </div>
        </div>

        {/* Loading Message */}
        <div className={styles.messageSection}>
          <p className={styles.loadingMessage}>
            {message}{dots}
          </p>
          <div className={styles.loadingSteps}>
            <div className={styles.step}>
              <span className={styles.stepIcon}>🔐</span>
              <span>Authenticating...</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepIcon}>📊</span>
              <span>Loading Dashboard...</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepIcon}>⚡</span>
              <span>Almost Ready!</span>
            </div>
          </div>
        </div>

        {/* Skeleton Cards */}
        <div className={styles.skeletonSection}>
          <div className={styles.skeletonGrid}>
            <div className={styles.skeletonCard}>
              <div className={styles.skeletonHeader}></div>
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonLine}></div>
                <div className={styles.skeletonLine}></div>
              </div>
            </div>
            <div className={styles.skeletonCard}>
              <div className={styles.skeletonHeader}></div>
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonLine}></div>
                <div className={styles.skeletonLine}></div>
              </div>
            </div>
            <div className={styles.skeletonCard}>
              <div className={styles.skeletonHeader}></div>
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonLine}></div>
                <div className={styles.skeletonLine}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
