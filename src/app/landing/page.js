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
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  const features = [
    {
      id: 1,
      title: "Market Analytics",
      description: "Real-time data insights for informed trading decisions",
      icon: "📈",
    },
    {
      id: 2,
      title: "Stock Analysis",
      description: "Precise trade targets based on advanced algorithms",
      icon: "📊",
    },
    {
      id: 3,
      title: "Portfolio Tracking",
      description: "Track performance metrics across your investments",
      icon: "💼",
    },
    {
      id: 4,
      title: "Price Alerts",
      description: "Instant notifications for critical price movements",
      icon: "📱",
    }
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
    <div className={`${styles.variables} ${visible ? 'auth-fade-in' : 'auth-fade-out'}`}>
      <div className={styles.pageWrapper}>
        {/* Reduce the number of bubbles on mobile */}
        <div className={`${styles.bubble} ${styles.bubble1} ${styles.desktopOnly}`}></div>
        <div className={`${styles.bubble} ${styles.bubble2}`}></div>
        <div className={`${styles.bubble} ${styles.bubble3} ${styles.desktopOnly}`}></div>
        
        {/* Main Card */}
        <div className={styles.cardContainer}>
          
          {/* Hero Section */}
          <div className={styles.heroContent}>
            <h1 className={styles.title}>
              <span>FireStocks</span> Trading
            </h1>
            <p className={styles.subtitle}>
              Powerful tools to track, analyze, and optimize portfolios with real-time market data
            </p>
            
            <div className={styles.heroButtons}>
              <button 
                className={styles.primaryButton}
                onClick={login}
              >
                Get Started
              </button>
              
            </div>
            
            {/* Features Section - Simplified */}
            <div className={styles.featuresSimple}>
              <div className={styles.featuresList}>
                {features.map((feature) => (
                  <div key={feature.id} className={styles.featureItem}>
                    <div className={styles.featureIcon}>{feature.icon}</div>
                    <div className={styles.featureContent}>
                      <h3 className={styles.featureTitle}>{feature.title}</h3>
                      <p className={styles.featureDescription}>{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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