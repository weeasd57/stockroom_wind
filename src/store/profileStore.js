import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserPosts, getFollowers, getFollowing } from '@/utils/supabase';

// Debounce helper to prevent rapid re-fetches
const debounce = (fn, ms) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

const useProfileStore = create(
  persist(
    (set, get) => {
      // Create debounced versions of functions
      let debouncedInitDataFn = null;
      
      // This will be properly initialized after the store is created
      const getDebouncedInitializeData = () => {
        if (!debouncedInitDataFn) {
          debouncedInitDataFn = debounce((userId) => {
            const initFn = get().initializeData;
            if (initFn) {
              initFn(userId);
            }
          }, 300); // 300ms debounce
        }
        return debouncedInitDataFn;
      };
      
      return {
        // Data states
        posts: [],
        followers: [],
        following: [],
        activeTab: 'posts',
        lastFetched: null,
        isInitialized: false,
        
        // Loading states
        isLoading: false,
        isRefreshing: false, // separate state for background refresh
        error: null,
        abortController: null,
        selectedStrategy: null,

        // Action to set active tab
        setActiveTab: (tab) => {
          if (tab === get().activeTab) return;
          set({ activeTab: tab });
        },

        // Action to set error message
        setError: (errorMessage) => {
          set({ error: errorMessage });
        },

        // Action to abort any ongoing requests
        abortFetch: () => {
          const { abortController } = get();
          if (abortController && abortController.signal && !abortController.signal.aborted) {
            console.log('Aborting profile data fetch');
            abortController.abort();
          }
          set({ abortController: null });
        },

        // Initialize data
        initializeData: async (userId) => {
          const initStart = performance.now();
          console.log(`[PROFILE DEBUG] 🚀 Starting profile data initialization for user ${userId} at ${new Date().toISOString()}`);
          
          // Store userId for later use
          set({ userId });
          
          // Don't load if already loading
          if (get().isLoading) {
            console.log('[PROFILE DEBUG] ⚠️ Already loading profile data, initialization aborted');
            return;
          }
          
          // Check if data was recently fetched with the same strategy
          const { lastFetched, selectedStrategy } = get();
          const currentStrategy = selectedStrategy;
          
          // If data was fetched in the last 10 seconds with the same strategy, skip fetching
          if (lastFetched && (Date.now() - lastFetched < 10000) && 
              ((currentStrategy === null && selectedStrategy === null) || 
               (currentStrategy === selectedStrategy))) {
            console.log(`[PROFILE DEBUG] ✅ Data recently fetched (${(Date.now() - lastFetched) / 1000}s ago) with same strategy, skipping fetch`);
            // Just update loading state and return
            set({ isLoading: false });
            return;
          }
          
          // Abort any ongoing fetch
          console.log('[PROFILE DEBUG] 🛑 Aborting any ongoing fetch operations');
          const abortStart = performance.now();
          get().abortFetch();
          const abortEnd = performance.now();
          console.log(`[PROFILE DEBUG] ⏱️ Abort operation took ${(abortEnd - abortStart).toFixed(2)}ms`);
          
          // Create a new abort controller
          const controller = new AbortController();
          const signal = controller.signal;
          
          console.log('[PROFILE DEBUG] 🔄 Setting loading state');
          set({ 
            isLoading: true, 
            error: null,
            abortController: controller
          });
          
          try {
            console.log(`[PROFILE DEBUG] 📊 Fetching profile data for user ${userId}${selectedStrategy ? ` with strategy: ${selectedStrategy}` : ''}`);
            
            const fetchStart = performance.now();
            console.time('[PROFILE DEBUG] ⏱️ Profile data fetch - total time');
            
            // Create separate promises for better debugging
            console.log('[PROFILE DEBUG] 🔄 Starting parallel data fetches');
            
            // Start each fetch and track timing separately
            console.time('[PROFILE DEBUG] ⏱️ Posts fetch');
            const postsPromise = getUserPosts(userId, 1, 50, signal, selectedStrategy);
            
            console.time('[PROFILE DEBUG] ⏱️ Followers fetch');
            const followersPromise = getFollowers(userId, signal);
            
            console.time('[PROFILE DEBUG] ⏱️ Following fetch');
            const followingPromise = getFollowing(userId, signal);
            
            // Wait for all promises to resolve
            const [postsResponse, followers, following] = await Promise.all([
              postsPromise.then(result => {
                console.timeEnd('[PROFILE DEBUG] ⏱️ Posts fetch');
                console.log(`[PROFILE DEBUG] ✅ Posts fetch completed, got ${result.posts?.length || 0} posts`);
                return result;
              }),
              followersPromise.then(result => {
                console.timeEnd('[PROFILE DEBUG] ⏱️ Followers fetch');
                console.log(`[PROFILE DEBUG] ✅ Followers fetch completed, got ${result.data?.length || 0} followers`);
                return result.data;
              }),
              followingPromise.then(result => {
                console.timeEnd('[PROFILE DEBUG] ⏱️ Following fetch');
                console.log(`[PROFILE DEBUG] ✅ Following fetch completed, got ${result.data?.length || 0} following`);
                return result.data;
              })
            ]);
            
            console.timeEnd('[PROFILE DEBUG] ⏱️ Profile data fetch - total time');
            const fetchEnd = performance.now();
            console.log(`[PROFILE DEBUG] ⏱️ All data fetches completed in ${(fetchEnd - fetchStart).toFixed(2)}ms`);

            // Check if the request was aborted
            if (signal.aborted) {
              console.log('[PROFILE DEBUG] 🛑 Profile data fetch aborted');
              return;
            }

            console.log('[PROFILE DEBUG] 💾 Updating store with fetched data');
            const updateStart = performance.now();
            
            set({
              posts: postsResponse.posts || [],
              followers: followers || [],
              following: following || [],
              lastFetched: Date.now(),
              isLoading: false,
              isInitialized: true,
              abortController: null
            });
            
            const updateEnd = performance.now();
            console.log(`[PROFILE DEBUG] ⏱️ Store update took ${(updateEnd - updateStart).toFixed(2)}ms`);
            
            const initEnd = performance.now();
            console.log(`[PROFILE DEBUG] ✅ Total initialization time: ${(initEnd - initStart).toFixed(2)}ms`);
          } catch (error) {
            // Don't update state if the request was aborted
            if (error.name === 'AbortError') {
              console.log('[PROFILE DEBUG] 🛑 Profile data fetch aborted');
              return;
            }

            console.error('[PROFILE DEBUG] ❌ Error loading profile data:', error);
            
            set({ 
              error: error.message || 'Failed to load profile data',
              isLoading: false,
              abortController: null
            });
            
            const initEnd = performance.now();
            console.log(`[PROFILE DEBUG] ❌ Initialization failed after ${(initEnd - initStart).toFixed(2)}ms`);
          }
        },

        // Refresh data in the background (no loading state)
        refreshData: async (userId) => {
          // Don't refresh if already refreshing
          if (get().isRefreshing) {
            console.log('Already refreshing profile data');
            return;
          }
          
          // Abort any ongoing fetch
          get().abortFetch();
          
          // Create a new abort controller
          const controller = new AbortController();
          const signal = controller.signal;
          
          set({ 
            isRefreshing: true,
            abortController: controller
          });
          
          try {
            // Get selected strategy
            const selectedStrategy = get().selectedStrategy;
            
            // Fetch data with strategy filter if selected
            const [postsResponse, followers, following] = await Promise.all([
              getUserPosts(userId, 1, 50, signal, selectedStrategy),
              getFollowers(userId, signal),
              getFollowing(userId, signal)
            ]);

            // Check if the request was aborted
            if (signal.aborted) {
              console.log('Profile data refresh aborted');
              return;
            }

            set({
              posts: postsResponse.posts || [],
              followers: followers || [],
              following: following || [],
              lastFetched: Date.now(),
              isRefreshing: false,
              abortController: null
            });
            console.log('Profile data refreshed successfully');
          } catch (error) {
            // Don't update state if the request was aborted
            if (error.name === 'AbortError') {
              console.log('Profile data refresh aborted');
              return;
            }

            console.error('Error refreshing profile data:', error);
            set({ 
              isRefreshing: false,
              abortController: null
            });
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
        reset: () => {
          // Abort any ongoing requests
          get().abortFetch();
          
          set({
            posts: [],
            followers: [],
            following: [],
            activeTab: 'posts',
            isLoading: false,
            isRefreshing: false,
            error: null,
            lastFetched: null,
            isInitialized: false,
            abortController: null
          });
        },

        // Set the selected strategy filter
        setSelectedStrategy: (strategy) => {
          // Show loading state while applying the filter
          set({ 
            selectedStrategy: strategy,
            isLoading: true
          });
          
          const userId = get().userId;
          if (userId) {
            // Use debounced version to prevent rapid re-fetches
            getDebouncedInitializeData()(userId);
          }
        },
        
        // Clear the strategy filter
        clearSelectedStrategy: () => {
          // Show loading state while clearing the filter
          set({ 
            selectedStrategy: null,
            isLoading: true 
          });
          
          const userId = get().userId;
          if (userId) {
            // Use debounced version to prevent rapid re-fetches
            getDebouncedInitializeData()(userId);
          }
        },
      };
    },
    {
      name: 'profile-store',
      partialize: (state) => ({
        posts: state.posts,
        followers: state.followers,
        following: state.following,
        lastFetched: state.lastFetched,
        isInitialized: state.isInitialized,
        activeTab: state.activeTab
      })
    }
  )
);

export default useProfileStore;
