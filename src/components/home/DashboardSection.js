'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { usePosts } from '@/providers/PostProvider'; // Provider is the single source of truth
import styles from '@/styles/home/DashboardSection.module.css';
import CalculationInfoDialog from '@/components/common/CalculationInfoDialog'; // Import the new dialog component

export function DashboardSection() {
  const { user } = useSupabase();
  // Extract concrete values from ProfileProvider instead of the whole context object
  const {
    profile: profileData,
    followers: followersList,
    following: followingList,
  } = useProfile();
  
  // Get posts and stats from PostProvider (myStats is DB-accurate)
  const { myPosts, postStats, myStats, myLoading, onPostCreated, refreshMyStats } = usePosts();
  
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: '', content: '' });

  const handleOpenDialog = (title, content) => {
    setDialogContent({ title, content });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setDialogContent({ title: '', content: '' });
  };

  // Update stats whenever provider myStats change (DB-accurate) or fallback to postStats
  useEffect(() => {
    // Only log in development mode to reduce console spam
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 [DASHBOARD] Stats update triggered', {
        hasUser: !!user?.id,
        hasProfile: !!profileData?.id,
        myPostsCount: myPosts?.length,
        hasMyStats: !!myStats
      });
    }

    if (!user?.id || !profileData?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚨 [DASHBOARD] Missing user or profile data!');
      }
      return;
    }
    
    const userPosts = Array.isArray(myPosts) ? myPosts : [];
    // Prefer DB-backed myStats; fallback to computed postStats when needed
    const computed = (myStats && typeof myStats.totalPosts === 'number') ? myStats : postStats;
    
    // Calculate follower/following counts
    const followersCount = Array.isArray(followersList)
      ? followersList.length
      : (profileData?.followers || 0);
    const followingCount = Array.isArray(followingList)
      ? followingList.length
      : (profileData?.following || 0);

    const finalStats = {
      ...computed,
      followers: followersCount,
      following: followingCount,
      experienceScore: profileData?.experience_score || 0
    };

    setStats(finalStats);
    setLoading(Boolean(myLoading));
  }, [user?.id, profileData, myPosts, postStats, myStats, myLoading, followersList, followingList]);

  // Listen for new posts to update stats immediately
  useEffect(() => {
    if (!onPostCreated || !user?.id) {
      return;
    }

    const unsubscribe = onPostCreated((newPost) => {
      // Only update if it's the current user's post
      if (newPost.user_id === user.id) {
        // Refresh DB stats to ensure accurate totals independent of pagination
        try { 
          refreshMyStats();
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ [DASHBOARD] Error refreshing stats:', error);
          }
        }
        
        // Provider will also update postStats via context; reflect immediately as a fallback
        const currentStats = myStats || postStats;
        setStats(prev => ({ ...prev, ...currentStats }));
      }
    });

    return unsubscribe;
  }, [onPostCreated, user?.id, myPosts, postStats, myStats, refreshMyStats]);

  // Ensure stats are fetched on mount for authenticated user
  useEffect(() => {
    if (!user?.id) {
      return;
    }
    
    try { 
      refreshMyStats();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [DASHBOARD] Error refreshing stats on mount:', error);
      }
    }
  }, [user?.id, refreshMyStats]);

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

        <div className={styles.statCard} onClick={() => handleOpenDialog('Success Rate Calculation', `
          <h4>What is Success Rate?</h4>
          <p>It's the percentage of your posts that successfully reached their target price compared to all your closed posts (both successful and loss-making).</p>
          <h4>How is it calculated?</h4>
          <p><code>(Number of Successful Posts / (Number of Successful Posts + Number of Loss Posts)) * 100</code></p>
          <p>For example, if you have 10 successful posts and 5 loss posts, your success rate would be (10 / (10 + 5)) * 100 = ${((10 / (10 + 5)) * 100).toFixed(2)}%.</p>
          <h4>Why is it important?</h4>
          <p>It helps you understand your trading efficiency and the effectiveness of your strategies.</p>
        `)} style={{ cursor: 'pointer' }}>
          <div className={styles.statIcon}>📈</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.successRate}%</h3>
            <p
              className={styles.statLabel}
              title="Percentage of your posts that achieved their target price vs. total closed posts."
            >
              Success Rate
              <span
                className={styles.infoIcon}
                aria-label="How Success Rate is calculated"
              >
                ℹ️
              </span>
            </p>
          </div>
        </div>


        <div className={styles.statCard} onClick={() => handleOpenDialog('Experience Score Calculation', `
          <h4>What is Experience Score?</h4>
          <p>Your Experience Score is a cumulative metric that reflects your overall trading performance and wisdom.</p>
          <h4>How is it calculated?</h4>
          <p><code>Number of Successful Posts - Number of Loss Posts</code></p>
          <p>For example, if you have 10 successful posts and 5 loss posts, your experience score would be 10 - 5 = 5.</p>
          <h4>Why is it important?</h4>
          <p>A higher experience score indicates better trading performance and consistency over time.</p>
        `)} style={{ cursor: 'pointer' }}>
          <div className={styles.statIcon}>🏆</div>
          <div className={styles.statContent}>
            <h3 className={styles.statNumber}>{stats.experienceScore}</h3>
            <p
              className={styles.statLabel}
              title="Experience score reflects historical performance factors like success rate and consistency."
            >
              Experience
              <span
                className={styles.infoIcon}
                aria-label="What Experience means"
              >
                ℹ️
              </span>
            </p>
          </div>
        </div>

      </div>
      
      {/* The CalculationInfoDialog will be rendered here */}
      <CalculationInfoDialog 
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        title={dialogContent.title}
        content={dialogContent.content}
      />
    </div>
  );
}

export default DashboardSection;
