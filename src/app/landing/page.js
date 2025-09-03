'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/providers/theme-provider';
import dynamic from 'next/dynamic';
import styles from '@/styles/landing.module.css';

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

  // Optimize scroll listener with useCallback and requestAnimationFrame
  const [scrollPosition, setScrollPosition] = useState(0);
  
  const handleScroll = useCallback(() => {
    // Use requestAnimationFrame to limit scroll updates
    window.requestAnimationFrame(() => {
      setScrollPosition(window.scrollY);
    });
  }, []);
  
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
      title: 'Broker Ranking Engine',
      description:
        'Continuously ranks brokers by execution quality, fees, reliability, and slippage to route actions to the best option.',
      icon: '🏆',
    },
    {
      id: 2,
      title: 'Auto Buy Bot (Signals)',
      description:
        'Automation-ready buy signals on successful posts, with safe guardrails for losing signals to minimize risk.',
      icon: '🤖',
    },
    {
      id: 3,
      title: 'Signal Trust Score',
      description:
        'Weights author track record and post performance to prioritize higher-confidence ideas for the bot.',
      icon: '⭐',
    },
    {
      id: 4,
      title: 'Risk Controls & Limits',
      description:
        'Configurable max allocation, cool-downs, and stop-loss/take-profit presets to protect capital.',
      icon: '🛡️',
    },
    {
      id: 5,
      title: 'Multi‑Broker Fallback',
      description:
        'Supports multiple brokers with health checks and automatic failover when a provider is degraded.',
      icon: '🔗',
    },
    {
      id: 6,
      title: 'Transparent Logs & Alerts',
      description:
        'Full audit trail with notifications for executed actions, rejects, and risk breaches.',
      icon: '📜',
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
              Everything you need to research stocks, share ideas, and act fast — live data, community sentiment, alerts, and portfolio tracking in one place.
            </p>
            
            <div className={styles.heroButtons}>
              <button 
                className={styles.primaryButton}
                onClick={login}
              >
                Get Started
              </button>
              
            </div>
            
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
          </div>
          
          {/* Footer */}
          <div className={styles.footer}>
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}