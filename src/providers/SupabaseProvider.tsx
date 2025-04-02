"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

interface SupabaseContextType {
  supabase: SupabaseClient;
  user: User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  // Auth functions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: any) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<{ success: boolean; authenticated: boolean; }>;
  // Database functions
  getProfile: (userId: string) => Promise<any>;
  updateProfile: (userId: string, updates: any) => Promise<void>;
  // Storage functions
  uploadFile: (bucket: string, path: string, file: File) => Promise<string>;
  deleteFile: (bucket: string, path: string) => Promise<void>;
  getPublicUrl: (bucket: string, path: string) => string;
  // Posts functions
  getPosts: () => Promise<any[]>;
  createPost: (postData: any) => Promise<any>;
  updatePost: (id: string, updates: any) => Promise<any>;
  deletePost: (id: string) => Promise<void>;
  // Comments functions
  getComments: (postId: string) => Promise<any[]>;
  addComment: (postId: string, content: string) => Promise<any>;
  deleteComment: (id: string) => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => 
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hasUser = !!session?.user;
      setUser(session?.user ?? null);
      setIsAuthenticated(hasUser);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasUser = !!session?.user;
      setUser(session?.user ?? null);
      setIsAuthenticated(hasUser);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Auth functions
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign in'));
      throw err;
    }
  };

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: userData }
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign up'));
      throw err;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign out'));
      throw err;
    }
  };

  const refreshSession = async () => {
    try {
      console.log('Refreshing authentication session...');
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error.message);
        throw error;
      }
      
      // Get the updated session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session refreshed:', !!session);
      
      // Update user and authentication state
      const isUserAuthenticated = !!session?.user;
      setUser(session?.user ?? null);
      setIsAuthenticated(isUserAuthenticated);
      
      console.log('Authentication state updated. Authenticated:', isUserAuthenticated);
      return { success: true, authenticated: isUserAuthenticated };
    } catch (err) {
      console.error('Failed to refresh session:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh session'));
      throw err;
    }
  };

  // Database functions
  const getProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get profile'));
      throw err;
    }
  };

  const updateProfile = async (userId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update profile'));
      throw err;
    }
  };

  // Storage functions
  const uploadFile = async (bucket: string, path: string, file: File): Promise<string> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file);
      if (error) throw error;
      return getPublicUrl(bucket, path);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to upload file'));
      throw err;
    }
  };

  const deleteFile = async (bucket: string, path: string) => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete file'));
      throw err;
    }
  };

  const getPublicUrl = (bucket: string, path: string): string => {
    return supabase.storage
      .from(bucket)
      .getPublicUrl(path)
      .data.publicUrl;
  };

  // Posts functions
  const getPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(username, avatar_url)');
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get posts'));
      throw err;
    }
  };

  const createPost = async (postData: any) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create post'));
      throw err;
    }
  };

  const updatePost = async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update post'));
      throw err;
    }
  };

  const deletePost = async (id: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete post'));
      throw err;
    }
  };

  // Comments functions
  const getComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(username, avatar_url)')
        .eq('post_id', postId);
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get comments'));
      throw err;
    }
  };

  const addComment = async (postId: string, content: string) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: postId, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add comment'));
      throw err;
    }
  };

  const deleteComment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete comment'));
      throw err;
    }
  };

  return (
    <SupabaseContext.Provider value={{
      supabase,
      user,
      loading,
      error,
      isAuthenticated,
      signIn,
      signUp,
      signOut,
      refreshSession,
      getProfile,
      updateProfile,
      uploadFile,
      deleteFile,
      getPublicUrl,
      getPosts,
      createPost,
      updatePost,
      deletePost,
      getComments,
      addComment,
      deleteComment
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};