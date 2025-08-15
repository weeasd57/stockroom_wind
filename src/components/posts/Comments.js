'use client';

import { useState, useEffect } from 'react';
import { useComments } from '@/providers/CommentProvider';
import CommentsDialog from './CommentsDialog';
import styles from '@/styles/Comments.module.css';

export default function Comments({ postId, initialCommentCount = 0 }) {
  const { getPostStats, fetchCommentsForPost } = useComments();
  const [showDialog, setShowDialog] = useState(false);

  const postStats = getPostStats(postId);
  const commentCount = postStats.commentCount || initialCommentCount;

  // Fetch comments for this post when component mounts
  useEffect(() => {
    if (postId) {
      fetchCommentsForPost(postId);
    }
  }, [postId, fetchCommentsForPost]);

  const handleOpenDialog = () => {
    setShowDialog(true);
    // Fetch latest comments when opening dialog
    if (postId) {
      fetchCommentsForPost(postId);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
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
        commentCount={commentCount}
      />
    </>
  );
}