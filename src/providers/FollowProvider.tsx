'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSupabase } from './SupabaseProvider';
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
    if (!isAuthenticated || !user || !profileIdToToggle) {
      setError('Authentication required or profile ID missing.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const currentFollowStatus = await checkIsFollowing(profileIdToToggle);

      if (currentFollowStatus) {
        // Unfollow
        console.log(`Unfollowing user ${profileIdToToggle} from ${user.id}`);
        const response = await fetch('/api/unfollow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Include cookies for authentication
          body: JSON.stringify({ follower_id: user.id, following_id: profileIdToToggle }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to unfollow user.');
        }
        setIsFollowing(false);
        console.log('Successfully unfollowed.');
      } else {
        // Follow
        console.log(`Following user ${profileIdToToggle} by ${user.id}`);
        const response = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Include cookies for authentication
          body: JSON.stringify({ follower_id: user.id, following_id: profileIdToToggle }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to follow user.');
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
