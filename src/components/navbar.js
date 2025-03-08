"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/theme-provider';
import styles from '@/styles/navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/explore', label: 'Explore' },
    { href: '/stocks', label: 'Stocks' },
    { href: '/news', label: 'News' },
  ];

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo} onClick={closeMenu}>
          <div className={styles.logoWrapper}>
            <Image 
              src="/logo.svg" 
              alt="StockRoom Logo" 
              width={32} 
              height={32}
              className={styles.logoImage}
            />
            <span className={styles.logoText}>StockRoom</span>
          </div>
        </Link>

        <button 
          className={styles.menuButton} 
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <div className={`${styles.menuIcon} ${isMenuOpen ? styles.open : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>

        <nav className={`${styles.nav} ${isMenuOpen ? styles.open : ''}`}>
          <ul className={styles.navList}>
            {navLinks.map((link) => (
              <li key={link.href} className={styles.navItem}>
                <Link 
                  href={link.href} 
                  className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <button 
              onClick={toggleTheme} 
              className={styles.themeToggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>

            {isAuthenticated ? (
              <div className={styles.userMenu}>
                <Link href="/profile" className={styles.profileLink} onClick={closeMenu}>
                  <div className={styles.avatar}>
                    {user?.user_metadata?.avatar_url ? (
                      <Image 
                        src={user.user_metadata.avatar_url} 
                        alt="Profile" 
                        width={32} 
                        height={32}
                      />
                    ) : (
                      <div className={styles.avatarFallback}>
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <span className={styles.profileText}>Profile</span>
                </Link>
                <button onClick={logout} className={styles.logoutButton}>
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href="/login" className={styles.loginButton} onClick={closeMenu}>
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
