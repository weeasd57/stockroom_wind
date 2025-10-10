'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import performanceMonitor from '@/utils/performanceMonitor';
import { supabase as supabaseClient } from '@/utils/supabase';

/**
 * Global Cleanup Provider - ينظف الذاكرة والاشتراكات عند تغيير الصفحات
 * يمنع تراكم Memory Leaks عبر التطبيق
 */
export function GlobalCleanup({ children }) {
  const router = useRouter();

  useEffect(() => {
    let isInitialized = false;
    let reconnectTimer = null;
    let lastReconnectAt = 0;
    const RECONNECT_MIN_GAP_MS = 1500;
    
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

    // Reconnect helpers when returning to the tab or network comes back
    const scheduleReconnect = (reason) => {
      try {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          attemptReconnect(reason);
        }, 250);
      } catch {}
    };

    const attemptReconnect = async (reason) => {
      try {
        const now = Date.now();
        if (now - lastReconnectAt < RECONNECT_MIN_GAP_MS) return;
        lastReconnectAt = now;

        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return;

        const supabase = supabaseClient;
        if (!supabase) return;

        console.log(`[Reconnect] ▶️ Start (${reason}) at ${new Date().toISOString()}`);

        // 1) Hard reset Realtime socket to avoid stale connections
        try {
          if (supabase.realtime?.disconnect) {
            console.log('[Reconnect] 🔌 realtime.disconnect()');
            supabase.realtime.disconnect();
          }
        } catch (e) {
          console.warn('[Reconnect] realtime.disconnect() failed:', e);
        }

        // 2) Connect Realtime again
        try {
          if (supabase.realtime?.connect) {
            console.log('[Reconnect] ⚡ realtime.connect()');
            supabase.realtime.connect();
          }
        } catch (e) {
          console.warn('[Reconnect] realtime.connect() failed:', e);
        }

        // 3) Refresh auth session to rotate tokens if needed
        try {
          console.log('[Reconnect] 🔐 auth.refreshSession()');
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.warn('[Reconnect] refreshSession error:', error?.message || error);
          } else {
            console.log('[Reconnect] ✅ refreshSession ok:', Boolean(data?.session));
          }
        } catch (e) {
          console.warn('[Reconnect] refreshSession threw:', e);
        }

        // 4) Best-effort probe to confirm network path to Supabase REST
        try {
          console.log('[Reconnect] 🔎 probe: select 1 from profiles (limit 1)');
          const controller = new AbortController();
          const probeTimeout = setTimeout(() => controller.abort(), 4000);
          const { error: probeError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1)
            .abortSignal(controller.signal);
          clearTimeout(probeTimeout);
          if (probeError) {
            console.warn('[Reconnect] probe error (expected under RLS too):', probeError.message || probeError);
          } else {
            console.log('[Reconnect] 🌐 probe ok');
          }
        } catch (e) {
          console.warn('[Reconnect] probe threw:', e?.name || e);
        }

        // 5) Re-subscribe any channels that are not joined
        try {
          const channels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
          for (const ch of channels) {
            try {
              const state = ch?.state;
              if (typeof ch.subscribe === 'function' && state !== 'joined') {
                console.log('[Reconnect] 📡 rejoin channel');
                ch.subscribe();
              }
            } catch (e) {
              console.warn('[Reconnect] channel subscribe failed:', e);
            }
          }
        } catch (e) {
          console.warn('[Reconnect] channels iteration failed:', e);
        }

        console.log('[Reconnect] 🟢 Done');
      } catch (e) {
        console.warn('[Reconnect] Unexpected failure:', e);
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

      // Reconnect when user returns to tab or network restores
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') scheduleReconnect('visibility');
      };
      const onFocus = () => scheduleReconnect('focus');
      const onOnline = () => scheduleReconnect('online');
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('focus', onFocus);
      window.addEventListener('online', onOnline);
      
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
        try {
          document.removeEventListener('visibilitychange', onVisibilityChange);
          window.removeEventListener('focus', onFocus);
          window.removeEventListener('online', onOnline);
        } catch {}
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        
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