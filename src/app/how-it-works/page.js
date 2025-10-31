'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/styles/how-it-works.module.css';

export default function HowItWorksPage() {
  const [activeVideo, setActiveVideo] = useState(null);

  const sections = [
    {
      id: 'dashboard',
      title: 'Your Dashboard',
      description: 'Track your trading performance with comprehensive analytics. Monitor your total posts, success rate, losses, and experience score all in one place.',
      image: '/how work it/bandicam 2025-10-31 14-25-24-137.jpg',
      highlights: [
        'View total posts created',
        'Track successful trades',
        'Monitor losses and success rate',
        'Build your experience score'
      ]
    },
    {
      id: 'create-post',
      title: 'Create Trading Posts',
      description: 'Share your stock analysis with the community. Add stock symbols, target prices, stop loss, and upload images to support your analysis.',
      video: '/how work it/create post v.mp4',
      image: '/how work it/bandicam 2025-10-31 14-25-24-137.jpg',
      highlights: [
        'Select stocks from multiple exchanges',
        'Set target and stop loss prices',
        'Upload analysis images',
        'Share with community instantly'
      ]
    },
    {
      id: 'check-prices',
      title: 'Check Post Prices',
      description: 'Automatically check current stock prices and update post status. The system uses reliable financial data APIs to fetch the latest market prices and intelligently marks posts as "Target Reached" or "Stop Loss Triggered" based on your predictions.',
      image: '/how work it/bandicam 2025-10-31 14-25-09-509.jpg',
      video: '/how work it/check post v.mp4',
      highlights: [
        'Fetch latest stock prices automatically',
        'Smart post status updates',
        'Track target price achievement',
        'Monitor stop loss triggers',
        'Powered by professional market data'
      ]
    },
    {
      id: 'success-rate',
      title: 'Success Rate Calculation',
      description: 'Understand how your success rate is calculated. It measures the percentage of your posts that successfully reached their target price.',
      image: '/how work it/bandicam 2025-10-31 14-25-38-186.jpg',
      formula: '(Successful Posts / Total Closed Posts) × 100',
      example: 'If you have 10 successful posts and 5 loss posts, your success rate = (10 / 15) × 100 = 66.67%',
      highlights: [
        'Percentage of successful trades',
        'Based on closed posts only',
        'Helps track trading efficiency',
        'Compare with other traders'
      ]
    },
    {
      id: 'experience-score',
      title: 'Experience Score',
      description: 'Your experience score reflects your overall trading performance and wisdom. It\'s calculated by subtracting losses from successful trades.',
      image: '/how work it/bandicam 2025-10-31 14-25-47-341.jpg',
      formula: 'Successful Posts - Loss Posts',
      example: 'If you have 10 successful posts and 5 loss posts, your experience score = 10 - 5 = 5',
      highlights: [
        'Cumulative performance metric',
        'Higher score = better performance',
        'Indicates trading consistency',
        'Ranks you among traders'
      ]
    },
    {
      id: 'traders',
      title: 'Connect with Traders',
      description: 'Browse and follow successful traders in the community. Filter by experience level, country, and Telegram bot integration.',
      image: '/how work it/screencapture-sharkszone-traders-2025-10-31-14_26_47.png',
      highlights: [
        'View top traders rankings',
        'Filter by experience & country',
        'Follow traders you trust',
        'Subscribe to Telegram notifications'
      ]
    },
    {
      id: 'profile',
      title: 'Trader Profiles',
      description: 'View detailed trader profiles with their statistics, recent posts, and trading strategies. Follow traders and subscribe to their Telegram updates.',
      image: '/how work it/screencapture-sharkszone-view-profile-b55cdf83-2906-43ae-b16d-3e508f4c3358-2025-10-31-14_27_19.png',
      highlights: [
        'Detailed trader statistics',
        'View all trader posts',
        'Social media links',
        'Telegram bot subscription'
      ]
    },
    {
      id: 'analysis-charts',
      title: 'Analysis Tab & Performance Charts',
      description: 'Visualize your trading data with comprehensive analytics dashboard. View 6 interactive charts including posts per month, success rate over time, posts by strategy, country distribution, sentiment analysis, and engagement metrics.',
      image: '/how work it/screencapture-localhost-3000-profile-2025-10-31-20_42_00.png',
      highlights: [
        'Interactive performance charts',
        'Posts per month visualization',
        'Success rate tracking over time',
        'Strategy and country breakdowns',
        'Sentiment analysis indicators',
        'Engagement metrics monitoring'
      ]
    },
    {
      id: 'custom-charts',
      title: 'Create Custom Charts',
      description: 'Build your own custom charts to analyze your trading data exactly how you want. Choose from multiple chart types (pie, bar, line) and data sources to create personalized visualizations that matter to you.',
      image: '/how work it/create custom chart.png',
      highlights: [
        'Multiple chart types (Pie, Bar, Line)',
        'Flexible data sources selection',
        'Real-time chart preview',
        'Customize chart names',
        'Analyze post status, strategies, and more',
        'Save and manage your custom charts'
      ]
    }
  ];

  const openVideo = (videoPath) => {
    setActiveVideo(videoPath);
  };

  const closeVideo = () => {
    setActiveVideo(null);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>
            How <span className={styles.titleHighlight}>SharksZone</span> Works
          </h1>
          <p className={styles.subtitle}>
            Learn how to use our platform to share trading ideas, track performance, and connect with successful traders
          </p>
          <Link href="/login" className={styles.ctaButton}>
            Get Started Now
          </Link>
        </div>
      </header>

      {/* Sections */}
      <main className={styles.main}>
        {sections.map((section, index) => (
          <section 
            key={section.id} 
            className={`${styles.section} ${index % 2 === 1 ? styles.sectionReverse : ''}`}
            id={section.id}
          >
            <div className={styles.sectionContent}>
              <div className={styles.textContent}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <p className={styles.sectionDescription}>{section.description}</p>
                
                {section.formula && (
                  <div className={styles.formula}>
                    <strong>Formula:</strong> <code>{section.formula}</code>
                  </div>
                )}
                
                {section.example && (
                  <div className={styles.example}>
                    <strong>Example:</strong> {section.example}
                  </div>
                )}
                
                {section.highlights && (
                  <ul className={styles.highlights}>
                    {section.highlights.map((highlight, i) => (
                      <li key={i}>
                        <span className={styles.checkmark}>✓</span>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                )}

                {section.video && (
                  <button 
                    className={styles.playButton}
                    onClick={() => openVideo(section.video)}
                  >
                    🎬 Watch Video Demo
                  </button>
                )}
              </div>

              <div className={styles.mediaContent}>
                <div className={styles.imageWrapper}>
                  <img 
                    src={section.image} 
                    alt={section.title}
                    className={styles.sectionImage}
                  />
                  {section.video && (
                    <div 
                      className={styles.playOverlay}
                      onClick={() => openVideo(section.video)}
                    >
                      <div className={styles.playIcon}>▶</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}
      </main>

      {/* Video Modal */}
      {activeVideo && (
        <div className={styles.videoModal} onClick={closeVideo}>
          <div className={styles.videoModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={closeVideo}>
              ✕
            </button>
            <video 
              src={activeVideo}
              controls
              autoPlay
              className={styles.modalVideo}
            >
              Your browser does not support video playback.
            </video>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <section className={styles.footerCta}>
        <h2 className={styles.footerTitle}>Ready to Start Trading?</h2>
        <p className={styles.footerText}>
          Join SharksZone today and connect with successful traders worldwide
        </p>
        <Link href="/login" className={styles.ctaButton}>
          Sign Up Now
        </Link>
      </section>
    </div>
  );
}
