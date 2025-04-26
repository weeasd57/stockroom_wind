import { createClient } from '@supabase/supabase-js';
// import logger from '@/utils/logger';

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if environment variables are set
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Ensure we have valid credentials before creating the client
if (!isSupabaseConfigured()) {
}

// Create the Supabase client with options
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: (...args) => fetch(...args),
  },
  // Add more detailed error handling
  debug: process.env.NODE_ENV === 'development',
  // Set reasonable timeouts
  realtime: {
    timeout: 30000, // 30 seconds
  },
});

// Test the connection on initialization
(async function testConnection() {
  if (typeof window !== 'undefined' && isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('_connection_test').select('*').limit(1).single();
      // If we get a "relation does not exist" error, that's actually good
      // It means we connected to the database but the table doesn't exist
    } catch (err) {
    }
  }
})();

// Authentication helpers
/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} - Signed up user data and error
 */
export const signUp = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
};

/**
 * Sign in an existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} - Signed in user data and error
 */
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // We don't need to manually update last_sign_in
    // This is handled by Supabase's auth system
    
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
};

/**
 * Sign out the current user
 * @param {object} router - Next.js router for redirection (optional)
 * @returns {Promise<object>} - Sign out error
 */
export const signOut = async (router = null) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // If router is provided, redirect to landing page
    if (router) {
      router.push('/landing');
    }
    
    return { error: null };
  } catch (e) {
    return { error: e };
  }
};

/**
 * Get the current user
 * @returns {Promise<object>} - Current user data
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // If there's an authentication error (like invalid refresh token)
    if (error) {
      // Just return null instead of signing out automatically
      return null;
    }
    
    return user;
  } catch (error) {
    // Return null to gracefully handle the error
    return null;
  }
};

// User profile helpers
/**
 * Get a user's profile
 * @param {string} userId - User ID
 * @returns {Promise<object>} - User profile data and error
 */
export const getUserProfile = async (userId) => {
  if (userId === undefined) {
    return { data: null, error: { message: 'User ID is required' } };
  }

  if (userId === null) {
    return { data: null, error: { message: 'User ID cannot be null' } };
  }

  try {
    // First, get the user profile data
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, email, avatar_url, background_url, bio, success_posts, loss_posts, experience_Score')
      .eq('id', userId);

    if (error) throw error;
    
    // Count successful and lost posts for this user
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('target_reached, stop_loss_triggered')
      .eq('user_id', userId)
      .eq('closed', true);
      
    if (!postsError && postsData) {
      // Count successful and lost posts
      const successPosts = postsData.filter(post => post.target_reached).length;
      const lossPosts = postsData.filter(post => post.stop_loss_triggered).length;
      
      // Calculate experience score (success - loss)
      const experienceScore = successPosts - lossPosts;
      
      // If we have profile data, update the counts
      if (data && data.length > 0) {
        // Update the profile with the latest counts
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            success_posts: successPosts,
            loss_posts: lossPosts,
            experience_Score: experienceScore
          })
          .eq('id', userId);
          
        if (!updateError) {
          // Update the data object with the new counts
          data[0].success_posts = successPosts;
          data[0].loss_posts = lossPosts;
          data[0].experience_Score = experienceScore;
        }
      }
    }
    
    // If no profile exists, return empty data instead of error
    if (!data || data.length === 0) {
      
      // Create a default profile for the user
      const defaultProfile = {
        id: userId,
        username: `user_${userId.substring(0, 8)}`,
        full_name: null,
        email: null,
        avatar_url: null,
        background_url: null,
        bio: null,
        experience_Score: 0,
        success_posts: 0,
        loss_posts: 0,
      };
      
      // Count successful and lost posts for this user (in case they exist before profile creation)
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('target_reached, stop_loss_triggered')
        .eq('user_id', userId)
        .eq('closed', true);
        
      if (!postsError && postsData && postsData.length > 0) {
        // Count successful and lost posts
        defaultProfile.success_posts = postsData.filter(post => post.target_reached).length;
        defaultProfile.loss_posts = postsData.filter(post => post.stop_loss_triggered).length;
        defaultProfile.experience_Score = defaultProfile.success_posts - defaultProfile.loss_posts;
      }
      
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([defaultProfile]);
      
      if (insertError) {
        return { data: null, error: insertError };
      }
      
      return { data: [defaultProfile], error: null };
    }
    
    return { data: data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Update a user's profile
 * @param {string} userId - User ID
 * @param {object} updates - Profile updates
 * @returns {Promise<object>} - Updated profile data and error
 */
export const updateUserProfile = async (userId, updates) => {
  if (!userId) return { data: null, error: 'No user ID provided' };

  try {

    
    // Ensure avatar_url and background_url are properly handled
    const sanitizedUpdates = { ...updates };
    
    // Special handling for OAuth profile pictures
    // If it's a Google profile picture, store it as is without cache-busting parameters
    if (sanitizedUpdates.avatar_url) {
      if (sanitizedUpdates.avatar_url.includes('googleusercontent.com')) {
        // Keep the Google URL as is
      } else if (sanitizedUpdates.avatar_url.includes('?')) {
        // For non-OAuth URLs, remove cache-busting parameters
        sanitizedUpdates.avatar_url = sanitizedUpdates.avatar_url.split('?')[0];

      }
    }
    
    if (sanitizedUpdates.background_url && sanitizedUpdates.background_url.includes('?')) {
      sanitizedUpdates.background_url = sanitizedUpdates.background_url.split('?')[0];

    }

    const { data, error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {

      throw error;
    }

    return { data, error: null };
  } catch (error) {

    return { data: null, error };
  }
};

// Upload image to Supabase storage
/**
 * Upload an image to storage
 * @param {File} file - Image file to upload
 * @param {string} bucket - Storage bucket
 * @param {string} userId - User ID
 * @param {string} fileType - File type (default: 'avatar')
 * @returns {Promise<object>} - Public URL of the uploaded image and error
 */
export const uploadImage = async (file, bucket, userId, fileType = 'avatar', options = {}) => {
  if (!file || !bucket || !userId) {

    return { publicUrl: null, error: 'Missing required parameters' };
  }

  try {

    
    // Get file extension from the file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    // Create a path for the file: userId/fileType.extension
    const filePath = `${userId}/${fileType}.${fileExtension}`;

    
    // Check if we can access the bucket - do NOT try to create it if it doesn't exist
    try {
      const { data: bucketContents, error: listError } = await supabase.storage
        .from(bucket)
        .list();
      
      if (listError) {

        return { publicUrl: null, error: `Storage bucket '${bucket}' is not accessible. This is likely because it hasn't been created by an administrator. Please contact support.` };
      }
    } catch (bucketAccessError) {

      return { publicUrl: null, error: bucketAccessError };
    }
    
    // Delete any existing files with the same name pattern
    try {

      const { data: existingFiles, error: listError } = await supabase.storage
        .from(bucket)
        .list(userId);
      
      if (!listError && existingFiles) {
        const filesToDelete = existingFiles.filter(file => file.name.startsWith(`${fileType}.`));
        
        if (filesToDelete.length > 0) {

          
          for (const fileToDelete of filesToDelete) {

            const { error: deleteError } = await supabase.storage
              .from(bucket)
              .remove([`${userId}/${fileToDelete.name}`]);
            
            if (deleteError) {

            }
          }
        } else {

        }
      }
    } catch (deleteError) {

      // Continue with the upload even if deletion fails
    }
    
    // Upload the new file with progress handling if provided

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        cacheControl: 'no-cache',
        ...options // Include any additional options like onUploadProgress
      });
    
    if (uploadError) {

      return { data: null, error: uploadError, publicUrl: null };
    }
    
    // Get the public URL
    const publicUrlResponse = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    // Handle different response structures in different Supabase versions
    let publicUrl;
    if (publicUrlResponse?.data?.publicUrl) {
      publicUrl = publicUrlResponse.data.publicUrl;
    } else if (typeof publicUrlResponse?.publicUrl === 'string') {
      publicUrl = publicUrlResponse.publicUrl;
    } else {

      return { data: uploadData, error: new Error('Failed to get public URL'), publicUrl: null };
    }
    
    if (!publicUrl) {

      return { data: uploadData, error: new Error('Failed to get public URL'), publicUrl: null };
    }

    
    // Use a more stable cache-busting parameter (daily instead of every millisecond)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheBuster = `?t=${today}`;
    const baseUrl = publicUrl.split('?')[0]; // Base URL without any query parameters
    const publicUrlWithCacheBuster = `${baseUrl}${cacheBuster}`;
    
    // Automatically update the profile with the new image URL
    try {
      const profileField = fileType === 'avatar' ? 'avatar_url' : 'background_url';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [profileField]: baseUrl })
        .eq('id', userId);
      
      if (updateError) {

      } else {

      }
    } catch (updateError) {

      // Continue even if profile update fails
    }

    return { data: uploadData, publicUrl: publicUrlWithCacheBuster, error: null };
  } catch (error) {

    return { data: null, publicUrl: null, error };
  }
};

// Get background image URL directly from storage
/**
 * Get a user's background image URL directly from storage, updating profile if needed
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Background image URL
 */
export const getBackgroundImageUrl = async (userId) => {
  if (!userId) return '/profile-bg.jpg';

  try {
    // First attempt to get the background directly from storage
    // This ensures we always have the latest version

    
    try {
      // Check if user has files in the backgrounds bucket
      const { data: files, error: listError } = await supabase.storage
        .from('backgrounds')
        .list(userId);
      
      if (listError) {

      } else if (files && files.length > 0) {
        // First try to find files prefixed with 'background.'
        let backgroundFile = files.find(file => file.name.startsWith('background.'));
        
        // If no background.* file found, take any image file
        if (!backgroundFile) {
          const imageFiles = files.filter(file => 
            file.name.endsWith('.jpg') || 
            file.name.endsWith('.jpeg') || 
            file.name.endsWith('.png') || 
            file.name.endsWith('.gif') || 
            file.name.endsWith('.webp')
          );
          
          if (imageFiles.length > 0) {
            // Sort by last modified and get the most recent
            backgroundFile = imageFiles.sort((a, b) => {
              return new Date(b.created_at || b.last_modified) - new Date(a.created_at || a.last_modified);
            })[0];
          }
        }
        
        if (backgroundFile) {

          
          // Get the public URL for the file
          const { data: urlData } = supabase.storage
            .from('backgrounds')
            .getPublicUrl(`${userId}/${backgroundFile.name}`);
          
          if (urlData?.publicUrl) {
            const baseUrl = urlData.publicUrl.split('?')[0]; // Remove query params
            const cacheParam = `?t=${Date.now()}`; // Force cache refresh
            const fullUrl = `${baseUrl}${cacheParam}`;
            
            // Also update the profile table with this URL (without cache param)

            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ background_url: baseUrl })
                .eq('id', userId);
              
              if (updateError) {

              }
            } catch (updateError) {

            }
            
            return fullUrl;
          }
        }
      }
    } catch (storageError) {

    }
    
    // If we couldn't get the background from storage, check the profile

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('background_url')
      .eq('id', userId)
      .single();

    if (profileError) {

    } else if (profile?.background_url && profile.background_url !== '/profile-bg.jpg') {
      // If we have a valid URL in the profile, use it with cache busting
      const cacheParam = `?t=${Date.now()}`; // Force cache refresh
      const baseUrl = profile.background_url.split('?')[0]; // Remove any existing params
      return `${baseUrl}${cacheParam}`;
    }

    // If no background found in storage or profile, return default
    return '/profile-bg.jpg';
  } catch (error) {

    return '/profile-bg.jpg';
  }
};

/**
 * Get a user's avatar image URL directly from storage, updating profile if needed
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Avatar image URL
 */
export const getAvatarImageUrl = async (userId) => {
  if (!userId) return '/default-avatar.svg';

  try {
    // First attempt to get the avatar directly from storage
    // This ensures we always have the latest version

    
    try {
      // Check if user has files in the avatars bucket
      const { data: files, error: listError } = await supabase.storage
        .from('avatars')
        .list(userId);
      
      if (listError) {

      } else if (files && files.length > 0) {
        // First try to find files prefixed with 'avatar.'
        let avatarFile = files.find(file => file.name.startsWith('avatar.'));
        
        // If no avatar.* file found, take any image file
        if (!avatarFile) {
          const imageFiles = files.filter(file => 
            file.name.endsWith('.jpg') || 
            file.name.endsWith('.jpeg') || 
            file.name.endsWith('.png') || 
            file.name.endsWith('.gif') || 
            file.name.endsWith('.webp')
          );
          
          if (imageFiles.length > 0) {
            // Sort by last modified and get the most recent
            avatarFile = imageFiles.sort((a, b) => {
              return new Date(b.created_at || b.last_modified) - new Date(a.created_at || a.last_modified);
            })[0];
          }
        }
        
        if (avatarFile) {

          
          // Get the public URL for the file
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(`${userId}/${avatarFile.name}`);
          
          if (urlData?.publicUrl) {
            const baseUrl = urlData.publicUrl.split('?')[0]; // Remove query params
            const cacheParam = `?t=${Date.now()}`; // Force cache refresh
            const fullUrl = `${baseUrl}${cacheParam}`;
            
            // Also update the profile table with this URL (without cache param)

            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: baseUrl })
                .eq('id', userId);
              
              if (updateError) {

              }
            } catch (updateError) {

            }
            
            return fullUrl;
          }
        }
      }
    } catch (storageError) {

    }
    
    // If we couldn't get the avatar from storage, check the profile

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (profileError) {

    } else if (profile?.avatar_url && profile.avatar_url !== '/default-avatar.svg') {
      // If we have a valid URL in the profile, use it with cache busting
      const cacheParam = `?t=${Date.now()}`; // Force cache refresh
      const baseUrl = profile.avatar_url.split('?')[0]; // Remove any existing params
      return `${baseUrl}${cacheParam}`;
    }

    // If no avatar found in storage or profile, return default
    return '/default-avatar.svg';
  } catch (error) {

    return '/default-avatar.svg';
  }
};

// Check if a file exists in storage
/**
 * Check if a file exists in storage
 * @param {string} bucket - Storage bucket
 * @param {string} path - File path
 * @returns {Promise<boolean>} - Whether the file exists
 */
export const checkFileExists = async (bucket, path) => {
  try {
    // Extract the directory path and filename
    const lastSlashIndex = path.lastIndexOf('/');
    const dirPath = lastSlashIndex !== -1 ? path.substring(0, lastSlashIndex) : '';
    const fileName = lastSlashIndex !== -1 ? path.substring(lastSlashIndex + 1) : path;
    
    // List the directory contents
    const { data, error } = await supabase.storage.from(bucket).list(dirPath);
    
    if (error) throw error;
    
    // Check if the file exists in the directory
    return data && data.some(file => file.name === fileName);
  } catch (error) {

    return false;
  }
};

// Enhanced createPost function with graceful timeout handling and background retries
async function createPost(post, userId) {
  const startTime = performance.now();

  
  // Create a sanitized post object without the images field
  const { images, ...sanitizedPost } = post;
  
  // Prepare a simplified version for retries (with just essential data)
  const essentialPostData = {
    title: post.title,
    content: post.content,
    user_id: userId,
    strategy: post.strategy || null,
    created_at: new Date().toISOString(),
  };
  
  try {
    // Step 1: Create the post with an explicit timeout (extended from default 5s)

    const { data, error } = await supabase
      .from('posts')
      .insert([sanitizedPost]) // Use sanitized post without images
      .select();
    
    const insertDuration = performance.now() - startTime;

    
    if (error) {

      
      // Start background retry process for timeouts and network errors
      if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT' || 
          error.code === 'NETWORK_ERROR' || error.message?.includes('network')) {
        
        // Launch background retry attempts without blocking UI

        
        // First retry after 2 seconds
        setTimeout(() => {

          supabase
            .from('posts')
            .insert([essentialPostData])
            .then(({ data, error }) => {
              if (error) {

                
                // Second retry after another 5 seconds with longer timeout
                setTimeout(() => {

                  supabase
                    .from('posts')
                    .insert([essentialPostData])
                    .then(({ data, error }) => {
                      if (error) {

                        
                        // Third and final retry after 10 more seconds with even longer timeout
                        setTimeout(() => {

                          supabase
                            .from('posts')
                            .insert([essentialPostData])
                            .then(({ data, error }) => {
                              if (error) {

                              } else {

                                // No need to invalidate cache here - it will be refreshed on next visit
                              }
                            });
                        }, 10000);
                      } else {

                        // No need to invalidate cache here - it will be refreshed on next visit
                      }
                    });
                }, 5000);
              } else {

                // No need to invalidate cache here - it will be refreshed on next visit
              }
            });
        }, 2000);
        
        // For timeout errors, return a special response for optimistic UI
        return { 
          data: [{ 
            ...sanitizedPost, // Use sanitized post
            id: `temp-${Date.now()}`,
            created_at: new Date().toISOString(),
            syncing: true 
          }], 
          error: { 
            message: 'Post will sync when connection improves',
            isTimeout: true
          } 
        };
      }
      
      // For other errors, throw normally
      throw error;
    }
    
    // Clear caches after successful post creation

    clearPostCache();

    return { data, error: null };
  } catch (error) {

    const duration = performance.now() - startTime;

    
    return { data: null, error };
  }
}

/**
 * Upload post image with performance tracking
 * @param {File} file - Image file to upload
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Public URL of the uploaded image
 */
export async function uploadPostImage(file, userId) {
  const uploadStart = performance.now();
  const fileSize = Math.round(file.size / 1024);
  const fileType = file.type;

  
  try {
    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${userId}-post-${timestamp}.${fileExt}`;
    
    // First try to use the 'posts' bucket
    let bucketName = 'post_images';
    let filePath = `${fileName}`;
    
    // Check if the 'posts' bucket exists by trying to list its contents
    const { data: bucketCheck, error: bucketError } = await supabase.storage
      .from(bucketName)
      .list();
    
    // If there's an error with the 'posts' bucket, fall back to 'avatars' bucket
    if (bucketError) {

      bucketName = 'avatars';
      filePath = `posts/${fileName}`; // Store in a 'posts' subfolder
    }

    
    // Track storage upload operation
    const storageUploadStart = performance.now();
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true // Changed to true to overwrite if needed
      });
    
    const storageUploadEnd = performance.now();

    
    if (error) {

      throw error;
    }
    
    // Track URL generation time
    const urlGenStart = performance.now();

    
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    const publicUrl = publicUrlData.publicUrl;
    
    const urlGenEnd = performance.now();

    
    const uploadEnd = performance.now();

    
    return publicUrl;
  } catch (error) {
    const uploadEnd = performance.now();

    throw error;
  }
}

/**
 * Check if a table exists in the database
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<boolean>} - Whether the table exists
 */
export async function checkTableExists(tableName) {
  try {
    // Query the information_schema to check if the table exists
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', tableName)
      .eq('table_schema', 'public');
    
    if (error) {

      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {

    return false;
  }
}

/**
 * Check if the Supabase connection is working
 * @returns {Promise<boolean>} - Whether the connection is working
 */
export async function checkSupabaseConnection() {
  try {
    // First check if Supabase is configured
    if (!isSupabaseConfigured()) {

      return false;
    }

    // Try a simple query to check if the connection works
    const { data, error } = await supabase.from('_anon_auth_check').select('*').limit(1);
    
    // If we get a "relation does not exist" error, that's actually good
    // It means we connected to the database but the table doesn't exist
    if (error && error.code === '42P01') {

      return true;
    }
    
    if (error) {

      
      // Check for specific error types to provide better diagnostics
      if (error.code === 'PGRST301') {

      } else if (error.code === 'PGRST401') {

      } else if (error.message && error.message.includes('Failed to fetch')) {

      }
      
      return false;
    }

    return true;
  } catch (error) {

    
    // Provide more specific error information
    if (error.message && error.message.includes('fetch')) {

    } else if (error.message && error.message.includes('timeout')) {

    }
    
    return false;
  }
}

// Cache for posts data
const postsCache = {
  data: new Map(),
  timestamp: new Map(),
  ttl: 60000, // 60 seconds cache TTL (increased from 30s)
};

// Cache for user posts
const userPostsCache = {
  data: new Map(),
  timestamp: new Map(),
  ttl: 120000, // 120 seconds cache TTL (increased from 60s)
};

/**
 * Get posts with pagination
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of posts per page
 * @param {AbortSignal} signal - AbortController signal for cancellation
 * @returns {Promise<object>} - Posts and pagination info
 */
async function getPosts(page = 1, limit = 10, signal) {
  try {
    const cacheKey = `posts_${page}_${limit}`;
    const cachedData = postsCache.data.get(cacheKey);
    const cachedTimestamp = postsCache.timestamp.get(cacheKey);
    
    // Check if there's a cached version and it's not expired
    if (cachedData && cachedTimestamp && (Date.now() - cachedTimestamp < postsCache.ttl)) {
      return cachedData;
    }
    
    // Check if the operation was cancelled before starting
    if (signal && signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // First check if we can connect to Supabase
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
      throw new Error('Unable to connect to Supabase. Please check your connection and credentials.');
    }
    
    // Check if cancelled after connection check
    if (signal && signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Always use posts table directly, not post_details view

    
    // Try posts table
    const { data: postsData, error: postsError, count } = await supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
      .abortSignal(signal); // Add abort signal support

    if (postsError) {

      throw postsError;
    }

    const totalPages = Math.ceil((count || 0) / limit);
    const response = {
      data: postsData || [],
      error: null,
      hasMorePages: page < totalPages,
      totalCount: count || 0,
      currentPage: page,
      totalPages
    };

    // Don't cache results if the request was aborted
    if (!signal || !signal.aborted) {
      postsCache.data.set(cacheKey, response);
      postsCache.timestamp.set(cacheKey, Date.now());
    }

    return response;
  } catch (error) {
    // If this is an abort error, just propagate it
    if (error.name === 'AbortError') {
      throw error;
    }

    return {
      data: [],
      error: {
        message: error.message || 'Failed to fetch posts',
        details: error.details || error.toString(),
        hint: error.hint || 'Check your Supabase connection and database setup',
        columns: error.columns || []
      },
      hasMorePages: false,
      totalCount: 0,
      currentPage: page,
      totalPages: 0
    };
  }
}

// Function to invalidate posts cache when new post is created
export function invalidatePostsCache() {

  postsCache.data.clear();
  postsCache.timestamp.clear();
  userPostsCache.data.clear();
  userPostsCache.timestamp.clear();
}

// Alias for invalidatePostsCache for backward compatibility
export const clearPostCache = invalidatePostsCache;

/**
 * Get posts by user ID
 * @param {string} userId - User ID
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of posts per page
 * @param {AbortSignal} signal - Optional AbortController signal for cancellation
 * @param {string} strategy - Optional strategy to filter posts by
 * @returns {Promise<object>} - Posts and pagination info
 */
async function getUserPosts(userId, page = 1, limit = 10, signal, strategy = null) {
  const fetchStart = performance.now();

  
  if (!userId) {

    return { posts: [], totalCount: 0, currentPage: page, totalPages: 0 };
  }

  try {
    // Include strategy in cache key if provided
    const cacheKey = strategy 
      ? `user_posts_${userId}_${page}_${limit}_${strategy}` 
      : `user_posts_${userId}_${page}_${limit}`;

    const cacheCheckStart = performance.now();
      
    const cachedData = userPostsCache.data.get(cacheKey);
    const cachedTimestamp = userPostsCache.timestamp.get(cacheKey);
    
    const cacheCheckEnd = performance.now();

    
    // Check if there's a cached version and it's not expired
    if (cachedData && cachedTimestamp && (Date.now() - cachedTimestamp < userPostsCache.ttl)) {

      const fetchEnd = performance.now();

      return cachedData;
    }

    
    // If a strategy is provided, but we have cached all posts, we can filter them in memory
    // This avoids an extra database query
    if (strategy) {

      const memoryFilterStart = performance.now();
      
      const allPostsCacheKey = `user_posts_${userId}_${page}_${limit}`;
      const allPostsCachedData = userPostsCache.data.get(allPostsCacheKey);
      const allPostsCachedTimestamp = userPostsCache.timestamp.get(allPostsCacheKey);
      
      if (allPostsCachedData && allPostsCachedTimestamp && 
          (Date.now() - allPostsCachedTimestamp < userPostsCache.ttl)) {

        
        // Filter the cached posts by strategy
        const filterStart = performance.now();
        const filteredPosts = allPostsCachedData.posts.filter(post => post.strategy === strategy);
        const filterEnd = performance.now();

        
        const result = {
          posts: filteredPosts,
          totalCount: filteredPosts.length,
          currentPage: 1,
          totalPages: 1
        };
        
        // Cache the filtered result
        userPostsCache.data.set(cacheKey, result);
        userPostsCache.timestamp.set(cacheKey, Date.now());
        
        const memoryFilterEnd = performance.now();

        
        const fetchEnd = performance.now();

        return result;
      } else {

      }
    }
    
    // Check if the operation was cancelled before starting
    if (signal && signal.aborted) {

      throw new DOMException('Aborted', 'AbortError');
    }

    const dbQueryPrepStart = performance.now();
    
    // Optimize query by selecting only needed columns for performance
    // This reduces data transfer and speeds up the query
    const columns = '*'; // Select all columns from posts table
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabase
      .from('posts')
      .select(columns, { count: 'exact' })
      .eq('user_id', userId);
      
    // Add strategy filter if provided
    if (strategy) {

      query = query.eq('strategy', strategy);
    }
    
    // Complete the query with ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(from, to);
      
    // Add abort signal if provided
    if (signal) {
      query.abortSignal(signal);
    }
    
    const dbQueryPrepEnd = performance.now();

    const dbQueryStart = performance.now();

    const { data, error, count } = await query;

      
    const dbQueryEnd = performance.now();

    
    if (error) {

      throw error;
    }
    
    const resultPrepStart = performance.now();
    
    const result = {
      posts: data || [],
      totalCount: count || 0,
      currentPage: page,
      totalPages: Math.ceil((count || 0) / limit)
    };

    
    // Cache the result if not aborted
    if (!signal || !signal.aborted) {

      userPostsCache.data.set(cacheKey, result);
      userPostsCache.timestamp.set(cacheKey, Date.now());
    }
    
    const resultPrepEnd = performance.now();

    
    const fetchEnd = performance.now();

    
    return result;
  } catch (error) {
    // If this is an abort error, just propagate it
    if (error.name === 'AbortError') {
      throw error;
    }

    return {
      posts: [],
      totalCount: 0,
      currentPage: page,
      totalPages: 0,
      error: error.message
    };
  }
}

/**
 * Get user strategies
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - User strategies
 */
export async function getUserStrategies(userId) {
  const { data, error } = await supabase
    .from('user_strategies')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return data;
}

/**
 * Create a new user strategy
 * @param {string} userId - User ID
 * @param {string} strategyName - Strategy name
 * @returns {Promise<object>} - Created strategy
 */
export async function createUserStrategy(userId, strategyName) {
  // Check if strategy already exists
  const { data: existingStrategies } = await supabase
    .from('user_strategies')
    .select('*')
    .eq('user_id', userId)
    .eq('strategy_name', strategyName);
    
  if (existingStrategies && existingStrategies.length > 0) {
    return existingStrategies[0];
  }
  
  const { data, error } = await supabase
    .from('user_strategies')
    .insert({ user_id: userId, strategy_name: strategyName })
    .select()
    .single();
    
  if (error) throw error;
  
  return data;
}

// Following system
/**
 * Follow a user
 * @param {string} followerId - Follower ID
 * @param {string} followingId - Following ID
 * @returns {Promise<object>} - Follower data and error
 */
export const followUser = async (followerId, followingId) => {
  const { data, error } = await supabase
    .from('followers')
    .insert([{ follower_id: followerId, following_id: followingId }]);
  return { data, error };
};

/**
 * Unfollow a user
 * @param {string} followerId - Follower ID
 * @param {string} followingId - Following ID
 * @returns {Promise<object>} - Follower data and error
 */
export const unfollowUser = async (followerId, followingId) => {
  const { data, error } = await supabase
    .from('followers')
    .delete()
    .match({ follower_id: followerId, following_id: followingId });
  return { data, error };
};

/**
 * Get a user's followers
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Follower data and error
 */
export const getFollowers = async (userId) => {
  if (!userId) {

    return { data: [], error: { message: 'User ID is required' } };
  }

  try {
    const { data, error } = await supabase
      .from('followers')
      .select(`
        follower_id,
        profiles:follower_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('following_id', userId);
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {

    return { data: [], error };
  }
};

/**
 * Get a user's following
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Following data and error
 */
export const getFollowing = async (userId) => {
  if (!userId) {

    return { data: [], error: { message: 'User ID is required' } };
  }

  try {
    const { data, error } = await supabase
      .from('followers')
      .select(`
        following_id,
        profiles:following_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('follower_id', userId);
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {

    return { data: [], error };
  }
};

/**
 * Get a post by ID
 * @param {string} postId - Post ID
 * @returns {Promise<object>} - Post data and error
 */
export const getPostById = async (postId) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();
      
    if (error) throw error;
    return { data, error: null };
  } catch (error) {

    return { data: null, error };
  }
};

// Monitor all fetch requests for performance tracking
const originalFetch = global.fetch;

global.fetch = async function monitoredFetch(url, options) {
  // Only monitor Supabase API calls
  if (url && url.toString().includes('supabase.co')) {
    const startTime = performance.now();
    const startDate = new Date().toISOString();
    
    // Log the start of the request

    
    try {
      // Continue with the original fetch
      const response = await originalFetch(url, options);
      
      // Calculate the time taken
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Clone the response as we'll be consuming the body
      const clonedResponse = response.clone();
      
      // Log the response status and timing

      
      try {
        // Try to get content length from headers
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const kbSize = parseInt(contentLength) / 1024;

        }
        
        // Only try to read/log body for JSON responses to avoid issues with binary data
        if (response.headers.get('content-type')?.includes('application/json')) {
          // For large responses, just log that we're skipping body logging
          if (parseInt(contentLength) > 100000) { // Skip logging bodies larger than ~100KB

          } else {
            const text = await clonedResponse.text();
            try {
              const json = JSON.parse(text);
              const count = Array.isArray(json) ? json.length : 
                         (json.data && Array.isArray(json.data)) ? json.data.length : 
                         'N/A';

            } catch (e) {
              // If it's not valid JSON, just log the length

            }
          }
        }
      } catch (error) {

      }
      
      return response;
    } catch (error) {
      // Calculate the time when the error occurred
      const errorTime = performance.now();
      const errorDuration = errorTime - startTime;

      
      throw error;
    }
  }
  
  // For non-Supabase URLs, proceed normally without monitoring
  return originalFetch(url, options);
};

/**
 * Debug wrapper for Supabase functions
 * @param {Function} fn - The function to wrap
 * @param {string} name - The name of the function for logging
 * @returns {Function} - Wrapped function with debug logging
 */
function withDebug(fn, name) {
  return async function debugWrapper(...args) {
    const startTime = performance.now();

    
    // Log basic info about the args, but don't log sensitive data
    if (args.length > 0) {

      
      // Safely log some argument details
      args.forEach((arg, index) => {
        if (arg === null || arg === undefined) {

        } else if (typeof arg === 'object') {
          // Don't log the full object, just its keys
          try {
            const isArray = Array.isArray(arg);
            const keys = isArray ? [`Array(${arg.length})`] : Object.keys(arg);

          } catch (e) {

          }
        } else if (typeof arg === 'string' && arg.length > 100) {

        } else {

        }
      });
    }
    
    try {
      const result = await fn(...args);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (result && typeof result === 'object') {
        // Check for error in the Supabase response format
        if (result.error) {

        } else {

          
          // Log some details about the result, but don't log the entire response
          if (result.data) {
            const dataInfo = Array.isArray(result.data) 
              ? `Array with ${result.data.length} items` 
              : `Object with keys: ${Object.keys(result.data).join(', ')}`;

          } else {

          }
        }
      } else {

        if (result === undefined) {

        } else {

        }
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      
      throw error;
    }
  };
}

// Apply debug wrappers to the functions
const getPostsWithDebug = withDebug(getPosts, 'getPosts');
const getUserPostsWithDebug = withDebug(getUserPosts, 'getUserPosts');
const createPostWithDebug = withDebug(createPost, 'createPost');

// Export the wrapped versions only
export { 
  getPostsWithDebug as getPosts,
  getUserPostsWithDebug as getUserPosts,
  createPostWithDebug as createPost
};

// The file now ends here. All duplicate exports have been removed.
