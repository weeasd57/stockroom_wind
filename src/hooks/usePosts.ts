import { useState, useEffect, useCallback } from 'react';
import { PostWithUser, UsePostsOptions, PaginatedResponse } from '@/types';
import { fetchWithTimeout } from '@/services/api';

interface UsePostsReturn {
  posts: PostWithUser[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  createPost: (postData: any) => Promise<void>;
  updatePost: (postId: string, updates: Partial<PostWithUser>) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
}

export const usePosts = (options: UsePostsOptions = {}): UsePostsReturn => {
  const [posts, setPosts] = useState<PostWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const { userId, limit = 10, sortBy = 'created_at', filterBy } = options;

  const fetchPosts = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        sortBy,
        ...(userId && { userId }),
        ...(filterBy?.country && { country: filterBy.country }),
        ...(filterBy?.strategy && { strategy: filterBy.strategy }),
        ...(filterBy?.status && { status: filterBy.status }),
      });

      const response: PaginatedResponse<PostWithUser> = await fetchWithTimeout(
        `/api/posts?${queryParams}`
      );

      if (response.success && response.data) {
        setPosts(prev => reset ? response.data! : [...prev, ...response.data!]);
        setHasMore(response.meta.hasNext);
        setPage(pageNum);
      } else {
        throw new Error(response.error || 'Failed to fetch posts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [userId, limit, sortBy, filterBy]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchPosts(page + 1, false);
  }, [fetchPosts, hasMore, isLoading, page]);

  const refresh = useCallback(async () => {
    await fetchPosts(1, true);
  }, [fetchPosts]);

  const createPost = useCallback(async (postData: any) => {
    try {
      setError(null);
      const response = await fetchWithTimeout('/api/posts', {
        method: 'POST',
        body: JSON.stringify(postData),
      });

      if (response.success && response.data) {
        setPosts(prev => [response.data, ...prev]);
      } else {
        throw new Error(response.error || 'Failed to create post');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
      throw err;
    }
  }, []);

  const updatePost = useCallback(async (postId: string, updates: Partial<PostWithUser>) => {
    try {
      setError(null);
      const response = await fetchWithTimeout(`/api/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      if (response.success) {
        setPosts(prev => 
          prev.map(post => 
            post.id === postId ? { ...post, ...updates } : post
          )
        );
      } else {
        throw new Error(response.error || 'Failed to update post');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post');
      throw err;
    }
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    try {
      setError(null);
      const response = await fetchWithTimeout(`/api/posts/${postId}`, {
        method: 'DELETE',
      });

      if (response.success) {
        setPosts(prev => prev.filter(post => post.id !== postId));
      } else {
        throw new Error(response.error || 'Failed to delete post');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
      throw err;
    }
  }, []);

  const likePost = useCallback(async (postId: string) => {
    try {
      setError(null);
      const response = await fetchWithTimeout(`/api/posts/${postId}/like`, {
        method: 'POST',
      });

      if (response.success) {
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? {
                  ...post,
                  likes_count: (post.likes_count || 0) + 1,
                  is_liked: true,
                }
              : post
          )
        );
      } else {
        throw new Error(response.error || 'Failed to like post');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to like post');
    }
  }, []);

  const unlikePost = useCallback(async (postId: string) => {
    try {
      setError(null);
      const response = await fetchWithTimeout(`/api/posts/${postId}/like`, {
        method: 'DELETE',
      });

      if (response.success) {
        setPosts(prev =>
          prev.map(post =>
            post.id === postId
              ? {
                  ...post,
                  likes_count: Math.max((post.likes_count || 0) - 1, 0),
                  is_liked: false,
                }
              : post
          )
        );
      } else {
        throw new Error(response.error || 'Failed to unlike post');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlike post');
    }
  }, []);

  useEffect(() => {
    fetchPosts(1, true);
  }, [fetchPosts]);

  return {
    posts,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    createPost,
    updatePost,
    deletePost,
    likePost,
    unlikePost,
  };
};