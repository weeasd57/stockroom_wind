'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/components/theme-provider';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import styles from '@/styles/navbar.module.css';

// Different nav links for logged in and logged out users
const getNavLinks = (isAuthenticated) => {
  if (isAuthenticated) {
    return [
      { href: '/', label: 'Home' },
      { href: '/traders', label: 'Traders' },
    ];
  } else {
    return [
      { href: '/', label: 'Home' },
      { href: '/traders', label: 'Traders' },
    ];
  }
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const { profile, getEffectiveAvatarUrl } = useProfile();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const navLinks = getNavLinks(isAuthenticated);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const loadAvatarUrl = async () => {
      if (user) {
        const url = await getEffectiveAvatarUrl();
        setAvatarUrl(url);
      } else {
        setAvatarUrl('/default-avatar.svg');
      }
    };
    
    loadAvatarUrl();
  }, [user, getEffectiveAvatarUrl]);

  // No rendering at all on server-side
  if (!mounted) {
    return null;
  }

  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const closeMenu = () => setIsMenuOpen(false);
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`} suppressHydrationWarning>
      <div className={styles.container}>
        <Link href="/" className={styles.logo} onClick={closeMenu}>
          <div className={styles.logoWrapper}>
            <Image 
              src="/logo.svg" 
              alt="StockRoom Logo" 
              width={32}
              height={32}
              className={styles.logoImage}
              priority
            />
            <span className={styles.logoText}>StockRoom</span>
          </div>
        </Link>

        <button 
          className={styles.menuButton} 
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <div className={isMenuOpen ? `${styles.menuIcon} ${styles.open}` : styles.menuIcon}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>

        <nav className={isMenuOpen ? `${styles.nav} ${styles.open}` : styles.nav}>
          <ul className={styles.navList}>
            {navLinks.map(link => (
              <li key={link.href} className={styles.navItem}>
                <Link 
                  href={link.href} 
                  className={pathname === link.href ? `${styles.navLink} ${styles.active}` : styles.navLink}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <button 
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label="Switch theme"
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
                <Link href="/profile" className={styles.profileLink}>
                  <div className={styles.avatar}>
                    <Avatar className="h-10 w-10 border-2 border-primary">
                      <AvatarImage 
                        src={avatarUrl} 
                        alt="User Avatar"
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                      <AvatarFallback className="font-semibold">{profile?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                  </div>
                  <span className={styles.profileText}>
                    {profile?.username || 'Profile'}
                  </span>
                </Link>
                <button 
                  className={styles.logoutButton}
                  onClick={logout}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href="/login" className={styles.loginButton}>
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}