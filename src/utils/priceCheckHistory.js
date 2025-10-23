// Enhanced utility to manage price check history in localStorage + Supabase integration

const PRICE_CHECK_HISTORY_KEY = 'priceCheckHistory';
const SUPABASE_HISTORY_CACHE_KEY = 'supabasePriceCheckHistory';
const MAX_HISTORY_ENTRIES = 50; // Limit to last 50 entries
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const savePriceCheckResult = (result) => {
  try {
    const historyEntry = {
      id: `price_check_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'price_check',
      title: `Check Post Prices - ${new Date().toLocaleDateString()}`,
      ...result,
      // Add user-friendly metadata
      summary: {
        checkedPosts: result.checkedPosts || 0,
        updatedPosts: result.updatedPosts || 0,
        remainingChecks: result.remainingChecks || 0,
        usageCount: result.usageCount || 0
      }
    };

    console.log('[PriceCheckHistory] 💾 Saving price check result:', historyEntry);

    // Get existing history
    const existingHistory = getPriceCheckHistory();
    
    // Add new entry at the beginning
    const updatedHistory = [historyEntry, ...existingHistory];
    
    // Limit to MAX_HISTORY_ENTRIES
    const limitedHistory = updatedHistory.slice(0, MAX_HISTORY_ENTRIES);
    
    // Save to localStorage
    localStorage.setItem(PRICE_CHECK_HISTORY_KEY, JSON.stringify(limitedHistory));
    
    console.log(`[PriceCheckHistory] ✅ Saved to localStorage. Total entries: ${limitedHistory.length}`);
    
    return historyEntry.id;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to save price check result:', error);
    return null;
  }
};

export const getPriceCheckHistory = () => {
  try {
    const stored = localStorage.getItem(PRICE_CHECK_HISTORY_KEY);
    if (!stored) {
      console.log('[PriceCheckHistory] 📭 No history found in localStorage');
      return [];
    }
    
    const parsed = JSON.parse(stored);
    console.log(`[PriceCheckHistory] 📚 Loaded ${parsed.length} entries from localStorage`);
    
    return parsed.filter(entry => entry && entry.id); // Filter out invalid entries
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to load price check history:', error);
    return [];
  }
};

export const deletePriceCheckEntry = (entryId) => {
  try {
    const history = getPriceCheckHistory();
    const updatedHistory = history.filter(entry => entry.id !== entryId);
    
    localStorage.setItem(PRICE_CHECK_HISTORY_KEY, JSON.stringify(updatedHistory));
    console.log(`[PriceCheckHistory] 🗑️ Deleted entry ${entryId}`);
    
    return true;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to delete entry:', error);
    return false;
  }
};

export const clearPriceCheckHistory = () => {
  try {
    localStorage.removeItem(PRICE_CHECK_HISTORY_KEY);
    console.log('[PriceCheckHistory] 🧹 Cleared all price check history');
    return true;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to clear history:', error);
    return false;
  }
};

export const getPriceCheckStatistics = () => {
  try {
    const history = getPriceCheckHistory();
    
    if (history.length === 0) {
      return {
        totalChecks: 0,
        totalPostsChecked: 0,
        totalPostsUpdated: 0,
        averageUpdatesPerCheck: 0,
        lastCheckDate: null,
        checksThisWeek: 0,
        checksThisMonth: 0
      };
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      totalChecks: history.length,
      totalPostsChecked: history.reduce((sum, entry) => sum + (entry.summary?.checkedPosts || 0), 0),
      totalPostsUpdated: history.reduce((sum, entry) => sum + (entry.summary?.updatedPosts || 0), 0),
      averageUpdatesPerCheck: 0,
      lastCheckDate: history[0]?.timestamp || null,
      checksThisWeek: history.filter(entry => new Date(entry.timestamp) > oneWeekAgo).length,
      checksThisMonth: history.filter(entry => new Date(entry.timestamp) > oneMonthAgo).length
    };

    stats.averageUpdatesPerCheck = stats.totalChecks > 0 
      ? (stats.totalPostsUpdated / stats.totalChecks).toFixed(2)
      : 0;

    return stats;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to calculate statistics:', error);
    return null;
  }
};

// Fetch price check history from Supabase
export const fetchSupabasePriceCheckHistory = async (userId, days = 30) => {
  try {
    console.log(`[PriceCheckHistory] 🔄 Fetching Supabase history for user ${userId}`);
    
    // Check cache first
    const cacheKey = `${SUPABASE_HISTORY_CACHE_KEY}_${userId}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      console.log(`[PriceCheckHistory] 📦 Using cached Supabase data (${cached.length} entries)`);
      return cached;
    }

    const response = await fetch(`/api/price-check-history?userId=${userId}&days=${days}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch history');
    }

    const activities = data.activities || [];
    
    if (data.fallback) {
      console.log(`[PriceCheckHistory] ⚠️ ${data.message}, returning empty Supabase data`);
    } else {
      console.log(`[PriceCheckHistory] ✅ Fetched ${activities.length} activities from Supabase`);
      // Only cache successful non-fallback results
      setCachedData(cacheKey, activities);
    }
    
    return activities;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to fetch Supabase history:', error);
    
    // If it's a 404 error, the API route might not be available
    if (error.message.includes('404')) {
      console.warn('[PriceCheckHistory] ⚠️ API route not found, server might need restart');
    }
    
    return [];
  }
};

// Get combined history from localStorage + Supabase
export const getCombinedPriceCheckHistory = async (userId) => {
  try {
    // Get localStorage history
    const localHistory = getPriceCheckHistory();
    
    // Get Supabase history
    const supabaseHistory = userId ? await fetchSupabasePriceCheckHistory(userId) : [];
    
    // Combine and deduplicate by ID
    const combined = [...localHistory];
    const localIds = new Set(localHistory.map(h => h.id));
    
    supabaseHistory.forEach(item => {
      if (!localIds.has(item.id)) {
        combined.push({
          ...item,
          source: 'supabase'
        });
      }
    });
    
    // Sort by timestamp (newest first)
    combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    console.log(`[PriceCheckHistory] 📚 Combined history: ${localHistory.length} local + ${supabaseHistory.length} remote = ${combined.length} total`);
    
    return combined;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to get combined history:', error);
    return getPriceCheckHistory(); // Fallback to localStorage only
  }
};

// Cache management utilities
const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const now = Date.now();
    
    if (parsed.timestamp && (now - parsed.timestamp) < CACHE_DURATION) {
      return parsed.data;
    }
    
    // Cache expired, remove it
    localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Cache read error:', error);
    return null;
  }
};

const setCachedData = (key, data) => {
  try {
    const cacheEntry = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
    console.log(`[PriceCheckHistory] 💾 Cached ${data.length} entries for ${key}`);
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Cache write error:', error);
  }
};

// Clear all caches
export const clearPriceCheckCaches = () => {
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(SUPABASE_HISTORY_CACHE_KEY)
    );
    
    keys.forEach(key => localStorage.removeItem(key));
    console.log(`[PriceCheckHistory] 🧹 Cleared ${keys.length} cache entries`);
    
    return true;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to clear caches:', error);
    return false;
  }
};

// Enhanced function to trigger Telegram notifications for historical data
export const triggerHistoricalTelegramNotifications = async (userId, historyEntries = []) => {
  try {
    if (!historyEntries.length) {
      console.log('[PriceCheckHistory] 📭 No history entries to process for Telegram');
      return { success: true, sent: 0 };
    }

    console.log(`[PriceCheckHistory] 📢 Processing ${historyEntries.length} entries for Telegram notifications`);
    
    let sentCount = 0;
    
    for (const entry of historyEntries) {
      if (!entry.posts || !entry.posts.length) continue;
      
      // Only send notifications for entries with significant updates
      const significantPosts = entry.posts.filter(post => 
        post.target_reached || post.stop_loss_triggered
      );
      
      if (significantPosts.length === 0) continue;
      
      try {
        const response = await fetch('/api/telegram/send-broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            postIds: significantPosts.map(p => p.id),
            title: `Historical Price Update - ${new Date(entry.timestamp).toLocaleDateString()}`,
            comment: `Automated notification for ${significantPosts.length} posts with price targets/stop losses triggered`,
            isHistoricalNotification: true
          }),
          credentials: 'include'
        });

        if (response.ok) {
          sentCount++;
          console.log(`[PriceCheckHistory] ✅ Sent Telegram notification for entry ${entry.id}`);
        } else {
          console.warn(`[PriceCheckHistory] ⚠️ Failed to send Telegram for entry ${entry.id}`);
        }
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (telegramError) {
        console.error(`[PriceCheckHistory] ❌ Telegram error for entry ${entry.id}:`, telegramError);
      }
    }
    
    console.log(`[PriceCheckHistory] 📊 Telegram notifications complete: ${sentCount}/${historyEntries.length} sent`);
    
    return { success: true, sent: sentCount, total: historyEntries.length };
    
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to trigger historical Telegram notifications:', error);
    return { success: false, error: error.message };
  }
};

export const exportPriceCheckHistory = () => {
  try {
    const history = getPriceCheckHistory();
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `price_check_history_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('[PriceCheckHistory] 📤 Exported price check history');
    return true;
  } catch (error) {
    console.error('[PriceCheckHistory] ❌ Failed to export history:', error);
    return false;
  }
};
