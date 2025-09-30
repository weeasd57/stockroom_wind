'use client';

import { useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { formatDistanceToNow } from 'date-fns';
import { getPostComments, createComment, getPostCommentCount, updateComment, deleteComment } from '@/utils/comments';
import { detectTextDirection, applyTextDirection } from '@/utils/textDirection';
import styles from '@/styles/CommentsDialog.module.css';
import { useComments } from '@/providers/CommentProvider';
import Link from 'next/link';
import { toast } from 'sonner';

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
  editingComment,
  setEditingComment,
  editText,
  setEditText,
  handleSubmitEdit,
  handleDeleteComment,
}) {
  const replyInputRef = useRef(null);
  const editInputRef = useRef(null);
  const commentDirection = detectTextDirection(comment.content);
  const isOwner = user?.id === comment.user_id;

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
                {comment.user_id ? (
                  <Link href={`/view-profile/${comment.user_id}`} className={styles.username} prefetch>
                    {comment.username || comment.full_name || 'Unknown User'}
                  </Link>
                ) : (
                  comment.username || comment.full_name || 'Unknown User'
                )}
              </span>
            </div>
            <div className={styles.commentText}>
              {editingComment === comment.id ? (
                <div className={styles.editForm}>
                  <textarea
                    ref={editInputRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className={styles.editInput}
                    dir={detectTextDirection(editText)}
                    style={{
                      textAlign: detectTextDirection(editText) === 'rtl' ? 'right' : 'left',
                      direction: detectTextDirection(editText),
                    }}
                  />
                  <div className={styles.editActions}>
                    <button
                      onClick={() => handleSubmitEdit(comment.id)}
                      disabled={!editText.trim() || submitting}
                      className={styles.saveEditButton}
                    >
                      {submitting ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingComment(null);
                        setEditText('');
                      }}
                      className={styles.cancelEditButton}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  dir={commentDirection}
                  style={{
                    textAlign: commentDirection === 'rtl' ? 'right' : 'left',
                    direction: commentDirection,
                  }}
                >
                  {comment.content}
                </p>
              )}
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
            {isOwner && editingComment !== comment.id && (
              <>
                <button
                  className={styles.editButton}
                  onClick={() => {
                    setEditingComment(comment.id);
                    setEditText(comment.content);
                  }}
                >
                  Edit
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDeleteComment(comment.id)}
                >
                  Delete
                </button>
              </>
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
              editingComment={editingComment}
              setEditingComment={setEditingComment}
              editText={editText}
              setEditText={setEditText}
              handleSubmitEdit={handleSubmitEdit}
              handleDeleteComment={handleDeleteComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentsDialog({ postId, isOpen, onClose, initialCommentCount = 0 }) {
  const { user, supabase } = useSupabase();
  const { 
    fetchCommentsForPost, 
    startPolling, 
    stopPolling, 
    deleteComment, 
    editComment,
    getPostComments,
    getPostStats,
    addComment,
    subscribeToPost
  } = useComments();
  
  // Use provider's real-time data instead of local state
  const comments = getPostComments(postId);
  const postStats = getPostStats(postId);
  const commentCount = postStats.commentCount;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const dialogRef = useRef(null);
  const commentInputRef = useRef(null);
  const hasFetchedRef = useRef(false);
  
  // Component rendered silently

  // Fetch comments and start polling when dialog opens
  useEffect(() => {
    if (!isOpen) {
      // Reset fetch flag when dialog closes
      hasFetchedRef.current = false;
      setLoading(false);
      return;
    }
    
    if (isOpen && postId) {
      console.log('[CommentsDialog] Dialog opened for post:', postId);
      console.log('[CommentsDialog] Current comments in provider:', comments.length);
      
      // Subscribe to real-time updates for this post
      subscribeToPost(postId);
      
      // Start polling for stats updates
      startPolling(postId);
      
      // Load comments for this post only once per dialog open
      if (!hasFetchedRef.current) {
        console.log('[CommentsDialog] Starting fetch for post:', postId);
        setLoading(true);
        hasFetchedRef.current = true;
        
        fetchCommentsForPost(postId).finally(() => {
          console.log('[CommentsDialog] Fetch completed for post:', postId);
          setLoading(false);
        });
      } else {
        console.log('[CommentsDialog] Already fetched, skipping');
      }

      // Focus on comment input after a brief delay
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);

      // Return cleanup function that will run when dialog closes or unmounts
      return () => {
        console.log('[CommentsDialog] Cleaning up, stopping polling');
        stopPolling();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Real-time updates handled silently

  // This function is no longer needed since we use provider's real-time data
  // Keeping for backward compatibility but it's not used anymore

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      await addComment(postId, newComment.trim());
      setNewComment('');
      toast.success('Comment posted successfully', {
        description: 'Your comment has been added to the discussion.',
      });
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast.error('Failed to post comment', {
        description: 'Please check your connection and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentCommentId) => {
    if (!replyText.trim() || !user) return;

    setSubmitting(true);
    try {
      // Use createComment function for replies since addComment from provider doesn't support parentCommentId yet
      const { data, error } = await createComment(postId, user.id, replyText.trim(), parentCommentId);
      if (error) throw error;
      setReplyText('');
      setReplyingTo(null);
      toast.success('Reply posted successfully', {
        description: 'Your reply has been added to the conversation.',
      });
    } catch (error) {
      console.error('Error submitting reply:', error);
      toast.error('Failed to post reply', {
        description: 'Please check your connection and try again.',
      });
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

  // Handle editing a comment
  const handleSubmitEdit = async (commentId) => {
    if (!editText.trim()) return;

    setSubmitting(true);
    try {
      await editComment(commentId, editText.trim());
      setEditingComment(null);
      setEditText('');
      toast.success('Comment updated successfully', {
        description: 'Your changes have been saved.',
      });
    } catch (error) {
      console.error('Error editing comment:', error);
      toast.error('Failed to update comment', {
        description: 'Please try again later.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle deleting a comment
  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(commentId);
      // Dialog data will update automatically through CommentProvider
      toast.success('Comment deleted successfully', {
        description: 'Your comment has been removed.',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment', {
        description: 'Please try again later.',
      });
    }
  };

  if (!isOpen) {
    console.log('[CommentsDialog] Dialog is closed, not rendering');
    return null;
  }

  console.log('[CommentsDialog] Rendering dialog for post:', postId);
  console.log('[CommentsDialog] Comments count:', comments.length);
  console.log('[CommentsDialog] Comment stats:', postStats);

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
                  <div key={comment.id}>
                    <CommentItem
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
                      editingComment={editingComment}
                      setEditingComment={setEditingComment}
                      editText={editText}
                      setEditText={setEditText}
                      handleSubmitEdit={handleSubmitEdit}
                      handleDeleteComment={handleDeleteComment}
                    />
                    {/* Render nested replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className={styles.repliesContainer}>
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
                            editingComment={editingComment}
                            setEditingComment={setEditingComment}
                            editText={editText}
                            setEditText={setEditText}
                            handleSubmitEdit={handleSubmitEdit}
                            handleDeleteComment={handleDeleteComment}
                          />
                        ))}
                      </div>
                    )}
                  </div>
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