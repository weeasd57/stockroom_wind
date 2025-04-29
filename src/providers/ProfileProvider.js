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
  const { user, isAuthenticated } = useSupabase();
  const supabaseContextAvailable = !!user || (typeof window !== 'undefined');
  
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

  // Add a ref to track the last refresh time
  const lastRefreshTime = useRef(0);
  const REFRESH_THROTTLE_MS = 5000; // 5 seconds minimum between refreshes
  
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
    
    
    getUserProfile(user.id)
      .then((response) => {
        
        if (response.data) {
          // Fix: Ensure we're extracting the profile data correctly from the array
          const profileData = Array.isArray(response.data) ? response.data[0] : response.data;
          setProfile(profileData);
          
          
          // Check if username exists, if not, ensure it's created
          if (!profileData.username) {
            
            ensureUsername(user.id);
          }
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
            
            setAvatarUrl(cachedAvatar);
          }
        }
        
        // Local cache as fallback
        if (!avatarUrl && imageCache.current.has(`avatar_${user.id}`)) {
          const cached = imageCache.current.get(`avatar_${user.id}`);
          
          setAvatarUrl(cached);
        }
        
        if (!backgroundUrl && imageCache.current.has(`background_${user.id}`)) {
          const cached = imageCache.current.get(`background_${user.id}`);
          
          setBackgroundUrl(cached);
        }
      }
      
      // Only fetch new images if it's been more than 5 minutes since last fetch
      // or if we don't have urls yet
      const now = Date.now();
      const shouldRefresh = !avatarUrl || !backgroundUrl || now - lastImageRefresh.current > 300000; // 5 minutes
      
      if (shouldRefresh) {
        
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
              
            }
          } catch (error) {
            console.error('Error loading profile images:', error);
            // Fallback to defaults
            setAvatarUrl('/default-avatar.svg');
            setBackgroundUrl('/profile-bg.jpg');
          }
        };
        
        fetchImages();
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
      
      const { data, error } = await updateUserProfile(user.id, updates);
      
      if (error) {
        console.error('Error updating profile:', error);
        setError(handleError(error));
        return { success: false, error: handleError(error) };
      }
      
      
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

  // Initialize data for a user - fetch posts, followers, and following
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
      setIsInitialized(true);
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
    
    // Apply throttling to prevent excessive refreshes
    const now = Date.now();
    if (now - lastRefreshTime.current < REFRESH_THROTTLE_MS) {
      
      return;
    }
    
    try {
      setIsRefreshing(true);
      setError(null);
      // Update the last refresh time
      lastRefreshTime.current = now;
      
      // Fetch the current profile data - added to ensure experience score is up-to-date
      const { data: profileData, error: profileError } = await getUserProfile(userId);
      
      if (profileError) {
        console.error('Error fetching profile data:', profileError);
      } else if (profileData) {
        // Update profile with the latest data including experience score
        // Fix: Ensure we're extracting the profile data correctly from the array
        const updatedProfileData = Array.isArray(profileData) ? profileData[0] : profileData;
        if (updatedProfileData) {
          
          setProfile(updatedProfileData);
        } else {
          console.error('No profile data found in refreshData');
        }
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

  // Function to ensure a username exists for the user
  const ensureUsername = async (userId) => {
    if (!userId) return;

    try {
      
      
      // Create a default username based on user ID
      const defaultUsername = `user_${userId.substring(0, 8)}`;
      
      // Update the profile with the default username
      const { data, error } = await updateUserProfile(userId, {
        username: defaultUsername
      });
      
      if (error) {
        console.error('Error creating default username:', error);
        return;
      }
      
      if (data) {
        
        // Update the profile state with the new data
        setProfile(data);
      }
    } catch (err) {
      console.error('Error in ensureUsername:', err);
    }
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