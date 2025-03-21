'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '@/styles/landing.module.css';

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    setIsVisible(true);
  }, []);

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

  const pricingPlans = [
    {
      id: 1,
      name: "Basic",
      price: "Free",
      features: [
        "Market data access",
        "Basic stock analysis",
        "Community forum access",
        "Limited portfolio tracking",
      ],
      cta: "Sign Up Free",
      popular: false,
    },
    {
      id: 2,
      name: "Pro",
      price: "$19.99",
      period: "monthly",
      features: [
        "All Basic features",
        "Advanced technical analysis",
        "Real-time alerts",
        "Unlimited portfolio tracking",
        "Priority support",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      id: 3,
      name: "Enterprise",
      price: "$49.99",
      period: "monthly",
      features: [
        "All Pro features",
        "API access",
        "Custom integrations",
        "Dedicated account manager",
        "Team collaboration tools",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <div className={`${styles.landingPage} ${isVisible ? styles.visible : ''}`}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Elevate Your <span className={styles.accent}>Stock Analysis</span> Experience
            </h1>
            <p className={styles.heroSubtitle}>
              Join FireStocks - the platform that helps you analyze stocks with target prices and stop losses. Automatically track performance metrics and success rates.
            </p>
            <div className={styles.heroCta}>
              <Link href="/signup" className={styles.primaryButton}>
                Get Started
              </Link>
              <Link href="/about" className={styles.secondaryButton}>
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Powerful Features</h2>
            <p className={styles.sectionSubtitle}>
              Everything you need to make informed investment decisions
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {features.map((feature) => (
              <div key={feature.id} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className={styles.statsSection}>
        <div className={styles.container}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>50K+</div>
              <div className={styles.statLabel}>Active Users</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>$2.5B+</div>
              <div className={styles.statLabel}>Analysis Volume</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>10K+</div>
              <div className={styles.statLabel}>Daily Insights</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>98%</div>
              <div className={styles.statLabel}>Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className={styles.pricingSection}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Flexible Pricing</h2>
            <p className={styles.sectionSubtitle}>
              Choose the plan that fits your analysis style
            </p>
          </div>
          <div className={styles.pricingGrid}>
            {pricingPlans.map((plan) => (
              <div 
                key={plan.id} 
                className={`${styles.pricingCard} ${plan.popular ? styles.popularPlan : ''}`}
              >
                {plan.popular && <div className={styles.popularBadge}>Most Popular</div>}
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.planPrice}>
                  <span className={styles.price}>{plan.price}</span>
                  {plan.period && <span className={styles.period}>/{plan.period}</span>}
                </div>
                <ul className={styles.planFeatures}>
                  {plan.features.map((feature, index) => (
                    <li key={index} className={styles.planFeature}>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className={styles.planCta}>
                  <Link 
                    href={plan.name === "Enterprise" ? "/contact" : "/signup"} 
                    className={`${styles.planButton} ${plan.popular ? styles.primaryButton : styles.outlineButton}`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Ready to Transform Your Stock Analysis?</h2>
            <p className={styles.ctaSubtitle}>
              Join FireStocks today and get access to powerful stock analysis tools with target prices and stop loss tracking.
            </p>
            <div className={styles.ctaButtons}>
              <Link href="/signup" className={styles.primaryButton}>
                Get Started Now
              </Link>
              <Link href="/demo" className={styles.outlineButton}>
                Request Demo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 