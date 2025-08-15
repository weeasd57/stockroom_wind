"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Post } from '../models/Post';
import { fetchWithTimeout } from '../services/api';
import { supabase } from '@/utils/supabase';

interface PostContextType {
  posts: Post[];
  loading: boolean;
  error: string | null;
  fetchPosts: () => Promise<void>;
  createPost: (post: Partial<Post>) => Promise<Post>;
  updatePost: (id: string, post: Partial<Post>) => Promise<Post>;
  deletePost: (id: string) => Promise<void>;
  getPostById: (id: string) => Post | undefined;
  getUserPosts: (userId: string) => Post[];
}

const PostContext = createContext<PostContextType | null>(null);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await fetchWithTimeout('/api/posts');
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    const interval = setInterval(fetchPosts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const createPost = async (post: Partial<Post>): Promise<Post> => {
    setLoading(true);
    // Create optimistic post to show immediately in dashboard/profile
    const tempId = `temp-${Date.now()}`;
    const optimisticPost: Post = {
      // @ts-ignore allow partial fields
      ...post,
      id: tempId,
      created_at: new Date().toISOString(),
      syncing: true as any, // marker for UI
    } as Post;

    setPosts(prev => [optimisticPost, ...prev]);

    try {
      // Attach user token so server-side route can satisfy RLS
      let authHeader: Record<string, string> = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) authHeader.Authorization = `Bearer ${token}`;
      } catch (e) {
        // ignore and let server handle anon client fallback
      }

      const created = await fetchWithTimeout('/api/posts', {
        method: 'POST',
        body: JSON.stringify(post),
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
      });

      // Replace optimistic post with real one returned from server
      setPosts(prev => prev.map(p => (p.id === tempId ? created : p)));

      return created as Post;
    } catch (err) {
      // Rollback optimistic post on failure
      setPosts(prev => prev.filter(p => p.id !== tempId));
      setError(err instanceof Error ? err.message : 'Failed to create post');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePost = async (id: string, post: Partial<Post>): Promise<Post> => {
    setLoading(true);
    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      });
      const updatedPost = await response.json();
      setPosts(posts.map(p => p.id === id ? updatedPost : p));
      return updatedPost;
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
      await fetch(`/api/posts/${id}`, { method: 'DELETE' });
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
      getPostById, getUserPosts
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
