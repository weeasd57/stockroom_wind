"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase as globalSupabase } from '@/utils/supabase'; // Import the shared instance

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

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  // Use the globally imported Supabase client instance
  const supabase = globalSupabase;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    // Check active session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // console.error('Error getting session:', error.message);
          setError(error);
          setLoading(false);
          return;
        }

      const hasUser = !!session?.user;
      setUser(session?.user ?? null);
      setIsAuthenticated(hasUser);

    // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          // console.log(`[Auth] State change: ${event}`);
          if (event === 'SIGNED_IN') {
            const currentUser = await supabase.auth.getUser();
            setUser(currentUser.data.user);
            setIsAuthenticated(true);

            // If a post-auth redirect was requested (set before OAuth flow), follow it
            try {
              const postAuth = typeof window !== 'undefined' ? localStorage.getItem('postAuthRedirect') : null;
              if (postAuth) {
                try { localStorage.removeItem('postAuthRedirect'); } catch (e) { /* ignore */ }
                router.push(postAuth);
                return; // stop further processing
              }
            } catch (e) {
              // localStorage may not be available in some environments
              console.debug('[SupabaseProvider] postAuth redirect check failed', e);
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setIsAuthenticated(false);
          }
          
          // Clear any pending refresh
          if (refreshTimeout.current) {
            clearTimeout(refreshTimeout.current);
            refreshTimeout.current = undefined;
          }
          
          // Only attempt refresh if we have a session and it's not a SIGNED_OUT event
          if (session && event !== 'SIGNED_OUT') {
            // If session exists but is expired or will expire soon
            const expiresAt = new Date(session.expires_at! * 1000);
            const timeUntilExpiry = expiresAt.getTime() - Date.now();
            
            if (timeUntilExpiry < 600000) { // Less than 10 minutes until expiry
              refreshTimeout.current = setTimeout(() => {
                refreshTimeout.current = undefined;
                if (!isRefreshing) {
                  refreshSession();
                }
              }, 1000); // Small delay to prevent immediate refresh
            }
          }
        });

        setLoading(false);
        return () => {
          subscription.unsubscribe();
          if (refreshTimeout.current) {
            clearTimeout(refreshTimeout.current);
            refreshTimeout.current = undefined;
          }
        };
      } catch (err) {
        // console.error('Error initializing auth:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize auth'));
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);  // Remove supabase.auth from dependencies as it's stable

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

  const signUp = async (email: string, password: string, userData: any = {}) => {
    try {
      // console.log('SupabaseProvider: Starting signUp with email:', email);
      
      // Step 1: Sign up the user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: userData }
      });
      
      if (error) {
        // console.error('SupabaseProvider: Signup error:', error.message);
        throw error;
      }
      
      // console.log('SupabaseProvider: Auth signup successful, user ID:', data?.user?.id);
      
      // Step 2: Wait briefly to allow database triggers to run
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Create a profile for the user
      if (data?.user?.id) {
        try {
          const userId = data.user.id;
          const username = userData?.username || email.split('@')[0];
          const now = new Date().toISOString();
          
          // Check if profile already exists (to avoid duplicate profile errors)
          // console.log('SupabaseProvider: Checking if profile exists for user:', userId);
          const { data: existingProfile, error: profileCheckError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();
            
          if (profileCheckError) {
            // console.log('SupabaseProvider: Error checking for profile:', profileCheckError.message);
          }
            
          // Only create profile if it doesn't exist
          if (!existingProfile) {
            // console.log('SupabaseProvider: Creating new profile with username:', username);
            const defaultProfile = {
              id: userId,
              username: username,
              full_name: userData?.full_name || null,
              avatar_url: null,
              bio: null,
              website: null,
              favorite_markets: null,
              created_at: now,
              updated_at: null,
              email: email,
              last_sign_in: now,
              success_posts: 0,
              loss_posts: 0,
              background_url: null,
              experience_score: 0,
              followers: 0,
              following: 0
            };
            
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([defaultProfile]);
              
            if (profileError) {
              // console.error('SupabaseProvider: Profile creation error:', profileError.message, profileError);
              // We continue without throwing since the auth signup was successful
            } else {
              // console.log('SupabaseProvider: Profile created successfully');
            }
          } else {
            // console.log('SupabaseProvider: Profile already exists, no need to create');
          }
        } catch (profileError) {
          // console.error('SupabaseProvider: Error during profile creation:', profileError);
          // We don't throw since auth was successful
        }
      }
    } catch (err) {
      // console.error('SupabaseProvider: Sign up process failed:', err);
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
    if (isRefreshing) return { success: false, authenticated: isAuthenticated };
    
    try {
      setIsRefreshing(true);
      // console.log('Refreshing authentication session...');
      
      // First check if we have a current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        // console.log('No current session found');
        setIsAuthenticated(false);
        setUser(null);
        return { success: false, authenticated: false };
      }

      // Try to refresh the session
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        // console.error('Error refreshing session:', error.message);
        setIsAuthenticated(false);
        setUser(null);
        throw error;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      const isUserAuthenticated = !!session?.user;
      setUser(session?.user ?? null);
      setIsAuthenticated(isUserAuthenticated);
      
      return { success: true, authenticated: isUserAuthenticated };
    } catch (err) {
      // console.error('Failed to refresh session:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh session'));
      setIsAuthenticated(false);
      setUser(null);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Database functions
  const getProfile = useCallback(async (userId: string) => {
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
  }, [supabase]);

  const updateProfile = useCallback(async (userId: string, updates: any) => {
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
  }, [supabase]);

  // Storage functions
  const uploadFile = useCallback(async (bucket: string, path: string, file: File): Promise<string> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file);
      if (error) throw error;
      // Compute public URL inline to avoid dependency on getPublicUrl during initial render
      return supabase.storage
        .from(bucket)
        .getPublicUrl(path)
        .data.publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to upload file'));
      throw err;
    }
  }, [supabase]);

  const deleteFile = useCallback(async (bucket: string, path: string) => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete file'));
      throw err;
    }
  }, [supabase]);

  const getPublicUrl = useCallback((bucket: string, path: string): string => {
    return supabase.storage
      .from(bucket)
      .getPublicUrl(path)
      .data.publicUrl;
  }, [supabase]);

  // Posts functions
  const getPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profile:profiles(id, username, avatar_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get posts'));
      throw err;
    }
  }, [supabase]);

  const getPostsPage = useCallback(async (params: { limit?: number; before?: string | null; userIds?: string[] } = {}) => {
    const { limit = 20, before = null, userIds } = params;
    try {
      let query = supabase
        .from('posts_with_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }
      if (userIds && userIds.length > 0) {
        query = query.in('user_id', userIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) return [];

      // Batch fetch profiles and attach as `profile` to each post
      const uniqueUserIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      if (uniqueUserIds.length > 0) {
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', uniqueUserIds);
        if (!pError && Array.isArray(profiles)) {
          const pmap = new Map((profiles as any[]).map(p => [p.id, p]));
          rows.forEach((r: any) => {
            (r as any).profile = pmap.get(r.user_id) || null;
          });
        }
      }

      return rows;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get posts page'));
      throw err;
    }
  }, [supabase]);

  const createPost = useCallback(async (postData: any) => {
    try {
      console.log('[SupabaseProvider] Full post data before insert:', postData);
      console.log('[SupabaseProvider] Inserting post with data:', {
        hasImageUrl: !!postData.image_url,
        imageUrl: postData.image_url,
        allKeys: Object.keys(postData),
        user_id: postData.user_id
      });
      
      // Build base object and normalize image_url
      const postToInsert = {
        ...postData,
        user_id: postData.user_id || user?.id,
        created_at: postData.created_at || new Date().toISOString()
      } as any;

      const isValidHttpUrl = (u: any) => {
        try {
          if (!u || typeof u !== 'string') return false;
          const parsed = new URL(u);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch { return false; }
      };

      const rawImageUrl = (typeof postToInsert.image_url === 'string' && postToInsert.image_url)
        ? postToInsert.image_url
        : (typeof postToInsert.imageUrl === 'string' ? postToInsert.imageUrl : null);
      const trimmedImageUrl = typeof rawImageUrl === 'string' ? rawImageUrl.trim() : null;
      const normalizedImageUrl = isValidHttpUrl(trimmedImageUrl) ? trimmedImageUrl : null;
      postToInsert.image_url = normalizedImageUrl;

      console.log('[SupabaseProvider] Normalized image_url:', {
        rawImageUrl,
        trimmedImageUrl,
        normalizedImageUrl,
        fromCamelCase: typeof postToInsert.imageUrl === 'string'
      });

      // Create clean object with only valid fields that exist in database
      const cleanPost = {
        user_id: postToInsert.user_id,
        content: postToInsert.content || '',
        image_url: postToInsert.image_url || null,
        symbol: postToInsert.symbol || '',
        company_name: postToInsert.company_name || '',
        country: postToInsert.country || '',
        exchange: postToInsert.exchange || '',
        current_price: (postToInsert.current_price ?? postToInsert.price) ?? 0,
        target_price: postToInsert.target_price ?? 0,
        stop_loss_price: (postToInsert.stop_loss_price ?? postToInsert.stop_loss) ?? 0,
        strategy: postToInsert.strategy ?? 'BUY',
        description: postToInsert.description ?? null,
        initial_price: (postToInsert.initial_price ?? postToInsert.current_price ?? postToInsert.price) ?? null,
        high_price: postToInsert.high_price ?? null,
        target_high_price: postToInsert.target_high_price ?? null,
        status_message: postToInsert.status_message ?? 'Active', // Required field
        created_at: postToInsert.created_at,
        // Optional flags if provided
        is_public: typeof postToInsert.is_public === 'boolean' ? postToInsert.is_public : true,
        status: postToInsert.status || 'open'
      } as any;
      
      console.log('[SupabaseProvider] Clean post object:', cleanPost);
      console.log('[SupabaseProvider] image_url in clean object:', cleanPost.image_url);
      
      // Perform insert with array payload (more compatible across PostgREST versions)
      // Also guard with a timeout to avoid potential hangs
      console.log('[SupabaseProvider] Performing insert into posts...');
      const insertPromise = supabase
        .from('posts')
        .insert([cleanPost])
        .select()
        .single();

      const timeoutMs = 10000; // 10s safety timeout
      let data: any = null;
      let error: any = null;
      try {
        const res: any = await Promise.race([
          insertPromise,
          new Promise((resolve) => setTimeout(() => resolve({ data: null, error: new Error('Insert timeout') }), timeoutMs))
        ]);
        data = res?.data ?? null;
        error = res?.error ?? null;
      } catch (e: any) {
        error = e;
      }

      // If timed out, attempt a best-effort fallback fetch by unique tuple
      if (error && error.message === 'Insert timeout') {
        console.warn('[SupabaseProvider] Insert timed out, attempting fallback fetch by created_at/content/user_id');
        const { data: fallback, error: fallbackErr } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', (cleanPost as any).user_id)
          .eq('created_at', (cleanPost as any).created_at)
          .eq('content', (cleanPost as any).content)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallback) {
          console.warn('[SupabaseProvider] Fallback fetch succeeded. Proceeding with returned row.');
          data = fallback;
          error = null;
        } else if (fallbackErr) {
          console.warn('[SupabaseProvider] Fallback fetch failed:', fallbackErr?.message);
        }
      }
      
      console.log('[SupabaseProvider] Insert result:', {
        success: !error,
        dataId: data?.id,
        dataImageUrl: data?.image_url,
        hasImageUrl: !!data?.image_url,
        error: error?.message
      });
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create post'));
      throw err;
    }
  }, [supabase, user?.id]);

  const updatePost = useCallback(async (id: string, updates: any) => {
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
  }, [supabase]);

  const deletePost = useCallback(async (id: string) => {
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
  }, [supabase]);

  // Comments functions
  const getComments = useCallback(async (postId: string) => {
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
  }, [supabase]);

  const addComment = useCallback(async (postId: string, content: string) => {
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
  }, [supabase]);

  const deleteComment = useCallback(async (id: string) => {
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
  }, [supabase]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    
    try {
      setIsLoggingOut(true);
      // Attempt sign out with a safety timeout to avoid hanging
      const timeoutMs = 5000;
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise<void>((resolve) => setTimeout(() => resolve(), timeoutMs))
        ]);
      } catch (_) {
        // Ignore errors here; we'll proceed with local cleanup
      }

      // Extra safety: clear any lingering Supabase auth keys from localStorage
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('sb-') || key.startsWith('supabase.auth.')) {
            localStorage.removeItem(key);
          }
        }
      } catch (_) {
        // best-effort cleanup only
      }
      
      // Get the current path
      const currentPath = window.location.pathname;
      
      // Check if we're on a view-profile page or other public page
      if (currentPath.startsWith('/view-profile/') || 
          currentPath === '/traders' || 
          currentPath === '/landing') {
        // Don't redirect - stay on the current page
        // Just refresh the component by setting isAuthenticated to false
        setIsAuthenticated(false);
        setUser(null);
      } else {
        // Redirect to landing page for non-public pages
        // Clear state before redirect
        setIsAuthenticated(false);
        setUser(null);
        // Force page reload to ensure clean state
        window.location.href = '/landing';
      }
    } catch (error) {
      // Silent error handling - no console messages
    } finally {
      setIsLoggingOut(false);
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