'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import styles from '@/styles/authLoading.module.css';

const loadingSteps = [
  { text: 'Connecting to servers', icon: '🌐' },
  { text: 'Loading market data', icon: '📊' },
  { text: 'Initializing dashboard', icon: '⚡' },
  { text: 'Almost ready', icon: '🎯' }
];

export default function AuthLoadingScreen() {
  const { theme, resolvedTheme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let stepInterval: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;
    let isMounted = true;

    // Add small delay to prevent immediate execution
    const initTimer = setTimeout(() => {
      if (!isMounted) return;
      
      stepInterval = setInterval(() => {
        if (!isMounted) return;
        setCurrentStep(prev => (prev + 1) % loadingSteps.length);
      }, 2000);

      progressInterval = setInterval(() => {
        if (!isMounted) return;
        setProgress(prev => {
          if (prev >= 100) return 20; // Reset to create continuous loading
          return prev + Math.random() * 15;
        });
      }, 300);
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      if (stepInterval) clearInterval(stepInterval);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, []);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // Get current theme for conditional styling
  const isDark = resolvedTheme === 'dark';

  return (
    <div 
      className={`${styles.authLoadingContainer} ${isDark ? styles.dark : styles.light}`}
      data-theme={resolvedTheme}
    >
      {/* Animated Background Grid */}
      <div className={styles.gridBackground}>
        <div className={styles.gridLine}></div>
        <div className={styles.gridLine}></div>
        <div className={styles.gridLine}></div>
        <div className={styles.gridLine}></div>
      </div>

      {/* Main Content */}
      <div className={styles.loadingContent}>
        {/* Hero Logo Section */}
        <div className={styles.heroSection}>
          <div className={styles.logoContainer}>
            <div className={styles.logoGlow}>
              <Image 
                src="/logo.svg" 
                alt="SharkZone Logo" 
                width={64} 
                height={64} 
                className={styles.logoIcon}
              />
            </div>
          </div>
          <h1 className={styles.brandTitle}>
            <span className={styles.brandShark}>Shark</span>
            <span className={styles.brandZone}>Zone</span>
          </h1>
          <p className={styles.brandTagline}>Advanced Social Trading Platform</p>
        </div>

        {/* Modern Loading Section */}
        <div className={styles.modernLoadingSection}>
          {/* Orbital Spinner */}
          <div className={styles.orbitalSpinner}>
            <div className={styles.orbit}>
              <div className={styles.planet}></div>
            </div>
            <div className={styles.orbit}>
              <div className={styles.planet}></div>
            </div>
            <div className={styles.orbit}>
              <div className={styles.planet}></div>
            </div>
            <div className={styles.centerCore}></div>
          </div>

          {/* Dynamic Loading Messages */}
          <div className={styles.dynamicMessage}>
            <div className={styles.messageIcon}>
              {loadingSteps[currentStep].icon}
            </div>
            <span className={styles.messageText}>
              {loadingSteps[currentStep].text}
            </span>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className={styles.progressSection}>
          <div className={styles.progressBarModern}>
            <div 
              className={styles.progressFillModern}
              style={{ width: `${Math.min(progress, 100)}%` }}
            >
              <div className={styles.progressGlow}></div>
            </div>
          </div>
          <div className={styles.progressInfo}>
            <span className={styles.progressLabel}>Loading Experience</span>
            <span className={styles.progressPercent}>
              {Math.round(Math.min(progress, 100))}%
            </span>
          </div>
        </div>

        {/* Feature Cards */}
        <div className={styles.featureCards}>
          <div className={styles.featureCard}>
            <div className={styles.cardIcon}>💹</div>
            <div className={styles.cardContent}>
              <h3>Live Markets</h3>
              <p>Real-time data streams</p>
            </div>
            <div className={styles.cardPulse}></div>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.cardIcon}>🤝</div>
            <div className={styles.cardContent}>
              <h3>Social Trading</h3>
              <p>Connect with traders</p>
            </div>
            <div className={styles.cardPulse}></div>
          </div>
        </div>
      </div>

      {/* Enhanced Background Effects */}
      <div className={styles.backgroundEffects}>
        <div className={styles.particleField}>
          <div className={styles.particle}></div>
          <div className={styles.particle}></div>
          <div className={styles.particle}></div>
          <div className={styles.particle}></div>
          <div className={styles.particle}></div>
        </div>
        
        <div className={styles.waveAnimation}>
          <div className={styles.wave}></div>
          <div className={styles.wave}></div>
        </div>
      </div>
    </div>
  );
}
