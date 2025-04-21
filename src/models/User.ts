export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  background_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  last_login?: string;
  experience_Score?: number;
  success_posts?: number;
  loss_posts?: number;
}
