'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './CookieConsent.module.css';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Check if user has already made a choice
    try {
      const consent = localStorage.getItem('cookie-consent');
      if (!consent) {
        setIsVisible(true);
      }
    } catch (e) {
      // If localStorage is not available (e.g. sandbox), don't show consent banner
      // or show it but don't try to save (depending on requirements).
      // For now, we'll just suppress the error.
      console.warn('LocalStorage access denied (sandbox mode).');
    }
  }, []);

  const acceptAll = () => {
    try {
      localStorage.setItem('cookie-consent', 'accepted');
    } catch (e) {
      console.warn('LocalStorage access denied (sandbox mode).');
    }
    setIsVisible(false);
    // Enable Google Analytics/AdSense if needed
    if (typeof window.gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
      });
    }
  };

  const rejectAll = () => {
    try {
      localStorage.setItem('cookie-consent', 'rejected');
    } catch (e) {
      console.warn('LocalStorage access denied (sandbox mode).');
    }
    setIsVisible(false);
    // Disable tracking
    if (typeof window.gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
      });
    }
  };

  if (!isMounted || !isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.banner}>
        <div className={styles.content}>
          <h3 className={styles.title}>🍪 We Respect Your Privacy</h3>
          <p className={styles.description}>
            We use cookies to improve your experience on our website and provide personalized content and relevant ads.
            You can accept or decline the use of cookies at any time.
          </p>

          <div className={styles.links}>
            <Link href="/privacy" className={styles.link}>
              Privacy Policy
            </Link>
            <Link href="/terms" className={styles.link}>
              Terms of Service
            </Link>
            <Link href="/disclaimer" className={styles.link}>
              Financial Disclaimer
            </Link>
          </div>

          <div className={styles.buttons}>
            <button onClick={rejectAll} className={styles.rejectButton}>
              Reject All
            </button>
            <button onClick={acceptAll} className={styles.acceptButton}>
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
