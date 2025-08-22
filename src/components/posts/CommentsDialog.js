'use client';

import { useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { formatDistanceToNow } from 'date-fns';
import { getPostComments, createComment, getPostCommentCount } from '@/utils/comments';
import { detectTextDirection, applyTextDirection } from '@/utils/textDirection';
import styles from '@/styles/CommentsDialog.module.css';
import { useComments } from '@/providers/CommentProvider';

// Child component for a single comment/reply to keep hooks at top level
function CommentItem({
  comment,
  isReply = false,
  user,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  handleSubmitReply,
  handleReplyTextChange,
  submitting,
}) {
  const replyInputRef = useRef(null);
  const commentDirection = detectTextDirection(comment.content);

  return (
    <div className={`${styles.comment} ${isReply ? styles.reply : ''}`}>
      <div className={styles.commentContent}>
        <div className={styles.avatar}>
          {comment.avatar_url ? (
            <img src={comment.avatar_url} alt={comment.username} />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {comment.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>

        <div className={styles.commentBody}>
          <div className={styles.commentBubble}>
            <div className={styles.commentHeader}>
              <span className={styles.username}>
                {comment.username || comment.full_name || 'Unknown User'}
              </span>
            </div>
            <div className={styles.commentText}>
              <p
                dir={commentDirection}
                style={{
                  textAlign: commentDirection === 'rtl' ? 'right' : 'left',
                  direction: commentDirection,
                }}
              >
                {comment.content}
              </p>
            </div>
          </div>

          <div className={styles.commentMeta}>
            <span className={styles.timestamp}>
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {!isReply && user && (
              <button
                className={styles.replyButton}
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              >
                Reply
              </button>
            )}
            {comment.is_edited && (
              <span className={styles.editedLabel}>Edited</span>
            )}
          </div>

          {/* Reply form */}
          {replyingTo === comment.id && (
            <div className={styles.replyForm}>
              <div className={styles.replyInputContainer}>
                <div className={styles.userAvatar}>
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Your avatar" />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {user?.user_metadata?.full_name?.charAt(0).toUpperCase() ||
                        user?.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div className={styles.replyInputWrapper}>
                  <textarea
                    ref={replyInputRef}
                    value={replyText}
                    onChange={(e) => handleReplyTextChange(e, replyInputRef.current)}
                    placeholder="Write a reply..."
                    className={styles.replyInput}
                    rows={2}
                    dir={detectTextDirection(replyText)}
                    style={{
                      textAlign: detectTextDirection(replyText) === 'rtl' ? 'right' : 'left',
                      direction: detectTextDirection(replyText),
                    }}
                  />
                  <div className={styles.replyActions}>
                    <button
                      onClick={() => handleSubmitReply(comment.id)}
                      disabled={!replyText.trim() || submitting}
                      className={styles.submitReplyButton}
                    >
                      {submitting ? 'Posting...' : 'Reply'}
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}
                      className={styles.cancelReplyButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className={styles.replies}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply={true}
              user={user}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              handleSubmitReply={handleSubmitReply}
              handleReplyTextChange={handleReplyTextChange}
              submitting={submitting}
            />)
          )}
        </div>
      )}
    </div>
  );
}

export default function CommentsDialog({ postId, isOpen, onClose, initialCommentCount = 0 }) {
  const { user } = useSupabase();
  const { fetchCommentsForPost } = useComments();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const dialogRef = useRef(null);
  const commentInputRef = useRef(null);

  // Fetch comments when dialog opens
  useEffect(() => {
    if (isOpen && postId) {
      fetchComments();
      // Focus on comment input when dialog opens
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, postId]);

  // Handle click outside to close dialog
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle ESC key to close dialog
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Apply text direction to comment input
  useEffect(() => {
    if (commentInputRef.current && newComment) {
      applyTextDirection(commentInputRef.current, newComment);
    }
  }, [newComment]);

  const fetchComments = async () => {
    if (!postId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await getPostComments(postId);
      
      if (error) throw error;

      setComments(data);
      setCommentCount(data.reduce((total, comment) => {
        return total + 1 + (comment.replies ? comment.replies.length : 0);
      }, 0));
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const { data, error } = await createComment(postId, user.id, newComment.trim());

      if (error) throw error;

      setNewComment('');
      // Pull fresh comments via provider to broadcast updates across the app
      try { await fetchCommentsForPost(postId); } catch {}
      await fetchComments(); // Refresh comments
    } catch (error) {
      console.error('Error submitting comment:', error);
      setError('Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentCommentId) => {
    if (!replyText.trim() || !user) return;

    setSubmitting(true);
    try {
      const { data, error } = await createComment(postId, user.id, replyText.trim(), parentCommentId);

      if (error) throw error;

      setReplyText('');
      setReplyingTo(null);
      // Pull fresh comments via provider to broadcast updates across the app
      try { await fetchCommentsForPost(postId); } catch {}
      await fetchComments(); // Refresh comments
    } catch (error) {
      console.error('Error submitting reply:', error);
      setError('Failed to submit reply');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle text direction for reply input
  const handleReplyTextChange = (e, replyInputRef) => {
    const value = e.target.value;
    setReplyText(value);
    
    // Apply text direction
    if (replyInputRef && value) {
      applyTextDirection(replyInputRef, value);
    }
  };

  

  if (!isOpen) return null;

  const commentInputDirection = detectTextDirection(newComment);

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} ref={dialogRef}>
        {/* Dialog Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>
            {commentCount > 0 ? `${commentCount} Comments` : 'Comments'}
          </h3>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Comments Content */}
        <div className={styles.content}>
          {/* New comment form */}
          {user ? (
            <form onSubmit={handleSubmitComment} className={styles.commentForm}>
              <div className={styles.commentInputContainer}>
                <div className={styles.userAvatar}>
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Your avatar" />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {user.user_metadata?.full_name?.charAt(0).toUpperCase() || 
                       user.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div className={styles.inputWrapper}>
                  <textarea
                    ref={commentInputRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className={styles.commentInput}
                    rows={3}
                    dir={commentInputDirection}
                    style={{
                      textAlign: commentInputDirection === 'rtl' ? 'right' : 'left',
                      direction: commentInputDirection
                    }}
                  />
                  <div className={styles.commentFormActions}>
                    <button
                      type="submit"
                      disabled={!newComment.trim() || submitting}
                      className={styles.submitButton}
                    >
                      {submitting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className={styles.loginPrompt}>
              <p>Please log in to comment</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className={styles.errorMessage}>
              <span>⚠️ {error}</span>
            </div>
          )}

          {/* Comments list */}
          <div className={styles.commentsContainer}>
            {loading ? (
              <div className={styles.loadingContainer}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={styles.commentSkeleton}>
                    <div className={styles.skeletonAvatar}></div>
                    <div className={styles.skeletonContent}>
                      <div className={styles.skeletonLine}></div>
                      <div className={styles.skeletonLine}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length > 0 ? (
              <div className={styles.commentsList}>
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    isReply={false}
                    user={user}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    handleSubmitReply={handleSubmitReply}
                    handleReplyTextChange={handleReplyTextChange}
                    submitting={submitting}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.noComments}>
                <p>No comments yet. Be the first to comment!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}