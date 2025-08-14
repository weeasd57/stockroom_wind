// ===================================================================
// تعريفات TypeScript الرئيسية / Main TypeScript Definitions
// ===================================================================

// تعريفات المستخدم / User Types
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
  is_active?: boolean;
  email_verified?: boolean;
  profile_visibility?: 'public' | 'private' | 'followers';
}

// تعريفات المنشور / Post Types
export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  symbol: string;
  company_name: string;
  country: string;
  exchange: string;
  current_price: number;
  target_price: number;
  stop_loss_price: number;
  strategy: string;
  created_at: Date | string;
  updated_at: Date | string;
  description?: string;
  target_reached: boolean;
  stop_loss_triggered: boolean;
  target_reached_date?: Date | string;
  stop_loss_triggered_date?: Date | string;
  last_price_check?: Date | string;
  last_price?: number;
  closed: boolean;
  initial_price: number;
  high_price: number;
  target_high_price: number;
  target_hit_time?: Date | string;
  postDateAfterPriceDate: boolean;
  postAfterMarketClose: boolean;
  noDataAvailable: boolean;
  status_message?: string;
  visibility?: 'public' | 'private' | 'followers';
}

// تعريفات المنشور مع بيانات المستخدم / Post with User Data
export interface PostWithUser extends Post {
  user: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

// تعريفات التعليق / Comment Types
export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  parent_comment_id?: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  user?: {
    username: string;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

// تعريفات الإعجاب / Like Types
export interface Like {
  id: string;
  user_id: string;
  post_id?: string;
  comment_id?: string;
  created_at: string;
}

// تعريفات المتابعة / Follow Types
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// تعريفات الاستراتيجية / Strategy Types
export interface UserStrategy {
  id?: string;
  user_id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export type TradingStrategy = 
  | 'Long Term Investment'
  | 'Swing Trading'
  | 'Day Trading'
  | 'Value Investing'
  | 'Growth Investing'
  | 'Fundamental Analysis'
  | 'Technical Analysis'
  | 'Momentum Trading'
  | 'Breakout Trading'
  | 'Position Trading'
  | 'Scalping'
  | 'News Trading';

// تعريفات المحفظة / Portfolio Types
export interface Portfolio {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string;
  shares: number;
  avg_purchase_price: number;
  current_price?: number;
  last_updated: string;
  created_at: string;
}

// تعريفات الإشعارات / Notification Types
export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'follow' | 'target_reached' | 'stop_loss';
  title: string;
  message: string;
  related_post_id?: string;
  related_user_id?: string;
  is_read: boolean;
  created_at: string;
}

// تعريفات مقاييس الأداء / Performance Metrics Types
export interface PerformanceMetrics {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  total_posts: number;
  successful_predictions: number;
  failed_predictions: number;
  avg_return_percentage: number;
  total_return_percentage: number;
  risk_score: number;
  created_at: string;
}

// تعريفات البيانات المالية / Market Data Types
export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  pe?: number;
  eps?: number;
  high52w?: number;
  low52w?: number;
  dividendYield?: number;
  lastUpdate: string;
}

export interface CountryInfo {
  name: string;
  code: string;
  flag: string;
  currency: string;
  exchanges: string[];
}

export interface ExchangeInfo {
  name: string;
  code: string;
  country: string;
  timezone: string;
  openTime: string;
  closeTime: string;
}

// تعريفات API / API Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

// تعريفات النماذج / Form Types
export interface CreatePostFormData {
  content: string;
  symbol: string;
  company_name: string;
  country: string;
  exchange: string;
  current_price: number;
  target_price: number;
  stop_loss_price: number;
  strategy: string;
  description?: string;
  image_url?: string;
  visibility?: 'public' | 'private' | 'followers';
}

export interface UpdateProfileFormData {
  username?: string;
  full_name?: string;
  bio?: string;
  website?: string;
  favorite_markets?: string[];
  profile_visibility?: 'public' | 'private' | 'followers';
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  email: string;
  password: string;
  username: string;
  confirmPassword: string;
}

// تعريفات الحالة / State Types
export interface AuthState {
  user: User | null;
  session: any;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface PostsState {
  posts: PostWithUser[];
  currentPost: PostWithUser | null;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
}

export interface CommentsState {
  comments: Comment[];
  isLoading: boolean;
  error: string | null;
}

export interface ProfileState {
  profile: User | null;
  posts: PostWithUser[];
  followers: User[];
  following: User[];
  isLoading: boolean;
  error: string | null;
}

// تعريفات المكونات / Component Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export interface ErrorProps extends BaseComponentProps {
  message: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// تعريفات الأحداث / Event Types
export interface PostCreatedEvent {
  post: PostWithUser;
  user: User;
}

export interface PostUpdatedEvent {
  postId: string;
  changes: Partial<Post>;
}

export interface UserFollowedEvent {
  followerId: string;
  followingId: string;
}

export interface NotificationEvent {
  notification: Notification;
  userId: string;
}

// تعريفات الأخطاء / Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface NetworkError extends AppError {
  status: number;
  url: string;
}

// تعريفات التكوين / Configuration Types
export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  features: {
    enableNotifications: boolean;
    enableAnalytics: boolean;
    enableDarkMode: boolean;
  };
}

// تصدير الأنواع المركبة / Export Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// نوع للاستجابة من Supabase
export type SupabaseResponse<T> = {
  data: T | null;
  error: any;
};

// أنواع للـ hooks
export type UsePostsOptions = {
  userId?: string;
  limit?: number;
  sortBy?: 'created_at' | 'target_reached' | 'popularity';
  filterBy?: {
    country?: string;
    strategy?: string;
    status?: 'open' | 'closed' | 'target_reached';
  };
};

export type UseProfileOptions = {
  includeStats?: boolean;
  includePosts?: boolean;
  includeFollowers?: boolean;
};

// أنواع للمرشحات والبحث
export interface SearchFilters {
  query?: string;
  country?: string;
  exchange?: string;
  strategy?: string;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  status?: 'open' | 'closed' | 'target_reached' | 'stop_loss';
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// أنواع للرسوم البيانية
export interface ChartDataPoint {
  timestamp: string;
  price: number;
  volume?: number;
}

export interface ChartConfig {
  type: 'line' | 'candlestick' | 'area';
  timeframe: '1D' | '7D' | '1M' | '3M' | '1Y';
  indicators?: string[];
}