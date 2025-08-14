export interface User {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  favorite_markets: string[] | null;
  created_at: string;
  updated_at: string | null;
  email: string | null;
  last_sign_in: string | null;
  success_posts: number;
  loss_posts: number;
  background_url: string | null;
  experience_score: number;
  followers: number | null;
  following: number | null;
}

export const createDefaultUser = (userId: string, email: string): User => {
  const now = new Date().toISOString();
  const username = email ? email.split('@')[0] : `user_${userId.substring(0, 8)}`;
  
  return {
    id: userId,
    username,
    full_name: null,
    avatar_url: null,
    bio: null,
    website: null,
    favorite_markets: null,
    created_at: now,
    updated_at: null,
    email,
    last_sign_in: now,
    success_posts: 0,
    loss_posts: 0,
    background_url: null,
    experience_score: 0,
    followers: 0,
    following: 0
  };
};
