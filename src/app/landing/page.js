'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/providers/theme-provider';
import styles from '@/styles/landing.module.css';
import Footer from "@/components/Footer";

export default function LandingPage() {
  const [visible, setVisible] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [hoverButton, setHoverButton] = useState(null);
  const router = useRouter();
  const { theme } = useTheme();

  const handleScroll = () => {
    setScrollPosition(window.scrollY);
  };
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const login = () => {
    setVisible(false);
    setTimeout(() => {
      router.push('/login');
    }, 300);
  };

  const handleButtonHover = (id) => {
    setHoverButton(id);
    setTimeout(() => setHoverButton(null), 500);
  };

  const features = [
    {
      id: 1,
      title: "Market Analytics",
      description: "Real-time data insights",
      icon: "📈"
    },
    {
      id: 2,
      title: "Stock Analysis",
      description: "Precise trade targets",
      icon: "📊"
    },
    {
      id: 3,
      title: "Portfolio Tracking",
      description: "Performance metrics",
      icon: "💼"
    },
    {
      id: 4,
      title: "Price Alerts",
      description: "Instant notifications",
      icon: "📱"
    },
    {
      id: 5,
      title: "Documentation",
      description: "Extensive resources",
      icon: "📝"
    }
  ];


  return (
    <div className={`${styles.landingPage} ${visible ? 'auth-fade-in' : 'auth-fade-out'} ${theme}`}>
      <div className={styles.stackContainer}>
        <section 
          className={styles.heroSection} 
          style={{
            transform: `translateY(${Math.max(-800, scrollPosition * -3)}px)`,
            opacity: Math.max(0, 1 - scrollPosition / 1000) 
          }}
        >
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              FireStocks Trading Platform
            </h1>
            <p className={styles.heroSubtitle}>
              Powerful tools for investors to track, analyze, and optimize portfolios
            </p>
            
            <div className={styles.featureCards}>
              {features.map((feature) => (
                <div key={feature.id} className={styles.featureCard}>
                  <div className={styles.featureIcon}>{feature.icon}</div>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureDescription}>{feature.description}</p>
                </div>
              ))}
            </div>
            
            <div className={styles.heroCta}>
              <button 
                className={`${styles.primaryButton} ${hoverButton === 'signup' ? styles.pulse : ''}`}
                onMouseEnter={() => handleButtonHover('signup')}
                onClick={login}
              >
                Sign Up
              </button>
            </div>
          </div>
        </section>
      </div>
      <div className={styles.footerContainer}>
        <Footer />
      </div>
    </div>
  );
}