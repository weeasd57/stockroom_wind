'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/providers/theme-provider';
import Image from 'next/image';
import styles from '@/styles/landing.module.css';
import Footer from "@/components/Footer";

export default function LandingPage() {
  const [visible, setVisible] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [hoverButton, setHoverButton] = useState(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

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
  
  const features = [
    {
      id: 1,
      title: "Market Analytics",
      description: "Real-time data insights for informed trading decisions with comprehensive market coverage",
      icon: "📈",
    },
    {
      id: 2,
      title: "Stock Analysis",
      description: "Precise trade targets based on advanced algorithms and technical indicators",
      icon: "📊",
    },
    {
      id: 3,
      title: "Portfolio Tracking",
      description: "Track performance metrics across your investments with detailed reporting",
      icon: "💼",
    },
    {
      id: 4,
      title: "Price Alerts",
      description: "Instant notifications for critical price movements and market events",
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
    setHoverButton(id);
    setTimeout(() => setHoverButton(null), 500);
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };
  
  return (
    <div className={`${styles.variables} ${visible ? 'auth-fade-in' : 'auth-fade-out'}`}>
      <div className={styles.pageWrapper}>
        {/* Bubbles */}
        <div className={`${styles.bubble} ${styles.bubble1}`}></div>
        <div className={`${styles.bubble} ${styles.bubble2}`}></div>
        <div className={`${styles.bubble} ${styles.bubble3}`}></div>
        
        {/* Main Card */}
        <div className={styles.cardContainer}>
          
          
          {/* Hero Section */}
          <div className={styles.heroContent}>
            <h1 className={styles.title}>
              <span>FireStocks</span> Trading Platform
            </h1>
            <p className={styles.subtitle}>
              Powerful tools for investors to track, analyze, and optimize portfolios with real-time market data and social insights
            </p>
            
            <div className={styles.heroButtons}>
              <button 
                className={styles.primaryButton}
                onMouseEnter={() => handleButtonHover('signup')}
                onClick={login}
              >
                Get Started
              </button>
              <button 
                className={styles.secondaryButton}
                onClick={() => router.push('/login')}
              >
                Learn More
              </button>
            </div>
            
            {/* Features Section */}
            <div className={styles.features}>
              {features.map((feature) => (
                <div 
                  key={feature.id} 
                  className={styles.card}
                >
                  <div className={styles.cardIcon}>{feature.icon}</div>
                  <h3 className={styles.cardTitle}>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
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