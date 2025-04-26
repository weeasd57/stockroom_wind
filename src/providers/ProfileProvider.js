"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';

import { 
  getUserProfile, 
  updateUserProfile, 
  uploadImage,
  getAvatarImageUrl,
  getBackgroundImageUrl,
  supabase
} from '@/utils/supabase';

// Create the context
const ProfileContext = createContext(null);

// Create a global store object to mimic Zustand's behavior
// This will store the latest state values needed by getState
const globalProfileState = {
  lastFetched: null,
  isRefreshing: false,
  setError: null
};

// Provider component
export function ProfileProvider({ children }) {
  // Handle the case where SupabaseProvider might not be available during SSR
  let user = null;
  let supabaseContextAvailable = true;
  
  try {
    // Try to use the SupabaseProvider
    const supabaseContext = useSupabase();
    user = supabaseContext?.user;
    
    // If we got here without errors, SupabaseProvider is available
  } catch (error) {
    // If this fails, it means we're not within a SupabaseProvider
    // This can happen during server-side rendering on Vercel
    console.warn('SupabaseProvider not available - rendering with null user');
    supabaseContextAvailable = false;
    user = null;
  }
  
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastImageRefresh = useRef(Date.now());
  const imageCache = useRef(new Map()); // Local cache for image URLs

  // Additional state from ProfileStore
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);

  // Update global state when local state changes
  useEffect(() => {
    globalProfileState.lastFetched = lastFetched;
    globalProfileState.isRefreshing = isRefreshing;
    // Make sure setError handles error objects properly
    globalProfileState.setError = (newError) => {
      // Ensure we're not directly rendering objects
      if (typeof newError === 'object' && newError !== null) {
        // If error has message property, use it
        if (newError.message) {
          console.error('Error object:', newError);
          setError(newError.message);
        } else {
          // Otherwise stringify the object
          console.error('Error object without message:', newError);
          setError(JSON.stringify(newError));
        }
      } else {
        setError(newError);
      }
    };
  }, [lastFetched, isRefreshing]);

  // Helper function to handle error objects consistently
  const handleError = (err) => {
    if (typeof err === 'object' && err !== null) {
      // If error has message property, use it
      if (err.message) {
        console.error('Error object:', err);
        return err.message;
      } else {
        // Otherwise stringify the object
        console.error('Error object without message:', err);
        return JSON.stringify(err);
      }
    }
    return err;
  };

  useEffect(() => {
    // Skip if SupabaseProvider is not available or user is not logged in
    if (!supabaseContextAvailable || !user) {
      // If we're not in a SupabaseProvider context, just set loading to false
      if (!supabaseContextAvailable) {
        setLoading(false);
      }
      return;
    }
    
      console.log('Fetching user profile data for user ID:', user.id);
      getUserProfile(user.id)
        .then((response) => {
          console.log('Profile response received:', response);
          if (response.data) {
            setProfile(response.data);
            console.log('Profile data set:', response.data);
          } else if (response.error) {
          setError(handleError(response.error));
            console.error('Error in profile response:', response.error);
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching profile data:', error);
        setError(handleError(error));
          setLoading(false);
        });
  }, [user, supabaseContextAvailable]);

  useEffect(() => {
    // Skip if no profile or SupabaseProvider is not available
    if (!profile || !supabaseContextAvailable) {
      return;
    }
    
      // Check if we have cached images first
      if (user?.id) {
        // Try to use the imageCacheManager for persistent caching
        if (typeof window !== 'undefined' && window.imageCacheManager) {
          const cachedAvatar = window.imageCacheManager.getAvatarUrl(user.id);
          if (cachedAvatar) {
            console.log('Using cached avatar from global cache manager');
            setAvatarUrl(cachedAvatar);
          }
        }
        
        // Local cache as fallback
        if (!avatarUrl && imageCache.current.has(`avatar_${user.id}`)) {
          const cached = imageCache.current.get(`avatar_${user.id}`);
          console.log('Using cached avatar from local cache');
          setAvatarUrl(cached);
        }
        
        if (!backgroundUrl && imageCache.current.has(`background_${user.id}`)) {
          const cached = imageCache.current.get(`background_${user.id}`);
          console.log('Using cached background from local cache');
          setBackgroundUrl(cached);
        }
      }
      
      // Only fetch new images if it's been more than 5 minutes since last fetch
      // or if we don't have urls yet
      const now = Date.now();
      const shouldRefresh = !avatarUrl || !backgroundUrl || now - lastImageRefresh.current > 300000; // 5 minutes
      
      if (shouldRefresh) {
        console.log('Refreshing profile images - time elapsed or first load');
        const fetchImages = async () => {
          try {
            if (user && profile) {
              // Get avatar image
              const avatar = await getAvatarImageUrl(user.id);
              // Store in both local and persistent cache
              imageCache.current.set(`avatar_${user.id}`, avatar);
              if (typeof window !== 'undefined' && window.imageCacheManager) {
                window.imageCacheManager.setAvatarUrl(user.id, avatar);
                window.imageCacheManager.preload(avatar);
              }
              
              // Get background image
              const background = await getBackgroundImageUrl(user.id);
              imageCache.current.set(`background_${user.id}`, background);
              if (typeof window !== 'undefined' && window.imageCacheManager) {
                window.imageCacheManager.preload(background);
              }
              
              // Set state
              setAvatarUrl(avatar);
              setBackgroundUrl(background);
              lastImageRefresh.current = now;
              console.log('Profile images refreshed from server');
            }
          } catch (error) {
            console.error('Error loading profile images:', error);
            // Fallback to defaults
            setAvatarUrl('/default-avatar.svg');
            setBackgroundUrl('/profile-bg.jpg');
          }
        };
        
        fetchImages();
      } else {
        console.log('Skipping image refresh - recently refreshed');
      }
  }, [profile, user, avatarUrl, backgroundUrl, supabaseContextAvailable]);

  const updateProfile = async (updates) => {
    // Check if SupabaseProvider is available and user is logged in
    if (!supabaseContextAvailable || !user) {
      console.error('Cannot update profile: user not available');
      const error = new Error('User not authenticated');
      setError(handleError(error));
      return { success: false, error: handleError(error) };
    }
    
    setLoading(true);
    try {
      console.log('Updating profile with data:', updates);
      const { data, error } = await updateUserProfile(user.id, updates);
      
      if (error) {
        console.error('Error updating profile:', error);
        setError(handleError(error));
        return { success: false, error: handleError(error) };
      }
      
      console.log('Profile updated successfully:', data);
      setProfile(data);
      
      // If avatar was updated, refresh it but maintain cached URLs
      if (updates.avatarUrl) {
        // Update in cache
        imageCache.current.set(`avatar_${user.id}`, updates.avatarUrl);
        if (typeof window !== 'undefined' && window.imageCacheManager) {
          window.imageCacheManager.setAvatarUrl(user.id, updates.avatarUrl);
          window.imageCacheManager.preload(updates.avatarUrl);
        }
        setAvatarUrl(updates.avatarUrl);
      }
      
      // If background was updated
      if (updates.backgroundUrl) {
        // Update in cache
        imageCache.current.set(`background_${user.id}`, updates.backgroundUrl);
        if (typeof window !== 'undefined' && window.imageCacheManager) {
          window.imageCacheManager.preload(updates.backgroundUrl);
        }
        setBackgroundUrl(updates.backgroundUrl);
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Exception in updateProfile:', error);
      setError(handleError(error));
      return { success: false, error: handleError(error) };
    } finally {
      setLoading(false);
    }
  };

  const uploadProfileImage = async (image) => {
    // Check if SupabaseProvider is available and user is logged in
    if (!supabaseContextAvailable || !user) {
      console.error('Cannot upload profile image: user not available');
      const error = new Error('User not authenticated');
      setError(handleError(error));
      throw error;
    }
    
    setLoading(true);
    try {
      const url = await uploadImage(image);
      
      // Update in cache immediately to prevent flashing
      imageCache.current.set(`avatar_${user.id}`, url);
      if (typeof window !== 'undefined' && window.imageCacheManager) {
        window.imageCacheManager.setAvatarUrl(user.id, url);
        window.imageCacheManager.preload(url);
      }
      
      setAvatarUrl(url);
      return url;
    } catch (error) {
      setError(handleError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveAvatarUrl = async () => {
    if (!supabaseContextAvailable || !user || !profile) return '/default-avatar.svg';
    
    // First try the imageCacheManager
    if (typeof window !== 'undefined' && window.imageCacheManager) {
      const cachedUrl = window.imageCacheManager.getAvatarUrl(user.id);
      if (cachedUrl) {
        return cachedUrl;
      }
    }
    
    // Then try our local cache
    if (imageCache.current.has(`avatar_${user.id}`)) {
      return imageCache.current.get(`avatar_${user.id}`);
    }
    
    // If not in cache, fetch from server
    try {
      const url = await getAvatarImageUrl(user.id);
      
      // Cache for future use
      if (url) {
        imageCache.current.set(`avatar_${user.id}`, url);
        if (typeof window !== 'undefined' && window.imageCacheManager) {
          window.imageCacheManager.setAvatarUrl(user.id, url);
        }
      }
      
      return url || '/default-avatar.svg';
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      return '/default-avatar.svg';
    }
  };

  // Added functions from ProfileStore
  const initializeData = async (userId) => {
    // Check if we're properly authenticated
    if (!supabaseContextAvailable) {
      console.error('Cannot initialize data: SupabaseProvider not available');
      const error = new Error('SupabaseProvider not available');
      setError(handleError(error));
      return;
    }
    
    // Don't initialize if already initialized or loading
    if (isInitialized || isLoading) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch user posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (postsError) throw postsError;
      
      // First, let's inspect the followers table structure to get the correct column names
      try {
        // Attempt to get a single row to see the column structure
        const { data: tableInfo, error: tableInfoError } = await supabase
          .from('followers')
          .select('*')
          .limit(1);
          
        console.log('Followers table structure:', tableInfo);
        
        if (tableInfoError) {
          console.error('Error getting followers table structure:', tableInfoError);
        }
      } catch (inspectError) {
        console.error('Error inspecting followers table:', inspectError);
      }
      
      // Modified queries using more commonly used column names - we'll adjust based on your actual schema
      // Using follower_id/following_id structure for followers
      let followersData, followingData;
      
      // First approach for followers - using follower_id/following_id structure
      const followersResult = await supabase
        .from('followers')
        .select('follower_id, profiles!followers_follower_id_fkey(id, username, avatar_url)')
        .eq('following_id', userId);
        
      if (followersResult.error) {
        console.error('First followers query failed:', followersResult.error);
        
        // If the first query fails, try with another common column name pattern
        const altFollowersResult = await supabase
          .from('followers')
          .select('follower_id, profiles!followers_follower_id_fkey(id, username, avatar_url)')
          .eq('following_id', userId);
          
        if (altFollowersResult.error) {
          console.error('Alternative followers query failed:', altFollowersResult.error);
          followersData = []; // Set empty array as fallback
        } else {
          // Use alternative data if the second query succeeded
          followersData = altFollowersResult.data || [];
        }
      } else {
        followersData = followersResult.data || [];
      }
      
      // Try with following_id instead of followed_id for following
      const followingResult = await supabase
        .from('followers')
        .select('following_id, profiles!followers_following_id_fkey(id, username, avatar_url)')
        .eq('follower_id', userId);
        
      if (followingResult.error) {
        console.error('First following query failed:', followingResult.error);
        
        // If the first query fails, try with another common column name pattern
        const altFollowingResult = await supabase
          .from('followers')
          .select('following_id, profiles!followers_following_id_fkey(id, username, avatar_url)')
          .eq('follower_id', userId);
          
        if (altFollowingResult.error) {
          console.error('Alternative following query failed:', altFollowingResult.error);
          followingData = []; // Set empty array as fallback
        } else {
          // Use alternative data if the second query succeeded
          followingData = altFollowingResult.data || [];
        }
      } else {
        followingData = followingResult.data || [];
      }
      
      // Set the data
      setPosts(postsData || []);
      setFollowers(followersData);
      setFollowing(followingData);
      setIsInitialized(true);
      setLastFetched(Date.now());
      
    } catch (error) {
      console.error('Error initializing profile data:', error);
      setError(handleError(error));
    } finally {
      setIsLoading(false);
    }
  };
  
  const refreshData = async (userId) => {
    // Check if we're properly authenticated
    if (!supabaseContextAvailable) {
      console.error('Cannot refresh data: SupabaseProvider not available');
      const error = new Error('SupabaseProvider not available');
      setError(handleError(error));
      return;
    }
    
    // Don't refresh if already refreshing
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      setError(null);
      
      // Fetch the current profile data - added to ensure experience score is up-to-date
      const { data: profileData, error: profileError } = await getUserProfile(userId);
      
      if (profileError) {
        console.error('Error fetching profile data:', profileError);
      } else if (profileData && profileData.length > 0) {
        // Update profile with the latest data including experience score
        console.log('Updated profile data from refreshData:', profileData[0]);
        setProfile(profileData[0]);
      }
      
      // Similar fetch logic as initializeData
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (postsError) throw postsError;
      
      // Modified queries using more commonly used column names - using the same pattern as in initializeData
      // Using follower_id/following_id structure for followers
      let followersData, followingData;
      
      // First approach for followers - using follower_id/following_id structure
      const followersResult = await supabase
        .from('followers')
        .select('follower_id, profiles!followers_follower_id_fkey(id, username, avatar_url)')
        .eq('following_id', userId);
        
      if (followersResult.error) {
        console.error('First followers query failed:', followersResult.error);
        
        // If the first query fails, try with another common column name pattern
        const altFollowersResult = await supabase
          .from('followers')
          .select('follower_id, profiles!followers_follower_id_fkey(id, username, avatar_url)')
          .eq('following_id', userId);
          
        if (altFollowersResult.error) {
          console.error('Alternative followers query failed:', altFollowersResult.error);
          followersData = []; // Set empty array as fallback
        } else {
          // Use alternative data if the second query succeeded
          followersData = altFollowersResult.data || [];
        }
      } else {
        followersData = followersResult.data || [];
      }
      
      // Try with following_id instead of followed_id for following
      const followingResult = await supabase
        .from('followers')
        .select('following_id, profiles!followers_following_id_fkey(id, username, avatar_url)')
        .eq('follower_id', userId);
        
      if (followingResult.error) {
        console.error('First following query failed:', followingResult.error);
        
        // If the first query fails, try with another common column name pattern
        const altFollowingResult = await supabase
          .from('followers')
          .select('following_id, profiles!followers_following_id_fkey(id, username, avatar_url)')
          .eq('follower_id', userId);
          
        if (altFollowingResult.error) {
          console.error('Alternative following query failed:', altFollowingResult.error);
          followingData = []; // Set empty array as fallback
        } else {
          // Use alternative data if the second query succeeded
          followingData = altFollowingResult.data || [];
        }
      } else {
        followingData = followingResult.data || [];
      }
      
      // Update the data
      setPosts(postsData || []);
      setFollowers(followersData);
      setFollowing(followingData);
      setLastFetched(Date.now());
      
    } catch (error) {
      console.error('Error refreshing profile data:', error);
      setError(handleError(error));
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const clearSelectedStrategy = () => {
    setSelectedStrategy(null);
  };

  // Add a new post to the posts array
  const addPost = (post) => {
    setPosts(prevPosts => [post, ...prevPosts]);
  };

  // Modified getState function to update the global store
  const getState = () => {
    return {
      lastFetched,
      isRefreshing,
      // Add other state as needed
      setError: (newError) => globalProfileState.setError(newError)
    };
  };

  return (
    <ProfileContext.Provider value={{
      // Original ProfileProvider values
      profile,
      avatarUrl,
      backgroundUrl,
      loading,
      error,
      updateProfile,
      uploadProfileImage,
      getEffectiveAvatarUrl,
      
      // Added values from ProfileStore
      posts,
      followers,
      following,
      activeTab,
      isLoading,
      isRefreshing,
      isInitialized,
      lastFetched,
      selectedStrategy,
      
      // Added actions from ProfileStore
      setActiveTab,
      initializeData,
      refreshData, 
      setSelectedStrategy,
      clearSelectedStrategy,
      addPost,
      
      // Static methods
      getState
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

// Custom hook to use the ProfileContext
export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

// Static getState method to mimic Zustand's behavior
// This version doesn't use hooks outside component functions
useProfile.getState = () => {
  // Return the global state instead of using useContext
  return globalProfileState;
};