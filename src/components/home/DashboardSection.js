'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { usePosts } from '@/providers/PostProvider'; // Add PostProvider for real-time updates
import { getUserPosts } from '@/utils/supabase';
import styles from '@/styles/home/DashboardSection.module.css';

export function DashboardSection() {
  const { user } = useSupabase();
  // Extract concrete values from ProfileProvider instead of the whole context object
  const {
    profile: profileData,
    followers: followersList,
    following: followingList,
  } = useProfile();
  
  // Get posts from PostProvider for real-time updates
  const { posts: allPosts, onPostCreated } = usePosts();
  
  const [stats, setStats] = useState({
    totalPosts: 0,
    successfulPosts: 0,
    lossPosts: 0,
    successRate: 0,
    followers: 0,
    following: 0,
    experienceScore: 0
  });
  const [loading, setLoading] = useState(true);

  // Function to calculate stats from posts
  const calculateStats = (posts) => {
    if (!posts || !Array.isArray(posts)) return {
      totalPosts: 0,
      successfulPosts: 0,
      lossPosts: 0,
      successRate: 0
    };

    const totalPosts = posts.length;
    const successfulPosts = posts.filter(post => post.target_reached).length;
    const lossPosts = posts.filter(post => post.stop_loss_triggered).length;
    const successRate = totalPosts > 0 ? Math.round((successfulPosts / totalPosts) * 100) : 0;

    return {
      totalPosts,
      successfulPosts,
      lossPosts,
      successRate
    };
  };

  // Update stats whenever posts change
  useEffect(() => {
    if (!user?.id || !profileData?.id) return;

    // Filter posts for current user
    const userPosts = allPosts.filter(post => post.user_id === user.id);
    
    // Calculate post statistics
    const postStats = calculateStats(userPosts);
    
    // Calculate follower/following counts
    const followersCount = Array.isArray(followersList)
      ? followersList.length
      : (profileData?.followers || 0);
    const followingCount = Array.isArray(followingList)
      ? followingList.length
      : (profileData?.following || 0);

    setStats({
      ...postStats,
      followers: followersCount,
      following: followingCount,
      experienceScore: profileData?.experience_score || 0
    });

    setLoading(false);
  }, [user?.id, profileData, allPosts, followersList, followingList]);

  // Listen for new posts to update stats immediately
  useEffect(() => {
    if (!onPostCreated || !user?.id) return;

    const unsubscribe = onPostCreated((newPost) => {
      // Only update if it's the current user's post
      if (newPost.user_id === user.id) {
        console.log('[DASHBOARD] New post created, updating stats');
        
        // Get updated user posts including the new one
        const userPosts = allPosts.filter(post => post.user_id === user.id);
        const postStats = calculateStats(userPosts);
        
        setStats(prev => ({
          ...prev,
          ...postStats
        }));
      }
    });

    return unsubscribe;
  }, [onPostCreated, user?.id, allPosts]);

  // Fallback to fetch user posts if PostProvider doesn't have them
  useEffect(() => {
    async function fetchUserStats() {
      // Wait until we have a user and profile id
      if (!user?.id || !profileData?.id) return;

      // If we already have posts from PostProvider, don't fetch again
      const userPostsFromProvider = allPosts.filter(post => post.user_id === user.id);
      if (userPostsFromProvider.length > 0) return;

      try {
        setLoading(true);

        // Get user posts as fallback
        const { posts } = await getUserPosts(user.id, 1, 100);
        
        // Calculate statistics
        const postStats = calculateStats(posts);

        const followersCount = Array.isArray(followersList)
          ? followersList.length
          : (profileData?.followers || 0);
        const followingCount = Array.isArray(followingList)
          ? followingList.length
          : (profileData?.following || 0);

        setStats({
          ...postStats,
          followers: followersCount,
          following: followingCount,
          experienceScore: profileData?.experience_score || 0
        });

      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserStats();
  }, [user?.id, profileData?.id, profileData?.experience_score, followersList?.length, followingList?.length, allPosts]);

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <h2 className={styles.title}>📊 Your Dashboard</h2>
        <div className={styles.statsGrid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.skeleton}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <h2 className={styles.title}>📊 Your Dashboard</h2>
      <div className={styles.statsGrid}>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📝</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.totalPosts}</h3>
            <p className={styles.statLabel}>Total Posts</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.successfulPosts}</h3>
            <p className={styles.statLabel}>Successful</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>❌</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.lossPosts}</h3>
            <p className={styles.statLabel}>Losses</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>📈</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.successRate}%</h3>
            <p className={styles.statLabel}>Success Rate</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>👥</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.followers}</h3>
            <p className={styles.statLabel}>Followers</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>🏆</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.experienceScore}</h3>
            <p className={styles.statLabel}>Experience</p>
          </div>
        </div>

      </div>
    </div>
  );
}
