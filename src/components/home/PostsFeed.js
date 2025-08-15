'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useFollow } from '@/providers/FollowProvider';
import { getPosts, getUserProfile } from '@/utils/supabase';
import { formatDistanceToNow } from 'date-fns';
import PostActions from '@/components/posts/PostActions';
import PostSentiment from '@/components/posts/PostSentiment';
import Comments from '@/components/posts/Comments';
import styles from '@/styles/home/PostsFeed.module.css';

export function PostsFeed() {
  const { user, supabase } = useSupabase();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('following'); // following, all, trending
  const [sortBy, setSortBy] = useState('date_desc'); // date_desc, date_asc, engagement, price_change
  const [categoryFilter, setCategoryFilter] = useState('all'); // all, buy, sell, analysis
  const [followingUsers, setFollowingUsers] = useState([]);

  // Get following users list
  useEffect(() => {
    async function getFollowingUsers() {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_followings')
          .select('following_id')
          .eq('follower_id', user.id);
          
        if (error) throw error;
        setFollowingUsers(data.map(f => f.following_id));
      } catch (error) {
        console.error('Error fetching following users:', error);
      }
    }
    
    getFollowingUsers();
  }, [user, supabase]);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    async function fetchPosts() {
      try {
        setLoading(true);
        setError(null);

        let postsQuery = supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (
              username,
              avatar_url,
              id
            ),
            comments:post_comments (count),
            buy_votes:post_buy_votes (count),
            sell_votes:post_sell_votes (count)
          `);

        // Apply filters
        if (filter === 'following' && followingUsers.length > 0) {
          postsQuery = postsQuery.in('user_id', followingUsers);
        } else if (filter === 'following' && followingUsers.length === 0) {
          // If user is not following anyone, show empty results
          if (isMounted) {
            setPosts([]);
            setLoading(false);
          }
          return;
        }

        // Apply category filter
        if (categoryFilter === 'buy') {
          postsQuery = postsQuery.eq('sentiment', 'bullish');
        } else if (categoryFilter === 'sell') {
          postsQuery = postsQuery.eq('sentiment', 'bearish');
        }

        // Apply sorting
        switch (sortBy) {
          case 'date_asc':
            postsQuery = postsQuery.order('created_at', { ascending: true });
            break;
          case 'engagement':
            // For engagement, we'll sort by total interactions (comments + votes)
            postsQuery = postsQuery.order('created_at', { ascending: false }); // fallback to date for now
            break;
          case 'price_change':
            postsQuery = postsQuery.order('current_price', { ascending: false });
            break;
          default: // date_desc
            postsQuery = postsQuery.order('created_at', { ascending: false });
        }

        postsQuery = postsQuery.limit(20);

        const { data: postsData, error: postsError } = await postsQuery;
        
        if (!isMounted) return;
        
        if (postsError) {
          throw postsError;
        }

        // Calculate engagement and sort if needed
        let processedPosts = postsData || [];
        
        if (sortBy === 'engagement') {
          processedPosts = processedPosts.sort((a, b) => {
            const aEngagement = (a.comments?.[0]?.count || 0) + (a.buy_votes?.[0]?.count || 0) + (a.sell_votes?.[0]?.count || 0);
            const bEngagement = (b.comments?.[0]?.count || 0) + (b.buy_votes?.[0]?.count || 0) + (b.sell_votes?.[0]?.count || 0);
            return bEngagement - aEngagement;
          });
        }

        // Format posts with correct structure
        const formattedPosts = processedPosts.map(post => ({
          ...post,
          profile: post.profiles || {
            username: 'Unknown User',
            avatar_url: null
          },
          comment_count: post.comments?.[0]?.count || 0,
          buy_count: post.buy_votes?.[0]?.count || 0,
          sell_count: post.sell_votes?.[0]?.count || 0,
        }));

        if (isMounted) {
          setPosts(formattedPosts);
        }

      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Posts fetch was aborted');
          return;
        }
        
        console.error('Error fetching posts:', error);
        if (isMounted) {
          setError('Failed to load posts. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPosts();

    // Cleanup function
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [filter, sortBy, categoryFilter, followingUsers, supabase]);

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
          
          <div className={styles.sortControls}>
            <select 
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="engagement">Most Engaged</option>
              <option value="price_change">Price Movement</option>
            </select>
            
            <select 
              className={styles.categorySelect}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="buy">Buy Signals</option>
              <option value="sell">Sell Signals</option>
              <option value="analysis">Analysis</option>
            </select>
          </div>
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
        ))}
      </div>

      {posts.length >= 20 && (
        <div className={styles.loadMore}>
          <button className={styles.loadMoreButton}>
            Load More Posts
          </button>
        </div>
      )}
    </div>
  );
}