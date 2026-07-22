const CACHE_NAME = 'metrorail-next-train-V7_07.21'; // GUARDIAN: Bumped to trigger Scorched Earth for Minified JS - v2
const ASSETS_TO_CACHE = [
  // GUARDIAN: Strictly core shell files only. 
  // Heavy images/maps removed to prevent atomic install failures on 404s.
  // They will be cached dynamically on first load via the fetch handler.
  './',
  './index.html',
  './guide.html',
  './map.html',
  './status.html',
  './offline.html',
  './css/custom.css',
  './js/grid-order.min.js', 
  './js/config.min.js',
  './js/utils.min.js',
  './js/logic.min.js',
  './js/planner-core.min.js',
  './js/planner-ui.min.js',
  './js/map-viewer.min.js',
  './js/renderer.min.js',
  './js/admin.min.js',
  './js/ui.min.js',
  './js/tailwind.js', 
  './manifest.json',

  // 🛡️ GROWTH MODE PHASE 1: Pre-cache Firebase SDKs to survive cold offline boots
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js'

  // 🛡️ GUARDIAN PHASE 6: removed the [Map image Caching (Cross-Region Offline Support)]
];

// 1. INSTALL: Cache Core Assets
self.addEventListener('install', (event) => {
    const coreAssets = ASSETS_TO_CACHE.filter(url => !url.includes('gstatic.com'));
    const optionalAssets = ASSETS_TO_CACHE.filter(url => url.includes('gstatic.com'));

    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await cache.addAll(coreAssets); // Atomic — must succeed
            // Optional: best-effort, never blocks install
            await Promise.allSettled(
                optionalAssets.map(url => cache.add(url).catch(() => {
                    console.warn(`SW: Optional asset failed to pre-cache: ${url}`);
                }))
            );
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
  // Ensure real-time database queries (Firebase RTDB), Cloudflare telemetry, and CleverAds beacons are NEVER cached.
  // This guarantees Service Alerts hit the UI instantly, and Ad impressions aren't swallowed by cache.
  if (
    url.hostname.includes('firebaseio.com') || 
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('cleverwebserver.com')
  ) {
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
    
    // 🛡️ GUARDIAN UX FIX: Detached Promise Pattern
    // Resolves the race condition where `waitUntil` is invoked too late, causing silent cache write failures.
    let resolveWaitUntil;
    const waitUntilPromise = new Promise(resolve => { resolveWaitUntil = resolve; });
    event.waitUntil(waitUntilPromise); // Called synchronously — SW lifetime guaranteed

    // 1. Network Fetch Promise
    const networkFetch = fetch(event.request).then((networkResponse) => {
      // Clone synchronously BEFORE opening the asynchronous cache
      const responseToCache = networkResponse.clone();
      
      const cacheWrite = caches.open(CACHE_NAME).then((cache) => {
          return cache.put(event.request, responseToCache);
      });
      
      resolveWaitUntil(cacheWrite); // Hands off the real promise to waitUntil
      return networkResponse;
    }).catch((err) => {
        resolveWaitUntil(); // Never leave the detached promise hanging
        throw err;
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
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Only cache valid OK responses
        if (networkResponse && networkResponse.status === 200) {
            // 🛡️ GUARDIAN PHASE 4A: Captive Portal Cache Poisoning Defense
            const reqUrl = new URL(event.request.url);
            const contentType = (networkResponse.headers && networkResponse.headers.get('content-type')) || '';
            const isCssOrJs = reqUrl.pathname.endsWith('.js') || reqUrl.pathname.endsWith('.css');
            
            if (isCssOrJs && contentType.includes('text/html')) {
                console.warn(`🛡️ SW Guardian: Captive Portal interception detected. Blocked poisoned cache write for ${reqUrl.pathname}`);
                // Do NOT write the HTML login page to the cache over our JS/CSS files!
            } else {
                const responseToCache = networkResponse.clone();
                
                // Dynamically caches images/maps as they are requested!
                event.waitUntil(
                  caches.open(CACHE_NAME).then((cache) => {
                     return cache.put(event.request, responseToCache);
                  })
                );
            }
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
    self.skipWaiting().then(() => {
        // 🛡️ GUARDIAN PHASE 1 (Zombie PWA Fix): Aggressive Takeover
        // Violently seize control of all active tabs instantly without waiting for closure
        return self.clients.claim();
    });
  }
});