'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useRouter } from 'next/navigation';
import PostGenerator from '@/components/admin/PostGenerator';
import styles from '@/styles/admin.module.css';

export default function AdminPage() {
  const { user, isAuthenticated, loading } = useSupabase();
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  
  // Check if user is authorized to access admin page
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        // Redirect to login if not authenticated
        router.push('/login');
      } else {
        // Set authorized to true for now (you can add more checks later)
        setAuthorized(true);
      }
    }
  }, [isAuthenticated, loading, router]);
  
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!authorized) {
    return (
      <div className={styles.unauthorizedContainer}>
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }
  
  return (
    <div className={styles.adminContainer}>
      <h1 className={styles.adminTitle}>Admin Dashboard</h1>
      
      <section>
        <h2>Data Tools</h2>
        <PostGenerator />
      </section>
      
      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>User Management</h2>
        <p className={styles.sectionDescription}>
          User management features will be added in future updates.
        </p>
      </section>
      
      <section className={styles.adminSection}>
        <h2 className={styles.sectionTitle}>System Status</h2>
        <div className={styles.statusInfo}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>User ID:</span>
            <span className={styles.statusValue}>{user?.id}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Environment:</span>
            <span className={styles.statusValue}>{process.env.NODE_ENV}</span>
          </div>
        </div>
      </section>
    </div>
  );
} 