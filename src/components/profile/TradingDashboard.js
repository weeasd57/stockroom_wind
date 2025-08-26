'use client';

import { useState, useEffect } from 'react';
import CheckPostPricesButton from './CheckPostPricesButton';
import RealTimePriceUpdates from './RealTimePriceUpdates';
import { getCurrentUser } from '@/utils/supabase';
import styles from '@/styles/TradingDashboard.module.css';

export default function TradingDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}>Loading your trading dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.errorContainer}>
        <h2>Authentication Required</h2>
        <p>Please sign in to view your trading dashboard.</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Dashboard Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Trading Dashboard</h1>
          <p>Real-time portfolio monitoring and price checking</p>
        </div>
        
        {/* Price Check Button - Always visible */}
        <div className={styles.priceCheckSection}>
          <CheckPostPricesButton userId={user.id} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabNavigation}>
        <button 
          className={`${styles.tab} ${activeTab === 'dashboard' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'realtime' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('realtime')}
        >
          📈 Real-Time Updates
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'help' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('help')}
        >
          ❓ Help
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'dashboard' && (
          <div className={styles.dashboardContent}>
            <div className={styles.welcomeSection}>
              <h2>Welcome to Your Trading Dashboard</h2>
              <p>Monitor your trading posts in real-time and keep track of your portfolio performance.</p>
            </div>

            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🎯</div>
                <h3>Price Monitoring</h3>
                <p>Automatically check if your target prices or stop-loss levels have been reached</p>
              </div>
              
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>⚡</div>
                <h3>Real-Time Updates</h3>
                <p>Get instant updates when your posts are modified without refreshing the page</p>
              </div>
              
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>📊</div>
                <h3>Organized Display</h3>
                <p>View your posts grouped by exchange, status, or trading strategy</p>
              </div>
              
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>🔄</div>
                <h3>Auto-Refresh</h3>
                <p>Set automatic refresh intervals to keep your data current</p>
              </div>
            </div>

            <div className={styles.quickActions}>
              <h3>Quick Actions</h3>
              <div className={styles.actionButtons}>
                <button 
                  className={styles.actionButton}
                  onClick={() => setActiveTab('realtime')}
                >
                  View Real-Time Updates
                </button>
                <button 
                  className={styles.actionButton}
                  onClick={() => window.location.href = '/create-post'}
                >
                  Create New Post
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'realtime' && (
          <div className={styles.realtimeContent}>
            <RealTimePriceUpdates userId={user.id} />
          </div>
        )}

        {activeTab === 'help' && (
          <div className={styles.helpContent}>
            <h2>How to Use Your Trading Dashboard</h2>
            
            <div className={styles.helpSection}>
              <h3>🚀 Getting Started</h3>
              <ol>
                <li><strong>Create Trading Posts:</strong> Add posts with your stock picks, target prices, and stop-loss levels</li>
                <li><strong>Check Prices:</strong> Use the "Check Post Prices" button to update all your positions</li>
                <li><strong>Monitor Real-Time:</strong> Switch to the Real-Time Updates tab to see live data</li>
                <li><strong>Organize Your View:</strong> Group posts by exchange, status, or strategy</li>
              </ol>
            </div>

            <div className={styles.helpSection}>
              <h3>📊 Understanding the Display</h3>
              <ul>
                <li><strong>🎯 Target Reached:</strong> Green indicator - your target price was hit</li>
                <li><strong>🛑 Stop Loss Triggered:</strong> Red indicator - your stop-loss was triggered</li>
                <li><strong>📈 Active:</strong> Blue indicator - position is still open</li>
                <li><strong>📝 Closed:</strong> Gray indicator - position has been closed</li>
              </ul>
            </div>

            <div className={styles.helpSection}>
              <h3>⚙️ Features</h3>
              <ul>
                <li><strong>Auto-Refresh:</strong> Enable automatic data updates every 10s, 30s, 1m, or 5m</li>
                <li><strong>Real-Time Subscriptions:</strong> Get instant updates when data changes</li>
                <li><strong>Price Change Indicators:</strong> See percentage changes with up/down arrows</li>
                <li><strong>Last Checked Times:</strong> Know when prices were last updated</li>
                <li><strong>Achievement Badges:</strong> See when targets or stop-losses were reached</li>
              </ul>
            </div>

            <div className={styles.helpSection}>
              <h3>🔧 Troubleshooting</h3>
              <div className={styles.troubleshootingGrid}>
                <div className={styles.troubleshootingItem}>
                  <strong>No data showing?</strong>
                  <p>Make sure you have created some trading posts first</p>
                </div>
                <div className={styles.troubleshootingItem}>
                  <strong>Price check not working?</strong>
                  <p>Check that your API keys are configured properly</p>
                </div>
                <div className={styles.troubleshootingItem}>
                  <strong>Real-time updates not working?</strong>
                  <p>Refresh the page and check your internet connection</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}