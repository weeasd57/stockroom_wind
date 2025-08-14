'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { getPosts, getUserProfile } from '@/utils/supabase';
import { formatDistanceToNow } from 'date-fns';
import styles from './PostsFeed.module.css';

export function PostsFeed() {
  const { user } = useSupabase();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, following, trending

  useEffect(() => {
    async function fetchPosts() {
      try {
        setLoading(true);
        setError(null);

        // Get recent posts
        const { data: postsData, error: postsError } = await getPosts(1, 10);
        
        if (postsError) {
          throw postsError;
        }

        // Get user profiles for each post
        const postsWithProfiles = await Promise.all(
          postsData.map(async (post) => {
            try {
              const { data: profileData } = await getUserProfile(post.user_id);
              const profile = profileData && profileData.length > 0 ? profileData[0] : null;
              
              return {
                ...post,
                profile: profile || {
                  username: 'Unknown User',
                  avatar_url: null
                }
              };
            } catch (error) {
              console.error(`Error fetching profile for user ${post.user_id}:`, error);
              return {
                ...post,
                profile: {
                  username: 'Unknown User',
                  avatar_url: null
                }
              };
            }
          })
        );

        setPosts(postsWithProfiles);

      } catch (error) {
        console.error('Error fetching posts:', error);
        setError('Failed to load posts');
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, [filter]);

  function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  }

  function calculatePotentialReturn(currentPrice, targetPrice) {
    if (!currentPrice || !targetPrice) return 0;
    return ((targetPrice - currentPrice) / currentPrice * 100).toFixed(2);
  }

  function getStatusColor(post) {
    if (post.target_reached) return styles.success;
    if (post.stop_loss_triggered) return styles.loss;
    return styles.active;
  }

  function getStatusText(post) {
    if (post.target_reached) return '🎯 Target Reached';
    if (post.stop_loss_triggered) return '🛑 Stop Loss Hit';
    return '📊 Active';
  }

  if (loading) {
    return (
      <div className={styles.postsFeed}>
        <div className={styles.header}>
          <h2 className={styles.title}>📝 Recent Posts</h2>
        </div>
        <div className={styles.loadingContainer}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className={styles.postSkeleton}>
              <div className={styles.skeletonHeader}></div>
              <div className={styles.skeletonContent}></div>
              <div className={styles.skeletonFooter}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.postsFeed}>
        <div className={styles.header}>
          <h2 className={styles.title}>📝 Recent Posts</h2>
        </div>
        <div className={styles.errorMessage}>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className={styles.postsFeed}>
        <div className={styles.header}>
          <h2 className={styles.title}>📝 Recent Posts</h2>
        </div>
        <div className={styles.emptyState}>
          <p>No posts yet. Be the first to share your trading insights!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.postsFeed}>
      <div className={styles.header}>
        <h2 className={styles.title}>📝 Recent Posts</h2>
        <div className={styles.filters}>
          <button 
            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'trending' ? styles.active : ''}`}
            onClick={() => setFilter('trending')}
          >
            Trending
          </button>
        </div>
      </div>

      <div className={styles.postsContainer}>
        {posts.map((post) => (
          <div key={post.id} className={styles.postCard}>
            
            {/* Post Header */}
            <div className={styles.postHeader}>
              <div className={styles.userInfo}>
                <div className={styles.avatar}>
                  {post.profile.avatar_url ? (
                    <img 
                      src={post.profile.avatar_url} 
                      alt={post.profile.username}
                      className={styles.avatarImage}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {post.profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={styles.userDetails}>
                  <h4 className={styles.username}>{post.profile.username}</h4>
                  <p className={styles.timestamp}>
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className={`${styles.status} ${getStatusColor(post)}`}>
                {getStatusText(post)}
              </div>
            </div>

            {/* Stock Info */}
            <div className={styles.stockInfo}>
              <div className={styles.stockHeader}>
                <h3 className={styles.stockSymbol}>{post.symbol}</h3>
                <span className={styles.exchange}>{post.exchange}</span>
              </div>
              <p className={styles.companyName}>{post.company_name}</p>
              <p className={styles.country}>📍 {post.country}</p>
            </div>

            {/* Price Analysis */}
            <div className={styles.priceAnalysis}>
              <div className={styles.priceGrid}>
                <div className={styles.priceItem}>
                  <span className={styles.priceLabel}>Current</span>
                  <span className={styles.priceValue}>{formatPrice(post.current_price)}</span>
                </div>
                <div className={styles.priceItem}>
                  <span className={styles.priceLabel}>Target</span>
                  <span className={styles.priceValue}>{formatPrice(post.target_price)}</span>
                </div>
                <div className={styles.priceItem}>
                  <span className={styles.priceLabel}>Stop Loss</span>
                  <span className={styles.priceValue}>{formatPrice(post.stop_loss_price)}</span>
                </div>
                <div className={styles.priceItem}>
                  <span className={styles.priceLabel}>Potential</span>
                  <span className={`${styles.priceValue} ${styles.potential}`}>
                    +{calculatePotentialReturn(post.current_price, post.target_price)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            {post.description && (
              <div className={styles.postContent}>
                <p>{post.description}</p>
              </div>
            )}

            {/* Strategy Tag */}
            {post.strategy && (
              <div className={styles.strategy}>
                <span className={styles.strategyTag}>📈 {post.strategy}</span>
              </div>
            )}

            {/* Post Footer */}
            <div className={styles.postFooter}>
              <button className={styles.actionButton}>
                <span>💬</span> Discuss
              </button>
              <button className={styles.actionButton}>
                <span>📊</span> Analyze
              </button>
              <button className={styles.actionButton}>
                <span>🔖</span> Save
              </button>
            </div>

          </div>
        ))}
      </div>

      {posts.length >= 10 && (
        <div className={styles.loadMore}>
          <button className={styles.loadMoreButton}>
            Load More Posts
          </button>
        </div>
      )}
    </div>
  );
}