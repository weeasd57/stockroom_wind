'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import styles from '@/styles/traders.module.css';

export default function TradersPage() {
  const { supabase, isAuthenticated, user } = useSupabase();
  const [traders, setTraders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchTraders = async () => {
      try {
        setLoading(true);
        
        // First fetch user profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio, created_at')
          .order('created_at', { ascending: false });
          
        if (profilesError) {
          throw profilesError;
        }

        if (!profilesData || profilesData.length === 0) {
          setTraders([]);
          return;
        }

        // Fetch posts to count them for each user
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('user_id');

        if (postsError) {
          console.error('Error fetching posts:', postsError.message);
        }

        // Count posts for each user
        const postCounts = {};
        postsData?.forEach(post => {
          if (post.user_id) {
            postCounts[post.user_id] = (postCounts[post.user_id] || 0) + 1;
          }
        });

        // Map post counts to profiles
        const tradersWithPostCounts = profilesData.map(profile => {
          return {
            ...profile,
            post_count: postCounts[profile.id] || 0
          };
        });
        
        console.log('Fetched profiles with post counts:', tradersWithPostCounts);
        setTraders(tradersWithPostCounts || []);
      } catch (error) {
        console.error('Error fetching traders:', error.message);
        setTraders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTraders();
  }, [supabase]);

  // Animation effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Filter out the current user's profile and process other filters
  const filteredTraders = traders.filter(trader => {
    // Skip current user's profile
    if (isAuthenticated && user && trader.id === user.id) {
      return false;
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        trader.full_name?.toLowerCase().includes(query) || 
        trader.username?.toLowerCase().includes(query) ||
        trader.bio?.toLowerCase().includes(query)
      );
    }
    
    if (filter === 'top') {
      // Show users with the most posts
      return trader.post_count > 0;
    }
    
    if (filter === 'trending') {
      // Show users created in the last month as trending
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return new Date(trader.created_at) > oneMonthAgo;
    }
    
    return true; // 'all' filter
  });

  const navigateToProfile = (userId) => {
    // If it's the current user's profile and they're authenticated, go to the profile page
    if (isAuthenticated && user && userId === user.id) {
      router.push('/profile');
      return;
    }
    
    // For all other cases, go to the view-profile page
    if (userId) {
      router.push(`/view-profile?id=${userId}`);
    }
  };

  const handleFollowClick = (e, userId) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    // Check if user is authenticated before following
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    // Follow logic would go here
    console.log('Follow user:', userId);
  };

  return (
    <div className={`${styles.tradersPage} ${visible ? styles.visible : ''}`}>
      <div className={styles.pageHeader}>
        <h1>Top Traders</h1>
        <p>Follow and learn from successful traders in the community</p>
      </div>
      
      <div className={styles.filtersContainer}>
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search traders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <div className={styles.filterButtons}>
          <button 
            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All Traders
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'top' ? styles.active : ''}`}
            onClick={() => setFilter('top')}
          >
            Top Traders
          </button>
          <button 
            className={`${styles.filterButton} ${filter === 'trending' ? styles.active : ''}`}
            onClick={() => setFilter('trending')}
          >
            Trending
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading traders...</p>
        </div>
      ) : (
        <div className={styles.tradersGrid}>
          {filteredTraders.length > 0 ? (
            filteredTraders.map(trader => (
              <div key={trader.id} className={styles.traderCard}>
                <div 
                  className={styles.traderHeader}
                  onClick={() => navigateToProfile(trader.id)}
                >
                  <div className={styles.traderAvatar}>
                    {trader.avatar_url ? (
                      <img src={trader.avatar_url} alt={trader.username} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {trader.full_name?.charAt(0) || trader.username?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <div className={styles.traderInfo}>
                    <h3>{trader.full_name || 'Trader'}</h3>
                    <p className={styles.username}>@{trader.username || 'username'}</p>
                  </div>
                </div>
                
                <div className={styles.traderStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Joined</span>
                    <span className={styles.statValue}>{new Date(trader.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Posts</span>
                    <span className={styles.statValue}>{trader.post_count || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Status</span>
                    <span className={styles.statValue}>Active</span>
                  </div>
                </div>
                
                <p className={styles.traderBio}>{trader.bio || 'No bio available'}</p>
                
                <div className={styles.cardActions}>
                  <button 
                    className={styles.viewProfileButton}
                    onClick={() => navigateToProfile(trader.id)}
                  >
                    View Profile
                  </button>
                  <button 
                    className={styles.followButton}
                    onClick={(e) => handleFollowClick(e, trader.id)}
                  >
                    Follow
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.noResults}>
              <p>No traders found matching your criteria</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
