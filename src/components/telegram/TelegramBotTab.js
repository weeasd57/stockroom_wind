'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useTheme } from '@/providers/theme-provider';
import styles from '@/styles/TelegramBot.module.css';
import TelegramBotManagement from './TelegramBotManagement';

export default function TelegramBotTab({ userId, isPro }) {
  const { supabase } = useSupabase();
  const { theme } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState('management'); // 'management' | 'subscribers'
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'premium', 'free'
  const [stats, setStats] = useState({
    total: 0,
    premium: 0,
    free: 0
  });

  useEffect(() => {
    if (isPro && userId && activeSubTab === 'subscribers') {
      fetchSubscribers();
    } else {
      setLoading(false);
    }
  }, [isPro, userId, filter, activeSubTab]);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('telegram_subscribers_with_subscription')
        .select('*')
        .eq('is_subscribed', true);

      if (filter === 'premium') {
        query = query.eq('subscription_tier', 'premium');
      } else if (filter === 'free') {
        query = query.eq('subscription_tier', 'free');
      }

      const { data, error } = await query.order('subscribed_at', { ascending: false });

      if (error) throw error;

      setSubscribers(data || []);

      const premiumCount = (data || []).filter(s => s.subscription_tier === 'premium').length;
      const freeCount = (data || []).filter(s => s.subscription_tier === 'free').length;
      
      setStats({
        total: (data || []).length,
        premium: premiumCount,
        free: freeCount
      });
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className={styles.telegramBotContainer}>
      {/* Sub-tabs Navigation */}
      <div className={styles.subTabsContainer}>
        <button
          className={`${styles.subTab} ${activeSubTab === 'management' ? styles.activeSubTab : ''}`}
          onClick={() => setActiveSubTab('management')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          Bot Management
        </button>
        
        <button
          className={`${styles.subTab} ${activeSubTab === 'subscribers' ? styles.activeSubTab : ''}`}
          onClick={() => setActiveSubTab('subscribers')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Subscribers
          {stats.total > 0 && (
            <span className={styles.badge}>{stats.total}</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className={styles.tabContent}>
        {activeSubTab === 'management' && (
          <TelegramBotManagement />
        )}

        {activeSubTab === 'subscribers' && (
          <>
            {!isPro ? (
              <div className={styles.upgradePrompt}>
                <div className={styles.upgradeIcon}>⭐</div>
                <h2 className={styles.upgradeTitle}>Premium Feature - Subscribers Management</h2>
                <p className={styles.upgradeDescription}>
                  Unlock the power to manage your Telegram bot subscribers! 
                  Track who's following your trading signals, see subscription tiers, 
                  and send targeted notifications to your premium members.
                </p>

                <div className={styles.featuresList}>
                  <h3>✨ What You'll Get:</h3>
                  <ul>
                    <li>📊 View all your Telegram subscribers</li>
                    <li>⭐ Filter by Premium/Free tiers</li>
                    <li>📈 Track subscription statistics</li>
                    <li>🎯 Send targeted broadcasts</li>
                    <li>💎 Premium member management</li>
                    <li>🔔 Advanced notification controls</li>
                  </ul>
                </div>

                <button 
                  className={styles.upgradeButton}
                  onClick={() => window.location.href = '/pricing'}
                >
                  🚀 Upgrade to Pro
                </button>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>👥</div>
                    <div className={styles.statValue}>{stats.total}</div>
                    <div className={styles.statLabel}>Total Subscribers</div>
                  </div>
                  
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>⭐</div>
                    <div className={styles.statValue}>{stats.premium}</div>
                    <div className={styles.statLabel}>Premium Members</div>
                  </div>
                  
                  <div className={styles.statCard}>
                    <div className={styles.statIcon}>🆓</div>
                    <div className={styles.statValue}>{stats.free}</div>
                    <div className={styles.statLabel}>Free Members</div>
                  </div>
                </div>

                {/* Filter Buttons */}
                <div className={styles.filterContainer}>
                  <button
                    className={`${styles.filterBtn} ${filter === 'all' ? styles.activeFilter : ''}`}
                    onClick={() => setFilter('all')}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${filter === 'premium' ? styles.activeFilter : ''}`}
                    onClick={() => setFilter('premium')}
                  >
                    ⭐ Premium ({stats.premium})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${filter === 'free' ? styles.activeFilter : ''}`}
                    onClick={() => setFilter('free')}
                  >
                    Free ({stats.free})
                  </button>
                </div>

                {/* Subscribers List */}
                {loading ? (
                  <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Loading subscribers...</p>
                  </div>
                ) : subscribers.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📭</div>
                    <h3>No subscribers yet</h3>
                    <p>Share your Telegram bot link to start getting subscribers!</p>
                  </div>
                ) : (
                  <div className={styles.subscribersList}>
                    {subscribers.map((subscriber) => (
                      <div key={subscriber.id} className={styles.subscriberCard}>
                        <div className={styles.subscriberAvatar}>
                          {subscriber.telegram_first_name?.[0]?.toUpperCase() || '👤'}
                        </div>
                        
                        <div className={styles.subscriberInfo}>
                          <div className={styles.subscriberName}>
                            {subscriber.telegram_first_name || 'Unknown User'}
                            {subscriber.subscription_tier === 'premium' && (
                              <span className={styles.premiumBadge}>⭐ Premium</span>
                            )}
                          </div>
                          <div className={styles.subscriberMeta}>
                            @{subscriber.telegram_username || 'no_username'} • 
                            Subscribed {formatDate(subscriber.subscribed_at)}
                          </div>
                        </div>

                        <div className={styles.subscriberActions}>
                          <span className={`${styles.statusBadge} ${styles.statusActive}`}>
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
