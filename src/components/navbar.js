'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { ModeToggle } from '@/components/mode-toggle';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import styles from '@/styles/navbar.module.css';

// Navigation configuration
const navigationConfig = {
  authenticated: [
    { href: '/home', label: 'Home'},
    { href: '/traders', label: 'Traders' },
    { href: '/pricing', label: 'Pricing' },
  ],
  unauthenticated: [
    { href: '/landing', label: 'Home' },
    { href: '/traders', label: 'Traders' },
    { href: '/pricing', label: 'Pricing' },
  ]
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut, handleLogout, isAuthenticated } = useSupabase();
  const profileContext = useProfile();
  const profile = profileContext?.profile;
  const getEffectiveAvatarUrl = profileContext?.getEffectiveAvatarUrl;

  // State management
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.svg');
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Refs
  const lastAvatarRefresh = useRef(Date.now());
  const unsubscribeRef = useRef(null);
  const navRef = useRef(null);

  // Get navigation links based on authentication status
  const navLinks = navigationConfig[isAuthenticated ? 'authenticated' : 'unauthenticated'];

  // Initialize component and set up scroll listener
  useEffect(() => {
    setMounted(true);
    
    // No scroll listener needed as per new requirement
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    // Subscribe to avatar changes from imageCacheManager
    if (typeof window !== 'undefined' && window.imageCacheManager && user) {
      const handleImageChange = (userId, imageType, newUrl) => {
        if (imageType === 'avatar' && userId === user.id) {
          setAvatarUrl(newUrl);
          lastAvatarRefresh.current = Date.now();
          setAvatarLoading(false);
        }
      };
      
      unsubscribeRef.current = window.imageCacheManager.subscribe(handleImageChange);
      
      const cachedAvatar = window.imageCacheManager.getAvatarUrl(user.id);
      if (cachedAvatar) {
        setAvatarUrl(cachedAvatar);
        setAvatarLoading(false);
      }
    }
    
    return () => {
      // No scroll listener to remove
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user]);

  // Handle avatar loading
  useEffect(() => {
    if (profile && getEffectiveAvatarUrl) {
      const now = Date.now();
      const shouldRefresh = !avatarUrl || 
                          avatarUrl === '/default-avatar.svg' || 
                          now - lastAvatarRefresh.current > 30000;
      
      if (shouldRefresh) {
        const loadAvatar = async () => {
          setAvatarLoading(true);
          try {
            const url = await getEffectiveAvatarUrl();
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
  }, [profile, getEffectiveAvatarUrl, avatarUrl]);

  // Menu handlers
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Navigation handlers
  const handleHomeNavigation = (e) => {
    e.preventDefault();
    closeMenu();
    const targetPath = isAuthenticated ? '/home' : '/landing';
    router.push(targetPath);
  };

  const handleNavigation = (href) => {
    closeMenu();
    router.push(href);
  };

  // Logout handler
  const handleLogoutClick = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      closeMenu();
      await handleLogout();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Don't render on server-side
  if (!mounted) {
    return null;
  }

  return (
    <header 
      ref={navRef}
      className={styles.navbar} 
      suppressHydrationWarning
    >
      <div className={styles.container}>
        {/* Logo */}
        <Link 
          href={isAuthenticated ? '/home' : '/landing'} 
          className={styles.logo}
          onClick={closeMenu}
        >
          <div className={styles.logoWrapper}>
            <img 
              src="/logo.svg" 
              alt="SharksZone Logo" 
              width={40}
              height={40}
              className={styles.logoImage}
            />
            <span className={styles.logoText}>
              <span className="gradient-text" style={{ fontSize: '1.75rem' }}>Sharks</span>Zone
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <ul className={styles.navList}>
            {navLinks.map((link, index) => (
              <li key={link.href} className={styles.navItem}>
                <Link 
                  href={link.href}
                  className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
                >
                  <span className={styles.navIcon} aria-hidden="true">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop Actions */}
        <div className={styles.desktopActions}>
          <ModeToggle />
          
          {isAuthenticated ? (
            <div className={styles.userSection}>
              <Link href="/profile" className={styles.profileButton}>
                <div className={styles.avatarWrapper}>
                  {avatarLoading ? (
                    <div className={styles.avatarSkeleton}>
                      <span className={styles.avatarFallback}>
                        {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  ) : (
                    <Avatar className={styles.avatar}>
                      <AvatarImage 
                        src={avatarUrl} 
                        alt={`${profile?.username || 'User'}'s Avatar`}
                        onError={(e) => {
                          console.error('Error loading navbar avatar image');
                          e.target.src = '/default-avatar.svg';
                        }}
                      />
                      <AvatarFallback>
                        {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <span className={styles.profileText}>Profile</span>
              </Link>
              
              <button 
                className={styles.logoutButton} 
                onClick={handleLogoutClick}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true"></span>
                    Logging out...
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">👋</span>
                    Logout
                  </>
                )}
              </button>
            </div>
          ) : (
            <Link href="/login" className={styles.signInButton}>
              <span aria-hidden="true">🚀</span>
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className={styles.mobileMenuToggle}
          onClick={toggleMenu}
          aria-label="Toggle mobile menu"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
        >
          <div className={`${styles.menuToggle} ${isMenuOpen ? styles.open : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
      </div>

      {/* Mobile Menu */}
      <div 
        id="mobile-menu"
        className={`${styles.mobileMenu} ${isMenuOpen ? styles.open : ''}`}
        aria-hidden={!isMenuOpen}
      >
        <div className={styles.mobileMenuContent}>
          <nav className={styles.mobileNav} aria-label="Mobile navigation">
            <ul className={styles.mobileNavList}>
              {navLinks.map((link, index) => (
                <li key={link.href} className={styles.mobileNavItem} style={{ animationDelay: `${index * 100}ms` }}>
                  <button 
                    onClick={() => handleNavigation(link.href)}
                    className={`${styles.mobileNavLink} ${pathname === link.href ? styles.active : ''}`}
                  >
                    <span className={styles.navIcon} aria-hidden="true">
                      {link.icon}
                    </span>
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className={styles.mobileActions}>
              <div className={styles.mobileThemeToggle}>
                <ModeToggle />
              </div>

              {isAuthenticated ? (
                <div className={styles.mobileUserSection}>
                  <button 
                    onClick={() => handleNavigation('/profile')}
                    className={styles.mobileProfileButton}
                  >
                    <div className={styles.avatarWrapper}>
                      {avatarLoading ? (
                        <div className={styles.avatarSkeleton}>
                          <span className={styles.avatarFallback}>
                            {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                      ) : (
                        <Avatar className={styles.avatar}>
                          <AvatarImage 
                            src={avatarUrl} 
                            alt={`${profile?.username || 'User'}'s Avatar`} 
                            onError={(e) => {
                              console.error('Error loading mobile navbar avatar image');
                              e.target.src = '/default-avatar.svg';
                            }}
                          />
                          <AvatarFallback>
                            {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <span>View Profile</span>
                  </button>
                  
                  <button 
                    className={styles.mobileLogoutButton} 
                    onClick={handleLogoutClick}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <>
                        <span className={styles.spinner} aria-hidden="true"></span>
                        Logging out...
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">👋</span>
                        Logout
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleNavigation('/login')}
                  className={styles.mobileSignInButton}
                >
                  <span aria-hidden="true">🚀</span>
                  Sign In
                </button>
              )}
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {/* {isMenuOpen && (
        <div 
          className={styles.mobileOverlay}
          onClick={closeMenu}
          aria-hidden="true"
        />
      )} */}
    </header>
  );
}