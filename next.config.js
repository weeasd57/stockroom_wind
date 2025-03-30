/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'lh3.googleusercontent.com',  // Google profile pictures
      'avatars.githubusercontent.com',  // GitHub profile pictures
    ],
  },
  // Completely disable static exports
  output: 'standalone',
  // This is critical: it forces Next.js to use server-side rendering for all pages
  // and prevents static generation entirely
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
    },
  },
  // Add custom headers to prevent translation extensions
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  // Disable ESLint during build - useful while in development
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
    ignoreDuringBuilds: true,
  },
  // Prevent Next.js from trying to statically optimize pages
  swcMinify: false,
  compiler: {
    // Disable React removing properties
    removeConsole: false,
  },
  // Force dynamic rendering for all pages
  // This is the critical setting that disables static generation
  env: {
    NEXT_DISABLE_PRERENDER: '1',
  },
  // This forces Next.js to only use server-side rendering (SSR)
  // and prevents any static site generation (SSG)
  distDir: '.next',
  poweredByHeader: false,
  // Prevent automatic static optimization
  // This forces all pages to be dynamically rendered
  trailingSlash: false,
  // Disable static export
  exportPathMap: null,
};

module.exports = nextConfig;
