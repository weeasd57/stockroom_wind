'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../../../styles/admin.module.css';

export default function AdminCreateUser() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Basic validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    try {
      // Call the admin API to create the user
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccess(`User created successfully! User ID: ${data.user.id}`);
      
      // Clear form
      setEmail('');
      setPassword('');
      setUsername('');
      
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err.message || 'An error occurred while creating the user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container || 'container'}>
      <div className={styles.formContainer || 'form-container'}>
        <h1 className={styles.title || 'title'}>Admin: Create User</h1>
        
        {error && <div className={styles.error || 'error'}>{error}</div>}
        {success && <div className={styles.success || 'success'}>{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className={styles.inputGroup || 'input-group'}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input || 'input'}
            />
          </div>
          
          <div className={styles.inputGroup || 'input-group'}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={styles.input || 'input'}
              minLength={3}
            />
          </div>
          
          <div className={styles.inputGroup || 'input-group'}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input || 'input'}
              minLength={6}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className={styles.button || 'button'}
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
        
        <div className={styles.links || 'links'}>
          <Link href="/login">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
} 