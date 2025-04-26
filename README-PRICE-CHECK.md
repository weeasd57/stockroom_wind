# Stock Price Checking System Documentation

## Overview

The Stock Price Checking system automatically monitors stock prices for user posts and determines if target prices or stop-loss thresholds have been reached. This document explains how the system works, especially the date comparison logic to handle various edge cases.

## Price Check Process

1. **Triggering a Check**:
   - Automatic background updates every 2 minutes
   - Manual check via the "Check Post Prices" button
   - Limited to 100 checks per day per user

2. **Data Retrieval**:
   - Fetches EOD (End of Day) stock data from the financial API
   - Gets historical data from post creation date to current date
   - Includes fallback mechanisms for API failures

3. **Date Comparison Logic**:
   - Compares post creation date with latest available price data date
   - Handles cases where price data might not be available yet

4. **Price Analysis**:
   - Checks if target price has been reached (using high price)
   - Checks if stop-loss has been triggered (using low price)
   - Calculates percentage to target and other metrics

5. **Database Update**:
   - Updates post with latest price data and status flags
   - Updates user experience score when targets or stop-losses are hit

## Special Cases Handling

### 1. Post Created After Latest Price Data

**Scenario**: A user creates a post after the most recent available price data (e.g., post created on weekend or after market hours when no new data is available yet).

**Handling**:
- System compares `postDateOnly > lastPriceDateStr`
- Sets `postDateAfterPriceDate: true` flag on the post
- Displays warning: "Post created after latest price data - can't check target/stop loss"
- Skips price comparison for this post until newer data becomes available

### 2. Post Created After Market Close (Same Day)

**Scenario**: A user creates a post on the same day as the latest price data, but after market close (typically after 4 PM / 16:00).

**Handling**:
- System checks `postTimeHours >= marketCloseHour` (where marketCloseHour = 16)
- Sets `postAfterMarketClose: true` flag on the post
- Displays warning: "Post created after market close - recent price data not available"
- Skips price comparison for this post until next day's data becomes available

### 3. No Data Available

**Scenario**: No historical price data could be retrieved for the stock (API failure, unknown symbol, etc.).

**Handling**:
- Sets `noDataAvailable: true` flag on the post
- Displays error: "No price data available for this stock"
- Continues to attempt retrieval on subsequent checks

## Fallback Mechanisms

1. **Previous Day Fallback**:
   - If current date data is unavailable, tries up to 5 previous days
   - Gradually walks back to find the most recent data point

2. **Last Close Price Fallback**:
   - If historical data API fails, attempts to get just the last closing price

3. **Current Price Fallback**:
   - If all API calls fail, uses the post's stored current_price value

## UI Indicators

Different status messages are displayed to the user based on the check results:

- **Regular Updates**: "Last price update: [date]" with blue styling
- **Date Mismatch Warnings**: Yellow warning messages with relevant explanation
- **No Data Error**: Red error message indicating data unavailability

## User Experience Scoring

When posts are closed due to hitting targets or stop-losses:

- **Target Reached**: Increases user's success_posts count and experience score
- **Stop Loss Triggered**: Increases user's loss_posts count and decreases experience score

## Technical Implementation

The implementation relies on:

1. **Database Columns**:
   - `postDateAfterPriceDate` (boolean): Indicates post date is after latest price data
   - `postAfterMarketClose` (boolean): Indicates post created after market close
   - `noDataAvailable` (boolean): Indicates no price data could be retrieved

2. **Post Card UI Components**:
   - Warning messages with appropriate styling for each case
   - Color-coded indicators for different statuses
   - Target progress visualization

## Recommendations for Users

- Create posts during market hours for immediate price checking
- Ensure correct stock symbols and exchanges are used
- Check back the following business day if warnings about timing appear

## Under the Hood

The system balances multiple aspects:
- Accurate price checking
- Handling of incomplete/unavailable data
- Clear user feedback on status
- Preventing false positives/false negatives in target/stop-loss detection 