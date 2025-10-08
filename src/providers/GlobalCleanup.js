'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import performanceMonitor from '@/utils/performanceMonitor';

/**
 * Global Cleanup Provider - ينظف الذاكرة والاشتراكات عند تغيير الصفحات
 * يمنع تراكم Memory Leaks عبر التطبيق
 */
export function GlobalCleanup({ children }) {
  const router = useRouter();

  useEffect(() => {
    let isInitialized = false;
    
    // تهيئة مراقب الأداء
    const initializeMonitoring = () => {
      if (isInitialized) return;
      isInitialized = true;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Global Cleanup initialized');
      }
      
      // عرض إحصائيات الأداء كل دقيقة في development mode
      if (process.env.NODE_ENV === 'development') {
        const statsInterval = setInterval(() => {
          const stats = performanceMonitor.getStats();
          if (stats.apiCalls.count > 50 || stats.subscriptions.count > 10) {
            console.log('📊 Performance Stats:', stats);
          }
        }, 60000); // كل دقيقة
        
        // تنظيف الـ interval عند unmount
        return () => {
          clearInterval(statsInterval);
        };
      }
    };

    // تنظيف عند تغيير الصفحة مع debouncing لمنع الإفراط
    let routeChangeTimeout = null;
    const handleRouteChange = (url) => {
      // Debounce route changes to prevent excessive cleanup
      if (routeChangeTimeout) {
        clearTimeout(routeChangeTimeout);
      }
      
      routeChangeTimeout = setTimeout(() => {
        // Only log route changes in development mode and when there's actual cleanup needed
        if (process.env.NODE_ENV === 'development') {
          const hasActiveChannels = window.activeChannels && window.activeChannels.length > 0;
          const hasActiveFetchers = window.fetchControllers && window.fetchControllers.length > 0;
          if (hasActiveChannels || hasActiveFetchers) {
            console.log('🧹 Route change detected, cleaning up...', url);
          }
        }
      
      // تنظيف جميع الاشتراكات القديمة - Supabase v2 compatible
      if (typeof window !== 'undefined') {
        try {
          // تنظيف Supabase channels المخزنة
          if (window.activeChannels && Array.isArray(window.activeChannels)) {
            window.activeChannels.forEach(channel => {
              try {
                if (channel && typeof channel.unsubscribe === 'function') {
                  channel.unsubscribe();
                }
              } catch (error) {
                console.warn('⚠️ Error unsubscribing channel:', error);
              }
            });
            const channelCount = window.activeChannels.length;
            window.activeChannels = [];
            if (channelCount > 0 && process.env.NODE_ENV === 'development') {
              console.log(`✅ Cleaned ${channelCount} Supabase channels`);
            }
          }
        } catch (error) {
          console.warn('⚠️ Error cleaning Supabase channels:', error);
        }
      }
      
      // إلغاء جميع الطلبات المعلقة
      if (typeof window !== 'undefined' && window.fetchControllers) {
        window.fetchControllers.forEach(controller => {
          try {
            controller.abort();
          } catch (error) {
            console.warn('⚠️ Error aborting fetch controller:', error);
          }
        });
        const controllerCount = window.fetchControllers.length;
        window.fetchControllers = [];
        if (controllerCount > 0 && process.env.NODE_ENV === 'development') {
          console.log(`✅ Aborted ${controllerCount} fetch controllers`);
        }
      }
      
      // تنظيف timeouts و intervals
      if (typeof window !== 'undefined') {
        // تنظيف timeouts المخزنة
        if (window.activeTimeouts) {
          window.activeTimeouts.forEach(timeoutId => {
            try {
              clearTimeout(timeoutId);
            } catch (error) {
              console.warn('⚠️ Error clearing timeout:', error);
            }
          });
          window.activeTimeouts = [];
        }
        
        // تنظيف intervals المخزنة
        if (window.activeIntervals) {
          window.activeIntervals.forEach(intervalId => {
            try {
              clearInterval(intervalId);
            } catch (error) {
              console.warn('⚠️ Error clearing interval:', error);
            }
          });
          window.activeIntervals = [];
        }
      }
      
        // إجبار garbage collection إذا كان متاح
        if (typeof window !== 'undefined' && window.gc) {
          try {
            window.gc();
            console.log('🗑️ Garbage collection triggered');
          } catch (error) {
            // Garbage collection not available, that's okay
          }
        }
        
        routeChangeTimeout = null;
      }, 300); // 300ms debounce
    };

    // تنظيف عند إغلاق النافذة
    const handleBeforeUnload = () => {
      console.log('🧹 Window unloading, final cleanup...');
      
      // تنظيف شامل
      performanceMonitor.destroy();
      
      // إلغاء جميع الاشتراكات
      if (typeof window !== 'undefined' && window.supabase) {
        try {
          window.supabase.removeAllChannels();
        } catch (error) {
          console.warn('⚠️ Error in final Supabase cleanup:', error);
        }
      }
    };

    // تهيئة النظام
    initializeMonitoring();

    // إعداد event listeners
    let originalPush = null;
    let originalReplace = null;
    
    if (typeof window !== 'undefined') {
      // تهيئة arrays للتتبع إذا لم تكن موجودة
      if (!window.fetchControllers) window.fetchControllers = [];
      if (!window.activeTimeouts) window.activeTimeouts = [];
      if (!window.activeIntervals) window.activeIntervals = [];
      if (!window.activeChannels) window.activeChannels = [];
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // مراقبة تغييرات الـ router - حفظ المراجع الأصلية
      originalPush = router.push.bind(router);
      originalReplace = router.replace.bind(router);
      
      router.push = function(...args) {
        handleRouteChange(args[0]);
        return originalPush.apply(this, args);
      };
      
      router.replace = function(...args) {
        handleRouteChange(args[0]);
        return originalReplace.apply(this, args);
      };
    }

    // تنظيف عند unmount
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        
        // استعادة الدوال الأصلية
        if (originalPush) {
          try {
            router.push = originalPush;
          } catch (error) {
            console.warn('⚠️ Error restoring router.push:', error);
          }
        }
        if (originalReplace) {
          try {
            router.replace = originalReplace;
          } catch (error) {
            console.warn('⚠️ Error restoring router.replace:', error);
          }
        }
      }
    };
  }, [router]);

  // Helper functions للاستخدام العام
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // دالة لتتبع timeouts
      window.trackTimeout = (timeoutId) => {
        if (!window.activeTimeouts) window.activeTimeouts = [];
        window.activeTimeouts.push(timeoutId);
        return timeoutId;
      };
      
      // دالة لتتبع intervals
      window.trackInterval = (intervalId) => {
        if (!window.activeIntervals) window.activeIntervals = [];
        window.activeIntervals.push(intervalId);
        return intervalId;
      };
      
      // دالة لتتبع fetch controllers
      window.trackFetchController = (controller) => {
        if (!window.fetchControllers) window.fetchControllers = [];
        window.fetchControllers.push(controller);
        return controller;
      };
      
      // دالة لتتبع Supabase channels
      window.trackChannel = (channel) => {
        if (!window.activeChannels) window.activeChannels = [];
        window.activeChannels.push(channel);
        return channel;
      };
      
      // دالة للحصول على إحصائيات الأداء
      window.getPerformanceStats = () => {
        return performanceMonitor.getStats();
      };
      
      // دالة للتنظيف اليدوي
      window.manualCleanup = () => {
        console.log('🧹 Manual cleanup triggered');
        handleRouteChange('manual');
      };
    }
  }, []);

  return children;
}

export default GlobalCleanup;
