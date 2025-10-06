/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'avatars.githubusercontent.com',
      'localhost',
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'jyoeecprvhpqfirxmpkx.supabase.co',
      'mfbgpnpgxmxgxpjnxzrb.supabase.co',
    ],
  },
  // Disable React StrictMode to prevent double-rendering which can worsen hydration issues
  reactStrictMode: false,
  // Add custom headers to prevent translation extensions
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Google-Translate', value: 'nope' },
          { key: 'x-translate', value: 'no' },
        ],
      },
    ]
  },
};

export default nextConfig;
