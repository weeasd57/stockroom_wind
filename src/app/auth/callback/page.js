'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import styles from './callback.module.css';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { refreshSession } = useSupabase();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) {
      return;
    }

    const handleAuth = async () => {
      if (hasRedirected.current) {
        return;
      }

      try {
        const result = await refreshSession();
        
        if (result.success && result.authenticated) {
          hasRedirected.current = true;
          router.replace('/profile');
        } else {
          hasRedirected.current = true;
          router.replace('/login');
        }
      } catch (error) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.replace(`/login?error=${encodeURIComponent(error.message)}`);
        }
      }
    };

    // Add a small delay before starting the auth process
    const timer = setTimeout(() => {
      handleAuth();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [router, refreshSession]);

  return (
    <div className={styles.container}>
      <div className={styles.loadingWrapper}>
        <div className={styles.loadingIndicator}></div>
        <p>Authenticating...</p>
      </div>
    </div>
  );
} 