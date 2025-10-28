'use client';
import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { calculatePostStats, calculateSuccessRate } from '@/lib/utils';

type Post = any;

type PostsContextType = {
  posts: Post[];
  // feedPosts respects provider-level flags like excludeCurrentUser
  feedPosts: Post[];
  myPosts: Post[];
  myLoading: boolean;
  myHasMore: boolean;
  loading: boolean;
  error: string | null;
  fetchPosts: (mode?: 'following' | 'all' | 'trending', opts?: { excludeCurrentUser?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
  // Current user's posts controls
  fetchMyPosts: () => Promise<void>;
  loadMoreMyPosts: () => Promise<void>;
  postStats: { totalPosts: number; successfulPosts: number; lossPosts: number; successRate: number };
  // DB-accurate stats for current user (independent of pagination)
  myStats: { totalPosts: number; successfulPosts: number; lossPosts: number; openPosts: number; successRate: number };
  refreshMyStats: () => Promise<void>;
  createPost: (postData: any) => Promise<Post>;
  onPostCreated: (cb: (post: Post) => void) => () => void;
  updateUserPosts: (userPosts: Post[]) => void;
};

const PostsContext = createContext<PostsContextType | undefined>(undefined);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const { supabase, getPostsPage, createPost: supaCreatePost, user } = useSupabase();
  const [posts, setPosts] = useState<Post[]>([]);
  // Dedicated state for current user's posts (profile/dashboard)
  const [myPostsState, setMyPostsState] = useState<Post[]>([]);
  const [myLoading, setMyLoading] = useState<boolean>(false);
  const [myHasMore, setMyHasMore] = useState<boolean>(false);
  const myBeforeCursorRef = useRef<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const subscribersRef = useRef<Array<(post: Post) => void>>([]);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const nextCursorRef = useRef<string | null>(null); // created_at cursor for keyset pagination
  const modeRef = useRef<'following' | 'all' | 'trending' | undefined>(undefined);
  const followingIdsRef = useRef<string[] | null>(null);
  const PAGE_SIZE = 20; // feed page size
  const MY_PAGE_SIZE = 25; // initial page size for current user's posts (dashboard/profile)
  // Whether to exclude current user's posts for the consumer feed (Home)
  const [excludeSelf, setExcludeSelf] = useState<boolean>(false);

  // Accurate DB-backed stats for the current user's posts
  const [myStats, setMyStats] = useState({ totalPosts: 0, successfulPosts: 0, lossPosts: 0, openPosts: 0, successRate: 0 });
  const statsRefreshTimeoutRef = useRef<any>(null);

  const refreshMyStats = useCallback(async () => {
    console.log('🔄 [POST_PROVIDER] refreshMyStats called for user:', user?.id);
    
    if (!user?.id) {
      console.warn('🚨 [POST_PROVIDER] No user ID, setting empty stats');
      setMyStats({ totalPosts: 0, successfulPosts: 0, lossPosts: 0, openPosts: 0, successRate: 0 });
      return;
    }
    
    try {
      console.log('📊 [POST_PROVIDER] Fetching stats from database for user:', user.id);
      
      // Debug: Check what status values actually exist - try posts table first
      const statusDebugRes = await supabase
        .from('posts')
        .select('id, status, target_reached, stop_loss_triggered')
        .eq('user_id', user.id)
        .limit(5);
      
      console.log('🔍 [POST_PROVIDER] Status debug sample from posts table:', statusDebugRes);
      
      // Try posts_with_stats as well
      const statusDebugRes2 = await supabase
        .from('posts_with_stats')
        .select('id, status, target_reached, stop_loss_triggered')
        .eq('user_id', user.id)
        .limit(5);
      
      console.log('🔍 [POST_PROVIDER] Status debug sample from posts_with_stats:', statusDebugRes2);
      
      const [totalRes, successRes, lossRes] = await Promise.all([
        supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .or('status.eq.success,target_reached.eq.true'),
        supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .or('status.eq.loss,stop_loss_triggered.eq.true'),
      ]);

      console.log('📈 [POST_PROVIDER] Database query results:', {
        totalRes: { count: totalRes.count, error: totalRes.error },
        successRes: { count: successRes.count, error: successRes.error },
        lossRes: { count: lossRes.count, error: lossRes.error }
      });

      const total = totalRes.count || 0;
      const successful = successRes.count || 0;
      const losses = lossRes.count || 0;
      const open = Math.max(0, total - successful - losses);
      const sr = calculateSuccessRate(successful, losses);
      
      const newStats = { totalPosts: total, successfulPosts: successful, lossPosts: losses, openPosts: open, successRate: sr };
      console.log('✅ [POST_PROVIDER] Calculated new stats from DB:', newStats);
      
      // If database stats are empty but we have posts in myPostsState, use computed stats as fallback
      if ((successful === 0 && losses === 0) && Array.isArray(myPostsState) && myPostsState.length > 0) {
        console.log('⚠️ [POST_PROVIDER] DB stats are empty, falling back to computed stats from myPosts');
        const computedStats = calculatePostStats(myPostsState);
        const fallbackStats = { 
          totalPosts: total, // Keep DB total count
          successfulPosts: computedStats.successfulPosts, 
          lossPosts: computedStats.lossPosts, 
          openPosts: Math.max(0, total - computedStats.successfulPosts - computedStats.lossPosts),
          successRate: computedStats.successRate 
        };
        console.log('🔄 [POST_PROVIDER] Using fallback computed stats:', fallbackStats);
        setMyStats(fallbackStats);
      } else {
        setMyStats(newStats);
      }
      
      console.log('💾 [POST_PROVIDER] Stats saved to state');
      
    } catch (err) {
      console.error('❌ [POST_PROVIDER] refreshMyStats failed:', err);
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PostProvider] refreshMyStats failed', err);
      }
    }
  }, [supabase, user?.id]);

  const scheduleRefreshMyStats = useCallback((delay: number = 300) => {
    try { if (statsRefreshTimeoutRef.current) clearTimeout(statsRefreshTimeoutRef.current); } catch {}
    statsRefreshTimeoutRef.current = setTimeout(() => {
      refreshMyStats();
    }, delay);
  }, [refreshMyStats]);

  // Cleanup any scheduled refresh timers on unmount
  useEffect(() => {
    return () => {
      try { if (statsRefreshTimeoutRef.current) clearTimeout(statsRefreshTimeoutRef.current); } catch {}
    };
  }, []);

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
      // Store consumer preference for excluding current user's posts in the feed
      setExcludeSelf(Boolean(opts?.excludeCurrentUser));

      if (mode === 'following') {
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
      let page: any[] = [];
      if (mode === 'following') {
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

  // Fetch current user's posts (profile/dashboard owner)
  const fetchMyPosts = useCallback(async () => {
    console.log('📋 [POST_PROVIDER] fetchMyPosts called for user:', user?.id);
    
    if (!user?.id) {
      console.warn('🚨 [POST_PROVIDER] No user ID, clearing my posts');
      setMyPostsState([]);
      setMyHasMore(false);
      myBeforeCursorRef.current = null;
      return;
    }
    
    console.log('🔄 [POST_PROVIDER] Setting myLoading to true');
    setMyLoading(true);
    
    try {
      console.log('📊 [POST_PROVIDER] Calling getPostsPage with:', {
        limit: MY_PAGE_SIZE,
        before: null,
        userIds: [user.id]
      });
      
      const page = await getPostsPage({ limit: MY_PAGE_SIZE, before: null, userIds: [user.id] });
      const list = Array.isArray(page) ? page : [];
      
      console.log('✅ [POST_PROVIDER] Fetched user posts:', {
        pageIsArray: Array.isArray(page),
        listLength: list.length,
        posts: list.map(p => ({ id: p.id, symbol: p.symbol, created_at: p.created_at }))
      });
      
      setMyPostsState(list);
      myBeforeCursorRef.current = list.length > 0 ? String(list[list.length - 1].created_at) : null;
      setMyHasMore(list.length === MY_PAGE_SIZE);
      
      console.log('📊 [POST_PROVIDER] Now calling refreshMyStats after fetchMyPosts...');
      await refreshMyStats();
      
    } catch (e: any) {
      console.error('❌ [POST_PROVIDER] fetchMyPosts failed:', e);
      setError(e?.message || 'Failed to fetch my posts');
      setMyPostsState([]);
      setMyHasMore(false);
    } finally {
      console.log('✅ [POST_PROVIDER] Setting myLoading to false');
      setMyLoading(false);
    }
  }, [getPostsPage, user?.id]);

  // Load more for current user's posts
  const loadMoreMyPosts = useCallback(async () => {
    if (!user?.id) return;
    if (myLoading) return;
    const before = myBeforeCursorRef.current;
    if (!before) { setMyHasMore(false); return; }
    setMyLoading(true);
    try {
      const page = await getPostsPage({ limit: PAGE_SIZE, before, userIds: [user.id] });
      const list = Array.isArray(page) ? page : [];
      setMyPostsState(prev => [...prev, ...list]);
      myBeforeCursorRef.current = list.length > 0 ? String(list[list.length - 1].created_at) : null;
      setMyHasMore(list.length === PAGE_SIZE);
      await refreshMyStats();
    } catch (e: any) {
      setError(e?.message || 'Failed to load more my posts');
    } finally {
      setMyLoading(false);
    }
  }, [getPostsPage, myLoading, user?.id]);

  // Subscribe to realtime updates for posts (price checks, status changes)
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('posts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload: any) => {
        console.log('Real-time post update:', payload);
        const evt = payload.eventType;
        const newRow = payload.new;
        const oldRow = payload.old;

        if (evt === 'INSERT' && newRow) {
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
            // If it's my post, prepend to myPostsState as well
            if (full.user_id && user?.id && full.user_id === user.id) {
              setMyPostsState(prev => {
                if (prev.some(p => p.id === full.id)) return prev;
                return [full, ...prev];
              });
              scheduleRefreshMyStats(0);
            }
          }).catch(() => {});
        } else if (evt === 'UPDATE' && newRow) {
          console.log('[PostProvider] Real-time UPDATE received:', newRow.id, {
            last_price_check: newRow.last_price_check,
            current_price: newRow.current_price,
            symbol: newRow.symbol
          });
          setPosts(prev => {
            const next = [...prev];
            const idx = next.findIndex(p => p.id === newRow.id);
            if (idx !== -1) {
              const updatedPost: any = { ...next[idx], ...newRow };
              if (newRow.price_checks) {
                try {
                  updatedPost.price_checks = typeof newRow.price_checks === 'string'
                    ? JSON.parse(newRow.price_checks)
                    : newRow.price_checks;
                } catch (e) {
                  console.warn('Failed to parse price_checks:', e);
                }
              }
              next[idx] = updatedPost;
              if (modeRef.current === 'trending') {
                next.sort((a: any, b: any) => {
                  const aEng = (a.comment_count || 0) + (a.buy_count || 0) + (a.sell_count || 0);
                  const bEng = (b.comment_count || 0) + (b.buy_count || 0) + (b.sell_count || 0);
                  return bEng - aEng;
                });
              }
            }
            return next;
          });
          // Update myPostsState if applicable
          if (newRow.user_id && user?.id && newRow.user_id === user.id) {
            setMyPostsState(prev => {
              const next = [...prev];
              const idx = next.findIndex(p => p.id === newRow.id);
              if (idx !== -1) {
                next[idx] = { ...next[idx], ...newRow } as any;
              }
              return next;
            });
            scheduleRefreshMyStats(300);
          }
        } else if (evt === 'DELETE' && oldRow) {
          setPosts(prev => prev.filter(p => p.id !== oldRow.id));
          if (user?.id) {
            setMyPostsState(prev => prev.filter(p => p.id !== oldRow.id));
            if (oldRow.user_id && oldRow.user_id === user.id) {
              scheduleRefreshMyStats(0);
            }
          }
        }
      })
      .subscribe();

    return () => {
      try { channel.unsubscribe(); } catch {}
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
        const newList = [saved, ...withoutTemp];
        console.log('[PostProvider] Post added to posts list:', {
          tempId,
          savedId: saved?.id,
          newListLength: newList.length,
          savedUserId: saved?.user_id
        });
        return newList;
      });
      // Also update myPostsState if it's my own post
      if (saved?.user_id && user?.id && saved.user_id === user.id) {
        setMyPostsState(prev => [saved, ...prev]);
        scheduleRefreshMyStats(0);
      }
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

  // Function to update user posts from PostsFeed
  const updateUserPosts = useCallback((newUserPosts: Post[]) => {
    // Temporary compatibility: allow external components to push myPosts
    setMyPostsState(newUserPosts);
    if (process.env.NODE_ENV === 'development') {
      console.log('[PostProvider] User posts updated externally:', {
        userId: user?.id,
        newUserPostsCount: newUserPosts.length,
        postIds: newUserPosts.map(p => p.id).slice(0, 3)
      });
    }
  }, [user?.id]);

  // Initial fetch for feed posts only on mount
  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Fetch myPosts whenever user changes
  useEffect(() => {
    if (!user?.id) {
      setMyPostsState([]);
      setMyHasMore(false);
      myBeforeCursorRef.current = null;
      return;
    }
    fetchMyPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user?.id to prevent infinite loop

  const value: PostsContextType = {
    posts,
    feedPosts: useMemo(() => {
      if (excludeSelf && user?.id) {
        return posts.filter((p: any) => p?.user_id !== user.id);
      }
      return posts;
    }, [posts, excludeSelf, user?.id]),
    myPosts: useMemo(() => {
      const list = Array.isArray(myPostsState) ? myPostsState : [];
      if (process.env.NODE_ENV === 'development') {
        console.log('[PostProvider] myPosts updated:', {
          userId: user?.id,
          myPostsCount: list.length,
          myPostsIds: list.map(p => p.id).slice(0, 3)
        });
      }
      return list;
    }, [myPostsState, user?.id]),
    myLoading,
    myHasMore,
    loading,
    error,
    fetchPosts,
    loadMore,
    hasMore,
    loadingMore,
    fetchMyPosts,
    loadMoreMyPosts,
    postStats: useMemo(() => {
      const list = Array.isArray(myPostsState) ? myPostsState : [];
      return calculatePostStats(list as any);
    }, [myPostsState]),
    myStats,
    refreshMyStats,
    createPost,
    onPostCreated,
    updateUserPosts,
  };

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

export const usePosts = () => {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error('usePosts must be used within a PostProvider');
  return ctx;
};