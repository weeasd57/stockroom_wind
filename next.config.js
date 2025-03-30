/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com',  // Google profile pictures
      'avatars.githubusercontent.com', // GitHub profile pictures (if you use GitHub auth)
      'localhost', // Local development
      'firebasestorage.googleapis.com', // In case you use Firebase storage
      'storage.googleapis.com', // Google Cloud Storage
      'jyoeecprvhpqfirxmpkx.supabase.co', // Supabase storage
      'mfbgpnpgxmxgxpjnxzrb.supabase.co', // Additional Supabase storage
    ],
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
    },
  },
  // Disable React StrictMode to prevent double-rendering which can worsen hydration issues
  reactStrictMode: false,
  // Add custom headers to prevent translation extensions
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Google-Translate',
            value: 'nope',
          },
          {
            key: 'x-translate',
            value: 'no',
          },
        ],
      },
    ]
  },
  // Skip type checking during builds for faster builds
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during builds for faster builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Prevent Next.js from trying to statically optimize pages
  swcMinify: false,
  compiler: {
    // Disable React removing properties
    removeConsole: false,
  },
}

module.exports = nextConfig
