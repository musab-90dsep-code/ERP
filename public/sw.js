// ERP Business Manager — Service Worker
// Provides offline support and caching for the PWA

const CACHE_NAME = 'erp-cache-v1';

// Assets to cache on install (app shell)
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: cache app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first strategy ────────────────────────
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Supabase API calls
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('supabase.co')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Cache successful page responses
        if (res.ok && event.request.destination === 'document') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, resClone)
          );
        }
        return res;
      })
      .catch(() => {
        // Offline fallback: serve from cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/');
        });
      })
  );
});
