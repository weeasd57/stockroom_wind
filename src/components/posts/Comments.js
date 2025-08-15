'use client';

import { useState, useEffect } from 'react';
import { getPostCommentCount } from '@/utils/comments';
import CommentsDialog from './CommentsDialog';
import styles from '@/styles/Comments.module.css';

export default function Comments({ postId, initialCommentCount = 0 }) {
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [showDialog, setShowDialog] = useState(false);

  // Update comment count when initialCommentCount changes
  useEffect(() => {
    if (initialCommentCount !== commentCount) {
      setCommentCount(initialCommentCount);
    }
  }, [initialCommentCount]);

  // Fetch fresh comment count when needed
  const refreshCommentCount = async () => {
    if (!postId) return;
    
    try {
      const count = await getPostCommentCount(postId);
      setCommentCount(count);
    } catch (error) {
      console.error('Error fetching comment count:', error);
    }
  };

  const handleOpenDialog = () => {
    setShowDialog(true);
    // Refresh comment count when opening dialog
    refreshCommentCount();
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    // Refresh comment count when closing dialog to reflect any new comments
    refreshCommentCount();
  };

  return (
    <>
      {/* Comments Button */}
      <div className={styles.commentsSection}>
        <button
          className={styles.commentsButton}
          onClick={handleOpenDialog}
        >
          <span className={styles.commentIcon}>💬</span>
          <span className={styles.commentText}>
            {commentCount > 0 ? `${commentCount} Comments` : 'Comment'}
          </span>
        </button>
      </div>

      {/* Comments Dialog */}
      <CommentsDialog
        postId={postId}
        isOpen={showDialog}
        onClose={handleCloseDialog}
        initialCommentCount={commentCount}
      />
    </>
  );
}