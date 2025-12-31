const CACHE_NAME = 'metrorail-next-train-v4.11'; // Bumped version to force update
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './map.html',          // Added back (Verified existence)
  './status.html',       // Added back (Verified existence)
  './css/style.css',
  './css/custom.css',
  './js/config.js',
  './js/utils.js',       // Added back (Verified existence)
  './js/logic.js',
  './js/planner.js',
  './js/map-viewer.js',  // Added back (Verified existence)
  './js/ui.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/old/icon-192.png',
  './images/network-map.png'
];

// 1. INSTALL: Cache Core Assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force this new SW to become active immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching core assets (v4.11)...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((err) => {
        console.error('SW: Critical - Cache addAll failed. Check file paths.', err);
      })
  );
});

// 2. ACTIVATE: Clean Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients immediately
});

// 3. FETCH: Smart Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STRATEGY A: Network-First for HTML (Always get latest app shell)
  // This ensures users see updates immediately if they are online.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If we got a good response, clone it and update the cache
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // If offline or network fails, fall back to cache
          console.log('SW: Network failed for HTML, falling back to cache');
          return caches.match(event.request);
        })
    );
    return;
  }

  // STRATEGY B: Stale-While-Revalidate for Assets (CSS, JS, Images)
  // Serve cached version immediately for speed, but update cache in background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Even if we found it in cache, kick off a background fetch to update it for next time
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, networkResponse.clone());
            });
        }
        return networkResponse;
      }).catch((e) => {
         // Network failed, just stick with cache
         console.log('SW: Background fetch failed', e);
      });

      // Return the cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});