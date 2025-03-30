"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { signInWithGoogle, signInWithGithub } from '@/utils/supabase-auth';
import { supabase } from '@/utils/supabase';
import styles from '@/styles/login.module.css';

// Export a simple component that uses useEffect to ensure it only runs on client-side
export default function LoginPage() {
  // Using useState here ensures this component only fully renders on the client
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // This ensures we only render the component on the client side
    setMounted(true);
  }, []);

  // Return null during server-side rendering
  if (!mounted) {
    return <div className="loading-container">Loading...</div>;
  }

  // Only render the actual login component on the client side
  return <LoginContent />;
}

// Separate the actual login content
function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login, register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Check if user is already authenticated
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push('/home');
      }
    };

    checkUser();
  }, [router]);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleToggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // Sign up
        await register(email, password);
        alert('Check your email for the confirmation link!');
      } else {
        // Sign in
        await login(email, password);
        router.push('/home');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleGithubSignIn = async () => {
    try {
      await signInWithGithub();
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.title}>{isSignUp ? 'Create Account' : 'Welcome Back'}</h1>
        <p className={styles.subtitle}>
          {isSignUp 
            ? 'Sign up to start tracking your stock portfolio' 
            : 'Sign in to continue to your account'}
        </p>
        
        {error && <div className={styles.errorMessage}>{error}</div>}
        
        <form onSubmit={handleEmailAuth} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              required
              className={styles.input}
              placeholder="your@email.com"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              required
              className={styles.input}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        
        <div className={styles.divider}>
          <span>OR</span>
        </div>
        
        <div className={styles.socialButtons}>
          <button 
            onClick={handleGoogleSignIn}
            className={styles.googleButton}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 0, 0)">
                <path d="M21.35,11.1H12v3.2h5.59c-0.56,2.68-3.08,4.7-5.59,4.7c-3.09,0-5.6-2.51-5.6-5.6c0-3.09,2.51-5.6,5.6-5.6 c1.57,0,2.97,0.64,4.01,1.68l2.37-2.37C16.54,5.36,14.42,4.5,12,4.5c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9 C21,12.34,20.78,11.7,21.35,11.1z" fill="#4285F4"></path>
                <path d="M7.5,13.5L7.5,13.5C7.5,13.5,7.49,13.5,7.5,13.5C7.49,13.5,7.5,13.5,7.5,13.5z" fill="none"></path>
                <path d="M7.5,13.5L7.5,13.5C7.5,13.5,7.49,13.5,7.5,13.5C7.49,13.5,7.5,13.5,7.5,13.5z" fill="none"></path>
              </g>
            </svg>
            Continue with Google
          </button>
          
          <button 
            onClick={handleGithubSignIn}
            className={styles.githubButton}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z" fill="#24292e"></path>
            </svg>
            Continue with GitHub
          </button>
        </div>
        
        <div className={styles.toggleAuth}>
          {isSignUp ? 'Already have an account?' : 'Don\'t have an account?'}
          <button 
            type="button" 
            onClick={handleToggleAuthMode}
            className={styles.toggleButton}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
