'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useTheme } from '@/providers/theme-provider';
import styles from '@/styles/admin/layout.module.css';
import { useDemoMode } from '@/providers/DemoModeProvider';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSupabase();
  const { isDemoAdmin } = useDemoMode();
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: '📊', shortName: 'Home' },
    { name: 'User Management', href: '/admin/users', icon: '👥', shortName: 'Users' },
    { name: 'Posts Moderation', href: '/admin/posts', icon: '📝', shortName: 'Posts' },
    { name: 'System Settings', href: '/admin/settings', icon: '⚙️', shortName: 'Settings' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_session');
    router.push('/login');
  };

  return (
    <div className={styles.adminLayout}>
      {/* Sidebar - Hidden on mobile */}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            {(!sidebarCollapsed || isMobile) && <h2>TradingHub Admin</h2>}
            {sidebarCollapsed && !isMobile && <span>TH</span>}
          </div>
          {!isMobile && (
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={styles.collapseBtn}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          )}
          {isMobile && (
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className={styles.collapseBtn}
              aria-label="Close menu"
            >
              ✕
            </button>
          )}
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
          
          {/* Divider */}
          <div className={styles.navDivider}></div>
          
          {/* View Site Link */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.navItem}
          >
            <span className={styles.navIcon}>🌐</span>
            {!sidebarCollapsed && <span className={styles.navText}>View Site</span>}
          </a>
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
        {isDemoAdmin && (
          <div className={styles.demoBanner}>
            <div className={styles.demoBannerIcon}>⚠️</div>
            <div className={styles.demoBannerContent}>
              <h2 className={styles.demoBannerTitle}>Admin Demo Mode</h2>
              <p className={styles.demoBannerText}>
                Changes made in this admin panel are for demonstration only and are not permanently saved.
              </p>
            </div>
          </div>
        )}
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className={styles.bottomNav}>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.bottomNavItem} ${isActive ? styles.bottomNavActive : ''}`}
                title={item.name}
                onClick={() => {
                  // Haptic feedback on mobile devices
                  if (navigator.vibrate) {
                    navigator.vibrate(10);
                  }
                }}
              >
                <span className={styles.bottomNavIcon}>{item.icon}</span>
                <span className={styles.bottomNavLabel}>{item.shortName}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Floating Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={styles.floatingThemeToggle}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  );
}
