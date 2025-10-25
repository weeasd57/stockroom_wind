"use client";

console.log('🚀 [SimpleSupabase] Module loaded');

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import AuthLoadingScreen from '@/components/loading/AuthLoadingScreen';
import { supabase as globalSupabase } from '@/utils/supabase';

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
  handleLogout: () => Promise<void>;
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
  getPostsPage: (params: { limit?: number; before?: string | null; userIds?: string[] }) => Promise<any[]>;
  createPost: (postData: any) => Promise<any>;
  updatePost: (id: string, updates: any) => Promise<any>;
  deletePost: (id: string) => Promise<void>;
  // Comments functions
  getComments: (postId: string) => Promise<any[]>;
  addComment: (postId: string, content: string) => Promise<any>;
  deleteComment: (id: string) => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

interface SupabaseProviderProps {
  children: React.ReactNode;
}

export function SimpleSupabaseProvider({ children }: SupabaseProviderProps) {
  const supabase = globalSupabase;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  
  console.log('🎯 [SimpleSupabase] Provider initialized', { 
    isServer: typeof window === 'undefined',
    loading,
    isClient 
  });
  
  // Ensure we're on client-side
  useEffect(() => {
    console.log('✅ [SimpleSupabase] Client-side mount detected');
    setIsClient(true);
    
    // Initialize auth state
    const initAuth = async () => {
      console.log('🔄 [SimpleSupabase] Starting authentication check');
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('🔄 [SimpleSupabase] Session result:', { 
          hasSession: !!session,
          error: error?.message,
          userId: session?.user?.id,
          userEmail: session?.user?.email
        });
        
        if (session?.user) {
          console.log('✅ [SimpleSupabase] User authenticated');
          setUser(session.user);
          setIsAuthenticated(true);
        } else {
          console.log('❌ [SimpleSupabase] No authenticated user');
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('❌ [SimpleSupabase] Auth check error:', err);
        setUser(null);
        setIsAuthenticated(false);
        setError(err as Error);
      }
      
      setLoading(false);
      console.log('✅ [SimpleSupabase] Auth initialization complete');
    };
    
    initAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [SimpleSupabase] Auth state changed:', event);
        
        if (session?.user) {
          setUser(session.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);
  
  // Auth functions
  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log('✅ [SimpleSupabase] Sign in successful');
    } catch (err) {
      console.error('❌ [SimpleSupabase] Sign in error:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabase]);
  
  const signUp = useCallback(async (email: string, password: string, userData: any) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: userData }
      });
      if (error) throw error;
      console.log('✅ [SimpleSupabase] Sign up successful');
    } catch (err) {
      console.error('❌ [SimpleSupabase] Sign up error:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabase]);
  
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setIsAuthenticated(false);
      console.log('✅ [SimpleSupabase] Sign out successful');
    } catch (err) {
      console.error('❌ [SimpleSupabase] Sign out error:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabase]);
  
  const handleLogout = useCallback(async () => {
    await signOut();
    router.push('/');
  }, [signOut, router]);
  
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      const isAuthenticated = !!data.session?.user;
      return { success: true, authenticated: isAuthenticated };
    } catch (err) {
      console.error('❌ [SimpleSupabase] Refresh session error:', err);
      return { success: false, authenticated: false };
    }
  }, [supabase]);
  
  // Database functions
  const getProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  }, [supabase]);
  
  const updateProfile = useCallback(async (userId: string, updates: any) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) throw error;
  }, [supabase]);
  
  // Storage functions
  const uploadFile = useCallback(async (bucket: string, path: string, file: File): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return data.path;
  }, [supabase]);
  
  const deleteFile = useCallback(async (bucket: string, path: string) => {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  }, [supabase]);
  
  const getPublicUrl = useCallback((bucket: string, path: string): string => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }, [supabase]);
  
  // Posts functions
  const getPosts = useCallback(async (): Promise<any[]> => {
    const { data, error } = await supabase.from('posts_with_stats').select(`
      *,
      profile:profiles!posts_user_id_fkey (
        id,
        username,
        avatar_url
      )
    `).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }, [supabase]);
  
  const getPostsPage = useCallback(async (params: { limit?: number; before?: string | null; userIds?: string[] }): Promise<any[]> => {
    let query = supabase.from('posts_with_stats').select(`
      *,
      profile:profiles!posts_user_id_fkey (
        id,
        username,
        avatar_url
      )
    `);
    
    if (params.limit) query = query.limit(params.limit);
    if (params.before) query = query.lt('created_at', params.before);
    if (params.userIds?.length) query = query.in('user_id', params.userIds);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }, [supabase]);
  
  const createPost = useCallback(async (postData: any) => {
    const { data, error } = await supabase.from('posts').insert(postData).select().single();
    if (error) throw error;
    return data;
  }, [supabase]);
  
  const updatePost = useCallback(async (id: string, updates: any) => {
    const { data, error } = await supabase.from('posts').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }, [supabase]);
  
  const deletePost = useCallback(async (id: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
  }, [supabase]);
  
  // Comments functions
  const getComments = useCallback(async (postId: string): Promise<any[]> => {
    const { data, error } = await supabase.from('comments').select('*').eq('post_id', postId);
    if (error) throw error;
    return data || [];
  }, [supabase]);
  
  const addComment = useCallback(async (postId: string, content: string) => {
    const { data, error } = await supabase.from('comments').insert({
      post_id: postId,
      content,
      user_id: user?.id
    }).select().single();
    if (error) throw error;
    return data;
  }, [supabase, user]);
  
  const deleteComment = useCallback(async (id: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw error;
  }, [supabase]);
  
  // Don't render until client-side
  if (!isClient) {
    return <AuthLoadingScreen />;
  }
  
  const value: SupabaseContextType = {
    supabase,
    user,
    loading,
    error,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    handleLogout,
    refreshSession,
    getProfile,
    updateProfile,
    uploadFile,
    deleteFile,
    getPublicUrl,
    getPosts,
    getPostsPage,
    createPost,
    updatePost,
    deletePost,
    getComments,
    addComment,
    deleteComment,
  };
  
  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SimpleSupabaseProvider');
  }
  return context;
};
