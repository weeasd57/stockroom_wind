import { createClient } from '@supabase/supabase-js';
import logger from '@/utils/logger';

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if environment variables are set
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Ensure we have valid credentials before creating the client
if (!isSupabaseConfigured()) {
  logger.error(
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

// Initialize required storage buckets
export async function initializeStorageBuckets() {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) {
    return false;
  }
  
  try {
    // List of buckets required by the application
    const requiredBuckets = ['posts', 'avatars', 'backgrounds'];
    
    // Check and create each bucket
    for (const bucketName of requiredBuckets) {
      const success = await createBucketIfNotExists(bucketName);
      if (!success) {
        console.warn(`Failed to create/verify bucket: ${bucketName}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing storage buckets:', error);
    return false;
  }
}

// Test the connection on initialization
(async function testConnection() {
  if (typeof window !== 'undefined' && isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('_connection_test').select('*').limit(1).single();
      // If we get a "relation does not exist" error, that's actually good
      // It means we connected to the database but the table doesn't exist
      if (error && error.code === '42P01') {
        logger.log('Supabase connection successful');
      } else if (error) {
        logger.warn('Supabase connection test returned an error:', error.message);
      } else {
        logger.log('Supabase connection successful');
      }
      
      // Initialize storage buckets
      await initializeStorageBuckets();
    } catch (err) {
      logger.error('Failed to test Supabase connection:', err.message);
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
    logger.error('Sign up error:', e);
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
    logger.error('Sign in error:', e);
    return { data: null, error: e };
  }
};

/**
 * Sign out the current user
 * @returns {Promise<object>} - Sign out error
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (e) {
    logger.error('Sign out error:', e);
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
      logger.warn('Auth error getting current user:', error.message);
      // Clear any potentially corrupted session data
      await supabase.auth.signOut();
      return null;
    }
    
    return user;
  } catch (error) {
    logger.error('Error getting current user:', error);
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
    logger.error('Error fetching user profile: userId is undefined');
    return { data: null, error: { message: 'User ID is required' } };
  }

  if (userId === null) {
    logger.error('Error fetching user profile: userId is null');
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
      logger.log(`No profile found for user ${userId}, creating default profile`);
      
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
        logger.error('Error creating default profile:', insertError);
        return { data: null, error: insertError };
      }
      
      return { data: defaultProfile, error: null };
    }
    
    // Return the first profile if multiple exist (should be only one)
    return { data: data[0], error: null };
  } catch (error) {
    logger.error('Error fetching user profile:', error);
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
    logger.log(`Updating profile for user ${userId}:`, updates);
    
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
        logger.log('Sanitized avatar_url:', sanitizedUpdates.avatar_url);
      }
    }
    
    if (sanitizedUpdates.background_url && sanitizedUpdates.background_url.includes('?')) {
      sanitizedUpdates.background_url = sanitizedUpdates.background_url.split('?')[0];
      logger.log('Sanitized background_url:', sanitizedUpdates.background_url);
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating profile:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    logger.error('Error in updateUserProfile:', error);
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
    logger.error(`Missing required parameters for uploadImage: file=${!!file}, bucket=${bucket}, userId=${userId}`);
    return { publicUrl: null, error: 'Missing required parameters' };
  }

  try {
    logger.log(`Uploading ${fileType} to ${bucket} for user ${userId}`);
    
    // Get file extension from the file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    // Create a path for the file: userId/fileType.extension
    const filePath = `${userId}/${fileType}.${fileExtension}`;
    logger.log(`File path: ${filePath}`);
    
    // Check if we can access the bucket - do NOT try to create it if it doesn't exist
    try {
      const { data: bucketContents, error: listError } = await supabase.storage
        .from(bucket)
        .list();
      
      if (listError) {
        logger.error(`Cannot access bucket ${bucket}:`, listError);
        return { publicUrl: null, error: `Storage bucket '${bucket}' is not accessible. This is likely because it hasn't been created by an administrator. Please contact support.` };
      }
    } catch (bucketAccessError) {
      logger.error(`Error accessing bucket ${bucket}:`, bucketAccessError);
      return { publicUrl: null, error: bucketAccessError };
    }
    
    // Delete any existing files with the same name pattern
    try {
      logger.log(`Checking for existing ${fileType} files to delete...`);
      const { data: existingFiles, error: listError } = await supabase.storage
        .from(bucket)
        .list(userId);
      
      if (!listError && existingFiles) {
        const filesToDelete = existingFiles.filter(file => file.name.startsWith(`${fileType}.`));
        
        if (filesToDelete.length > 0) {
          logger.log(`Found ${filesToDelete.length} existing ${fileType} files to delete`);
          
          for (const fileToDelete of filesToDelete) {
            logger.log(`Deleting ${userId}/${fileToDelete.name}`);
            const { error: deleteError } = await supabase.storage
              .from(bucket)
              .remove([`${userId}/${fileToDelete.name}`]);
            
            if (deleteError) {
              logger.error(`Error deleting existing file ${fileToDelete.name}:`, deleteError);
            }
          }
        } else {
          logger.log(`No existing ${fileType} files found to delete`);
        }
      }
    } catch (deleteError) {
      logger.error(`Error handling existing files:`, deleteError);
      // Continue with the upload even if deletion fails
    }
    
    // Upload the new file with progress handling if provided
    logger.log(`Uploading new ${fileType} file...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        cacheControl: 'no-cache',
        ...options // Include any additional options like onUploadProgress
      });
    
    if (uploadError) {
      logger.error(`Error uploading ${fileType}:`, uploadError);
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
      logger.error('Unexpected response format from getPublicUrl:', publicUrlResponse);
      return { data: uploadData, error: new Error('Failed to get public URL'), publicUrl: null };
    }
    
    if (!publicUrl) {
      logger.error('Failed to get public URL from response:', publicUrlResponse);
      return { data: uploadData, error: new Error('Failed to get public URL'), publicUrl: null };
    }
    
    logger.log(`Retrieved public URL: ${publicUrl}`);
    
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
        logger.warn(`Could not update profile with ${fileType} URL:`, updateError);
      } else {
        logger.log(`Successfully updated profile with ${fileType} URL: ${baseUrl}`);
      }
    } catch (updateError) {
      logger.warn(`Error updating profile with ${fileType} URL:`, updateError);
      // Continue even if profile update fails
    }
    
    logger.log(`Successfully uploaded ${fileType}, URL: ${publicUrlWithCacheBuster}`);
    return { data: uploadData, publicUrl: publicUrlWithCacheBuster, error: null };
  } catch (error) {
    logger.error(`Error uploading ${fileType}:`, error);
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
    logger.log(`Checking storage directly for background of user ${userId}`);
    
    try {
      // Check if user has files in the backgrounds bucket
      const { data: files, error: listError } = await supabase.storage
        .from('backgrounds')
        .list(userId);
      
      if (listError) {
        logger.warn(`Error listing background files for user ${userId}:`, listError);
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
          logger.log(`Found background file in storage: ${backgroundFile.name}`);
          
          // Get the public URL for the file
          const { data: urlData } = supabase.storage
            .from('backgrounds')
            .getPublicUrl(`${userId}/${backgroundFile.name}`);
          
          if (urlData?.publicUrl) {
            const baseUrl = urlData.publicUrl.split('?')[0]; // Remove query params
            const cacheParam = `?t=${Date.now()}`; // Force cache refresh
            const fullUrl = `${baseUrl}${cacheParam}`;
            
            // Also update the profile table with this URL (without cache param)
            logger.log('Updating profile with background URL from storage:', baseUrl);
            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ background_url: baseUrl })
                .eq('id', userId);
              
              if (updateError) {
                logger.warn('Could not update profile with background URL:', updateError);
              }
            } catch (updateError) {
              logger.warn('Error updating profile with background URL:', updateError);
            }
            
            return fullUrl;
          }
        }
      }
    } catch (storageError) {
      logger.error('Error accessing background in storage:', storageError);
    }
    
    // If we couldn't get the background from storage, check the profile
    logger.log(`Checking profile for background URL of user ${userId}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('background_url')
      .eq('id', userId)
      .single();

    if (profileError) {
      logger.warn('Error fetching profile for background URL:', profileError.message || profileError);
    } else if (profile?.background_url && profile.background_url !== '/profile-bg.jpg') {
      // If we have a valid URL in the profile, use it with cache busting
      const cacheParam = `?t=${Date.now()}`; // Force cache refresh
      const baseUrl = profile.background_url.split('?')[0]; // Remove any existing params
      return `${baseUrl}${cacheParam}`;
    }

    // If no background found in storage or profile, return default
    return '/profile-bg.jpg';
  } catch (error) {
    logger.error('Error getting background URL:', error);
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
    logger.log(`Checking storage directly for avatar of user ${userId}`);
    
    try {
      // Check if user has files in the avatars bucket
      const { data: files, error: listError } = await supabase.storage
        .from('avatars')
        .list(userId);
      
      if (listError) {
        logger.warn(`Error listing files for user ${userId}:`, listError);
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
          logger.log(`Found avatar file in storage: ${avatarFile.name}`);
          
          // Get the public URL for the file
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(`${userId}/${avatarFile.name}`);
          
          if (urlData?.publicUrl) {
            const baseUrl = urlData.publicUrl.split('?')[0]; // Remove query params
            const cacheParam = `?t=${Date.now()}`; // Force cache refresh
            const fullUrl = `${baseUrl}${cacheParam}`;
            
            // Also update the profile table with this URL (without cache param)
            logger.log('Updating profile with avatar URL from storage:', baseUrl);
            try {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: baseUrl })
                .eq('id', userId);
              
              if (updateError) {
                logger.warn('Could not update profile with avatar URL:', updateError);
              }
            } catch (updateError) {
              logger.warn('Error updating profile with avatar URL:', updateError);
            }
            
            return fullUrl;
          }
        }
      }
    } catch (storageError) {
      logger.error('Error accessing avatar in storage:', storageError);
    }
    
    // If we couldn't get the avatar from storage, check the profile
    logger.log(`Checking profile for avatar URL of user ${userId}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (profileError) {
      logger.warn('Error fetching profile for avatar URL:', profileError.message || profileError);
    } else if (profile?.avatar_url && profile.avatar_url !== '/default-avatar.svg') {
      // If we have a valid URL in the profile, use it with cache busting
      const cacheParam = `?t=${Date.now()}`; // Force cache refresh
      const baseUrl = profile.avatar_url.split('?')[0]; // Remove any existing params
      return `${baseUrl}${cacheParam}`;
    }

    // If no avatar found in storage or profile, return default
    return '/default-avatar.svg';
  } catch (error) {
    logger.error('Error getting avatar URL:', error);
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
    logger.error('Error checking if file exists:', error);
    return false;
  }
};

// Post helpers
/**
 * Create a new post
 * @param {object} postData - Post data to insert
 * @returns {Promise<object>} - Created post
 */
export async function createPost(postData) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert([postData])
      .select()
      .single();

    if (error) throw error;

    // Invalidate posts cache after creating a new post
    invalidatePostsCache();
    
    return { data, error: null };
  } catch (error) {
    logger.error('Error creating post:', error);
    return { data: null, error };
  }
}

/**
 * Create a storage bucket if it doesn't exist
 * @param {string} bucketName - Name of the bucket to create
 * @returns {Promise<boolean>} - Whether the bucket was created or already exists
 */
export async function createBucketIfNotExists(bucketName) {
  try {
    // First check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }
    
    // Check if the bucket already exists
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    if (bucketExists) {
      console.log(`Bucket "${bucketName}" already exists`);
      return true;
    }
    
    // Create the bucket if it doesn't exist
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true, // Make bucket publicly accessible
      fileSizeLimit: 5242880, // 5MB in bytes
    });
    
    if (createError) {
      console.error(`Error creating bucket "${bucketName}":`, createError);
      return false;
    }
    
    console.log(`Bucket "${bucketName}" created successfully`);
    return true;
  } catch (error) {
    console.error(`Error checking/creating bucket "${bucketName}":`, error);
    return false;
  }
}

/**
 * Upload post image to storage
 * @param {File} file - Image file to upload
 * @param {string} userId - User ID
 * @param {Object} options - Upload options
 * @returns {Promise<string>} - Public URL of the uploaded image
 */
export async function uploadPostImage(file, userId = 'anonymous') {
  if (!file) throw new Error('No file provided');
  
  try {
    // Verify file size - reject if too large (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      throw new Error(`File size exceeds limit (5MB). Current size: ${Math.round(file.size / 1024)}KB`);
    }
    
    console.log(`Uploading post image: ${file.name} (${Math.round(file.size / 1024)}KB)`);
    
    // Try to create the bucket if it doesn't exist
    const bucketCreated = await createBucketIfNotExists('posts');
    if (!bucketCreated) {
      console.warn('Failed to create posts bucket. Falling back to data URL.');
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }
    
    // Create a unique file path
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `post-images/${userId}/${fileName}`;
    
    // Set up cache control to improve performance
    const options = {
      cacheControl: '3600',
      upsert: false
    };
    
    // Upload the file with enhanced error handling
    const { error } = await supabase.storage
      .from('posts')
      .upload(filePath, file, options);
      
    if (error) {
      console.error('Upload error:', error);
      
      // Provide more specific error messages
      if (error.message && (error.message.includes('storage/bucket-not-found') || error.message.includes('Bucket not found'))) {
        // If bucket doesn't exist, use FileReader to convert the image to a data URL
        console.log('Falling back to data URL for image');
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      } else if (error.message && error.message.includes('413')) {
        throw new Error('File too large');
      } else if (error.message && error.message.includes('network')) {
        throw new Error('Network error');
      }
      
      throw error;
    }
    
    // Get the public URL
    const { data } = supabase.storage
      .from('posts')
      .getPublicUrl(filePath);
    
    if (!data || !data.publicUrl) {
      throw new Error('Failed to get public URL');
    }
    
    console.log('Post image uploaded successfully:', data.publicUrl);
    return data.publicUrl;
  } catch (error) {
    // If bucket not found, try a different approach
    if (error.message && error.message.includes('Bucket not found')) {
      console.log('Posts bucket not found, using data URL instead');
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }
    
    console.error('Error in uploadPostImage:', error);
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
      logger.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (error) {
    logger.error(`Error checking if table ${tableName} exists:`, error);
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
      logger.error('Supabase is not configured. Check your environment variables.');
      return false;
    }

    // Try a simple query to check if the connection works
    const { data, error } = await supabase.from('_anon_auth_check').select('*').limit(1);
    
    // If we get a "relation does not exist" error, that's actually good
    // It means we connected to the database but the table doesn't exist
    if (error && error.code === '42P01') {
      logger.log('Supabase connection is working (table does not exist, but connection is good)');
      return true;
    }
    
    if (error) {
      logger.error('Supabase connection check failed:', error.message, error.details);
      
      // Check for specific error types to provide better diagnostics
      if (error.code === 'PGRST301') {
        logger.error('Authentication error: Invalid API key or JWT');
      } else if (error.code === 'PGRST401') {
        logger.error('Permission denied: Check your RLS policies');
      } else if (error.message && error.message.includes('Failed to fetch')) {
        logger.error('Network error: Unable to reach Supabase servers');
      }
      
      return false;
    }
    
    logger.log('Supabase connection is working properly');
    return true;
  } catch (error) {
    logger.error('Error checking Supabase connection:', error);
    
    // Provide more specific error information
    if (error.message && error.message.includes('fetch')) {
      logger.error('Network error: Check your internet connection');
    } else if (error.message && error.message.includes('timeout')) {
      logger.error('Connection timeout: Supabase server might be overloaded or unreachable');
    }
    
    return false;
  }
}

// Cache for posts data
const postsCache = {
  data: new Map(),
  timestamp: new Map(),
  ttl: 30000, // 30 seconds cache TTL
};

/**
 * Get all posts with pagination
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of posts per page
 * @returns {Promise<object>} - Posts and pagination info
 */
export async function getPosts(page = 1, limit = 10) {
  try {
    const cacheKey = `posts_${page}_${limit}`;
    const cachedData = postsCache.data.get(cacheKey);
    const cachedTimestamp = postsCache.timestamp.get(cacheKey);
    
    if (cachedData && cachedTimestamp && (Date.now() - cachedTimestamp < postsCache.ttl)) {
      return cachedData;
    }

    // First check if we can connect to Supabase
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
      throw new Error('Unable to connect to Supabase. Please check your connection and credentials.');
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // First try to get the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('post_details')
      .select('*')
      .limit(1);

    if (tableError && tableError.code === '42P01') {
      logger.log('post_details view not found, falling back to posts table');
      // Try posts table instead
      const { data: postsData, error: postsError, count } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (postsError) {
        logger.error('Error fetching from posts table:', postsError);
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

      postsCache.data.set(cacheKey, response);
      postsCache.timestamp.set(cacheKey, Date.now());

      return response;
    } else if (tableError) {
      logger.error('Error fetching table info:', tableError);
      throw tableError;
    }

    // If we got here, post_details exists. Let's see what columns we have
    logger.log('Available columns in post_details:', Object.keys(tableInfo[0] || {}));

    // Now fetch the actual data with all available columns
    const { data, error, count } = await supabase
      .from('post_details')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('Error fetching from post_details:', error);
      throw error;
    }

    const totalPages = Math.ceil((count || 0) / limit);
    const response = {
      data: data || [],
      error: null,
      hasMorePages: page < totalPages,
      totalCount: count || 0,
      currentPage: page,
      totalPages
    };

    postsCache.data.set(cacheKey, response);
    postsCache.timestamp.set(cacheKey, Date.now());

    return response;
  } catch (error) {
    logger.error('Error in getPosts:', error);
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
}

/**
 * Get posts by user ID
 * @param {string} userId - User ID
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of posts per page
 * @returns {Promise<object>} - Posts and pagination info
 */
export async function getUserPosts(userId, page = 1, limit = 10) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  const { data, error, count } = await supabase
    .from('post_details')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
    
  if (error) throw error;
  
  return {
    posts: data,
    totalCount: count,
    currentPage: page,
    totalPages: Math.ceil(count / limit)
  };
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
    logger.error('Error fetching followers: userId is undefined or null');
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
    logger.error('Error fetching followers:', error);
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
    logger.error('Error fetching following: userId is undefined or null');
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
    logger.error('Error fetching following:', error);
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
    .from('post_details')
    .select('*')
    .eq('id', postId)
    .single();
    
  if (error) throw error;
  return data;
};
