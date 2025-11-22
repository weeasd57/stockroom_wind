'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import styles from '@/styles/admin/dashboard.module.css';

export default function AdminDashboard() {
  const { user, loading } = useSupabase();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState({
    users: { total: 0, active: 0, new: 0, banned: 0 },
    posts: { total: 0, pending: 0, featured: 0, today: 0 },
    revenue: { monthly: 0, yearly: 0, total: 0 },
    activity: [],
    systemStatus: {
      database: 'healthy',
      storage: 'healthy',
      api: 'healthy'
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const hasLocalAdmin =
    typeof window !== 'undefined'
      ? !!localStorage.getItem('admin_email')
      : false;

  // Check admin permissions
  useEffect(() => {
    if (!loading && !hasLocalAdmin && (!user || !isAdmin(user))) {
      router.push('/admin');
      return;
    }
    
    if ((user && isAdmin(user)) || hasLocalAdmin) {
      fetchDashboardData();
    }
  }, [user, loading, router]);

  const isAdmin = (user) => {
    // Check if user is admin (customize this logic for your needs)
    return user?.email === 'admin@sharkszone.com' || 
           user?.user_metadata?.role === 'admin' ||
           user?.app_metadata?.role === 'admin';
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch dashboard statistics
      const response = await fetch('/api/admin/dashboard');
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className={styles.adminLayout}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  if ((!user || !isAdmin(user)) && !hasLocalAdmin) {
    return (
      <div className={styles.unauthorized}>
        <h1>🚫 Unauthorized Access</h1>
        <p>You don't have permission to access the admin panel.</p>
        <button onClick={() => router.push('/admin')} className={styles.loginBtn}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.dashboardContainer}>
        {/* Header */}
        <header className={styles.contentHeader}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>📊 Dashboard Overview</h1>
            <p className={styles.pageSubtitle}>
              Welcome back, {user?.user_metadata?.full_name || 'Admin'}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button 
              onClick={fetchDashboardData}
              className={styles.refreshBtn}
            >
              🔄 Refresh
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className={styles.contentArea}>
          <DashboardOverview data={dashboardData} />
        </div>
      </div>
    </AdminLayout>
  );
}

// Dashboard Overview Component
function DashboardOverview({ data }) {
  return (
    <div className={styles.dashboardGrid}>
      {/* Stats Cards */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>👥</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{data.users.total}</h3>
            <p className={styles.statLabel}>Total Users</p>
            <span className={styles.statChange}>+{data.users.new} new</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📝</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{data.posts.total}</h3>
            <p className={styles.statLabel}>Total Posts</p>
            <span className={styles.statChange}>+{data.posts.today} today</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>${data.revenue.monthly}</h3>
            <p className={styles.statLabel}>Monthly Revenue</p>
            <span className={styles.statChange}>This month</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⚠️</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{data.posts.pending}</h3>
            <p className={styles.statLabel}>Pending Posts</p>
            <span className={styles.statChange}>Need review</span>
          </div>
        </div>
      </div>

      {/* Recent Activity & System Status */}
      <div className={styles.contentRow}>
        <div className={styles.activityCard}>
          <h3 className={styles.cardTitle}>📋 Recent Activity</h3>
          <div className={styles.activityList}>
            {data.activity.length > 0 ? (
              data.activity.map((activity, index) => (
                <div key={index} className={styles.activityItem}>
                  <span className={styles.activityTime}>
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={styles.activityText}>{activity.message}</span>
                </div>
              ))
            ) : (
              <p className={styles.emptyState}>No recent activity</p>
            )}
          </div>
        </div>

        <div className={styles.statusCard}>
          <h3 className={styles.cardTitle}>🖥️ System Status</h3>
          <div className={styles.statusList}>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Database:</span>
              <span className={`${styles.statusValue} ${styles[data.systemStatus.database]}`}>
                {data.systemStatus.database}
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Storage:</span>
              <span className={`${styles.statusValue} ${styles[data.systemStatus.storage]}`}>
                {data.systemStatus.storage}
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>API:</span>
              <span className={`${styles.statusValue} ${styles[data.systemStatus.api]}`}>
                {data.systemStatus.api}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

