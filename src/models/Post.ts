export interface Post {
  id?: string;
  user_id: string;
  company_name: string;
  symbol: string;
  description: string;
  content: string;
  strategy: string;
  current_price?: number;
  target_price?: number;
  stop_loss_price?: number;
  exchange?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}
