"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Comment } from '../models/Comment';
import { useSupabase } from './SupabaseProvider';

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
  getPostComments: (postId: string) => Comment[];
  getPostStats: (postId: string) => PostStats;
  fetchCommentsForPost: (postId: string) => Promise<void>;
  toggleBuyVote: (postId: string) => Promise<void>;
  toggleSellVote: (postId: string) => Promise<void>;
}

const CommentContext = createContext<CommentContextType | null>(null);

export function CommentProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user } = useSupabase();
  const [comments, setComments] = useState<Comment[]>([]);
  const [postStats, setPostStats] = useState<Record<string, PostStats>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Record<string, any>>({});

  // Subscribe to real-time updates for a specific post
  const subscribeToPost = useCallback((postId: string) => {
    if (subscriptions[postId] || !supabase) return;

    // Subscribe to comments changes
    const commentsSubscription = supabase
      .channel(`comments-${postId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${postId}`
      }, async (payload) => {
        console.log('Comments change:', payload);
        await fetchCommentsForPost(postId);
        await updatePostStats(postId);
      })
      .subscribe();

    // Subscribe to buy votes changes
    const buyVotesSubscription = supabase
      .channel(`buy-votes-${postId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_actions',
        filter: `post_id=eq.${postId}`
      }, async (payload) => {
        console.log('Buy votes change:', payload);
        await updatePostStats(postId);
      })
      .subscribe();

    // Subscribe to sell votes changes
    const sellVotesSubscription = supabase
      .channel(`sell-votes-${postId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_actions',
        filter: `post_id=eq.${postId}`
      }, async (payload) => {
        console.log('Sell votes change:', payload);
        await updatePostStats(postId);
      })
      .subscribe();

    setSubscriptions(prev => ({
      ...prev,
      [postId]: {
        comments: commentsSubscription,
        buyVotes: buyVotesSubscription,
        sellVotes: sellVotesSubscription
      }
    }));
  }, [supabase, subscriptions]);

  // Update post statistics
  const updatePostStats = useCallback(async (postId: string) => {
    if (!supabase) return;

    try {
      const [commentsResponse, buyVotesResponse, sellVotesResponse] = await Promise.all([
        supabase
          .from('comments')
          .select('id')
          .eq('post_id', postId),
        supabase
          .from('post_actions')
          .select('id')
          .eq('post_id', postId)
          .eq('action_type', 'buy'),
        supabase
          .from('post_actions')
          .select('id')
          .eq('post_id', postId)
          .eq('action_type', 'sell')
      ]);

      const stats: PostStats = {
        commentCount: commentsResponse.data?.length || 0,
        buyCount: buyVotesResponse.data?.length || 0,
        sellCount: sellVotesResponse.data?.length || 0
      };

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
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedComments = data.map(comment => ({
        ...comment,
        profile: comment.profiles
      }));

      // Update comments state, replacing existing comments for this post
      setComments(prev => {
        const filtered = prev.filter(c => c.post_id !== postId);
        return [...filtered, ...formattedComments];
      });

      // Subscribe to this post if not already subscribed
      subscribeToPost(postId);
      
      // Update stats
      await updatePostStats(postId);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch comments');
    }
  }, [supabase, subscribeToPost, updatePostStats]);

  const addComment = async (postId: string, content: string): Promise<Comment> => {
    if (!supabase || !user) throw new Error('Not authenticated');

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

  const toggleBuyVote = async (postId: string): Promise<void> => {
    if (!supabase || !user) throw new Error('Not authenticated');

    try {
      // Check if user already has a buy vote
      const { data: existingVote } = await supabase
        .from('post_actions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('action_type', 'buy')
        .maybeSingle();

      if (existingVote) {
        // Remove buy vote
        await supabase
          .from('post_actions')
          .delete()
          .eq('id', existingVote.id);
      } else {
        // Remove any existing sell vote first
        await supabase
          .from('post_actions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('action_type', 'sell');

        // Add buy vote
        await supabase
          .from('post_actions')
          .insert({
            post_id: postId,
            user_id: user.id,
            action_type: 'buy'
          });
      }

      // Update stats will be triggered by subscription
    } catch (err) {
      console.error('Error toggling buy vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to update vote');
    }
  };

  const toggleSellVote = async (postId: string): Promise<void> => {
    if (!supabase || !user) throw new Error('Not authenticated');

    try {
      // Check if user already has a sell vote
      const { data: existingVote } = await supabase
        .from('post_actions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('action_type', 'sell')
        .maybeSingle();

      if (existingVote) {
        // Remove sell vote
        await supabase
          .from('post_actions')
          .delete()
          .eq('id', existingVote.id);
      } else {
        // Remove any existing buy vote first
        await supabase
          .from('post_actions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('action_type', 'buy');

        // Add sell vote
        await supabase
          .from('post_actions')
          .insert({
            post_id: postId,
            user_id: user.id,
            action_type: 'sell'
          });
      }

      // Update stats will be triggered by subscription
    } catch (err) {
      console.error('Error toggling sell vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to update vote');
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
        if (subs.comments) subs.comments.unsubscribe();
        if (subs.buyVotes) subs.buyVotes.unsubscribe();
        if (subs.sellVotes) subs.sellVotes.unsubscribe();
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
      getPostComments,
      getPostStats,
      fetchCommentsForPost,
      toggleBuyVote,
      toggleSellVote
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
