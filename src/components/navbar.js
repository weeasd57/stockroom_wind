'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { ModeToggle } from '@/components/mode-toggle';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import styles from '@/styles/navbar.module.css';

// Different nav links for logged in and logged out users
const getNavLinks = (isAuthenticated) => {
  if (isAuthenticated) {
    return [
      { href: '/home', label: 'Home' },
      { href: '/traders', label: 'Traders' },
    ];
  } else {
    return [
      { href: '/landing', label: 'Home' },
      { href: '/traders', label: 'Traders' },
    ];
  }
};

export default function Navbar() {
  const pathname = useRouter();
  const router = useRouter();
  const { user, signOut, handleLogout, isAuthenticated } = useSupabase();
  const profileContext = useProfile();
  const profile = profileContext?.profile;
  const getEffectiveAvatarUrl = profileContext?.getEffectiveAvatarUrl;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navLinks = getNavLinks(isAuthenticated);

  // Create a ref to track the last avatar refresh time
  const lastAvatarRefresh = useRef(Date.now());

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (profile && getEffectiveAvatarUrl) {
      // Only fetch a new avatar URL if it's been at least 30 seconds since last refresh
      // or if we don't have an avatar URL yet
      const now = Date.now();
      const shouldRefresh = !avatarUrl || avatarUrl === '/default-avatar.svg' || 
                            now - lastAvatarRefresh.current > 30000;
      
      if (shouldRefresh) {
        const loadAvatar = async () => {
          setAvatarLoading(true);
          try {
            
            const url = await getEffectiveAvatarUrl();
            
            // Only update if we got a valid URL that's different from current
            if (url && url !== avatarUrl) {
              
              setAvatarUrl(url);
              lastAvatarRefresh.current = now;
            } 
          } catch (error) {
            console.error('Error loading avatar:', error);
            setAvatarUrl('/default-avatar.svg');
          } finally {
            setAvatarLoading(false);
          }
        };
        loadAvatar();
      } 
    }
  }, [profile, getEffectiveAvatarUrl]);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Handler for home navigation based on authentication status
  const handleHomeNavigation = (e) => {
    e.preventDefault();
    closeMenu();
    
    if (isAuthenticated) {
      
      router.push('/home');
    } else {
      
      router.push('/landing');
    }
  };

  // Handler for logout - use the provider's handleLogout instead
  const logoutHandler = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      closeMenu();
      await handleLogout(); // Use handleLogout from SupabaseProvider
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // No rendering at all on server-side
  if (!mounted) {
    return null;
  }

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`} suppressHydrationWarning>
      <div className={styles.container}>
        <Link href={isAuthenticated ? '/home' : '/landing'} className={styles.logo} onClick={closeMenu} style={{ textDecoration: 'none' }}>
          <div className={styles.logoWrapper}>
            <img 
              src="/favicon_io/android-chrome-192x192.png" 
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
            <li className={styles.navItem}>
              <a 
                href="#" 
                className={pathname === (isAuthenticated ? '/home' : '/landing') ? `${styles.navLink} ${styles.active}` : styles.navLink}
                onClick={handleHomeNavigation}
                style={{ textDecoration: 'none' }}
              >
                Home
              </a>
            </li>
            
            {navLinks.slice(1).map(link => (
              <li key={link.href} className={styles.navItem}>
                <Link 
                  href={link.href} 
                  className={pathname === link.href ? `${styles.navLink} ${styles.active}` : styles.navLink}
                  onClick={closeMenu}
                  style={{ textDecoration: 'none' }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <ModeToggle />

            {isAuthenticated ? (
              <>
                <div className={styles.userMenu}>
                  <Link href="/profile" className={styles.profileLink} style={{ textDecoration: 'none' }} onClick={closeMenu}>
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
                    <span className={styles.profileText}>Profile</span>
                  </Link>
                </div>
                
                <button 
                  className={styles.logoutButton} 
                  onClick={logoutHandler}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </>
            ) : (
              <Link href="/login" className={styles.signInButton} style={{ textDecoration: 'none' }} onClick={closeMenu}>
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}