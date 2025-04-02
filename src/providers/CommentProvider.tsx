"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Comment } from '../models/Comment';
import { fetchWithTimeout } from '../utils/api';

interface CommentContextType {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  addComment: (postId: string, content: string) => Promise<Comment>;
  deleteComment: (id: string) => Promise<void>;
  getPostComments: (postId: string) => Comment[];
}

const CommentContext = createContext<CommentContextType | null>(null);

export function CommentProvider({ children }: { children: React.ReactNode }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addComment = async (postId: string, content: string): Promise<Comment> => {
    setLoading(true);
    setError(null);

    try {
      const newComment = await fetchWithTimeout(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setComments(prev => [...prev, newComment]);
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
    setLoading(true);
    try {
      await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      setComments(comments.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPostComments = useCallback((postId: string) => {
    return comments.filter(comment => comment.post_id === postId);
  }, [comments]);

  return (
    <CommentContext.Provider value={{
      comments, loading, error,
      addComment, deleteComment, getPostComments
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
