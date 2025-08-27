'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useTraders } from '@/providers/TradersProvider';
import styles from '@/styles/traders.module.css';

// Removed unused imports for cleaner code

export default function TradersPage() {
  const { supabase, isAuthenticated, user } = useSupabase();
  const {
    traders,
    loading,
    error,
    searchQuery,
    filter,
    hasMore,
    setSearchQuery,
    setFilter,
    loadMore,
    refreshTraders
  } = useTraders();
  
  const [visible, setVisible] = useState(false);
  const [followings, setFollowings] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'rows'
  const [sortBy, setSortBy] = useState('created_at'); // 'created_at', 'experience_score', 'success_posts', 'loss_posts', 'followers'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [filters, setFilters] = useState({
    minExperience: '',
    maxExperience: '',
    minSuccess: '',
    maxSuccess: '',
    minLoss: '',
    maxLoss: '',
    country: ''
  });
  const router = useRouter();

  // Animation effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Fetch user followings when authenticated
  useEffect(() => {
    const fetchFollowings = async () => {
      if (!isAuthenticated || !user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_followings')
          .select('following_id')
          .eq('follower_id', user.id);
          
        if (error) {
          console.error('Error fetching followings:', error);
          return;
        }
        
        const followingsMap = {};
        data.forEach(item => {
          followingsMap[item.following_id] = true;
        });
        
        setFollowings(followingsMap);
      } catch (error) {
        console.error('Error in fetchFollowings:', error);
      }
    };
    
    fetchFollowings();
  }, [supabase, isAuthenticated, user]);

  // Navigation functions
  const navigateToProfile = (userId) => {
    if (isAuthenticated && user && userId === user.id) {
      router.push('/profile');
      return;
    }
    
    if (userId) {
      router.push(`/view-profile/${userId}`);
    }
  };

  // Handle follow click
  const handleFollowClick = async (e, userId) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    try {
      const isFollowing = followings[userId];
      
      if (isFollowing) {
        // Unfollow
        const { error: deleteError } = await supabase
          .from('user_followings')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
          
        if (deleteError) {
          throw deleteError;
        }
        
        const updatedFollowings = { ...followings };
        delete updatedFollowings[userId];
        setFollowings(updatedFollowings);
        
        console.log('Unfollowed user:', userId);
      } else {
        // Follow
        const { error: insertError } = await supabase
          .from('user_followings')
          .insert([
            { follower_id: user.id, following_id: userId }
          ]);
          
        if (insertError) {
          throw insertError;
        }
        
        setFollowings({ ...followings, [userId]: true });
        
        console.log('Followed user:', userId);
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      alert('There was an error updating your following status');
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      loadMore();
      // Reset loading state after a delay
      setTimeout(() => setLoadingMore(false), 1000);
    }
  };

  // Apply local sorting and filtering
  const sortedAndFilteredTraders = [...traders]
    .filter(trader => {
      // Apply numeric filters
      if (filters.minExperience && (trader.experience_score || 0) < parseInt(filters.minExperience)) return false;
      if (filters.maxExperience && (trader.experience_score || 0) > parseInt(filters.maxExperience)) return false;
      if (filters.minSuccess && (trader.success_posts || 0) < parseInt(filters.minSuccess)) return false;
      if (filters.maxSuccess && (trader.success_posts || 0) > parseInt(filters.maxSuccess)) return false;
      if (filters.minLoss && (trader.loss_posts || 0) < parseInt(filters.minLoss)) return false;
      if (filters.maxLoss && (trader.loss_posts || 0) > parseInt(filters.maxLoss)) return false;
      
      // Apply country filter
      if (filters.country && trader.country && !trader.country.toLowerCase().includes(filters.country.toLowerCase())) return false;
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'experience_score':
          aValue = a.experience_score || 0;
          bValue = b.experience_score || 0;
          break;
        case 'success_posts':
          aValue = a.success_posts || 0;
          bValue = b.success_posts || 0;
          break;
        case 'loss_posts':
          aValue = a.loss_posts || 0;
          bValue = b.loss_posts || 0;
          break;
        case 'followers':
          aValue = a.followers || 0;
          bValue = b.followers || 0;
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      minExperience: '',
      maxExperience: '',
      minSuccess: '',
      maxSuccess: '',
      minLoss: '',
      maxLoss: '',
      country: ''
    });
  };

  // Lazy Image Component
  const LazyImage = ({ src, alt, profileId, onError }) => {
    return (
      <img 
        src={src || '/default-avatar.svg'}
        alt={alt}
        onError={onError}
      />
    );
  };

  // Show error state
  if (error) {
    return (
      <div className={`${styles.tradersPage} ${visible ? styles.visible : ''}`}>
        <div className={styles.pageHeader}>
          <h1>Top Traders</h1>
          <p>Follow and learn from successful traders in the community</p>
        </div>
        
        <div className={styles.errorContainer}>
          <p>Error loading traders: {error}</p>
          <button onClick={refreshTraders} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

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
            placeholder="Search traders by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className={styles.controlsRow}>
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
              </svg>
              Grid
            </button>
            <button 
              className={`${styles.viewButton} ${viewMode === 'rows' ? styles.active : ''}`}
              onClick={() => setViewMode('rows')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
              </svg>
              Rows
            </button>
          </div>

          <div className={styles.sortControls}>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="created_at">Sort by Date</option>
              <option value="experience_score">Sort by Experience</option>
              <option value="success_posts">Sort by Success</option>
              <option value="loss_posts">Sort by Loss</option>
              <option value="followers">Sort by Followers</option>
            </select>
            <button 
              className={`${styles.sortOrderButton} ${sortOrder === 'desc' ? styles.active : ''}`}
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        <div className={styles.filterInputsContainer}>
          <div className={styles.filterInputGroup}>
            <label>Experience:</label>
            <input
              type="number"
              placeholder="Min"
              value={filters.minExperience}
              onChange={(e) => handleFilterChange('minExperience', e.target.value)}
              className={styles.filterInput}
            />
            <input
              type="number"
              placeholder="Max"
              value={filters.maxExperience}
              onChange={(e) => handleFilterChange('maxExperience', e.target.value)}
              className={styles.filterInput}
            />
          </div>
          
          <div className={styles.filterInputGroup}>
            <label>Success:</label>
            <input
              type="number"
              placeholder="Min"
              value={filters.minSuccess}
              onChange={(e) => handleFilterChange('minSuccess', e.target.value)}
              className={styles.filterInput}
            />
            <input
              type="number"
              placeholder="Max"
              value={filters.maxSuccess}
              onChange={(e) => handleFilterChange('maxSuccess', e.target.value)}
              className={styles.filterInput}
            />
          </div>

          <div className={styles.filterInputGroup}>
            <label>Loss:</label>
            <input
              type="number"
              placeholder="Min"
              value={filters.minLoss}
              onChange={(e) => handleFilterChange('minLoss', e.target.value)}
              className={styles.filterInput}
            />
            <input
              type="number"
              placeholder="Max"
              value={filters.maxLoss}
              onChange={(e) => handleFilterChange('maxLoss', e.target.value)}
              className={styles.filterInput}
            />
          </div>

          <div className={styles.filterInputGroup}>
            <label>Country:</label>
            <input
              type="text"
              placeholder="Country"
              value={filters.country}
              onChange={(e) => handleFilterChange('country', e.target.value)}
              className={styles.filterInput}
            />
          </div>

          <button onClick={clearFilters} className={styles.clearFiltersButton}>
            Clear Filters
          </button>
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
        <div className={viewMode === 'grid' ? styles.tradersGrid : styles.tradersRows}>
          {sortedAndFilteredTraders.length > 0 ? (
            sortedAndFilteredTraders.map(trader => (
              <div key={trader.id} className={styles.traderCard}>
                <div 
                  className={styles.traderHeader}
                  onClick={() => navigateToProfile(trader.id)}
                >
                  <div className={styles.traderAvatar}>
                    <LazyImage
                      src={trader.avatar_url || '/default-avatar.svg'}
                      alt={trader.username}
                      profileId={trader.id}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/default-avatar.svg';
                      }}
                    />
                  </div>
                  <div className={styles.traderInfo}>
                    <h3>{trader.full_name || trader.username || 'Trader'}</h3>
                    <p className={styles.username}>@{trader.username || 'username'}</p>
                  </div>
                </div>
                
                <div className={styles.traderStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Experience</span>
                    <span className={styles.statValue}>{trader.experience_score || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Posts</span>
                    <span className={styles.statValue}>{trader.post_count || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Followers</span>
                    <span className={styles.statValue}>{trader.followers || 0}</span>
                  </div>
                </div>
                
                <div className={styles.quickInfo}>
                  <div className={styles.quickInfoItem}>
                    <span className={styles.quickInfoLabel}>Success:</span>
                    <span className={styles.quickInfoValue}>{trader.success_posts || 0}</span>
                  </div>
                  <div className={styles.quickInfoItem}>
                    <span className={styles.quickInfoLabel}>Loss:</span>
                    <span className={styles.quickInfoValue}>{trader.loss_posts || 0}</span>
                  </div>
                  <div className={styles.quickInfoItem}>
                    <span className={styles.quickInfoLabel}>Joined:</span>
                    <span className={styles.quickInfoValue}>{new Date(trader.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <p className={styles.traderBio}>{trader.bio || 'No bio available'}</p>
                
                <div className={styles.cardActions}>
                  {isAuthenticated && user?.id !== trader.id && (
                    <button 
                      className={followings[trader.id] ? styles.unfollowButton : styles.followButton}
                      onClick={(e) => handleFollowClick(e, trader.id)}
                    >
                      {followings[trader.id] ? 'Unfollow' : 'Follow'}
                    </button>
                  )}
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
      
      {/* Load More Button */}
      {!loading && hasMore && traders.length > 0 && (
        <div className={styles.loadMoreContainer}>
          <button 
            className={styles.loadMoreButton}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <div className={styles.buttonSpinner}></div>
                Loading more...
              </>
            ) : (
              'Load More Traders'
            )}
          </button>
        </div>
      )}
    </div>
  );
}