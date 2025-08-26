# Real-Time Price Updates Setup Guide

This guide will help you configure the real-time price checking and data display functionality for your trading posts application.

## 🔧 Environment Configuration

### 1. Update your `.env.local` file

Replace the placeholder values in your `.env.local` file with your actual Supabase credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# For server-side operations (check-prices API)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# EOD Historical Data API (for price checking)
NEXT_PUBLIC_EOD_API_KEY=your-eod-api-key-here

# Price check debug and configuration
PRICE_CHECK_DEBUG=1
PRICE_CHECK_FETCH_TIMEOUT=12000
PRICE_CHECK_UPSERT_BATCH=100
MAX_PRICE_CHECKS=365
```

### 2. Where to find your Supabase keys:

1. **NEXT_PUBLIC_SUPABASE_URL**: Go to your Supabase project → Settings → API → Project URL
2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Go to your Supabase project → Settings → API → Project API keys → `anon` `public`
3. **SUPABASE_SERVICE_ROLE_KEY**: Go to your Supabase project → Settings → API → Project API keys → `service_role` `secret`

⚠️ **Important**: The `service_role` key has admin privileges. Keep it secure and never expose it in client-side code.

## 🎯 Features Implemented

### ✅ Fixed Issues:
- **Supabase API Key Error**: Fixed the incorrect environment variable reference in the check-prices API route
- **Missing Service Role Key**: Added proper service role key configuration for admin operations
- **Environment Variables**: Created proper `.env.local` file with all required variables

### ✅ New Features:
1. **Real-Time Price Updates Component**: 
   - Displays posts organized by exchange/provider
   - Auto-refresh functionality (10s, 30s, 1m, 5m intervals)
   - Real-time Supabase subscriptions for instant updates
   - Visual indicators for price changes and status

2. **Enhanced Data Display**:
   - Group posts by Exchange, Status, or Strategy
   - Color-coded status indicators (Green: Target Reached, Red: Stop Loss, Blue: Active, Gray: Closed)
   - Price change percentages with up/down indicators
   - Last checked timestamps
   - Achievement badges for reached targets/stop losses

3. **Improved Price Checking**:
   - Better error handling and user feedback
   - Custom events for component communication
   - Automatic data refresh after price checks
   - No page reload required

## 📊 Usage Instructions

### 1. Using the Real-Time Updates Component

Add the component to any page where you want to display real-time price updates:

```jsx
import RealTimePriceUpdates from '@/components/profile/RealTimePriceUpdates';

function YourPage() {
  const { user } = useAuth(); // Your auth context
  
  return (
    <div>
      <RealTimePriceUpdates userId={user?.id} />
    </div>
  );
}
```

### 2. Features Available:

#### **Grouping Options:**
- **By Exchange**: Groups posts by stock exchange (NYSE, NASDAQ, etc.)
- **By Status**: Groups by trading status (Active, Target Reached, Stop Loss Triggered, Closed)
- **By Strategy**: Groups by your defined trading strategies

#### **Auto-Refresh:**
- Toggle auto-refresh on/off
- Choose refresh intervals: 10s, 30s, 1m, 5m
- Manual refresh button available

#### **Real-Time Updates:**
- Automatic updates when data changes in Supabase
- No page reload required
- Visual indicators for new updates

### 3. Price Checking Process:

1. Click "📈 Check Post Prices" button
2. System fetches latest prices from EOD Historical Data API
3. Compares prices against your target and stop-loss levels
4. Updates post status automatically
5. Real-time component refreshes instantly
6. Experience score updated for closed positions

## 🔍 Data Structure

The system uses all columns from your posts table:

```sql
-- Key columns used for price checking and display:
id, symbol, company_name, exchange, current_price, target_price, 
stop_loss_price, target_reached, stop_loss_triggered, closed, 
strategy, last_price_check, status_message, price_checks,
target_reached_date, stop_loss_triggered_date, high_price
```

## 🚀 Getting Started

1. **Update Environment Variables**: Copy your Supabase keys to `.env.local`
2. **Restart Your Development Server**: `npm run dev` or `yarn dev`
3. **Test the Connection**: Try the "Check Post Prices" functionality
4. **Add Real-Time Component**: Include `<RealTimePriceUpdates userId={userId} />` in your UI
5. **Configure Grouping**: Choose how you want to organize your data display

## 🛠️ Troubleshooting

### Common Issues:

1. **"Invalid API key" Error**:
   - Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly
   - Ensure the service role key is the secret one, not the public one

2. **Real-time Updates Not Working**:
   - Verify Supabase URL and anon key are correct
   - Check browser console for connection errors
   - Ensure RLS policies allow reading posts

3. **Price Check Fails**:
   - Verify `NEXT_PUBLIC_EOD_API_KEY` is set
   - Check that your EOD Historical Data API subscription is active
   - Review the debug logs (set `PRICE_CHECK_DEBUG=1`)

4. **No Data Displayed**:
   - Ensure you have posts in your database
   - Check that `userId` is passed correctly to the component
   - Verify RLS policies allow the user to read their posts

## 📈 Next Steps

The system is now configured for:
- ✅ Real-time price updates without page reload
- ✅ Data organized by provider/exchange
- ✅ Automatic refresh and live subscriptions
- ✅ Enhanced user experience with visual indicators
- ✅ Proper error handling and user feedback

You can now:
1. Create trading posts with target and stop-loss prices
2. Use "Check Post Prices" to update all positions
3. View real-time updates organized by exchange/status/strategy
4. Monitor your portfolio performance without manual refreshes

## 🔐 Security Notes

- Service role key is used only server-side for admin operations
- Client-side uses anon key with RLS policies for security
- Real-time subscriptions respect your database security rules
- All environment variables are properly configured for Next.js