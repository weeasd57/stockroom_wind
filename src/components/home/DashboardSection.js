'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { getUserPosts } from '@/utils/supabase';
import styles from './DashboardSection.module.css';

export function DashboardSection() {
  const { user } = useSupabase();
  const profile = useProfile();
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

  useEffect(() => {
    async function fetchUserStats() {
      if (!user?.id || !profile) return;

      try {
        setLoading(true);

        // Get user posts
        const { posts } = await getUserPosts(user.id, 1, 100);
        
        // Calculate statistics
        const totalPosts = posts.length;
        const successfulPosts = posts.filter(post => post.target_reached).length;
        const lossPosts = posts.filter(post => post.stop_loss_triggered).length;
        const successRate = totalPosts > 0 ? Math.round((successfulPosts / totalPosts) * 100) : 0;

        setStats({
          totalPosts,
          successfulPosts,
          lossPosts,
          successRate,
          followers: profile.followers || 0,
          following: profile.following || 0,
          experienceScore: profile.experience_Score || 0
        });

      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserStats();
  }, [user, profile]);

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