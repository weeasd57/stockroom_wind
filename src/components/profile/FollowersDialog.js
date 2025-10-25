'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import styles from '@/styles/FollowersDialog.module.css';

export default function FollowersDialog({ 
  isOpen, 
  onClose, 
  followers = [], 
  following = [], 
  type = 'followers', // 'followers' or 'following'
  loading = false 
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const dataToShow = type === 'followers' ? followers : following;
  const title = type === 'followers' ? 'Followers' : 'Following';

  if (!mounted || !isOpen) return null;

  const dialogContent = (
    <div 
      className={styles.overlay} 
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>Loading {type}...</p>
            </div>
          ) : dataToShow.length > 0 ? (
            <div className={styles.usersList}>
              {dataToShow.map((item) => {
                const user = type === 'followers' 
                  ? item.profiles || { id: item.follower_id, username: 'Unknown User' }
                  : item.profiles || { id: item.following_id, username: 'Unknown User' };
                
                return (
                  <div key={user.id} className={styles.userItem}>
                    <div 
                      className={styles.userCard}
                      onClick={() => {
                        // Close the dialog first
                        onClose();
                        // Navigate using Next.js router
                        router.push(`/view-profile/${user.id}`);
                      }}
                    >
                      <div className={styles.avatarContainer}>
                        <img 
                          src={user.avatar_url || '/default-avatar.svg'} 
                          alt={user.username || 'User'} 
                          className={styles.avatar}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default-avatar.svg';
                          }}
                        />
                      </div>
                      <div className={styles.userInfo}>
                        <h3 className={styles.username}>{user.username || 'Unknown User'}</h3>
                        {user.full_name && (
                          <p className={styles.fullName}>{user.full_name}</p>
                        )}
                        {user.bio && (
                          <p className={styles.bio}>{user.bio}</p>
                        )}
                      </div>
                      <div className={styles.arrowIcon}>
                        →
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                {type === 'followers' ? '👥' : '➡️'}
              </div>
              <h3 className={styles.emptyTitle}>
                {type === 'followers' ? 'No followers yet' : "You're not following anyone yet"}
              </h3>
              <p className={styles.emptyMessage}>
                {type === 'followers' 
                  ? 'When people follow you, they\'ll appear here' 
                  : 'When you follow people, they\'ll appear here'}
              </p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <p className={styles.count}>
            {dataToShow.length} {type === 'followers' ? 'followers' : 'following'}
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
