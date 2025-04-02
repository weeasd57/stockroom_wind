'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import styles from './callback.module.css';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { refreshSession, user, isAuthenticated } = useSupabase();
  const [debugInfo, setDebugInfo] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  // Function to add debug messages with timestamps
  const addDebugMessage = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTH-CALLBACK] [${type}] ${message}`);
    setDebugInfo(prev => [...prev, { timestamp, message, type }]);
  };

  useEffect(() => {
    // Log initial state 
    addDebugMessage(`Initial auth state - User: ${!!user}, Authenticated: ${isAuthenticated}`, 'debug');

    // Extract hash parameters for debugging
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorParam = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
    if (errorParam) {
      addDebugMessage(`Found error in URL hash: ${errorParam}`, 'error');
      if (errorDescription) {
        addDebugMessage(`Error description: ${errorDescription}`, 'error');
        setErrorMessage(errorDescription);
      }
    }
    
    // Function to handle the auth callback
    const handleAuthCallback = async () => {
      addDebugMessage('Starting auth callback handler', 'process');
      
      try {
        // Log any query params for debugging
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.toString()) {
          addDebugMessage(`URL search params: ${searchParams.toString()}`, 'info');
        }
        
        // Process the callback by refreshing the session
        addDebugMessage('Refreshing session...', 'process');
        const startTime = Date.now();
        
        try {
          const result = await refreshSession();
          const duration = Date.now() - startTime;
          addDebugMessage(`Session refreshed successfully in ${duration}ms`, 'success');
          addDebugMessage(`Authentication state after refresh: ${result.authenticated}`, 'debug');
        } catch (refreshError) {
          const duration = Date.now() - startTime;
          addDebugMessage(`Session refresh failed after ${duration}ms: ${refreshError.message}`, 'error');
          throw refreshError;
        }

        // Short delay to ensure auth state is updated in context
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Final check of authentication state
        addDebugMessage(`Final auth check - User: ${!!user}, Authenticated: ${isAuthenticated}`, 'debug');
        setProcessingComplete(true);

        // Redirect to profile page after successful auth (delayed to ensure state update)
        addDebugMessage('Authentication successful, redirecting to profile page', 'success');
        setTimeout(() => {
          router.push('/profile');
        }, 500);
      } catch (error) {
        addDebugMessage(`Error during auth callback: ${error.message}`, 'error');
        if (error.stack) {
          console.error('Error stack trace:', error.stack);
        }
        setErrorMessage(error.message);
        setProcessingComplete(true);
        
        // Redirect to login page with error parameter if there's an error
        addDebugMessage('Redirecting to login page due to error', 'process');
        setTimeout(() => {
          router.push(`/login?error=${encodeURIComponent(error.message)}`);
        }, 2000);
      }
    };

    // Execute the callback handler
    handleAuthCallback();
  }, [router, refreshSession, user, isAuthenticated]);

  // Display a loading indicator while processing
  return (
    <div className={styles.container}>
      <div className={styles.loadingWrapper}>
        {!processingComplete ? (
          <>
            <div className={styles.loadingIndicator}></div>
            <p>Finalizing authentication...</p>
          </>
        ) : errorMessage ? (
          <div className={styles.errorContainer}>
            <div className={styles.errorIcon}>❌</div>
            <h3>Authentication Error</h3>
            <div className={styles.errorMessage}>{errorMessage}</div>
            <p>Redirecting to login page...</p>
          </div>
        ) : (
          <div className={styles.successContainer}>
            <div className={styles.successIcon}>✓</div>
            <h3>Authentication Successful</h3>
            <p>Redirecting to your profile...</p>
          </div>
        )}
        
        {/* Debug information panel - only visible in development */}
        {process.env.NODE_ENV !== 'production' && debugInfo.length > 0 && (
          <div className={styles.debugPanel}>
            <h3>Auth Callback Debug</h3>
            <div className={styles.debugScroll}>
              {debugInfo.map((item, index) => (
                <div 
                  key={index} 
                  className={`${styles.debugItem} ${styles[item.type]}`}
                >
                  <span className={styles.debugTime}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={styles.debugMessage}>{item.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 