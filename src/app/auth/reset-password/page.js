"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/utils/supabase';
import styles from '@/styles/login.module.css';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const [showNewPassword, setShowNewPassword] = useState(false); // State for new password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // State for confirm password visibility

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
    setSuccess('');
    setLoading(true);

    // Validate passwords
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setSuccess('Your password has been successfully updated');
      setLoading(false);
      
      // Redirect to login after successful password reset
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => router.push('/login'), 300);
      }, 2000);
    } catch (err) {
      console.error('Password update error:', err);
      setError(err.message || 'Failed to reset password');
      setLoading(false);
    }
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
          <p className={styles.subtitle}>Set your new password</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}
          
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>New Password</label>
            <div className={styles.passwordInputContainer}> {/* Added a new div for styling and positioning the icon */}
              <input
                id="password"
                type={showNewPassword ? "text" : "password"} // Dynamically set type
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.input}
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(prev => !prev)}
                className={styles.passwordToggle}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
              >
                {showNewPassword ? (
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
            <small className={styles.passwordHint}>Password must be at least 6 characters</small>
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
            <div className={styles.passwordInputContainer}> {/* Added a new div for styling and positioning the icon */}
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"} // Dynamically set type
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={styles.input}
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(prev => !prev)}
                className={styles.passwordToggle}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? (
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
          </div>
          
          <button 
            type="submit" 
            className={`${styles.button} ${styles.primaryButton}`}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
        
        <div className={styles.switchMode}>
          <p>Remember your password? <button onClick={() => router.push('/login')} className={styles.switchButton}>Back to Sign In</button></p>
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