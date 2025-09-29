'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';

type Post = any;

type PostsContextType = {
  posts: Post[];
  // feedPosts respects provider-level flags like excludeCurrentUser
  feedPosts: Post[];
  myPosts: Post[];
  loading: boolean;
  error: string | null;
  fetchPosts: (mode?: 'following' | 'all' | 'trending', opts?: { excludeCurrentUser?: boolean; userId?: string }) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
  createPost: (postData: any) => Promise<Post>;
  onPostCreated: (cb: (post: Post) => void) => () => void;
};

const PostsContext = createContext<PostsContextType | undefined>(undefined);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const { supabase, getPostsPage, createPost: supaCreatePost, user } = useSupabase();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const subscribersRef = useRef<Array<(post: Post) => void>>([]);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const nextCursorRef = useRef<string | null>(null); // created_at cursor for keyset pagination
  const modeRef = useRef<'following' | 'all' | 'trending' | undefined>(undefined);
  const followingIdsRef = useRef<string[] | null>(null);
  const userIdFilterRef = useRef<string | null>(null); // Track userId filter for view-profile
  const PAGE_SIZE = 20;
  // Whether to exclude current user's posts for the consumer feed (Home)
  const [excludeSelf, setExcludeSelf] = useState<boolean>(false);

  // Fetch a single post from the view with stats and attach profile
  const fetchPostWithStats = useCallback(async (postId: string) => {
    try {
      const { data: rows, error } = await supabase
        .from('posts_with_stats')
        .select('*')
        .eq('id', postId)
        .limit(1);
      if (error) throw error;
      if (!rows || rows.length === 0) return null;
      const row: any = rows[0];
      if (row?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('id', row.user_id)
          .single();
        (row as any).profile = profile || null;
      } else {
        (row as any).profile = null;
      }
      return row;
    } catch (e) {
      return null;
    }
  }, [supabase]);

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

  const fetchPosts = useCallback<PostsContextType['fetchPosts']>(async (mode, opts) => {
    setLoading(true);
    setError(null);
    try {
      let data: any[] | null = null;
      modeRef.current = mode;
      followingIdsRef.current = null;
      userIdFilterRef.current = opts?.userId || null;
      // Store consumer preference for excluding current user's posts in the feed
      setExcludeSelf(Boolean(opts?.excludeCurrentUser));

      // If userId is provided (view-profile mode), fetch only that user's posts
      if (opts?.userId) {
        console.log('[PostProvider] Fetching posts for userId:', opts.userId);
        data = await getPostsPage({ limit: PAGE_SIZE, before: null, userIds: [opts.userId] });
      } else if (mode === 'following') {
        if (!user?.id) {
          setPosts([]);
          setLoading(false);
          setHasMore(false);
          nextCursorRef.current = null;
          return;
        }

        // Get list of users current user is following
        const { data: followingRows, error: followErr } = await supabase
          .from('user_followings')
          .select('following_id')
          .eq('follower_id', user.id);
        if (followErr) throw followErr;

        const followingIds = (followingRows || []).map((r: any) => r.following_id).filter(Boolean);
        followingIdsRef.current = followingIds;
        if (followingIds.length === 0) {
          setPosts([]);
          setLoading(false);
          setHasMore(false);
          nextCursorRef.current = null;
          return;
        }

        // First page from followed users via paginated API
        data = await getPostsPage({ limit: PAGE_SIZE, before: null, userIds: followingIds });
      } else {
        // 'all' or 'trending' -> fetch first page ordered by created_at desc
        data = await getPostsPage({ limit: PAGE_SIZE, before: null });
      }

      // If trending, sort by engagement descending
      if (mode === 'trending' && Array.isArray(data)) {
        data = [...data].sort((a: any, b: any) => {
          const aEng = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
          const bEng = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
          return bEng - aEng;
        });
      }

      const list = Array.isArray(data) ? data : [];
      setPosts(list);
      // Setup cursor and hasMore
      nextCursorRef.current = list.length > 0 ? String(list[list.length - 1].created_at) : null;
      setHasMore(list.length === PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  }, [supabase, getPostsPage, user?.id]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const before = nextCursorRef.current;
    if (!before) { setHasMore(false); return; }
    setLoadingMore(true);
    try {
      const mode = modeRef.current;
      const userId = userIdFilterRef.current;
      let page: any[] = [];
      if (userId) {
        // View-profile mode: load more posts from specific user
        page = await getPostsPage({ limit: PAGE_SIZE, before, userIds: [userId] });
      } else if (mode === 'following') {
        const ids = followingIdsRef.current || [];
        if (ids.length === 0) { setHasMore(false); return; }
        page = await getPostsPage({ limit: PAGE_SIZE, before, userIds: ids });
      } else {
        page = await getPostsPage({ limit: PAGE_SIZE, before });
      }

      setPosts(prev => {
        const combined = [...prev, ...page];
        if (mode === 'trending') {
          combined.sort((a: any, b: any) => {
            const aEng = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
            const bEng = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
            return bEng - aEng;
          });
        }
        return combined;
      });

      // Update cursor
      if (page.length > 0) {
        nextCursorRef.current = String(page[page.length - 1].created_at);
      }
      setHasMore(page.length === PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message || 'Failed to load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [getPostsPage, loadingMore]);

  // Subscribe to realtime updates for posts (price checks, status changes)
  useEffect(() => {
    if (!supabase) return;
    
    // Throttle real-time updates to prevent excessive re-renders
    let updateTimeout: NodeJS.Timeout | null = null;
    const pendingUpdates = new Map<string, any>();

    const processUpdates = () => {
      if (pendingUpdates.size === 0) return;
      
      setPosts(prev => {
        let next = [...prev];
        let hasChanges = false;
        
        pendingUpdates.forEach((updateData, postId) => {
          const idx = next.findIndex(p => p.id === postId);
          if (idx !== -1) {
            next[idx] = { ...next[idx], ...updateData };
            hasChanges = true;
          }
        });
        
        return hasChanges ? next : prev;
      });
      
      pendingUpdates.clear();
    };

    const channel = supabase
      .channel('posts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload: any) => {
        const evt = payload.eventType;
        const newRow = payload.new;
        const oldRow = payload.old;

        if (evt === 'INSERT' && newRow) {
          // Respect userId filter: in view-profile mode, only include posts by that user
          const userId = userIdFilterRef.current;
          if (userId && newRow.user_id !== userId) return;
          
          // Respect mode: in 'following' only include posts by followed users
          const mode = modeRef.current;
          if (mode === 'following') {
            const ids = followingIdsRef.current || [];
            if (!ids.includes(newRow.user_id)) return;
          }

          // Fetch enriched row from posts_with_stats + profile then prepend if not exists
          fetchPostWithStats(newRow.id).then((full) => {
            if (!full) return;
            setPosts(prev => {
              if (prev.some(p => p.id === full.id)) return prev;
              const combined = [full, ...prev];
              if (modeRef.current === 'trending') {
                combined.sort((a: any, b: any) => {
                  const aEng = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
                  const bEng = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
                  return bEng - aEng;
                });
              }
              return combined;
            });
          }).catch(() => {});
        } else if (evt === 'UPDATE' && newRow) {
          // Throttle UPDATE events by batching them
          const updateData: any = { ...newRow };
          if (newRow.price_checks) {
            try {
              updateData.price_checks = typeof newRow.price_checks === 'string'
                ? JSON.parse(newRow.price_checks)
                : newRow.price_checks;
            } catch (e) {
              console.warn('Failed to parse price_checks:', e);
            }
          }
          
          // Add to pending updates
          pendingUpdates.set(newRow.id, updateData);
          
          // Debounce the actual update
          if (updateTimeout) clearTimeout(updateTimeout);
          updateTimeout = setTimeout(processUpdates, 300);
          
        } else if (evt === 'DELETE' && oldRow) {
          setPosts(prev => prev.filter(p => p.id !== oldRow.id));
        }
      })
      .subscribe();

    return () => {
      try { 
        channel.unsubscribe(); 
        if (updateTimeout) clearTimeout(updateTimeout);
      } catch {}
    };
  }, [supabase, fetchPostWithStats]);

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
      console.log('[PostProvider] CRITICAL - Creating post with data:', {
        hasImageUrl: !!postData.image_url,
        imageUrl: postData.image_url,
        imageUrlLength: postData.image_url?.length,
        allKeys: Object.keys(postData),
        fullData: JSON.stringify(postData)
      });
      
      // Ensure image_url is passed correctly
      const dataToSave = {
        ...postData,
        image_url: postData.image_url || null
      };
      
      const saved = await supaCreatePost(dataToSave);
      
      console.log('[PostProvider] Post created:', {
        savedId: saved?.id,
        savedImageUrl: saved?.image_url,
        hasImageUrl: !!saved?.image_url
      });
      
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

  // Initial fetch only on mount
  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const value: PostsContextType = {
    posts,
    feedPosts: useMemo(() => {
      if (excludeSelf && user?.id) {
        return posts.filter((p: any) => p?.user_id !== user.id);
      }
      return posts;
    }, [posts, excludeSelf, user?.id]),
    myPosts: useMemo(() => {
      const uid = user?.id;
      if (!uid) return [] as Post[];
      return posts.filter((p: any) => p?.user_id === uid);
    }, [posts, user?.id]),
    loading,
    error,
    fetchPosts,
    loadMore,
    hasMore,
    loadingMore,
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