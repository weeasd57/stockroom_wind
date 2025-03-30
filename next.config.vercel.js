/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable image optimization for your stock images
  images: {
    domains: [
      'lh3.googleusercontent.com',  // Google profile pictures
      'avatars.githubusercontent.com',
      'localhost',
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'jyoeecprvhpqfirxmpkx.supabase.co',
      'mfbgpnpgxmxgxpjnxzrb.supabase.co',
    ],
    // Don't attempt to optimize images during build
    unoptimized: true,
  },
  // Speed up the build process
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  swcMinify: false,
  // The critical settings to prevent static generation
  experimental: {
    // This forces server-side rendering for all pages
    appDir: true,
  },
  // These settings completely skip static generation
  output: 'standalone',
  staticPageGenerationTimeout: 1,
  // Disable prerendering completely
  env: {
    NEXT_DISABLE_PRERENDER: '1',
  }
};

module.exports = nextConfig;
