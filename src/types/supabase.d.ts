declare module '@/utils/supabase' {
  import type { SupabaseClient, User } from '@supabase/supabase-js';

  // The runtime module is implemented in JS and exposes these symbols.
  // This declaration gives TypeScript consumers proper types.
  export const supabase: SupabaseClient;
  export function getSupabaseClient(): SupabaseClient;

  // Shared result types
  export interface GetPostsResult {
    data: any[];
    error: any | null;
    hasMorePages: boolean;
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }

  export interface GetUserPostsResult {
    posts: any[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    error?: any;
  }

  // Auth
  export const signUp: (
    email: string,
    password: string,
    userData?: Record<string, any>
  ) => Promise<{ data: any; error: Error | null }>;

  export const signIn: (
    email: string,
    password: string
  ) => Promise<{ data: any; error: Error | null }>;

  export const signOut: (router?: any) => Promise<{ error: any }>;

  export const getCurrentUser: () => Promise<User | null>;

  // Profiles
  export const getUserProfile: (
    userId: string
  ) => Promise<{ data: any; error: any }>;

  export const updateUserProfile: (
    userId: string,
    updates: Record<string, any>
  ) => Promise<{ data: any; error: any }>;

  // Storage
  export const uploadImage: (
    file: File,
    bucket: string,
    userId: string,
    fileType?: string,
    options?: Record<string, any>
  ) => Promise<{ data: any; publicUrl: string | null; error: any }>;

  export const getBackgroundImageUrl: (userId: string) => Promise<string>;

  export const getAvatarImageUrl: (userId: string) => Promise<string>;

  export const checkFileExists: (
    bucket: string,
    path: string
  ) => Promise<boolean>;

  export function uploadPostImage(
    file: File,
    userId: string
  ): Promise<{ publicUrl: string | null; error: any }>;

  // Diagnostics / setup
  export function checkTableExists(tableName: string): Promise<boolean>;

  export function checkSupabaseConnection(): Promise<boolean>;

  export function invalidatePostsCache(): void;

  export const clearPostCache: () => void;

  // Posts
  export function getPosts(
    page?: number,
    limit?: number,
    signal?: AbortSignal
  ): Promise<GetPostsResult>;

  export function getUserPosts(
    userId: string,
    page?: number,
    limit?: number,
    signal?: AbortSignal,
    strategy?: string | null
  ): Promise<GetUserPostsResult>;

  export function createPost(
    post: Record<string, any>,
    userId: string
  ): Promise<{ data: any[] | null; error: any | null }>;

  // Strategies
  export function getUserStrategies(userId: string): Promise<any[]>;

  export function createUserStrategy(
    userId: string,
    strategyName: string
  ): Promise<any>;

  // Social (follow)
  export const followUser: (
    followerId: string,
    followingId: string
  ) => Promise<{ data: any; error: any }>;

  export const unfollowUser: (
    followerId: string,
    followingId: string
  ) => Promise<{ data: any; error: any }>;

  export const getFollowers: (
    userId: string
  ) => Promise<{ data: any[]; error: any | null }>;

  export const getFollowing: (
    userId: string
  ) => Promise<{ data: any[]; error: any | null }>;

  // Single post
  export const getPostById: (
    postId: string
  ) => Promise<{ data: any | null; error: any | null }>;
}
