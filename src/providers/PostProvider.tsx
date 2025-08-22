'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';

type Post = any;

type PostsContextType = {
  posts: Post[];
  loading: boolean;
  error: string | null;
  fetchPosts: (mode?: 'following' | 'all' | 'trending') => Promise<void>;
  createPost: (postData: any) => Promise<Post>;
  onPostCreated: (cb: (post: Post) => void) => () => void;
};

const PostsContext = createContext<PostsContextType | undefined>(undefined);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const { supabase, getPosts, createPost: supaCreatePost, user } = useSupabase();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const subscribersRef = useRef<Array<(post: Post) => void>>([]);

  const notifyCreated = (post: Post) => {
    subscribersRef.current.forEach(cb => {
      try { cb(post); } catch {}
    });
    // Also broadcast via a lightweight global bridge for other providers
    try {
      if (typeof window !== 'undefined') {
        (window as any).postProviderCallbacks = (window as any).postProviderCallbacks || {
          onPostCreatedCallbacks: [] as Array<(p: Post) => void>,
          onPostCreated(fn: (p: Post) => void) {
            this.onPostCreatedCallbacks.push(fn);
            return () => {
              this.onPostCreatedCallbacks = this.onPostCreatedCallbacks.filter((f: any) => f !== fn);
            };
          },
          emit(postArg: Post) {
            this.onPostCreatedCallbacks.forEach((fn: any) => {
              try { fn(postArg); } catch {}
            });
          }
        };
        (window as any).postProviderCallbacks.emit(post);
      }
    } catch {}
  };

  const fetchPosts = useCallback<PostsContextType['fetchPosts']>(async (mode) => {
    setLoading(true);
    setError(null);
    try {
      let data: any[] | null = null;

      if (mode === 'following') {
        if (!user?.id) {
          setPosts([]);
          setLoading(false);
          return;
        }

        // Get list of users current user is following
        const { data: followingRows, error: followErr } = await supabase
          .from('user_followings')
          .select('following_id')
          .eq('follower_id', user.id);
        if (followErr) throw followErr;

        const followingIds = (followingRows || []).map((r: any) => r.following_id).filter(Boolean);
        if (followingIds.length === 0) {
          setPosts([]);
          setLoading(false);
          return;
        }

        // Fetch posts only from followed users
        const { data: postsData, error: postsErr } = await supabase
          .from('posts')
          .select('*, profiles(username, avatar_url)')
          .in('user_id', followingIds)
          .order('created_at', { ascending: false });
        if (postsErr) throw postsErr;
        data = postsData as any[];
      } else {
        // 'all' or default
        data = await getPosts();
      }

      // If trending, sort by engagement descending
      if (mode === 'trending' && Array.isArray(data)) {
        data = [...data].sort((a: any, b: any) => {
          const aEng = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
          const bEng = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
          return bEng - aEng;
        });
      }

      setPosts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  }, [supabase, getPosts, user?.id]);

  const createPost: PostsContextType['createPost'] = async (postData: any) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticPost = {
      id: tempId,
      user_id: user?.id || null,
      created_at: new Date().toISOString(),
      comment_count: 0,
      buy_count: 0,
      sell_count: 0,
      ...postData,
    };
    setPosts(prev => [optimisticPost, ...prev]);
    try {
      const saved = await supaCreatePost(postData);
      setPosts(prev => {
        const withoutTemp = prev.filter(p => p.id !== tempId);
        return [saved, ...withoutTemp];
      });
      notifyCreated(saved);
      return saved;
    } catch (e: any) {
      setPosts(prev => prev.filter(p => p.id !== tempId));
      setError(e?.message || 'Failed to create post');
      throw e;
    }
  };

  const onPostCreated: PostsContextType['onPostCreated'] = (cb) => {
    subscribersRef.current.push(cb);
    return () => {
      subscribersRef.current = subscribersRef.current.filter(fn => fn !== cb);
    };
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const value: PostsContextType = {
    posts,
    loading,
    error,
    fetchPosts,
    createPost,
    onPostCreated,
  };

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

export const usePosts = () => {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error('usePosts must be used within a PostProvider');
  return ctx;
};