'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabase } from './SupabaseProvider';
import '@/styles/auth.css';

// Define paths that don't require authentication
const PUBLIC_PATHS = ['/landing', '/login', '/register', '/auth/callback', '/traders'];

// Define path prefixes that should be public (for dynamic routes)
const PUBLIC_PATH_PREFIXES = ['/view-profile/'];

// Define error paths that should bypass authentication completely
const ERROR_PATHS = ['/404', '/500', '/not-found', '/error', '/_error'];

// Define paths that should redirect authenticated users to profile
const AUTH_REDIRECT_TO_PROFILE_PATHS = ['/login', '/register'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  
  // Bypass auth check completely for error pages
  // This prevents the useSupabase hook from being called during static generation
  for (const errorPath of ERROR_PATHS) {
    if (pathname.includes(errorPath)) {
      console.log('Error page detected, bypassing auth check:', pathname);
      return <>{children}</>;
    }
  }
  
  // For all other pages, continue with normal auth flow
  return <ProtectedContent pathname={pathname}>{children}</ProtectedContent>;
}

// Helper function to check if a path is public
function isPublicPath(pathname: string): boolean {
  // Check exact matches first
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }
  
  // Check path prefixes for dynamic routes
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return true;
    }
  }
  
  return false;
}

// Helper function to check if authenticated users should be redirected to profile
function shouldRedirectToProfile(pathname: string): boolean {
  return AUTH_REDIRECT_TO_PROFILE_PATHS.includes(pathname);
}

// Separate component for protected content that uses Supabase
function ProtectedContent({ children, pathname }: { children: React.ReactNode, pathname: string }) {
  const { user, loading, isAuthenticated } = useSupabase();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Don't do anything while still loading
    if (loading) return;
    
    // Mark auth as checked after loading completes
    setAuthChecked(true);
    
    // If we're on the root path, implement smart routing
    if (pathname === '/') {
      if (isAuthenticated) {
        console.log('Authenticated user on root, redirecting to profile');
        router.push('/profile');
      } else {
        console.log('Non-authenticated user on root, redirecting to landing');
        router.push('/landing');
      }
      return;
    }

    // Smart routing for auth pages
    if (shouldRedirectToProfile(pathname) && isAuthenticated) {
      console.log('Authenticated user on auth page, redirecting to profile');
      router.push('/profile');
      return;
    }
    
    // If we're on landing page and user is authenticated, redirect to home
    if (pathname === '/landing' && isAuthenticated) {
      console.log('Authenticated user on landing, redirecting to home');
      router.push('/home');
      return;
    }

    // Current path is a public path, allow access
    if (isPublicPath(pathname)) {
      return;
    }

    // For protected routes, redirect to landing if not authenticated
    if (!isAuthenticated && !isPublicPath(pathname)) {
      console.log('User not authenticated, redirecting to landing page');
      
      // Store the intended destination for post-login redirect
      if (typeof window !== 'undefined') {
        localStorage.setItem('postAuthRedirect', pathname);
      }
      
      // Start the fade out animation
      setFadeOut(true);
      
      // Wait for animation to complete before redirecting
      setTimeout(() => {
        router.push('/landing');
      }, 300);
      return;
    }
  }, [isAuthenticated, loading, pathname, router]);

  // Show optimized loading state
  if (loading || (!authChecked && !isPublicPath(pathname))) {
    return (
      <div className={`auth-guard-container ${fadeOut ? 'auth-fade-out' : 'auth-fade-in'}`}>
        <div className="auth-guard-content">
          <div className="auth-spinner large"></div>
          <div className="auth-loading-text">
            {loading ? 'Checking authentication...' : 'Preparing your experience...'}
          </div>
        </div>
      </div>
    );
  }

  // Show fade out animation when redirecting
  if (fadeOut) {
    return (
      <div className="auth-guard-container auth-fade-out">
        <div className="auth-guard-content">
          <div className="auth-spinner large"></div>
          <div className="auth-loading-text">Redirecting...</div>
        </div>
      </div>
    );
  }

  // Render children once authentication is checked
  return <>{children}</>;
} 