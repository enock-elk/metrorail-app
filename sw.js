const CACHE_NAME = 'metrorail-next-train-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png', // Ensure these match your actual icon filenames
  '/icons/icon-512.png'
];

// 1. Install Event: Cache the "App Shell" (UI)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Activate Event: Clean up old caches if version changes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 3. Fetch Event: "Stale-While-Revalidate" Strategy
// Check cache first. If found, return it. If not, fetch from network.
self.addEventListener('fetch', (event) => {
  
  // Ignore Firebase/API requests (let the app logic handle data caching)
  if (event.request.url.includes('firebaseio.com')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found, else fetch from network
      return response || fetch(event.request);
    })
  );
});