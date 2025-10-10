/* Basic service worker for SharksZone PWA */
/* (Optional) Improved WebSocket resilience tip:
   - Consider using a backoff strategy and periodic keep-alive pings from the client to Supabase Realtime.
   - You can also set realtime params like heartbeatIntervalMs server-side if needed.
*/

const CACHE_NAME = 'sharkszone-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon_io/favicon.ico',
  '/favicon_io/favicon-16x16.png',
  '/favicon_io/favicon-32x32.png',
  '/favicon_io/android-chrome-192x192.png',
  '/favicon_io/android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
  console.log('[SW] install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Skip Supabase API and Realtime websockets from caching
  if (url.hostname.includes('supabase.co')) return;

  // Network-first for HTML, cache-first for static assets
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/'))
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        }).catch(() => cached);
      })
    );
  }
});
