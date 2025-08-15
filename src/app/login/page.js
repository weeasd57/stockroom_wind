"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase, signIn, signUp } from '@/utils/supabase';
import styles from '@/styles/login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false); // New state for password visibility

  useEffect(() => {
    // Add fade-in effect when component mounts
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Set default username based on email
  useEffect(() => {
    if (isSignUp && email && email.includes('@')) {
      setUsername(email.split('@')[0]);
    }
  }, [isSignUp, email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isResetPassword) {
      // Handle password reset
      if (!email || !email.includes('@')) {
        setError('Please provide a valid email address');
        setLoading(false);
        return;
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/auth/reset-password',
        });
        
        if (error) throw error;
        
        setSuccess('Password reset instructions have been sent to your email');
        setLoading(false);
      } catch (err) {
        console.error('Password reset error:', err);
        setError(err.message || 'Failed to send reset instructions');
        setLoading(false);
      }
      return;
    }

    // Basic validation
    if (!email || !email.includes('@') || !password) {
      setError('Please provide a valid email and password');
      setLoading(false);
      return;
    }

    // Password validation for sign up
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    // Username validation for sign up
    if (isSignUp && (!username || username.trim().length < 3)) {
      setError('Username must be at least 3 characters long');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        console.log('Login page: Attempting to sign up with:', email, 'Username:', username);
        
        // Remember to redirect to profile after auth completes
        try { localStorage.setItem('postAuthRedirect', '/profile'); } catch (e) { /* ignore */ }

        // Call our custom API route instead of the utility function
        const response = await fetch('/api/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            username
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to sign up');
        }
        
        console.log('Login page: Sign up successful, user created');
        
        // Show success message
        setSuccess('Account created successfully!');
        
        // Auto sign-in was handled by the API; SupabaseProvider will redirect to postAuthRedirect
        setTimeout(() => {
          setVisible(false);
        }, 1500);
      } else {
        // Use utility function for sign in
        const { data, error: signInError } = await signIn(email, password);
        
        if (signInError) throw signInError;
        
        // Fade out before navigation
        setVisible(false);
        setTimeout(() => router.push('/profile'), 300);
      }
    } catch (err) {
      console.error('Login page: Authentication error:', err);
      if (err.message.includes('Email rate limit exceeded')) {
        setError('Too many attempts. Please try again later.');
      } else if (err.message.includes('already registered') || err.message.includes('identities')) {
        setError('This email is already registered. Please sign in instead.');
        // Switch to sign in mode after a delay
        setTimeout(() => {
          setIsSignUp(false);
        }, 2000);
      } else if (err.message.includes('Database error saving new user')) {
        setError('Unable to create user profile. Please try again with a different username.');
        // Additional logging for this specific error
        console.error('Database profile creation error details:', err);
      } else if (err.message.includes('Password')) {
        setError(err.message);
      } else if (err.message.includes('Invalid login credentials')) {
        setError('The email or password you entered is incorrect. Please try again.');
      } else if (err.message.includes('Email not confirmed')) {
        setError('Please check your email to confirm your account before signing in.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      // Detect if we're on localhost or production
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';

      const redirectTo = isLocalhost 
        ? 'http://localhost:3000/auth/callback' 
        : 'https://firestocks.vercel.app/auth/callback';
      
      try { localStorage.setItem('postAuthRedirect', '/profile'); } catch (e) { /* ignore */ }

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

  const resetView = () => {
    setIsResetPassword(false);
    setIsSignUp(false);
    setError('');
    setSuccess('');
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
            {isResetPassword ? 'Reset your password' : isSignUp ? 'Join the trading community' : 'Welcome back, trader'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}
          
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
          
          {isSignUp && (
            <div className={styles.inputGroup}>
              <label htmlFor="username" className={styles.label}>Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={styles.input}
                placeholder="Choose a username"
                minLength={3}
              />
              <small className={styles.passwordHint}>Username must be at least 3 characters</small>
            </div>
          )}
          
          {!isResetPassword && (
            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <div className={styles.passwordInputContainer}> {/* Added a new div for styling and positioning the icon */}
                <input
                  id="password"
                  type={showPassword ? "text" : "password"} // Dynamically set type
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={styles.input}
                  placeholder="••••••••"
                  minLength={isSignUp ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className={styles.passwordToggle}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a1.8 1.8 0 0 1 0-2.02M15.07 4.93A10.07 10.07 0 0 1 12 4c7 0 10 7 10 7a1.8 1.8 0 0 1 0 2.02"/>
                      <path d="M9.9 9.9a2 2 0 1 0 4.2 4.2"/>
                      <path d="m2 2 20 20"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {isSignUp && (
                <small className={styles.passwordHint}>Password must be at least 6 characters</small>
              )}
            </div>
          )}
          
          <button 
            type="submit" 
            className={`${styles.button} ${styles.primaryButton}`}
            disabled={loading}
          >
            {loading ? 'Loading...' : 
              isResetPassword ? 'Send Reset Instructions' : 
              isSignUp ? 'Create Account' : 'Sign In'}
          </button>
          
          {!isResetPassword && (
            <>
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
            </>
          )}
        </form>
        
        <div className={styles.switchMode}>
          {isResetPassword ? (
            <p>Remember your password? <button onClick={resetView} className={styles.switchButton}>Back to Sign In</button></p>
          ) : isSignUp ? (
            <>
              <p>Already have an account? <button onClick={() => setIsSignUp(false)} className={styles.switchButton}>Sign In</button></p>
              <p className={styles.resetLink}>Forgot password? <button onClick={() => {setIsResetPassword(true); setIsSignUp(false);}} className={styles.switchButton}>Reset Password</button></p>
            </>
          ) : (
            <>
              <p>Don't have an account? <button onClick={() => setIsSignUp(true)} className={styles.switchButton}>Sign Up</button></p>
              <p className={styles.resetLink}>Forgot password? <button onClick={() => setIsResetPassword(true)} className={styles.switchButton}>Reset Password</button></p>
            </>
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