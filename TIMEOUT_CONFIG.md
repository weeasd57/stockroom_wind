# Timeout Configuration Guide

## Environment Variables

Add these environment variables to your `.env.local` file to configure timeout settings:

```bash
# Timeout Configuration
PRICE_CHECK_FETCH_TIMEOUT=30000  # 30 seconds for API calls
PRICE_CHECK_UPDATE_BATCH=10      # Batch size for updates
MAX_PRICE_CHECKS=365             # Maximum price checks to store

# Debug Configuration
PRICE_CHECK_DEBUG=false          # Enable debug logging
```

## Timeout Settings Explained

### API Routes
- **Post Creation**: 60 seconds timeout
- **Price Checking**: 5 minutes timeout (300 seconds)
- **Individual API Calls**: 30 seconds timeout

### Client-Side Components
- **Post Fetching**: 30 seconds timeout
- **Profile Loading**: 10 seconds timeout

## Error Handling

The application now includes comprehensive error handling for:
- Request timeouts
- Network errors
- API failures
- Dynamic routing issues

## Dynamic Routing Fixes

### Next.js 14 Compatibility
- Updated `useParams` usage to work with both props and hooks
- Added fallback mechanisms for parameter extraction
- Improved error handling for missing parameters

### API Routes
- Added timeout handling for all API routes
- Improved error messages for better user experience
- Added retry mechanisms for failed requests

## Performance Improvements

1. **Increased Timeouts**: Extended timeout periods to prevent premature failures
2. **Better Error Messages**: More descriptive error messages for users
3. **Retry Buttons**: Added retry functionality for failed requests
4. **Caching**: Improved caching mechanisms for better performance

## Testing

To test the timeout fixes:

1. Create a new post and monitor the console for timeout messages
2. Navigate to dynamic routes (e.g., `/posts/[id]`, `/view-profile/[id]`)
3. Check error handling by simulating network issues
4. Verify retry functionality works correctly

## Troubleshooting

If you still experience timeout issues:

1. Check your network connection
2. Verify API keys are correctly configured
3. Monitor server logs for specific error messages
4. Consider increasing timeout values if needed