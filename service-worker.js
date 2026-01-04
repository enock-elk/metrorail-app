const CACHE_NAME = 'metrorail-next-train-v4.38.1'; // Bumped version to Fix System Splash Screen
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './map.html',
  './status.html',
  './offline.html',
  './css/style.css',
  './css/custom.css',
  './js/config.js',
  './js/utils.js',
  './js/logic.js',
  './js/planner.js',
  './js/map-viewer.js',
  './js/ui.js',
  './manifest.json',
  './sitemap.xml',       // Added for completeness
  './robots.txt',        // Added for completeness
  './icons/icon-192.png',
  './icons/old/icon-192.png',
  './icons/loading-logo.png', // This is now the source for the Splash Screen
  './images/network-map.png',
  './images/offline-land.jpg',
  './images/offline-port.jpg'
];

// 1. INSTALL: Cache Core Assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching core assets (v4.33)...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((err) => {
        console.error('SW: Critical - Cache addAll failed.', err);
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
  self.clients.claim(); 
});

// 3. FETCH: Smart Strategy with Offline Fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STRATEGY A: Network-First for HTML (with Offline Fallback)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          console.log('SW: Network failed for HTML. Checking cache...');
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            } else {
                // FALLBACK: If page is not in cache (e.g. new user), serve offline.html
                console.log('SW: Page not in cache. Serving offline.html');
                return caches.match('./offline.html');
            }
          });
        })
    );
    return;
  }

  // STRATEGY B: Stale-While-Revalidate for Assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, networkResponse.clone());
            });
        }
        return networkResponse;
      }).catch((e) => {
         console.log('SW: Background fetch failed', e);
      });
      return cachedResponse || fetchPromise;
    })
  );
});