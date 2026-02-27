const CACHE_NAME = 'metrorail-next-train-v5.10.21'; // BUMPED: V5.10.21 - Guardian Edition
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './map.html',
  './status.html',
  './offline.html',
  './css/custom.css',
  './js/grid-order.js', 
  './js/config.js',
  './js/utils.js',
  './js/logic.js',
  './js/planner-core.js',
  './js/planner-ui.js',
  './js/map-viewer.js',
  './js/renderer.js',
  './js/admin.js',
  './js/ui.js',
  './js/tailwind.js', 
  './manifest.json',
  './sitemap.xml',
  './robots.txt',
  './icons/icon-192.png',
  './icons/old/icon-192.png',
  './icons/loading-logo.png',
  './images/network-map.png',
  './images/offline-land.jpg',
  './images/offline-port.jpg'
];

// 1. INSTALL: Cache Core Assets
self.addEventListener('install', (event) => {
  // GUARDIAN: Do NOT skipWaiting() automatically anymore.
  // We want to control the update flow via UI interaction.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching offline assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE: Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((newCache) => {
        // Safety Check: Ensure index.html is present
        return newCache.match('./index.html').then((response) => {
            if (response) {
                return caches.keys().then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((cache) => {
                            if (cache !== CACHE_NAME) {
                                console.log('SW: Clearing old cache:', cache);
                                return caches.delete(cache);
                            }
                        })
                    );
                });
            }
        });
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Stale-While-Revalidate with Fast Fail
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STRATEGY A: App Shell (HTML) - Stale-While-Revalidate + Fast Fail
  // This ensures INSTANT load if cached, while updating in background.
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        
        // 1. Network Fetch (for update)
        const networkFetch = fetch(event.request).then((networkResponse) => {
          // Update cache with new version
          caches.open(CACHE_NAME).then((cache) => {
             cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {
            // Network failed, just ignore (we have cache or fallback)
        });

        // 2. Return Cache immediately if available (Stale-While-Revalidate)
        if (cachedResponse) {
            return cachedResponse;
        }

        // 3. If NO Cache (First visit), wait for network with timeout
        // "Fast Fail": If network takes > 3s, show Offline Page
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve(caches.match('./offline.html'));
            }, 3000);
        });

        return Promise.race([networkFetch, timeoutPromise]);
      })
    );
    return;
  }

  // STRATEGY B: Static Assets (JS/CSS/IMG) - Cache First, Network Fallback
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, networkResponse.clone());
            });
        }
        return networkResponse;
      });
    })
  );
});

// 4. MESSAGE HANDLER: Listen for "SKIP_WAITING" from UI
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
