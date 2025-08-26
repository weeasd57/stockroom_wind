'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import styles from '@/styles/RealTimePriceUpdates.module.css';

export default function RealTimePriceUpdates({ userId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [groupBy, setGroupBy] = useState('exchange'); // 'exchange', 'status', 'strategy'
  const intervalRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Fetch posts data
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          symbol,
          company_name,
          exchange,
          current_price,
          target_price,
          stop_loss_price,
          target_reached,
          stop_loss_triggered,
          closed,
          strategy,
          last_price_check,
          created_at,
          updated_at,
          status_message,
          price_checks,
          target_reached_date,
          stop_loss_triggered_date,
          high_price,
          target_high_price
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setPosts(data || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Group posts by selected criteria
  const groupedPosts = useCallback(() => {
    const groups = {};
    
    posts.forEach(post => {
      let key;
      switch (groupBy) {
        case 'exchange':
          key = post.exchange || 'Unknown Exchange';
          break;
        case 'status':
          if (post.target_reached) key = '🎯 Target Reached';
          else if (post.stop_loss_triggered) key = '🛑 Stop Loss Triggered';
          else if (post.closed) key = '📝 Closed';
          else key = '📈 Active';
          break;
        case 'strategy':
          key = post.strategy || 'No Strategy';
          break;
        default:
          key = 'All Posts';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(post);
    });
    
    return groups;
  }, [posts, groupBy]);

  // Setup real-time subscription and custom event listeners
  useEffect(() => {
    if (!userId) return;

    fetchPosts();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel(`posts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          
          if (payload.eventType === 'INSERT') {
            setPosts(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPosts(prev => prev.map(post => 
              post.id === payload.new.id ? payload.new : post
            ));
          } else if (payload.eventType === 'DELETE') {
            setPosts(prev => prev.filter(post => post.id !== payload.old.id));
          }
          
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    // Listen for price check completion events
    const handlePriceCheckCompleted = (event) => {
      if (event.detail.userId === userId) {
        console.log('Price check completed, refreshing data:', event.detail);
        fetchPosts();
      }
    };

    window.addEventListener('priceCheckCompleted', handlePriceCheckCompleted);

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      window.removeEventListener('priceCheckCompleted', handlePriceCheckCompleted);
    };
  }, [userId, fetchPosts]);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchPosts();
      }, refreshInterval * 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchPosts]);

  // Format price with currency symbol
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Calculate price change percentage
  const getPriceChange = (post) => {
    if (!post.current_price || !post.price_checks || !Array.isArray(post.price_checks) || post.price_checks.length === 0) {
      return null;
    }

    const latestPrice = parseFloat(post.current_price);
    const firstCheck = post.price_checks[0];
    const initialPrice = firstCheck ? parseFloat(firstCheck.close || firstCheck.price) : latestPrice;

    if (initialPrice === 0) return null;

    const change = ((latestPrice - initialPrice) / initialPrice) * 100;
    return {
      percentage: change.toFixed(2),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    };
  };

  // Get status color
  const getStatusColor = (post) => {
    if (post.target_reached) return '#4CAF50'; // Green
    if (post.stop_loss_triggered) return '#F44336'; // Red
    if (post.closed) return '#9E9E9E'; // Gray
    return '#2196F3'; // Blue
  };

  const groups = groupedPosts();

  return (
    <div className={styles.container}>
      {/* Header Controls */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Real-Time Price Updates</h2>
          {lastUpdate && (
            <span className={styles.lastUpdate}>
              Last updated: {formatDate(lastUpdate)}
            </span>
          )}
        </div>
        
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label>Group by:</label>
            <select 
              value={groupBy} 
              onChange={(e) => setGroupBy(e.target.value)}
              className={styles.select}
            >
              <option value="exchange">Exchange</option>
              <option value="status">Status</option>
              <option value="strategy">Strategy</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            {autoRefresh && (
              <select 
                value={refreshInterval} 
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className={styles.select}
              >
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            )}
          </div>

          <button 
            onClick={fetchPosts}
            disabled={loading}
            className={styles.refreshButton}
          >
            {loading ? '🔄' : '↻'} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          ⚠️ Error: {error}
        </div>
      )}

      {/* Posts grouped by provider/criteria */}
      <div className={styles.groupsContainer}>
        {Object.entries(groups).map(([groupName, groupPosts]) => (
          <div key={groupName} className={styles.group}>
            <h3 className={styles.groupHeader}>
              {groupName} ({groupPosts.length})
            </h3>
            
            <div className={styles.postsGrid}>
              {groupPosts.map((post) => {
                const priceChange = getPriceChange(post);
                const statusColor = getStatusColor(post);
                
                return (
                  <div key={post.id} className={styles.postCard}>
                    <div className={styles.postHeader}>
                      <div className={styles.symbolInfo}>
                        <span className={styles.symbol}>{post.symbol}</span>
                        <span className={styles.exchange}>{post.exchange}</span>
                      </div>
                      <div 
                        className={styles.statusIndicator}
                        style={{ backgroundColor: statusColor }}
                      />
                    </div>

                    <div className={styles.companyName}>
                      {post.company_name}
                    </div>

                    <div className={styles.priceInfo}>
                      <div className={styles.currentPrice}>
                        {formatPrice(post.current_price)}
                        {priceChange && (
                          <span className={`${styles.priceChange} ${styles[priceChange.direction]}`}>
                            ({priceChange.direction === 'up' ? '+' : ''}{priceChange.percentage}%)
                          </span>
                        )}
                      </div>
                      
                      <div className={styles.targets}>
                        <span className={styles.target}>
                          🎯 {formatPrice(post.target_price)}
                        </span>
                        <span className={styles.stopLoss}>
                          🛑 {formatPrice(post.stop_loss_price)}
                        </span>
                      </div>
                    </div>

                    {post.status_message && (
                      <div className={styles.statusMessage}>
                        {post.status_message}
                      </div>
                    )}

                    {post.last_price_check && (
                      <div className={styles.lastCheck}>
                        Last checked: {formatDate(post.last_price_check)}
                      </div>
                    )}

                    {(post.target_reached || post.stop_loss_triggered) && (
                      <div className={styles.achievement}>
                        {post.target_reached && (
                          <span className={styles.targetReached}>
                            🎯 Target reached on {formatDate(post.target_reached_date)}
                          </span>
                        )}
                        {post.stop_loss_triggered && (
                          <span className={styles.stopLossTriggered}>
                            🛑 Stop loss triggered on {formatDate(post.stop_loss_triggered_date)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {posts.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <p>No posts found. Create some trading posts to see real-time updates!</p>
        </div>
      )}
    </div>
  );
}