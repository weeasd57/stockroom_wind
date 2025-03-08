/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com',  // Google profile pictures
      'avatars.githubusercontent.com', // GitHub profile pictures (if you use GitHub auth)
      'localhost', // Local development
      'firebasestorage.googleapis.com', // In case you use Firebase storage
      'storage.googleapis.com', // Google Cloud Storage
    ],
  },
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
