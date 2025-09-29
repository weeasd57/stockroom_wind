import { createClient } from '@supabase/supabase-js';
// import logger from '@/utils/logger';
import imageCompression from 'browser-image-compression';

// Lazy initialize Supabase client to avoid build-time env access
let _supabaseClient = null;

function initSupabaseClient() {
  // Read env at call-time (runtime) instead of at module load (build-time)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Throw at runtime if actually used without proper config
    throw new Error('Supabase client missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(url, anonKey);
}

export function getSupabaseClient() {
  if (!_supabaseClient) {
    _supabaseClient = initSupabaseClient();
  }
  return _supabaseClient;
}

// Proxy to keep existing `supabase` usage working while deferring initialization
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabaseClient();
    return client[prop];
  }
});

// Authentication helpers
/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {object} userData - Additional user data such as username
 * @returns {Promise<object>} - Signed up user data and error
 */
export const signUp = async (email, password, userData = {}) => {
  try {
    // console.log('signUp utility: Attempting to create new user with email:', email);
    
    // Check if password meets minimum requirements
    if (password.length < 6) {
      // console.error('Password too short');
      return { 
        data: null, 
        error: new Error('Password must be at least 6 characters long') 
      };
    }
    
    // Extract username from userData or fallback to email
    const username = userData?.username || email.split('@')[0];
    
    // 1. Sign up the user with Supabase Auth
    // console.log('signUp utility: Sending auth.signUp request with username:', username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Auto-confirm email so users can sign in immediately
        emailConfirm: true
      }
    });
    
    // console.log('signUp utility: Supabase response:', { 
    //   user: data?.user ? 'User object present' : 'No user object',
    //   identities: data?.user?.identities?.length,
    //   error: error ? error.message : 'No error'
    // });
    
    if (error) {
      // console.error('signUp utility: Auth error:', error.message);
      throw error;
    }
    
    // Check if the user already exists
    if (data?.user?.identities?.length === 0) {
      // console.error('User already exists');
      return { 
        data: null, 
        error: new Error('This email is already registered. Please sign in instead.') 
      };
    }
    
    // 2. If user was created successfully, we let the database trigger handle profile creation
    // The trigger should automatically create a profile for new users
    if (data?.user?.id) {
      try {
        // Wait a moment for the trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to create a profile directly (this may fail with RLS, which is fine)
        const now = new Date().toISOString();
        const profileData = {
          id: data.user.id,
          username: username,
          email: email,
          created_at: now,
          updated_at: now,
          last_sign_in: now,
          success_posts: 0,
          loss_posts: 0,
          experience_score: 0,
          followers: 0,
          following: 0
        };
        
        // This might fail due to RLS, but we try anyway
        // The database trigger should have created the profile already
        await supabase.from('profiles').insert([profileData]);
        
        // No need to check for errors, as we expect this might fail due to RLS
        // or because the profile already exists from the trigger
      } catch (profileError) {
        // console.error('signUp utility: Profile creation attempt error:', profileError);
        // Continue even if profile creation fails - the trigger might have worked
      }
    }
    
    return { data, error: null };
  } catch (e) {
    // console.error('signUp utility: Error during sign up:', e);
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
    console.time('Supabase Logout');
    const { error } = await supabase.auth.signOut();
    console.timeEnd('Supabase Logout');
    if (error) throw error;
    
    // If router is provided, redirect to landing page
    if (router) {
      console.time('Logout Redirection');
      router.push('/landing');
      console.timeEnd('Logout Redirection');
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
      .select('id, username, full_name, email, avatar_url, background_url, bio, facebook_url, telegram_url, youtube_url, success_posts, loss_posts, experience_score, followers, following, created_at')
      .eq('id', userId);

    if (error) throw error;
    
    // Count posts for this user
    const { data: allPostsData, error: allPostsError } = await supabase
      .from('posts')
      .select('id, target_reached, stop_loss_triggered, closed')
      .eq('user_id', userId);
      
    // Count followers and following for this user
    const { data: followersData, error: followersError } = await supabase
      .from('user_followings')
      .select('follower_id')
      .eq('following_id', userId);
      
    const { data: followingData, error: followingError } = await supabase
      .from('user_followings')
      .select('following_id')
      .eq('follower_id', userId);
      
    if (!allPostsError && allPostsData) {
      const totalPosts = allPostsData.length;
      const closedPosts = allPostsData.filter(post => post.closed);
      const successPosts = closedPosts.filter(post => post.target_reached).length;
      const lossPosts = closedPosts.filter(post => post.stop_loss_triggered).length;
      
      // Calculate experience score (success - loss)
      const experienceScore = successPosts - lossPosts;
      
      const followersCount = followersData ? followersData.length : 0;
      const followingCount = followingData ? followingData.length : 0;
      
      // If we have profile data, set computed values on the returned object
      if (data && data.length > 0) {
        // Always set on the return payload regardless of DB update success
        data[0].posts_count = totalPosts;
        data[0].success_posts = successPosts;
        data[0].loss_posts = lossPosts;
        data[0].experience_score = experienceScore;
        data[0].followers = followersCount;
        data[0].following = followingCount;

        // Try to update the profile with the latest counts (ignore failures)
        await supabase
          .from('profiles')
          .update({
            success_posts: successPosts,
            loss_posts: lossPosts,
            experience_score: experienceScore,
            followers: followersCount,
            following: followingCount
          })
          .eq('id', userId);
      }
    }
    
    // If no profile exists, return empty data instead of error
    if (!data || data.length === 0) {
      
      // Create a default profile for the user
      const now = new Date().toISOString();
      const user = await getCurrentUser(); // Get the current user to get their email
      const defaultProfile = {
        id: userId,
        username: `user_${userId.substring(0, 8)}`,
        full_name: `User ${userId.substring(0, 8)}`,
        avatar_url: '/default-avatar.svg',
        bio: '',
        facebook_url: null,
        telegram_url: null,
        youtube_url: null,
        website: '',
        favorite_markets: [],
        created_at: now,
        updated_at: now,
        email: user?.email || '',
        last_sign_in: now,
        success_posts: 0,
        loss_posts: 0,
        background_url: '/profile-bg.jpg',
        experience_score: 0,
        followers: 0,
        following: 0
      };
      
      // Count posts for this user (in case they exist before profile creation)
      const { data: allPostsData, error: allPostsError } = await supabase
        .from('posts')
        .select('id, target_reached, stop_loss_triggered, closed')
        .eq('user_id', userId);
        
      // Count followers and following for this user
      const { data: followersData, error: followersError } = await supabase
        .from('user_followings')
        .select('follower_id')
        .eq('following_id', userId);
        
      const { data: followingData, error: followingError } = await supabase
        .from('user_followings')
        .select('following_id')
        .eq('follower_id', userId);
        
      if (!allPostsError && allPostsData) {
        const totalPosts = allPostsData.length;
        const closedPosts = allPostsData.filter(post => post.closed);
        defaultProfile.posts_count = totalPosts;
        defaultProfile.success_posts = closedPosts.filter(post => post.target_reached).length;
        defaultProfile.loss_posts = closedPosts.filter(post => post.stop_loss_triggered).length;
        defaultProfile.experience_score = defaultProfile.success_posts - defaultProfile.loss_posts;
      }
      
      if (!followersError && followersData) {
        defaultProfile.followers = followersData.length;
      }
      
      if (!followingError && followingData) {
        defaultProfile.following = followingData.length;
      }
      
      // Exclude posts_count from DB insert (not a DB column)
      const { posts_count, ...insertProfile } = defaultProfile;
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([insertProfile]);
      
      if (insertError) {
        return { data: null, error: insertError };
      }
      
      return { data: [defaultProfile], error: null };
    }
    
    // Ensure posts_count exists on the returned object even if counting failed
    if (data && data.length > 0 && typeof data[0].posts_count === 'undefined') {
      data[0].posts_count = 0;
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
    // console.log('updateUserProfile called with:', { userId, updates });
    
    // Create a clean updates object for the database
    const dbUpdates = {};
    
    // Map form fields to database columns
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.full_name) dbUpdates.full_name = updates.full_name;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio; // Handle empty bio
    // Handle Facebook URL with validation
    if (updates.facebook_url !== undefined) {
      const facebookUrl = updates.facebook_url ? updates.facebook_url.trim() : '';
      if (facebookUrl) {
        // Basic URL validation
        try {
          new URL(facebookUrl);
          dbUpdates.facebook_url = facebookUrl;
        } catch (e) {
          console.warn('Invalid Facebook URL provided:', facebookUrl);
          dbUpdates.facebook_url = null;
        }
      } else {
        dbUpdates.facebook_url = null; // Empty string becomes null
      }
    }
    
    // Handle Telegram URL with validation
    if (updates.telegram_url !== undefined) {
      const telegramUrl = updates.telegram_url ? updates.telegram_url.trim() : '';
      if (telegramUrl) {
        // Basic URL validation
        try {
          new URL(telegramUrl);
          dbUpdates.telegram_url = telegramUrl;
        } catch (e) {
          console.warn('Invalid Telegram URL provided:', telegramUrl);
          dbUpdates.telegram_url = null;
        }
      } else {
        dbUpdates.telegram_url = null; // Empty string becomes null
      }
    }
    
    // Handle YouTube URL with validation
    if (updates.youtube_url !== undefined) {
      const youtubeUrl = updates.youtube_url ? updates.youtube_url.trim() : '';
      if (youtubeUrl) {
        // Basic URL validation
        try {
          new URL(youtubeUrl);
          dbUpdates.youtube_url = youtubeUrl;
        } catch (e) {
          console.warn('Invalid YouTube URL provided:', youtubeUrl);
          dbUpdates.youtube_url = null;
        }
      } else {
        dbUpdates.youtube_url = null; // Empty string becomes null
      }
    }
    
    // Handle avatarUrl (from form) or avatar_url (directly provided)
    if (updates.avatarUrl) {
      dbUpdates.avatar_url = updates.avatarUrl.split('?')[0]; // Remove cache params
      // console.log('Setting avatar_url in database to:', dbUpdates.avatar_url);
    } else if (updates.avatar_url) {
      dbUpdates.avatar_url = updates.avatar_url.split('?')[0]; // Remove cache params
      // console.log('Setting avatar_url in database to:', dbUpdates.avatar_url);
    }
    
    // Handle backgroundUrl (from form) or background_url (directly provided)
    if (updates.backgroundUrl) {
      dbUpdates.background_url = updates.backgroundUrl.split('?')[0]; // Remove cache params
      // console.log('Setting background_url in database to:', dbUpdates.background_url);
    } else if (updates.background_url) {
      dbUpdates.background_url = updates.background_url.split('?')[0]; // Remove cache params
      // console.log('Setting background_url in database to:', dbUpdates.background_url);
    }
    
    console.log('[updateUserProfile] Final database updates:', dbUpdates);
    
    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId)
      .select('*')
      .single();
    
    console.log('[updateUserProfile] Supabase raw response - data:', data, 'error:', error);
    
    if (error) {
      // console.error('Error updating profile in database:', error);
      return { data: null, error };
    }
    
    // console.log('Profile updated successfully in database:', data);
    return { data, error: null };
  } catch (error) {
    // console.error('Error in updateUserProfile:', error);
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
      console.log(`[uploadImage] Updating profile ${profileField} for user ${userId} with URL: ${baseUrl}`);
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({ [profileField]: baseUrl })
        .eq('id', userId)
        .select('*');
      
      if (updateError) {
        console.error(`[uploadImage] Error updating profile ${profileField}:`, updateError);
        console.error(`[uploadImage] Update details - userId: ${userId}, field: ${profileField}, baseUrl: ${baseUrl}`);
        // Don't fail the upload if profile update fails, but log it
      } else {
        console.log(`[uploadImage] Successfully updated profile ${profileField}:`, updateData);
      }
    } catch (updateError) {
      console.error(`[uploadImage] Exception updating profile ${profileField}:`, updateError);
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

  // Check if user can create post (subscription limits)
  try {
    const { data: canCreate, error: limitError } = await supabase
      .rpc('check_post_limit', { p_user_id: userId });
    
    if (limitError) {
      console.error('Error checking post limit:', limitError);
      throw new Error('Error checking subscription limits: ' + limitError.message);
    }
    
    if (canCreate === false) {
      // Get subscription info for error message
      const { data: subscriptionData } = await supabase
        .from('user_subscription_info')
        .select('*')
        .eq('user_id', userId);
      
      const subscriptionInfo = subscriptionData && subscriptionData.length > 0 ? subscriptionData[0] : null;
      const maxPosts = subscriptionInfo?.post_creation_limit || 100;
      const usedPosts = subscriptionInfo?.posts_created || 0;
      const planName = subscriptionInfo?.plan_name || 'free';
      
      const errorMessage = planName === 'free' 
        ? `لقد وصلت إلى الحد الأقصى للمنشورات (${maxPosts} منشور شهريًا). يرجى الترقية إلى Pro للحصول على المزيد.`
        : `لقد وصلت إلى الحد الأقصى للمنشورات في خطة ${planName} (${maxPosts} منشور شهريًا).`;
      
      throw new Error(errorMessage);
    }
    
    // Log the post creation using RPC function
    const { data: logResult, error: logError } = await supabase
      .rpc('log_post_creation', { p_user_id: userId });
    
    if (logError) {
      console.error('Error logging post creation:', logError);
      // Continue with post creation even if logging fails
    }
  } catch (error) {
    // If it's a subscription limit error, rethrow it
    if (error.message.includes('الحد الأقصى') || error.message.includes('limit')) {
      throw error;
    }
    // For other errors, log but continue (backward compatibility)
    console.warn('Subscription check failed, continuing with post creation:', error);
  }

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
    // Start timing the post creation using a unique label to avoid duplicate timer errors
    const timerLabel = `Post Creation ${Date.now()} ${Math.random().toString(36).slice(2,8)}`;
    console.time(timerLabel);
    try {
      // Log a safe summary of the sanitized post to help debug long-running inserts
      const safeSanitized = JSON.stringify(sanitizedPost);
      console.debug('[createPost] starting insert', { sanitizedKeys: Object.keys(sanitizedPost), safeSanitized });
    } catch (e) {
      console.debug('[createPost] starting insert (could not stringify sanitizedPost)', e);
    }
    const { data, error } = await supabase
      .from('posts')
      .insert([sanitizedPost]) // Use sanitized post without images
      .select();
    
    const insertDuration = performance.now() - startTime;
    console.timeEnd(timerLabel); // End timing here
    console.debug('[createPost] insert completed', { insertDuration, returnedRows: Array.isArray(data) ? data.length : 0, error });

    
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
 * Upload post image with performance tracking and client-side compression
 * @param {File} file - Image file to upload
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Object with publicUrl and error (consistent with other functions)
 */
export async function uploadPostImage(file, userId) {
  const uploadStart = performance.now();
  console.log('[uploadPostImage] Starting upload:', { name: file.name, size: Math.round(file.size / 1024) + 'KB', type: file.type, userId });
  
  if (!file || !userId) {
    console.error('[uploadPostImage] Missing required parameters');
    return { publicUrl: null, error: 'Missing file or userId parameter' };
  }

  let compressedFile = file;

  // Compress image before uploading if it's an image
  if (file.type.startsWith('image/')) {
    try {
      const originalSizeKB = Math.round(file.size / 1024);
      console.log('[uploadPostImage] Compressing image. Original size:', originalSizeKB, 'KB');
      
      const options = {
        maxSizeMB: 1,           // Max size in MB
        maxWidthOrHeight: 1920, // Max width or height in pixels
        useWebWorker: true,     // Use web worker for better performance
        initialQuality: 0.8,    // Initial quality, 0 to 1
        maxIteration: 10,       // Max number of iterations to compress the image
      };
      
      compressedFile = await imageCompression(file, options);
      const compressedSizeKB = Math.round(compressedFile.size / 1024);
      console.log('[uploadPostImage] Compression complete. New size:', compressedSizeKB, 'KB');
    } catch (error) {
      console.error('[uploadPostImage] Image compression failed:', error);
      // Fallback to original file if compression fails
      compressedFile = file;
    }
  }

  try {
    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const fileExt = compressedFile.name.split('.').pop().toLowerCase();
    const fileName = `${userId}-post-${timestamp}.${fileExt}`;

    let bucketName = 'post_images';
    let filePath = fileName;

    console.log('[uploadPostImage] Attempting upload to bucket:', bucketName, 'path:', filePath);

    // Try to upload directly to 'post_images' bucket first
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: true
      });
      
    console.log('[uploadPostImage] Upload attempt result:', { data: !!data, error: error?.message });

    // If upload to 'post_images' fails and it's a bucket-related error, fall back to 'avatars'
    if (error && (error.message.includes('Bucket not found') || error.message.includes('permission denied'))) {
      console.warn(`[uploadPostImage] Primary bucket '${bucketName}' failed, trying fallback. Error:`, error.message);
      
      bucketName = 'avatars';
      filePath = `posts/${fileName}`; // Store in a 'posts' subfolder

      console.log('[uploadPostImage] Attempting fallback upload to bucket:', bucketName, 'path:', filePath);

      // Retry upload with the fallback bucket
      const { data: fallbackData, error: fallbackError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (fallbackError) {
        console.error('[uploadPostImage] Fallback upload failed:', fallbackError);
        return { publicUrl: null, error: fallbackError };
      }
      
      // Get public URL for fallback upload
      const fallbackPublicUrl = supabase.storage.from(bucketName).getPublicUrl(filePath).data.publicUrl;
      console.log('[uploadPostImage] Fallback upload successful:', fallbackPublicUrl);
      return { publicUrl: fallbackPublicUrl, error: null };
    }

    if (error) {
      console.error('[uploadPostImage] Upload failed:', error);
      return { publicUrl: null, error };
    }

    // Get the public URL for the successfully uploaded file
    const publicUrl = supabase.storage.from(bucketName).getPublicUrl(filePath).data.publicUrl;
    const uploadDuration = performance.now() - uploadStart;
    
    console.log('[uploadPostImage] Upload successful:', {
      publicUrl,
      duration: Math.round(uploadDuration) + 'ms',
      bucket: bucketName,
      path: filePath
    });
    
    return { publicUrl, error: null };

  } catch (error) {
    console.error('[uploadPostImage] Unexpected error during upload:', error);
    return { publicUrl: null, error };
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
};

/**
 * Check if the Supabase connection is working
 * @returns {Promise<boolean>} - Whether the connection is working
 */
export async function checkSupabaseConnection() {
  try {
    // First check if Supabase is configured
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[checkSupabaseConnection] Missing Supabase configuration');
      return false;
    }

    // Try a simple query to check if the connection works
    // Use profiles table instead of non-existent _anon_auth_check table
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    // If we get a "relation does not exist" error, that's actually good
    // It means we connected to the database but the table doesn't exist
    if (error && error.code === '42P01') {
      console.log('[checkSupabaseConnection] Connected to database (table does not exist, which is expected)');
      return true;
    }
    
    if (error) {
      console.warn('[checkSupabaseConnection] Connection error:', error.message);
      
      // Check for specific error types to provide better diagnostics
      if (error.code === 'PGRST301') {
        console.warn('[checkSupabaseConnection] JWT expired or invalid');
      } else if (error.code === 'PGRST401') {
        console.warn('[checkSupabaseConnection] Unauthorized access');
      } else if (error.message && error.message.includes('Failed to fetch')) {
        console.warn('[checkSupabaseConnection] Network connection failed');
      }
      
      return false;
    }

    console.log('[checkSupabaseConnection] Connection successful');
    return true;
  } catch (error) {
    console.error('[checkSupabaseConnection] Unexpected error:', error);
    
    // Provide more specific error information
    if (error.message && error.message.includes('fetch')) {
      console.warn('[checkSupabaseConnection] Network fetch error');
    } else if (error.message && error.message.includes('timeout')) {
      console.warn('[checkSupabaseConnection] Connection timeout');
    }
    
    return false;
  }
};

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
    .from('user_followings')
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
    .from('user_followings')
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
      .from('user_followings')
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
      .from('user_followings')
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
      .from('posts_with_stats')
      .select(`
        id,
        user_id,
        symbol,
        company_name,
        country,
        exchange,
        initial_price,
        current_price,
        last_price,
        last_price_check,
        target_price,
        target_reached,
        target_reached_date,
        stop_loss_price,
        stop_loss_triggered,
        stop_loss_triggered_date,
        description,
        strategy,
        sentiment,
        image_url,
        price_checks,
        status,
        closed,
        closed_date,
        created_at,
        updated_at,
        buy_count,
        sell_count,
        comment_count
      `)
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
  // Only monitor Supabase API calls, and exclude local Next.js API routes
  if (url && url.toString().includes('supabase.co') && !url.toString().includes('/api/')) {
    const startTime = performance.now();
    const startDate = new Date().toISOString();
    
    // Log the start of the request
    // console.log(`[Supabase Fetch] START - ${url} at ${startDate}`);
    
    try {
      // Continue with the original fetch
      const response = await originalFetch(url, options);
      
      // Calculate the time taken
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Clone the response as we'll be consuming the body
      const clonedResponse = response.clone();
      
      // Log the response status and timing
      // console.log(`[Supabase Fetch] END - ${url} in ${duration.toFixed(2)}ms, Status: ${response.status}`);
      
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
      // console.error(`[Supabase Fetch] ERROR - ${url} in ${errorDuration.toFixed(2)}ms:`, error);
      
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

    // console.log(`[Debug] ${name} started with args:`, args);
    // Log basic info about the args, but don't log sensitive data
    if (args.length > 0) {
      // console.log(`[Debug] ${name} arguments:`);
      
      // Safely log some argument details
      args.forEach((arg, index) => {
        if (arg === null || arg === undefined) {
          // console.log(`  arg ${index}: null/undefined`);
        } else if (typeof arg === 'object') {
          // Don't log the full object, just its keys
          try {
            const isArray = Array.isArray(arg);
            const keys = isArray ? [`Array(${arg.length})`] : Object.keys(arg);
            // console.log(`  arg ${index} (${typeof arg}${isArray ? ' array' : ''}): keys: ${keys.join(', ')}`);
          } catch (e) {
            // console.warn(`  arg ${index} (object, failed to get keys):`, e);
          }
        } else if (typeof arg === 'string' && arg.length > 100) {
          // console.log(`  arg ${index} (string, length ${arg.length}): ${arg.substring(0, 100)}...`);
        } else {
          // console.log(`  arg ${index} (${typeof arg}):`, arg);
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
          // console.error(`[Debug] ${name} completed with error in ${duration.toFixed(2)}ms:`, result.error);
        } else {
          // console.log(`[Debug] ${name} completed successfully in ${duration.toFixed(2)}ms.`);
          
          // Log some details about the result, but don't log the entire response
          if (result.data) {
            const dataInfo = Array.isArray(result.data) 
              ? `Array with ${result.data.length} items` 
              : `Object with keys: ${Object.keys(result.data).join(', ')}`;
            // console.log(`[Debug] ${name} result data: ${dataInfo}`);
          } else {
            // console.log(`[Debug] ${name} result: No data property.`);
          }
        }
      } else {
        // console.log(`[Debug] ${name} completed in ${duration.toFixed(2)}ms. Result:`, result);
        if (result === undefined) {
          // console.log(`[Debug] ${name} returned undefined.`);
        } else {
          // console.log(`[Debug] ${name} returned a non-object value.`);
        }
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      // console.error(`[Debug] ${name} failed in ${duration.toFixed(2)}ms:`, error);
      
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
