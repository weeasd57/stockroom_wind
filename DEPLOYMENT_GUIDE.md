# SharksZone - Deployment Guide

## 🚀 Environment Variables Setup

Before deploying, you need to configure the following environment variables. Copy `.env.example` to `.env.local` and update the values:

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application Configuration
NEXTAUTH_SECRET=your-secure-random-secret
NEXTAUTH_URL=https://your-domain.com

# API Keys (Optional but recommended)
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-api-key
FINNHUB_API_KEY=your-finnhub-api-key
NEXT_PUBLIC_EOD_API_KEY=your-eod-historical-data-api-key

# Database Configuration (if using direct connection)
DATABASE_URL=your-postgres-connection-string
```

## 🔧 Required Supabase Setup

### 1. Database Tables
Ensure your Supabase database has the following tables:

- `profiles` - User profiles
- `posts` - Trading posts
- `post_comments` - Comments on posts
- `post_buy_votes` - Buy vote tracking
- `post_sell_votes` - Sell vote tracking
- `user_followings` - Following relationships
- `user_strategies` - User trading strategies

### 2. Storage Buckets
Create the following storage buckets in Supabase:

- `avatars` - User profile pictures
- `backgrounds` - Profile background images
- `post_images` - Post image uploads

### 3. RLS Policies
Make sure to set up Row Level Security (RLS) policies for:

- User data protection
- Post access control
- Comment permissions
- File upload security

## 🌟 New Features Included

### ✅ Enhanced Home Feed
- **Following-only posts**: Home page now shows posts from followed users by default
- **Advanced filtering**: Sort by date, engagement, price movement
- **Category filters**: Buy signals, sell signals, analysis
- **Real-time updates**: Live updates via Supabase subscriptions

### ✅ Improved User Experience
- **Smart authentication**: Automatic redirect to profile for logged-in users
- **Faster posting**: Optimistic updates for instant feedback
- **Centered comments**: Dialog perfectly centered on screen
- **Error handling**: Robust error recovery for trader profiles

### ✅ Responsive Design
- **Mobile-first**: Optimized for all screen sizes
- **Touch-friendly**: Larger tap targets on mobile
- **Flexible layouts**: Adaptive grid and flexbox layouts
- **Responsive text**: Scalable typography across devices

### ✅ Performance Improvements
- **Direct Supabase integration**: Reduced API overhead
- **Intelligent caching**: Smart cache management with TTL
- **Retry mechanisms**: Automatic retry for failed requests
- **Background sync**: Resilient posting with background retries

## 🚦 Deployment Steps

### 1. Vercel Deployment (Recommended)

1. **Connect your repository** to Vercel
2. **Add environment variables** in Vercel dashboard
3. **Deploy** - Vercel will automatically build and deploy

### 2. Manual Deployment

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start production server
npm start
```

### 3. Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔍 Build Verification

To verify your build locally:

```bash
# Run type checking
npm run lint

# Build the application
npm run build

# Test the build
npm start
```

## 🛠️ Troubleshooting

### Common Issues:

1. **Supabase Connection Errors**
   - Verify your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Check RLS policies are properly configured

2. **Build Failures**
   - Ensure all environment variables are set
   - Check for TypeScript errors: `npm run lint`

3. **Missing Features**
   - Verify database schema matches requirements
   - Check storage buckets are created and accessible

### Performance Monitoring:

The application includes built-in performance monitoring for:
- Database query times
- Image upload speeds
- Cache hit rates
- User interaction response times

## 📊 Database Schema Updates

If upgrading from a previous version, you may need to run:

```sql
-- Add sentiment column to posts (if not exists)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'neutral';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_sentiment ON posts(sentiment);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_followings_follower ON user_followings(follower_id);
```

## 🔐 Security Notes

- Always use environment variables for sensitive data
- Enable RLS on all Supabase tables
- Regularly rotate API keys
- Monitor for unusual access patterns
- Keep dependencies updated

## 📞 Support

For deployment issues or questions:
1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review Supabase documentation
3. Verify environment variable configuration

---

**Last Updated**: December 2024  
**Version**: 2.0.0 with Enhanced Features