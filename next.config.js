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
  // Disable RSC prefetching to prevent ?_rsc= requests
  experimental: {
    serverComponentsExternalPackages: [],
    optimizePackageImports: [],
  },
  // Disable prefetching globally
  trailingSlash: false,
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
}

module.exports = nextConfig
