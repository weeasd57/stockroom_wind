'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import styles from '@/styles/SimplePriceChecker.module.css';

export default function SimplePriceChecker({ userId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [checking, setChecking] = useState(false);
  const [groupBy, setGroupBy] = useState('exchange');

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
          last_price_check,
          status_message,
          created_at,
          updated_at
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

  // Check prices for all posts
  const checkPrices = async () => {
    setChecking(true);
    setError(null);
    
    try {
      const response = await fetch('/api/posts/check-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId }),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to check prices');
      }
      
      // Refresh the posts data after price check
      await fetchPosts();
      
      // Show success message
      alert(`Price check completed! Updated ${data.updatedPosts} posts.`);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  // Group posts by selected criteria
  const groupedPosts = useCallback(() => {
    const groups = {};
    
    posts.forEach(post => {
      let key;
      switch (groupBy) {
        case 'exchange':
          key = post.exchange || 'Unknown Exchange';
          break;
        case 'symbol':
          key = post.symbol ? post.symbol.charAt(0).toUpperCase() : 'Other';
          break;
        default:
          key = 'All Posts';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(post);
    });
    
    return groups;
  }, [posts, groupBy]);

  // Load posts on mount
  useEffect(() => {
    if (userId) {
      fetchPosts();
    }
  }, [userId, fetchPosts]);

  // Format price
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never checked';
    return new Date(dateString).toLocaleString();
  };

  const groups = groupedPosts();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>📊 Price Checker</h2>
          {lastUpdate && (
            <span className={styles.lastUpdate}>
              Last updated: {formatDate(lastUpdate)}
            </span>
          )}
        </div>
        
        <div className={styles.controls}>
          <select 
            value={groupBy} 
            onChange={(e) => setGroupBy(e.target.value)}
            className={styles.select}
          >
            <option value="exchange">Group by Exchange</option>
            <option value="symbol">Group by Symbol</option>
          </select>

          <button 
            onClick={checkPrices}
            disabled={checking || loading}
            className={styles.checkButton}
          >
            {checking ? '🔄 Checking...' : '📈 Check All Prices'}
          </button>

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
          ⚠️ {error}
        </div>
      )}

      {/* Posts grouped by provider */}
      <div className={styles.groupsContainer}>
        {Object.entries(groups).map(([groupName, groupPosts]) => (
          <div key={groupName} className={styles.group}>
            <h3 className={styles.groupHeader}>
              {groupName} ({groupPosts.length} posts)
            </h3>
            
            <div className={styles.postsGrid}>
              {groupPosts.map((post) => (
                <div key={post.id} className={styles.postCard}>
                  <div className={styles.postHeader}>
                    <div className={styles.symbolInfo}>
                      <span className={styles.symbol}>{post.symbol}</span>
                      <span className={styles.exchange}>{post.exchange}</span>
                    </div>
                  </div>

                  <div className={styles.companyName}>
                    {post.company_name}
                  </div>

                  <div className={styles.priceInfo}>
                    <div className={styles.currentPrice}>
                      Current: {formatPrice(post.current_price)}
                    </div>
                    
                    <div className={styles.targets}>
                      <span className={styles.target}>
                        Target: {formatPrice(post.target_price)}
                      </span>
                      <span className={styles.stopLoss}>
                        Stop Loss: {formatPrice(post.stop_loss_price)}
                      </span>
                    </div>
                  </div>

                  {post.status_message && (
                    <div className={styles.statusMessage}>
                      {post.status_message}
                    </div>
                  )}

                  <div className={styles.lastCheck}>
                    Last checked: {formatDate(post.last_price_check)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {posts.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <p>No posts found. Create some posts to check their prices!</p>
        </div>
      )}
    </div>
  );
}