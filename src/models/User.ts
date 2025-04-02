export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  last_login?: string;
}
