"use client";

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, signIn, signUp, signOut, getCurrentUser, getUserProfile, getAvatarImageUrl } from '@/utils/supabase';
import logger from '@/utils/logger';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Function to refresh session or clear it if invalid
  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        logger.warn('Session refresh error:', error.message);
        // Clear potentially corrupted session
        await supabase.auth.signOut();
        setUser(null);
        return false;
      }
      
      if (data.session) {
        setUser(data.session.user);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      logger.error('Error refreshing session:', error);
      setUser(null);
      return false;
    }
  };

  useEffect(() => {
    // Check for active session on mount
    const checkUser = async () => {
      try {
        // First try getting the session
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          logger.warn('Session error:', sessionError.message);
          // Try refreshing the session
          const refreshed = await refreshSession();
          if (!refreshed) {
            // If refresh failed, get current user as fallback
            const currentUser = await getCurrentUser();
            setUser(currentUser || null);
            
            // If we have a user, ensure profile and avatar are set up
            if (currentUser) {
              await ensureUserProfile(currentUser.id);
            }
          } else {
            // Session refreshed successfully, ensure profile is set up
            if (data?.session?.user) {
              await ensureUserProfile(data.session.user.id);
            }
          }
        } else if (data.session) {
          setUser(data.session.user);
          
          // We have a session, ensure profile is set up
          await ensureUserProfile(data.session.user.id);
        } else {
          // No session found, try getting current user
          const currentUser = await getCurrentUser();
          setUser(currentUser || null);
          
          // If we have a user, ensure profile and avatar are set up
          if (currentUser) {
            await ensureUserProfile(currentUser.id);
          }
        }
      } catch (error) {
        logger.error('Error checking auth:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    // Helper function to ensure user profile and avatar are set up correctly
    const ensureUserProfile = async (userId) => {
      try {
        logger.log('Ensuring profile is set up for user:', userId);
        
        // First get user profile (this will create one if it doesn't exist)
        const { data: profileData, error: profileError } = await getUserProfile(userId);
        
        if (profileError) {
          logger.error('Error ensuring user profile exists:', profileError);
          return;
        }
        
        // Check avatar in storage and update profile if needed
        try {
          // Check if user has files in the avatars bucket
          const { data: files, error: listError } = await supabase.storage
            .from('avatars')
            .list(userId);
            
          if (listError) {
            logger.warn('Error listing avatar files:', listError);
          } else if (files && files.length > 0) {
            // Find the avatar file (should be named avatar.ext)
            const avatarFile = files.find(file => file.name.startsWith('avatar.'));
            
            if (avatarFile) {
              // Get the public URL for the avatar
              const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(`${userId}/${avatarFile.name}`);
                
              if (urlData?.publicUrl) {
                const baseUrl = urlData.publicUrl.split('?')[0]; // Remove query params
                
                // Check if profile needs to be updated with this URL
                if (!profileData.avatar_url || profileData.avatar_url !== baseUrl) {
                  logger.log('Updating profile with avatar URL from storage:', baseUrl);
                  
                  // Update profile in database with the avatar URL
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ avatar_url: baseUrl })
                    .eq('id', userId);
                    
                  if (updateError) {
                    logger.error('Error updating profile with avatar URL:', updateError);
                  }
                }
              }
            }
          }
        } catch (storageError) {
          logger.error('Error checking avatar in storage:', storageError);
        }
      } catch (error) {
        logger.error('Error in ensureUserProfile:', error);
      }
    };

    checkUser();

    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('Auth state changed:', event, session ? 'session exists' : 'no session');
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user);
          
          // Ensure profile and avatar are fetched when user signs in
          try {
            // Fetch user profile to ensure it's created
            const { data: profileData, error: profileError } = await getUserProfile(session.user.id);
            if (profileError) {
              logger.error('Error fetching profile after auth state change:', profileError);
            }
            
            // Fetch avatar URL to ensure it's available immediately
            const avatarUrl = await getAvatarImageUrl(session.user.id);
            logger.log('Fetched avatar URL after auth state change:', avatarUrl);
          } catch (error) {
            logger.error('Error handling profile after auth state change:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setUser(session.user);
        } else if (event === 'USER_UPDATED' && session) {
          setUser(session.user);
        }
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await signIn(email, password);
      if (error) throw error;
      
      // After successful login, fetch user profile and avatar
      if (data?.user) {
        // Fetch user profile to ensure it's created and cached
        const { data: profileData, error: profileError } = await getUserProfile(data.user.id);
        if (profileError) {
          logger.error('Error fetching profile after login:', profileError);
        }
        
        // Fetch avatar URL to ensure it's available immediately after login
        try {
          const avatarUrl = await getAvatarImageUrl(data.user.id);
          logger.log('Fetched avatar URL after login:', avatarUrl);
        } catch (avatarError) {
          logger.error('Error fetching avatar URL after login:', avatarError);
        }
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await signUp(email, password);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const { error } = await signOut();
      if (error) throw error;
      router.push('/');
    } catch (error) {
      logger.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshSession,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
