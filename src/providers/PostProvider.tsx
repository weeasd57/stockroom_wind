"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Post } from '../models/Post';
import { supabase } from '@/utils/supabase';
import { useSupabase } from './SupabaseProvider';

interface PostContextType {
  posts: Post[];
  loading: boolean;
  error: string | null;
  fetchPosts: (filter?: string) => Promise<void>;
  createPost: (post: Partial<Post>) => Promise<Post>;
  updatePost: (id: string, post: Partial<Post>) => Promise<Post>;
  deletePost: (id: string) => Promise<void>;
  getPostById: (id: string) => Post | undefined;
  getUserPosts: (userId: string) => Post[];
  optimisticAddPost: (post: Partial<Post>) => string; // Returns temp ID
  confirmPost: (tempId: string, actualPost: Post) => void;
  rollbackPost: (tempId: string) => void;
}

const PostContext = createContext<PostContextType | null>(null);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const { user, supabase: supabaseClient } = useSupabase();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async (filter?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url,
            id
          ),
          comments:post_comments (count),
          buy_votes:post_buy_votes (count),
          sell_votes:post_sell_votes (count)
        `)
        .order('created_at', { ascending: false });

      // Apply filters if needed
      if (filter === 'following' && user) {
        // Get following users first
        const { data: followingData } = await supabase
          .from('user_followings')
          .select('following_id')
          .eq('follower_id', user.id);
          
        if (followingData && followingData.length > 0) {
          const followingIds = followingData.map(f => f.following_id);
          query = query.in('user_id', followingIds);
        } else {
          // No following users, return empty
          setPosts([]);
          setLoading(false);
          return;
        }
      }

      const { data, error: fetchError } = await query.limit(50);
      
      if (fetchError) throw fetchError;

      // Format posts with correct structure
      const formattedPosts = (data || []).map(post => ({
        ...post,
        profile: post.profiles || {
          username: 'Unknown User',
          avatar_url: null
        },
        comment_count: post.comments?.[0]?.count || 0,
        buy_count: post.buy_votes?.[0]?.count || 0,
        sell_count: post.sell_votes?.[0]?.count || 0,
      }));

      setPosts(formattedPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    
    // Set up real-time subscription for posts
    if (supabaseClient) {
      const subscription = supabaseClient
        .channel('posts-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'posts'
        }, async (payload) => {
          console.log('Posts change:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Add new post optimistically
            const newPost = payload.new as Post;
            
            // Fetch profile data for the new post
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('username, avatar_url, id')
                .eq('id', newPost.user_id)
                .single();
                
              const formattedPost = {
                ...newPost,
                profile: profileData || { username: 'Unknown User', avatar_url: null },
                comment_count: 0,
                buy_count: 0,
                sell_count: 0,
              };
              
              setPosts(prev => [formattedPost, ...prev]);
            } catch (error) {
              console.error('Error fetching profile for new post:', error);
            }
          } else if (payload.eventType === 'UPDATE') {
            setPosts(prev => prev.map(post => 
              post.id === payload.new.id 
                ? { ...post, ...payload.new }
                : post
            ));
          } else if (payload.eventType === 'DELETE') {
            setPosts(prev => prev.filter(post => post.id !== payload.old.id));
          }
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [supabaseClient]);

  // Optimistic update for faster UI response
  const optimisticAddPost = useCallback((post: Partial<Post>): string => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticPost: Post = {
      id: tempId,
      user_id: user?.id || '',
      symbol: post.symbol || '',
      company_name: post.company_name || '',
      exchange: post.exchange || '',
      country: post.country || '',
      current_price: post.current_price || 0,
      target_price: post.target_price || 0,
      stop_loss_price: post.stop_loss_price || 0,
      description: post.description || '',
      strategy: post.strategy || '',
      sentiment: post.sentiment || 'neutral',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      target_reached: false,
      stop_loss_triggered: false,
      ...post,
      profile: {
        username: user?.email?.split('@')[0] || 'You',
        avatar_url: null,
        id: user?.id || ''
      },
      comment_count: 0,
      buy_count: 0,
      sell_count: 0,
      syncing: true as any, // UI indicator
    } as Post;

    setPosts(prev => [optimisticPost, ...prev]);
    return tempId;
  }, [user]);

  const confirmPost = useCallback((tempId: string, actualPost: Post) => {
    setPosts(prev => prev.map(post => 
      post.id === tempId 
        ? { 
            ...actualPost,
            profile: post.profile, // Keep the profile from optimistic update
            comment_count: 0,
            buy_count: 0,
            sell_count: 0,
          }
        : post
    ));
  }, []);

  const rollbackPost = useCallback((tempId: string) => {
    setPosts(prev => prev.filter(post => post.id !== tempId));
  }, []);

  const createPost = async (post: Partial<Post>): Promise<Post> => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);

    // Create optimistic post immediately for UI
    const tempId = optimisticAddPost(post);

    try {
      // Create the actual post in Supabase
      const postData = {
        user_id: user.id,
        symbol: post.symbol,
        company_name: post.company_name,
        exchange: post.exchange,
        country: post.country,
        current_price: post.current_price,
        target_price: post.target_price,
        stop_loss_price: post.stop_loss_price,
        description: post.description,
        strategy: post.strategy,
        sentiment: post.sentiment || 'neutral',
        target_reached: false,
        stop_loss_triggered: false,
        ...post
      };

      const { data, error: createError } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (createError) throw createError;

      // Confirm the optimistic update with actual data
      confirmPost(tempId, data);
      
      return data as Post;
    } catch (err) {
      // Rollback optimistic update on error
      rollbackPost(tempId);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create post';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updatePost = async (id: string, post: Partial<Post>): Promise<Post> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .update(post)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      
      setPosts(posts.map(p => p.id === id ? { ...p, ...data } : p));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id: string): Promise<void> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setPosts(posts.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPostById = useCallback((id: string) => {
    return posts.find(post => post.id === id);
  }, [posts]);

  const getUserPosts = useCallback((userId: string) => {
    return posts.filter(post => post.user_id === userId);
  }, [posts]);

  return (
    <PostContext.Provider value={{ 
      posts, loading, error, 
      fetchPosts, createPost, updatePost, deletePost,
      getPostById, getUserPosts,
      optimisticAddPost, confirmPost, rollbackPost
    }}>
      {children}
    </PostContext.Provider>
  );
}

export const usePosts = () => {
  const context = useContext(PostContext);
  if (!context) throw new Error('usePosts must be used within PostProvider');
  return context;
};
