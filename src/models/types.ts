export interface Stock {
  symbol: string;
  name: string;
  country: string;
  exchange?: string;
  uniqueId?: string;
}

export interface Post {
  id?: string;
  user_id: string;
  content: string;
  description?: string;
  image_url?: string;
  symbol?: string;
  company_name?: string;
  country?: string;
  exchange?: string;
  current_price?: number;
  target_price?: number;
  stop_loss_price?: number;
  strategy?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email?: string;
  username?: string;
  avatar_url?: string;
  background_url?: string;
  bio?: string;
  created_at?: string;
  updated_at?: string;
  experience_Score?: number;
  success_posts?: number;
  loss_posts?: number;
}

export interface Profile {
  id?: string;
  user_id: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  background_url?: string;
  experience_Score?: number;
  success_posts?: number;
  loss_posts?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ApiResponse {
  source: 'api' | 'local' | 'direct_api';
  url?: string;
  data?: any;
  error?: string;
  fetched?: boolean;
  fetchTime?: string;
  processed?: PriceData[];
}

export interface FormErrors {
  content?: string;
  image?: string;
  symbol?: string;
  strategy?: string;
  target_price?: string;
  stop_loss_price?: string;
}

export type FormStatus = 'idle' | 'uploading' | 'success' | 'error';