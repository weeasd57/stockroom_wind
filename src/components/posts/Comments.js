'use client';

import { useState, useEffect } from 'react';
import { useComments } from '@/providers/CommentProvider';
import CommentsDialog from './CommentsDialog';
import styles from '@/styles/Comments.module.css';
import { createPortal } from 'react-dom';

export default function Comments({ postId, initialCommentCount = 0, autoFetchOnMount = false }) {
  // Add error handling for useComments hook
  let commentHookResult;
  try {
    commentHookResult = useComments();
  } catch (error) {
    console.error('Comments: useComments hook failed:', error);
    return <div style={{color: 'red', padding: '10px'}}>Comments unavailable: {error.message}</div>;
  }
  
  const { getPostStats, fetchCommentsForPost, stopPolling } = commentHookResult;
  const [showDialog, setShowDialog] = useState(false);

  const postStats = getPostStats(postId);
  const commentCount = postStats.commentCount || initialCommentCount;

  // Fetch comments for this post when component mounts
  useEffect(() => {
    if (!autoFetchOnMount) return;
    if (postId) {
      fetchCommentsForPost(postId);
    }
  }, [postId, fetchCommentsForPost, autoFetchOnMount]);

  // Toggle body scroll lock when dialog is open
  useEffect(() => {
    if (showDialog) {
      typeof document !== 'undefined' && document.body.classList.add('dialog-open');
    } else {
      typeof document !== 'undefined' && document.body.classList.remove('dialog-open');
    }
    return () => {
      typeof document !== 'undefined' && document.body.classList.remove('dialog-open');
    };
  }, [showDialog]);

  const handleOpenDialog = () => {
    console.log('[DEBUG] Comments button clicked for post:', postId);
    console.log('[DEBUG] Using document.body as portal root:', typeof document !== 'undefined');
    console.log('[DEBUG] Current showDialog:', showDialog);

    setShowDialog(true);
    // Fetch latest comments when opening dialog
    if (postId) {
      fetchCommentsForPost(postId);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    // Stop polling when dialog closes
    stopPolling();
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

      {/* Render Comments Dialog via Portal */}
      {showDialog && typeof document !== 'undefined' && (() => {
        console.log('[DEBUG] Rendering CommentsDialog via portal');
        console.log('[DEBUG] showDialog:', showDialog);
        console.log('[DEBUG] portalRoot is document.body');
        return createPortal(
          <CommentsDialog
            postId={postId}
            isOpen={showDialog}
            onClose={handleCloseDialog}
          />,
          document.body
        );
      })()}
      
    </>
  );
}