"use client";

import dynamic from 'next/dynamic';

// Create dynamic imports for client-side only components that use browser APIs

// Dynamic import of the auth provider, with no SSR
export const DynamicAuthProvider = dynamic(
  () => import('@/hooks/useAuth').then(mod => ({ default: mod.AuthProvider })),
  { ssr: false }
);

// Dynamic import of the theme provider, with no SSR
export const DynamicThemeProvider = dynamic(
  () => import('@/components/theme-provider').then(mod => ({ default: mod.ThemeProvider })),
  { ssr: false }
);

// Dynamic import of the profile provider, with no SSR
export const DynamicProfileProvider = dynamic(
  () => import('@/contexts/ProfileContext').then(mod => ({ default: mod.ProfileProvider })),
  { ssr: false }
);

// Dynamic import of the Supabase provider, with no SSR
export const DynamicSupabaseProvider = dynamic(
  () => import('@/hooks/useSupabase').then(mod => ({ default: mod.SupabaseProvider })),
  { ssr: false }
);

// Dynamic import of the PostForm provider, with no SSR
export const DynamicPostFormProvider = dynamic(
  () => import('@/contexts/PostFormContext').then(mod => ({ default: mod.PostFormProvider })),
  { ssr: false }
);

// Dynamic import of the client-side layout, with no SSR
export const DynamicClientSideLayout = dynamic(
  () => import('@/components/ClientSideLayout').then(mod => ({ default: mod.ClientSideLayout })),
  { ssr: false }
);

// Dynamic import of the client image preloader, with no SSR
export const DynamicClientImagePreloader = dynamic(
  () => import('@/components/ClientImagePreloader'),
  { ssr: false }
);
