declare global {
  interface Window {
    postProviderCallbacks?: {
      callbacks: Set<(post: Post) => void>;
      onPostCreated: (callback: (post: Post) => void) => () => void;
      notifyPostCreated: (post: Post) => void;
    };
  }
}

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Post } from '../models/Post';
import { User } from '../models/User'; // Corrected import path
import { supabase } from '@/utils/supabase';
import { useSupabase } from './SupabaseProvider';

// Define a type for the raw data coming directly from Supabase query
interface SupabaseRawPost {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  symbol: string;
  company_name: string;
  country: string;
  exchange: string;
  current_price: number;
  target_price: number;
  stop_loss_price: number;
  strategy: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  created_at: string; // Dates are string from Supabase, convert to Date later if needed
  updated_at: string;
  description?: string;
  is_public: boolean;
  status: string;
  target_reached: boolean;
  stop_loss_triggered: boolean;
  target_reached_date?: string;
  stop_loss_triggered_date?: string;
  last_price_check?: string;
  last_price?: number;
  closed: boolean;
  initial_price: number;
  high_price: number;
  target_high_price: number;
  target_hit_time?: string;
  postDateAfterPriceDate: boolean;
  postAfterMarketClose: boolean;
  noDataAvailable: boolean;
  status_message?: string;
  profiles: User; // Supabase returns 'profiles' as the alias for user_id
  comment_count: number; // Directly from posts_with_action_counts view
  buy_count: number; // Directly from posts_with_action_counts view
  sell_count: number; // Directly from posts_with_action_counts view
}

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
  // New function to register profile update callbacks
  onPostCreated: (callback: (post: Post) => void) => () => void;
}

// Extend Post interface for optimistic updates
interface PostWithOptimisticStatus extends Post {
  syncing?: boolean;
}

const PostContext = createContext<PostContextType | null>(null);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const { user, supabase: supabaseClient } = useSupabase();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Callbacks for when posts are created
  const [postCreatedCallbacks, setPostCreatedCallbacks] = useState<Set<(post: Post) => void>>(new Set());

  // Register callback for post creation events
  const onPostCreated = useCallback((callback: (post: Post) => void) => {
    setPostCreatedCallbacks(prev => new Set(prev).add(callback));
    
    // Return unsubscribe function
    return () => {
      setPostCreatedCallbacks(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  // Helper function to notify all registered callbacks
  const notifyPostCreated = useCallback((post: Post) => {
    postCreatedCallbacks.forEach(callback => {
      try {
        callback(post);
      } catch (error) {
        console.error('Error in post created callback:', error);
      }
    });
    
    // Also notify global callbacks for cross-provider communication
    if (typeof window !== 'undefined' && window.postProviderCallbacks) {
      try {
        window.postProviderCallbacks.notifyPostCreated(post);
      } catch (error) {
        console.error('Error in global post created callback:', error);
      }
    }
  }, [postCreatedCallbacks]);

  // Set up global callbacks for cross-provider communication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const callbacks = {
        callbacks: new Set<(post: Post) => void>(),
        onPostCreated: (callback: (post: Post) => void) => {
          callbacks.callbacks.add(callback);
          return () => {
            callbacks.callbacks.delete(callback);
          };
        },
        notifyPostCreated: (post: Post) => {
          callbacks.callbacks.forEach((callback: (post: Post) => void) => {
            try {
              callback(post);
            } catch (error) {
              console.error('Error in global callback:', error);
            }
          });
        }
      };
      window.postProviderCallbacks = callbacks;
    }
    
    return () => {
      if (typeof window !== 'undefined' && window.postProviderCallbacks) {
        delete window.postProviderCallbacks;
      }
    };
  }, []);

  const fetchPosts = useCallback(async (filter?: string) => {
    console.log(`[PostProvider] fetchPosts called with filter: ${filter || 'none'}`);
    setLoading(true);
    setError(null);
    
    try {
      // If filter is 'following' and no user is authenticated, return empty posts immediately
      if (filter === 'following' && !user) {
        setPosts([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('posts_with_action_counts') // Use the correct view name
        .select('*,profiles:user_id(username,avatar_url,id)') // Select all columns from view + profile
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
      const formattedPosts: Post[] = (data as SupabaseRawPost[] || []).map(post => ({
        ...post,
        profile: post.profiles || {
          username: 'Unknown User',
          avatar_url: null,
          id: '',
          full_name: null,
          bio: null,
          website: null,
          favorite_markets: null,
          created_at: new Date().toISOString(),
          updated_at: null,
          email: null,
          last_sign_in: null,
          success_posts: 0,
          loss_posts: 0,
          background_url: null,
          experience_score: 0,
          followers: 0,
          following: 0,
        } as User, // Ensure default profile is of type User
        comment_count: post.comment_count || 0,
        buy_count: post.buy_count || 0,
        sell_count: post.sell_count || 0,
        created_at: new Date(post.created_at),
        updated_at: new Date(post.updated_at),
        // Convert other date strings to Date objects if they exist
        target_reached_date: post.target_reached_date ? new Date(post.target_reached_date) : undefined,
        stop_loss_triggered_date: post.stop_loss_triggered_date ? new Date(post.stop_loss_triggered_date) : undefined,
        last_price_check: post.last_price_check ? new Date(post.last_price_check) : undefined,
        target_hit_time: post.target_hit_time ? new Date(post.target_hit_time) : undefined,
      }));

      setPosts(formattedPosts);
      console.log(`[PostProvider] Successfully fetched ${formattedPosts.length} posts.`);
    } catch (err) {
      console.error('[PostProvider] Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  }, [user, supabaseClient]); // Add user and supabaseClient as dependencies

  useEffect(() => {
    console.log('[PostProvider] useEffect for initial fetchPosts and real-time subscription fired.');
    fetchPosts();
    
    // Set up real-time subscription for posts
    if (supabaseClient) {
      console.log('[PostProvider] Setting up real-time subscription.');
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
            const rawNewPost = payload.new as SupabaseRawPost;
            
            // Fetch profile data for the new post
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('username, avatar_url, id, full_name, bio, website, favorite_markets, created_at, updated_at, email, last_sign_in, success_posts, loss_posts, background_url, experience_score, followers, following')
                .eq('id', rawNewPost.user_id)
                .single();
                
              const formattedPost: Post = {
                ...rawNewPost,
                profile: profileData || {
                  username: 'Unknown User',
                  avatar_url: null,
                  id: '',
                  full_name: null,
                  bio: null,
                  website: null,
                  favorite_markets: null,
                  created_at: new Date().toISOString(),
                  updated_at: null,
                  email: null,
                  last_sign_in: null,
                  success_posts: 0,
                  loss_posts: 0,
                  background_url: null,
                  experience_score: 0,
                  followers: 0,
                  following: 0,
                } as User,
                comment_count: 0,
                buy_count: 0,
                sell_count: 0,
                created_at: new Date(rawNewPost.created_at),
                updated_at: new Date(rawNewPost.updated_at),
                target_reached_date: rawNewPost.target_reached_date ? new Date(rawNewPost.target_reached_date) : undefined,
                stop_loss_triggered_date: rawNewPost.stop_loss_triggered_date ? new Date(rawNewPost.stop_loss_triggered_date) : undefined,
                last_price_check: rawNewPost.last_price_check ? new Date(rawNewPost.last_price_check) : undefined,
                target_hit_time: rawNewPost.target_hit_time ? new Date(rawNewPost.target_hit_time) : undefined,
              };
              
              setPosts(prev => [formattedPost, ...prev]);
            } catch (error) {
              console.error('Error fetching profile for new post:', error);
            }
          } else if (payload.eventType === 'UPDATE') {
            // For updates, we can directly merge, but need to ensure profile and counts are preserved
            // Or re-fetch the post to get full updated data, depending on complexity of updates.
            // For now, let's assume basic updates don't change profile/counts in a way that breaks display.
            setPosts(prev => prev.map(post => 
              post.id === payload.new.id 
                ? { 
                    ...post, 
                    ...(payload.new as Partial<Post>),
                    // Preserve profile and counts if they are not part of the direct update payload
                    profile: (post as any).profile, 
                    comment_count: (post as any).comment_count, 
                    buy_count: (post as any).buy_count, 
                    sell_count: (post as any).sell_count,
                    created_at: new Date((payload.new as any).created_at || post.created_at), // Ensure Date type
                    updated_at: new Date((payload.new as any).updated_at || post.updated_at), // Ensure Date type
                  }
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
    const optimisticPost: PostWithOptimisticStatus = {
      id: tempId,
      user_id: user?.id || '',
      content: post.content || '', // Ensure content is always a string
      image_url: post.image_url,
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
      created_at: new Date(),
      updated_at: new Date(),
      target_reached: post.target_reached || false,
      stop_loss_triggered: post.stop_loss_triggered || false,
      closed: post.closed || false,
      initial_price: post.initial_price || 0,
      high_price: post.high_price || 0,
      target_high_price: post.target_high_price || 0,
      postDateAfterPriceDate: post.postDateAfterPriceDate || false,
      postAfterMarketClose: post.postAfterMarketClose || false,
      noDataAvailable: post.noDataAvailable || false,
      ...post,
      comment_count: 0,
      buy_count: 0,
      sell_count: 0,
      is_public: post.is_public || false,
      status: post.status || 'open', // Default to 'open' if not provided
      profile: {
        username: user?.email?.split('@')[0] || 'You',
        avatar_url: null,
        id: user?.id || '',
        full_name: null,
        bio: null,
        website: null,
        favorite_markets: null,
        created_at: new Date().toISOString(),
        updated_at: null,
        email: user?.email || null,
        last_sign_in: null,
        success_posts: 0,
        loss_posts: 0,
        background_url: null,
        experience_score: 0,
        followers: 0,
        following: 0,
      },
    };

    setPosts(prev => [optimisticPost, ...prev]);
    return tempId;
  }, [user]);

  const confirmPost = useCallback((tempId: string, actualPost: Post) => {
    setPosts(prev => prev.map(post => 
      post.id === tempId 
        ? actualPost
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
        target_reached: post.target_reached || false,
        stop_loss_triggered: post.stop_loss_triggered || false,
        closed: post.closed || false,
        initial_price: post.initial_price || 0,
        high_price: post.high_price || 0,
        target_high_price: post.target_high_price || 0,
        // IMPORTANT: these columns were created without quotes in SQL using camelCase,
        // so Postgres folded them to lowercase identifiers. The API expects the exact
        // column names. Use lowercase keys here to avoid PGRST204.
        postdateafterpricedate: post.postDateAfterPriceDate || false,
        postaftermarketclose: post.postAfterMarketClose || false,
        ...(post.noDataAvailable ? { nodataavailable: true } : {}),
        status_message: post.status_message,
        target_reached_date: post.target_reached_date,
        stop_loss_triggered_date: post.stop_loss_triggered_date,
        last_price_check: post.last_price_check,
        target_hit_time: post.target_hit_time,
        content: post.content, // Ensure content is explicitly included
        image_url: post.image_url, // Ensure image_url is explicitly included
        is_public: post.is_public || false, // Add is_public
        status: post.status || 'open', // Add status
      };

      const { data, error: createError } = await supabase
        .from('posts')
        .insert(postData)
        .select('id') // Explicitly select only the ID
        .single();

      if (createError) {
        console.error('[PostProvider] createPost insert error:', {
          message: (createError as any).message,
          details: (createError as any).details,
          hint: (createError as any).hint,
          code: (createError as any).code,
        });
        throw new Error((createError as any).message || (createError as any).details || 'Failed to create post');
      }

      // Fetch the newly created post with full profile and counts
      const { data: fetchedPostData, error: fetchNewPostError } = await supabase
        .from('posts_with_action_counts') // Use the correct view name
        .select('*,profiles:user_id(username,avatar_url,id)') // Select all columns from view + profile
        .eq('id', data.id)
        .single();

      if (fetchNewPostError) throw fetchNewPostError;

      const formattedNewPost: Post = {
        ...fetchedPostData,
        profile: fetchedPostData.profiles || { username: 'Unknown User', avatar_url: null, id: '' } as User,
        comment_count: fetchedPostData.comment_count || 0,
        buy_count: fetchedPostData.buy_count || 0,
        sell_count: fetchedPostData.sell_count || 0,
        created_at: new Date(fetchedPostData.created_at),
        updated_at: new Date(fetchedPostData.updated_at),
        target_reached_date: fetchedPostData.target_reached_date ? new Date(fetchedPostData.target_reached_date) : undefined,
        stop_loss_triggered_date: fetchedPostData.stop_loss_triggered_date ? new Date(fetchedPostData.stop_loss_triggered_date) : undefined,
        last_price_check: fetchedPostData.last_price_check ? new Date(fetchedPostData.last_price_check) : undefined,
        target_hit_time: fetchedPostData.target_hit_time ? new Date(fetchedPostData.target_hit_time) : undefined,
      } as Post; // Cast to Post to ensure type safety

      // Confirm the optimistic update with actual data
      confirmPost(tempId, formattedNewPost);
      
      // Notify ProfileProvider and other subscribers about the new post
      notifyPostCreated(formattedNewPost);
      
      return formattedNewPost;
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
      // Build a safe update payload that only includes valid DB columns
      const updateData: Record<string, any> = {};
      const assignIf = (key: string, value: any) => {
        if (value !== undefined) updateData[key] = value;
      };

      // Map fields to DB columns
      assignIf('content', post.content);
      assignIf('image_url', post.image_url);
      assignIf('symbol', post.symbol);
      assignIf('company_name', post.company_name);
      assignIf('exchange', post.exchange);
      assignIf('country', post.country);
      assignIf('current_price', post.current_price);
      assignIf('target_price', post.target_price);
      assignIf('stop_loss_price', post.stop_loss_price);
      assignIf('description', post.description);
      assignIf('strategy', post.strategy);
      // Do NOT include 'sentiment' (not a DB column)
      assignIf('target_reached', post.target_reached);
      assignIf('stop_loss_triggered', post.stop_loss_triggered);
      assignIf('closed', post.closed);
      assignIf('initial_price', post.initial_price);
      assignIf('high_price', post.high_price);
      assignIf('target_high_price', post.target_high_price);
      // Lowercase DB identifiers for folded camelCase columns
      if (post.postDateAfterPriceDate !== undefined) updateData.postdateafterpricedate = post.postDateAfterPriceDate;
      if (post.postAfterMarketClose !== undefined) updateData.postaftermarketclose = post.postAfterMarketClose;
      if (post.noDataAvailable) updateData.nodataavailable = true;
      assignIf('status_message', post.status_message);
      assignIf('target_reached_date', post.target_reached_date as any);
      assignIf('stop_loss_triggered_date', post.stop_loss_triggered_date as any);
      assignIf('last_price_check', post.last_price_check as any);
      // Do NOT include 'last_price' (not a DB column)
      assignIf('target_hit_time', post.target_hit_time as any);
      assignIf('is_public', post.is_public);
      assignIf('status', post.status);

      const { data, error } = await supabase
        .from('posts')
        .update(updateData)
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
      optimisticAddPost, confirmPost, rollbackPost,
      onPostCreated
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

// Also export as named export for compatibility
export { usePosts as usePostsProvider };
