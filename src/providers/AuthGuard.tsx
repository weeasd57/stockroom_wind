'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabase } from './SupabaseProvider';
import '@/styles/auth.css';

// Define paths that don't require authentication
const PUBLIC_PATHS = ['/landing', '/login', '/register', '/auth/callback'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useSupabase();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [authChecked, setAuthChecked] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Don't do anything while still loading
    if (loading) return;

    // Authentication check is complete
    setAuthChecked(true);

    // Current path is a public path, no need to redirect
    if (PUBLIC_PATHS.includes(pathname)) {
      return;
    }

    // Root path needs special handling - redirect based on auth status
    if (pathname === '/') {
      // Start the fade out animation
      setFadeOut(true);
      
      // Wait for animation to complete before redirecting
      setTimeout(() => {
        if (isAuthenticated) {
          router.push('/home');
        } else {
          router.push('/landing');
        }
      }, 300);
      return;
    }

    // For protected routes, redirect to landing if not authenticated
    if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
      console.log('User not authenticated, redirecting to landing page');
      
      // Start the fade out animation
      setFadeOut(true);
      
      // Wait for animation to complete before redirecting
      setTimeout(() => {
        router.push('/landing');
      }, 300);
      return;
    }
  }, [isAuthenticated, loading, pathname, router]);

  // Show loading state while checking auth
  if (loading || !authChecked) {
    return (
      <div className={`auth-guard-container ${fadeOut ? 'auth-fade-out' : 'auth-fade-in'}`}>
        <div className="auth-guard-content">
          <div className="auth-spinner large"></div>
          <div className="auth-loading-text">Checking authentication...</div>
        </div>
      </div>
    );
  }

  // Render children once authentication is checked
  return <>{children}</>;
} 