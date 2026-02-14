const CACHE_NAME = 'metrorail-next-train-v5.00.04.2'; // BUMPED: Added ignoreSearch fix + Safety Check
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './map.html',
  './status.html',
  './offline.html',
  './css/style.css',
  './css/custom.css',
  './js/grid-order.js', // Critical: Schedule Matrix
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
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching offline assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch((error) => {
        console.error('SW: Install failed:', error);
    })
  );
});

// 2. ACTIVATE: Safety Check & Clean Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // SAFETY CHECK: Verify the new cache has the App Shell (index.html) before deleting old caches.
    // This prevents "White Screen of Death" if the install failed but activate fired.
    caches.open(CACHE_NAME).then((newCache) => {
        return newCache.match('./index.html').then((response) => {
            if (response) {
                // Safe to clean up
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
            } else {
                console.warn('SW: Safety Check Failed! New cache is missing index.html. Keeping old caches.');
                // Do not delete old caches.
                return Promise.resolve();
            }
        });
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Network-First for HTML, Stale-While-Revalidate for Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STRATEGY A: Network-First for HTML (App Shell)
  // Ensures user always gets the latest version if online
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
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
          // FIXED: Added { ignoreSearch: true } to match index.html regardless of query params (e.g. ?action=planner)
          return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
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
  // Serves from cache immediately, then updates in background
  event.respondWith(
    // FIXED: Added { ignoreSearch: true } to allow versioned requests (e.g. logic.js?v=4.60) to match cached files
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, networkResponse.clone());
            });
        }
        return networkResponse;
      }).catch((e) => {
        // Network failed, but that's okay if we have cached content
        // console.log('SW: Background update failed', e); 
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
