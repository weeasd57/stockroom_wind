/**
 * Performance Monitor - مراقب الأداء لتتبع API calls ومنع Memory Leaks
 * يراقب عدد الاستدعاءات ويمنع الإفراط في الطلبات
 */

class PerformanceMonitor {
  constructor() {
    this.apiCalls = [];
    this.subscriptions = new Map();
    this.maxApiCalls = 100; // حد أقصى للـ API calls
    this.maxSubscriptions = 20; // حد أقصى للاشتراكات
    this.resetInterval = 60000; // دقيقة واحدة
    this.warningThreshold = 80; // تحذير عند 80% من الحد الأقصى
    
    // تنظيف دوري للعدادات
    this.cleanupInterval = setInterval(() => {
      this.resetCounters();
    }, this.resetInterval);
    
    // تتبع الذاكرة إذا كان متاح
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      this.memoryCheckInterval = setInterval(() => {
        this.checkMemoryUsage();
      }, 30000); // كل 30 ثانية
    }
  }
  
  /**
   * تتبع API call جديد
   */
  trackApiCall(endpoint, method = 'GET') {
    const now = Date.now();
    const callInfo = { 
      endpoint, 
      method,
      timestamp: now,
      id: `${endpoint}-${method}-${now}-${Math.random().toString(36).substr(2, 5)}`
    };
    
    this.apiCalls.push(callInfo);
    
    // تحذير إذا اقتربنا من الحد الأقصى
    if (this.apiCalls.length > this.warningThreshold) {
      console.warn(`⚠️ High API usage: ${this.apiCalls.length}/${this.maxApiCalls} calls`);
      this.logApiCallsSummary();
    }
    
    // إيقاف مؤقت إذا تجاوزنا الحد
    if (this.apiCalls.length > this.maxApiCalls) {
      console.error(`🛑 API call limit exceeded: ${this.apiCalls.length}`);
      this.logApiCallsSummary();
      this.throttleApiCalls();
      return false; // منع الاستدعاء
    }
    
    return callInfo.id;
  }
  
  /**
   * تتبع subscription جديد
   */
  trackSubscription(channelName, type = 'supabase') {
    const subscriptionInfo = {
      channelName,
      type,
      timestamp: Date.now(),
      id: `${channelName}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };
    
    this.subscriptions.set(subscriptionInfo.id, subscriptionInfo);
    
    // تحذير إذا كان عدد الاشتراكات كثير
    if (this.subscriptions.size > this.warningThreshold / 4) {
      console.warn(`⚠️ High subscription count: ${this.subscriptions.size}/${this.maxSubscriptions}`);
      this.logSubscriptionsSummary();
    }
    
    if (this.subscriptions.size > this.maxSubscriptions) {
      console.error(`🛑 Subscription limit exceeded: ${this.subscriptions.size}`);
      this.logSubscriptionsSummary();
      // لا نمنع الاشتراك لكن نحذر
    }
    
    return subscriptionInfo.id;
  }
  
  /**
   * إزالة subscription عند إلغائه
   */
  removeSubscription(subscriptionId) {
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
      console.log(`✅ Subscription removed: ${subscriptionId}`);
    }
  }
  
  /**
   * إيقاف مؤقت للـ API calls
   */
  throttleApiCalls() {
    const throttleDuration = 5000; // 5 ثواني
    console.log(`🛑 Throttling API calls for ${throttleDuration/1000} seconds...`);
    
    if (typeof window !== 'undefined') {
      window.__API_THROTTLED = true;
      window.__API_THROTTLE_START = Date.now();
      
      setTimeout(() => {
        window.__API_THROTTLED = false;
        delete window.__API_THROTTLE_START;
        console.log('✅ API throttling lifted');
      }, throttleDuration);
    }
  }
  
  /**
   * فحص حالة الـ throttling
   */
  isThrottled() {
    if (typeof window === 'undefined') return false;
    return window.__API_THROTTLED === true;
  }
  
  /**
   * تنظيف العدادات القديمة
   */
  resetCounters() {
    const now = Date.now();
    const cutoff = now - this.resetInterval;
    
    // تنظيف API calls القديمة
    const oldApiCallsCount = this.apiCalls.length;
    this.apiCalls = this.apiCalls.filter(call => call.timestamp > cutoff);
    
    // تنظيف subscriptions القديمة (أكثر من 10 دقائق)
    const subscriptionCutoff = now - (10 * 60 * 1000);
    let removedSubscriptions = 0;
    
    for (const [id, sub] of this.subscriptions.entries()) {
      if (sub.timestamp < subscriptionCutoff) {
        this.subscriptions.delete(id);
        removedSubscriptions++;
      }
    }
    
    // Only log cleanup if something was actually cleaned
    if (process.env.NODE_ENV === 'development') {
      const removedApiCalls = oldApiCallsCount - this.apiCalls.length;
      if (removedApiCalls > 0 || removedSubscriptions > 0) {
        console.log(`🧹 Cleanup: Removed ${removedApiCalls} old API calls, ${removedSubscriptions} old subscriptions`);
      }
    }
  }
  
  /**
   * فحص استخدام الذاكرة
   */
  checkMemoryUsage() {
    if (typeof window === 'undefined' || !window.performance?.memory) return;
    
    const memory = window.performance.memory;
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
    const usagePercent = Math.round((usedMB / limitMB) * 100);
    
    if (usagePercent > 80) {
      console.warn(`🧠 High memory usage: ${usedMB}MB (${usagePercent}%)`);
      this.logMemoryDetails();
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`💾 Memory: ${usedMB}MB/${limitMB}MB (${usagePercent}%)`);
    }
  }
  
  /**
   * عرض تفاصيل الذاكرة
   */
  logMemoryDetails() {
    if (typeof window === 'undefined' || !window.performance?.memory) return;
    
    const memory = window.performance.memory;
    console.table({
      'Used Heap': `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
      'Total Heap': `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
      'Heap Limit': `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
    });
  }
  
  /**
   * عرض ملخص API calls
   */
  logApiCallsSummary() {
    const grouped = this.apiCalls.reduce((acc, call) => {
      const key = `${call.method} ${call.endpoint}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 API Calls Summary:');
    console.table(grouped);
  }
  
  /**
   * عرض ملخص Subscriptions
   */
  logSubscriptionsSummary() {
    const grouped = {};
    for (const sub of this.subscriptions.values()) {
      const key = `${sub.type}: ${sub.channelName}`;
      grouped[key] = (grouped[key] || 0) + 1;
    }
    
    console.log('📡 Subscriptions Summary:');
    console.table(grouped);
  }
  
  /**
   * الحصول على إحصائيات شاملة
   */
  getStats() {
    return {
      apiCalls: {
        count: this.apiCalls.length,
        limit: this.maxApiCalls,
        percentage: Math.round((this.apiCalls.length / this.maxApiCalls) * 100)
      },
      subscriptions: {
        count: this.subscriptions.size,
        limit: this.maxSubscriptions,
        percentage: Math.round((this.subscriptions.size / this.maxSubscriptions) * 100)
      },
      throttled: this.isThrottled(),
      memory: typeof window !== 'undefined' && window.performance?.memory ? {
        used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(window.performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null
    };
  }
  
  /**
   * تنظيف شامل عند إغلاق التطبيق
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    this.apiCalls = [];
    this.subscriptions.clear();
    
    if (typeof window !== 'undefined') {
      delete window.__API_THROTTLED;
      delete window.__API_THROTTLE_START;
    }
    
    console.log('🧹 PerformanceMonitor destroyed and cleaned up');
  }
}

// إنشاء instance واحد مشترك
const performanceMonitor = new PerformanceMonitor();

// تنظيف عند إغلاق النافذة
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceMonitor.destroy();
  });
}

export default performanceMonitor;

// Helper functions للاستخدام السهل
export const trackApiCall = (endpoint, method) => performanceMonitor.trackApiCall(endpoint, method);
export const trackSubscription = (channelName, type) => performanceMonitor.trackSubscription(channelName, type);
export const removeSubscription = (id) => performanceMonitor.removeSubscription(id);
export const isApiThrottled = () => performanceMonitor.isThrottled();
export const getPerformanceStats = () => performanceMonitor.getStats();
