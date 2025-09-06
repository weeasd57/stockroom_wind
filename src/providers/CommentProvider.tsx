"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Comment } from '../models/Comment';
import { useSupabase } from './SupabaseProvider';
import { isValidUUID, isTempId } from '@/lib/utils';

interface PostStats {
  commentCount: number;
  buyCount: number;
  sellCount: number;
}

interface CommentContextType {
  comments: Comment[];
  postStats: Record<string, PostStats>;
  loading: boolean;
  error: string | null;
  addComment: (postId: string, content: string) => Promise<Comment>;
  deleteComment: (id: string) => Promise<void>;
  editComment: (id: string, newContent: string) => Promise<void>;
  getPostComments: (postId: string) => Comment[];
  getPostStats: (postId: string) => PostStats;
  fetchCommentsForPost: (postId: string) => Promise<void>;
  toggleBuyVote: (postId: string, currentAction?: 'buy' | 'sell' | null) => Promise<void>;
  toggleSellVote: (postId: string, currentAction?: 'buy' | 'sell' | null) => Promise<void>;
  startPolling: (postId: string) => void;
  stopPolling: () => void;
}

const CommentContext = createContext<CommentContextType | null>(null);

export function CommentProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user } = useSupabase();
  const [comments, setComments] = useState<Comment[]>([]);
  const [postStats, setPostStats] = useState<Record<string, PostStats>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Record<string, any>>({});
  const [loadedCommentsPosts, setLoadedCommentsPosts] = useState<Set<string>>(new Set());
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentPollingPostId, setCurrentPollingPostId] = useState<string | null>(null);

  // Subscribe to real-time updates for a specific post
  const subscribeToPost = useCallback((postId: string) => {
    if (subscriptions[postId] || !supabase) return;
    if (!isValidUUID(postId) || isTempId(postId)) return;

    // Use a single channel per post for both comments and votes
    const channel = supabase
      .channel(`post-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`
        },
        async (payload) => {
          console.log('Comments change:', payload);
          // Always refresh counts; refresh comment list only if already loaded to avoid heavy fetches in feeds
          await updatePostStats(postId);
          if (loadedCommentsPosts.has(postId)) {
            await fetchCommentsForPost(postId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_actions',
          filter: `post_id=eq.${postId}`
        },
        async (payload) => {
          console.log('Post actions change:', payload);
          await updatePostStats(postId);
        }
      )
      .subscribe();

    setSubscriptions(prev => ({
      ...prev,
      [postId]: { channel }
    }));
  }, [supabase, subscriptions, loadedCommentsPosts]);

  // Update post statistics
  const updatePostStats = useCallback(async (postId: string) => {
    if (!supabase || !isValidUUID(postId) || isTempId(postId)) return;

    try {
      const [commentsResponse, buyVotesResponse, sellVotesResponse] = await Promise.all([
        supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId),
        supabase
          .from('post_actions')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId)
          .eq('action_type', 'buy'),
        supabase
          .from('post_actions')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId)
          .eq('action_type', 'sell')
      ]);

      const stats: PostStats = {
        commentCount: (commentsResponse.count as number) || 0,
        buyCount: (buyVotesResponse.count as number) || 0,
        sellCount: (sellVotesResponse.count as number) || 0
      };

      // Stats updated silently

      setPostStats(prev => ({
        ...prev,
        [postId]: stats
      }));
    } catch (error) {
      console.error('Error updating post stats:', error);
    }
  }, [supabase]);

  // Fetch comments for a specific post
  const fetchCommentsForPost = useCallback(async (postId: string) => {
    if (!supabase || !isValidUUID(postId) || isTempId(postId)) return;

    try {
      const { data, error } = await supabase
        .from('comments_with_user_info')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      console.debug("Comments fetched for post:", postId, data);

      if (error) throw error;

      // Group comments by parent_comment_id for nested structure
      const topLevelComments = data.filter(comment => !comment.parent_comment_id);
      const replies = data.filter(comment => comment.parent_comment_id);
      
      // Add replies to their parent comments
      const formattedComments = topLevelComments.map(comment => ({
        ...comment,
        replies: replies.filter(reply => reply.parent_comment_id === comment.id)
      }));

      // Comments fetched silently

      // Update comments state, replacing existing comments for this post
      setComments(prev => {
        const filtered = prev.filter(c => c.post_id !== postId);
        const newComments = [...filtered, ...formattedComments];
        // Comments state updated silently
        return newComments;
      });

      // Ensure realtime subscription is active for this post
      subscribeToPost(postId);

      // Mark this post's comments as loaded to allow realtime refreshes
      setLoadedCommentsPosts(prev => {
        const next = new Set(prev);
        next.add(postId);
        return next;
      });

      // Update stats
      await updatePostStats(postId);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    }
  }, [supabase, updatePostStats, subscribeToPost]);

  const addComment = async (postId: string, content: string): Promise<Comment> => {
    if (!supabase || !user) throw new Error('Not authenticated');
    if (!isValidUUID(postId) || isTempId(postId)) throw new Error('Post is not yet saved');

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim()
        })
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      const newComment = {
        ...data,
        profile: data.profiles
      };

      // Optimistically update local state
      setComments(prev => [...prev, newComment]);
      
      // Update stats
      setPostStats(prev => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          commentCount: (prev[postId]?.commentCount || 0) + 1
        }
      }));

      return newComment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add comment';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Call the database function to toggle a post action with bounded retries and per-attempt timeout
  const callTogglePostAction = async (
    postId: string,
    action: 'buy' | 'sell',
    maxAttempts: number = 3,
    perAttemptTimeoutMs: number = 3500
  ): Promise<void> => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Per-attempt timeout to avoid hanging; overall kept under PostActions 12s guard
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('RPC timeout'));
          }, perAttemptTimeoutMs);

          supabase!
            .rpc('toggle_post_action', {
              p_post_id: postId,
              p_user_id: user!.id,
              p_action_type: action,
            })
            .then(({ error }) => {
              clearTimeout(timer);
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            }, (err) => {
              clearTimeout(timer);
              reject(err);
            });
        });
        return; // success
      } catch (err) {
        lastError = err;
        // Short backoff before retrying (200ms, 400ms)
        if (attempt < maxAttempts) {
          const backoff = Math.min(200 * Math.pow(2, attempt - 1), 800);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to toggle action');
  };

  const deleteComment = async (id: string): Promise<void> => {
    if (!supabase || !user) throw new Error('Not authenticated');

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Only allow users to delete their own comments

      if (error) throw error;

      // Optimistically update local state
      const comment = comments.find(c => c.id === id);
      if (comment) {
        setComments(prev => prev.filter(c => c.id !== id));
        setPostStats(prev => ({
          ...prev,
          [comment.post_id]: {
            ...prev[comment.post_id],
            commentCount: Math.max(0, (prev[comment.post_id]?.commentCount || 1) - 1)
          }
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const editComment = async (id: string, newContent: string): Promise<void> => {
    if (!supabase || !user) throw new Error('Not authenticated');
    if (!newContent.trim()) throw new Error('Comment content cannot be empty');

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comments')
        .update({ 
          content: newContent.trim(),
          is_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id); // Only allow users to edit their own comments

      if (error) throw error;

      // Optimistically update local state
      setComments(prev => prev.map(comment => 
        comment.id === id 
          ? { ...comment, content: newContent.trim(), is_edited: true, updated_at: new Date().toISOString() }
          : comment
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit comment');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Start polling for comments updates every 8 seconds
  const startPolling = useCallback((postId: string) => {
    if (!supabase || !postId) return;
    
    // Use current state values directly instead of relying on state in closure
    setCurrentPollingPostId(current => {
      if (current === postId) {
        console.log(`🔄 Polling already active for post: ${postId}`);
        return current;
      }
      
      console.log(`🚀 Starting polling for post: ${postId}`);
      return postId;
    });
    
    // Clear any existing interval
    setPollingInterval(currentInterval => {
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      
      // Set up new polling every 10 seconds
      console.log(`⏰ Setting up interval for post: ${postId} (10s)`);
      const newInterval = setInterval(async () => {
        console.log(`🔄 Polling cycle for post: ${postId}`);
        try {
          await fetchCommentsForPost(postId);
          await updatePostStats(postId);
          console.log(`✅ Polling cycle completed for post: ${postId}`);
        } catch (error) {
          console.error(`❌ Polling error for post ${postId}:`, error);
        }
      }, 10000);
      
      return newInterval;
    });
  }, [supabase, fetchCommentsForPost, updatePostStats]);

  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      console.log(`🛑 Stopping polling for post: ${currentPollingPostId}`);
      clearInterval(pollingInterval);
      setPollingInterval(null);
      setCurrentPollingPostId(null);
      console.log(`✅ Polling stopped successfully`);
    } else {
      console.log(`ℹ️ No active polling to stop`);
      setCurrentPollingPostId(null);
    }
  }, [pollingInterval, currentPollingPostId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const toggleBuyVote = async (postId: string, currentAction: 'buy' | 'sell' | null = null): Promise<void> => {
    if (!supabase || !user) throw new Error('Not authenticated');
    if (!isValidUUID(postId) || isTempId(postId)) {
      setError('Post is not yet saved');
      return;
    }

    // Ensure subscription is active for real-time confirmations
    subscribeToPost(postId);

    // Optimistic update
    const prevStats = postStats[postId] || { commentCount: 0, buyCount: 0, sellCount: 0 };
    const prevSnapshot = { ...prevStats };
    let nextStats = { ...prevStats };

    if (currentAction === 'buy') {
      // Remove existing buy
      nextStats.buyCount = Math.max(0, nextStats.buyCount - 1);
    } else if (currentAction === 'sell') {
      // Switch from sell to buy
      nextStats.sellCount = Math.max(0, nextStats.sellCount - 1);
      nextStats.buyCount = nextStats.buyCount + 1;
    } else {
      // Add new buy
      nextStats.buyCount = nextStats.buyCount + 1;
    }

    setPostStats(prev => ({ ...prev, [postId]: nextStats }));

    try {
      // Single-roundtrip RPC handles toggle and opposite-action removal atomically
      await callTogglePostAction(postId, 'buy');
      // Realtime subscription will reconcile counts; optimistic UI already applied
    } catch (err) {
      console.error('Error toggling buy vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to update vote');
      // Rollback optimistic update on error
      setPostStats(prev => ({ ...prev, [postId]: prevSnapshot }));
    }
  };

  const toggleSellVote = async (postId: string, currentAction: 'buy' | 'sell' | null = null): Promise<void> => {
    if (!supabase || !user) throw new Error('Not authenticated');
    if (!isValidUUID(postId) || isTempId(postId)) {
      setError('Post is not yet saved');
      return;
    }

    // Ensure subscription is active for real-time confirmations
    subscribeToPost(postId);

    // Optimistic update
    const prevStats = postStats[postId] || { commentCount: 0, buyCount: 0, sellCount: 0 };
    const prevSnapshot = { ...prevStats };
    let nextStats = { ...prevStats };

    if (currentAction === 'sell') {
      // Remove existing sell
      nextStats.sellCount = Math.max(0, nextStats.sellCount - 1);
    } else if (currentAction === 'buy') {
      // Switch from buy to sell
      nextStats.buyCount = Math.max(0, nextStats.buyCount - 1);
      nextStats.sellCount = nextStats.sellCount + 1;
    } else {
      // Add new sell
      nextStats.sellCount = nextStats.sellCount + 1;
    }

    setPostStats(prev => ({ ...prev, [postId]: nextStats }));

    try {
      // Single-roundtrip RPC handles toggle and opposite-action removal atomically
      await callTogglePostAction(postId, 'sell');
      // Realtime subscription will reconcile counts; optimistic UI already applied
    } catch (err) {
      console.error('Error toggling sell vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to update vote');
      // Rollback optimistic update on error
      setPostStats(prev => ({ ...prev, [postId]: prevSnapshot }));
    }
  };

  const getPostComments = useCallback((postId: string) => {
    return comments.filter(comment => comment.post_id === postId);
  }, [comments]);

  const getPostStats = useCallback((postId: string): PostStats => {
    return postStats[postId] || { commentCount: 0, buyCount: 0, sellCount: 0 };
  }, [postStats]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      Object.values(subscriptions).forEach((subs: any) => {
        if (subs.channel) subs.channel.unsubscribe();
      });
    };
  }, []);

  return (
    <CommentContext.Provider value={{
      comments, 
      postStats,
      loading, 
      error,
      addComment, 
      deleteComment,
      editComment,
      getPostComments,
      getPostStats,
      fetchCommentsForPost,
      toggleBuyVote,
      toggleSellVote,
      startPolling,
      stopPolling
    }}>
      {children}
    </CommentContext.Provider>
  );
}

export const useComments = () => {
  const context = useContext(CommentContext);
  if (!context) throw new Error('useComments must be used within CommentProvider');
  return context;
};
