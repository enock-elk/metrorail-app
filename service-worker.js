const CACHE_NAME = 'metrorail-next-train-v4.10'; // Incremented for Map Viewer Module
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './map.html',
  './status.html',
  './css/style.css',
  './css/custom.css',
  './js/config.js',
  './js/utils.js',
  './js/logic.js',
  './js/planner.js',
  './js/map-viewer.js',   // ADDED: New Map Module
  './js/ui.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/old/icon-192.png',
  './images/network-map.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching local app assets (V4.08)...');
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
      event.respondWith(fetch(event.request));
  }
});