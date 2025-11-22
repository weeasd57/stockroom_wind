'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import styles from '@/styles/admin/layout.module.css';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSupabase();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { name: 'User Management', href: '/admin/users', icon: '👥' },
    { name: 'Posts Moderation', href: '/admin/posts', icon: '📝' },
    { name: 'System Settings', href: '/admin/settings', icon: '⚙️' },
    { name: 'Analytics', href: '/admin/analytics', icon: '📈' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_session');
    router.push('/login');
  };

  return (
    <div className={styles.adminLayout}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            {!sidebarCollapsed && <h2>SharksZone Admin</h2>}
            {sidebarCollapsed && <span>TH</span>}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={styles.collapseBtn}
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className={styles.navigation}>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!sidebarCollapsed && <span className={styles.navText}>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Admin"
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>👤</div>
            )}
            {!sidebarCollapsed && (
              <div className={styles.userDetails}>
                <p className={styles.userName}>
                  {user?.user_metadata?.full_name || 'Admin'}
                </p>
                <p className={styles.userEmail}>
                  {user?.email?.substring(0, 20)}...
                </p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            {sidebarCollapsed ? '🚪' : '🚪 Logout'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
