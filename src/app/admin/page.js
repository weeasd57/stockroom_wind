'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin.module.css';
import { FiLock, FiMail, FiShield, FiEye, FiEyeOff } from 'react-icons/fi';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if already logged in
  useEffect(() => {
    const adminEmail = localStorage.getItem('admin_email');
    const adminToken = localStorage.getItem('admin_token');
    
    if (adminEmail && adminToken) {
      // Already logged in, redirect to dashboard
      router.push('/admin/dashboard');
    }
  }, [router]);

  // Demo mode - show credentials
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // API expects: { email, password }
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store admin session
        localStorage.setItem('admin_email', email.toLowerCase().trim());
        localStorage.setItem('admin_token', data.token || 'admin_authenticated');
        
        // Redirect to admin dashboard
        router.push('/admin/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        {/* Logo and Title */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <FiShield className={styles.logoIcon} />
          </div>
          <h1 className={styles.title}>Admin Portal</h1>
          <p className={styles.subtitle}>SharksZone Administration</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              <FiMail className={styles.labelIcon} />
              Admin Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="admin@example.com"
              required
              autoComplete="username"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              <FiLock className={styles.labelIcon} />
              Password
            </label>
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.loadingText}>Authenticating...</span>
            ) : (
              <>
                <FiShield className={styles.buttonIcon} />
                Access Admin Panel
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials (only show in demo mode) */}
        {isDemoMode && (
          <div className={styles.demoSection}>
            <div className={styles.divider}>
              <span>Demo Credentials</span>
            </div>
            <div className={styles.demoButtons}>
              <button
                type="button"
                className={styles.demoButton}
                onClick={() => handleDemoLogin('admin@demo.com', 'Demo123!')}
              >
                <FiShield />
                <div>
                  <div className={styles.demoRole}>Super Admin</div>
                  <div className={styles.demoEmail}>admin@demo.com</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className={styles.securityNotice}>
          <p>
            <strong>Security Notice:</strong> This is a protected area. 
            All login attempts are logged and monitored.
          </p>
        </div>

        {/* Footer Links */}
        <div className={styles.footer}>
          <a href="/" className={styles.footerLink}>
            ← Back to Main Site
          </a>
          <span className={styles.separator}>|</span>
          <a href="/docs" className={styles.footerLink}>
            Documentation
          </a>
        </div>
      </div>

      {/* Background Decoration */}
      <div className={styles.bgDecoration}>
        <div className={styles.bgCircle1}></div>
        <div className={styles.bgCircle2}></div>
        <div className={styles.bgCircle3}></div>
      </div>
    </div>
  );
}