const CACHE_NAME = 'metrorail-next-train-v6.04.26-Growth-Phase-1'; // BUMPED: Growth Mode Phase 0 (Force UI cache refresh)
const ASSETS_TO_CACHE = [
  // GUARDIAN: Strictly core shell files only. 
  // Heavy images/maps removed to prevent atomic install failures on 404s.
  // They will be cached dynamically on first load via the fetch handler.
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
  './manifest.json'
];

// 1. INSTALL: Cache Core Assets
self.addEventListener('install', (event) => {
  // GUARDIAN: Do NOT skipWaiting() automatically anymore.
  // We want to control the update flow via UI interaction to prevent atomic failures mid-session.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(`SW: Caching core offline shell for ${CACHE_NAME}...`);
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE: SCORCHED EARTH Cleanup Protocol
self.addEventListener('activate', (event) => {
  console.log('SW: Activating Scorched Earth Protocol...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If the cache doesn't EXACTLY match our new active version string, annihilate it.
          if (cacheName !== CACHE_NAME) {
            console.log(`SW: Eradicating legacy/broken cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: All legacy caches destroyed. Seizing control of clients immediately.');
      // Force all active clients to run via the newly activated Service Worker
      return self.clients.claim();
    })
  );
});

// 3. FETCH: Network-First with Fast Fail for HTML, Cache-First for Assets
self.addEventListener('fetch', (event) => {
  // GUARDIAN PHASE 1: Ignore non-HTTP requests (like chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  // GUARDIAN PHASE 2: Ignore non-GET requests (e.g., POST for Firebase Auth/API calls)
  // Caches cannot store POST requests, and intercepting them causes TypeErrors.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // GUARDIAN PHASE E: THE CACHE TRAP (Strict Network-Only Bypass)
  // Ensure real-time database queries (Firebase RTDB) and Cloudflare telemetry workers are NEVER cached by the SW.
  // This guarantees Service Alerts, Killswitches, and Maintenance banners hit the UI instantly.
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('workers.dev')) {
      event.respondWith(
          fetch(event.request).catch(() => {
              // If offline, fail gracefully returning a synthetic JSON 503 instead of crashing the UI parser
              return new Response('{"error": "Offline"}', { 
                  status: 503, 
                  headers: { 'Content-Type': 'application/json' } 
              });
          })
      );
      return; // HALT SW EXECUTION FOR THIS REQUEST
  }

  // STRATEGY A: App Shell (HTML) - Network-First + Fast Fail (Cache Fallback)
  // Ensures users ALWAYS get the latest version if they have a fast connection,
  // fixing the issue of users being stuck on old versions due to Stale-While-Revalidate.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    
    // 1. Network Fetch Promise
    const networkFetch = fetch(event.request).then((networkResponse) => {
      // Clone synchronously BEFORE opening the asynchronous cache
      const responseToCache = networkResponse.clone();
      
      // Wrap the async disk write in event.waitUntil.
      // Prevents OS from killing the SW thread mid-write, preventing corrupted caches.
      event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
           return cache.put(event.request, responseToCache);
        })
      );
      
      return networkResponse;
    });

    // 2. Timeout Promise (Fast Fail: 3 seconds)
    // If the network hangs, we reject to trigger the cache fallback immediately.
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout')), 3000);
    });

    event.respondWith(
      // Race the network fetch against the timeout
      Promise.race([networkFetch, timeoutPromise]).catch(() => {
        // 3. Fallback to Cache if network fails or times out
        return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) {
                console.log('SW: Serving HTML from Cache (Network failed/timeout).');
                return cachedResponse;
            }
            // 4. Absolute Fallback: Offline Emergency Page
            return caches.match('./offline.html');
        });
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
        // Only cache valid OK responses
        if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            
            // Dynamically caches images/maps as they are requested!
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => {
                 return cache.put(event.request, responseToCache);
              })
            );
        }
        return networkResponse;
      }).catch(() => {
        // GUARDIAN FIX: Return a synthetic 503 response instead of `undefined`.
        // This prevents the "Failed to convert value to 'Response'" crash when
        // external scripts (like MS Clarity) are blocked by AdBlockers, or assets fail offline.
        return new Response('', { status: 503, statusText: 'Offline or Blocked by Client' });
      });
    })
  );
});

// 4. MESSAGE HANDLER: Listen for "SKIP_WAITING" from UI Update Modals & Idle Tracker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // GROWTH MODE PHASE 2: This explicitly catches the silent update command 
    // dispatched from the visibilitychange (Idle Tracker) in ui.js, 
    // allowing the app to upgrade seamlessly while out of focus.
    console.log('SW: Idle Update Protocol / Force Update triggered. Skipping waiting phase.');
    self.skipWaiting();
  }
});