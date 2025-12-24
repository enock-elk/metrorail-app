const CACHE_NAME = 'metrorail-next-train-v3.38'; // Incremented Version
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './css/custom.css',
  './js/config.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/old/icon-192.png'
  // CRITICAL FIX: External CDNs (Tailwind/Fonts) removed from here. 
  // They caused the "Install Failed" error.
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching local app assets (V3.38)...');
        // This will now succeed because all files are local
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((err) => {
        console.error('Critical: Cache addAll failed', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Strategy: Stale-While-Revalidate for local, Network-First for external
  if (event.request.url.startsWith(self.location.origin)) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request);
        })
      );
  } else {
      // For external items (Tailwind/Fonts), just fetch normally. 
      // If offline, they will fail gracefully, but won't break the app install.
      event.respondWith(fetch(event.request));
  }
});