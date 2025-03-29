import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserPosts, getFollowers, getFollowing } from '@/utils/supabase';

const useProfileStore = create(
  persist(
    (set, get) => ({
      // Data states
      posts: [],
      followers: [],
      following: [],
      activeTab: 'posts',
      lastFetched: null,
      isInitialized: false,
      
      // Loading states
      isLoading: false,
      error: null,

      // Action to set active tab
      setActiveTab: (tab) => {
        if (tab === get().activeTab) return;
        set({ activeTab: tab });
      },

      // Action to initialize data once
      initializeData: async (userId) => {
        if (!userId || get().isInitialized) return;

        set({ isLoading: true, error: null });

        try {
          const [postsData, followers, following] = await Promise.all([
            getUserPosts(userId),
            getFollowers(userId),
            getFollowing(userId)
          ]);

          set({
            posts: postsData?.posts || [],
            followers: followers || [],
            following: following || [],
            isLoading: false,
            lastFetched: Date.now(),
            isInitialized: true
          });
        } catch (error) {
          console.error('Error initializing profile data:', error);
          set({ error: error.message, isLoading: false });
        }
      },

      // Action to refresh data in background
      refreshData: async (userId) => {
        if (!userId) return;

        try {
          const [postsData, followers, following] = await Promise.all([
            getUserPosts(userId),
            getFollowers(userId),
            getFollowing(userId)
          ]);

          set({
            posts: postsData?.posts || [],
            followers: followers || [],
            following: following || [],
            lastFetched: Date.now()
          });
        } catch (error) {
          console.error('Error refreshing profile data:', error);
          // Don't update error state for background refresh
        }
      },

      // Action to update posts without loading state
      updatePosts: (posts) => set({ posts }),

      // Action to update followers without loading state
      updateFollowers: (followers) => set({ followers }),

      // Action to update following without loading state
      updateFollowing: (following) => set({ following }),

      // Action to add a new post optimistically
      addPost: (post) => set(state => ({ 
        posts: [post, ...state.posts] 
      })),

      // Action to remove a post optimistically
      removePost: (postId) => set(state => ({ 
        posts: state.posts.filter(post => post.id !== postId) 
      })),

      // Action to add a follower optimistically
      addFollower: (follower) => set(state => ({ 
        followers: [follower, ...state.followers] 
      })),

      // Action to remove a follower optimistically
      removeFollower: (followerId) => set(state => ({ 
        followers: state.followers.filter(f => f.id !== followerId) 
      })),

      // Action to add to following optimistically
      addFollowing: (following) => set(state => ({ 
        following: [following, ...state.following] 
      })),

      // Action to remove from following optimistically
      removeFollowing: (followingId) => set(state => ({ 
        following: state.following.filter(f => f.id !== followingId) 
      })),

      // Reset store
      reset: () => set({
        posts: [],
        followers: [],
        following: [],
        activeTab: 'posts',
        isLoading: false,
        error: null,
        lastFetched: null,
        isInitialized: false
      })
    }),
    {
      name: 'profile-store',
      partialize: (state) => ({
        posts: state.posts,
        followers: state.followers,
        following: state.following,
        lastFetched: state.lastFetched,
        isInitialized: state.isInitialized
      })
    }
  )
);

export default useProfileStore;
