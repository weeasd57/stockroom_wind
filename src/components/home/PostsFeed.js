'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useFollow } from '@/providers/FollowProvider';
import { usePosts } from '@/providers/PostProvider'; // Add PostProvider for real-time updates
import { getPosts, getUserProfile } from '@/utils/supabase';
import { formatDistanceToNow } from 'date-fns';
import PostActions from '@/components/posts/PostActions';
import PostSentiment from '@/components/posts/PostSentiment';
import Comments from '@/components/posts/Comments';
import { CommentProvider } from '@/providers/CommentProvider'; // Import CommentProvider
import styles from '@/styles/home/PostsFeed.module.css';

export function PostsFeed() {
  const { user, supabase } = useSupabase();
  
  // Get posts from PostProvider for real-time updates
  const { posts: providerPosts, fetchPosts, loading: providerLoading, error: providerError } = usePosts();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('following'); // following, all, trending
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, engagement, price_change
  const [categoryFilter, setCategoryFilter] = useState('all'); // all, buy, sell, analysis
  const [followingUsers, setFollowingUsers] = useState([]);

  // Get following users list
  useEffect(() => {
    console.log(`[PostsFeed] useEffect for fetching following users fired. User: ${!!user}`);
    async function getFollowingUsers() {
      if (!user) {
        console.log('[PostsFeed] No user, skipping fetching following users.');
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('user_followings')
          .select('following_id')
          .eq('follower_id', user.id);
          
        if (error) throw error;
        setFollowingUsers(data.map(f => f.following_id));
        console.log(`[PostsFeed] Fetched ${data.length} following users.`);
      } catch (error) {
        console.error('[PostsFeed] Error fetching following users:', error);
      }
    }
    
    getFollowingUsers();
  }, [user, supabase]);

  // Fetch posts with the appropriate filter when filter changes
  useEffect(() => {
    console.log(`[PostsFeed] useEffect for fetching posts fired. Filter: ${filter}, FetchPosts changed: ${typeof fetchPosts === 'function'}`);
    if (filter === 'following') {
      fetchPosts('following');
    } else {
      fetchPosts(); // Fetch all posts
    }
  }, [filter, fetchPosts]);

  // Update loading and error states from PostProvider
  useEffect(() => {
    setLoading(providerLoading);
    setError(providerError);
  }, [providerLoading, providerError]);

  // Filter and sort posts based on current settings
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = [...providerPosts];

    // Apply main filter (following/all/trending)
    if (filter === 'following') {
      if (followingUsers.length > 0) {
        filtered = filtered.filter(post => followingUsers.includes(post.user_id));
      } else {
        // If not following anyone, show empty
        filtered = [];
      }
    }
    // For 'all' filter, we show all posts (no additional filtering)
    // For 'trending' filter, we'll sort by engagement later

    // Apply category filter
    if (categoryFilter === 'buy') {
      filtered = filtered.filter(post => post.sentiment === 'bullish');
    } else if (categoryFilter === 'sell') {
      filtered = filtered.filter(post => post.sentiment === 'bearish');
    }

    // Apply sorting
    switch (sortBy) {
      case 'date_asc':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'engagement':
        filtered.sort((a, b) => {
          const aEngagement = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
          const bEngagement = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
          return bEngagement - aEngagement;
        });
        break;
      case 'price_change':
        filtered.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
        break;
      default: // date_desc
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // For trending filter, prioritize by engagement regardless of sort
    if (filter === 'trending') {
      filtered.sort((a, b) => {
        const aEngagement = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
        const bEngagement = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
        return bEngagement - aEngagement;
      });
    }

    return filtered.slice(0, 20); // Limit to 20 posts
  }, [providerPosts, filter, sortBy, categoryFilter, followingUsers]);

  // Use filtered posts instead of local posts state
  const posts = filteredAndSortedPosts;

  console.log(`[PostsFeed] Rendering with ${posts.length} posts. Loading: ${loading}, Filter: ${filter}`);

  // Helper functions remain the same
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
          <h2 className={styles.title}>
            {filter === 'following' ? 'Following Posts' : 'Recent Posts'}
          </h2>
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
          <h2 className={styles.title}>
            {filter === 'following' ? 'Following Posts' : 'Recent Posts'}
          </h2>
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
          <h2 className={styles.title}>
            {filter === 'following' ? 'Following Posts' : 'Recent Posts'}
          </h2>
          <div className={styles.controls}>
            <div className={styles.filters}>
              <button 
                className={`${styles.filterButton} ${filter === 'following' ? styles.active : ''}`}
                onClick={() => setFilter('following')}
              >
                Following
              </button>
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
        </div>
        <div className={styles.emptyState}>
          <p>
            {filter === 'following' 
              ? "No posts from users you follow yet. Follow some traders to see their insights!" 
              : "No posts yet. Be the first to share your trading insights!"
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.postsFeed}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {filter === 'following' ? 'Following Posts' : 'Recent Posts'}
        </h2>
        <div className={styles.controls}>
          <div className={styles.filters}>
            <button 
              className={`${styles.filterButton} ${filter === 'following' ? styles.active : ''}`}
              onClick={() => setFilter('following')}
            >
              Following
            </button>
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
      </div>

      <div className={styles.postsContainer}>
        {posts.map((post) => (
          <CommentProvider key={post.id}>
            <div className={styles.postCard}>
            
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

              
              {/* Buy/Sell Actions */}
              <PostActions 
                postId={post.id} 
                initialBuyCount={post.buy_count || 0}
                initialSellCount={post.sell_count || 0}
              />

              {/* Market Sentiment */}
              <PostSentiment 
                buyCount={post.buy_count || 0}
                sellCount={post.sell_count || 0}
              />

              {/* Comments Section */}
              <Comments 
                postId={post.id}
                initialCommentCount={post.comment_count || 0}
              />

            </div>
          </CommentProvider>
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