'use client';

import { useState, useEffect } from 'react';
import { useComments } from '@/providers/CommentProvider';
import CommentsDialog from './CommentsDialog';
import styles from '@/styles/Comments.module.css';
import { createPortal } from 'react-dom';

export default function Comments({ postId, initialCommentCount = 0 }) {
  const { getPostStats, fetchCommentsForPost } = useComments();
  const [showDialog, setShowDialog] = useState(false);
  const [portalContainer, setPortalContainer] = useState(null);

  const postStats = getPostStats(postId);
  const commentCount = postStats.commentCount || initialCommentCount;

  // Fetch comments for this post when component mounts
  useEffect(() => {
    if (postId) {
      fetchCommentsForPost(postId);
    }
  }, [postId, fetchCommentsForPost]);

  // Setup a shared fixed portal container on the document body
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let container = document.getElementById('dialog-portal-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'dialog-portal-container';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.zIndex = '10000';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
    }
    setPortalContainer(container);

    return () => {
      const existing = document.getElementById('dialog-portal-container');
      // Remove the container only if it's empty (no other dialogs using it)
      if (existing && existing.childNodes.length === 0) {
        document.body.removeChild(existing);
      }
    };
  }, []);

  // Toggle background interaction and body scroll when dialog is open
  useEffect(() => {
    if (!portalContainer) return;
    if (showDialog) {
      portalContainer.style.pointerEvents = 'auto';
      document.body.classList.add('dialog-open');
    } else {
      portalContainer.style.pointerEvents = 'none';
      document.body.classList.remove('dialog-open');
    }

    return () => {
      portalContainer.style.pointerEvents = 'none';
      document.body.classList.remove('dialog-open');
    };
  }, [showDialog, portalContainer]);

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

      {/* Comments Dialog via portal to fixed container */}
      {portalContainer && showDialog && createPortal(
        (
          <CommentsDialog
            postId={postId}
            isOpen={showDialog}
            onClose={handleCloseDialog}
            commentCount={commentCount}
          />
        ),
        portalContainer
      )}
    </>
  );
}