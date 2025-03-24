'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from '@/styles/landing.module.css';

export default function LandingPage() {
  const [visible, setVisible] = useState(false);
  const [hoverButton, setHoverButton] = useState(null);
  
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const statsRef = useRef(null);

  useEffect(() => {
    setVisible(true);
    
    // Setup intersection observer for animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.animate);
          }
        });
      },
      { threshold: 0.2 }
    );
    
    // Observe all sections
    const sections = [heroRef.current, featuresRef.current, statsRef.current];
    sections.forEach(section => {
      if (section) observer.observe(section);
    });
    
    return () => {
      sections.forEach(section => {
        if (section) observer.unobserve(section);
      });
    };
  }, []);
  
  const handleButtonHover = (id) => {
    setHoverButton(id);
    setTimeout(() => setHoverButton(null), 500);
  };

  const features = [
    {
      id: 1,
      title: "Market Analytics",
      description: "Access real-time market data and powerful analytics tools to make informed decisions."
    },
    {
      id: 2,
      title: "Stock Analysis",
      description: "Share stock picks with target price and stop loss levels. Track performance metrics automatically."
    },
    {
      id: 3,
      title: "Portfolio Management",
      description: "Track your investments and analyze your performance with advanced portfolio tools."
    },
    {
      id: 4,
      title: "Performance Tracking",
      description: "Set up target prices and stop loss levels. Our system tracks if stocks hit targets or stop losses."
    },
  ];

  return (
    <div className={styles.landingPage}>
     
      
      <section className={`${styles.heroSection} ${styles.fadeSection}`} ref={heroRef}>
        <div className={styles.heroContent}>
          <h1 className={`${styles.heroTitle} ${styles.slideInLeft}`}>
            Real-time Stock Analysis and Portfolio Management
          </h1>
          <p className={`${styles.heroSubtitle} ${styles.slideInRight}`}>
            Powerful tools for investors to track, analyze, and optimize their portfolios with market-beating strategies.
          </p>
          <div className={styles.heroCta}>
            <button 
              className={`${styles.primaryButton} ${hoverButton === 'signup' ? styles.pulse : ''}`}
              onMouseEnter={() => handleButtonHover('signup')}
            >
              Sign Up
            </button>
          </div>
        </div>
        <div className={`${styles.heroImage} ${styles.slideInUp}`}>
          {/* Hero Image */}
          <div className={styles.mockup}>
            <Image 
              src="/favicon.ico" 
              alt="FireStocks Logo" 
              width={128} 
              height={128}
              className={styles.faviconImage}
            />
          </div>
        </div>
      </section>

      <section className={`${styles.featuresSection} ${styles.fadeSection}`} ref={featuresRef}>
        <h2 className={styles.sectionTitle}>Platform Features</h2>
        <div className={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div key={index} className={`${styles.featureCard} ${styles.fadeIn}`}>
              <div className={styles.featureIcon}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="40" height="40" rx="8" fill="currentColor" fillOpacity="0.1" />
                  <path d="M20 10L26 16M20 10L14 16M20 10V24M30 20L24 26M30 20L24 14M30 20H16M10 20L16 26M10 20L16 14M10 20H24M20 30L26 24M20 30L14 24M20 30V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.statsSection} ${styles.fadeSection}`} ref={statsRef}>
        <div className={styles.statsContainer}>
          <div className={`${styles.statCard} ${styles.slideInLeft}`}>
            <h3>50K+</h3>
            <p>Active Users</p>
          </div>
          <div className={`${styles.statCard} ${styles.slideInUp}`}>
            <h3>$500M+</h3>
            <p>Portfolio Value Managed</p>
          </div>
          <div className={`${styles.statCard} ${styles.slideInRight}`}>
            <h3>98%</h3>
            <p>Satisfaction Rate</p>
          </div>
        </div>
      </section>
    </div>
  );
} 