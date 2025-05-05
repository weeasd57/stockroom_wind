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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
              placeholder="••••••••"
              minLength={6}
            />
            <small className={styles.passwordHint}>Password must be at least 6 characters</small>
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={styles.input}
              placeholder="••••••••"
              minLength={6}
            />
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