import { createClient } from '@supabase/supabase-js';

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
 * @returns {Promise<object>} - Sign out error
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
      // Clear any potentially corrupted session data
      await supabase.auth.signOut();
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
export const uploadImage = async (file, bucket, userId, fileType = 'avatar') => {
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
    
    // Upload the new file
    console.log(`Uploading new ${fileType} file...`);
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        cacheControl: 'no-cache',
      });
    
    if (uploadError) {
      console.error(`Error uploading ${fileType}:`, uploadError);
      throw uploadError;
    }
    
    // Get the public URL
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    if (!data?.publicUrl) {
      throw new Error('Failed to get public URL');
    }
    
    // Use a more stable cache-busting parameter (daily instead of every millisecond)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const cacheBuster = `?t=${today}`;
    const publicUrl = data.publicUrl.split('?')[0]; // Base URL without any query parameters
    const publicUrlWithCacheBuster = `${publicUrl}${cacheBuster}`;
    
    // Automatically update the profile with the new image URL
    try {
      const profileField = fileType === 'avatar' ? 'avatar_url' : 'background_url';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [profileField]: publicUrl })
        .eq('id', userId);
      
      if (updateError) {
        console.warn(`Could not update profile with ${fileType} URL:`, updateError);
      } else {
        console.log(`Successfully updated profile with ${fileType} URL: ${publicUrl}`);
      }
    } catch (updateError) {
      console.warn(`Error updating profile with ${fileType} URL:`, updateError);
      // Continue even if profile update fails
    }
    
    console.log(`Successfully uploaded ${fileType}, URL: ${publicUrlWithCacheBuster}`);
    return { publicUrl: publicUrlWithCacheBuster, error: null };
  } catch (error) {
    console.error(`Error uploading ${fileType}:`, error);
    return { publicUrl: null, error };
  }
};

// Get background image URL directly from storage
/**
 * Get a user's background image URL
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Background image URL
 */
export const getBackgroundImageUrl = async (userId) => {
  if (!userId) return '/profile-bg.jpg';

  try {
    // First check if the user has a background_url in their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('background_url')
      .eq('id', userId)
      .single();

    if (profileError) {
      // Handle 'not found' errors differently than other errors
      if (profileError.code === 'PGRST116') {
        console.log(`No profile found for user ${userId}, will try storage directly`);
      } else {
        console.error('Error fetching profile for background URL:', profileError.message || profileError);
      }
      // Continue execution to try storage directly
    }

    // If we have a valid URL in the profile that's not the default, use it
    if (profile?.background_url && profile.background_url !== '/profile-bg.jpg') {
      // Check if it's a Supabase storage URL
      if (profile.background_url.includes('supabase.co/storage')) {
        // First check if the file actually exists before returning the URL with cache busting
        try {
          // Extract the path from the URL
          const urlParts = profile.background_url.split('/storage/v1/object/public/');
          if (urlParts.length > 1) {
            const pathPart = urlParts[1];
            const [bucket, ...pathSegments] = pathPart.split('/');
            const path = pathSegments.join('/');
            
            // Check if file exists
            const fileExists = await checkFileExists(bucket, path);
            
            if (!fileExists) {
              console.warn(`Background image in profile does not exist in storage: ${profile.background_url}`);
              // Try to find a new background image in storage
              return await findBackgroundInStorage(userId);
            }
            
            // File exists, return with modest cache busting (daily instead of every millisecond)
            // This reduces the number of unique URLs that can fail
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const cacheBuster = `?t=${today}`;
            return profile.background_url.includes('?') 
              ? profile.background_url.split('?')[0] + cacheBuster
              : `${profile.background_url}${cacheBuster}`;
          }
        } catch (checkError) {
          console.error('Error checking if background file exists:', checkError);
          // Try to find a new background image in storage
          return await findBackgroundInStorage(userId);
        }
      }
      
      // For non-Supabase URLs or if the check failed, return as is
      return profile.background_url;
    }

    // If we get here, no valid background URL in profile, try to find one in storage
    return await findBackgroundInStorage(userId);
  } catch (error) {
    console.error('Error getting background image URL:', error);
    return '/profile-bg.jpg';
  }
};

/**
 * Helper function to find a background image in storage
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Background image URL or default
 */
const findBackgroundInStorage = async (userId) => {
  try {
    // List files in the user's directory to find background images with any extension
    const { data: files, error: listError } = await supabase.storage
      .from('backgrounds')
      .list(userId);
    
    if (listError) {
      console.error('Error listing background files:', listError);
      return '/profile-bg.jpg';
    }
    
    // Find any file that starts with 'background.'
    const backgroundFile = files?.find(file => file.name.startsWith('background.'));
    
    if (backgroundFile) {
      // Get the public URL
      const { data } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(`${userId}/${backgroundFile.name}`);
        
      if (data?.publicUrl) {
        // Add a more stable cache-busting parameter (daily instead of every millisecond)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const cacheBuster = `?t=${today}`;
        const publicUrl = `${data.publicUrl.split('?')[0]}${cacheBuster}`;
        
        // Update the profile with this URL to avoid future storage checks
        try {
          await supabase
            .from('profiles')
            .update({ background_url: data.publicUrl.split('?')[0] })
            .eq('id', userId);
          
          console.log(`Updated profile with background URL: ${data.publicUrl.split('?')[0]}`);
        } catch (updateError) {
          console.warn('Could not update profile with background URL:', updateError);
        }
        
        return publicUrl;
      }
    }
    
    // If we get here, no background image found for user, return default
    return '/profile-bg.jpg';
  } catch (storageError) {
    console.error('Error checking background in storage:', storageError);
    return '/profile-bg.jpg';
  }
};

/**
 * Get a user's avatar image URL
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Avatar image URL
 */
export const getAvatarImageUrl = async (userId) => {
  if (!userId) return '/default-avatar.svg';

  try {
    // First check if the user has an avatar_url in their profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (profileError) {
      // Handle 'not found' errors differently than other errors
      if (profileError.code === 'PGRST116') {
        console.log(`No profile found for user ${userId}, will try storage directly`);
      } else {
        console.error('Error fetching profile for avatar URL:', profileError.message || profileError);
      }
      // Continue execution to try storage directly
    }

    // If we have a valid URL in the profile, use it
    if (profile?.avatar_url && profile.avatar_url !== '/default-avatar.svg') {
      // Check if the URL is from Google (OAuth profile picture)
      if (profile.avatar_url.includes('googleusercontent.com')) {
        return profile.avatar_url;
      }
      
      // If it's a Supabase storage URL, check if the file exists
      if (profile.avatar_url.includes('supabase.co/storage')) {
        try {
          // Extract the path from the URL
          const urlParts = profile.avatar_url.split('/storage/v1/object/public/');
          if (urlParts.length > 1) {
            const pathPart = urlParts[1];
            const [bucket, ...pathSegments] = pathPart.split('/');
            const path = pathSegments.join('/');
            
            // Check if file exists
            const fileExists = await checkFileExists(bucket, path);
            
            if (!fileExists) {
              console.warn(`Avatar image in profile does not exist in storage: ${profile.avatar_url}`);
              // Try to find a new avatar image in storage
              return await findAvatarInStorage(userId);
            }
          }
        } catch (checkError) {
          console.error('Error checking if avatar file exists:', checkError);
          // Try to find a new avatar image in storage
          return await findAvatarInStorage(userId);
        }
      }
      
      // Add cache-busting parameter if not already present
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const cacheBuster = `?t=${today}`;
      
      // Make sure we're returning the full URL without any query parameters first
      const cleanUrl = profile.avatar_url.includes('?') 
        ? profile.avatar_url.split('?')[0] 
        : profile.avatar_url;
        
      // Check if the URL is already a complete URL with protocol
      if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('/')) {
        // If it's a relative URL without protocol, prepend the Supabase URL
        const storageUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${userId}/${cleanUrl}`;
        return `${storageUrl}${cacheBuster}`;
      }
      
      return `${cleanUrl}${cacheBuster}`;
    }

    // If we get here, no valid avatar URL in profile, try to find one in storage
    return await findAvatarInStorage(userId);
  } catch (error) {
    console.error('Error getting avatar image URL:', error.message || error);
    return '/default-avatar.svg';
  }
};

/**
 * Helper function to find an avatar image in storage
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Avatar image URL or default
 */
const findAvatarInStorage = async (userId) => {
  try {
    // First check if the user folder exists
    const { data: userFiles, error: listError } = await supabase.storage
      .from('avatars')
      .list(userId);
    
    if (listError) {
      console.log(`Error listing files for user ${userId} in avatars bucket:`, listError);
      return '/default-avatar.svg';
    }
    
    if (!userFiles || userFiles.length === 0) {
      console.log(`No avatar files found for user ${userId}`);
      return '/default-avatar.svg';
    }
    
    // Find the first file that starts with 'avatar.'
    const avatarFile = userFiles.find(file => file.name.startsWith('avatar.'));
    
    if (!avatarFile) {
      console.log(`No avatar file found for user ${userId}`);
      return '/default-avatar.svg';
    }
    
    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(`${userId}/${avatarFile.name}`);
    
    if (publicUrlData?.publicUrl) {
      // Add cache-busting parameter
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const cacheBuster = `?t=${today}`;
      const publicUrl = `${publicUrlData.publicUrl.split('?')[0]}${cacheBuster}`;
      
      // Update the profile with this URL to avoid future storage checks
      try {
        const baseUrl = publicUrlData.publicUrl.split('?')[0];
        await supabase
          .from('profiles')
          .update({ avatar_url: baseUrl })
          .eq('id', userId);
        
        console.log(`Updated profile with avatar URL: ${baseUrl}`);
      } catch (updateError) {
        console.warn('Could not update profile with avatar URL:', updateError);
      }
      
      return publicUrl;
    }
    
    // If we get here, no avatar image found for user, return default
    return '/default-avatar.svg';
  } catch (storageError) {
    console.error('Error getting avatar from storage:', storageError);
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
    console.error('Error creating post:', error);
    return { data: null, error };
  }
}

/**
 * Upload post image to storage
 * @param {File} file - Image file to upload
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Public URL of the uploaded image
 */
export async function uploadPostImage(file, userId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  const filePath = `post-images/${fileName}`;
  
  const { error } = await supabase.storage
    .from('posts')
    .upload(filePath, file);
    
  if (error) throw error;
  
  const { data } = supabase.storage
    .from('posts')
    .getPublicUrl(filePath);
    
  return data.publicUrl;
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
      console.log('post_details view not found, falling back to posts table');
      // Try posts table instead
      const { data: postsData, error: postsError, count } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

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

      postsCache.data.set(cacheKey, response);
      postsCache.timestamp.set(cacheKey, Date.now());

      return response;
    } else if (tableError) {
      console.error('Error fetching table info:', tableError);
      throw tableError;
    }

    // If we got here, post_details exists. Let's see what columns we have
    console.log('Available columns in post_details:', Object.keys(tableInfo[0] || {}));

    // Now fetch the actual data with all available columns
    const { data, error, count } = await supabase
      .from('post_details')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching from post_details:', error);
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
    .from('post_details')
    .select('*')
    .eq('id', postId)
    .single();
    
  if (error) throw error;
  return data;
};
