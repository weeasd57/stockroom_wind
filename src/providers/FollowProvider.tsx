'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSupabase } from './SimpleSupabaseProvider';
import { User } from '@/models/User';

interface FollowContextType {
  isFollowing: boolean;
  toggleFollow: (profileIdToFollow: string) => Promise<void>;
  checkIsFollowing: (profileIdToFollow: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

const FollowContext = createContext<FollowContextType | undefined>(undefined);

export const FollowProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, supabase } = useSupabase();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // We'll handle ProfileProvider integration at component level instead

  // Function to check if the current user is following a specific profile
  const checkIsFollowing = useCallback(async (profileIdToFollow: string): Promise<boolean> => {
    if (!isAuthenticated || !user || !profileIdToFollow) {
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      // Use a more specific query that should work with RLS policies
      const { data, error: dbError } = await supabase
        .from('user_followings')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', profileIdToFollow)
        .maybeSingle(); // Use maybeSingle instead of single to avoid PGRST116 errors

      if (dbError) {
        console.error('Error checking follow status:', dbError);
        // Don't set error state for common "no rows found" cases
        if (dbError.code !== 'PGRST116') {
          setError(dbError.message);
        }
        return false;
      }
      
      const followingStatus = !!data;
      setIsFollowing(followingStatus);
      return followingStatus;
    } catch (err: any) {
      console.error('Unexpected error in checkIsFollowing:', err);
      setError(err.message || 'Failed to check follow status.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, supabase]);

  // Function to toggle follow status
  const toggleFollow = useCallback(async (profileIdToToggle: string) => {
    console.log('[FOLLOW] Toggle follow called with:', { 
      isAuthenticated, 
      userId: user?.id, 
      profileIdToToggle 
    });
    
    if (!isAuthenticated || !user || !profileIdToToggle) {
      console.error('[FOLLOW] Missing authentication or profile ID:', { 
        isAuthenticated, 
        hasUser: !!user, 
        profileIdToToggle 
      });
      setError('Authentication required or profile ID missing.');
      return;
    }
    if (user.id === profileIdToToggle) {
      setError("You can't follow yourself.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const currentFollowStatus = await checkIsFollowing(profileIdToToggle);
      // Optimistic toggle
      setIsFollowing(!currentFollowStatus);

      if (currentFollowStatus) {
        // Unfollow - Use Supabase client directly instead of API route
        console.log(`Unfollowing user ${profileIdToToggle} from ${user.id}`);
        
        // Delete the follow relationship
        const { error } = await supabase
          .from('user_followings')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileIdToToggle);

        if (error) {
          console.error('[UNFOLLOW] Database error:', error);
          // Fallback to API route (server-side auth context)
          const res = await fetch('/api/unfollow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ follower_id: user.id, following_id: profileIdToToggle })
          });
          if (!res.ok) {
            // Revert optimistic update
            setIsFollowing(true);
            const { error: apiError } = await res.json().catch(() => ({ error: 'Unfollow failed' }));
            throw new Error(apiError || 'Failed to unfollow user');
          }
        }
        setIsFollowing(false);
        console.log('Successfully unfollowed.');
      } else {
        // Follow - Use Supabase client directly instead of API route
        console.log(`Following user ${profileIdToToggle} by ${user.id}`);
        
        // First check if already following to avoid duplicate entries
        const { data: existingFollow } = await supabase
          .from('user_followings')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profileIdToToggle)
          .maybeSingle();

        if (existingFollow) {
          console.log('[FOLLOW] Already following this user');
          setIsFollowing(true);
          return;
        }

        // Insert new follow relationship
        const { data, error } = await supabase
          .from('user_followings')
          .insert([{ follower_id: user.id, following_id: profileIdToToggle }])
          .select();

        if (error) {
          console.error('[FOLLOW] Database error:', error);
          // Handle common database errors gracefully
          const code = (error as any).code || (error as any).details;
          if (code === '23505') { // unique_violation
            // Already following – mark as following silently
            setIsFollowing(true);
            return;
          }
          if (code === '23503' || (error.message && error.message.toLowerCase().includes('foreign key'))) {
            setError('Your profile is not initialized properly. Please sign out and sign in again, then try following.');
            throw new Error('Profile not initialized (FK)');
          }
          // Fallback to API route
          const res = await fetch('/api/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ follower_id: user.id, following_id: profileIdToToggle })
          });
          if (!res.ok) {
            // Revert optimistic update
            setIsFollowing(false);
            const { error: apiError } = await res.json().catch(() => ({ error: 'Follow failed' }));
            throw new Error(apiError || 'Failed to follow user');
          }
        }
        setIsFollowing(true);
        console.log('Successfully followed.');
      }
    } catch (err: any) {
      console.error('Error in toggleFollow:', err);
      setError(err.message || 'Failed to update follow status.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, checkIsFollowing]);

  const value = {
    isFollowing,
    toggleFollow,
    checkIsFollowing,
    loading,
    error,
  };

  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
};

export const useFollow = () => {
  const context = useContext(FollowContext);
  if (context === undefined) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return context;
};
