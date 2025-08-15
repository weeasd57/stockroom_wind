import { apiService } from './api';
import { 
  PostWithUser, 
  CreatePostFormData, 
  ApiResponse, 
  PaginatedResponse,
  UsePostsOptions 
} from '@/types';

export class PostsService {
  // Get posts with filters and pagination
  async getPosts(options: UsePostsOptions = {}): Promise<PaginatedResponse<PostWithUser>> {
    const { userId, limit = 10, sortBy = 'created_at', filterBy } = options;
    
    const params: Record<string, any> = {
      limit,
      sortBy,
      ...(userId && { userId }),
      ...(filterBy?.country && { country: filterBy.country }),
      ...(filterBy?.strategy && { strategy: filterBy.strategy }),
      ...(filterBy?.status && { status: filterBy.status }),
    };

    return apiService.getPaginated<PostWithUser>('/posts', params);
  }

  // Get single post by ID
  async getPost(postId: string): Promise<ApiResponse<PostWithUser>> {
    return apiService.get<PostWithUser>(`/posts/${postId}`);
  }

  // Create new post
  async createPost(postData: CreatePostFormData): Promise<ApiResponse<PostWithUser>> {
    // Validate required fields
    const requiredFields = [
      'content', 'symbol', 'company_name', 'country', 'exchange',
      'current_price', 'target_price', 'stop_loss_price', 'strategy'
    ];

    for (const field of requiredFields) {
      if (!postData[field as keyof CreatePostFormData]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate price fields
    if (postData.current_price <= 0 || postData.target_price <= 0 || postData.stop_loss_price <= 0) {
      throw new Error('All price fields must be greater than zero');
    }

    return apiService.post<PostWithUser>('/posts', {
      ...postData,
      status_message: postData.status_message || '',
    });
  }

  // Update existing post
  async updatePost(postId: string, updates: Partial<CreatePostFormData>): Promise<ApiResponse<PostWithUser>> {
    if (!postId) {
      throw new Error('Post ID is required');
    }

    return apiService.patch<PostWithUser>(`/posts/${postId}`, updates);
  }

  // Delete post
  async deletePost(postId: string): Promise<ApiResponse<void>> {
    if (!postId) {
      throw new Error('Post ID is required');
    }

    return apiService.delete<void>(`/posts/${postId}`);
  }

  // Like a post
  async likePost(postId: string): Promise<ApiResponse<void>> {
    if (!postId) {
      throw new Error('Post ID is required');
    }

    return apiService.post<void>(`/posts/${postId}/like`);
  }

  // Unlike a post
  async unlikePost(postId: string): Promise<ApiResponse<void>> {
    if (!postId) {
      throw new Error('Post ID is required');
    }

    return apiService.delete<void>(`/posts/${postId}/like`);
  }

  // Get user's posts
  async getUserPosts(userId: string, page = 1, limit = 10): Promise<PaginatedResponse<PostWithUser>> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return apiService.getPaginated<PostWithUser>('/posts', {
      userId,
      page,
      limit,
      sortBy: 'created_at'
    });
  }

  // Get trending posts
  async getTrendingPosts(limit = 10): Promise<ApiResponse<PostWithUser[]>> {
    return apiService.get<PostWithUser[]>('/posts/trending', { limit });
  }

  // Search posts
  async searchPosts(query: string, filters?: {
    country?: string;
    strategy?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResponse<PostWithUser>> {
    const params = {
      q: query,
      ...filters,
    };

    return apiService.getPaginated<PostWithUser>('/posts/search', params);
  }

  // Get posts by symbol
  async getPostsBySymbol(symbol: string, limit = 10): Promise<ApiResponse<PostWithUser[]>> {
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    return apiService.get<PostWithUser[]>('/posts/symbol', { symbol, limit });
  }

  // Get posts analytics for a user
  async getUserPostsAnalytics(userId: string): Promise<ApiResponse<{
    totalPosts: number;
    successfulPredictions: number;
    failedPredictions: number;
    avgReturnRate: number;
    popularStrategies: string[];
  }>> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return apiService.get(`/posts/analytics/${userId}`);
  }

  // Update post status (target reached, stop loss, etc.)
  async updatePostStatus(postId: string, status: {
    target_reached?: boolean;
    stop_loss_triggered?: boolean;
    closed?: boolean;
    last_price?: number;
    status_message?: string;
  }): Promise<ApiResponse<PostWithUser>> {
    if (!postId) {
      throw new Error('Post ID is required');
    }

    return apiService.patch<PostWithUser>(`/posts/${postId}/status`, status);
  }

  // Upload image for post
  async uploadPostImage(file: File, postId?: string): Promise<ApiResponse<{ url: string }>> {
    if (!file) {
      throw new Error('File is required');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum 5MB allowed.');
    }

    const additionalData = postId ? { postId } : {};
    return apiService.uploadFile<{ url: string }>('/posts/upload-image', file, additionalData);
  }
}

// Create and export service instance
export const postsService = new PostsService();