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
  const [avatarLoading, setAvatarLoading] = useState(true);
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
        try {
          setAvatarLoading(true);
          const url = await getEffectiveAvatarUrl();
          
          // Check if the URL is a Supabase URL or needs to be constructed
          if (url) {
            // If it's already a full URL (starts with http or https), use it directly
            if (url.startsWith('http')) {
              setAvatarUrl(url);
            } 
            // If it's a Supabase storage path, ensure it's properly formatted
            else if (url.includes('avatars/') || url.includes('profiles/')) {
              // Make sure we have the complete Supabase storage URL
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              const fullUrl = `${supabaseUrl}/storage/v1/object/public/${url}`;
              setAvatarUrl(fullUrl);
            } 
            // Otherwise use as is
            else {
              setAvatarUrl(url);
            }
          } else {
            setAvatarUrl('/default-avatar.svg');
          }
        } catch (error) {
          console.error('Error loading avatar image:', error);
          setAvatarUrl('/default-avatar.svg');
        } finally {
          setAvatarLoading(false);
        }
      } else {
        setAvatarUrl('/default-avatar.svg');
        setAvatarLoading(false);
      }
    };
    
    loadAvatarUrl();
  }, [user, getEffectiveAvatarUrl]);

  // Define functions early
  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const closeMenu = () => setIsMenuOpen(false);
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Effect to prevent body scrolling when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Close mobile menu when route changes
  useEffect(() => {
    closeMenu();
  }, [pathname]);

  // No rendering at all on server-side
  if (!mounted) {
    return null;
  }

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`} suppressHydrationWarning>
      <div className={styles.container}>
        <Link href="/" className={styles.logo} onClick={closeMenu}>
          <div className={styles.logoWrapper}>
            <Image 
              src="/favicon.ico" 
              alt="FireStocks Logo" 
              width={40}
              height={40}
              className={styles.logoImage}
              priority
            />
            <span className={styles.logoText}>
              <span className="text-gradient">Fire</span>Stocks
            </span>
          </div>
        </Link>

        <button 
          className={styles.menuButton} 
          onClick={toggleMenu}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          <div className={isMenuOpen ? `${styles.menuIcon} ${styles.open}` : styles.menuIcon}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>

        <nav className={isMenuOpen ? `${styles.nav} ${styles.open}` : `${styles.nav} ${styles.hidden}`} aria-hidden={!isMenuOpen}>
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
                    {avatarLoading ? (
                      <div className="rounded-full w-10 h-10 border-2 border-primary bg-primary/10 flex items-center justify-center animate-pulse">
                        <span className="font-semibold text-primary">
                          {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    ) : (
                      <img 
                        src={avatarUrl} 
                        alt={`${profile?.username || 'User'}'s Avatar`}
                        width={40}
                        height={40}
                        onError={(e) => {
                          console.error('Error loading navbar avatar image');
                          e.target.onerror = null;
                          e.target.src = '/default-avatar.svg';
                        }}
                      />
                    )}
                  </div>
                  <span className={styles.profileText}>
                    {profile?.username || user?.email?.split('@')[0] || 'Profile'}
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