export interface Post {
  id?: string;
  user_id: string;
  company_name: string;
  symbol: string;
  description: string;
  content: string;
  strategy: string;
  country?: string;
  current_price?: number;
  target_price?: number;
  stop_loss_price?: number;
  exchange?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  
  // Fields for price checking and post status
  target_reached?: boolean;
  stop_loss_triggered?: boolean;
  target_reached_date?: string;
  stop_loss_triggered_date?: string;
  last_price_check?: string;
  last_price?: number;
  closed?: boolean;
}
