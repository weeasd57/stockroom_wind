'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { supabase, followUser, unfollowUser } from '@/utils/supabase';
import { formatDistanceToNow } from 'date-fns';
import styles from '@/styles/home/TopPerformers.module.css';

export function TopPerformers() {
  const { user } = useSupabase();
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [followLoading, setFollowLoading] = useState(new Set());

  useEffect(() => {
    async function fetchTopPerformers() {
      try {
        setLoading(true);
        setError(null);

        // Get all profiles with their stats
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('experience_Score', { ascending: false })
          .limit(10);

        if (profilesError) {
          throw profilesError;
        }

        // Calculate additional stats for each performer
        const performersWithStats = await Promise.all(
          profiles.map(async (profile) => {
            try {
              // Get user posts for additional calculations
              const { data: posts, error: postsError } = await supabase
                .from('posts')
                .select('target_reached, stop_loss_triggered, created_at')
                .eq('user_id', profile.id);

              if (!postsError && posts) {
                const totalPosts = posts.length;
                const successfulPosts = posts.filter(post => post.target_reached).length;
                const successRate = totalPosts > 0 ? Math.round((successfulPosts / totalPosts) * 100) : 0;
                
                // Calculate recent activity (posts in last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const recentPosts = posts.filter(post => new Date(post.created_at) > thirtyDaysAgo).length;

                return {
                  ...profile,
                  totalPosts,
                  successRate,
                  recentActivity: recentPosts,
                  // Add rank based on a combination of factors
                  rank: (profile.experience_Score * 0.4) + (successRate * 0.4) + (totalPosts * 0.2)
                };
              }

              return {
                ...profile,
                totalPosts: 0,
                successRate: 0,
                recentActivity: 0,
                rank: profile.experience_Score || 0
              };

            } catch (error) {
              console.error(`Error calculating stats for user ${profile.id}:`, error);
              return {
                ...profile,
                totalPosts: 0,
                successRate: 0,
                recentActivity: 0,
                rank: profile.experience_Score || 0
              };
            }
          })
        );

        // Sort by rank and filter out users with no activity
        const sortedPerformers = performersWithStats
          .filter(performer => performer.totalPosts > 0)
          .sort((a, b) => b.rank - a.rank)
          .slice(0, 8);

        setPerformers(sortedPerformers);

        // Get current user's following list if authenticated
        if (user?.id) {
          const { data: followingData } = await supabase
            .from('user_followings')
            .select('following_id')
            .eq('follower_id', user.id);

          if (followingData) {
            setFollowingIds(new Set(followingData.map(f => f.following_id)));
          }
        }

      } catch (error) {
        console.error('Error fetching top performers:', error);
        setError('Failed to load top performers');
      } finally {
        setLoading(false);
      }
    }

    fetchTopPerformers();
  }, [user]);

  async function handleFollow(performerId) {
    if (!user?.id || followLoading.has(performerId)) return;

    setFollowLoading(prev => new Set([...prev, performerId]));

    try {
      const isFollowing = followingIds.has(performerId);

      if (isFollowing) {
        const { error } = await unfollowUser(user.id, performerId);
        if (error) throw error;
        
        setFollowingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(performerId);
          return newSet;
        });
      } else {
        const { error } = await followUser(user.id, performerId);
        if (error) throw error;
        
        setFollowingIds(prev => new Set([...prev, performerId]));
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
    } finally {
      setFollowLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(performerId);
        return newSet;
      });
    }
  }

  function getRankIcon(index) {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${index + 1}`;
    }
  }

  function getPerformanceLevel(successRate) {
    if (successRate >= 80) return { label: 'Elite', color: styles.elite };
    if (successRate >= 60) return { label: 'Expert', color: styles.expert };
    if (successRate >= 40) return { label: 'Good', color: styles.good };
    return { label: 'Learning', color: styles.learning };
  }

  if (loading) {
    return (
      <div className={styles.topPerformers}>
        <h2 className={styles.title}>🏆 Top Performers</h2>
        <div className={styles.loadingContainer}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className={styles.performerSkeleton}>
              <div className={styles.skeletonAvatar}></div>
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonLine}></div>
                <div className={styles.skeletonLine}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.topPerformers}>
        <h2 className={styles.title}>🏆 Top Performers</h2>
        <div className={styles.errorMessage}>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (performers.length === 0) {
    return (
      <div className={styles.topPerformers}>
        <h2 className={styles.title}>🏆 Top Performers</h2>
        <div className={styles.emptyState}>
          <p>No active traders yet. Start trading to appear on the leaderboard!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.topPerformers}>
      <h2 className={styles.title}>🏆 Top Performers</h2>
      
      <div className={styles.performersGrid}>
        {performers.map((performer, index) => {
          const performance = getPerformanceLevel(performer.successRate);
          const isFollowing = followingIds.has(performer.id);
          const isCurrentUser = user?.id === performer.id;
          const isFollowingLoading = followLoading.has(performer.id);
          
          return (
            <div key={performer.id} className={styles.performerCard}>
              
              {/* Rank Badge */}
              <div className={styles.rankBadge}>
                {getRankIcon(index)}
              </div>
              
              {/* Performer Info */}
              <div className={styles.performerInfo}>
                <div className={styles.avatar}>
                  {performer.avatar_url ? (
                    <img 
                      src={performer.avatar_url} 
                      alt={performer.username}
                      className={styles.avatarImage}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {performer.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className={styles.performerDetails}>
                  <h4 className={styles.username}>{performer.username}</h4>
                  <div className={`${styles.performanceLevel} ${performance.color}`}>
                    {performance.label}
                  </div>
                </div>
              </div>
              
              {/* Stats */}
              <div className={styles.stats}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{performer.successRate}%</span>
                  <span className={styles.statLabel}>Success Rate</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{performer.totalPosts}</span>
                  <span className={styles.statLabel}>Total Posts</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{performer.experience_Score || 0}</span>
                  <span className={styles.statLabel}>Experience</span>
                </div>
              </div>
              
              {/* Follow Button */}
              {user && !isCurrentUser && (
                <div className={styles.followSection}>
                  <button 
                    className={`${styles.followButton} ${isFollowing ? styles.following : ''}`}
                    onClick={() => handleFollow(performer.id)}
                    disabled={isFollowingLoading}
                  >
                    {isFollowingLoading ? (
                      <span className={styles.loading}>⏳</span>
                    ) : isFollowing ? (
                      <>✓ Following</>
                    ) : (
                      <>+ Follow</>
                    )}
                  </button>
                </div>
              )}
              
              {isCurrentUser && (
                <div className={styles.currentUser}>
                  <span>👤 You</span>
                </div>
              )}
              
              {/* Recent Activity */}
              {performer.recentActivity > 0 && (
                <div className={styles.recentActivity}>
                  <span>🔥 {performer.recentActivity} posts this month</span>
                </div>
              )}
              
            </div>
          );
        })}
      </div>
      
      {/* View All Link */}
      <div className={styles.viewAll}>
        <button className={styles.viewAllButton}>
          View Full Leaderboard →
        </button>
      </div>
    </div>
  );
}
