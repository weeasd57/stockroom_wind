'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/providers/theme-provider';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import dynamic from 'next/dynamic';
import styles from '@/styles/landing.module.css';
import { getCountrySymbolCounts } from '@/utils/symbolSearch';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';

// Lazy load the Footer component
const Footer = dynamic(() => import('@/components/Footer'), {
  loading: () => <div className={styles.footerPlaceholder}></div>,
  ssr: false
});

export default function LandingPage() {
  const [visible, setVisible] = useState(false);
  const [hoverButton, setHoverButton] = useState(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, loading } = useSupabase();
  const [countsLoading, setCountsLoading] = useState(true);
  const [counts, setCounts] = useState(null);
  const [displayedCount, setDisplayedCount] = useState(12); // Show 12 countries initially

  // Optimize scroll listener with useCallback and requestAnimationFrame
  const [scrollPosition, setScrollPosition] = useState(0);

  // Redirect authenticated users to home
  useEffect(() => {
    if (!loading && user) {
      router.replace('/home');
    }
  }, [user, loading, router]);

  const handleScroll = useCallback(() => {
    // Use requestAnimationFrame to limit scroll updates
    window.requestAnimationFrame(() => {
      setScrollPosition(window.scrollY);
    });
  }, []);

  // Load symbol counts by country for the showcase section
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getCountrySymbolCounts();
        if (!alive) return;
        setCounts(data || {});
      } catch (e) {
        // no-op; keep section hidden if fails
        setCounts(null);
      } finally {
        if (alive) setCountsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const allCountryItems = useMemo(() => {
    if (!counts) return [];
    return Object.entries(counts)
      .filter(([code]) => code !== 'all' && code !== 'total')
      .map(([code, cnt]) => ({
        code: String(code).toLowerCase(),
        name: COUNTRY_CODE_TO_NAME[String(code).toLowerCase()] || code.toUpperCase(),
        count: Number(cnt) || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [counts]);

  const countryItems = useMemo(() => {
    return allCountryItems.slice(0, displayedCount);
  }, [allCountryItems, displayedCount]);

  const totalSymbols = counts?.total || counts?.all || 0;

  useEffect(() => {
    // Add passive flag to improve scroll performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    // Force immediate visibility to prevent empty page after logout
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      id: 1,
      title: 'Stock Search & Global Coverage',
      description:
        'Search stocks across multiple countries and exchanges, with clear country coverage and symbol discovery built-in.',
      icon: '🔎',
    },
    {
      id: 2,
      title: 'Social Trading Posts',
      description:
        'Create structured trading ideas with symbols, targets, stop-loss levels, images, and clear bullish/bearish context.',
      icon: '📝',
    },
    {
      id: 3,
      title: 'Follow Traders & Discover Brokers',
      description:
        'Follow traders you trust, explore the Traders directory, and keep up with new posts from accounts you follow.',
      icon: '👥',
    },
    {
      id: 4,
      title: 'Community Interaction',
      description:
        'Engage with posts using buy/sell sentiment actions and comments, and track engagement across the platform.',
      icon: '💬',
    },
    {
      id: 5,
      title: 'Profile Analytics & Performance',
      description:
        'Analyze performance with charts, table view, calendar view, and export options for serious tracking and review.',
      icon: '📊',
    },
    {
      id: 6,
      title: 'Telegram Notifications',
      description:
        'Subscribe to trader updates and receive notifications directly in Telegram for important activity and broadcasts.',
      icon: '✈️',
    },

  ];

  const premiumFeatures = [
    {
      id: 1,
      title: 'Premium Broker Subscriptions',
      description:
        'Subscribe to professional brokers and access their exclusive premium trading signals, detailed analysis, and market insights.',
      icon: '💎',
    },
    {
      id: 2,
      title: 'Export to Excel & CSV',
      description:
        'Export your trading data, post history, and analysis to Excel format for advanced data analysis and record keeping.',
      icon: '📁',
    },
    {
      id: 3,
      title: 'Ad-Free Experience',
      description:
        'Enjoy a clean, distraction-free trading environment without any advertisements interrupting your workflow.',
      icon: '🚫',
    },
    {
      id: 4,
      title: 'Priority Support',
      description:
        'Get faster response times and dedicated support from our team to help you maximize your trading performance.',
      icon: '🎯',
    },
  ];

  const login = () => {
    setVisible(false);
    setTimeout(() => {
      router.push('/login');
    }, 300);
  };

  const handleButtonHover = (id) => {
    // Only apply hover effects on non-mobile devices
    if (window.innerWidth > 768) {
      setHoverButton(id);
      setTimeout(() => setHoverButton(null), 500);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleLoadMore = () => {
    setDisplayedCount(prev => prev + 12); // Load 12 more countries
  };

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <div className="auth-loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render landing page if user is authenticated (redirect in progress)
  if (user) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <div className="auth-loading-spinner"></div>
          <p>Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.variables} style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}>
      <div className={styles.pageWrapper}>
        {/* Reduce the number of bubbles on mobile */}
        <div className={`${styles.bubble} ${styles.bubble1} ${styles.desktopOnly}`}></div>
        <div className={`${styles.bubble} ${styles.bubble2}`}></div>
        <div className={`${styles.bubble} ${styles.bubble3} ${styles.desktopOnly}`}></div>

        {/* Floating theme toggle */}
        <div className={styles.floatToggle}>
          <button
            aria-label="Toggle theme"
            className={styles.themeToggleBtn}
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>

        {/* Main Card */}
        <div className={styles.cardContainer}>

          {/* Hero Section */}
          <div className={styles.heroContent}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className={styles.logobackground}>
                <img
                  src="/favicon_io/android-chrome-512x512.png"
                  alt="SharksZone Logo"
                  className={styles.heroLogo}
                  style={{ borderRadius: 16 }}
                />
              </div>
              <h1 className={styles.title} style={{ margin: '0.75rem 0 0' }}>
                <span className={styles.brandSharks}>Sharks</span>Zone — Stock Analysis & Social Trading
              </h1>
            </div>
            <p className={styles.subtitle}>
              A social trading platform where traders can share stock ideas, connect with other investors, and build a community around trading insights. Share your analysis, follow successful traders, and discuss market opportunities in real-time.
            </p>

            <div className={styles.heroButtons}>
              <button
                className={styles.primaryButton}
                onClick={login}
              >
                Get Started
                <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Earn cycle section */}
            <section className={styles.earnCycleSection} aria-label="How SharksZone works">
              <h2 className={styles.earnCycleTitle}>How SharksZone helps you earn</h2>
              <p className={styles.earnCycleSubtitle}>
                Turn your daily trading analysis into a recurring subscription business.
              </p>
              <div className={styles.earnCycleGrid}>
                <article className={styles.earnStepCard}>
                  <h3 className={styles.earnStepHeading}>Broker&apos;s desk</h3>
                  <p className={styles.earnStepBody}>
                    Share structured stock analysis and trading signals with your community.
                  </p>
                </article>
                <article className={styles.earnStepCard}>
                  <h3 className={styles.earnStepHeading}>Premium channel</h3>
                  <p className={styles.earnStepBody}>
                    Deliver instant alerts through SharksZone and Telegram.
                  </p>
                </article>
                <article className={styles.earnStepCard}>
                  <h3 className={styles.earnStepHeading}>Earn from users</h3>
                  <p className={styles.earnStepBody}>
                    Charge recurring subscriptions while we handle user management and access.
                  </p>
                </article>
              </div>
              <div className={styles.earnCycleFooter}>
                <span className={styles.earnFooterLabel}>
                  User management &amp; payments powered by SharksZone
                </span>
                <span className={styles.earnFooterIcons} aria-hidden="true">
                  👤 💳
                </span>
              </div>
            </section>

            {/* Core Features Grid */}
            <section className={styles.features} aria-label="Core features">
              {features.map((f) => (
                <article key={f.id} className={styles.card}>
                  <div className={styles.cardIcon}>{f.icon}</div>
                  <h3 className={styles.cardTitle}>{f.title}</h3>
                  <p>{f.description}</p>
                </article>
              ))}
            </section>

            {/* Premium Features Section */}
            <section className={styles.premiumSection} aria-label="Premium features">
              <div className={styles.premiumHeader}>
                <h2 className={styles.premiumTitle}>
                  <span className={styles.premiumBadge}>💎 PREMIUM</span>
                  Unlock Advanced Features
                </h2>
                <p className={styles.premiumSubtitle}>
                  Take your trading to the next level with premium features designed for serious traders
                </p>
              </div>
              <div className={styles.premiumGrid}>
                {premiumFeatures.map((f) => (
                  <article key={f.id} className={styles.premiumCard}>
                    <div className={styles.premiumCardIcon}>{f.icon}</div>
                    <h3 className={styles.premiumCardTitle}>{f.title}</h3>
                    <p>{f.description}</p>
                  </article>
                ))}
              </div>
              <div className={styles.premiumCta}>
                <button
                  className={styles.premiumButton}
                  onClick={() => router.push('/pricing')}
                >
                  View Premium Plans
                </button>
              </div>
            </section>
          </div>

          {/* Footer */}
          {/* Symbols by Country Section */}
          <section className={styles.countrySection} aria-label="Symbols per country">
            <h2 className={styles.featuresTitle}>Symbols by Country</h2>
            {countsLoading ? (
              <div className={styles.countryLoading}>Loading coverage...</div>
            ) : countryItems.length === 0 ? (
              <div className={styles.countryEmpty}>No country coverage available.</div>
            ) : (
              <>
                {totalSymbols > 0 && (
                  <div className={styles.countryTotal} title="Total symbols across all countries">
                    <span className={styles.totalLabel}>Total Symbols</span>
                    <span className={styles.totalCount}>{totalSymbols.toLocaleString()}</span>
                  </div>
                )}
                <div className={styles.countryGrid}>
                  {countryItems.map((c, index) => (
                    <div
                      className={styles.countryCard}
                      key={c.code}
                      style={{
                        '--flag-bg': `url('https://flagcdn.com/w320/${c.code}.png')`,
                        animationDelay: `${(index % 12) * 0.05}s`
                      }}
                    >
                      <div className={styles.countryHeader}>
                        <span className={`fi fi-${c.code} ${styles.flag}`} aria-hidden="true"></span>
                        <span className={styles.countryName}>{c.name}</span>
                      </div>
                      <div className={styles.countryCount} aria-label={`Symbols: ${c.count}`}>
                        {c.count.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {displayedCount < allCountryItems.length && (
                  <div className={styles.loadMoreContainer}>
                    <button
                      className={styles.loadMoreButton}
                      onClick={handleLoadMore}
                      aria-label={`Load ${Math.min(12, allCountryItems.length - displayedCount)} more countries`}
                    >
                      Load More Countries
                      <span className={styles.loadMoreCount}>
                        ({allCountryItems.length - displayedCount} remaining)
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <div className={styles.footer}>
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}