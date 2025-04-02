'use client';

import { useState, useEffect } from 'react';

export default function RootPage() {
  const [isVisible, setIsVisible] = useState(false);

  // Animation effect only
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Just show a loading spinner - AuthGuard will handle redirection
  return (
    <div className="auth-loading-container">
      <div className={isVisible ? 'auth-fade-in' : ''}>
        <div className="auth-spinner large"></div>
        <p className="auth-loading-text">Preparing your experience...</p>
      </div>
    </div>
  );
}
