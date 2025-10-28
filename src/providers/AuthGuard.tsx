'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSupabase } from './SimpleSupabaseProvider';
import '@/styles/auth.css';

// Define paths that don't require authentication
const PUBLIC_PATHS = ['/landing', '/login', '/register', '/auth/callback', '/traders', '/pricing', '/checkout'];

// Define path prefixes that should be public (for dynamic routes)
const PUBLIC_PATH_PREFIXES = ['/view-profile/'];
// Define error paths that should bypass authentication completely
const ERROR_PATHS = ['/404', '/500', '/not-found', '/error', '/_error'];

const AUTH_REDIRECT_TO_PROFILE_PATHS = ['/login', '/register'];

function ProtectedContent({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const router = useRouter();
  const { user, loading } = useSupabase();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!loading) {
      setIsInitialized(true);
    }
  }, [loading]);

  // Handle navigation redirects in useEffect to avoid render phase updates
  useEffect(() => {
    if (loading || !isInitialized) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname) || 
      PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));

    // If user is authenticated and tries to access login/register, redirect to profile
    if (user && AUTH_REDIRECT_TO_PROFILE_PATHS.includes(pathname)) {
      router.replace('/profile');
      return;
    }

    // If not authenticated and trying to access protected route, redirect to landing
    if (!user && !isPublicPath) {
      router.replace('/landing');
      return;
    }
  }, [loading, isInitialized, user, pathname, router]);

  // Show loading while authentication state is being determined
  if (loading || !isInitialized) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <div className="auth-loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Check if current path is public
  const isPublicPath = PUBLIC_PATHS.includes(pathname) || 
    PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));

  // If user is authenticated and tries to access login/register, show loading during redirect
  if (user && AUTH_REDIRECT_TO_PROFILE_PATHS.includes(pathname)) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <div className="auth-loading-spinner"></div>
          <p>Redirecting...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and trying to access protected route, show loading during redirect
  if (!user && !isPublicPath) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <div className="auth-loading-spinner"></div>
          <p>Redirecting...</p>
        </div>
      </div>
    );
  }

  // Render the protected content
  return <>{children}</>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  
  // Check for error paths first - bypass auth completely
  for (const errorPath of ERROR_PATHS) {
    if (pathname.includes(errorPath)) {
      console.log('Error page detected, bypassing auth check:', pathname);
      return <>{children}</>;
    }
  }
  
  // For all other pages, continue with normal auth flow
  return <ProtectedContent pathname={pathname}>{children}</ProtectedContent>;
}