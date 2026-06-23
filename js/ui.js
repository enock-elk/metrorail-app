/**
 * METRORAIL NEXT TRAIN - UI CONTROLLER (V7_06.24 - Performance Polish Edition)
 * ----------------------------------------------------------------
 * THE "WAITER" (Controller)
 * * This module handles DOM interaction, Event Listeners, and UI Rendering.
 * * V6.00.22: The Great Purge - Migrated monolithic overrides, silenced error toasts.
 * * PHASE 9: App Router injected. Unified History API and Exit Trap Protocol.
 * * PHASE 7: Priority Alert Queue, Regional Global Sync, and CSS Marquee Ticker.
 * * PHASE 6.2: Lazy-Loaded Leaflet Trip Map Engine Injected.
 * * PHASE 4 (GUARDIAN): The Crash Immunity. Wrapped all missing addEventListeners in null-checks. Async cache-clearing race condition patched.
 * * PHASE 6 (GUARDIAN): Trip Map Ergonomics. Bottom-Left Zooms, and Background GPS Auto-Locate (Swap feature removed per Phase 3).
 * * PHASE 11 (GUARDIAN): Router Bleed Fixed for Planner, Offline Dynamic Toggle, and Subtitle alignment.
 * * PHASE 1.2 (GUARDIAN BUGFIX): Popstate logic reordered to prioritize Modals over Planner Results. Holiday Lookahead injected.
 * * PHASE 2 (BUGFIX 4): Ripped out flawed `while` loops from `renderNoService` / `renderNextAvailableTrain`. Hooked to True Day Simulator. Modal and Grid sync patched.
 * * PHASE 2 (GUARDIAN STORAGE): Swapped localStorage to safeStorage. Guarded sessionStorage. Added Array bounds checking.
 * * GUARDIAN PHASE 15: Grid Synchronization Patch. Prevented grid from blindly auto-forwarding on active holidays.
 * * PHASE 1 (GUARDIAN ANALYTICS): 'check_updates_click' tracked.
 * * PHASE 2 (GUARDIAN FEEDBACK): In-House Feedback System, Firebase Storage Pipeline, 15s Timeout Race & Modal bindings injected.
 * * GUARDIAN BUGFIX: Separated telemetry tracking for manual vs system cache wipes. Injected proper loading UI for slow DB hydration.
 * * GUARDIAN BUGFIX (V6.04.13): Universal Shared Corridor Text Formatting (Option B String Split) for region-agnostic tags (Modal).
 * * GUARDIAN BUGFIX (V6.04.14): Universal Shared Corridor Text Formatting ported to main Live Board `Renderer.renderJourney`.
 * * GUARDIAN PHASE 3 (V6.04.15): Region Interceptor Pattern. Injected `handleRegionChange` to prevent dead-ends for unreleased regions, tracking KZN/EC demand.
 * * GUARDIAN PHASE 4 (V6.04.16): Hybrid Feedback Pipeline. Routes inactive/future traffic to Google Forms. Blocks empty text noise. Enhances Alert Reply Context.
 * * GUARDIAN V6.05.03: Supercharged Alerts Renderer (Hero Images, CTA Buttons, Interactive Polling). Clarity Unique User identification lock.
 * * GROWTH MODE PHASE 1: MS Clarity Fortification, Firebase Vote Counter, Monetization Hooks, and Idle Update Protocol.
 * * GUARDIAN PHASE 5: Router Shield Dynamic DOM Querying & Offline Telemetry Network Throttling.
 * * GUARDIAN BUGFIX: Link Bug Exterminator. Legacy URL regex removed from Service Alerts parser.
 * * GUARDIAN PHASE 2 (GRID UX): Button micro-copy trimmed and responsive classes injected to prevent horizontal wrapping on narrow screens.
 * * GROWTH MODE PHASE 2 (PHASE 1 POLISH): Crash Modal Feedback Hook, Alert Spam Suppression, Variable Scoping Fix, and AbortError Checks.
 * * GROWTH MODE PHASE 3: The Haptics Diet. Purged vibrations from tabs, swipes, and closures. Unread badge logic injected for Changelog.
 * * GROWTH MODE PHASE 4 (DATA PIPELINE): Firebase Rule Bypass for Crashes (PUT). Inbox Checker injected into Alert Bell. Naked ROUTES checks patched.
 * * GROWTH MODE PHASE 5.1 (MONETIZATION FIX): AdInterceptor injected to protect 20-Hour Rule against PWA reloads and modal overlaps.
 * * GROWTH MODE PHASE 6: AdBlocker Evasion & Inbox Banner. Migrated `/metrics/` to `/sys_logs/` and built persistent Developer Reply banner.
 * * GROWTH MODE PHASE 7: isPWA diagnostic flag injected into Feedback Payload for enhanced Admin debugging. Scroll locks eradicated from Autocomplete.
 * * GROWTH MODE PHASE 8: Frictionless WebView Breakout (Android Intent / iOS Silent VIP) & ct-kraai Trapdoor Fix.
 */

// --- GLOBAL HAPTIC ENGINE ---
function triggerHaptic() {
    try {
        // GUARDIAN: Safe storage check
        const isEnabled = safeStorage.getItem('hapticsEnabled') !== 'false';
        if (isEnabled && navigator.vibrate) {
            navigator.vibrate(50);
        }
    } catch(e) {}
}

// --- GUARDIAN V6.18: GLOBAL SCROLL-LOCK PROTOCOL ---
function lockBackgroundScroll() {
    document.body.classList.add('modal-active');
}
function unlockBackgroundScroll() {
    document.body.classList.remove('modal-active');
}

// --- GUARDIAN: OVERRIDE SMOOTH MODAL TO CATCH TELEMETRY LEAKS AND ROUTER BLEED ---
window._isModalAnimating = false;

// 🛡️ GROWTH MODE PHASE 3: Spatial Modal Engine
if (!window._originalCloseSmoothModal && typeof window.closeSmoothModal === 'function') {
    window._originalCloseSmoothModal = window.closeSmoothModal;
}
if (!window._originalOpenSmoothModal && typeof window.openSmoothModal === 'function') {
    window._originalOpenSmoothModal = window.openSmoothModal;
}

window.closeSmoothModal = function(modalId) {
    window._isModalAnimating = true;
    setTimeout(() => { window._isModalAnimating = false; }, 350);

    if (modalId === 'dev-modal' && window.Admin && window.Admin.telemetryInterval) {
        clearInterval(window.Admin.telemetryInterval);
        window.Admin.telemetryInterval = null;
    }
    
    // 🛡️ GUARDIAN FIX: Clean up the auto-polling loop if the network error modal is closed natively
    if (modalId === 'network-error-modal' && window._networkPollInterval) {
        clearInterval(window._networkPollInterval);
        window._networkPollInterval = null;
    }
    
    // 🛡️ GUARDIAN UX: Ensure cinematic scrim is released when ANY modal closes
    if (window.toggleDropdownScrim) window.toggleDropdownScrim();
    
    if (typeof window._originalCloseSmoothModal === 'function') {
        window._originalCloseSmoothModal(modalId);
    }
};
window._patchedCloseSmoothModal = true;

window.openSmoothModal = function(modalId, customOrigin = null) {
    window._isModalAnimating = true;
    setTimeout(() => { window._isModalAnimating = false; }, 350);

    const modal = document.getElementById(modalId);
    if (modal && modal.firstElementChild) {
        const inner = modal.firstElementChild;
        // Clean previous origins
        inner.style.transformOrigin = '';
        inner.classList.remove('origin-top-right', 'origin-bottom-left', 'origin-center', 'origin-bottom');
        
        // Spatial Origin Mapping
        if (customOrigin === 'top-right' || modalId === 'notice-modal') {
            inner.classList.add('origin-top-right');
        } else if (customOrigin === 'dev-banner') {
            const banner = document.getElementById('developer-reply-banner');
            if (banner) {
                const rect = banner.getBoundingClientRect();
                // Blossom the modal directly out of the center of the blue banner
                inner.style.transformOrigin = `${rect.left + (rect.width / 2)}px ${rect.top + (rect.height / 2)}px`;
            } else {
                inner.classList.add('origin-top');
            }
        } else {
            inner.classList.add('origin-center'); // Default
        }
    }

    if (typeof window._originalOpenSmoothModal === 'function') {
        window._originalOpenSmoothModal(modalId);
    }
};
window._patchedOpenSmoothModal = true;

// --- GUARDIAN UX: CINEMATIC SCRIM ENGINE ---
window.toggleDropdownScrim = function(listId = null, chevronId = null) {
    const scrim = document.getElementById('global-dropdown-scrim');
    if (!scrim) return;

    const allLists = ['sidenav-region-list', 'route-modal-region-list', 'custom-time-list', 'main-day-list', 'header-day-list', 'grid-day-list'];
    const allChevrons = ['sidenav-region-chevron', 'route-modal-region-chevron', 'custom-time-chevron', 'main-day-chevron', 'header-day-chevron', 'grid-day-chevron'];

    // 🛡️ GUARDIAN UX FIX: The Deep Z-Index Escape Hatch
    // Maps each dropdown list to the specific outer wrapper that controls its CSS stacking context
    const wrapperMap = {
        'sidenav-region-list': 'sidenav-region-wrapper',
        'route-modal-region-list': 'route-modal-region-container',
        'custom-time-list': 'custom-time-dropdown-container',
        'main-day-list': 'planner-day-select-container',
        'header-day-list': 'planner-header-badge',
        'grid-day-list': 'grid-day-dropdown-container'
    };

    const resetAllWrappers = () => {
        allLists.forEach((id) => {
            const wrapperId = wrapperMap[id];
            const wrapper = wrapperId ? document.getElementById(wrapperId) : null;
            const el = document.getElementById(id);
            const targetEl = wrapper || (el ? el.parentElement : null);
            if (targetEl) {
                targetEl.classList.remove('z-[160]'); // GUARDIAN: Upgraded to defeat z-[150] body scrim
                targetEl.classList.add('z-10'); // Restore baseline
            }
        });
    };

    if (listId) {
        const list = document.getElementById(listId);
        const chevron = document.getElementById(chevronId);
        if (!list) return;

        const isOpening = list.classList.contains('hidden');

        // 1. Close all other dropdowns cleanly to prevent overlap
        allLists.forEach((id, idx) => {
            const el = document.getElementById(id);
            const chev = document.getElementById(allChevrons[idx]);
            if (el && id !== listId) el.classList.add('hidden');
            if (chev && allChevrons[idx] !== chevronId) chev.classList.remove('rotate-180');
        });

        // 2. Toggle target and Scrim
            if (isOpening) {
                // 🛡️ GUARDIAN UX FIX: Dynamic Stacking Context Injection
                const container = list.closest('#sidenav') || list.closest('.transform') || list.closest('.view-section') || list.closest('#main-content') || document.body;
                
                if (scrim.parentNode !== container) {
                    container.appendChild(scrim);
                }

                // Adjust positioning and Dimming levels dynamically
                scrim.classList.remove('bg-black/20', 'bg-black/40', 'bg-black/60', 'bg-transparent');
                
                // 🛡️ GUARDIAN PHASE 3: Exclude Trip Planner inline dropdowns from darkening the background
                const isInlineDropdown = ['main-day-list', 'header-day-list', 'custom-time-list'].includes(listId);

                if (container === document.body) {
                    scrim.classList.remove('absolute', 'rounded-xl', 'rounded-2xl', 'rounded-lg', 'z-[40]', 'z-[90]');
                    scrim.classList.add('fixed', 'z-[150]', isInlineDropdown ? 'bg-transparent' : 'bg-black/40');
                } else {
                    scrim.classList.remove('fixed', 'z-[150]');
                    scrim.classList.add('absolute');
                    
                    if (container.id === 'sidenav') {
                        scrim.classList.add('z-[40]', 'bg-transparent'); // GUARDIAN UX FIX: Transparent for Sidenav to prevent darkening
                    } else if (container.classList.contains('view-section')) {
                        scrim.classList.add('z-[40]', isInlineDropdown ? 'bg-transparent' : 'bg-black/60'); // Localized dim inside active view tab context
                    } else if (container.id === 'main-content') {
                        scrim.classList.add('z-[90]', isInlineDropdown ? 'bg-transparent' : 'bg-black/60'); // Same dim for main app card
                    } else {
                        scrim.classList.add('z-[90]', isInlineDropdown ? 'bg-transparent' : 'bg-black/60'); // Heavier dim for Modals
                    }
                    
                    // Match modal border radius dynamically to prevent visual bleeding
                    if (container.classList.contains('rounded-xl')) scrim.classList.add('rounded-xl');
                    else if (container.classList.contains('rounded-2xl')) scrim.classList.add('rounded-2xl');
                    else if (container.id === 'main-content') scrim.classList.add('rounded-lg');
                }

            // Elevate active parent wrapper z-index so it floats above the scrim
            resetAllWrappers();
            const activeWrapperId = wrapperMap[listId];
            const activeWrapper = activeWrapperId ? document.getElementById(activeWrapperId) : null;
            const targetActiveEl = activeWrapper || list.parentElement;
            
            if (targetActiveEl) {
                targetActiveEl.classList.remove('z-10');
                targetActiveEl.classList.add('z-[160]', 'relative'); // GUARDIAN: Ensure it escapes the stacking context and defeats z-[150]
            }

            list.classList.remove('hidden');
            if (chevron) chevron.classList.add('rotate-180');
            
            scrim.classList.remove('hidden');
            void scrim.offsetWidth; // Force DOM Reflow
            scrim.classList.remove('opacity-0');
        } else {
            list.classList.add('hidden');
            if (chevron) chevron.classList.remove('rotate-180');
            resetAllWrappers();
            
            scrim.classList.add('opacity-0');
            setTimeout(() => { 
                if (scrim.classList.contains('opacity-0')) scrim.classList.add('hidden'); 
            }, 300);
        }
    } else {
        // 3. Force Close All (used when clicking the scrim itself or navigating away)
        allLists.forEach((id, idx) => {
            const el = document.getElementById(id);
            const chev = document.getElementById(allChevrons[idx]);
            if (el) el.classList.add('hidden');
            if (chev) chev.classList.remove('rotate-180');
        });
        resetAllWrappers();
        
        scrim.classList.add('opacity-0');
        setTimeout(() => { 
            if (scrim.classList.contains('opacity-0')) scrim.classList.add('hidden'); 
        }, 300);
    }
};

// --- GLOBAL APP HUB CLOSER (GUARDIAN UX FIX) ---
window.closeAppHub = function(fromPopState = false) {
    const sn = document.getElementById('sidenav');
    const overlay = document.getElementById('sidenav-overlay');
    
    // GUARDIAN Phase 3: Failsafe telemetry wipe
    if (window.Admin && window.Admin.telemetryInterval) {
        clearInterval(window.Admin.telemetryInterval);
        window.Admin.telemetryInterval = null;
    }
    
    // 🛡️ GUARDIAN UX: Ensure cinematic scrim is released if Sidenav closes
    if (window.toggleDropdownScrim) window.toggleDropdownScrim();

    if (sn) {
        sn.classList.remove('translate-x-0');
        sn.classList.add('-translate-x-full');
        sn.classList.remove('open'); // GUARDIAN: CSS JIT bypass sync
    }
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('sidenav-open');
    unlockBackgroundScroll(); // GUARDIAN: Release scroll when sidenav closes
    
    // GUARDIAN Phase 9: Sync with History API to keep Router clean
    if (!fromPopState && location.hash === '#sidenav') {
        history.back();
    }
};

// --- GLOBAL ERROR HANDLER (SILENT NINJA PROTOCOL) ---
window.onerror = function(msg, url, line, col, error) {
    // GUARDIAN V6.20: Sentry ErrorEvent Unwrap
    if (typeof msg === 'object') {
        msg = (msg.message) ? msg.message : ((error && error.message) ? error.message : "Unknown Error Object");
    }

    const IGNORED_ERRORS = [
        "Script error.",
        "_AutofillCallbackHandler",
        "ResizeObserver loop limit exceeded",
        "Unexpected end of input", 
        "Unexpected token",
        "Unexpected token '<'", // GROWTH MODE: Captive Portal / HTML Cloudflare intercept shield
        "Unexpected end of JSON input",
        "JSON.parse: unexpected end of data",
        "chrome-extension",
        "ethereum", // 🛡️ GUARDIAN PHASE 1: Brave Browser / Crypto Wallet noise filter
        "__firefox__", // 🛡️ GUARDIAN PHASE 1: Extension noise filter
        "DarkReader" // 🛡️ GUARDIAN PHASE 1: Dark Mode extension noise filter
    ];

    if (typeof msg === 'string' && IGNORED_ERRORS.some(err => msg.indexOf(err) > -1)) {
        console.warn("Global Error Suppressed (Ignored Keyword):", msg);
        return false;
    }

    // 🛡️ GUARDIAN UX FIX: The Blind-Spot Shield
    // If URL is undefined, blank, or null, it means the crash was thrown by an invisible
    // eval() script—usually an Ad blocker, Chrome Extension, or third-party ad network payload.
    // We strictly ignore these to prevent the app from nuking itself over third-party noise.
    if (!url || String(url) === 'undefined' || String(url) === 'null' || String(url).trim() === '') {
        console.warn("🛡️ Guardian: Suppressed invisible external error:", msg);
        return false;
    }

    console.error("Global Error Caught:", msg);
    
    const overlay = document.getElementById('loading-overlay');
    const content = document.getElementById('main-content');
    
    if (overlay) overlay.style.display = 'none';
    if (content) content.style.display = 'block';
    
    // GUARDIAN: Safe Session Storage
    let hasReloaded = false;
    try { hasReloaded = sessionStorage.getItem('error_reloaded'); } catch(e) {}

    if (!hasReloaded) {
        try { sessionStorage.setItem('error_reloaded', 'true'); } catch(e) {}
        // GUARDIAN (Option B): Silent Ninja Protocol (Strike 1)
        // Silently attempt a recovery reload without jarring the user with a toast.
        setTimeout(() => window.location.reload(), 1000);
        return false;
    }

    // GUARDIAN (Phase 2): Safe Mode Fallback (Strike 2)
    console.log("🛡️ Guardian: Strike 2 Error intercepted. Deploying Safe Mode.");
    
    // GROWTH MODE PHASE 4 & 6 (DATA PIPELINE): Secure Firebase PUT Bypass to /sys_logs/ to evade AdBlockers
    const crashId = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const crashPayload = {
        error: String(msg),
        line: `${line}:${col}`,
        url: String(url),
        stack: error && error.stack ? error.stack : 'N/A',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        routeId: typeof currentRouteId !== 'undefined' && currentRouteId ? currentRouteId : 'none',
        appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown',
        deviceId: typeof NEXT_TRAIN_DEVICE_ID !== 'undefined' ? NEXT_TRAIN_DEVICE_ID : 'unknown' // 🛡️ GUARDIAN FIX: Admin Reply Bridge
    };
    
    try {
        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        fetch(`${dynamicEndpoint}sys_logs/crashes/${crashId}.json`, {
            method: 'PUT',
            body: JSON.stringify(crashPayload)
        }).catch(()=>{}); // Silent fire and forget
    } catch(e) {}

    // Legacy Google Forms Encoding
    const errorDetails = `Error: ${msg}\nLine: ${line}:${col}\nURL: ${url}\nStack: ${error && error.stack ? error.stack : 'N/A'}`;
    const encodedError = encodeURIComponent(errorDetails);
    
    // NOTE: Make sure to replace entry.123456789 with your actual Google Form entry ID: 1546175845
    const feedbackUrl = `https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform?entry.1546175845=${encodedError}`;
    
    document.body.innerHTML = `
        <div class="fixed inset-0 bg-gray-900 z-[9999] flex flex-col items-center justify-center p-6 text-center">
            <div class="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-red-500/20">
                <span class="text-3xl">⚠️</span>
            </div>
            <h2 class="text-2xl font-black text-white mb-2 tracking-tight">App Crashed (Safe Mode)</h2>
            <p class="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed">A fatal data error occurred. Please clear your offline cache to resync the latest schedules.</p>
            <div class="w-full max-w-xs space-y-3">
                <button id="safe-mode-clear-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-colors w-full focus:outline-none">
                    Clear Cache & Restart
                </button>
                <a href="${feedbackUrl}" target="_blank" class="flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3.5 px-6 rounded-xl shadow-lg transition-colors w-full border border-gray-700 focus:outline-none text-sm">
                    <span class="mr-2">✉️</span> Report Crash to Developer
                </a>
            </div>
        </div>
    `;

    // 🛡️ GUARDIAN PHASE 2: Document Body Event Delegation to survive Translation DOM manipulation
    document.body.addEventListener('click', function(e) {
        if (e.target.closest('#safe-mode-clear-btn')) {
            try { 
                if (typeof safeStorage !== 'undefined') safeStorage.flushVolatile(); 
                else { localStorage.clear(); sessionStorage.clear(); } 
            } catch(ex) {} 
            
            if (window.indexedDB) indexedDB.deleteDatabase('NextTrainDB'); 
            
            if (window.caches) { 
                caches.keys().then(k => Promise.all(k.map(n => caches.delete(n)))).finally(() => window.location.href = window.location.pathname + '?v=' + Date.now());
            } else { 
                window.location.href = window.location.pathname + '?v=' + Date.now(); 
            }
        }
    });
    
    return false;
};

// --- GUARDIAN OFFLINE TRACKER V1.0 ---
const OfflineTracker = {
    queueKey: 'analytics_queue',
    enqueue: (eventName, params) => {
        try {
            const queue = JSON.parse(safeStorage.getItem(OfflineTracker.queueKey) || "[]");
            queue.push({ event: eventName, params: params, timestamp: Date.now() });
            if (queue.length > 50) queue.shift();
            safeStorage.setItem(OfflineTracker.queueKey, JSON.stringify(queue));
        } catch (e) { console.warn("OfflineTracker Error:", e); }
    },
    flush: () => {
        if (!navigator.onLine) return;
        try {
            const queue = JSON.parse(safeStorage.getItem(OfflineTracker.queueKey) || "[]");
            if (queue.length === 0) return;
            console.log(`[OfflineTracker] Flushing ${queue.length} events with stagger...`);
            
            // GUARDIAN PHASE 5: Staggered Analytics Flush
            // Pops one event every 300ms to prevent network-thread flooding and ad-blocker heuristics
            const processNext = () => {
                if (!navigator.onLine || queue.length === 0) {
                    if (queue.length > 0) safeStorage.setItem(OfflineTracker.queueKey, JSON.stringify(queue));
                    else safeStorage.removeItem(OfflineTracker.queueKey);
                    return;
                }
                
                const item = queue.shift();
                const enrichedParams = { ...item.params, offline_captured: true, original_ts: item.timestamp };
                
                trackAnalyticsEvent(item.event, enrichedParams);
                
                safeStorage.setItem(OfflineTracker.queueKey, JSON.stringify(queue));
                
                if (queue.length > 0) {
                    setTimeout(processNext, 300);
                }
            };
            
            processNext();
        } catch (e) { console.warn("OfflineTracker Flush Error:", e); }
    }
};

// --- 🛡️ GUARDIAN UX: UNIQUE DEVICE IDENTITY (Clarity Sync) ---
let NEXT_TRAIN_DEVICE_ID = safeStorage.getItem('next_train_device_id');
if (!NEXT_TRAIN_DEVICE_ID) {
    NEXT_TRAIN_DEVICE_ID = 'usr_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    try { safeStorage.setItem('next_train_device_id', NEXT_TRAIN_DEVICE_ID); } catch(e) {}
}

// --- ANALYTICS HELPER ---
function trackAnalyticsEvent(eventName, params = {}) {
    params.region = typeof currentRegion !== 'undefined' ? currentRegion : 'GP';
    
    // GUARDIAN PHASE 2: Event Payload Hardening
    // Explicitly attach the immutable device ID to every individual event payload.
    // This perfectly aligns offline events and nested tracker payloads to the core identity.
    if (NEXT_TRAIN_DEVICE_ID) {
        params.device_id = NEXT_TRAIN_DEVICE_ID;
    }

    if (!navigator.onLine) { OfflineTracker.enqueue(eventName, params); return; }
    
    try {
        if (typeof gtag === 'function') { 
            // 🛡️ GUARDIAN FIX: crm_region is now set globally in index.html to prevent (not set) buckets.
            // We only attach the custom_device_id here as a fail-safe sync.
            gtag('set', 'user_properties', { 
                custom_device_id: NEXT_TRAIN_DEVICE_ID
            });
            gtag('event', eventName, params); 
        }
    } catch (e) { console.warn("[Analytics] GA4 Error:", e); }
    
    try {
        if (typeof clarity === 'function') {
            // GROWTH MODE PHASE 1: MS Clarity Fortification
            // Force Clarity to strictly align its internal unique ID generation with our PWA ID
            // to stop browser-vs-PWA duplicate counting.
            if (NEXT_TRAIN_DEVICE_ID) {
                clarity("identify", NEXT_TRAIN_DEVICE_ID);
                clarity("set", "custom_id", NEXT_TRAIN_DEVICE_ID); 
            }
            clarity("set", "crm_region", params.region);
            clarity("event", eventName);
        }
    } catch (e) { console.warn("[Analytics] Clarity Error:", e); }
}

// 🛡️ GROWTH MODE PHASE 1: IDLE UPDATE PROTOCOL
// If an update is waiting (via SW) and the user puts the app in the background
// for more than 5 minutes, we silently apply it. This prevents the "zombie app" effect.
let appBackgroundTimestamp = null;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        appBackgroundTimestamp = Date.now();
    } else {
        if (appBackgroundTimestamp) {
            const idleDuration = Date.now() - appBackgroundTimestamp;
            // > 5 minutes (300,000 ms)
            if (idleDuration > 300000 && window._pendingUpdateReg && window._pendingUpdateReg.waiting) {
                console.log("🛡️ Guardian: App was idle for > 5 mins. Forcing silent background update.");
                window._pendingUpdateReg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            
            // Re-sync clarity to ensure session didn't die while offline
            if (typeof clarity === 'function' && NEXT_TRAIN_DEVICE_ID) {
                try { clarity("identify", NEXT_TRAIN_DEVICE_ID); } catch(e){}
            }
        }
        appBackgroundTimestamp = null;
    }
});

// GUARDIAN Phase 11: Dynamic Offline State Tracking
window.addEventListener('online', () => { 
    console.log("Network restored. Flushing analytics queue."); 
    OfflineTracker.flush(); 
    const oi = document.getElementById('offline-indicator');
    if (oi) oi.style.display = 'none';
    
    // 🛡️ GUARDIAN FIX: Reset the offline toast lock and hide it if currently visible
    window._hasShownOfflineToast = false;
    const offlineToast = document.getElementById('offline-toast');
    if (offlineToast) offlineToast.classList.add('translate-y-[150%]', 'opacity-0');
});

window.addEventListener('offline', () => { 
    const oi = document.getElementById('offline-indicator');
    if (oi) oi.style.display = 'flex';
    
    // 🛡️ GUARDIAN FIX: Throttled Offline Toast (Only fires once per genuine offline transition)
    if (!window._hasShownOfflineToast) {
        window._hasShownOfflineToast = true;
        const offlineToast = document.getElementById('offline-toast');
        if (offlineToast) {
            offlineToast.classList.remove('translate-y-[150%]', 'opacity-0');
            if (window._lieFiToastTimeout) clearTimeout(window._lieFiToastTimeout);
            window._lieFiToastTimeout = setTimeout(() => {
                offlineToast.classList.add('translate-y-[150%]', 'opacity-0');
            }, 4000);
        }
    }
});

// --- NEXT TRAIN AUTOCOMPLETE ENGINE (GUARDIAN V6.16) ---
window._renderNextTrainList = function() {
    const input = document.getElementById('station-search-input');
    const select = document.getElementById('station-select');
    const list = document.getElementById('next-train-autocomplete-list');
    if (!input || !select || !list) return;

    list.innerHTML = '';
    const matches = allStations;

    if (matches.length === 0) {
        const li = document.createElement('li');
        
        // GUARDIAN BUGFIX: Protect users from seeing "No stations on this route" when the app is merely loading the database.
        if (!fullDatabase) {
            li.className = "p-4 text-sm text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center bg-blue-50 dark:bg-blue-900/20";
            li.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Loading stations... please wait`;
        } else {
            li.className = "p-4 text-sm text-gray-400 italic text-center";
            li.textContent = "No stations on this route";
        }
        
        list.appendChild(li);
    } else {
        matches.forEach(station => {
            const li = document.createElement('li');
            li.className = "p-3.5 border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-base sm:text-lg font-medium text-gray-700 dark:text-gray-200 transition-colors";
            li.textContent = station.replace(' STATION', '');
            li.onclick = () => {
                input.value = station.replace(' STATION', '');
                select.value = station;
                const event = new Event('change');
                select.dispatchEvent(event);
                list.classList.add('hidden');
            };
            list.appendChild(li);
        });
    }
    list.classList.remove('hidden');
};

function setupNextTrainAutocomplete() {
    const input = document.getElementById('station-search-input');
    const select = document.getElementById('station-select');
    if (!input || !select) return;

    select.classList.add('hidden');
    input.classList.remove('hidden');

    if (input.parentNode && getComputedStyle(input.parentNode).position === 'static') {
        input.parentNode.style.position = 'relative';
    }

    let chevron = document.getElementById('next-train-chevron');
    if (!chevron && input.parentNode) {
        chevron = document.createElement('div');
        chevron.id = 'next-train-chevron';
        chevron.className = "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer p-2 hover:text-blue-500 z-10 transition-colors";
        chevron.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
        input.parentNode.appendChild(chevron);
    }

    let list = document.getElementById('next-train-autocomplete-list');
    if (!list && input.parentNode) {
        list = document.createElement('ul');
        list.id = 'next-train-autocomplete-list';
        // 🛡️ GROWTH MODE PHASE 7: Removed scroll-locks (overscroll-contain touch-pan-y) to fix mobile scroll freezing
        list.className = "absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-xl max-h-60 overflow-y-auto hidden mt-1 left-0 custom-scrollbar text-left";
        input.parentNode.appendChild(list);
        
        input.addEventListener('click', (e) => { 
            e.stopPropagation();
            if (list.classList.contains('hidden')) {
                window._renderNextTrainList(); 
            } else {
                list.classList.add('hidden');
            }
        });
        
        if (chevron) {
            chevron.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                if (list.classList.contains('hidden')) {
                    window._renderNextTrainList();
                } else {
                    list.classList.add('hidden');
                }
            });
        }
        
        document.addEventListener('click', (e) => { 
            if (!input.contains(e.target) && !list.contains(e.target) && (!chevron || !chevron.contains(e.target))) {
                if (!list.classList.contains('hidden')) {
                    list.classList.add('hidden');
                }
            } 
        });
    }
}
// --- RENDERER BRIDGES ---

function getRoutesForCurrentRegion() {
    const regionalRoutes = {};
    if (typeof ROUTES === 'undefined') return regionalRoutes;
    for (const key in ROUTES) {
        if (ROUTES[key].region === currentRegion) {
            regionalRoutes[key] = ROUTES[key];
        }
    }
    return regionalRoutes;
}

function renderSkeletonLoader(element) { if (element && typeof Renderer !== 'undefined') Renderer.renderSkeletonLoader(element); }

// GUARDIAN PHASE 2: CLS Eradication (min-h-[96px] lock)
function renderPlaceholder() {
    const triggerShake = `
        const inp = document.getElementById('station-search-input');
        const sel = document.getElementById('station-select');
        const target = (inp && !inp.classList?.contains('hidden')) ? inp : sel;
        if(target) {
            target.classList?.add('animate-shake', 'ring-4', 'ring-blue-300'); 
            setTimeout(() => target.classList?.remove('animate-shake', 'ring-4', 'ring-blue-300'), 500); 
            target.focus?.();
        }
    `;
    
    const placeholderHTML = `
        <div onclick="${triggerShake.replace(/\n/g, ' ')}" class="min-h-[96px] h-auto flex flex-col justify-center items-center text-gray-400 dark:text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors group w-full shadow-sm border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50">
            <svg class="w-6 h-6 mb-1 opacity-50 group-hover:scale-110 transition-transform text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <span class="text-xs font-bold group-hover:text-blue-500 transition-colors">Select station above</span>
        </div>`;

    if(pretoriaTimeEl) pretoriaTimeEl.innerHTML = placeholderHTML;
    if(pienaarspoortTimeEl) pienaarspoortTimeEl.innerHTML = placeholderHTML;

    if (typeof updateFareDisplay === 'function') {
        updateFareDisplay(null);
    }
    
    updateNextTrainView();
}

function renderRouteError(error) {
    // 1. Unfreeze the UI Dropdowns and Titles
    if (stationSelect) {
        stationSelect.innerHTML = '<option value="">Select a station...</option>';
        stationSelect.disabled = false;
    }
    const routeSubtitleText = document.getElementById('route-subtitle-text');
    if (routeSubtitleText) {
        routeSubtitleText.textContent = "Route Unavailable";
    }

    // 2. Build and Trigger the Communicative Network Error Modal
    let modal = document.getElementById('network-error-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'network-error-modal';
        modal.className = 'fixed inset-0 bg-black/80 z-[150] hidden flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-95 border border-red-200 dark:border-red-900/50">
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4 shadow-inner ring-4 ring-red-50 dark:ring-red-900/20">
                        <span class="text-3xl">📡</span>
                    </div>
                    <h3 class="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Weak Signal Detected</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                        We need a few seconds of stable internet to download the timetable for offline use. The app will automatically resume when the signal returns.
                    </p>
                    <div class="flex flex-col items-center justify-center space-y-3 mt-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-inner">
                        <svg class="animate-spin h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest" id="network-polling-text">Waiting for connection...</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        const pollText = document.getElementById('network-polling-text');
        if (pollText) {
            pollText.textContent = "Waiting for connection...";
            pollText.classList.remove('text-green-600', 'dark:text-green-400');
            pollText.classList.add('text-gray-500', 'dark:text-gray-400');
        }
    }
    
    // 3. 🛡️ GUARDIAN FIX: Modal Auto-Resolve Polling Loop
    if (window._networkPollInterval) clearInterval(window._networkPollInterval);
    window._networkPollInterval = setInterval(() => {
        if (navigator.onLine) {
            // Lightweight ping to verify actual internet access, defeating false-positive "router-only" Wi-Fi connections
            fetch('https://nexttrain-telemetry.enock.workers.dev/ping', { method: 'HEAD', cache: 'no-store' })
            .then(res => {
                if (res.ok || res.status === 405 || res.status === 404) {
                    clearInterval(window._networkPollInterval);
                    window._networkPollInterval = null;
                    const pollText = document.getElementById('network-polling-text');
                    if (pollText) {
                        pollText.textContent = "Signal restored! Syncing...";
                        pollText.classList.remove('text-gray-500', 'dark:text-gray-400');
                        pollText.classList.add('text-green-600', 'dark:text-green-400');
                    }
                    
                    setTimeout(() => {
                        if (location.hash === '#network-error') history.back();
                        else closeSmoothModal('network-error-modal');
                        
                        if (typeof loadAllSchedules === 'function') loadAllSchedules(true); 
                        else window.location.reload();
                    }, 800);
                }
            }).catch(() => {}); // Silent catch, keep polling
        }
    }, 3000);
    
    // Bind to the Router and Animation Engine
    history.pushState({ modal: 'network-error' }, '', '#network-error');
    if (typeof openSmoothModal === 'function') {
        openSmoothModal('network-error-modal');
    } else {
        modal.classList.remove('hidden');
    }
}

function renderComingSoon(element, routeName) {
    const msg = `
        <div class="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-center w-full">
            <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <span class="text-3xl">🚧</span>
            </div>
            <h3 class="text-xl font-black text-gray-900 dark:text-white mb-2">Route Under Construction</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                We are currently building the digital timetable for the <strong class="text-blue-600 dark:text-blue-400">${routeName.replace('<->', '↔')}</strong> corridor.
            </p>
            
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 w-full text-left">
                <p class="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1 uppercase tracking-wider">Do you commute on this line?</p>
                <p class="text-xs text-gray-700 dark:text-gray-300 mb-4">
                    If you have recent photos of the official station timetables, you can help us launch this route faster!
                </p>
                <a href="https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform" target="_blank" class="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow transition-colors text-sm group">
                    <svg class="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0L8 8m4-4v12"></path></svg>
                    Share Schedules
                </a>
            </div>
        </div>
    `;
    if (element) {
        const pHeader = document.getElementById('pretoria-header');
        const pienHeader = document.getElementById('pienaarspoort-header');
        
        if (pHeader) pHeader.parentElement.style.display = 'none';
        if (pienHeader) pienHeader.parentElement.style.display = 'none';
        
        const parent = element.closest('.space-y-6') || element.closest('.space-y-4');
        if (parent) {
            parent.innerHTML = msg;
        } else {
            element.innerHTML = msg;
        }
    }
}

function renderAtDestination(element) { if (element && typeof Renderer !== 'undefined') Renderer.renderAtDestination(element); }

// GUARDIAN BUGFIX 4: Dynamically consumes nextDayInfo to build UI buttons
function renderNoService(element, destination) {
    if (!element) return;
    const currentRoute = typeof ROUTES !== 'undefined' ? ROUTES[currentRouteId] : null;
    if (!currentRoute) return;

    const selectedStation = stationSelect ? stationSelect.value : "";
    const simResult = typeof window.simulateNextActiveService === 'function' 
        ? window.simulateNextActiveService(selectedStation, destination) 
        : null;

    let firstTrain = simResult ? simResult.train : null;
    let daysAhead = simResult ? simResult.daysAhead : 1;

    if (typeof Renderer !== 'undefined') Renderer.renderNoService(element, destination, firstTrain, daysAhead);
}

function processAndRenderJourney(allJourneys, element, header, destination) {
    if (!element) return;
    if (!allJourneys || !Array.isArray(allJourneys)) return;

    const nowInSeconds = timeToSeconds(currentTime);
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= nowInSeconds);
    const nextJourney = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    const firstTrainName = allJourneys.length > 0 ? (allJourneys[0].train || allJourneys[0].train1.train) : null;
    
    if (!currentScheduleData) currentScheduleData = {};
    currentScheduleData[destination] = allJourneys;

    if (nextJourney) {
        const journeyTrainName = nextJourney.train || nextJourney.train1.train;
        nextJourney.isFirstTrain = (journeyTrainName === firstTrainName);
        const allRemainingTrainNames = new Set(remainingJourneys.map(j => j.train || j.train1.train));
        nextJourney.isLastTrain = (allRemainingTrainNames.size === 1);
        if (typeof Renderer !== 'undefined') Renderer.renderJourney(element, nextJourney, destination);
    } else {
        if (allJourneys.length === 0) {
              element.innerHTML = `<div class="min-h-[96px] flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">No scheduled trains.</div>`;
              return;
        }
        renderNextAvailableTrain(element, destination);
    }
}

function renderNextAvailableTrain(element, destination) {
    if (!element) return;
    const currentRoute = typeof ROUTES !== 'undefined' ? ROUTES[currentRouteId] : null;
    if (!currentRoute) return;

    const selectedStation = stationSelect ? stationSelect.value : "";
    const simResult = typeof window.simulateNextActiveService === 'function' 
        ? window.simulateNextActiveService(selectedStation, destination) 
        : null;

    if (!simResult) { 
        element.innerHTML = `<div class="min-h-[96px] flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">No upcoming trains.</div>`; 
        return; 
    }
    
    if (typeof Renderer !== 'undefined') {
        Renderer.renderNextAvailableTrain(element, destination, simResult.train, simResult.dayInfo.name, simResult.dayInfo.type, simResult.daysAhead);
    }
}

function updateFareDisplay(sheetKey) {
    const localFareContainer = document.getElementById('fare-container');
    const localPassengerTypeLabel = document.getElementById('passenger-type-label');
    
    if (!localFareContainer || !localFareContainer.parentNode) return; 

    if (localPassengerTypeLabel) {
        localPassengerTypeLabel.textContent = currentUserProfile;
    }

    const newFareContainer = localFareContainer.cloneNode(true);
    localFareContainer.parentNode.replaceChild(newFareContainer, localFareContainer);
    
    const activeFareContainer = newFareContainer;
    const activeFareAmount = document.getElementById('fare-amount');
    const activeFareType = document.getElementById('fare-type');

    activeFareContainer.className = "mb-6 p-3.5 rounded-xl flex items-center justify-between shadow-sm min-h-[58px] pr-10 relative transition-colors group";

    const fareData = typeof getRouteFare === 'function' ? getRouteFare(sheetKey) : null; 
    const detailed = typeof getDetailedFare === 'function' ? getDetailedFare(sheetKey) : null;
    
    if (detailed && detailed.prices) {
        activeFareContainer.onclick = () => openFareModal(detailed);
        activeFareContainer.classList.add('cursor-pointer');
        
        if (!document.getElementById('fare-chevron')) {
            const chevron = document.createElement('div');
            chevron.id = 'fare-chevron';
            chevron.className = "absolute right-3 top-1/2 transform -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity flex items-center justify-center shrink-0";
            chevron.innerHTML = `<svg class="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
            activeFareContainer.appendChild(chevron);
        }
    } else {
        const existingChevron = document.getElementById('fare-chevron');
        if(existingChevron) existingChevron.remove();
    }

    if (fareData) {
        if(activeFareAmount) activeFareAmount.textContent = `R${fareData.price}`;
        
        activeFareContainer.classList.add('bg-blue-50', 'dark:bg-gray-800', 'border', 'border-blue-100', 'dark:border-gray-700');
        if (detailed && detailed.prices) activeFareContainer.classList.add('hover:bg-blue-100', 'dark:hover:bg-gray-700');
        
        if(activeFareAmount) activeFareAmount.className = "text-2xl font-black text-gray-900 dark:text-white leading-none";

        if (fareData.isPromo) {
            if(activeFareType) {
                activeFareType.textContent = fareData.discountLabel || "Discounted";
                activeFareType.className = "text-[9px] font-bold text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap inline-block mt-1 shadow-sm border border-purple-200 dark:border-purple-800/50";
            }
        } else if (fareData.isOffPeak) {
            if(activeFareType) {
                activeFareType.textContent = "Off-Peak • 40% Off until 14:30"; 
                activeFareType.className = "text-[9px] font-bold text-green-600 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap inline-block mt-1 shadow-sm border border-green-200 dark:border-green-800/50";
            }
        } else {
            if(activeFareType) {
                activeFareType.textContent = "Standard Fare";
                activeFareType.className = "text-[9px] font-bold text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap inline-block mt-1 shadow-sm border border-gray-300 dark:border-gray-600";
            }
        }
    } else {
        activeFareContainer.classList.add('bg-blue-50', 'dark:bg-gray-800', 'border', 'border-blue-100', 'dark:border-gray-700');
        if(activeFareAmount) {
            activeFareAmount.textContent = "R --.--";
            activeFareAmount.className = "text-2xl font-black text-gray-300 dark:text-gray-600 leading-none";
        }
        if (stationSelect && stationSelect.value) {
             if(activeFareType) {
                 activeFareType.textContent = "Rate Unavailable";
                 activeFareType.className = "text-[9px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap inline-block mt-1 shadow-sm border border-yellow-200 dark:border-yellow-800/50";
             }
        } else {
             if(activeFareType) activeFareType.className = "hidden";
        }
    }
    
    activeFareContainer.classList.remove('hidden');
}

window.openFareModal = function(fareDetails) {
    triggerHaptic();
    
    if (!fareDetails) return;
    
    // GROWTH MODE: Track Fare Modal Interactions (Monetization Hook)
    trackAnalyticsEvent('view_fare_modal', { 
        zone: fareDetails.code,
        route_id: typeof currentRouteId !== 'undefined' ? currentRouteId : 'none'
    });

    let modal = document.getElementById('fare-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fare-modal';
        modal.className = 'fixed inset-0 bg-black/80 z-[140] hidden flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col transform transition-transform duration-300 scale-95 max-h-[85vh]">
                <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-2xl shrink-0">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white flex flex-col items-start justify-center" id="fare-zone-badge">Ticket Prices</h3>
                    <button onclick="closeSmoothModal('fare-modal')" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition focus:outline-none">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div class="p-6 overflow-y-auto flex-grow text-gray-700 dark:text-gray-300">
                    <div id="fare-table-content" class="space-y-0"></div>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-6">Prices are subject to change. Confirm at station.</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1">Off-Peak Fares apply weekdays between 09:30 and 14:30.</p>
                </div>
                <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl shrink-0">
                    <button onclick="closeSmoothModal('fare-modal')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors focus:outline-none">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const zoneEl = document.getElementById('fare-zone-badge');
    const tableEl = document.getElementById('fare-table-content');
    
    const routeName = typeof ROUTES !== 'undefined' && currentRouteId && ROUTES[currentRouteId] ? ROUTES[currentRouteId].name.replace('<->', '↔') : '';
    if (zoneEl) {
        zoneEl.innerHTML = `
            <div class="flex items-center">
                Ticket Prices <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 ml-2 px-2 py-0.5 rounded-full uppercase tracking-widest">Zone ${fareDetails.code}</span>
            </div>
            ${routeName ? `<span class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">${routeName}</span>` : ''}
        `;
    }

    if (tableEl) {
        const profile = FARE_CONFIG.profiles[currentUserProfile] || FARE_CONFIG.profiles["Adult"];
        const prices = fareDetails.prices;
        
        const calc = (basePrice) => (Math.ceil((basePrice * profile.base) * 2) / 2).toFixed(2);
        
        tableEl.innerHTML = `
            <div class="flex justify-between items-center py-3 border-b border-dashed border-gray-300 dark:border-gray-600">
                <span class="text-gray-600 dark:text-gray-400 text-sm font-bold">Single Trip</span>
                <span class="font-black text-gray-900 dark:text-white text-lg">R${calc(prices.single)}</span>
            </div>
            <div class="flex justify-between items-center py-3 border-b border-dashed border-gray-300 dark:border-gray-600">
                <span class="text-gray-600 dark:text-gray-400 text-sm font-bold">Return Trip</span>
                <span class="font-black text-gray-900 dark:text-white text-lg">R${calc(prices.return)}</span>
            </div>
            <div class="flex justify-between items-center py-3 border-b border-dashed border-gray-300 dark:border-gray-600">
                <span class="text-gray-600 dark:text-gray-400 text-sm font-bold">Weekly <span class="opacity-70 font-normal">(Mon-Fri)</span></span>
                <span class="font-black text-gray-900 dark:text-white text-lg">R${calc(prices.weekly_mon_fri)}</span>
            </div>
            <div class="flex justify-between items-center py-3 border-b border-dashed border-gray-300 dark:border-gray-600">
                <span class="text-gray-600 dark:text-gray-400 text-sm font-bold">Weekly <span class="opacity-70 font-normal">(Mon-Sat)</span></span>
                <span class="font-black text-gray-900 dark:text-white text-lg">R${calc(prices.weekly_mon_sat)}</span>
            </div>
            <div class="flex justify-between items-center py-3">
                <span class="text-gray-600 dark:text-gray-400 text-sm font-bold">Monthly Pass</span>
                <span class="font-black text-gray-900 dark:text-white text-lg">R${calc(prices.monthly)}</span>
            </div>
        `;
    }

    openSmoothModal('fare-modal');
};

// --- UTILS ---

function showToast(message, type = 'info', duration = 2500, actionHTML = '') { 
    const toastEl = document.getElementById('toast');
    
    // 🛡️ GUARDIAN: Debounce spamming. Ignore if the exact same message is already visible.
    if (toastEl && toastEl.classList.contains('show') && toastEl.innerText.includes(message.replace(/<[^>]*>?/gm, '').trim())) {
        return;
    }

    if (toastTimeout) clearTimeout(toastTimeout); 
    
    const safeDuration = Math.min(duration, 5000);

    if (!document.getElementById('toast-guardian-style')) {
        const style = document.createElement('style');
        style.id = 'toast-guardian-style';
        style.innerHTML = `
            #toast { 
                position: fixed; 
                bottom: 24px; 
                left: 50%; 
                transform: translateX(-50%) translateY(150%); 
                opacity: 0; 
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease; 
                pointer-events: none; 
                z-index: 9999;
                width: max-content;
                max-width: 90vw;
            }
            #toast.show { 
                transform: translateX(-50%) translateY(0); 
                opacity: 1; 
                pointer-events: auto; 
            }
        `;
        document.head.appendChild(style);
    }

    if (!toastEl) return;

    let bgClass = "bg-gray-900/90 dark:bg-gray-800/95";
    let textClass = "text-white";
    let borderClass = "border-gray-700 dark:border-gray-600";
    let iconHTML = '';

    if (type === 'success') {
        bgClass = "bg-green-900/95 dark:bg-green-800/95";
        borderClass = "border-green-700 dark:border-green-600";
        iconHTML = `<svg class="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    } else if (type === 'error') {
        bgClass = "bg-red-900/95 dark:bg-red-800/95";
        borderClass = "border-red-700 dark:border-red-600";
        iconHTML = `<svg class="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (type === 'warning') {
        bgClass = "bg-yellow-900/95 dark:bg-yellow-800/95";
        borderClass = "border-yellow-700 dark:border-yellow-600";
        iconHTML = `<svg class="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    }

    toastEl.className = `flex items-center justify-between px-4 py-3 rounded-full shadow-2xl backdrop-blur-md border ${bgClass} ${borderClass} ${textClass} max-w-[90vw]`; 

    toastEl.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden">
            ${iconHTML}
            <span class="text-sm font-medium tracking-wide break-words line-clamp-2">${message}</span>
        </div>
        ${actionHTML ? `<div class="ml-3 pl-3 border-l border-white/20 shrink-0">${actionHTML}</div>` : ''}
    `;
    
    // 🛡️ GUARDIAN: Prevent pull-to-refresh ghost triggers when highlighting text inside the toast
    toastEl.ontouchmove = (e) => e.stopPropagation();
    
    toastEl.classList.add('show'); 
    
    toastTimeout = setTimeout(() => { toastEl.classList.remove('show'); }, safeDuration); 
}

function copyToClipboard(text) { const textArea = document.createElement('textarea'); textArea.value = text; textArea.style.position = "fixed"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { const successful = document.execCommand('copy'); if (successful) showToast("Link copied to clipboard!", "success", 2000); } catch (err) {} document.body.removeChild(textArea); }

function loadUserProfile() {
    profileModal = document.getElementById('profile-modal');
    const settingsProfileDisplay = document.getElementById('settings-profile-display');
    const savedProfile = safeStorage.getItem('userProfile');
    
    if (savedProfile) {
        currentUserProfile = savedProfile;
    } else {
        currentUserProfile = "Adult";
        safeStorage.setItem('userProfile', "Adult");
    }
    
    if(settingsProfileDisplay) settingsProfileDisplay.textContent = currentUserProfile;
}

window.selectProfile = function(profileType) {
    currentUserProfile = profileType;
    safeStorage.setItem('userProfile', profileType);
    
    const settingsProfileDisplay = document.getElementById('settings-profile-display');
    if(settingsProfileDisplay) settingsProfileDisplay.textContent = profileType;
    
    if(profileModal) {
        closeSmoothModal('profile-modal');
    }
    showToast(`Profile set to: ${profileType}`, "success");
    findNextTrains(); 
};

window.resetProfile = function() {
    triggerHaptic();
    if(profileModal) {
        history.pushState({ modal: 'profile' }, '', '#profile');
        window.closeAppHub(); 
        setTimeout(() => { openSmoothModal('profile-modal'); }, 50);
    }
};

function updatePinUI() {
    const savedDefault = safeStorage.getItem('defaultRoute_' + currentRegion); 
    const isPinned = savedDefault === currentRouteId;
    if (pinOutline && pinFilled && pinRouteBtn) {
        if (isPinned) { pinOutline.classList.add('hidden'); pinFilled.classList.remove('hidden'); pinRouteBtn.title = "Unpin this route"; } 
        else { pinOutline.classList.remove('hidden'); pinFilled.classList.add('hidden'); pinRouteBtn.title = "Pin this route as default"; }
    }
    if (typeof Renderer !== 'undefined' && typeof ROUTES !== 'undefined') Renderer.renderRouteMenu('route-list', getRoutesForCurrentRegion(), currentRouteId);
}

function updateSidebarActiveState() {
    if (typeof Renderer !== 'undefined' && typeof ROUTES !== 'undefined') Renderer.renderRouteMenu('route-list', getRoutesForCurrentRegion(), currentRouteId);
}

function handleShortcutActions() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const route = urlParams.get('route');
    const view = urlParams.get('view'); 
    const linkRegion = urlParams.get('region'); 

    if (linkRegion && typeof currentRegion !== 'undefined' && linkRegion !== currentRegion) {
        console.log(`[DeepLink] Region mismatch. Switching from ${currentRegion} to ${linkRegion} and reloading...`);
        safeStorage.setItem('userRegion', linkRegion);
        window.location.href = window.location.href; 
        return; 
    }

    if (action || route) {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
        console.log("[DeepLink] URL Params Sanitized.");
    }

    if (route && typeof ROUTES !== 'undefined' && ROUTES[route]) {
        console.log(`[DeepLink] Auto-loading route: ${route}`);
        
        if (ROUTES[route].region && ROUTES[route].region !== currentRegion) {
            safeStorage.setItem('userRegion', ROUTES[route].region);
            window.location.href = window.location.href; 
            return;
        }

        if (ROUTES[route].isActive) {
            currentRouteId = route;
            if (welcomeModal) welcomeModal.classList.add('hidden');
            loadAllSchedules().then(() => {
                trackAnalyticsEvent('deep_link_open', { type: 'route', route_id: route });
                showToast(`Opened shared route: ${ROUTES[route].name}`, "success", 2000);
                
                if (view === 'grid') {
                    const direction = urlParams.get('dir') || 'A';
                    const dayOverride = urlParams.get('day') || null;
                    if (typeof renderFullScheduleGrid === 'function') {
                        setTimeout(() => {
                            renderFullScheduleGrid(direction, dayOverride);
                        }, 500);
                    }
                }
            });
            return;
        }
    }
    
    if (action === 'planner') {
        const fromParam = urlParams.get('from');
        const toParam = urlParams.get('to');
        const dayParam = urlParams.get('day');
        const timeParam = urlParams.get('time');
        switchTab('trip-planner');
        
        let attempts = 0;
        const maxAttempts = 20; 

        const checkReady = setInterval(() => {
            attempts++;
            if (typeof MASTER_STATION_LIST !== 'undefined' && MASTER_STATION_LIST.length > 0) {
                clearInterval(checkReady);
                const resolve = (txt) => {
                    if (!txt) return "";
                    const clean = decodeURIComponent(txt).trim().toUpperCase();
                    const exact = MASTER_STATION_LIST.find(s => s.replace(' STATION', '').toUpperCase() === clean);
                    if (exact) return exact;
                    const partial = MASTER_STATION_LIST.find(s => s.replace(' STATION', '').toUpperCase().includes(clean));
                    return partial || "";
                };
                const fromId = resolve(fromParam);
                const toId = resolve(toParam);
                if (fromId && toId) {
                    const fromSelect = document.getElementById('planner-from');
                    const toSelect = document.getElementById('planner-to');
                    const fromInput = document.getElementById('planner-from-search');
                    const toInput = document.getElementById('planner-to-search');
                    const daySelect = document.getElementById('planner-day-select');
                    if (fromSelect) fromSelect.value = fromId;
                    if (toSelect) toSelect.value = toId;
                    if (fromInput) {
                        fromInput.value = fromId.replace(' STATION', '');
                        fromInput.dataset.resolvedValue = fromId;
                    }
                    if (toInput) {
                        toInput.value = toId.replace(' STATION', '');
                        toInput.dataset.resolvedValue = toId;
                    }
                    if (daySelect && dayParam) { daySelect.value = dayParam; selectedPlannerDay = dayParam; }
                    if (typeof executeTripPlan === 'function') {
                        executeTripPlan(fromId, toId, timeParam);
                        trackAnalyticsEvent('deep_link_open', { type: 'planner', from: fromId, to: toId });
                        showToast("Loaded shared trip plan", "success");
                    }
                } else {
                    showToast("Could not resolve stations for shared trip.", "error");
                }
            } else if (attempts >= maxAttempts) {
                clearInterval(checkReady);
                console.warn("[DeepLink] Timed out waiting for station list.");
                showToast("Connection timeout: Could not load trip data.", "error");
            }
        }, 500);
    } else if (action === 'map') {
        if (typeof setupMapLogic === 'function') {
            const mapModal = document.getElementById('map-modal');
            if (mapModal) {
                openSmoothModal('map-modal');
                history.pushState({ modal: 'map' }, '', '#map');
                const mapImage = document.getElementById('map-image');
                if(mapImage) mapImage.style.transform = `translate(0px, 0px) scale(1)`;
            }
        }
    }
}

window.performHardCacheClear = async function(source = 'modal_confirm') {
    triggerHaptic();
    
    if (source === 'modal_confirm') {
        trackAnalyticsEvent('execute_hard_cache_clear', { location: 'sidebar' });
        showToast("Clearing offline data and syncing...", "info", 5000);

        await new Promise(resolve => setTimeout(resolve, 600));
    }
    
    window.closeAppHub(true); 
    
    const modal = document.getElementById('cache-clear-modal');
    if (modal) {
        closeSmoothModal('cache-clear-modal');
    }
    
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        if ('caches' in window) {
            const names = await caches.keys();
            for (let name of names) {
                await caches.delete(name);
            }
        }

        if (typeof safeStorage.flushVolatile === 'function') {
            safeStorage.flushVolatile();
        } else {
            safeStorage.removeItem(`full_db_${currentRegion}`); 
            safeStorage.removeItem('app_installed_version');
        }
        
        if (window.indexedDB) {
            await new Promise((resolve) => {
                try {
                    // Only target NextTrainDB. Do NOT loop through and delete all IndexedDBs!
                    const req = indexedDB.deleteDatabase('NextTrainDB');
                    req.onsuccess = resolve;
                    req.onerror = resolve;
                    req.onblocked = resolve;
                } catch(e) { resolve(); }
            });
            console.log("🛡️ Guardian: IndexedDB 'NextTrainDB' successfully queued for deletion.");
        }
    } catch (e) {
        console.warn("🛡️ Guardian: Failed to fully clear caches", e);
    }
    
    setTimeout(() => {
        window.location.href = window.location.pathname + '?v=' + Date.now();
    }, 500);
};

window.showCacheClearWarning = function() {
    if (!navigator.onLine) {
        showToast("You must be online to check for updates.", "warning");
        return;
    }
    triggerHaptic();
    trackAnalyticsEvent('check_updates_click', { location: 'sidebar' });
    window.closeAppHub(true); 
    let modal = document.getElementById('cache-clear-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cache-clear-modal';
        modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-[140] hidden flex items-center justify-center p-4 transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-95 border border-gray-200 dark:border-gray-700">
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900 mb-4 shadow-inner">
                        <svg class="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15"></path></svg>
                    </div>
                    <h3 class="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Sync Latest Schedule?</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">This will clear your offline cache and download the absolute latest App version from the server.</p>
                    <div class="flex space-x-3">
                        <button onclick="closeSmoothModal('cache-clear-modal')" class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-colors focus:outline-none">Cancel</button>
                        <button onclick="performHardCacheClear('modal_confirm')" class="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors focus:outline-none">Sync Now</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    history.pushState({ modal: 'cache-clear-modal' }, '', '#cacheclear');
    openSmoothModal('cache-clear-modal');
}

// --- THE AD INTERCEPTOR HAS BEEN SECURELY PURGED ---

function initializeApp() {
    if (window.location.pathname.endsWith('index.html')) {
        const newPath = window.location.pathname.replace('index.html', '');
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);
    }
    
    let exitTrapSet = false;
    try { exitTrapSet = sessionStorage.getItem('exitTrapSet'); } catch(e) {}

    if (!exitTrapSet) {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) {
            history.replaceState({ view: 'exit-trap' }, '', '#exit');
            history.pushState({ view: 'home' }, '', '#home');
        } else {
            history.replaceState({ view: 'home' }, '', '#home');
        }
        try { sessionStorage.setItem('exitTrapSet', 'true'); } catch(e) {}
    }

    loadUserProfile(); 
    populateStationList();
    if (typeof initPlanner === 'function') initPlanner();
    
    updatePinUI();
    
    if (typeof window.startClock === 'function') {
        window.startClock();
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('action') && !urlParams.has('route')) { findNextTrains(); }
    checkServiceAlerts();
    checkMaintenanceStatus(); 
    handleShortcutActions();
    
    if(mainContent && currentRouteId) {
        mainContent.style.display = 'block';
    }
    
    updateNextTrainView();
    if(stationSelect && !stationSelect.value) renderPlaceholder();

    if (!navigator.onLine) { 
        const oi = document.getElementById('offline-indicator');
        if (oi) oi.style.display = 'flex';
    }
}

async function checkMaintenanceStatus() {
    if (!navigator.onLine || window.isLieFi) return; 
    try {
        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        const res = await fetch(`${dynamicEndpoint}config/maintenance.json?t=${Date.now()}`);
        
        // 🛡️ GUARDIAN PHASE 2: Captive Portal Trap (Prevents Unexpected token '<' crash)
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) throw new Error("Captive Portal Detected");
        
        const maintData = await res.json();
        
        const existingBanner = document.getElementById('maintenance-banner');

        // 🛡️ GUARDIAN FIX: Backwards compatibility for boolean vs object payload
        const isMaintActive = maintData === true || (maintData !== null && typeof maintData === 'object' && maintData.active === true);
        const customMessage = (maintData !== null && typeof maintData === 'object' && maintData.message) ? maintData.message : 'MAINTENANCE IN PROGRESS';

        if (isMaintActive) {
            if (!existingBanner) {
                const banner = document.createElement('div');
                banner.id = 'maintenance-banner';
                banner.style.background = 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 10px, #d97706 10px, #d97706 20px)';
                // 🛡️ GUARDIAN FIX: Global fixed positioning with ultra-high z-index to escape all stacking contexts
                banner.className = "fixed top-0 left-0 w-full z-[9999] text-white text-[11px] font-black uppercase tracking-widest text-center py-1 shadow-lg";
                banner.innerHTML = `⚠️ ${customMessage.toUpperCase()}`; // Forced uppercase to retain the emergency aesthetic
                document.body.prepend(banner);
            } else {
                // If the banner is already on-screen but the Admin changed the message, update it live
                existingBanner.innerHTML = `⚠️ ${customMessage.toUpperCase()}`;
            }
        } else {
            if (existingBanner) {
                existingBanner.remove();
            }
        }
    } catch(e) { /* silent fail */ }
}

// 🛡️ GUARDIAN UX: INTERACTIVE POLL VOTE HANDLER
window.submitPollVote = function(pollId, optionKey, optionText) {
    triggerHaptic();
    
    if (safeStorage.getItem('poll_voted_' + pollId)) {
        showToast("You have already voted on this poll.", "warning");
        return;
    }

    trackAnalyticsEvent('alert_poll_vote', { 
        poll_id: pollId, 
        vote_option: optionKey,
        vote_text: optionText,
        route_id: currentRouteId || 'global'
    });

    try { safeStorage.setItem('poll_voted_' + pollId, optionKey); } catch(e) {}

    // 🛡️ GUARDIAN PHASE 8: Send Poll Data to Firebase
    try {
        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        const payload = {
            optionKey: optionKey,
            optionText: optionText,
            timestamp: Date.now(),
            deviceId: typeof NEXT_TRAIN_DEVICE_ID !== 'undefined' ? NEXT_TRAIN_DEVICE_ID : 'unknown'
        };
        // Fire and forget
        fetch(`${dynamicEndpoint}polls/${pollId}.json`, {
            method: 'POST',
            body: JSON.stringify(payload)
        }).catch(()=>{});
    } catch(e) {}

    const container = document.getElementById(`poll-container-${pollId}`);
    if (container) {
        container.innerHTML = `
            <div class="text-center animate-fade-in-up">
                <span class="text-2xl block mb-1">✅</span>
                <p class="text-xs font-bold text-green-800 dark:text-green-300">Thanks for voting!</p>
                <p class="text-[10px] text-green-600 dark:text-green-500 mt-0.5">Your response has been recorded.</p>
            </div>
        `;
        container.className = "mt-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-800 shadow-inner transition-all";
    }

    showToast("Vote recorded successfully!", "success");
};

async function checkServiceAlerts() {
    const bellBtn = document.getElementById('notice-bell');
    const dot = document.getElementById('notice-dot');
    const modal = document.getElementById('notice-modal');
    const content = document.getElementById('notice-content');
    const timestamp = document.getElementById('notice-timestamp');
    if (!bellBtn) return;

    try {
        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        
        // 1. CHECK COMMUTER INBOX FIRST (Priority Message Hook)
        let adminReply = null;
        if (typeof NEXT_TRAIN_DEVICE_ID !== 'undefined' && NEXT_TRAIN_DEVICE_ID) {
            try {
                const inboxRes = await fetch(`${dynamicEndpoint}inbox/${NEXT_TRAIN_DEVICE_ID}.json?t=${Date.now()}`);
                if (inboxRes.ok) {
                    // 🛡️ GUARDIAN PHASE 2: Captive Portal Trap
                    const contentType = inboxRes.headers.get('content-type') || '';
                    if (contentType.includes('text/html')) throw new Error("Captive Portal Detected");
                    
                    const inboxData = await inboxRes.json();
                    if (inboxData) {
                        const unreadKeys = Object.keys(inboxData).filter(k => inboxData[k] && !inboxData[k].read);
                        if (unreadKeys.length > 0) {
                            // Find the most recently pushed unread message
                            const latestKey = unreadKeys.sort((a,b) => inboxData[b].timestamp - inboxData[a].timestamp)[0];
                            adminReply = inboxData[latestKey];
                            adminReply._key = latestKey;

                            // 🛡️ GUARDIAN PHASE 8: Mark Delivered (2 Grey Ticks)
                            const undeliveredKeys = unreadKeys.filter(k => !inboxData[k].delivered);
                            if (undeliveredKeys.length > 0) {
                                const updates = {};
                                undeliveredKeys.forEach(k => {
                                    updates[`${k}/delivered`] = true;
                                    updates[`${k}/deliveredAt`] = Date.now();
                                });
                                fetch(`${dynamicEndpoint}inbox/${NEXT_TRAIN_DEVICE_ID}.json`, {
                                    method: 'PATCH',
                                    body: JSON.stringify(updates)
                                }).catch(()=>{});
                            }
                        }
                    }
                }
            } catch (e) { console.warn("Inbox fetch failed", e); }
        }

        // --- INBOX BANNER LOGIC ---
        const replyBanner = document.getElementById('developer-reply-banner');
        const viewReplyBtn = document.getElementById('view-reply-btn');
        
        if (adminReply && replyBanner) {
            replyBanner.classList.remove('hidden');
            
            if (viewReplyBtn) {
                viewReplyBtn.onclick = () => {
                    if (typeof triggerHaptic === 'function') triggerHaptic();
                    
                    const replyContent = document.getElementById('developer-reply-content');
                    const markReadBtn = document.getElementById('mark-reply-read-btn');
                    
                    if (replyContent) {
                        // 🛡️ GUARDIAN UX UPGRADE: Dynamically morph modal layout for edge-to-edge scrolling
                        const replyModalCard = document.querySelector('#developer-reply-modal > div');
                        if (replyModalCard && !replyModalCard.dataset.styled) {
                            replyModalCard.dataset.styled = "true";
                            replyModalCard.classList.add('max-h-[85vh]', 'flex', 'flex-col', 'p-0', 'overflow-hidden');
                            replyModalCard.classList.remove('p-6');
                            
                            const headerDiv = replyModalCard.querySelector('.flex.items-center.justify-between');
                            if (headerDiv) {
                                headerDiv.classList.add('p-5', 'bg-white', 'dark:bg-gray-800', 'border-b', 'border-gray-200', 'dark:border-gray-700', 'shrink-0');
                                headerDiv.classList.remove('mb-4');
                            }
                            
                            replyContent.classList.add('overflow-y-auto', 'custom-scrollbar', 'flex-grow', 'p-5', 'rounded-none', 'border-0', 'mb-0');
                            replyContent.classList.remove('mb-6', 'rounded-xl', 'border', 'border-gray-200', 'dark:border-gray-700');
                        }

                        // 🛡️ GUARDIAN PHASE 2: Strict DOMParser XSS Sanitization
                        const sanitizeHTML = (dirtyHtml) => {
                            const doc = new DOMParser().parseFromString(dirtyHtml, 'text/html');
                            const allowedTags = ['B', 'I', 'STRONG', 'EM', 'A', 'BR', 'P', 'SPAN', 'DIV', 'UL', 'OL', 'LI'];
                            const cleanNode = (node) => {
                                Array.from(node.childNodes).forEach(child => {
                                    if (child.nodeType === 1) { // ELEMENT_NODE
                                        if (!allowedTags.includes(child.tagName)) {
                                            // Strip the tag but keep its text/children
                                            child.replaceWith(...Array.from(child.childNodes));
                                            cleanNode(node); // Re-evaluate flattened children
                                        } else {
                                            // Clean attributes (only allow href, target, class, rel)
                                            Array.from(child.attributes).forEach(attr => {
                                                const attrName = attr.name.toLowerCase();
                                                if (attrName === 'href') {
                                                    // Block javascript: URIs
                                                    if (!/^(https?|mailto):/i.test(attr.value)) child.removeAttribute(attr.name);
                                                } else if (!['target', 'class', 'rel'].includes(attrName)) {
                                                    child.removeAttribute(attr.name);
                                                }
                                            });
                                            cleanNode(child);
                                        }
                                    }
                                });
                            };
                            cleanNode(doc.body);
                            return doc.body.innerHTML;
                        };
                        
                        replyContent.innerHTML = sanitizeHTML(adminReply.message || '');
                    }
                    
                    if (markReadBtn) {
                        markReadBtn.textContent = "Got it, Thanks!";
                        
                        // 🛡️ GUARDIAN UX FIX: Prepare Side-by-Side Flex Container
                        let actionsContainer = document.getElementById('admin-message-actions') || markReadBtn.parentNode;
                        actionsContainer.className = "flex space-x-3 w-full"; // Force 50/50 split container
                        
                        // Update markReadBtn to be flex-1
                        markReadBtn.className = "flex-1 bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-bold py-3 rounded-xl shadow-md transition-colors focus:outline-none text-sm";

                        markReadBtn.onclick = async () => {
                            if (typeof triggerHaptic === 'function') triggerHaptic();
                            markReadBtn.disabled = true;
                            markReadBtn.textContent = "Marking...";
                            try {
                                await fetch(`${dynamicEndpoint}inbox/${NEXT_TRAIN_DEVICE_ID}/${adminReply._key}.json`, {
                                    method: 'PATCH',
                                    // 🛡️ GUARDIAN PHASE 3: Added acknowledged: true for 'R' status
                                    body: JSON.stringify({ read: true, readAt: Date.now(), acknowledged: true })
                                });
                            } catch(e) {}
                            
                            closeSmoothModal('developer-reply-modal');
                            replyBanner.classList.add('hidden');
                        };

                        // 🛡️ GUARDIAN PHASE 1: Threaded Commuter Reply Button
                        let replyToAdminBtn = document.getElementById('reply-to-admin-btn');
                        if (!replyToAdminBtn) {
                            replyToAdminBtn = document.createElement('button');
                            replyToAdminBtn.id = 'reply-to-admin-btn';
                            // 🛡️ GUARDIAN UX FIX: Changed w-full to flex-1 and removed mt-3 to sit perfectly side-by-side
                            replyToAdminBtn.className = "flex-1 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 font-bold py-3 rounded-xl shadow-sm transition-colors focus:outline-none flex items-center justify-center text-sm";
                            replyToAdminBtn.innerHTML = `<span class="mr-2">💬</span> Reply to Admin`;
                            actionsContainer.appendChild(replyToAdminBtn);
                        }
                        
                        replyToAdminBtn.onclick = () => {
                            if (typeof triggerHaptic === 'function') triggerHaptic();
                            
                            const fText = document.getElementById('feedback-text');
                            const fType = document.getElementById('feedback-type');
                            
                            if (fText) {
                                let contextBox = document.getElementById('feedback-reply-context');
                                if (!contextBox) {
                                    contextBox = document.createElement('div');
                                    contextBox.id = 'feedback-reply-context';
                                    contextBox.className = 'mb-3 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 italic flex items-start hidden shadow-inner';
                                    fText.parentNode.insertBefore(contextBox, fText);
                                }
                                
                                // 🛡️ GUARDIAN UX FIX: Robust DOMParser to eradicate all HTML bleeding
                                let cleanAdminMsg = '';
                                if (adminReply.message) {
                                    const tempDoc = new DOMParser().parseFromString(adminReply.message, 'text/html');
                                    cleanAdminMsg = tempDoc.body.textContent || tempDoc.body.innerText || '';
                                }
                                cleanAdminMsg = cleanAdminMsg.replace(/—.*/, '').trim(); // Remove the "— Enock" signature part
                                
                                let words = cleanAdminMsg.split(/\s+/).filter(w => w.length > 0);
                                let truncatedAdminMsg = words.slice(0, 8).join(' ') + (words.length > 8 ? '...' : '');
                                
                                contextBox.innerHTML = `<span class="mr-2 text-sm leading-none">💬</span><div><span class="block font-bold text-[10px] uppercase tracking-wider mb-0.5 text-gray-400">Replying to Admin:</span><span class="line-clamp-2">"${escapeHTML(truncatedAdminMsg)}"</span></div>`;
                                contextBox.dataset.rawMsg = `[REPLY TO ADMIN: ${adminReply._key}] ${truncatedAdminMsg}`;
                                contextBox.classList.remove('hidden');
                                fText.value = ''; 
                            }
                            
                            if (fType) {
                                // 🛡️ GUARDIAN UX FIX: Dynamically inject "Thread Reply" to stop metrics pollution
                                if (!fType.querySelector('option[value="thread_reply"]')) {
                                    const replyOpt = document.createElement('option');
                                    replyOpt.value = 'thread_reply';
                                    replyOpt.textContent = 'Thread Reply';
                                    fType.appendChild(replyOpt);
                                }
                                fType.value = 'thread_reply';
                            }
                            
                            closeSmoothModal('developer-reply-modal');
                            setTimeout(() => {
                                trackAnalyticsEvent('open_feedback_modal', { location: 'admin_inbox_reply' });
                                history.pushState({ modal: 'feedback' }, '', '#feedback');
                                openSmoothModal('feedback-modal');
                            }, 350);
                        };
                    }
                    
                    history.pushState({ modal: 'devreply' }, '', '#devreply');
                    // 🛡️ GUARDIAN UX: Bind Spatial Origin to the Blue Banner
                    openSmoothModal('developer-reply-modal', 'dev-banner');
                };
            }
            
            const devReplyCloseTop = document.querySelector('#developer-reply-modal button.text-gray-400');
            if (devReplyCloseTop) {
                devReplyCloseTop.onclick = (e) => {
                    e.preventDefault();
                    if (location.hash === '#devreply') history.back();
                    else closeSmoothModal('developer-reply-modal');
                };
            }
        } else if (replyBanner) {
            replyBanner.classList.add('hidden');
        }

        // 2. FETCH STANDARD NOTICES
        const response = await fetch(`${dynamicEndpoint}notices.json?t=${Date.now()}`);
        if (!response.ok) return; 
        
        // 🛡️ GUARDIAN PHASE 2: Captive Portal Trap
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) throw new Error("Captive Portal Detected");
        
        const notices = await response.json();
        
        const existingTicker = document.getElementById('service-ticker');
        if (existingTicker) existingTicker.remove();
        
        if (!notices) { 
            bellBtn.classList.add('hidden'); 
            return; 
        }
        
        let activeNotice = null;
        const now = Date.now();
        let validNotices = [];
        
        const activeRegionString = typeof currentRegion !== 'undefined' ? currentRegion : 'GP';
        const targetKeys = [typeof currentRouteId !== 'undefined' ? currentRouteId : null, `all_${activeRegionString}`, 'all'].filter(Boolean);
        
        targetKeys.forEach(key => {
            if (notices[key] && notices[key].expiresAt && notices[key].expiresAt > now) {
                validNotices.push(notices[key]);
            }
        });

        if (validNotices.length === 0) {
            bellBtn.classList.add('hidden');
            return;
        }

        const severityScore = { 'critical': 3, 'warning': 2, 'info': 1 };
        validNotices.sort((a, b) => (severityScore[b.severity] || 1) - (severityScore[a.severity] || 1));
        
        activeNotice = validNotices[0];

        const severity = activeNotice.severity || 'info';
        const seenKey = `seen_notice_${activeNotice.id}`;
        const hasSeen = safeStorage.getItem(seenKey) === 'true';
        const forcePopup = activeNotice.forcePopup === true;
        
        // --- CONTENT BINDER ---
        const bindModalContent = () => {
            if (!content || !modal) return;
            
            // 🛡️ GUARDIAN UX UPGRADE: Dynamic Modal Borders & Headers
            const modalCard = modal.firstElementChild;
            if (modalCard) {
                modalCard.classList.remove('border-red-500', 'border-yellow-500', 'border-blue-500', 'border-red-200', 'dark:border-red-900/50');
                if (severity === 'critical') modalCard.classList.add('border-red-500');
                else if (severity === 'warning') modalCard.classList.add('border-yellow-500');
                else modalCard.classList.add('border-blue-500');
            }

            const modalHeader = modal.querySelector('h3');
            if (modalHeader) {
                const headerContainer = modalHeader.parentElement;
                if (headerContainer) {
                    // Remove the hardcoded SVG from index.html during rendering to let the emoji shine
                    const existingIcon = headerContainer.querySelector('svg');
                    if (existingIcon) existingIcon.remove();
                    headerContainer.className = `flex items-center shrink-0 ${severity === 'critical' ? 'text-red-600 dark:text-red-400' : (severity === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400')}`;
                }
                modalHeader.innerHTML = severity === 'critical' ? '🔴 CRITICAL ADVISORY' : (severity === 'warning' ? '🟡 SERVICE WARNING' : '🔵 SERVICE INFO');
            }
            
            let formattedMsg = activeNotice.message;
            
            // 🛡️ GUARDIAN PHASE 3: Data Source Citation Injection
            if (activeNotice.sourceName) {
                const sName = escapeHTML(activeNotice.sourceName);
                const sUrl = activeNotice.sourceUrl ? escapeHTML(activeNotice.sourceUrl) : null;
                const innerCitation = sUrl ? `<a href="${sUrl}" target="_blank" class="hover:underline text-blue-600 dark:text-blue-400 font-medium flex items-center">${sName} <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>` : `<span class="font-medium text-gray-700 dark:text-gray-300">${sName}</span>`;
                const sourceHtml = `<div class="mt-3 p-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] text-gray-500 dark:text-gray-400 italic flex items-center shadow-sm w-fit max-w-full"><span class="mr-1.5 not-italic text-sm">📰</span><span class="flex items-center space-x-1"><span>Source:</span> ${innerCitation}</span></div>`;
                
                // Intelligently insert the citation BEFORE the Admin signoff block if it exists
                const signoffMatch = formattedMsg.match(/<br><br><span[^>]*>—.*?<\/span>$/);
                if (signoffMatch) {
                    formattedMsg = formattedMsg.replace(signoffMatch[0], sourceHtml + signoffMatch[0]);
                } else {
                    formattedMsg += sourceHtml;
                }
            }

            let mediaHtml = '';
            if (activeNotice.imageUrl) {
                mediaHtml += `<img src="${escapeHTML(activeNotice.imageUrl)}" class="w-full h-auto max-h-48 object-cover rounded-lg mb-3 shadow-sm border border-gray-200 dark:border-gray-700" alt="Alert Image" onerror="this.style.display='none'">`;
            }

            content.innerHTML = mediaHtml + formattedMsg;
            
            // CTA Button Injection
            if (activeNotice.ctaUrl && activeNotice.ctaText) {
                content.innerHTML += `
                    <a href="${escapeHTML(activeNotice.ctaUrl)}" target="_blank" class="mt-4 flex items-center justify-center w-full bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 font-bold py-2.5 px-4 rounded-lg transition-colors text-xs uppercase tracking-wide border border-blue-200 dark:border-blue-800 shadow-sm focus:outline-none">
                        ${escapeHTML(activeNotice.ctaText)}
                        <svg class="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                `;
            }

            // Interactive Polling Engine
            if (activeNotice.poll && activeNotice.poll.active) {
                const pollId = activeNotice.id;
                const votedOption = safeStorage.getItem('poll_voted_' + pollId);

                let pollHtml = '';
                if (votedOption) {
                    pollHtml = `
                        <div class="mt-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-800 text-center shadow-inner">
                            <span class="text-xl block mb-1">✅</span>
                            <p class="text-xs font-bold text-green-800 dark:text-green-300">Thanks for voting!</p>
                            <p class="text-[10px] text-green-600 dark:text-green-500 mt-0.5">Your response has been recorded.</p>
                        </div>
                    `;
                } else {
                    pollHtml = `
                        <div id="poll-container-${pollId}" class="mt-4 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
                            <p class="text-sm font-black text-purple-900 dark:text-purple-100 mb-3 leading-tight text-center">${escapeHTML(activeNotice.poll.question)}</p>
                            <div class="flex space-x-3">
                                <button onclick="submitPollVote('${pollId}', 'A', '${escapeHTML(activeNotice.poll.optionA)}')" class="flex-1 bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-700 hover:border-purple-500 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 font-bold py-2.5 rounded-lg transition-all transform hover:scale-105 text-xs focus:outline-none shadow-sm">${escapeHTML(activeNotice.poll.optionA)}</button>
                                <button onclick="submitPollVote('${pollId}', 'B', '${escapeHTML(activeNotice.poll.optionB)}')" class="flex-1 bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-700 hover:border-purple-500 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 font-bold py-2.5 rounded-lg transition-all transform hover:scale-105 text-xs focus:outline-none shadow-sm">${escapeHTML(activeNotice.poll.optionB)}</button>
                            </div>
                        </div>
                    `;
                }
                content.innerHTML += pollHtml;
            }
            
            const date = new Date(activeNotice.postedAt);
            if (timestamp) timestamp.textContent = `Posted: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, ${date.toLocaleDateString()}`;

            // Dynamic Button Injection
            const oldCloseBtn = modal.querySelector('button.bg-red-600') || modal.querySelector('button.bg-blue-600') || modal.querySelector('button.bg-yellow-600') || modal.querySelector('#notice-close-btn');
            
            // Clean up old instances cleanly
            const oldContainer = modal.querySelector('.flex.space-x-2.mt-4');
            if (oldContainer) oldContainer.remove();

            let baseColorClass = "bg-blue-600 hover:bg-blue-700";
            if (severity === 'critical') baseColorClass = "bg-red-600 hover:bg-red-700";
            else if (severity === 'warning') baseColorClass = "bg-yellow-600 hover:bg-yellow-700";

            const btnContainer = document.createElement('div');
            btnContainer.className = "flex space-x-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 w-full";
            
            const newCloseBtn = document.createElement('button');
            newCloseBtn.id = "notice-close-btn";
            newCloseBtn.className = "flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors focus:outline-none";
            newCloseBtn.textContent = "Close";
            newCloseBtn.onclick = closeNotice;
            btnContainer.appendChild(newCloseBtn);

            const newReplyBtn = document.createElement('button');
            newReplyBtn.className = `flex-1 ${baseColorClass} text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors focus:outline-none flex items-center justify-center`;
            newReplyBtn.innerHTML = `<span class="mr-1.5">💬</span> Reply`;
            
            newReplyBtn.onclick = () => {
                triggerHaptic();
                
                let cleanMsgText = "";
                if (activeNotice && activeNotice.message) {
                    const tempDoc = new DOMParser().parseFromString(activeNotice.message, 'text/html');
                    cleanMsgText = tempDoc.body.textContent || tempDoc.body.innerText || '';
                    cleanMsgText = cleanMsgText.replace(/—.*/, '').trim();
                }
                
                let words = cleanMsgText.split(/\s+/).filter(w => w.length > 0);
                let truncatedMsg = words.slice(0, 6).join(' ');
                if (words.length > 6) truncatedMsg += '...';
                
                const fText = document.getElementById('feedback-text');
                const fType = document.getElementById('feedback-type');
                
                if (fText) {
                    let contextBox = document.getElementById('feedback-reply-context');
                    if (!contextBox) {
                        contextBox = document.createElement('div');
                        contextBox.id = 'feedback-reply-context';
                        contextBox.className = 'mb-3 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 italic flex items-start hidden shadow-inner';
                        fText.parentNode.insertBefore(contextBox, fText);
                    }
                    contextBox.innerHTML = `<span class="mr-2 text-sm leading-none">💬</span><div><span class="block font-bold text-[10px] uppercase tracking-wider mb-0.5 text-gray-400">Replying to Advisory:</span><span class="line-clamp-2">"${truncatedMsg}"</span></div>`;
                    contextBox.dataset.rawMsg = truncatedMsg;
                    contextBox.dataset.alertId = activeNotice.id; // 🛡️ GUARDIAN FIX: Attach ID using local activeNotice object
                    contextBox.classList.remove('hidden');
                    fText.value = ''; 
                }
                
                if (fType) {
                    if (!fType.querySelector('option[value="thread_reply"]')) {
                        const replyOpt = document.createElement('option');
                        replyOpt.value = 'thread_reply';
                        replyOpt.textContent = 'Thread Reply';
                        fType.appendChild(replyOpt);
                    }
                    fType.value = 'thread_reply';
                }
                
                closeNotice();
                setTimeout(() => {
                    trackAnalyticsEvent('open_feedback_modal', { location: 'alert_reply' });
                    history.pushState({ modal: 'feedback' }, '', '#feedback');
                    openSmoothModal('feedback-modal');
                }, 350);
            };
            btnContainer.appendChild(newReplyBtn);

            if (oldCloseBtn && oldCloseBtn.parentNode) {
                oldCloseBtn.style.display = 'none'; 
                oldCloseBtn.parentNode.appendChild(btnContainer);
            } else {
                content.parentNode.appendChild(btnContainer);
            }
        };
        
        bellBtn.classList.remove('hidden');
        
        let bellClass = "absolute top-4 right-4 z-50 p-1.5 rounded-full shadow-md focus:outline-none hover:scale-105 transition-transform ";
        let dotClass = "absolute top-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 transform translate-x-1/4 -translate-y-1/4 ";

        if (severity === 'critical') {
            bellClass += "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300";
            dotClass += "bg-red-600";
        } else if (severity === 'warning') {
            bellClass += "bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300";
            dotClass += "bg-yellow-500";
        } else {
            bellClass += "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300";
            dotClass += "bg-blue-600";
        }

        bellBtn.className = bellClass;
        if (dot) dot.className = dotClass;

        if (!hasSeen) {
            if (dot) dot.classList.remove('hidden');
            if (severity === 'critical') {
                bellBtn.classList.add('animate-shake');
            } else {
                bellBtn.classList.remove('animate-shake');
            }

            const isWelcomeScreenActive = (typeof currentRouteId === 'undefined' || !currentRouteId) || (document.getElementById('welcome-modal') && !document.getElementById('welcome-modal').classList.contains('hidden'));

            if (forcePopup && !window._criticalModalShown && !isWelcomeScreenActive) {
                window._criticalModalShown = true;
                setTimeout(() => {
                    triggerHaptic();
                    trackAnalyticsEvent('auto_open_alert', { severity: severity, route_id: typeof currentRouteId !== 'undefined' ? currentRouteId : 'all' });
                    safeStorage.setItem(seenKey, 'true');
                    bellBtn.classList.remove('animate-shake');
                    if (dot) dot.classList.add('hidden');
                    bindModalContent();
                    history.pushState({ modal: 'notice' }, '', '#notice');
                    openSmoothModal('notice-modal');
                }, 1200);
            }
        } else {
            bellBtn.classList.remove('animate-shake');
            if (dot) dot.classList.add('hidden');
        }

        bellBtn.onclick = () => {
            triggerHaptic();
            trackAnalyticsEvent('view_service_alert', { severity: severity, route_id: typeof currentRouteId !== 'undefined' ? currentRouteId : 'all' });
            safeStorage.setItem(seenKey, 'true');
            bellBtn.classList.remove('animate-shake');
            if (dot) dot.classList.add('hidden');
            bindModalContent();
            history.pushState({ modal: 'notice' }, '', '#notice');
            openSmoothModal('notice-modal');
        };

        const topCloseBtn = modal ? modal.querySelector('button.text-gray-400') : null;
        
        const closeNotice = () => {
            if(location.hash === '#notice') history.back();
            else closeSmoothModal('notice-modal');
        };
        
        if (topCloseBtn) topCloseBtn.onclick = closeNotice;

    } catch (e) { console.warn("Alert check failed:", e); }
}

function syncPlannerFromMain(stationName) {
    if (!stationName) return;
    const plannerInput = document.getElementById('planner-from-search');
    const plannerSelect = document.getElementById('planner-from');
    if (plannerInput && plannerSelect) {
        if (!plannerSelect.querySelector(`option[value="${stationName}"]`)) {
            const opt = document.createElement('option');
            opt.value = stationName;
            opt.textContent = stationName;
            plannerSelect.appendChild(opt);
        }
        plannerSelect.value = stationName;
        plannerInput.value = stationName.replace(' STATION', '');
        plannerInput.dataset.resolvedValue = stationName;
    }
}

function setupModalButtons() { 
    const closeAction = () => { 
        if (location.hash === '#schedule') history.back();
        else { 
            closeSmoothModal('schedule-modal'); 
        }
    }; 
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeAction); 
    if (closeModalBtn2) closeModalBtn2.addEventListener('click', closeAction); 
    if (scheduleModal) scheduleModal.addEventListener('click', (e) => { if (e.target === scheduleModal) closeAction(); }); 
}

function switchTab(tab) {
    if (tab === 'trip-planner') {
        if (location.hash !== '#planner') history.pushState({ tab: 'planner' }, '', '#planner');
    } else {
        if (location.hash !== '#home' && location.hash !== '') history.replaceState({ tab: 'next-train' }, '', '#home'); 
    }
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    
    let targetBtn;
    if (tab === 'next-train') {
        targetBtn = document.getElementById('tab-next-train');
        const view = document.getElementById('view-next-train');
        if (view) view.classList.add('active');
    } else {
        targetBtn = document.getElementById('tab-trip-planner');
        const view = document.getElementById('view-trip-planner');
        if (view) view.classList.add('active');
    }
    
    if(targetBtn) { 
        targetBtn.classList.add('active'); 
        setTimeout(() => moveTabIndicator(targetBtn), 50); 
    }
    safeStorage.setItem('activeTab', tab);
}

// GUARDIAN PHASE 1.2: Complete popstate rebuild. Modals check precedes Router Bleed trap.
window.addEventListener('popstate', (event) => {
    // 🛡️ GROWTH MODE PHASE 3: The Zombie Lock Garbage Collector
    // Safely sweep the DOM for open modals after transition delays. If none exist, ruthlessly unlock scrolling.
    setTimeout(() => {
        const anyOpenModals = document.querySelectorAll('div[id$="-modal"].fixed:not(.hidden)');
        if (anyOpenModals.length === 0 && !document.body.classList.contains('sidenav-open')) {
            unlockBackgroundScroll();
        }
    }, 350);

    // GUARDIAN Phase 2: Router Bleed Lock
    if (window._isModalAnimating) {
        console.log("🛡️ Guardian: Suppressed popstate router bleed during modal animation.");
        history.pushState(null, '', location.href || '#home'); 
        return;
    }

    // 🛡️ GUARDIAN PHASE 11: Admin Router Bug Fix (The Back-Button Trap)
    // If the admin is drilled down into a specific panel (e.g. Service Alerts), intercept the back button 
    // and click the "drill-back-btn" to return them to the Admin Grid, rather than dropping them to the home screen.
    if (window.Admin && window.Admin.isGridMode === false) {
        const drillBackBtn = document.getElementById('drill-back-btn');
        if (drillBackBtn) {
            drillBackBtn.click();
            return; // Halt popstate cascade!
        }
    }

    const hash = location.hash;

    if (hash === '#exit') {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (!isStandalone) {
            return; 
        }

        const activeTab = safeStorage.getItem('activeTab');
        
        if (activeTab === 'trip-planner') {
            history.pushState({ view: 'home' }, '', '#home');
            switchTab('next-train');
            return;
        } else {
            openSmoothModal('exit-modal');
            history.pushState({ view: 'home' }, '', '#home');
            return;
        }
    }

    if (document.body.classList.contains('sidenav-open')) {
        window.closeAppHub(true);
        return; 
    }

    // 1. EVALUATE & CLOSE MODALS FIRST (Highest Z-Index)
    const openModals = Array.from(document.querySelectorAll('div[id$="-modal"].fixed:not(.hidden)'));

    if (openModals.length > 0) {
        let highestZ = -1;
        let modalToClose = null;

        openModals.forEach(modal => {
            let zIndex = 0;
            const zMatch = modal.className.match(/z-\[?(\d+)\]?/);
            if (zMatch && zMatch[1]) {
                zIndex = parseInt(zMatch[1], 10);
            } else {
                const computedZ = window.getComputedStyle(modal).zIndex;
                if (computedZ !== 'auto') zIndex = parseInt(computedZ, 10);
            }

            if (zIndex > highestZ) {
                highestZ = zIndex;
                modalToClose = modal.id;
            }
        });

        if (modalToClose) {
            closeSmoothModal(modalToClose);
            if (location.hash === '#sidenav' && !document.body.classList.contains('sidenav-open')) {
                setTimeout(() => history.back(), 10);
            }
            return; 
        }
    }

    // 2. NOW CHECK PLANNER RESULTS (Lower Z-Index than Modals)
    const resultsSection = document.getElementById('planner-results-section');
    if (resultsSection && !resultsSection.classList.contains('hidden')) {
        if (typeof window.hidePlannerResults === 'function') window.hidePlannerResults();
        return; 
    }

    if (location.hash === '#sidenav' && !document.body.classList.contains('sidenav-open')) {
         history.back();
         return;
    }

    if (!location.hash || location.hash === '#home') {
        const activeTab = safeStorage.getItem('activeTab');
        if (activeTab === 'trip-planner') switchTab('next-train');
    }
});

function initTabIndicator() {
    const tabNext = document.getElementById('tab-next-train');
    if (!tabNext) return;
    const container = tabNext.parentElement;
    if (!container) return;
    container.classList.add('relative'); 
    let indicator = document.getElementById('tab-sliding-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'tab-sliding-indicator';
        indicator.className = "absolute bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-300 ease-out z-10";
        container.appendChild(indicator);
        const style = document.createElement('style');
        style.innerHTML = `.tab-btn { border-bottom-color: transparent !important; } .tab-btn.active { border-bottom-color: transparent !important; }`;
        document.head.appendChild(style);
    }
    
    const updateIndicator = () => {
        const currentActive = document.querySelector('.tab-btn.active') || document.getElementById('tab-next-train');
        if (currentActive) moveTabIndicator(currentActive);
    };

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => requestAnimationFrame(updateIndicator));
        ro.observe(container);
    } else {
        requestAnimationFrame(() => setTimeout(updateIndicator, 150)); 
    }
    
    window.addEventListener('resize', updateIndicator);
}

function moveTabIndicator(element) {
    const indicator = document.getElementById('tab-sliding-indicator');
    if (!indicator || !element) return;
    
    requestAnimationFrame(() => {
        indicator.style.width = `${element.offsetWidth}px`;
        indicator.style.transform = `translateX(${element.offsetLeft}px)`;
    });
}

function handleSwipe(startX, endX, startY, endY) {
    const diffX = endX - startX;
    const diffY = endY - startY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) switchTab('next-train'); else switchTab('trip-planner');
    }
}

function setupSwipeNavigation() {
    let touchStartX = 0;
    let touchStartY = 0;
    const contentArea = document.getElementById('main-content');
    if (!contentArea) return; 
    
    contentArea.addEventListener('touchstart', (e) => {
        const mapModal = document.getElementById('map-modal');
        const scheduleModal = document.getElementById('schedule-modal');
        const aboutModal = document.getElementById('about-modal');
        
        if (document.body.classList.contains('sidenav-open') || 
            (mapModal && !mapModal.classList.contains('hidden')) || 
            (scheduleModal && !scheduleModal.classList.contains('hidden')) || 
            (aboutModal && !aboutModal.classList.contains('hidden'))) return;
            
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});
    
    contentArea.addEventListener('touchend', (e) => {
        const mapModal = document.getElementById('map-modal');
        const scheduleModal = document.getElementById('schedule-modal');
        const aboutModal = document.getElementById('about-modal');
        
        if (document.body.classList.contains('sidenav-open') || 
            (mapModal && !mapModal.classList.contains('hidden')) || 
            (scheduleModal && !scheduleModal.classList.contains('hidden')) || 
            (aboutModal && !aboutModal.classList.contains('hidden'))) return;
            
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
    }, {passive: true});
}

window.openScheduleModal = function(destination, dayOverride = null) {
    history.pushState({ modal: 'schedule' }, '', '#schedule');
    let journeys = [];
    let titleSuffix = "";
    let targetDayIdx = typeof currentDayIndex !== 'undefined' ? currentDayIndex : new Date().getDay();

    if (dayOverride) {
        const currentRoute = typeof ROUTES !== 'undefined' && typeof currentRouteId !== 'undefined' ? ROUTES[currentRouteId] : null;
        if (!currentRoute) return;
        
        let sheetKey = null;

        const selectedStation = stationSelect ? stationSelect.value : "";
        const simResult = typeof window.simulateNextActiveService === 'function'
            ? window.simulateNextActiveService(selectedStation, destination)
            : null;
        
        if (simResult && simResult.dayInfo.type === dayOverride) {
            targetDayIdx = simResult.dayInfo.idx;
            titleSuffix = ` (${simResult.dayInfo.name})`;
        } else {
            if (dayOverride === 'weekday') { targetDayIdx = 1; titleSuffix = " (Weekday)"; } 
            else if (dayOverride === 'saturday') { targetDayIdx = 6; titleSuffix = " (Weekend/Holiday)"; } 
        }

        if (dayOverride === 'weekday') { sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; } 
        else if (dayOverride === 'saturday') { sheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b'; } 
        else if (dayOverride === 'sunday') { sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; }

        const schedule = schedules[sheetKey];
        if (schedule) {
            if (destination === currentRoute.destA) { 
                journeys = findNextJourneyToDestA(selectedStation, "00:00:00", schedule, currentRoute, targetDayIdx).allJourneys; 
            } else { 
                journeys = findNextJourneyToDestB(selectedStation, "00:00:00", schedule, currentRoute, targetDayIdx).allJourneys; 
            }
        }
    } else {
        if (!currentScheduleData || !currentScheduleData[destination]) { showToast("No full schedule data available.", "error"); return; }
        journeys = currentScheduleData[destination]; 
    }

    if (!journeys || journeys.length === 0) { showToast("No trains found for this schedule.", "error"); return; }
    
    let fromStationName = "Upcoming Trains";
    if (stationSelect && stationSelect.value) {
        fromStationName = stationSelect.value.replace(' STATION', '');
    }
    if (modalTitle) modalTitle.textContent = `${fromStationName} -> ${destination.replace(' STATION', '')}${titleSuffix}`; 
    
    const toTitleCase = (str) => {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };

    if (modalList) modalList.innerHTML = '';
    const nowSeconds = typeof currentTime !== 'undefined' ? timeToSeconds(currentTime) : 0;
    let firstNextTrainFound = false;
    
    journeys.forEach(j => {
        const dep = j.departureTime || j.train1.departureTime; 
        const trainName = j.train || j.train1.train; 
        const type = j.type === 'transfer' ? 'Transfer' : 'Direct';
        const depSeconds = timeToSeconds(dep);
        let isPassed = false;
        if (!dayOverride) isPassed = depSeconds < nowSeconds;
        let divClass = "p-3 rounded shadow-sm flex justify-between items-center transition-opacity duration-300";
        if (isPassed) divClass += " bg-gray-50 dark:bg-gray-800 opacity-50 grayscale"; else divClass += " bg-white dark:bg-gray-700"; 
        const div = document.createElement('div'); div.className = divClass;
        if (!isPassed && !firstNextTrainFound && !dayOverride) { div.id = "next-train-marker"; firstNextTrainFound = true; }
        
        let sharedTag = "";
        if (j.isShared && j.sourceRoute) {
             let rawName = j.sourceRoute.replace("Route", "").trim();
             let routeName = rawName;
             
             if (rawName.includes('<->')) {
                 routeName = rawName.split('<->')[1].trim();
             } else if (rawName.includes('↔')) {
                 routeName = rawName.split('↔')[1].trim();
             }

             if (j.isDivergent) {
                 const divDest = typeof Renderer !== 'undefined' ? Renderer._applyUIIntercepts(j.actualDestName) : j.actualDestName;
                 sharedTag = `<span class="text-[9px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-200 dark:border-red-800">⚠️ To ${toTitleCase(divDest)}</span>`;
             } else {
                 sharedTag = `<span class="text-[9px] font-bold text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900 px-1.5 py-0.5 rounded uppercase ml-2">From ${toTitleCase(routeName)}</span>`;
             }
        }
        
        const formattedDep = formatTimeDisplay(dep);
        let rightPillHTML = "";
        
        let terminationBadge = ""; 
        let isShortTrip = false;
        let shortDestName = "";

        if (j.type === 'direct' && j.actualDestination) {
            const actual = normalizeStationName(j.actualDestination);
            const target = normalizeStationName(destination);
            if (actual !== target) {
                isShortTrip = true;
                shortDestName = toTitleCase(j.actualDestination.replace(' STATION', ''));
                terminationBadge = ""; 
            }
        }

        if (sharedTag && sharedTag !== "") { 
            rightPillHTML = sharedTag; 
            sharedTag = ""; 
        } else {
            if (type === 'Direct') {
                if (isShortTrip) {
                    rightPillHTML = `<span class="text-[10px] font-bold text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900 px-2 py-0.5 rounded-full uppercase whitespace-nowrap">To ${shortDestName}</span>`;
                } else {
                    rightPillHTML = '<span class="text-[10px] font-bold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900 px-2 py-0.5 rounded-full uppercase">Direct</span>';
                }
            } else {
                let transferLabel = "";
                let transferSubtext = "";
                
                if (j.train1 && j.train1.headboardDestination) {
                    const hbDest = toTitleCase(j.train1.headboardDestination.replace(/ STATION/g, ''));
                    transferLabel = `To ${hbDest}`;
                    transferSubtext = " ";
                } else {
                    const transferHub = toTitleCase(j.train1.terminationStation.replace(' STATION',''));
                    transferLabel = `Transfer @ ${transferHub}`;
                }

                rightPillHTML = `
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] font-bold text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900 px-2 py-0.5 rounded-full uppercase text-right leading-tight mb-0.5">
                            ${transferLabel}
                        </span>
                        ${transferSubtext ? `<span class="text-[8px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tight">${transferSubtext}</span>` : ''}
                    </div>
                `;
            }
        }
        
        if (j.isLastTrain) rightPillHTML += ' <span class="text-[10px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-2 py-0.5 rounded-full uppercase border border-red-200 dark:border-red-800 ml-1">LAST TRAIN</span>';
        
        div.innerHTML = `
            <div>
                <span class="text-lg font-bold text-gray-900 dark:text-white">${formattedDep}</span>
                <div class="text-xs text-gray-500 dark:text-gray-400">Train ${trainName}</div>
                ${terminationBadge}
            </div>
            <div class="flex flex-col items-end gap-1 text-right">
                ${rightPillHTML}
            </div>
        `;
        if (modalList) modalList.appendChild(div);
    });
    
    openSmoothModal('schedule-modal');
    
    if (!dayOverride) { setTimeout(() => { const target = document.getElementById('next-train-marker'); if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 10); } 
    else { const container = document.getElementById('modal-list'); if(container) container.scrollTop = 0; }
};

// --- GUARDIAN PHASE 2: IN-HOUSE FEEDBACK PIPELINE ---
function setupFeedbackLogic() {
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', (e) => { 
            e.preventDefault(); 
            
            const contextBox = document.getElementById('feedback-reply-context');
            if (contextBox) {
                contextBox.classList.add('hidden');
                contextBox.dataset.rawMsg = '';
            }

            triggerHaptic();
            
            const currentRoute = typeof ROUTES !== 'undefined' && typeof currentRouteId !== 'undefined' && currentRouteId ? ROUTES[currentRouteId] : null;
            const isInactiveRoute = currentRoute && !currentRoute.isActive;
            
            if (isInactiveRoute || window.lastClickedFutureRegion) {
                trackAnalyticsEvent('open_google_form_feedback', { 
                    location: 'feedback_interceptor',
                    region: window.lastClickedFutureRegion || (typeof currentRegion !== 'undefined' ? currentRegion : 'GP')
                });
                
                window.open('https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform', '_blank');
                window.lastClickedFutureRegion = null; 
                return;
            }

            trackAnalyticsEvent('open_feedback_modal', { location: 'app_footer' });
            history.pushState({ modal: 'feedback' }, '', '#feedback');
            window.closeAppHub(true); 
            setTimeout(() => { openSmoothModal('feedback-modal'); }, 50); 
        }); 
    }

    const fileInput = document.getElementById('feedback-file');
    const filePreview = document.getElementById('feedback-file-preview');
    const fileNameDisplay = document.getElementById('feedback-file-name');
    const fileRemoveBtn = document.getElementById('feedback-file-remove');

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                
                if (file.size > 5242880) {
                    showToast("File is too large. Maximum size is 5MB.", "error");
                    this.value = '';
                    if (filePreview) filePreview.classList.add('hidden');
                    return;
                }
                if (fileNameDisplay) fileNameDisplay.textContent = file.name;
                if (filePreview) filePreview.classList.remove('hidden');
            } else {
                if (filePreview) filePreview.classList.add('hidden');
            }
        });
    }

    if (fileRemoveBtn) {
        fileRemoveBtn.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            if (filePreview) filePreview.classList.add('hidden');
        });
    }

    const submitBtn = document.getElementById('feedback-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitFeedback);
    }
}

async function submitFeedback() {
    const type = document.getElementById('feedback-type').value;
    let text = document.getElementById('feedback-text').value.trim();
    const email = document.getElementById('feedback-email').value.trim();
    const fileInput = document.getElementById('feedback-file');
    const submitBtn = document.getElementById('feedback-submit-btn');
    const submitText = document.getElementById('feedback-submit-text');
    const spinner = document.getElementById('feedback-spinner');

    if (!text || text.length < 5) {
        showToast("Please provide more details (at least 5 characters).", "error");
        return;
    }

    const contextBox = document.getElementById('feedback-reply-context');
    if (contextBox && !contextBox.classList.contains('hidden') && contextBox.dataset.rawMsg) {
        // 🛡️ GUARDIAN FIX: Inject explicit structured tag for exact Admin parsing
        let tagPrefix = "notice";
        if (contextBox.dataset.rawMsg.includes("Replying to Advisory:") && !contextBox.dataset.rawMsg.includes("REPLY TO ADMIN:")) {
            tagPrefix = "disruption";
        }
        
        let structuredTag = "";
        if (contextBox.dataset.alertId) {
            const routeSlug = (typeof currentRouteId !== 'undefined' && currentRouteId) ? currentRouteId : 'global';
            structuredTag = `\n[CTX:${tagPrefix}:${routeSlug}:${contextBox.dataset.alertId}]`;
        }

        const alertRef = contextBox.dataset.alertId ? ` Alert ID: ${contextBox.dataset.alertId}` : '';
        // Combine human-readable quote snippet with the hidden structured tag at the end
        text = `[Replying to: "${contextBox.dataset.rawMsg}"${alertRef}]${structuredTag}\n\n` + text;
    }

    const hasFile = !!(fileInput && fileInput.files && fileInput.files.length > 0);
    trackAnalyticsEvent('click_submit_feedback_btn', { feedback_type: type, has_attachment: hasFile });

    triggerHaptic();
    submitBtn.disabled = true;
    submitText.textContent = "Sending...";
    spinner.classList.remove('hidden');

    try {
        // 🛡️ GUARDIAN PHASE 2: Lie-Fi & Auth Guard (Stops auth/network-request-failed crash)
        if (!navigator.onLine || window.isLieFi) {
            throw new Error("Network disconnected. Cannot submit feedback while offline.");
        }

        if (window.firebaseAuth && !window.firebaseAuth.currentUser && window.firebaseSignInAnonymously) {
            await window.firebaseSignInAnonymously(window.firebaseAuth);
        }

        let authToken = "";
        if (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseGetIdToken) {
            authToken = await window.firebaseGetIdToken(window.firebaseAuth.currentUser, true);
        }

        let attachmentUrl = null;

        if (hasFile) {
            const file = fileInput.files[0];
            if (window.firebaseStorage && window.firebaseStorageRef && window.firebaseUploadBytesResumable && window.firebaseGetDownloadURL) {
                submitText.textContent = "Uploading File...";
                
                const fileExt = file.name.split('.').pop();
                const fileName = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
                const storageReference = window.firebaseStorageRef(window.firebaseStorage, `feedback_attachments/${fileName}`);
                
                const uploadTask = window.firebaseUploadBytesResumable(storageReference, file);
                
                const uploadPromise = new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        null, 
                        (error) => reject(error), 
                        async () => {
                            try {
                                attachmentUrl = await window.firebaseGetDownloadURL(uploadTask.snapshot.ref);
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        }
                    );
                });

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('UPLOAD_TIMEOUT')), 15000);
                });

                try {
                    await Promise.race([uploadPromise, timeoutPromise]);
                } catch (uploadError) {
                    console.warn("🛡️ Guardian: Image upload failed or timed out. Abandoning image to save text feedback.", uploadError);
                    if (uploadError.message === 'UPLOAD_TIMEOUT') {
                        uploadTask.cancel(); 
                    }
                    attachmentUrl = null; 
                }
            } else {
                console.warn("🛡️ Firebase Storage SDK not available. Skipping attachment.");
            }
        }

        submitText.textContent = "Saving...";

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone;

        const payload = {
            type: type,
            text: text,
            email: email,
            attachmentUrl: attachmentUrl,
            status: "unread",
            appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown',
            routeId: typeof currentRouteId !== 'undefined' ? currentRouteId : 'none',
            region: typeof currentRegion !== 'undefined' ? currentRegion : 'GP',
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            deviceId: typeof NEXT_TRAIN_DEVICE_ID !== 'undefined' ? NEXT_TRAIN_DEVICE_ID : 'unknown',
            isPWA: isStandalone
        };

        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        const authParam = authToken ? `?auth=${authToken}` : '';
        
        const res = await fetch(`${dynamicEndpoint}feedback.json${authParam}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to post to database: ${res.status} ${res.statusText} - ${errorText}`);
        }

        if (hasFile && !attachmentUrl) {
            showToast("Feedback sent! (Image upload was blocked by network and skipped)", "warning", 4000);
        } else {
            showToast("Feedback sent! Thank you.", "success");
        }
        closeSmoothModal('feedback-modal');
        
        // 🛡️ GUARDIAN 2.4: Smart Polling (20s for 10mins) to catch instant admin replies
        if (window._smartPollInterval) clearInterval(window._smartPollInterval);
        if (window._smartPollTimeout) clearTimeout(window._smartPollTimeout);

        window._smartPollInterval = setInterval(() => {
            if (typeof checkServiceAlerts === 'function') checkServiceAlerts();
        }, 20000);
        
        window._smartPollTimeout = setTimeout(() => {
            if (window._smartPollInterval) clearInterval(window._smartPollInterval);
            console.log("🛡️ Guardian: 10-minute smart polling window closed.");
        }, 600000); // 10 minutes
        
        document.getElementById('feedback-text').value = '';
        document.getElementById('feedback-email').value = '';
        document.getElementById('feedback-type').value = 'schedule_error';
        if (fileInput) fileInput.value = '';
        const preview = document.getElementById('feedback-file-preview');
        if (preview) preview.classList.add('hidden');
        if (contextBox) {
            contextBox.classList.add('hidden');
            contextBox.dataset.rawMsg = '';
        }
        
        trackAnalyticsEvent('submit_feedback_success', { feedback_type: type, has_attachment: !!attachmentUrl });

    } catch (e) {
        console.error("🛡️ Feedback Error:", e);
        showToast("Failed to send feedback. Please try again.", "error");
        trackAnalyticsEvent('submit_feedback_error', { error_msg: e.message });
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = "Submit";
        spinner.classList.add('hidden');
    }
}

function showRedirectModal(url, message) {
    if (redirectMessage) redirectMessage.textContent = message;
    history.pushState({ modal: 'redirect' }, '', '#redirect');
    openSmoothModal('redirect-modal');
    
    const confirmHandler = () => { triggerHaptic(); window.open(url, '_blank'); closeSmoothModal('redirect-modal'); cleanup(); };
    const cancelHandler = () => { if (location.hash === '#redirect') history.back(); else closeSmoothModal('redirect-modal'); cleanup(); };
    const cleanup = () => { 
        if (redirectConfirmBtn) redirectConfirmBtn.removeEventListener('click', confirmHandler); 
        if (redirectCancelBtn) redirectCancelBtn.removeEventListener('click', cancelHandler); 
    };
    if (redirectConfirmBtn) redirectConfirmBtn.addEventListener('click', confirmHandler);
    if (redirectCancelBtn) redirectCancelBtn.addEventListener('click', cancelHandler);
}

function setupFeatureButtons() {
    const storedTheme = safeStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const welcomeThemeToggleBtn = document.getElementById('welcome-theme-toggle');
    const welcomeDarkIcon = document.getElementById('welcome-theme-dark-icon');
    const welcomeLightIcon = document.getElementById('welcome-theme-light-icon');
    const welcomeThemeText = document.getElementById('welcome-theme-text');
    
    const settingsThemeCheckbox = document.getElementById('settings-theme-checkbox');
    const settingsThemeTextEl = document.getElementById('settings-theme-text');

    const applyTheme = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            safeStorage.setItem('theme', 'dark'); 
            if(welcomeDarkIcon) welcomeDarkIcon.classList.remove('hidden');
            if(welcomeLightIcon) welcomeLightIcon.classList.add('hidden');
            if(welcomeThemeText) welcomeThemeText.textContent = "Dark Mode";

            if(settingsThemeCheckbox) settingsThemeCheckbox.checked = true;
            if(settingsThemeTextEl) settingsThemeTextEl.textContent = "Currently On";
        } else {
            document.documentElement.classList.remove('dark');
            safeStorage.setItem('theme', 'light');
            if(welcomeDarkIcon) welcomeDarkIcon.classList.add('hidden');
            if(welcomeLightIcon) welcomeLightIcon.classList.remove('hidden');
            if(welcomeThemeText) welcomeThemeText.textContent = "Light Mode";

            if(settingsThemeCheckbox) settingsThemeCheckbox.checked = false;
            if(settingsThemeTextEl) settingsThemeTextEl.textContent = "Currently Off";
        }
    };

    if (storedTheme === 'dark' || (!storedTheme && systemDark)) {
        applyTheme(true);
    } else {
        applyTheme(false);
    }

    const handleThemeToggle = () => { triggerHaptic(); applyTheme(safeStorage.getItem('theme') !== 'dark'); };
    if(welcomeThemeToggleBtn) welcomeThemeToggleBtn.addEventListener('click', handleThemeToggle);
    
    const settingsThemeToggleBtn = document.getElementById('settings-theme-toggle');
    if (settingsThemeToggleBtn) {
        settingsThemeToggleBtn.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                if (settingsThemeCheckbox) {
                    triggerHaptic();
                    settingsThemeCheckbox.checked = !settingsThemeCheckbox.checked;
                    applyTheme(settingsThemeCheckbox.checked);
                }
            }
        });
    }
    if (settingsThemeCheckbox) {
        settingsThemeCheckbox.addEventListener('change', (e) => { triggerHaptic(); applyTheme(e.target.checked); });
    }

    const hapticsCheckbox = document.getElementById('settings-haptics-checkbox');
    const hapticsToggleBtn = document.getElementById('settings-haptics-toggle');
    const hapticsTextEl = document.getElementById('settings-haptics-text');

    const applyHaptics = (isEnabled) => {
        try { safeStorage.setItem('hapticsEnabled', isEnabled ? 'true' : 'false'); } catch(e) {}
        if (hapticsCheckbox) hapticsCheckbox.checked = isEnabled;
        if (hapticsTextEl) hapticsTextEl.textContent = isEnabled ? "Currently On" : "Currently Off";
    };

    try { applyHaptics(safeStorage.getItem('hapticsEnabled') !== 'false'); } catch(e) {}

    if (hapticsToggleBtn) {
        hapticsToggleBtn.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                if (hapticsCheckbox) {
                    const newState = !hapticsCheckbox.checked;
                    applyHaptics(newState);
                    if (newState) triggerHaptic(); 
                }
            }
        });
    }
    if (hapticsCheckbox) {
        hapticsCheckbox.addEventListener('change', (e) => { 
            applyHaptics(e.target.checked); 
            if (e.target.checked) triggerHaptic();
        });
    }
    
    shareBtn = document.getElementById('share-app-btn');
    if(shareBtn) {
        shareBtn.addEventListener('click', async () => { 
            triggerHaptic();
            trackAnalyticsEvent('click_share', { location: 'main_view' });
            const shareText = 'Say Goodbye to Waiting\nUse Next Train to check when your train is due to arrive.';
            const shareUrl = 'https://nexttrain.co.za/';

            const shareData = { title: "Metrorail Next Train", text: shareText, url: shareUrl }; 
            try { 
                if (navigator.share) { await navigator.share(shareData); } 
                else { copyToClipboard(`${shareText} ${shareUrl}`); } 
            } catch (err) { 
                if (err.name !== 'AbortError') {
                    copyToClipboard(`${shareText} ${shareUrl}`); 
                }
            } 
        });
    }

    installBtn = document.getElementById('install-app-btn');
    const installBtnPlanner = document.getElementById('install-app-btn-planner');
    
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isWebView = (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || (ua.indexOf('Instagram') > -1) || (ua.indexOf('Line') > -1);
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /android/i.test(ua);

    const showInstallButton = () => { 
        // 🛡️ GUARDIAN iOS FRICTIONLESS ENTRY: Hide buttons entirely for iOS WebViews
        if (isWebView && isIOS) {
            if (installBtn) installBtn.classList.add('hidden');
            if (installBtnPlanner) installBtnPlanner.classList.add('hidden');
            return;
        }

        if (installBtn) installBtn.classList.remove('hidden'); 
        if (installBtnPlanner) installBtnPlanner.classList.remove('hidden'); 
        
        if (isWebView) {
            const escapeIcon = `<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>`;
            if (installBtn) {
                installBtn.innerHTML = `${escapeIcon} Open in Browser to Install`;
                installBtn.classList.replace('bg-green-500', 'bg-blue-600');
                installBtn.classList.replace('hover:bg-green-600', 'hover:bg-blue-700');
            }
            if (installBtnPlanner) {
                installBtnPlanner.innerHTML = `${escapeIcon} Open in Browser to Install`;
                installBtnPlanner.classList.replace('bg-green-500', 'bg-blue-600');
                installBtnPlanner.classList.replace('hover:bg-green-600', 'hover:bg-blue-700');
            }
        }
    };
    
    if (window.deferredInstallPrompt || isWebView) { 
        showInstallButton(); 
    } else { 
        window.addEventListener('pwa-install-ready', () => { showInstallButton(); }); 
    }
    
    const handleInstallClick = () => { 
        triggerHaptic();
        trackAnalyticsEvent('install_app_click', { location: 'main_view', is_webview: isWebView });
        
        if (isWebView) {
            if (isAndroid) {
                // 🛡️ GUARDIAN ANDROID 1-TAP MAGIC BULLET
                window.location.href = `intent://nexttrain.co.za/?uid=${NEXT_TRAIN_DEVICE_ID}#Intent;scheme=https;package=com.android.chrome;end;`;
                return;
            }
            // If somehow they hit this on a non-Android/non-iOS WebView, just do nothing or fallback
            return;
        }

        if (installBtn) installBtn.classList.add('hidden'); 
        if (installBtnPlanner) installBtnPlanner.classList.add('hidden');
        
        const promptEvent = window.deferredInstallPrompt;
        if (promptEvent) {
            promptEvent.prompt(); 
            promptEvent.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') { trackAnalyticsEvent('install_app_accepted'); } else { trackAnalyticsEvent('install_app_dismissed'); }
                window.deferredInstallPrompt = null;
            });
        }
    };
    
    if (installBtn) installBtn.addEventListener('click', handleInstallClick);
    if (installBtnPlanner) installBtnPlanner.addEventListener('click', handleInstallClick);
    
    const openNav = () => { 
        triggerHaptic(); 
        if (sidenav) {
            sidenav.classList.remove('-translate-x-full');
            sidenav.classList.add('translate-x-0'); 
            sidenav.classList.add('open'); 
        }
        if (sidenavOverlay) sidenavOverlay.classList.add('open'); 
        document.body.classList.add('sidenav-open'); 
        lockBackgroundScroll(); 
        
        history.pushState({ view: 'sidenav' }, '', '#sidenav');
    };
    if(openNavBtn) openNavBtn.addEventListener('click', openNav); 
    
    const closeNav = () => { 
        window.closeAppHub();
    };
    if(closeNavBtn) closeNavBtn.addEventListener('click', closeNav); 
    if(sidenavOverlay) sidenavOverlay.addEventListener('click', closeNav);
    
    if(routeList) {
        routeList.addEventListener('click', (e) => { 
            const routeLink = e.target.closest('a'); 
            if (routeLink && routeLink.dataset.routeId) { 
                const routeId = routeLink.dataset.routeId; 
                
                if (routeId === currentRouteId) { 
                    showToast("You are already viewing this route.", "info", 1500); 
                    closeSmoothModal('route-modal');
                    return; 
                } 
                
                if (typeof ROUTES !== 'undefined' && ROUTES[routeId] && !ROUTES[routeId].isActive) {
                    closeSmoothModal('route-modal');
                    trackAnalyticsEvent('select_inactive_route', { route_name: ROUTES[routeId].name, route_id: routeId });
                    return; // 🛡️ GUARDIAN TRAPDOOR FIX: Halt execution!
                }
                
                currentRouteId = routeId;
                updateSidebarActiveState(); 
                updatePinUI(); 
                closeSmoothModal('route-modal');
                loadAllSchedules(); 
                checkServiceAlerts(); 
            } 
        });
    }
}

// --- GUARDIAN PHASE 3: THE REGION INTERCEPTOR ---
window.lastClickedFutureRegion = null;

// 🛡️ GUARDIAN UX FIX: Global Event Delegation for Region Dropdowns (Translation Trap Immunity)
document.addEventListener('click', (e) => {
    const regionOption = e.target.closest('[data-region-target]');
    if (regionOption) {
        e.stopPropagation();
        
        const regionCode = regionOption.getAttribute('data-region-target');
        const regionName = regionOption.getAttribute('data-region-name');
        const displayId = regionOption.getAttribute('data-display-id');
        const selectId = regionOption.getAttribute('data-select-id');
        const listId = regionOption.getAttribute('data-list-id');
        const chevronId = regionOption.getAttribute('data-chevron-id');

        // 1. Update text content safely (with null check)
        if (displayId) {
            const displayEl = document.getElementById(displayId);
            if (displayEl && regionName) displayEl.textContent = regionName;
        }

        // 2. Trigger native select change safely (with null check)
        if (selectId) {
            const selectEl = document.getElementById(selectId);
            if (selectEl && regionCode) {
                selectEl.value = regionCode;
                selectEl.dispatchEvent(new Event('change'));
            }
        }

        // 3. Close the dropdown safely (with null checks)
        if (typeof window.toggleDropdownScrim === 'function') {
            window.toggleDropdownScrim();
        } else {
            if (listId) {
                const listEl = document.getElementById(listId);
                if (listEl) listEl.classList.add('hidden');
            }
            if (chevronId) {
                const chevronEl = document.getElementById(chevronId);
                if (chevronEl) chevronEl.classList.remove('rotate-180');
            }
        }
    }
});

window.handleRegionChange = async function(newRegion, selectElement) {
    if (newRegion === currentRegion) return;

    if (selectElement) selectElement.value = currentRegion;

    const getRegionName = (code) => {
        if (code === 'WC') return 'Western Cape';
        if (code === 'KZN') return 'KwaZulu-Natal';
        if (code === 'EC') return 'Eastern Cape';
        return 'Gauteng';
    };

    if (!navigator.onLine) {
        const cacheKey = `full_db_${newRegion}`;
        const cachedData = await loadFromLocalCache(cacheKey);
        if (!cachedData) {
            showToast(`Internet required to download ${getRegionName(newRegion)} schedules for the first time.`, "error", 4000);
            return;
        }
    }

    const confirmModal = document.getElementById('region-confirm-modal');
    const title = document.getElementById('region-confirm-title');
    const desc = document.getElementById('region-confirm-desc');
    const actionBtn = document.getElementById('region-confirm-action-btn');
    const cancelBtn = document.getElementById('region-cancel-btn');

    if (confirmModal) {
        history.pushState({ modal: 'region-confirm' }, '', '#regionconfirm');
        if (title) title.textContent = `Switch Region?`;
        if (desc) desc.textContent = `Are you sure you want to switch to ${getRegionName(newRegion)}?`;
        
        window.closeAppHub(true);
        setTimeout(() => { openSmoothModal('region-confirm-modal'); }, 50);

        // --- AFTER ---
        const confirmAction = () => {
            safeStorage.setItem('userRegion', newRegion);
            
            // 🛡️ GUARDIAN UX FIX: Bypass async history.back() which gets trapped by the Router Bleed Lock.
            // Directly close the modal and clean the URL hash manually to guarantee execution.
            closeSmoothModal('region-confirm-modal');
            if (location.hash === '#regionconfirm') {
                history.replaceState({ view: 'home' }, '', '#home');
            }
            
            // Delay execution to allow the modal to smoothly animate away
            // before the heavy region-swap logic wipes the DOM and causes a visual freeze.
            setTimeout(() => {
                if (typeof executeRegionSwap === 'function') {
                    executeRegionSwap(newRegion);
                } else {
                    window.location.reload();
                }
            }, 350);
        };

        const cancelAction = () => {
            // 🛡️ GUARDIAN UX FIX: Same bypass applied to Cancel button to prevent Router Bleed Trap
            closeSmoothModal('region-confirm-modal');
            if (location.hash === '#regionconfirm') {
                history.replaceState({ view: 'home' }, '', '#home');
            }
        };

        if (actionBtn) actionBtn.onclick = confirmAction;
        if (cancelBtn) cancelBtn.onclick = cancelAction;
    }
};

window.voteForRegion = async function() {
    triggerHaptic();
    if (window.lastClickedFutureRegion) {
        const storageKey = 'voted_' + window.lastClickedFutureRegion;
        let hasVoted = false;
        try { hasVoted = safeStorage.getItem(storageKey); } catch(e) {}
        
        if (hasVoted) {
            showToast("You've already voted for this region!", "info");
        } else {
            trackAnalyticsEvent('vote_future_region', { region: window.lastClickedFutureRegion });

            try {
                if (window.firebaseAuth && !window.firebaseAuth.currentUser && window.firebaseSignInAnonymously) {
                    await window.firebaseSignInAnonymously(window.firebaseAuth);
                }

                let authToken = "";
                if (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseGetIdToken) {
                    authToken = await window.firebaseGetIdToken(window.firebaseAuth.currentUser, true);
                }

                const payload = {
                    region: window.lastClickedFutureRegion,
                    timestamp: Date.now(),
                    device_id: typeof NEXT_TRAIN_DEVICE_ID !== 'undefined' ? NEXT_TRAIN_DEVICE_ID : 'unknown'
                };

                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const authParam = authToken ? `?auth=${authToken}` : '';

                fetch(`${dynamicEndpoint}votes.json${authParam}`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }).catch(e => console.warn("Vote network error, continuing.", e));

            } catch (fbError) {
                console.warn("Firebase vote submission failed:", fbError);
            }

            try { safeStorage.setItem(storageKey, 'true'); } catch(e) {}
            showToast("Thanks for voting! We've logged your request.", "success");
        }
    } else {
        showToast("Thanks for voting!", "success");
    }
    
    if (location.hash === '#regionsoon') history.back();
    else closeSmoothModal('region-soon-modal');
};

function setupSettingsHub() {
    const helpBtn = document.getElementById('settings-help-btn');
    const aboutBtn = document.getElementById('settings-about-btn');
    const helpModal = document.getElementById('help-modal');
    const aboutModal = document.getElementById('about-modal');
    
    if (helpBtn) helpBtn.addEventListener('click', () => { 
        triggerHaptic();
        trackAnalyticsEvent('view_user_guide', { location: 'settings' }); 
        window.closeAppHub(true);
        setTimeout(() => { window.location.href = 'guide.html'; }, 150);
    });
    
    if (aboutBtn) aboutBtn.addEventListener('click', () => { 
        triggerHaptic();
        trackAnalyticsEvent('view_about_page', { location: 'settings' }); 
        history.pushState({ modal: 'about' }, '', '#about'); 
        window.closeAppHub(true);
        if(aboutModal) { setTimeout(() => { openSmoothModal('about-modal'); }, 50); }
    });

    const verEl = document.getElementById('settings-app-version');
    if (verEl && typeof APP_VERSION !== 'undefined') {
        const currentVersionStr = APP_VERSION.split(' - ')[0];
        const versionSpan = verEl.querySelector('span.font-mono');
        if (versionSpan) {
            versionSpan.textContent = currentVersionStr; 
        } else {
            verEl.textContent = APP_VERSION;
        }

        let changelogVersion = currentVersionStr;
        let forceShowChangelog = false;
        
        if (typeof CHANGELOG_DATA !== 'undefined' && CHANGELOG_DATA.length > 0) {
            // Strip any HTML formatting (like <br> or <span>) to get the raw version string
            changelogVersion = CHANGELOG_DATA[0].version.split('<')[0].trim();
            forceShowChangelog = CHANGELOG_DATA[0].forceShow === true;
        }

        const seenVersion = safeStorage.getItem('seen_changelog_version');
        const badge = document.getElementById('whats-new-badge');
        
        if (seenVersion !== changelogVersion) {
            if (badge) badge.classList.remove('hidden');
            
            // 🛡️ GUARDIAN: Auto-open modal if the payload explicitly demands it
            if (forceShowChangelog) {
                safeStorage.setItem('seen_changelog_version', changelogVersion);
                if (badge) badge.classList.add('hidden');
                setTimeout(() => {
                    if (typeof Renderer !== 'undefined' && Renderer.renderChangelogModal) {
                        history.pushState({ modal: 'changelog' }, '', '#changelog');
                        Renderer.renderChangelogModal(typeof CHANGELOG_DATA !== 'undefined' ? CHANGELOG_DATA : []);
                    }
                }, 1000); // 1-second delay so it blooms after the app loads
            }
        } else {
            if (badge) badge.classList.add('hidden');
        }
        
        verEl.onclick = () => {
            triggerHaptic();
            safeStorage.setItem('seen_changelog_version', changelogVersion);
            if (badge) badge.classList.add('hidden');
            
            if (typeof Renderer !== 'undefined' && Renderer.renderChangelogModal) {
                history.pushState({ modal: 'changelog' }, '', '#changelog');
                window.closeAppHub(true);
                setTimeout(() => { Renderer.renderChangelogModal(typeof CHANGELOG_DATA !== 'undefined' ? CHANGELOG_DATA : []); }, 50);
            } else {
                window.closeAppHub(true);
            }
        };
    }
}

function showWelcomeScreen() {
    if (!welcomeModal || !welcomeRouteList || !welcomeRouteList.parentNode) return;

    if (!document.getElementById('welcome-region-selector')) {
        const regionWrapper = document.createElement('div');
        regionWrapper.id = 'welcome-region-selector';
        regionWrapper.className = 'w-full mb-4 flex flex-col items-center space-y-3 shrink-0';

        const activeRow = document.createElement('div');
        activeRow.className = 'flex flex-wrap justify-center gap-2 w-full';

        const createBtn = (code, name) => {
            const btn = document.createElement('button');
            const resetClass = "px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-300";
            const activeClass = "px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300";
            
            btn.className = (currentRegion === code) ? activeClass : resetClass;
            btn.textContent = name;
            
            btn.onclick = () => { 
                if (currentRegion === code) return; 
                if (typeof triggerHaptic === 'function') triggerHaptic();
                
                // 🛡️ GUARDIAN UI FIX: Reset all region buttons and highlight the selected one instantly
                const parentRow = btn.parentElement;
                if (parentRow) {
                    Array.from(parentRow.querySelectorAll('button')).forEach(b => b.className = resetClass);
                }
                btn.className = activeClass;

                safeStorage.setItem('userRegion', code); 
                
                if (typeof executeRegionSwap === 'function') {
                    // 🛡️ GUARDIAN FIX: Pass 'true' to indicate this swap originated from the Welcome Screen.
                    // This tells logic.js to bypass the auto-download/auto-assign sequence.
                    executeRegionSwap(code, true);
                    
                    // 🛡️ GUARDIAN BUGFIX: Force Welcome Screen list to re-render instantly, 
                    // bypassing the savedDefault trap in executeRegionSwap.
                    if (typeof Renderer !== 'undefined' && typeof getRoutesForCurrentRegion === 'function') {
                        Renderer.renderWelcomeList('welcome-route-list', getRoutesForCurrentRegion(), selectWelcomeRoute);
                    }
                } else {
                    window.location.reload();
                }
            };
            return btn;
        };

        activeRow.appendChild(createBtn('GP', 'Gauteng'));
        activeRow.appendChild(createBtn('WC', 'Western Cape'));
        activeRow.appendChild(createBtn('KZN', 'KwaZulu-Natal'));
        activeRow.appendChild(createBtn('EC', 'Eastern Cape'));

        regionWrapper.appendChild(activeRow);

        welcomeRouteList.parentNode.insertBefore(regionWrapper, welcomeRouteList);
    }

    if (typeof Renderer !== 'undefined' && typeof ROUTES !== 'undefined') Renderer.renderWelcomeList('welcome-route-list', getRoutesForCurrentRegion(), selectWelcomeRoute);
    openSmoothModal('welcome-modal');
}

function selectWelcomeRoute(routeId) {
    if (typeof triggerHaptic === 'function') triggerHaptic();
    
    // 🛡️ GUARDIAN RELOAD LOCK: Temporarily disable reloads while we settle the state
    window._suppressReloads = true;

    // 1. Permanently lock the selected Region and Route
    safeStorage.setItem('userRegion', currentRegion);
    safeStorage.setItem('defaultRoute_' + currentRegion, routeId);
    safeStorage.setItem('welcomeSeen', 'true');
    
    currentRouteId = routeId;

    // 2. Clear visual blockers
    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal) welcomeModal.classList.add('hidden');
    
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';

    // 3. Reveal dashboard
    if (mainContent) mainContent.style.display = 'block';
    
    // 4. Update UI Components without re-triggering init logic
    updateSidebarActiveState();
    updatePinUI();
    
    // 5. Trigger data hydration
    if (typeof loadAllSchedules === 'function') {
        // 🛡️ GUARDIAN FIX: Pass 'true' to punch through the _suppressReloads lock and fetch the data!
        loadAllSchedules(true).then(() => {
            // Release reload lock only AFTER schedules are cached to Disk/RAM
            setTimeout(() => { window._suppressReloads = false; }, 2000);
        });
    }
    
    if (typeof checkServiceAlerts === 'function') checkServiceAlerts();
}

window.openLegal = function(type) {
    triggerHaptic();
    trackAnalyticsEvent('view_legal_doc', { type: type });
    history.pushState({ modal: 'legal' }, '', '#legal');
    if (legalTitle) legalTitle.textContent = type === 'terms' ? 'Terms of Use' : 'Privacy Policy';
    if (legalContent) legalContent.innerHTML = typeof LEGAL_TEXTS !== 'undefined' && LEGAL_TEXTS[type] ? LEGAL_TEXTS[type] : '';
    window.closeAppHub(true);
    setTimeout(() => { openSmoothModal('legal-modal'); }, 50);
};

function closeLegal() { 
    if(location.hash === '#legal') history.back(); 
    else { closeSmoothModal('legal-modal'); }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then(reg => {
            // 🛡️ GUARDIAN PHASE 2: Catch null/nonexistent SW registration race condition
            try {
                if (reg) reg.update();
            } catch (e) { console.warn("SW Update failed:", e); }

            if (reg && reg.waiting) {
                handleUpdateFound(reg);
            }

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            handleUpdateFound(reg);
                        }
                    });
                }
            });
        }).catch(err => console.error('SW reg failed:', err));

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            
            let lastReload = null;
            try { lastReload = sessionStorage.getItem('sw_last_reload'); } catch(e) {}
            const now = Date.now();
            if (lastReload && (now - parseInt(lastReload, 10)) < 30000) {
                console.warn("🛡️ Guardian: Suppressed rapid infinite reload (Live Server loop blocked).");
                return;
            }
            try { sessionStorage.setItem('sw_last_reload', now.toString()); } catch(e) {}

            refreshing = true;
            // 🛡️ GUARDIAN PHASE 2: Cache-Busting hard redirect to drop stale HTML
            window.location.href = window.location.pathname + '?v=' + Date.now(); 
        });
        
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'sw-update-available') {}
        });
    });
}

function handleUpdateFound(registration) {
    const isForceUpdate = typeof FORCE_UPDATE_REQUIRED !== 'undefined' && FORCE_UPDATE_REQUIRED;

    if (isForceUpdate) {
        console.log("GUARDIAN: Force Update Triggered.");
        showToast("Crucial system update. Reloading...", "error", 5000);
        
        if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else if (registration.installing) {
            registration.installing.addEventListener('statechange', function() {
                if (this.state === 'installed') {
                    this.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        }
    } else {
        console.log("GUARDIAN: Silent Update Available.");
        
        const actionHTML = `
            <button onclick="triggerAppUpdate()" class="bg-white/20 hover:bg-white/40 text-white px-3 py-1 rounded text-xs font-bold transition-colors">
                UPDATE
            </button>
        `;
        showToast("New version available.", "info", 10000, actionHTML);
        
        window._pendingUpdateReg = registration;
    }
}

window.triggerAppUpdate = function() {
    if (window._pendingUpdateReg && window._pendingUpdateReg.waiting) {
        showToast("Updating...", "success");
        window._pendingUpdateReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
        // 🛡️ GUARDIAN PHASE 2: Cache-Busting hard redirect
        window.location.href = window.location.pathname + '?v=' + Date.now();
    }
};

window.renderFullScheduleGrid = function(direction = 'A', dayOverride = null) {
    if (!schedules || Object.keys(schedules).length === 0) {
        showToast("Loading latest schedules... please wait.", "info", 2000);
        return;
    }

    const route = typeof ROUTES !== 'undefined' ? ROUTES[currentRouteId] : null;
    if (!route) return;

    let selectedDay = dayOverride || currentDayType;
    let targetDayIdx = (typeof currentDayIndex !== 'undefined') ? currentDayIndex : new Date().getDay();

    let autoForwarded = false;

    if (!dayOverride) {
        let hasServiceToday = false;
        
        if (currentDayType !== 'sunday') {
            const testSheetKey = `${currentDayType}_to_${direction.toLowerCase()}`;
            const testSchedule = schedules[testSheetKey];
            
            if (testSchedule && testSchedule.rows && testSchedule.rows.length > 0) {
                const headers = testSchedule.headers.slice(1);
                for (const t of headers) {
                    if (typeof isTrainExcluded === 'function' && !isTrainExcluded(t, currentRouteId, targetDayIdx)) {
                        hasServiceToday = true;
                        break;
                    } else if (typeof isTrainExcluded !== 'function') {
                        hasServiceToday = true;
                        break;
                    }
                }
            }
        }

        if (!hasServiceToday) {
            const dest = direction === 'A' ? route.destA : route.destB;
            const selectedStation = stationSelect ? stationSelect.value : "";
            const simResult = typeof window.simulateNextActiveService === 'function'
                ? window.simulateNextActiveService(selectedStation, dest)
                : null;
            
            if (simResult && simResult.daysAhead > 0) {
                selectedDay = simResult.dayInfo.type;
                targetDayIdx = simResult.dayInfo.idx;
                autoForwarded = true;
            } else if (currentDayType === 'sunday') {
                selectedDay = 'weekday';
                targetDayIdx = 1;
                autoForwarded = true;
            }
        }
    } else {
        const isSameType = (dayOverride === currentDayType);
        if (!isSameType) {
            if (dayOverride === 'weekday') targetDayIdx = 1; 
            else if (dayOverride === 'saturday') targetDayIdx = 6;
            else if (dayOverride === 'sunday') targetDayIdx = 0;
        }
    }

    let sheetDayType = 'weekday';
    if (selectedDay === 'saturday') {
        sheetDayType = 'saturday';
    } else if (selectedDay === 'sunday') {
        sheetDayType = 'weekday';
    } else {
        sheetDayType = 'weekday';
    }

    const existingModal = document.getElementById('full-schedule-modal');
    const isFirstOpen = !existingModal || existingModal.classList.contains('hidden');

    if (isFirstOpen) {
        trackAnalyticsEvent('view_full_grid', { 
            route: route.name, 
            direction: direction,
            day: selectedDay 
        });
    }

    const destName = Renderer._applyUIIntercepts(direction === 'A' ? route.destA : route.destB).toUpperCase();
    const oppositeDestName = Renderer._applyUIIntercepts(direction === 'A' ? route.destB : route.destA).toUpperCase();
    
    const sheetKey = `${sheetDayType}_to_${direction.toLowerCase()}`;
    const schedule = schedules[sheetKey];

    if (!schedule || !schedule.rows || schedule.rows.length === 0) {
        showToast(`No ${sheetDayType} schedule available for this route.`, "error");
        return;
    }

    let modal = document.getElementById('full-schedule-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'full-schedule-modal';
        modal.className = 'fixed inset-0 bg-white dark:bg-gray-900 z-[95] hidden flex items-center justify-center p-0 full-screen backdrop-blur-md transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-900 rounded-none shadow-2xl w-full h-full flex flex-col transform transition-transform duration-300 scale-100 overflow-hidden relative">
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-100 dark:bg-gray-800 z-20 relative">
                <h3 class="flex-grow min-w-0 pr-2"></h3>
                <button onclick="if(location.hash === '#grid') { history.back(); } else { const m = document.getElementById('full-schedule-modal'); if(m) m.classList.add('hidden'); }" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition flex-shrink-0" aria-label="Close Grid">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
                </div>
                <!-- 🛡️ GUARDIAN FIX: Elevated z-index to z-[60] so dropdown completely escapes table stacking context -->
                <div id="grid-controls" class="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm relative"></div>
                <div id="grid-container" class="flex-grow overflow-auto bg-white dark:bg-gray-900 relative pb-32 z-10"></div>
                <div class="p-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 z-20 relative">
                    <button onclick="if(location.hash === '#grid') { history.back(); } else { const m = document.getElementById('full-schedule-modal'); if(m) m.classList.add('hidden'); }" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-md transition-colors text-sm">Close Timetable</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const container = document.getElementById('grid-container');
    const headerTitle = modal.querySelector('h3');
    const controlsDiv = modal.querySelector('#grid-controls');
    
    let effectiveDate = "Standard Schedule";
    if (schedule.lastUpdated) {
        const cleanDate = schedule.lastUpdated.replace(/^last updated[:\s-]*/i, '').trim();
        effectiveDate = `Effective: ${cleanDate}`;
    }

    if (headerTitle) {
        headerTitle.innerHTML = `
            <div class="flex flex-col w-full">
                <span class="text-sm font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider truncate">Trains to ${destName}</span>
                <span class="text-[10px] text-gray-400 font-mono mt-0.5 truncate">${effectiveDate}</span>
            </div>
        `;
    }

    if (controlsDiv) {
            // GUARDIAN UX FIX: Dynamically update parent container layout to wrap safely if fat buttons exceed mobile bounds
            controlsDiv.className = "px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 justify-between items-center shadow-md relative";

            const isWk = sheetDayType === 'weekday';
            const shareUrl = `https://nexttrain.co.za/?action=route&route=${currentRouteId}&view=grid&dir=${direction}&day=${selectedDay}`;
            const shareText = `Check out the ${sheetDayType} schedule to ${destName}`;
            
            window.shareCurrentGrid = async () => {
                if (typeof triggerHaptic === 'function') triggerHaptic(); 
                const data = { title: 'Next Train Schedule', text: shareText, url: shareUrl };
                try {
                    if (navigator.share) await navigator.share(data);
                    else {
                        const textArea = document.createElement('textarea');
                        textArea.value = shareUrl;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        alert('Schedule link copied to clipboard!');
                    }
                } catch (e) {}
            };

            let wkLabel = "Mon - Fri";
            let satLabel = "Sat / Hol";

            // 🛡️ GUARDIAN UX: Outside click listener for the custom Grid Dropdown
            if (!window._gridOutsideClickListener) {
                window._gridOutsideClickListener = (e) => {
                    const list = document.getElementById('grid-day-list');
                    const chevron = document.getElementById('grid-day-chevron');
                    if (list && !list.classList.contains('hidden') && !e.target.closest('#grid-day-dropdown-container')) {
                        if(window.toggleDropdownScrim) window.toggleDropdownScrim();
                        else {
                            list.classList.add('hidden');
                            if (chevron) chevron.classList.remove('rotate-180');
                        }
                    }
                };
                document.addEventListener('click', window._gridOutsideClickListener);
            }

            controlsDiv.innerHTML = `
                <div class="flex items-center space-x-1 sm:space-x-2 min-w-0 flex-1 relative" id="grid-day-dropdown-container">
                    <!-- Custom Dropdown Trigger (Reverted to Compact) -->
                    <button onclick="if(window.toggleDropdownScrim) window.toggleDropdownScrim('grid-day-list', 'grid-day-chevron'); else { document.getElementById('grid-day-list').classList.toggle('hidden'); document.getElementById('grid-day-chevron').classList.toggle('rotate-180'); }" class="flex justify-between items-center text-[9px] sm:text-[10px] font-bold bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-gray-700 dark:text-gray-200 focus:outline-none shadow-sm min-w-[85px] sm:min-w-[95px]">
                        <span id="grid-day-display" class="truncate mr-1">${isWk ? wkLabel : satLabel}</span>
                        <svg id="grid-day-chevron" class="w-3 h-3 text-gray-500 transform transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    
                    <!-- Hidden Dropdown List (Premium UI Retained & Scaled Up) -->
                    <ul id="grid-day-list" class="absolute z-[200] top-[115%] left-0 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl hidden flex-col overflow-hidden text-left min-w-[170px]">
                        <li onclick="if(window.toggleDropdownScrim) window.toggleDropdownScrim(); else { document.getElementById('grid-day-list').classList.add('hidden'); document.getElementById('grid-day-chevron').classList.remove('rotate-180'); } renderFullScheduleGrid('${direction}', 'weekday')" class="px-4 py-4 text-sm sm:text-base font-bold hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200 transition-colors border-b border-gray-100 dark:border-gray-700 flex items-center ${isWk ? 'bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : ''}">
                            <svg class="w-5 h-5 mr-3 shrink-0 ${isWk ? 'text-blue-500' : 'text-gray-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            ${wkLabel}
                        </li>
                        <li onclick="if(window.toggleDropdownScrim) window.toggleDropdownScrim(); else { document.getElementById('grid-day-list').classList.add('hidden'); document.getElementById('grid-day-chevron').classList.remove('rotate-180'); } renderFullScheduleGrid('${direction}', 'saturday')" class="px-4 py-4 text-sm sm:text-base font-bold hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-200 transition-colors flex items-center ${!isWk ? 'bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : ''}">
                            <svg class="w-5 h-5 mr-3 shrink-0 ${!isWk ? 'text-blue-500' : 'text-gray-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${satLabel}
                        </li>
                    </ul>

                    <!-- Swap Button (Reverted to Compact) -->
                    <button onclick="renderFullScheduleGrid('${direction === 'A' ? 'B' : 'A'}', '${selectedDay}')" class="text-[9px] sm:text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-1.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap shadow-sm truncate shrink-0 ml-1 sm:ml-2">
                        ⇄ ${typeof Renderer !== 'undefined' ? Renderer._applyUIIntercepts(oppositeDestName) : oppositeDestName}
                    </button>
                </div>
                
                <!-- Actions Container & Buttons (Reverted to Compact) -->
                <div class="flex items-center space-x-1 border-l border-gray-200 dark:border-gray-700 pl-1.5 ml-1 shrink-0">
                    <button onclick="takeGridSnapshot('${direction}', '${selectedDay}')" class="flex items-center justify-center space-x-1 px-1.5 py-1.5 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 transition shadow-sm border border-gray-200 dark:border-gray-600 whitespace-nowrap focus:outline-none min-w-0" title="Save Image">
                        <svg class="w-3 h-3 text-gray-600 dark:text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        <span class="text-[9px] font-bold text-gray-700 dark:text-gray-300 truncate">Download</span>
                    </button>
                    <button onclick="shareCurrentGrid()" class="flex items-center justify-center space-x-1 px-1.5 py-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 transition shadow-sm border border-blue-200 dark:border-blue-800 whitespace-nowrap focus:outline-none min-w-0" title="Share Link">
                        <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        <span class="text-[9px] font-bold truncate">Share</span>
                    </button>
                </div>
            `;
        }

    const isTodayType = !autoForwarded && (
                        (currentDayType === 'weekday' && sheetDayType === 'weekday') || 
                        (currentDayType !== 'weekday' && sheetDayType === 'saturday')
                    );
    
    const html = typeof Renderer !== 'undefined' ? Renderer._buildGridHTML(schedule, route.sheetKeys[sheetKey], currentRouteId, targetDayIdx, isTodayType, false) : '';

    container.innerHTML = html;
    modal.classList.remove('hidden');
    history.pushState({ modal: 'grid' }, '', '#grid');

    setTimeout(() => {
        const activeCol = document.getElementById('grid-active-col');
        if (activeCol) activeCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
};

function updateNextTrainView() {
    const fareBox = document.getElementById('fare-container');
    const container = fareBox ? fareBox.parentNode : null;
    if (!container) return;

    const currentRoute = typeof ROUTES !== 'undefined' ? ROUTES[currentRouteId] : null;
    if (!currentRoute || !currentRoute.isActive) {
        const gridTrigger = document.getElementById('grid-trigger-container');
        if (gridTrigger) gridTrigger.classList.add('hidden');
        return;
    }

    if (!document.getElementById('grid-trigger-container')) {
        const triggerDiv = document.createElement('div');
        triggerDiv.id = 'grid-trigger-container';
        triggerDiv.className = "mb-5 mt-2 px-1"; 
        triggerDiv.innerHTML = `
            <button onclick="triggerHaptic(); renderFullScheduleGrid('A')" class="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg ring-4 ring-blue-100 dark:ring-blue-900 transition-all transform active:scale-95 group focus:outline-none">
                <span class="text-xl">📅</span>
                <span class="tracking-wide">VIEW FULL TIMETABLE</span>
            </button>
        `;
        container.insertBefore(triggerDiv, fareBox);
    } else {
        const gridTrigger = document.getElementById('grid-trigger-container');
        if (gridTrigger) gridTrigger.classList.remove('hidden');
    }
}

function enforceAppVersion() {
    const currentVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown';
    const storedVersion = safeStorage.getItem('app_installed_version');

    const isForceUpdate = typeof FORCE_UPDATE_REQUIRED !== 'undefined' && FORCE_UPDATE_REQUIRED;

    if (storedVersion && storedVersion !== currentVersion) {
        console.log(`[Guardian] Version Upgrade Available: ${storedVersion} -> ${currentVersion}`);
        
        if (isForceUpdate) {
            handleUpdateClick(currentVersion);
            return;
        }

        const updateToastHTML = `
            <div id="update-toast" class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4 z-[100] cursor-pointer hover:scale-105 transition-transform w-[90%] max-w-sm" onclick="handleUpdateClick('${currentVersion}')">
                <div class="bg-white/20 rounded-full p-2 animate-pulse">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15"></path></svg>
                </div>
                <div class="flex flex-col">
                    <span class="text-base font-bold">New Features Ready</span>
                    <span class="text-xs text-blue-100">Tap here to finish updating to ${currentVersion}.</span>
                </div>
            </div>`;

        const div = document.createElement('div'); 
        div.innerHTML = updateToastHTML; 
        document.body.appendChild(div.firstElementChild);
        return; 
    }
    
    if (!storedVersion) safeStorage.setItem('app_installed_version', currentVersion);
}

window.handleUpdateClick = async function(newVersion) {
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }
        if ('caches' in window) {
            const names = await caches.keys();
            for (let name of names) {
                await caches.delete(name);
            }
        }
    } catch (e) {
        console.warn("Cache clear failed during update", e);
    }
    
    safeStorage.setItem('app_installed_version', newVersion);
    // 🛡️ GUARDIAN PHASE 2: Cache-Busting hard redirect
    window.location.href = window.location.pathname + '?v=' + Date.now();
};

// --- DOM READY ---
document.addEventListener('DOMContentLoaded', () => {
    enforceAppVersion();
    
    // 🛡️ GUARDIAN UX FIX: Force Local Persistence to prevent PWA session drops
    window.addEventListener('firebase-auth-ready', async () => {
        try {
            const authModule = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
            if (window.firebaseAuth && authModule.setPersistence && authModule.browserLocalPersistence) {
                await authModule.setPersistence(window.firebaseAuth, authModule.browserLocalPersistence);
                console.log("🛡️ Guardian: Firebase Auth browserLocalPersistence strictly enforced.");
            }
        } catch(e) { console.warn("🛡️ Auth persistence tweak failed:", e); }
    });

    stationSelect = document.getElementById('station-select');
    locateBtn = document.getElementById('locate-btn');
    pretoriaTimeEl = document.getElementById('pretoria-time');
    pienaarspoortTimeEl = document.getElementById('pienaarspoort-time');
    pretoriaHeader = document.getElementById('pretoria-header');
    pienaarspoortHeader = document.getElementById('pienaarspoort-header');
    currentTimeEl = document.getElementById('current-time');
    currentDayEl = document.getElementById('current-day');
    mainContent = document.getElementById('main-content');
    offlineIndicator = document.getElementById('offline-indicator');
    scheduleModal = document.getElementById('schedule-modal');
    modalTitle = document.getElementById('modal-title');
    modalList = document.getElementById('modal-list');
    closeModalBtn = document.getElementById('close-modal-btn');
    closeModalBtn2 = document.getElementById('close-modal-btn-2');
    redirectModal = document.getElementById('redirect-modal');
    redirectMessage = document.getElementById('redirect-message');
    redirectConfirmBtn = document.getElementById('redirect-confirm-btn');
    redirectCancelBtn = document.getElementById('redirect-cancel-btn');
    
    pinRouteBtn = document.getElementById('pin-route-btn');
    pinOutline = document.getElementById('pin-outline');
    pinFilled = document.getElementById('pin-filled');

    openNavBtn = document.getElementById('open-nav-btn');
    closeNavBtn = document.getElementById('close-nav-btn');
    sidenav = document.getElementById('sidenav');
    sidenavOverlay = document.getElementById('sidenav-overlay');
    routeList = document.getElementById('route-list');
    routeSubtitle = document.getElementById('route-subtitle');
    routeSubtitleText = document.getElementById('route-subtitle-text');
    pinnedSection = document.getElementById('pinned-section');
    toast = document.getElementById('toast');
    feedbackBtn = document.getElementById('feedback-btn');
    lastUpdatedEl = document.getElementById('last-updated-date');
    appTitle = document.getElementById('app-title');
    legalModal = document.getElementById('legal-modal');
    legalTitle = document.getElementById('legal-modal-title');
    legalContent = document.getElementById('legal-modal-content');
    closeLegalBtn = document.getElementById('close-legal-btn');
    closeLegalBtn2 = document.getElementById('close-legal-btn-2');
    welcomeModal = document.getElementById('welcome-modal');
    welcomeRouteList = document.getElementById('welcome-route-list');

    const helpModal = document.getElementById('help-modal');
    const openHelpBtn = document.getElementById('open-help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const closeHelpBtn2 = document.getElementById('close-help-btn-2');
    const aboutModal = document.getElementById('about-modal');
    const openAboutBtn = document.getElementById('open-about-btn');
    const closeAboutBtn = document.getElementById('close-about-btn');
    
    const closeHelp = () => { if(location.hash === '#help') history.back(); else { closeSmoothModal('help-modal'); } };
    const closeAbout = () => { if(location.hash === '#about') history.back(); else { closeSmoothModal('about-modal'); } };

    if(closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
    if(closeHelpBtn2) closeHelpBtn2.addEventListener('click', closeHelp);
    if(helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

    if(closeAboutBtn) closeAboutBtn.addEventListener('click', closeAbout);
    if(aboutModal) aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) closeAbout(); });

    if(openHelpBtn) openHelpBtn.addEventListener('click', () => { 
        triggerHaptic(); trackAnalyticsEvent('view_user_guide', { location: 'sidebar' }); 
        window.closeAppHub(true); 
        setTimeout(() => { window.location.href = 'guide.html'; }, 150); 
    });
    
    if(openAboutBtn) openAboutBtn.addEventListener('click', () => { 
        triggerHaptic(); trackAnalyticsEvent('view_about_page', { location: 'sidebar' }); 
        history.pushState({ modal: 'about' }, '', '#about'); 
        window.closeAppHub(true); 
        if(aboutModal) { setTimeout(() => { openSmoothModal('about-modal'); }, 50); } 
    });

    const sidenavAboutBtn = document.getElementById('sidenav-about-btn');
    if(sidenavAboutBtn) sidenavAboutBtn.addEventListener('click', () => {
        triggerHaptic(); trackAnalyticsEvent('view_about_page', { location: 'sidebar' }); 
        history.pushState({ modal: 'about' }, '', '#about'); 
        window.closeAppHub(true); 
        if(aboutModal) { setTimeout(() => { openSmoothModal('about-modal'); }, 50); } 
    });

    if(closeLegalBtn) closeLegalBtn.addEventListener('click', closeLegal);
    if(closeLegalBtn2) closeLegalBtn2.addEventListener('click', closeLegal);
    if(legalModal) legalModal.addEventListener('click', (e) => { if (e.target === legalModal) closeLegal(); });
    
    const exitConfirmBtn = document.getElementById('exit-confirm-btn');
    const exitCancelBtn = document.getElementById('exit-cancel-btn');
    
    if (exitConfirmBtn) {
        exitConfirmBtn.addEventListener('click', () => {
            if (navigator.app && navigator.app.exitApp) {
                navigator.app.exitApp();
            } else {
                closeSmoothModal('exit-modal');
                setTimeout(() => { 
                    document.body.innerHTML = `
                        <div class="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center p-6 text-center z-[9999]">
                            <div class="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h2 class="text-2xl font-black text-white mb-2 tracking-tight">Session Closed</h2>
                            <p class="text-gray-400 text-sm">It is now safe to swipe this app away or close the tab.</p>
                        </div>
                    `;
                    try { window.close(); } catch(e) {}
                }, 300);
            }
        });
    }
    if (exitCancelBtn) {
        exitCancelBtn.addEventListener('click', () => {
            closeSmoothModal('exit-modal');
        });
    }
    
    const tabNextTrainBtn = document.getElementById('tab-next-train');
    if (tabNextTrainBtn) tabNextTrainBtn.addEventListener('click', () => switchTab('next-train'));
    
    const tabTripPlannerBtn = document.getElementById('tab-trip-planner');
    if (tabTripPlannerBtn) tabTripPlannerBtn.addEventListener('click', () => switchTab('trip-planner'));

    const facebookBtn = document.getElementById('facebook-connect-link');
    if (facebookBtn) facebookBtn.addEventListener('click', () => trackAnalyticsEvent('click_social_facebook', { location: 'about_modal' }));

    setupNextTrainAutocomplete();

    if (stationSelect) {
        stationSelect.addEventListener('change', () => { 
            trackAnalyticsEvent('select_station', { station: stationSelect.value, route_id: typeof currentRouteId !== 'undefined' ? currentRouteId : 'none' });
            syncPlannerFromMain(stationSelect.value); 
            
            const searchInput = document.getElementById('station-search-input');
            if (searchInput && stationSelect.value) {
                searchInput.value = stationSelect.value.replace(' STATION', '');
            } else if (searchInput) {
                searchInput.value = '';
            }
            
            findNextTrains(); 
        });
    }

    if (locateBtn) {
        locateBtn.addEventListener('click', () => { 
            triggerHaptic();
            trackAnalyticsEvent('click_auto_locate', { location: 'home_header' }); 
            findNearestStation(false); 
        });
    }
    
    if (pinRouteBtn) {
        pinRouteBtn.addEventListener('click', () => { 
            const regionKey = 'defaultRoute_' + currentRegion;
            let savedDefault = null;
            try { savedDefault = safeStorage.getItem(regionKey); } catch(e) {}
            
            if (savedDefault === currentRouteId) { 
                try { safeStorage.removeItem(regionKey); } catch(e) {}
                trackAnalyticsEvent('click_pin_route', { action: 'unpin', route_id: currentRouteId }); 
                showToast("Route unpinned.", "info", 2000); 
            } else { 
                try { safeStorage.setItem(regionKey, currentRouteId); } catch(e) {}
                trackAnalyticsEvent('click_pin_route', { action: 'pin', route_id: currentRouteId }); 
                showToast("Route pinned!", "success", 2000); 
            } 
            updatePinUI(); 
        });
    }

    const viewMapBtn = document.getElementById('view-map-btn');
    if (viewMapBtn) viewMapBtn.addEventListener('click', () => { 
        triggerHaptic(); 
        trackAnalyticsEvent('click_static_map', { location: 'sidebar' }); 
        history.pushState({ modal: 'map' }, '', '#map'); 
        window.closeAppHub(true); 
        setTimeout(() => { openSmoothModal('map-modal'); }, 50);
    });

    const interactiveMapBtn = document.getElementById('sidenav-interactive-map-btn');
    if (interactiveMapBtn) interactiveMapBtn.addEventListener('click', () => {
        triggerHaptic(); 
        trackAnalyticsEvent('click_interactive_map', { location: 'sidebar' }); 
        window.closeAppHub(true); 
        
        if (navigator.onLine) {
            window.location.href = 'map.html';
        } else {
            showToast("Interactive map unavailable offline. Showing static map.", "info", 3500);
            setTimeout(() => {
                history.pushState({ modal: 'map' }, '', '#map'); 
                openSmoothModal('map-modal');
            }, 400); 
        }
    });
    
    const openInteractiveMapBtn = document.getElementById('open-interactive-map-btn');
    if (openInteractiveMapBtn) openInteractiveMapBtn.addEventListener('click', () => { triggerHaptic(); trackAnalyticsEvent('open_interactive_map', { source: 'modal' }); });
    
    const routeSelectorBtn = document.getElementById('route-selector-btn');
    if (routeSelectorBtn) {
        routeSelectorBtn.addEventListener('click', () => {
            history.pushState({ modal: 'route' }, '', '#route');
        });
    }

    // 🛡️ GUARDIAN PHASE 2 (Translation Immunity): Bind stripped inline attributes safely
    const appHubRegionSelect = document.getElementById('app-hub-region-select');
    if (appHubRegionSelect) {
        appHubRegionSelect.addEventListener('change', function() {
            if (typeof window.handleRegionChange === 'function') { window.handleRegionChange(this.value, this); } 
            else { try { typeof safeStorage !== 'undefined' ? safeStorage.setItem('userRegion', this.value) : localStorage.setItem('userRegion', this.value); } catch(e) {} window.location.reload(); }
        });
    }

    const routeModalRegionSelect = document.getElementById('route-modal-region-select');
    if (routeModalRegionSelect) {
        routeModalRegionSelect.addEventListener('change', function() {
            if (typeof window.handleRegionChange === 'function') { window.handleRegionChange(this.value, this); } 
            else { try { typeof safeStorage !== 'undefined' ? safeStorage.setItem('userRegion', this.value) : localStorage.setItem('userRegion', this.value); } catch(e) {} window.location.reload(); }
        });
    }

    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', () => {
            if (typeof showCacheClearWarning === 'function') showCacheClearWarning();
        });
    }
    
    setupFeatureButtons(); 
    setupSettingsHub();
    setupModalButtons(); 
    setupFeedbackLogic(); 
    if (typeof startSmartRefresh === 'function') startSmartRefresh();
    setupSwipeNavigation(); 
    initTabIndicator(); 
    
    if (typeof setupMapLogic === 'function') {
        setupMapLogic(); 
    }

    const mapImageEl = document.getElementById('map-image');
    if (mapImageEl) {
        if (currentRegion === 'WC') mapImageEl.src = 'images/network-map_wc.png';
        else if (currentRegion === 'KZN') mapImageEl.src = 'images/network-map_kzn.png';
        else if (currentRegion === 'EC') mapImageEl.src = 'images/network-map_ec.png';
        else mapImageEl.src = 'images/network-map.png';
    }

    let savedDefault = null;
    try { savedDefault = safeStorage.getItem('defaultRoute_' + currentRegion); } catch(e) {}
    
    if (!savedDefault) {
        let legacyDefault = null;
        try { legacyDefault = safeStorage.getItem('defaultRoute'); } catch(e) {}
        if (legacyDefault && typeof ROUTES !== 'undefined' && ROUTES[legacyDefault] && ROUTES[legacyDefault].region === currentRegion) {
            savedDefault = legacyDefault;
            try { safeStorage.setItem('defaultRoute_' + currentRegion, legacyDefault); } catch(e) {}
        }
    }
    
    if (savedDefault && typeof ROUTES !== 'undefined' && ROUTES[savedDefault] && ROUTES[savedDefault].region === currentRegion) {
        currentRouteId = savedDefault;
        if (typeof loadAllSchedules === 'function') {
            loadAllSchedules().then(() => {
                if (navigator.permissions && navigator.permissions.query) {
                    navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
                        if (result.state === 'granted') {
                            console.log("Location permission already granted. Auto-locating...");
                            if (typeof findNearestStation === 'function') findNearestStation(true);
                        }
                    });
                }
            });
        }
    } else {
        console.log("First time user (or switched regions). Showing Welcome Screen.");
        if (typeof loadingOverlay !== 'undefined' && loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        showWelcomeScreen();
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('action')) {
        console.log("Shortcut action detected, ignoring saved tab preference.");
    } else {
        let lastActiveTab = null;
        try { lastActiveTab = safeStorage.getItem('activeTab'); } catch(e) {}
        if (lastActiveTab) {
            switchTab(lastActiveTab);
        } else {
            switchTab('next-train');
        }
    }

    initializeApp();
});

// GUARDIAN Phase 1.3: Update date text on the main UI
function updateLastUpdatedText() {
    if (typeof fullDatabase === 'undefined' || !fullDatabase) return;
    let displayDate = fullDatabase.lastUpdated || "Unknown";
    const isValidDate = (d) => d && d !== "undefined" && d !== "null" && String(d).length > 5;
    
    if (currentDayType === 'weekday' || currentDayType === 'monday') { 
        if (typeof schedules !== 'undefined' && schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) displayDate = schedules.weekday_to_a.lastUpdated;
    } else if (currentDayType === 'saturday') {
        if (typeof schedules !== 'undefined' && schedules.saturday_to_a && isValidDate(schedules.saturday_to_a.lastUpdated)) displayDate = schedules.saturday_to_a.lastUpdated;
    } else if (currentDayType === 'sunday') {
         if (typeof schedules !== 'undefined' && schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) displayDate = schedules.weekday_to_a.lastUpdated;
    }
    
    if (typeof formatEffectiveDate === 'function') {
        displayDate = formatEffectiveDate(displayDate);
    }
    
    // GUARDIAN BUGFIX: Restored "Schedule Effective from:" phrasing to match HTML placeholder 
    if (displayDate && typeof lastUpdatedEl !== 'undefined' && lastUpdatedEl) lastUpdatedEl.textContent = `Schedule effective from: ${displayDate}`;
}