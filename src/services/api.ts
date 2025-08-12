import { ApiResponse, PaginatedResponse, NetworkError } from '@/types';

// Configuration
const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Error classes
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkTimeoutError extends ApiError {
  constructor(url: string) {
    super(`Request timeout for ${url}`, 408, 'TIMEOUT');
    this.name = 'NetworkTimeoutError';
  }
}

export class ServerError extends ApiError {
  constructor(message: string, status: number, details?: any) {
    super(message, status, 'SERVER_ERROR', details);
    this.name = 'ServerError';
  }
}

// Helper function to create network error
const createNetworkError = (url: string, status: number, message: string): NetworkError => ({
  code: 'NETWORK_ERROR',
  message,
  details: { url, status },
  timestamp: new Date().toISOString(),
  status,
  url,
});

// Sleep function for retry logic
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced fetch with timeout, retry, and error handling
export async function fetchWithRetry<T = any>(
  url: string,
  options: RequestInit = {},
  retries = API_CONFIG.retryAttempts
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  const fullUrl = url.startsWith('http') ? url : `${API_CONFIG.baseUrl}${url}`;

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Handle different response statuses
    if (response.status >= 200 && response.status < 300) {
      const data = await response.json();
      return {
        success: true,
        data,
        message: 'Request successful',
      };
    }

    // Handle client errors (4xx)
    if (response.status >= 400 && response.status < 500) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.message || `Client error: ${response.status}`,
        response.status,
        errorData.code,
        errorData
      );
    }

    // Handle server errors (5xx) - retry these
    if (response.status >= 500 && retries > 0) {
      console.warn(`Server error ${response.status}, retrying... (${retries} attempts left)`);
      await sleep(API_CONFIG.retryDelay);
      return fetchWithRetry(url, options, retries - 1);
    }

    // Final server error
    const errorData = await response.json().catch(() => ({}));
    throw new ServerError(
      errorData.message || `Server error: ${response.status}`,
      response.status,
      errorData
    );

  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NetworkTimeoutError(fullUrl);
    }

    // Handle network errors with retry
    if (error instanceof TypeError && retries > 0) {
      console.warn(`Network error, retrying... (${retries} attempts left)`);
      await sleep(API_CONFIG.retryDelay);
      return fetchWithRetry(url, options, retries - 1);
    }

    // Re-throw API errors
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle unknown errors
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      0,
      'UNKNOWN_ERROR'
    );
  }
}

// Simplified fetch function (for backward compatibility)
export async function fetchWithTimeout<T = any>(
  url: string,
  options: RequestInit = {},
  timeout = API_CONFIG.timeout
): Promise<T> {
  const result = await fetchWithRetry<T>(url, options);
  if (result.success) {
    return result.data as T;
  }
  throw new Error(result.error || 'Request failed');
}

// API service class
export class ApiService {
  private baseUrl: string;

  constructor(baseUrl = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  // GET request
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(endpoint, this.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return fetchWithRetry<T>(url.toString(), {
      method: 'GET',
    });
  }

  // POST request
  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PATCH request
  async patch<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
    });
  }

  // Paginated GET request
  async getPaginated<T = any>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<PaginatedResponse<T>> {
    const response = await this.get<T[]>(endpoint, params);
    
    // Assume the API returns pagination data in headers or response
    // This should be adjusted based on your actual API structure
    return {
      ...response,
      meta: {
        page: Number(params?.page) || 1,
        limit: Number(params?.limit) || 10,
        total: 0, // Should be provided by API
        totalPages: 0, // Should be calculated by API
        hasNext: false, // Should be provided by API
        hasPrev: false, // Should be provided by API
      },
    };
  }

  // File upload
  async uploadFile<T = any>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    return fetchWithRetry<T>(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it
      },
    });
  }
}

// Default API service instance
export const apiService = new ApiService();

// Export utility functions
export { API_CONFIG };

// Specific error handler for React components
export const handleApiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

// Type guard for API errors
export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError;
};

// Type guard for network errors
export const isNetworkError = (error: unknown): error is NetworkTimeoutError => {
  return error instanceof NetworkTimeoutError;
};