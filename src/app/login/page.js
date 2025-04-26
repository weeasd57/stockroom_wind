"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/utils/supabase';
import styles from '@/styles/login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Add fade-in effect when component mounts
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Use Supabase signUp function directly
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, 
          password,
          options: {
            data: {
              username: email.split('@')[0]
            }
          }
        });
        
        if (signUpError) throw signUpError;
        
        // Fade out before navigation
        setVisible(false);
        setTimeout(() => router.push('/profile'), 300);
      } else {
        // Use Supabase signIn function directly
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) throw signInError;
        
        // Fade out before navigation
        setVisible(false);
        setTimeout(() => router.push('/'), 300);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Detect if we're on localhost or production
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';

      const redirectTo = isLocalhost 
        ? 'http://localhost:3000/auth/callback' 
        : 'https://firestocks.vercel.app/auth/callback';
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
        },
      });
      
      if (error) throw error;
      // No need to do anything else here as the user will be redirected to Google
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const navigateToLanding = () => {
    setVisible(false);
    setTimeout(() => router.push('/landing'), 300);
  };

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <div className={styles.logoContainer}>
          <div className={styles.logo}>
            <Image 
              src="/favicon_io/android-chrome-192x192.png" 
              alt="FireStocks Logo" 
              width={50} 
              height={50}
              className={styles.logoImage}
            />
            <h1 className={styles.title}>FireStocks</h1>
          </div>
          <p className={styles.subtitle}>
            {isSignUp ? 'Join the trading community' : 'Welcome back, trader'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
              placeholder="your@email.com"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            className={`${styles.button} ${styles.primaryButton}`}
            disabled={loading}
          >
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
          
          <div className={styles.divider}>
            <span>or</span>
          </div>
          
          <button 
            type="button" 
            onClick={handleGoogleLogin}
            className={`${styles.button} ${styles.googleButton}`}
            disabled={loading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
            </svg>
            Continue with Google
          </button>
        </form>
        
        <div className={styles.switchMode}>
          {isSignUp ? (
            <p>Already have an account? <button onClick={() => setIsSignUp(false)} className={styles.switchButton}>Sign In</button></p>
          ) : (
            <p>Don't have an account? <button onClick={() => setIsSignUp(true)} className={styles.switchButton}>Sign Up</button></p>
          )}
        </div>
      </div>
      
      <div className={styles.imageContainer}>
        <div className={styles.imageOverlay}></div>
        <div className={styles.imageContent}>
          <h2>Trade Together, Grow Together</h2>
          <p>Join thousands of traders sharing insights and strategies</p>
        </div>
      </div>
    </div>
  );
}