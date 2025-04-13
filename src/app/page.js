"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  // Immediately redirect to landing page
  useEffect(() => {
    // Redirect immediately to landing page
    // The AuthGuard will handle redirecting to home if user is authenticated
    router.push('/landing');
  }, [router]);

  // Animation effect for the brief moment this page is visible
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Show minimal loading UI while redirecting
  return (
    <div className="auth-loading-container">
      <div className={isVisible ? 'auth-fade-in' : ''}>
        <div className="auth-spinner large"></div>
        <p className="auth-loading-text">Redirecting...</p>
      </div>
    </div>
  );
}
