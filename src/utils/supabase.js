import { createClient } from '@supabase/supabase-js';

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure we have valid credentials before creating the client
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Authentication helpers
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

export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// User profile helpers
export const getUserProfile = async (userId) => {
  if (userId === undefined) {
    console.error('Error fetching user profile: userId is undefined');
    return { data: null, error: { message: 'User ID is required' } };
  }

  if (userId === null) {
    console.error('Error fetching user profile: userId is null');
    return { data: null, error: { message: 'User ID cannot be null' } };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, bio, trading_style, experience_level')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

export const updateUserProfile = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating user profile:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (e) {
    console.error('Exception updating profile:', e);
    return { data: null, error: e };
  }
};

// Post helpers
export const createPost = async (postData) => {
  const { data, error } = await supabase
    .from('posts')
    .insert([postData])
    .select();
  return { data, error };
};

export const getPosts = async (limit = 10, page = 0, userId = null) => {
  let query = supabase
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      user_id,
      profiles:user_id (
        username,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false });
    
  // Filter by user_id if provided
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  // Apply pagination
  const { data, error } = await query
    .range(page * limit, (page + 1) * limit - 1)
    .limit(limit)
    .abortSignal(AbortSignal.timeout(5000));

  if (error) {
    console.error('Posts fetch error:', error);
    return { data: null, error };
  }

  return { data, error: null };
};

export const getPostById = async (postId) => {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (
        username,
        avatar_url
      )
    `)
    .eq('id', postId)
    .single();
  return { data, error };
};

// Following system
export const followUser = async (followerId, followingId) => {
  const { data, error } = await supabase
    .from('follows')
    .insert([{ follower_id: followerId, following_id: followingId }]);
  return { data, error };
};

export const unfollowUser = async (followerId, followingId) => {
  const { data, error } = await supabase
    .from('follows')
    .delete()
    .match({ follower_id: followerId, following_id: followingId });
  return { data, error };
};

export const getFollowers = async (userId) => {
  if (!userId) {
    console.error('Error fetching followers: userId is undefined or null');
    return { data: [], error: { message: 'User ID is required' } };
  }

  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        follower_id,
        profiles!follows_follower_id_fkey (
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

export const getFollowing = async (userId) => {
  if (!userId) {
    console.error('Error fetching following: userId is undefined or null');
    return { data: [], error: { message: 'User ID is required' } };
  }

  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        following_id,
        profiles!follows_following_id_fkey (
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
