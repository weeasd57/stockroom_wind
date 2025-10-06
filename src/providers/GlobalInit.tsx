'use client';

import { useEffect } from 'react';

export default function GlobalInit() {
  useEffect(() => {
    try {
      // Detect and expose CSP Nonce at runtime so client-only SDKs (e.g., PayPal) can use it
      const detectedNonce = (document.querySelector('script[nonce]') as HTMLScriptElement | null)?.nonce || '';
      (window as any).__CSP_NONCE__ = detectedNonce;
    } catch {}

    // Initialize a global abort function placeholder
    if (typeof (window as any).abortPostsFetch !== 'function') {
      (window as any).abortPostsFetch = function () {
        try {
          // No-op until replaced elsewhere
          return Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      };
    }

    // Global error handlers to suppress noisy extension/protocol errors in the console
    (function initErrorHandlers() {
      const originalError = console.error;
      const originalWarn = console.warn;

      // Filter some known noisy messages
      console.error = function (...args: any[]) {
        try {
          const message = args.join(' ');
          if (
            (message.includes('Failed to launch') && (message.includes('tg://') || message.includes('registered handler'))) ||
            (message.includes('Expected number') && message.includes('path'))
          ) {
            return;
          }
        } catch {}
        return (originalError as any).apply(console, args as any);
      } as any;

      const onError = (event: ErrorEvent) => {
        const msg = event?.message || '';
        if (
          (msg.includes('SVG') || msg.includes('path') || msg.includes('Expected number')) ||
          (msg.includes('tg://') || msg.includes('does not have a registered handler') || msg.includes('Failed to launch'))
        ) {
          event.preventDefault();
          return false;
        }
        return undefined;
      };

      const onUnhandledRejection = (event: PromiseRejectionEvent) => {
        const reason = event?.reason;
        if (typeof reason === 'string') {
          if (reason.includes('tg://') || reason.includes('registered handler') || reason.includes('Failed to launch')) {
            event.preventDefault();
            return;
          }
        }
      };

      window.addEventListener('error', onError);
      window.addEventListener('unhandledrejection', onUnhandledRejection);

      // Restore console on unload
      window.addEventListener('beforeunload', () => {
        console.error = originalError;
        console.warn = originalWarn;
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
      });
    })();

    // Quiet console.log/info/debug in production
    if (process.env.NODE_ENV === 'production') {
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalDebug = console.debug;
      console.log = function () {} as any;
      console.info = function () {} as any;
      console.debug = function () {} as any;
      (window as any)._restoreConsole = function () {
        console.log = originalLog;
        console.info = originalInfo;
        console.debug = originalDebug;
      };
    }

    // Image cache manager used across the app
    if (!(window as any).imageCacheManager) {
      (window as any).imageCacheManager = {
        cache: {} as Record<string, boolean>,
        listeners: [] as Array<(userId: string, imageType: 'avatar' | 'background', url: string | null) => void>,
        failedUrls: new Set<string>(),
        requestQueue: [] as Array<{ url: string; retries: number }>,
        isProcessing: false,
        rateLimitDelay: 1000,
        maxRetries: 2,

        subscribe(callback: any) {
          if (typeof callback === 'function') {
            this.listeners.push(callback);
            return () => {
              this.listeners = this.listeners.filter((cb: any) => cb !== callback);
            };
          }
        },

        notifyChange(userId: string, imageType: 'avatar' | 'background', url: string | null) {
          this.listeners.forEach((callback: any) => {
            try {
              callback(userId, imageType, url);
            } catch (e) {
              console.error('Error in imageCacheManager listener:', e);
            }
          });
        },

        isGoogleProfileImage(url: string) {
          return url && (url.includes('googleusercontent.com') || url.includes('google.com/'));
        },

        getFallbackImage(imageType: 'avatar' | 'background') {
          if (imageType === 'avatar') return '/default-avatar.svg';
          return null;
        },

        async processQueue() {
          if (this.isProcessing || this.requestQueue.length === 0) return;
          this.isProcessing = true;
          while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift()!;
            try {
              await this.loadImageWithRetry(request.url, request.retries || 0);
            } catch (error) {
              console.warn('Failed to load image after retries:', request.url, error);
              this.failedUrls.add(request.url);
            }
            if (this.requestQueue.length > 0) {
              await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay));
            }
          }
          this.isProcessing = false;
        },

        loadImageWithRetry(url: string, retryCount = 0) {
          return new Promise<void>((resolve, reject) => {
            if (this.cache[url] || this.failedUrls.has(url)) {
              resolve();
              return;
            }
            const img = new Image();
            img.onload = () => {
              this.cache[url] = true;
              resolve();
            };
            img.onerror = () => {
              if (retryCount < this.maxRetries && this.isGoogleProfileImage(url)) {
                setTimeout(() => {
                  this.loadImageWithRetry(url, retryCount + 1).then(resolve).catch(reject);
                }, Math.pow(2, retryCount) * 1000);
              } else {
                this.failedUrls.add(url);
                reject(new Error('Image load failed'));
              }
            };
            img.src = url;
          });
        },

        preload(urls: string | string[]) {
          const list = Array.isArray(urls) ? urls : [urls];
          list.forEach((url) => {
            if (!url || this.cache[url] || this.failedUrls.has(url)) return;
            this.requestQueue.push({ url, retries: 0 });
          });
          this.processQueue();
        },

        getAvatarUrl(userId: string) {
          const key = 'avatar_' + userId;
          const url = localStorage.getItem(key);
          if (url && this.failedUrls.has(url)) return this.getFallbackImage('avatar');
          return url;
        },

        setAvatarUrl(userId: string, url: string | null) {
          if (!userId) return;
          if (!url || this.failedUrls.has(url)) url = this.getFallbackImage('avatar');
          const key = 'avatar_' + userId;
          localStorage.setItem(key, url || '');
          if (url && url !== this.getFallbackImage('avatar')) this.preload(url);
          this.notifyChange(userId, 'avatar', url);
        },

        getBackgroundUrl(userId: string) {
          const key = 'background_' + userId;
          const url = localStorage.getItem(key);
          if (url && this.failedUrls.has(url)) return null;
          return url;
        },

        setBackgroundUrl(userId: string, url: string | null) {
          if (!userId || !url || this.failedUrls.has(url)) return;
          const key = 'background_' + userId;
          localStorage.setItem(key, url);
          this.preload(url);
          this.notifyChange(userId, 'background', url);
        },

        clearFailedUrls() {
          this.failedUrls.clear();
        },

        hasUrlFailed(url: string) {
          return this.failedUrls.has(url);
        },
      };
    }
  }, []);

  return null;
}
