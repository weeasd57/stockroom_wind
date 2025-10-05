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
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
    },
    // Enable dynamic routing optimizations for Next.js 14
    dynamicIO: true,
    // Enable better error handling for dynamic routes
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  // Disable React StrictMode to prevent double-rendering which can worsen hydration issues
  reactStrictMode: false,
  // Add timeout configuration for API routes
  api: {
    responseLimit: '8mb',
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
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
}

module.exports = nextConfig
