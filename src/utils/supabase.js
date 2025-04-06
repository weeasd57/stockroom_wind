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
  console.error(
    'Missing Supabase credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local'
  );
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
      if (error && error.code === '42P01') {
        console.log('Supabase connection successful');
      } else if (error) {
        console.warn('Supabase connection test returned an error:', error.message);
      } else {
        console.log('Supabase connection successful');
      }
    } catch (err) {
      console.error('Failed to test Supabase connection:', err.message);
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
    console.error('Sign up error:', e);
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
    console.error('Sign in error:', e);
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
    console.error('Sign out error:', e);
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
      console.warn('Auth error getting current user:', error.message);
      // Just return null instead of signing out automatically
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
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
    console.error('Error fetching user profile: userId is undefined');
    return { data: null, error: { message: 'User ID is required' } };
  }

  if (userId === null) {
    console.error('Error fetching user profile: userId is null');
    return { data: null, error: { message: 'User ID cannot be null' } };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, email, avatar_url, background_url, bio, experience_level, success_posts, loss_posts')
      .eq('id', userId);

    if (error) throw error;
    
    // If no profile exists, return empty data instead of error
    if (!data || data.length === 0) {
      console.log(`No profile found for user ${userId}, creating default profile`);
      
      // Create a default profile for the user
      const defaultProfile = {
        id: userId,
        username: `user_${userId.substring(0, 8)}`,
        full_name: null,
        email: null,
        avatar_url: null,
        background_url: null,
        bio: null,
        experience_level: 'beginner',
        success_posts: 0,
        loss_posts: 0
      };
      
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([defaultProfile]);
      
      if (insertError) {
        console.error('Error creating default profile:', insertError);
        return { data: null, error: insertError };
      }
      
      return { data: defaultProfile, error: null };
    }
    
    // Return the first profile if multiple exist (should be only one)
    return { data: data[0], error: null };
  } catch (error) {
    console.error('Error fetching user profile:', error);
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
    console.log(`Updating profile for user ${userId}:`, updates);
    
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
        console.log('Sanitized avatar_url:', sanitizedUpdates.avatar_url);
      }
    }
    
    if (sanitizedUpdates.background_url && sanitizedUpdates.background_url.includes('?')) {
      sanitizedUpdates.background_url = sanitizedUpdates.background_url.split('?')[0];
      console.log('Sanitized background_url:', sanitizedUpdates.background_url);
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
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
    console.error(`Missing required parameters for uploadImage: file=${!!file}, bucket=${bucket}, userId=${userId}`);
    return { publicUrl: null, error: 'Missing required parameters' };
  }

  try {
    console.log(`Uploading ${fileType} to ${bucket} for user ${userId}`);
    
    // Get file extension from the file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    // Create a path for the file: userId/fileType.extension
    const filePath = `${userId}/${fileType}.${fileExtension}`;
    console.log(`File path: ${filePath}`);
    
    // Check if we can access the bucket - do NOT try to create it if it doesn't exist
    try {
      const { data: bucketContents, error: listError } = await supabase.storage
        .from(bucket)
        .list();
      
      if (listError) {
        console.error(`Cannot access bucket ${bucket}:`, listError);
        return { publicUrl: null, error: `Storage bucket '${bucket}' is not accessible. This is likely because it hasn't been created by an administrator. Please contact support.` };
      }
    } catch (bucketAccessError) {
      console.error(`Error accessing bucket ${bucket}:`, bucketAccessError);
      return { publicUrl: null, error: bucketAccessError };
    }
    
    // Delete any existing files with the same name pattern
    try {
      console.log(`Checking for existing ${fileType} files to delete...`);
      const { data: existingFiles, error: listError } = await supabase.storage
        .from(bucket)
        .list(userId);
      
      if (!listError && existingFiles) {
        const filesToDelete = existingFiles.filter(file => file.name.startsWith(`${fileType}.`));
        
        if (filesToDelete.length > 0) {
          console.log(`Found ${filesToDelete.length} existing ${fileType} files to delete`);
          
          for (const fileToDelete of filesToDelete) {
            console.log(`Deleting ${userId}/${fileToDelete.name}`);
            const { error: deleteError } = await supabase.storage
              .from(bucket)
              .remove([`${userId}/${fileToDelete.name}`]);
            
            if (deleteError) {
              console.error(`Error deleting existing file ${fileToDelete.name}:`, deleteError);
            }
          }
        } else {
          console.log(`No existing ${fileType} files found to delete`);
        }
      }
    } catch (deleteError) {
      console.error(`Error handling existing files:`, deleteError);
      // Continue with the upload even if deletion fails
    }
    
    // Upload the new file with progress handling if provided
    console.log(`Uploading new ${fileType} file...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        cacheControl: 'no-cache',
        ...options // Include any additional options like onUploadProgress
      });
    
    if (uploadError) {
      console.error(`Error uploading ${fileType}:`, uploadError);
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
      console.error('Unexpected response format from getPublicUrl:', publicUrlResponse);
      return { data: uploadData, error: new Error('Failed to get public URL'), publicUrl: null };
    }
    
    if (!publicUrl) {
      console.error('Failed to get public URL from response:', publicUrlResponse);
      return { data: uploadData, error: new Error('Failed to get public URL'), publicUrl: null };
    }
    
    console.log(`Retrieved public URL: ${publicUrl}`);
    
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
        console.warn(`Could not update profile with ${fileType} URL:`, updateError);
      } else {
        console.log(`Successfully updated profile with ${fileType} URL: ${baseUrl}`);
      }
    } catch (updateError) {
      console.warn(`Error updating profile with ${fileType} URL:`, updateError);
      // Continue even if profile update fails
    }
    
    console.log(`Successfully uploaded ${fileType}, URL: ${publicUrlWithCacheBuster}`);
    return { data: uploadData, publicUrl: publicUrlWithCacheBuster, error: null };
  } catch (error) {
    console.error(`Error uploading ${fileType}:`, error);
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
    console.log(`Checking storage directly for background of user ${userId}`);
    
    try {
      // Check if user has files in the backgrounds bucket
      const { data: files, error: listError } = await supabase.storage
        .from('backgrounds')
        .list(userId);
      
      if (listError) {
        console.warn(`Error listing background files for user ${userId}:`, listError);
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
          console.log(`Found background file in storage: ${backgroundFile.name}`);
          
          // Get the public URL for the file
          const { data: urlData } = supabase.storage
            .from('backgrounds')
            .getPublicUrl(`${userId}/${backgroundFile.name}`);
          
          if (urlData?.publicUrl) {
            const baseUrl = urlData.publicUrl.split('?')[0]; // Remove query params
            const cacheParam = `?t=${Date.now()}`; // Force cache refresh
            const fullUrl = `${baseUrl}${cacheParam}`;
            
            // Also update the profile table with this URL (without cache param)
            console.log('Updating profile with background URL from storage:', baseUrl);
            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ background_url: baseUrl })
                .eq('id', userId);
              
              if (updateError) {
                console.warn('Could not update profile with background URL:', updateError);
              }
            } catch (updateError) {
              console.warn('Error updating profile with background URL:', updateError);
            }
            
            return fullUrl;
          }
        }
      }
    } catch (storageError) {
      console.error('Error accessing background in storage:', storageError);
    }
    
    // If we couldn't get the background from storage, check the profile
    console.log(`Checking profile for background URL of user ${userId}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('background_url')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.warn('Error fetching profile for background URL:', profileError.message || profileError);
    } else if (profile?.background_url && profile.background_url !== '/profile-bg.jpg') {
      // If we have a valid URL in the profile, use it with cache busting
      const cacheParam = `?t=${Date.now()}`; // Force cache refresh
      const baseUrl = profile.background_url.split('?')[0]; // Remove any existing params
      return `${baseUrl}${cacheParam}`;
    }

    // If no background found in storage or profile, return default
    return '/profile-bg.jpg';
  } catch (error) {
    console.error('Error getting background URL:', error);
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
    console.log(`Checking storage directly for avatar of user ${userId}`);
    
    try {
      // Check if user has files in the avatars bucket
      const { data: files, error: listError } = await supabase.storage
        .from('avatars')
        .list(userId);
      
      if (listError) {
        console.warn(`Error listing files for user ${userId}:`, listError);
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
          console.log(`Found avatar file in storage: ${avatarFile.name}`);
          
          // Get the public URL for the file
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(`${userId}/${avatarFile.name}`);
          
          if (urlData?.publicUrl) {
            const baseUrl = urlData.publicUrl.split('?')[0]; // Remove query params
            const cacheParam = `?t=${Date.now()}`; // Force cache refresh
            const fullUrl = `${baseUrl}${cacheParam}`;
            
            // Also update the profile table with this URL (without cache param)
            console.log('Updating profile with avatar URL from storage:', baseUrl);
            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: baseUrl })
                .eq('id', userId);
              
              if (updateError) {
                console.warn('Could not update profile with avatar URL:', updateError);
              }
            } catch (updateError) {
              console.warn('Error updating profile with avatar URL:', updateError);
            }
            
            return fullUrl;
          }
        }
      }
    } catch (storageError) {
      console.error('Error accessing avatar in storage:', storageError);
    }
    
    // If we couldn't get the avatar from storage, check the profile
    console.log(`Checking profile for avatar URL of user ${userId}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.warn('Error fetching profile for avatar URL:', profileError.message || profileError);
    } else if (profile?.avatar_url && profile.avatar_url !== '/default-avatar.svg') {
      // If we have a valid URL in the profile, use it with cache busting
      const cacheParam = `?t=${Date.now()}`; // Force cache refresh
      const baseUrl = profile.avatar_url.split('?')[0]; // Remove any existing params
      return `${baseUrl}${cacheParam}`;
    }

    // If no avatar found in storage or profile, return default
    return '/default-avatar.svg';
  } catch (error) {
    console.error('Error getting avatar URL:', error);
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
    console.error('Error checking if file exists:', error);
    return false;
  }
};

// Enhanced createPost function with graceful timeout handling and background retries
async function createPost(post, userId) {
  const startTime = performance.now();
  console.log(`[POST DEBUG] 🚀 Starting post creation at ${new Date().toISOString()}`);
  console.log(`[POST DEBUG] 📦 Post data:`, { title: post.title, content: post.content?.substring(0, 50), imageCount: post.images?.length });
  
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
    console.log(`[POST DEBUG] 📝 Inserting post to database`);
    const { data, error } = await supabase
      .from('posts')
      .insert([sanitizedPost]) // Use sanitized post without images
      .select();
    
    const insertDuration = performance.now() - startTime;
    console.log(`[POST DEBUG] ⏱️ Database insert took ${insertDuration.toFixed(1)}ms`);
    
    if (error) {
      console.error(`[POST DEBUG] ❌ Error inserting post:`, error);
      
      // Start background retry process for timeouts and network errors
      if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT' || 
          error.code === 'NETWORK_ERROR' || error.message?.includes('network')) {
        
        // Launch background retry attempts without blocking UI
        console.log(`[POST DEBUG] 🔄 Scheduling background retry attempts`);
        
        // First retry after 2 seconds
        setTimeout(() => {
          console.log(`[POST DEBUG] 🔄 First retry attempt starting`);
          supabase
            .from('posts')
            .insert([essentialPostData])
            .then(({ data, error }) => {
              if (error) {
                console.error(`[POST DEBUG] ❌ First retry failed:`, error);
                
                // Second retry after another 5 seconds with longer timeout
                setTimeout(() => {
                  console.log(`[POST DEBUG] 🔄 Second retry attempt starting`);
                  supabase
                    .from('posts')
                    .insert([essentialPostData])
                    .then(({ data, error }) => {
                      if (error) {
                        console.error(`[POST DEBUG] ❌ Second retry failed:`, error);
                        
                        // Third and final retry after 10 more seconds with even longer timeout
                        setTimeout(() => {
                          console.log(`[POST DEBUG] 🔄 Final retry attempt starting`);
                          supabase
                            .from('posts')
                            .insert([essentialPostData])
                            .then(({ data, error }) => {
                              if (error) {
                                console.error(`[POST DEBUG] ❌ All retries failed. Final error:`, error);
                              } else {
                                console.log(`[POST DEBUG] ✅ Final retry succeeded! Post saved.`);
                                // No need to invalidate cache here - it will be refreshed on next visit
                              }
                            });
                        }, 10000);
                      } else {
                        console.log(`[POST DEBUG] ✅ Second retry succeeded! Post saved.`);
                        // No need to invalidate cache here - it will be refreshed on next visit
                      }
                    });
                }, 5000);
              } else {
                console.log(`[POST DEBUG] ✅ First retry succeeded! Post saved.`);
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
    console.log(`[POST DEBUG] 🧹 Clearing post caches`);
    clearPostCache();
    
    console.log(`[POST DEBUG] ✅ Post created successfully in ${performance.now() - startTime}ms`);
    return { data, error: null };
  } catch (error) {
    console.error(`[POST DEBUG] 💥 Exception in createPost:`, error);
    const duration = performance.now() - startTime;
    console.log(`[POST DEBUG] ⏱️ Total attempt time: ${duration.toFixed(1)}ms`);
    
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
  
  console.log(`[UPLOAD DEBUG] 🚀 Starting post image upload at ${new Date().toISOString()}`);
  console.log(`[UPLOAD DEBUG] 📊 File details: ${file.name} (${fileSize}KB, ${fileType})`);
  
  try {
    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${userId}-post-${timestamp}.${fileExt}`;
    const filePath = `posts/${fileName}`;
    
    console.log(`[UPLOAD DEBUG] 🔄 Preparing to upload to path: ${filePath}`);
    
    // Track storage upload operation
    const storageUploadStart = performance.now();
    
    const { data, error } = await supabase.storage
      .from('posts')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    const storageUploadEnd = performance.now();
    console.log(`[UPLOAD DEBUG] ⏱️ Storage upload took ${(storageUploadEnd - storageUploadStart).toFixed(2)}ms`);
    
    if (error) {
      console.error(`[UPLOAD DEBUG] ❌ Upload error:`, error);
      throw error;
    }
    
    // Track URL generation time
    const urlGenStart = performance.now();
    console.log(`[UPLOAD DEBUG] 🔄 Generating public URL for uploaded file`);
    
    const { data: publicUrlData } = supabase.storage
      .from('posts')
      .getPublicUrl(filePath);
    
    const publicUrl = publicUrlData.publicUrl;
    
    const urlGenEnd = performance.now();
    console.log(`[UPLOAD DEBUG] ⏱️ URL generation took ${(urlGenEnd - urlGenStart).toFixed(2)}ms`);
    console.log(`[UPLOAD DEBUG] 🔗 Generated URL: ${publicUrl}`);
    
    const uploadEnd = performance.now();
    console.log(`[UPLOAD DEBUG] ✅ Upload completed successfully in ${(uploadEnd - uploadStart).toFixed(2)}ms`);
    
    return publicUrl;
  } catch (error) {
    const uploadEnd = performance.now();
    console.error(`[UPLOAD DEBUG] ❌ Upload failed after ${(uploadEnd - uploadStart).toFixed(2)}ms:`, error);
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
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
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
      console.error('Supabase is not configured. Check your environment variables.');
      return false;
    }

    // Try a simple query to check if the connection works
    const { data, error } = await supabase.from('_anon_auth_check').select('*').limit(1);
    
    // If we get a "relation does not exist" error, that's actually good
    // It means we connected to the database but the table doesn't exist
    if (error && error.code === '42P01') {
      console.log('Supabase connection is working (table does not exist, but connection is good)');
      return true;
    }
    
    if (error) {
      console.error('Supabase connection check failed:', error.message, error.details);
      
      // Check for specific error types to provide better diagnostics
      if (error.code === 'PGRST301') {
        console.error('Authentication error: Invalid API key or JWT');
      } else if (error.code === 'PGRST401') {
        console.error('Permission denied: Check your RLS policies');
      } else if (error.message && error.message.includes('Failed to fetch')) {
        console.error('Network error: Unable to reach Supabase servers');
      }
      
      return false;
    }
    
    console.log('Supabase connection is working properly');
    return true;
  } catch (error) {
    console.error('Error checking Supabase connection:', error);
    
    // Provide more specific error information
    if (error.message && error.message.includes('fetch')) {
      console.error('Network error: Check your internet connection');
    } else if (error.message && error.message.includes('timeout')) {
      console.error('Connection timeout: Supabase server might be overloaded or unreachable');
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
    console.log('Fetching posts directly from posts table');
    
    // Try posts table
    const { data: postsData, error: postsError, count } = await supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
      .abortSignal(signal); // Add abort signal support

    if (postsError) {
      console.error('Error fetching from posts table:', postsError);
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
    
    console.error('Error in getPosts:', error);
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
  console.log('Invalidating posts cache');
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
  console.log(`[FETCH DEBUG] 🚀 Starting getUserPosts for user ${userId}${strategy ? ` with strategy ${strategy}` : ''} at ${new Date().toISOString()}`);
  
  if (!userId) {
    console.error('[FETCH DEBUG] ❌ getUserPosts called without userId');
    return { posts: [], totalCount: 0, currentPage: page, totalPages: 0 };
  }

  try {
    // Include strategy in cache key if provided
    const cacheKey = strategy 
      ? `user_posts_${userId}_${page}_${limit}_${strategy}` 
      : `user_posts_${userId}_${page}_${limit}`;
    
    console.log(`[FETCH DEBUG] 🔍 Checking cache with key: ${cacheKey}`);
    const cacheCheckStart = performance.now();
      
    const cachedData = userPostsCache.data.get(cacheKey);
    const cachedTimestamp = userPostsCache.timestamp.get(cacheKey);
    
    const cacheCheckEnd = performance.now();
    console.log(`[FETCH DEBUG] ⏱️ Cache check took ${(cacheCheckEnd - cacheCheckStart).toFixed(2)}ms`);
    
    // Check if there's a cached version and it's not expired
    if (cachedData && cachedTimestamp && (Date.now() - cachedTimestamp < userPostsCache.ttl)) {
      console.log(`[FETCH DEBUG] ✅ Returning cached user posts data. Age: ${(Date.now() - cachedTimestamp) / 1000}s, Cache TTL: ${userPostsCache.ttl / 1000}s`);
      const fetchEnd = performance.now();
      console.log(`[FETCH DEBUG] ⏱️ Total cache hit time: ${(fetchEnd - fetchStart).toFixed(2)}ms, found ${cachedData.posts.length} posts`);
      return cachedData;
    }
    
    console.log('[FETCH DEBUG] ❌ No valid cache found or cache expired');
    
    // If a strategy is provided, but we have cached all posts, we can filter them in memory
    // This avoids an extra database query
    if (strategy) {
      console.log('[FETCH DEBUG] 🔍 Strategy filter requested, checking if we can filter from cached data');
      const memoryFilterStart = performance.now();
      
      const allPostsCacheKey = `user_posts_${userId}_${page}_${limit}`;
      const allPostsCachedData = userPostsCache.data.get(allPostsCacheKey);
      const allPostsCachedTimestamp = userPostsCache.timestamp.get(allPostsCacheKey);
      
      if (allPostsCachedData && allPostsCachedTimestamp && 
          (Date.now() - allPostsCachedTimestamp < userPostsCache.ttl)) {
        console.log(`[FETCH DEBUG] ✅ Found valid cached posts to filter in memory for strategy: ${strategy}`);
        
        // Filter the cached posts by strategy
        const filterStart = performance.now();
        const filteredPosts = allPostsCachedData.posts.filter(post => post.strategy === strategy);
        const filterEnd = performance.now();
        
        console.log(`[FETCH DEBUG] ⏱️ In-memory filtering took ${(filterEnd - filterStart).toFixed(2)}ms, found ${filteredPosts.length} matching posts`);
        
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
        console.log(`[FETCH DEBUG] ⏱️ Total memory filter time: ${(memoryFilterEnd - memoryFilterStart).toFixed(2)}ms`);
        
        const fetchEnd = performance.now();
        console.log(`[FETCH DEBUG] ⏱️ Total fetch time (memory filtered): ${(fetchEnd - fetchStart).toFixed(2)}ms`);
        return result;
      } else {
        console.log('[FETCH DEBUG] ❌ No valid all-posts cache found to filter from, will query database');
      }
    }
    
    // Check if the operation was cancelled before starting
    if (signal && signal.aborted) {
      console.log('[FETCH DEBUG] 🛑 Operation was aborted before database query');
      throw new DOMException('Aborted', 'AbortError');
    }
    
    console.log('[FETCH DEBUG] 📊 Preparing database query');
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
      console.log(`[FETCH DEBUG] 🔍 Adding strategy filter to query: ${strategy}`);
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
    console.log(`[FETCH DEBUG] ⏱️ Query preparation took ${(dbQueryPrepEnd - dbQueryPrepStart).toFixed(2)}ms`);
    
    console.log('[FETCH DEBUG] 🔄 Executing database query...');
    const dbQueryStart = performance.now();
    
    console.time('[FETCH DEBUG] 📋 getUserPosts database query');
    const { data, error, count } = await query;
    console.timeEnd('[FETCH DEBUG] 📋 getUserPosts database query');
      
    const dbQueryEnd = performance.now();
    console.log(`[FETCH DEBUG] ⏱️ Database query took ${(dbQueryEnd - dbQueryStart).toFixed(2)}ms, returned ${data?.length || 0} posts`);
    
    if (error) {
      console.error(`[FETCH DEBUG] ❌ Database error: ${error.message}`, error);
      throw error;
    }
    
    const resultPrepStart = performance.now();
    
    const result = {
      posts: data || [],
      totalCount: count || 0,
      currentPage: page,
      totalPages: Math.ceil((count || 0) / limit)
    };
    
    console.log(`[FETCH DEBUG] 📦 Preparing result with ${result.posts.length} posts, total: ${result.totalCount}`);
    
    // Cache the result if not aborted
    if (!signal || !signal.aborted) {
      console.log(`[FETCH DEBUG] 💾 Caching result with key: ${cacheKey}`);
      userPostsCache.data.set(cacheKey, result);
      userPostsCache.timestamp.set(cacheKey, Date.now());
    }
    
    const resultPrepEnd = performance.now();
    console.log(`[FETCH DEBUG] ⏱️ Result preparation and caching took ${(resultPrepEnd - resultPrepStart).toFixed(2)}ms`);
    
    const fetchEnd = performance.now();
    console.log(`[FETCH DEBUG] ✅ Total fetch time (database query): ${(fetchEnd - fetchStart).toFixed(2)}ms`);
    
    return result;
  } catch (error) {
    // If this is an abort error, just propagate it
    if (error.name === 'AbortError') {
      throw error;
    }
    
    console.error('Error in getUserPosts:', error);
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
    console.error('Error fetching followers: userId is undefined or null');
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
    console.error('Error fetching followers:', error);
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
    console.error('Error fetching following: userId is undefined or null');
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
    console.error('Error fetching following:', error);
    return { data: [], error };
  }
};

/**
 * Get a post by ID
 * @param {string} postId - Post ID
 * @returns {Promise<object>} - Post data
 */
export const getPostById = async (postId) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();
    
  if (error) throw error;
  return data;
};

// Monitor all fetch requests for performance tracking
const originalFetch = global.fetch;

global.fetch = async function monitoredFetch(url, options) {
  // Only monitor Supabase API calls
  if (url && url.toString().includes('supabase.co')) {
    const startTime = performance.now();
    const startDate = new Date().toISOString();
    
    // Log the start of the request
    console.log(`[NETWORK] 🚀 Supabase request started at ${startDate}`);
    console.log(`[NETWORK] 🔍 URL: ${url.toString().substring(0, 100)}${url.toString().length > 100 ? '...' : ''}`);
    
    try {
      // Continue with the original fetch
      const response = await originalFetch(url, options);
      
      // Calculate the time taken
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Clone the response as we'll be consuming the body
      const clonedResponse = response.clone();
      
      // Log the response status and timing
      console.log(`[NETWORK] ✅ Supabase request completed in ${duration.toFixed(2)}ms`);
      console.log(`[NETWORK] 📊 Status: ${response.status} ${response.statusText}`);
      
      try {
        // Try to get content length from headers
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const kbSize = parseInt(contentLength) / 1024;
          console.log(`[NETWORK] 📦 Response size: ${kbSize.toFixed(2)} KB`);
        }
        
        // Only try to read/log body for JSON responses to avoid issues with binary data
        if (response.headers.get('content-type')?.includes('application/json')) {
          // For large responses, just log that we're skipping body logging
          if (parseInt(contentLength) > 100000) { // Skip logging bodies larger than ~100KB
            console.log(`[NETWORK] ⏩ Response body too large to log (${(parseInt(contentLength)/1024).toFixed(2)} KB)`);
          } else {
            const text = await clonedResponse.text();
            try {
              const json = JSON.parse(text);
              const count = Array.isArray(json) ? json.length : 
                         (json.data && Array.isArray(json.data)) ? json.data.length : 
                         'N/A';
              console.log(`[NETWORK] 📊 Response contains ${count} items`);
            } catch (e) {
              // If it's not valid JSON, just log the length
              console.log(`[NETWORK] 📄 Response text length: ${text.length} chars`);
            }
          }
        }
      } catch (error) {
        console.log(`[NETWORK] ⚠️ Could not analyze response details: ${error.message}`);
      }
      
      return response;
    } catch (error) {
      // Calculate the time when the error occurred
      const errorTime = performance.now();
      const errorDuration = errorTime - startTime;
      
      console.error(`[NETWORK] ❌ Supabase request failed after ${errorDuration.toFixed(2)}ms`);
      console.error(`[NETWORK] ❌ Error: ${error.message}`);
      
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
    console.log(`[SUPABASE DEBUG] 🚀 ${name} started at ${new Date().toISOString()}`);
    
    // Log basic info about the args, but don't log sensitive data
    if (args.length > 0) {
      console.log(`[SUPABASE DEBUG] 📝 ${name} params: ${args.length} arguments`);
      
      // Safely log some argument details
      args.forEach((arg, index) => {
        if (arg === null || arg === undefined) {
          console.log(`[SUPABASE DEBUG] - Arg ${index}: ${arg}`);
        } else if (typeof arg === 'object') {
          // Don't log the full object, just its keys
          try {
            const isArray = Array.isArray(arg);
            const keys = isArray ? [`Array(${arg.length})`] : Object.keys(arg);
            console.log(`[SUPABASE DEBUG] - Arg ${index}: ${isArray ? 'Array' : 'Object'} with keys: ${keys.join(', ')}`);
          } catch (e) {
            console.log(`[SUPABASE DEBUG] - Arg ${index}: [Object]`);
          }
        } else if (typeof arg === 'string' && arg.length > 100) {
          console.log(`[SUPABASE DEBUG] - Arg ${index}: String(${arg.length}) "${arg.substring(0, 20)}..."`);
        } else {
          console.log(`[SUPABASE DEBUG] - Arg ${index}: ${arg}`);
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
          console.error(`[SUPABASE DEBUG] ❌ ${name} failed after ${duration.toFixed(2)}ms`);
          console.error(`[SUPABASE DEBUG] Error details:`, result.error);
        } else {
          console.log(`[SUPABASE DEBUG] ✅ ${name} completed in ${duration.toFixed(2)}ms`);
          
          // Log some details about the result, but don't log the entire response
          if (result.data) {
            const dataInfo = Array.isArray(result.data) 
              ? `Array with ${result.data.length} items` 
              : `Object with keys: ${Object.keys(result.data).join(', ')}`;
            console.log(`[SUPABASE DEBUG] Result data: ${dataInfo}`);
          } else {
            console.log(`[SUPABASE DEBUG] Result has no data property`);
          }
        }
      } else {
        console.log(`[SUPABASE DEBUG] ✅ ${name} completed in ${duration.toFixed(2)}ms`);
        if (result === undefined) {
          console.log(`[SUPABASE DEBUG] Result: undefined`);
        } else {
          console.log(`[SUPABASE DEBUG] Result: ${result}`);
        }
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`[SUPABASE DEBUG] ❌ ${name} threw exception after ${duration.toFixed(2)}ms`);
      console.error(`[SUPABASE DEBUG] Exception:`, error);
      
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
