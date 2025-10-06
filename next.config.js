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
  // experimental config removed for Next.js 15 compatibility
  reactStrictMode: false,
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
