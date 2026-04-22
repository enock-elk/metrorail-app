/**
 * METRORAIL NEXT TRAIN - UI CONTROLLER (V6.04.21 - Guardian Enterprise Edition)
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

// --- GUARDIAN: OVERRIDE SMOOTH MODAL TO CATCH TELEMETRY LEAKS ---
// We intercept the modal close function (defined in index.html) to guarantee 
// the admin telemetry interval is annihilated the moment the Dev Hub is hidden.
if (typeof window.closeSmoothModal === 'function' && !window._patchedCloseSmoothModal) {
    const originalCloseSmoothModal = window.closeSmoothModal;
    window.closeSmoothModal = function(modalId) {
        if (modalId === 'dev-modal' && window.Admin && window.Admin.telemetryInterval) {
            clearInterval(window.Admin.telemetryInterval);
            window.Admin.telemetryInterval = null;
        }
        originalCloseSmoothModal(modalId);
    };
    window._patchedCloseSmoothModal = true;
}

// --- GLOBAL APP HUB CLOSER (GUARDIAN UX FIX) ---
window.closeAppHub = function(fromPopState = false) {
    const sn = document.getElementById('sidenav');
    const overlay = document.getElementById('sidenav-overlay');
    
    // GUARDIAN Phase 3: Failsafe telemetry wipe
    if (window.Admin && window.Admin.telemetryInterval) {
        clearInterval(window.Admin.telemetryInterval);
        window.Admin.telemetryInterval = null;
    }

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
        "ResizeObserver loop limit exceeded"
    ];

    if (typeof msg === 'string' && IGNORED_ERRORS.some(err => msg.indexOf(err) > -1)) {
        console.warn("Global Error Suppressed:", msg);
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

    // GUARDIAN (Option B): Silent Ninja Protocol (Strike 2)
    // We do absolutely nothing to the UI. The red toast has been purged.
    // Sentry will automatically capture this exception in the background.
    console.log("🛡️ Guardian: Strike 2 Error intercepted. UI alert suppressed. Forwarding to Sentry.");
    
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
            console.log(`[OfflineTracker] Flushing ${queue.length} events...`);
            queue.forEach(item => {
                const enrichedParams = { ...item.params, offline_captured: true, original_ts: item.timestamp };
                trackAnalyticsEvent(item.event, enrichedParams);
            });
            safeStorage.removeItem(OfflineTracker.queueKey);
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
            // GUARDIAN FIX: Persist the ID dynamically into the user_properties map
            gtag('set', 'user_properties', { 
                crm_region: params.region,
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
});

window.addEventListener('offline', () => { 
    const oi = document.getElementById('offline-indicator');
    if (oi) oi.style.display = 'flex';
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
                unlockBackgroundScroll(); // GUARDIAN: Release scroll when selection made
            };
            list.appendChild(li);
        });
    }
    list.classList.remove('hidden');
    lockBackgroundScroll(); // GUARDIAN: Lock scroll while dropdown is open
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
        list.className = "absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-xl max-h-60 overflow-y-auto hidden mt-1 left-0 custom-scrollbar";
        input.parentNode.appendChild(list);
        
        input.addEventListener('click', (e) => { 
            e.stopPropagation();
            if (list.classList.contains('hidden')) {
                window._renderNextTrainList(); 
            } else {
                list.classList.add('hidden');
                unlockBackgroundScroll();
            }
        });
        
        if (chevron) {
            chevron.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                if (list.classList.contains('hidden')) {
                    window._renderNextTrainList();
                } else {
                    list.classList.add('hidden');
                    unlockBackgroundScroll(); 
                }
            });
        }
        
        document.addEventListener('click', (e) => { 
            if (!input.contains(e.target) && !list.contains(e.target) && (!chevron || !chevron.contains(e.target))) {
                if (!list.classList.contains('hidden')) {
                    list.classList.add('hidden');
                    unlockBackgroundScroll(); 
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

function renderPlaceholder() {
    const triggerShake = `
        const inp = document.getElementById('station-search-input');
        const sel = document.getElementById('station-select');
        const target = (inp && !inp.classList.contains('hidden')) ? inp : sel;
        if(target) {
            target.classList.add('animate-shake', 'ring-4', 'ring-blue-300'); 
            setTimeout(() => target.classList.remove('animate-shake', 'ring-4', 'ring-blue-300'), 500); 
            target.focus();
        }
    `;
    
    const placeholderHTML = `
        <div onclick="${triggerShake.replace(/\n/g, ' ')}" class="h-24 flex flex-col justify-center items-center text-gray-400 dark:text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group w-full">
            <svg class="w-6 h-6 mb-1 opacity-50 group-hover:scale-110 transition-transform text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <span class="text-xs font-bold group-hover:text-blue-500 transition-colors">Tap to select station</span>
        </div>`;

    if(pretoriaTimeEl) pretoriaTimeEl.innerHTML = placeholderHTML;
    if(pienaarspoortTimeEl) pienaarspoortTimeEl.innerHTML = placeholderHTML;

    if (typeof updateFareDisplay === 'function') {
        updateFareDisplay(null, null);
    }
    
    updateNextTrainView();
}

function renderRouteError(error) {
    if (typeof Renderer !== 'undefined') {
        if(pretoriaTimeEl) Renderer.renderRouteError(pretoriaTimeEl, error);
        if(pienaarspoortTimeEl) Renderer.renderRouteError(pienaarspoortTimeEl, error);
    }
    if(stationSelect) stationSelect.innerHTML = '<option>Unable to load stations</option>';
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
    const currentRoute = ROUTES[currentRouteId];
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
    if (!allJourneys || !Array.isArray(allJourneys)) return; // GUARDIAN: Sentry JAVASCRIPT-1P Fix

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
              element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No scheduled trains.</div>`;
              return;
        }
        renderNextAvailableTrain(element, destination);
    }
}

// GUARDIAN BUGFIX 4: Dynamically uses window.simulateNextActiveService
function renderNextAvailableTrain(element, destination) {
    if (!element) return;
    const currentRoute = ROUTES[currentRouteId];
    if (!currentRoute) return;

    const selectedStation = stationSelect ? stationSelect.value : "";
    const simResult = typeof window.simulateNextActiveService === 'function' 
        ? window.simulateNextActiveService(selectedStation, destination) 
        : null;

    if (!simResult) { 
        element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No upcoming trains.</div>`; 
        return; 
    }
    
    if (typeof Renderer !== 'undefined') {
        Renderer.renderNextAvailableTrain(element, destination, simResult.train, simResult.dayInfo.name, simResult.dayInfo.type, simResult.daysAhead);
    }
}

function updateFareDisplay(sheetKey, nextTrainTimeStr) {
    fareContainer = document.getElementById('fare-container');
    fareAmount = document.getElementById('fare-amount');
    fareType = document.getElementById('fare-type');
    passengerTypeLabel = document.getElementById('passenger-type-label');
    
    // GUARDIAN Phase 4: Protect against detached nodes
    if (!fareContainer || !fareContainer.parentNode) return; 

    if (passengerTypeLabel) passengerTypeLabel.textContent = currentUserProfile;

    const newFareContainer = fareContainer.cloneNode(true);
    fareContainer.parentNode.replaceChild(newFareContainer, fareContainer);
    fareContainer = newFareContainer;
    
    fareAmount = document.getElementById('fare-amount');
    fareType = document.getElementById('fare-type');
    passengerTypeLabel = document.getElementById('passenger-type-label');

    if (fareType && passengerTypeLabel && fareType.parentNode !== passengerTypeLabel.parentNode) {
        let passWrapper = document.getElementById('passenger-type-wrapper');
        // GUARDIAN Phase 4: Ensure parentNode exists before insertBefore
        if (!passWrapper && passengerTypeLabel.parentNode) {
            passWrapper = document.createElement('div');
            passWrapper.id = 'passenger-type-wrapper';
            passWrapper.className = 'flex items-center space-x-2';
            passengerTypeLabel.parentNode.insertBefore(passWrapper, passengerTypeLabel);
            passWrapper.appendChild(passengerTypeLabel); // GUARDIAN Phase 2: Fixed fatal typo to stop infinite DOM loop
        }
        if (passWrapper) passWrapper.appendChild(fareType);
    }

    fareContainer.className = "mb-6 p-3.5 rounded-xl flex items-center justify-between shadow-sm min-h-[58px] pr-10 relative transition-colors group";

    const fareData = getRouteFare(sheetKey, nextTrainTimeStr);
    const detailed = typeof getDetailedFare === 'function' ? getDetailedFare(sheetKey) : null;
    
    if (detailed && detailed.prices) {
        fareContainer.onclick = () => openFareModal(detailed);
        fareContainer.classList.add('cursor-pointer');
        
        if (!document.getElementById('fare-chevron')) {
            const chevron = document.createElement('div');
            chevron.id = 'fare-chevron';
            chevron.className = "absolute right-3 top-1/2 transform -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity flex items-center justify-center shrink-0";
            chevron.innerHTML = `<svg class="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
            fareContainer.appendChild(chevron);
        }
    } else {
        const existingChevron = document.getElementById('fare-chevron');
        if(existingChevron) existingChevron.remove();
    }

    if (fareData) {
        if(fareAmount) fareAmount.textContent = `R${fareData.price}`;
        
        fareContainer.classList.add('bg-blue-50', 'dark:bg-gray-800', 'border', 'border-blue-100', 'dark:border-gray-700');
        if (detailed && detailed.prices) fareContainer.classList.add('hover:bg-blue-100', 'dark:hover:bg-gray-700');
        
        if(fareAmount) fareAmount.className = "text-2xl font-black text-gray-900 dark:text-white leading-none";

        if (nextTrainTimeStr) {
            if (fareData.isPromo) {
                if(fareType) {
                    fareType.textContent = fareData.discountLabel || "Discounted";
                    fareType.className = "text-[9px] font-bold text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded uppercase tracking-wide whitespace-nowrap inline-block";
                }
            } else if (fareData.isOffPeak) {
                if(fareType) {
                    fareType.textContent = "40% Off"; 
                    fareType.className = "text-[9px] font-bold text-green-600 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-1.5 py-0.5 rounded uppercase tracking-wide whitespace-nowrap inline-block";
                }
            } else {
                if(fareType) fareType.className = "hidden"; 
            }
        } 
        else {
            if(fareType) fareType.className = "hidden";
        }
        
    } else {
        fareContainer.classList.add('bg-blue-50', 'dark:bg-gray-800', 'border', 'border-blue-100', 'dark:border-gray-700');
        if(fareAmount) {
            fareAmount.textContent = "R --.--";
            fareAmount.className = "text-2xl font-black text-gray-300 dark:text-gray-600 leading-none";
        }
        if (stationSelect && stationSelect.value) {
             if(fareType) {
                 fareType.textContent = "Rate Unavailable";
                 fareType.className = "text-[9px] font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded uppercase tracking-wide whitespace-nowrap inline-block";
             }
        } else {
             if(fareType) fareType.className = "hidden";
        }
    }
    
    fareContainer.classList.remove('hidden');
}

window.openFareModal = function(fareDetails) {
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
    
    const routeName = currentRouteId && ROUTES[currentRouteId] ? ROUTES[currentRouteId].name.replace('<->', '↔') : '';
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

    // GUARDIAN Phase 4: Strict null check to prevent toast crashes on startup
    const toastEl = document.getElementById('toast');
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

    toastEl.className = `flex items-center justify-between px-4 py-3 rounded-full shadow-2xl backdrop-blur-md border ${bgClass} ${borderClass} ${textClass}`; 

    toastEl.innerHTML = `
        <div class="flex items-center gap-2">
            ${iconHTML}
            <span class="text-sm font-medium tracking-wide whitespace-nowrap">${message}</span>
        </div>
        ${actionHTML ? `<div class="ml-3 pl-3 border-l border-white/20">${actionHTML}</div>` : ''}
    `;
    
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
    if(profileModal) {
        history.pushState({ modal: 'profile' }, '', '#profile');
        openSmoothModal('profile-modal');
        window.closeAppHub(); 
    }
};

function updatePinUI() {
    const savedDefault = safeStorage.getItem('defaultRoute_' + currentRegion); 
    const isPinned = savedDefault === currentRouteId;
    if (pinOutline && pinFilled && pinRouteBtn) {
        if (isPinned) { pinOutline.classList.add('hidden'); pinFilled.classList.remove('hidden'); pinRouteBtn.title = "Unpin this route"; } 
        else { pinOutline.classList.remove('hidden'); pinFilled.classList.add('hidden'); pinRouteBtn.title = "Pin this route as default"; }
    }
    if (typeof Renderer !== 'undefined') Renderer.renderRouteMenu('route-list', getRoutesForCurrentRegion(), currentRouteId);
}

function updateSidebarActiveState() {
    if (typeof Renderer !== 'undefined') Renderer.renderRouteMenu('route-list', getRoutesForCurrentRegion(), currentRouteId);
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

    if (route && ROUTES[route]) {
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

// GUARDIAN BUGFIX: Properly attribute analytics source for forced system cache wipes
window.performHardCacheClear = async function(source = 'modal_confirm') {
    triggerHaptic();
    
    // 🛡️ GUARDIAN FIX: Stop spamming analytics! Only fire when manually initiated from UI.
    if (source === 'modal_confirm') {
        trackAnalyticsEvent('execute_hard_cache_clear', { location: 'sidebar' });
        showToast("Clearing offline data and syncing...", "info", 5000);

        // 🛡️ GUARDIAN PHASE 1 (Analytics Beacon Hardening):
        // The GA4 and Clarity tracking pixels need time to leave the device.
        // If we immediately unregister the Service Worker below, it aborts in-flight network requests.
        // We force a 600ms network buffer here to guarantee the beacon lands.
        await new Promise(resolve => setTimeout(resolve, 600));
    }
    
    window.closeAppHub(true); 
    
    const modal = document.getElementById('cache-clear-modal');
    if (modal) {
        closeSmoothModal('cache-clear-modal');
    }
    
    // GUARDIAN Phase 4: Async Cache Wipe to prevent Update Race Conditions
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

        // 🛡️ GUARDIAN PHASE 2: Identity Protection Protocol (The Vault)
        // Replace manual key targeting with the full volatile sweep.
        // This safely obliterates old schedules/zombie keys while locking Identity & Settings.
        if (typeof safeStorage.flushVolatile === 'function') {
            safeStorage.flushVolatile();
        } else {
            safeStorage.removeItem(`full_db_${currentRegion}`); 
            safeStorage.removeItem('app_installed_version');
        }
        
        if (window.indexedDB) {
            indexedDB.deleteDatabase('NextTrainDB');
            console.log("🛡️ Guardian: IndexedDB 'NextTrainDB' successfully queued for deletion.");
        }
    } catch (e) {
        console.warn("🛡️ Guardian: Failed to fully clear caches", e);
    }
    
    // 🛡️ GUARDIAN PHASE 1: Extended disk IO buffer before reload
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
};

window.showCacheClearWarning = function() {
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
    
    // GUARDIAN BUGFIX: Call updatePinUI here *after* currentRouteId has been populated from storage
    // This perfectly syncs the empty/filled visual state of the Star Pin button on the main screen.
    updatePinUI();
    
    // Call the global startClock bound in logic.js
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
    if (!navigator.onLine) return; 
    try {
        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        const res = await fetch(`${dynamicEndpoint}config/maintenance.json?t=${Date.now()}`);
        const isActive = await res.json();
        
        const existingBanner = document.getElementById('maintenance-banner');

        if (isActive === true) {
            if (!existingBanner) {
                const mainCard = document.getElementById('main-content');
                if (mainCard) {
                    const banner = document.createElement('div');
                    banner.id = 'maintenance-banner';
                    banner.style.background = 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 10px, #d97706 10px, #d97706 20px)';
                    banner.className = "absolute top-0 left-0 w-full z-50 text-white text-[10px] font-bold text-center py-1 shadow-sm";
                    banner.innerHTML = `⚠️ MAINTENANCE IN PROGRESS`;
                    mainCard.prepend(banner);
                }
            }
        } else {
            // GUARDIAN FIX: Actively remove the banner if maintenance is over
            if (existingBanner) {
                existingBanner.remove();
            }
        }
    } catch(e) { /* silent fail */ }
}

// 🛡️ GUARDIAN UX: INTERACTIVE POLL VOTE HANDLER
window.submitPollVote = function(pollId, optionKey, optionText) {
    triggerHaptic();
    
    // Protect against double voting locally
    if (safeStorage.getItem('poll_voted_' + pollId)) {
        showToast("You have already voted on this poll.", "warning");
        return;
    }

    // Fire Analytics (Zero Database Writes, purely measured in GA4!)
    trackAnalyticsEvent('alert_poll_vote', { 
        poll_id: pollId, 
        vote_option: optionKey,
        vote_text: optionText,
        route_id: currentRouteId || 'global'
    });

    // Save persistent state
    try { safeStorage.setItem('poll_voted_' + pollId, optionKey); } catch(e) {}

    // Instantly morph the UI to the "Thank You" state
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
        const response = await fetch(`${dynamicEndpoint}notices.json?t=${Date.now()}`);
        if (!response.ok) return; 
        const notices = await response.json();
        
        const existingTicker = document.getElementById('service-ticker');
        if (existingTicker) existingTicker.remove();
        
        if (!notices) { 
            bellBtn.classList.add('hidden'); 
            return; 
        }
        
        const now = Date.now();
        let validNotices = [];
        
        const activeRegionString = typeof currentRegion !== 'undefined' ? currentRegion : 'GP';
        const targetKeys = [currentRouteId, `all_${activeRegionString}`, 'all'];
        
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
        
        const activeNotice = validNotices[0];
        const severity = activeNotice.severity || 'info';
        const seenKey = `seen_notice_${activeNotice.id}`;
        const hasSeen = safeStorage.getItem(seenKey) === 'true';
        const forcePopup = activeNotice.forcePopup === true;
        
        // GUARDIAN Phase 2: Content Binder (With URL Parsing & Dynamic Feedback Button)
        const bindModalContent = () => {
            if (!content || !modal) return;
            
            // Basic text parsing
            let formattedMsg = activeNotice.message.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" class="text-blue-500 dark:text-blue-400 underline underline-offset-2" target="_blank">$1</a>');
            
            // 🛡️ SUPERCHARGED ALERTS: Rich Media Injection (Images & CTA Buttons)
            let mediaHtml = '';
            
            if (activeNotice.imageUrl) {
                mediaHtml += `<img src="${escapeHTML(activeNotice.imageUrl)}" class="w-full h-auto max-h-48 object-cover rounded-lg mb-3 shadow-sm border border-gray-200 dark:border-gray-700" alt="Alert Image" onerror="this.style.display='none'">`;
            }

            // Put image on top, then text
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

            // 🛡️ SUPERCHARGED ALERTS: Interactive Polling Engine
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
            
            // Append Severity Tags below everything
            if (severity === 'critical') {
                content.innerHTML += `<div class="mt-3 text-xs text-red-600 font-bold border border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800 p-2 rounded text-center">🔴 CRITICAL SERVICE DISRUPTION</div>`;
            } else if (severity === 'warning') {
                content.innerHTML += `<div class="mt-3 text-xs text-yellow-700 font-bold border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-400 p-2 rounded text-center">🟡 SERVICE WARNING</div>`;
            }
            
            const date = new Date(activeNotice.postedAt);
            if (timestamp) timestamp.textContent = `Posted: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, ${date.toLocaleDateString()}`;

            // Dynamic Form Feedback Button Injection
            const oldCloseBtn = modal.querySelector('button.bg-red-600') || modal.querySelector('button.bg-blue-600') || modal.querySelector('button.bg-yellow-600');
            if (oldCloseBtn && oldCloseBtn.parentNode === modal.firstElementChild) {
                // Determine base color class
                let baseColorClass = "bg-blue-600 hover:bg-blue-700";
                if (severity === 'critical') baseColorClass = "bg-red-600 hover:bg-red-700";
                else if (severity === 'warning') baseColorClass = "bg-yellow-600 hover:bg-yellow-700";

                const btnContainer = document.createElement('div');
                btnContainer.className = "flex space-x-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 w-full";
                
                const newCloseBtn = document.createElement('button');
                newCloseBtn.className = "flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors focus:outline-none";
                newCloseBtn.textContent = "Close";
                newCloseBtn.onclick = closeNotice;

                // GUARDIAN FEEDBACK: Bind Reply to internal Feedback system
                const newReplyBtn = document.createElement('button');
                newReplyBtn.className = `flex-1 ${baseColorClass} text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors focus:outline-none flex items-center justify-center`;
                newReplyBtn.innerHTML = `<span class="mr-1.5">💬</span> Reply`;
                
                // 🛡️ GUARDIAN PHASE 4: Contextual Alert Reply formatting
                newReplyBtn.onclick = () => {
                    triggerHaptic();
                    
                    // Strip HTML completely so the admin input box isn't polluted
                    let cleanMsgText = "";
                    if (activeNotice && activeNotice.message) {
                        cleanMsgText = activeNotice.message.replace(/<[^>]*>?/gm, '');
                        // Strip the signature if it exists (everything after the em dash)
                        cleanMsgText = cleanMsgText.replace(/—.*/, '').trim();
                    }
                    
                    // Truncate to a digestible context length (First 6 words)
                    let words = cleanMsgText.split(/\s+/).filter(w => w.length > 0);
                    let truncatedMsg = words.slice(0, 6).join(' ');
                    if (words.length > 6) truncatedMsg += '...';
                    
                    // Pre-fill the modal
                    const fText = document.getElementById('feedback-text');
                    const fType = document.getElementById('feedback-type');
                    if (fText) fText.value = `Replying to: "${truncatedMsg}"\n\n`;
                    if (fType) fType.value = 'general';
                    
                    closeNotice();
                    // Open modal after CSS transition finishes
                    setTimeout(() => {
                        const feedbackBtn = document.getElementById('feedback-btn');
                        if (feedbackBtn) feedbackBtn.click();
                    }, 350);
                };

                oldCloseBtn.parentNode.replaceChild(btnContainer, oldCloseBtn);
                btnContainer.appendChild(newCloseBtn);
                btnContainer.appendChild(newReplyBtn);
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

            if (forcePopup && !window._criticalModalShown) {
                window._criticalModalShown = true;
                setTimeout(() => {
                    triggerHaptic();
                    trackAnalyticsEvent('auto_open_alert', { severity: severity, route_id: currentRouteId || 'all' });
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
            trackAnalyticsEvent('view_service_alert', { severity: severity, route_id: currentRouteId || 'all' });
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
    triggerHaptic();
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
    const activeModals = [];
    const modalIds = [
        'pin-modal', 'dev-modal', 'about-modal', 'help-modal', 'legal-modal', 
        'profile-modal', 'notice-modal', 'cache-clear-modal', 'fare-modal', 
        'schedule-modal', 'full-schedule-modal', 'map-modal', 'trip-map-modal', 
        'redirect-modal', 'welcome-modal', 'changelog-modal', 'region-confirm-modal',
        'route-modal', 'install-modal', 'feedback-modal', 'region-soon-modal' // GUARDIAN: Added 'region-soon-modal'
    ];
    
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
            activeModals.push(id);
        }
    });

    if (activeModals.length > 0) {
        const topTier = ['pin-modal', 'dev-modal', 'notice-modal', 'cache-clear-modal', 'fare-modal', 'about-modal', 'help-modal', 'legal-modal', 'profile-modal', 'changelog-modal', 'region-confirm-modal', 'route-modal', 'install-modal', 'feedback-modal', 'region-soon-modal']; // GUARDIAN: Added 'region-soon-modal'
        const midTier = ['schedule-modal', 'full-schedule-modal', 'redirect-modal', 'welcome-modal', 'trip-map-modal']; 
        const baseTier = ['map-modal'];

        let modalToClose = null;
        for (const id of topTier) { if (activeModals.includes(id)) { modalToClose = id; break; } }
        if (!modalToClose) { for (const id of midTier) { if (activeModals.includes(id)) { modalToClose = id; break; } } }
        if (!modalToClose) { for (const id of baseTier) { if (activeModals.includes(id)) { modalToClose = id; break; } } }

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
    if (!contentArea) return; // GUARDIAN: Safety
    
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

// GUARDIAN BUGFIX 4: Dynamic Simulator Resolution for Modal
window.openScheduleModal = function(destination, dayOverride = null) {
    history.pushState({ modal: 'schedule' }, '', '#schedule');
    let journeys = [];
    let titleSuffix = "";
    let targetDayIdx = currentDayIndex; // Default

    if (dayOverride) {
        const currentRoute = ROUTES[currentRouteId];
        let sheetKey = null;

        // Automatically discover the correct targetDayIdx if checking future schedules
        const selectedStation = stationSelect ? stationSelect.value : "";
        const simResult = typeof window.simulateNextActiveService === 'function'
            ? window.simulateNextActiveService(selectedStation, destination)
            : null;
        
        if (simResult && simResult.dayInfo.type === dayOverride) {
            targetDayIdx = simResult.dayInfo.idx;
            titleSuffix = ` (${simResult.dayInfo.name})`;
        } else {
            // Fallback
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
    const nowSeconds = timeToSeconds(currentTime);
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
             
             // GUARDIAN V6.04.14 FIX: Universal String Split for region-agnostic formatting
             if (rawName.includes('<->')) {
                 routeName = rawName.split('<->')[1].trim();
             } else if (rawName.includes('↔')) {
                 routeName = rawName.split('↔')[1].trim();
             }

             if (j.isDivergent) {
                 const divDest = Renderer._applyUIIntercepts(j.actualDestName);
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
    
    // GUARDIAN BUGFIX: Call the smooth modal engine to prevent dead-ends
    openSmoothModal('schedule-modal');
    
    if (!dayOverride) { setTimeout(() => { const target = document.getElementById('next-train-marker'); if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 10); } 
    else { const container = document.getElementById('modal-list'); if(container) container.scrollTop = 0; }
};

// --- GUARDIAN PHASE 2: IN-HOUSE FEEDBACK PIPELINE ---
function setupFeedbackLogic() {
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', (e) => { 
            e.preventDefault(); 
            triggerHaptic();
            
            // 🛡️ GUARDIAN PHASE 4: THE HYBRID FEEDBACK INTERCEPTOR
            // If the route is inactive (coming soon), OR if we are caught in the KZN/EC region trap,
            // we bypass the in-house modal entirely and route to Google Forms (to protect Firebase Storage limits).
            const currentRoute = typeof currentRouteId !== 'undefined' && currentRouteId ? ROUTES[currentRouteId] : null;
            const isInactiveRoute = currentRoute && !currentRoute.isActive;
            
            if (isInactiveRoute || window.lastClickedFutureRegion) {
                trackAnalyticsEvent('open_google_form_feedback', { 
                    location: 'feedback_interceptor',
                    region: window.lastClickedFutureRegion || currentRegion
                });
                
                // Directly launch the massive Crowdsource Form for heavy files
                window.open('https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform', '_blank');
                window.lastClickedFutureRegion = null; // Clear the trap state safely
                return;
            }

            // Normal In-House Text-Feedback Modal for active regions/routes
            trackAnalyticsEvent('open_feedback_modal', { location: 'app_footer' });
            history.pushState({ modal: 'feedback' }, '', '#feedback');
            openSmoothModal('feedback-modal'); 
        }); 
    }

    // Bind File Input Triggers
    const fileInput = document.getElementById('feedback-file');
    const filePreview = document.getElementById('feedback-file-preview');
    const fileNameDisplay = document.getElementById('feedback-file-name');
    const fileRemoveBtn = document.getElementById('feedback-file-remove');

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                
                // Strict 5MB payload limit to protect Firebase Quota
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

    // Bind Submit Button
    const submitBtn = document.getElementById('feedback-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitFeedback);
    }
}

async function submitFeedback() {
    const type = document.getElementById('feedback-type').value;
    const text = document.getElementById('feedback-text').value.trim();
    const email = document.getElementById('feedback-email').value.trim();
    const fileInput = document.getElementById('feedback-file');
    const submitBtn = document.getElementById('feedback-submit-btn');
    const submitText = document.getElementById('feedback-submit-text');
    const spinner = document.getElementById('feedback-spinner');

    // 🛡️ GUARDIAN PHASE 4: Strict Empty Noise Blocker
    if (!text || text.length < 5) {
        showToast("Please provide more details (at least 5 characters).", "error");
        return;
    }

    // GUARDIAN PHASE 2: Analytics event for the feedback submission click
    const hasFile = !!(fileInput && fileInput.files && fileInput.files.length > 0);
    trackAnalyticsEvent('click_submit_feedback_btn', { feedback_type: type, has_attachment: hasFile });

    triggerHaptic();
    submitBtn.disabled = true;
    submitText.textContent = "Sending...";
    spinner.classList.remove('hidden');

    try {
        // Ensure anonymous auth so Firebase Storage Rules will accept the upload
        if (window.firebaseAuth && !window.firebaseAuth.currentUser && window.firebaseSignInAnonymously) {
            await window.firebaseSignInAnonymously(window.firebaseAuth);
        }

        // GUARDIAN FIX: Securely fetch ID Token to authenticate REST API writes
        let authToken = "";
        if (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseGetIdToken) {
            authToken = await window.firebaseGetIdToken(window.firebaseAuth.currentUser, true);
        }

        let attachmentUrl = null;

        // Secure Storage Uploader Pipeline with 15-Second Timeout Race
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
                        uploadTask.cancel(); // Force kill the background Firebase retries
                    }
                    attachmentUrl = null; // Reset to null so text payload proceeds cleanly
                }
            } else {
                console.warn("🛡️ Firebase Storage SDK not available. Skipping attachment.");
            }
        }

        submitText.textContent = "Saving...";

        const payload = {
            type: type,
            text: text,
            email: email,
            attachmentUrl: attachmentUrl,
            status: "unread", // GUARDIAN: Sets the unread flag for admin sync
            appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown',
            routeId: typeof currentRouteId !== 'undefined' ? currentRouteId : 'none',
            region: typeof currentRegion !== 'undefined' ? currentRegion : 'GP',
            timestamp: Date.now(),
            userAgent: navigator.userAgent
        };

        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        
        // GUARDIAN FIX: Append Auth Token to REST URL
        const authParam = authToken ? `?auth=${authToken}` : '';
        
        // Push payload to RTDB using REST POST (creates a secure unique ID instantly)
        const res = await fetch(`${dynamicEndpoint}feedback.json${authParam}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            // GUARDIAN FIX: Verbose error logging to catch 401 Unauthorized Rules blocks
            const errorText = await res.text();
            throw new Error(`Failed to post to database: ${res.status} ${res.statusText} - ${errorText}`);
        }

        if (hasFile && !attachmentUrl) {
            showToast("Feedback sent! (Image upload was blocked by network and skipped)", "warning", 4000);
        } else {
            showToast("Feedback sent! Thank you.", "success");
        }
        closeSmoothModal('feedback-modal');
        
        // Reset physical form
        document.getElementById('feedback-text').value = '';
        document.getElementById('feedback-email').value = '';
        document.getElementById('feedback-type').value = 'schedule_error';
        if (fileInput) fileInput.value = '';
        const preview = document.getElementById('feedback-file-preview');
        if (preview) preview.classList.add('hidden');
        
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

// Note: Kept strictly for external links (if any still exist) but decoupled from internal feedback flow
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
            // 🛡️ GUARDIAN Phase 2: Explicitly verified this URL does NOT contain the UID to prevent identity leakage.
            const shareUrl = 'https://nexttrain.co.za/';

            const shareData = { title: "Metrorail Next Train", text: shareText, url: shareUrl }; 
            try { 
                if (navigator.share) { await navigator.share(shareData); } 
                else { copyToClipboard(`${shareText} ${shareUrl}`); } 
            } catch (err) { 
                copyToClipboard(`${shareText} ${shareUrl}`); 
            } 
        });
    }

    installBtn = document.getElementById('install-app-btn');
    const installBtnPlanner = document.getElementById('install-app-btn-planner');
    
    // 🛡️ GUARDIAN PHASE 2: Identity Bridge (WebView Detection)
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isWebView = (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || (ua.indexOf('Instagram') > -1) || (ua.indexOf('Line') > -1);

    const showInstallButton = () => { 
        if (installBtn) installBtn.classList.remove('hidden'); 
        if (installBtnPlanner) installBtnPlanner.classList.remove('hidden'); 
        
        // GUARDIAN Phase 2: Escape Hatch UI Transformation
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
        
        // 🛡️ GUARDIAN PHASE 2: The Identity Bridge Execution
        if (isWebView) {
            const bridgeUrl = `https://nexttrain.co.za/?uid=${NEXT_TRAIN_DEVICE_ID}`;
            copyToClipboard(bridgeUrl);
            showToast("Bridge Link Copied! Paste into Safari/Chrome to continue.", "success", 6000);
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
            sidenav.classList.add('open'); // GUARDIAN: Force CSS transform rule
        }
        if (sidenavOverlay) sidenavOverlay.classList.add('open'); 
        document.body.classList.add('sidenav-open'); 
        lockBackgroundScroll(); // GUARDIAN: Lock scroll
        
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
                triggerHaptic();
                const routeId = routeLink.dataset.routeId; 
                
                if (routeId === currentRouteId) { 
                    showToast("You are already viewing this route.", "info", 1500); 
                    closeSmoothModal('route-modal');
                    return; 
                } 
                
                if (ROUTES[routeId] && !ROUTES[routeId].isActive) {
                    closeSmoothModal('route-modal');
                    trackAnalyticsEvent('select_inactive_route', { route_name: ROUTES[routeId].name, route_id: routeId });
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

window.handleRegionChange = function(newRegion, selectElement) {
    triggerHaptic();
    
    if (newRegion === currentRegion) return;

    // 1. THE INTERCEPTOR: Trap KZN and EC safely to prevent blank screens
    if (newRegion === 'KZN' || newRegion === 'EC') {
        window.lastClickedFutureRegion = newRegion;
        
        // Forcefully revert the dropdown so the UI state remains pristine
        if (selectElement) selectElement.value = currentRegion;

        // Telemetry: Capture the precise demand heatmap for expansion
        trackAnalyticsEvent('select_future_region', { region: newRegion });

        const titleEl = document.getElementById('region-soon-title');
        const descEl = document.getElementById('region-soon-desc');
        const regionName = newRegion === 'KZN' ? 'KwaZulu-Natal' : 'Eastern Cape';
        
        if (titleEl) titleEl.textContent = `${newRegion} is Next!`;
        if (descEl) descEl.textContent = `We are currently mapping out the corridors for ${regionName}. We need your help to launch faster!`;

        history.pushState({ modal: 'region-soon' }, '', '#regionsoon');
        openSmoothModal('region-soon-modal');
        window.closeAppHub(true);

        return; // HALT EXECUTION (Prevents app crash/reload)
    }

    // 2. ACTIVE REGION SWITCHING (GP / WC)
    // We revert the select visually first, waiting for the strict Confirm Modal to handle the actual write
    if (selectElement) selectElement.value = currentRegion;

    if (!navigator.onLine) {
        const cacheKey = `full_db_${newRegion}`;
        const cachedData = safeStorage.getItem(cacheKey);
        if (!cachedData) {
            const name = newRegion === 'GP' ? 'Gauteng' : 'Western Cape';
            showToast(`Internet required to download ${name} schedules for the first time.`, "error", 4000);
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
        const name = newRegion === 'GP' ? 'Gauteng' : 'Western Cape';
        if (title) title.textContent = `Switch Region?`;
        if (desc) desc.textContent = `Are you sure you want to switch to ${name}?`;
        openSmoothModal('region-confirm-modal');
        window.closeAppHub(true);

        const cleanup = () => {
            if (actionBtn) actionBtn.removeEventListener('click', confirmAction);
            if (cancelBtn) cancelBtn.removeEventListener('click', cancelAction);
        };

        const confirmAction = () => {
            triggerHaptic();
            safeStorage.setItem('userRegion', newRegion);
            window.location.reload();
        };

        const cancelAction = () => {
            if (location.hash === '#regionconfirm') history.back();
            else closeSmoothModal('region-confirm-modal');
            cleanup();
        };

        if (actionBtn) actionBtn.addEventListener('click', confirmAction);
        if (cancelBtn) cancelBtn.addEventListener('click', cancelAction);
    }
};

window.voteForRegion = async function() {
    triggerHaptic();
    if (window.lastClickedFutureRegion) {
        const storageKey = 'voted_' + window.lastClickedFutureRegion;
        let hasVoted = false;
        try { hasVoted = safeStorage.getItem(storageKey); } catch(e) {}
        
        // 🛡️ GUARDIAN PHASE 4: Anti-Spam Polling Check
        if (hasVoted) {
            showToast("You've already voted for this region!", "info");
        } else {
            trackAnalyticsEvent('vote_future_region', { region: window.lastClickedFutureRegion });

            // GROWTH MODE Phase 1: Direct Firebase RTDB Push for absolute mathematical proof
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
        // Fallback catch if global variable is empty
        showToast("Thanks for voting!", "success");
    }
    
    if (location.hash === '#regionsoon') history.back();
    else closeSmoothModal('region-soon-modal');
};

function setupSettingsHub() {
    // GUARDIAN FIX: Removed legacy pill-toggle bindings, cleanly mapping basic buttons
    const helpBtn = document.getElementById('settings-help-btn');
    const aboutBtn = document.getElementById('settings-about-btn');
    const helpModal = document.getElementById('help-modal');
    const aboutModal = document.getElementById('about-modal');
    
    if (helpBtn) helpBtn.addEventListener('click', () => { 
        triggerHaptic();
        trackAnalyticsEvent('view_user_guide', { location: 'settings' }); 
        history.pushState({ modal: 'help' }, '', '#help'); 
        if(helpModal) { openSmoothModal('help-modal'); }
        window.closeAppHub(true);
    });
    
    if (aboutBtn) aboutBtn.addEventListener('click', () => { 
        triggerHaptic();
        trackAnalyticsEvent('view_about_page', { location: 'settings' }); 
        history.pushState({ modal: 'about' }, '', '#about'); 
        if(aboutModal) { openSmoothModal('about-modal'); }
        window.closeAppHub(true);
    });

    const verEl = document.getElementById('settings-app-version');
    if (verEl && typeof APP_VERSION !== 'undefined') {
        const versionSpan = verEl.querySelector('span.font-mono');
        if (versionSpan) {
            versionSpan.textContent = APP_VERSION.split(' - ')[0]; 
        } else {
            verEl.textContent = APP_VERSION;
        }
        
        verEl.onclick = () => {
            triggerHaptic();
            if (typeof Renderer !== 'undefined' && Renderer.renderChangelogModal) {
                history.pushState({ modal: 'changelog' }, '', '#changelog');
                Renderer.renderChangelogModal(typeof CHANGELOG_DATA !== 'undefined' ? CHANGELOG_DATA : []);
            }
            window.closeAppHub(true); 
        };
    }
}

function showWelcomeScreen() {
    if (!welcomeModal || !welcomeRouteList || !welcomeRouteList.parentNode) return; // GUARDIAN: Safety

    if (!document.getElementById('welcome-region-selector')) {
        const regionDiv = document.createElement('div');
        regionDiv.id = 'welcome-region-selector';
        regionDiv.className = 'w-full mb-4 flex justify-center space-x-2 shrink-0';
        
        const btnGP = document.createElement('button');
        btnGP.className = `px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors ${currentRegion === 'GP' ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-300'}`;
        btnGP.textContent = 'Gauteng';
        btnGP.onclick = () => { safeStorage.setItem('userRegion', 'GP'); window.location.reload(); };
        
        const btnWC = document.createElement('button');
        btnWC.className = `px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors ${currentRegion === 'WC' ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-300'}`;
        btnWC.textContent = 'Western Cape';
        btnWC.onclick = () => { safeStorage.setItem('userRegion', 'WC'); window.location.reload(); };
        
        regionDiv.appendChild(btnGP);
        regionDiv.appendChild(btnWC);
        
        welcomeRouteList.parentNode.insertBefore(regionDiv, welcomeRouteList);
    }

    if (typeof Renderer !== 'undefined') Renderer.renderWelcomeList('welcome-route-list', getRoutesForCurrentRegion(), selectWelcomeRoute);
    openSmoothModal('welcome-modal');
}

function selectWelcomeRoute(routeId) {
    currentRouteId = routeId;
    safeStorage.setItem('defaultRoute_' + currentRegion, routeId);
    closeSmoothModal('welcome-modal'); 
    setTimeout(() => {
        updateSidebarActiveState(); updatePinUI(); loadAllSchedules(); checkServiceAlerts(); 
    }, 300);
}

window.openLegal = function(type) {
    trackAnalyticsEvent('view_legal_doc', { type: type });
    history.pushState({ modal: 'legal' }, '', '#legal');
    if (legalTitle) legalTitle.textContent = type === 'terms' ? 'Terms of Use' : 'Privacy Policy';
    if (legalContent) legalContent.innerHTML = LEGAL_TEXTS[type];
    openSmoothModal('legal-modal');
    window.closeAppHub(true);
};

function closeLegal() { 
    if(location.hash === '#legal') history.back(); 
    else { closeSmoothModal('legal-modal'); }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then(reg => {
            reg.update();

            if (reg.waiting) {
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
            
            // GUARDIAN Phase 3: Live Server Immunity (Session Storage Protected)
            let lastReload = null;
            try { lastReload = sessionStorage.getItem('sw_last_reload'); } catch(e) {}
            const now = Date.now();
            if (lastReload && (now - parseInt(lastReload, 10)) < 10000) {
                console.warn("🛡️ Guardian: Suppressed rapid infinite reload (Live Server loop blocked).");
                return;
            }
            try { sessionStorage.setItem('sw_last_reload', now.toString()); } catch(e) {}

            refreshing = true;
            window.location.reload(); 
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
        }
    } else {
        console.log("GUARDIAN: Silent Update Available.");
        
        const actionHTML = `
            <button onclick="triggerAppUpdate()" class="bg-white/20 hover:bg-white/40 text-white px-3 py-1 rounded text-xs font-bold transition-colors">
                UPDATE
            </button>
        `;
        showToast("New version available.", "info", 10000, actionHTML);
        
        // This enables the Idle tracker to see the pending update and trigger it automatically
        window._pendingUpdateReg = registration;
    }
}

window.triggerAppUpdate = function() {
    if (window._pendingUpdateReg && window._pendingUpdateReg.waiting) {
        showToast("Updating...", "success");
        window._pendingUpdateReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
        window.location.reload();
    }
};

// GUARDIAN BUGFIX 4: Grid Auto-Forward Integration
window.renderFullScheduleGrid = function(direction = 'A', dayOverride = null) {
    if (!schedules || Object.keys(schedules).length === 0) {
        showToast("Loading latest schedules... please wait.", "info", 2000);
        return;
    }

    const route = ROUTES[currentRouteId];
    if (!route) return;

    let selectedDay = dayOverride || currentDayType;
    let targetDayIdx = (typeof currentDayIndex !== 'undefined') ? currentDayIndex : new Date().getDay();

    let autoForwarded = false;

    if (!dayOverride) {
        // GUARDIAN PHASE 15: Grid Sync Patch
        // Only auto-forward to tomorrow if there is absolutely no service on the current day type.
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
                // Fallback
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

    const destName = (direction === 'A' ? route.destA : route.destB).replace(' STATION', '');
    const oppositeDestName = (direction === 'A' ? route.destB : route.destA).replace(' STATION', '');
    
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
                <div id="grid-controls" class="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-20 relative"></div>
                <div id="grid-container" class="flex-grow overflow-auto bg-white dark:bg-gray-900 relative"></div>
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

        // GUARDIAN: Hardcoded clean labels for optimal mobile UI flow. No dynamic text injection here.
        let wkLabel = "Mon - Fri";
        let satLabel = "Sat / Hol";

        controlsDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <select onchange="renderFullScheduleGrid('${direction}', this.value)" class="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-gray-700 dark:text-gray-200 focus:outline-none shadow-sm">
                    <option value="weekday" ${isWk ? 'selected' : ''}>${wkLabel}</option>
                    <option value="saturday" ${!isWk ? 'selected' : ''}>${satLabel}</option>
                </select>
                <button onclick="renderFullScheduleGrid('${direction === 'A' ? 'B' : 'A'}', '${selectedDay}')" class="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap shadow-sm">
                    ⇄ To ${Renderer._applyUIIntercepts(oppositeDestName)}
                </button>
            </div>
            
            <div class="flex items-center space-x-2 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">
                <button onclick="takeGridSnapshot('${direction}', '${selectedDay}')" class="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition shadow-sm border border-gray-200 dark:border-gray-600" title="Save Image">
                    <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300">Save Image</span>
                    <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </button>
                <button onclick="shareCurrentGrid()" class="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 transition shadow-sm" title="Share Link">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                </button>
            </div>
        `;
    }

    const isTodayType = !autoForwarded && (
                        (currentDayType === 'weekday' && sheetDayType === 'weekday') || 
                        (currentDayType !== 'weekday' && sheetDayType === 'saturday')
                    );
    
    const html = Renderer._buildGridHTML(schedule, route.sheetKeys[sheetKey], currentRouteId, targetDayIdx, isTodayType, false);

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

    // GUARDIAN Phase B: Inactive Route Grid Guard
    const currentRoute = ROUTES[currentRouteId];
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

// GUARDIAN Phase 4: Async Update Race Condition Fix
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
    window.location.reload(true);
};

// GUARDIAN BUGFIX: Properly attribute analytics source for forced system cache wipes
window.performHardCacheClear = async function(source = 'modal_confirm') {
    triggerHaptic();
    
    // 🛡️ GUARDIAN FIX: Stop spamming analytics! Only fire when manually initiated from UI.
    if (source === 'modal_confirm') {
        trackAnalyticsEvent('execute_hard_cache_clear', { location: 'sidebar' });
        showToast("Clearing offline data and syncing...", "info", 5000);

        // 🛡️ GUARDIAN PHASE 1 (Analytics Beacon Hardening):
        // The GA4 and Clarity tracking pixels need time to leave the device.
        // If we immediately unregister the Service Worker below, it aborts in-flight network requests.
        // We force a 600ms network buffer here to guarantee the beacon lands.
        await new Promise(resolve => setTimeout(resolve, 600));
    }
    
    window.closeAppHub(true); 
    
    const modal = document.getElementById('cache-clear-modal');
    if (modal) {
        closeSmoothModal('cache-clear-modal');
    }
    
    // GUARDIAN Phase 4: Async Cache Wipe to prevent Update Race Conditions
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

        // 🛡️ GUARDIAN PHASE 2: Identity Protection Protocol (The Vault)
        // Replace manual key targeting with the full volatile sweep.
        // This safely obliterates old schedules/zombie keys while locking Identity & Settings.
        if (typeof safeStorage.flushVolatile === 'function') {
            safeStorage.flushVolatile();
        } else {
            safeStorage.removeItem(`full_db_${currentRegion}`); 
            safeStorage.removeItem('app_installed_version');
        }
        
        if (window.indexedDB) {
            indexedDB.deleteDatabase('NextTrainDB');
            console.log("🛡️ Guardian: IndexedDB 'NextTrainDB' successfully queued for deletion.");
        }
    } catch (e) {
        console.warn("🛡️ Guardian: Failed to fully clear caches", e);
    }
    
    // 🛡️ GUARDIAN PHASE 1: Extended disk IO buffer before reload
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
};

window.showCacheClearWarning = function() {
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
    
    // GUARDIAN BUGFIX: Call updatePinUI here *after* currentRouteId has been populated from storage
    // This perfectly syncs the empty/filled visual state of the Star Pin button on the main screen.
    updatePinUI();
    
    // Call the global startClock bound in logic.js
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

// --- DOM READY ---
document.addEventListener('DOMContentLoaded', () => {
    enforceAppVersion();

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
        history.pushState({ modal: 'help' }, '', '#help'); 
        if(helpModal) { openSmoothModal('help-modal'); } window.closeAppHub(true); 
    });
    
    if(openAboutBtn) openAboutBtn.addEventListener('click', () => { 
        triggerHaptic(); trackAnalyticsEvent('view_about_page', { location: 'sidebar' }); 
        history.pushState({ modal: 'about' }, '', '#about'); 
        if(aboutModal) { openSmoothModal('about-modal'); } window.closeAppHub(true); 
    });

    const sidenavAboutBtn = document.getElementById('sidenav-about-btn');
    if(sidenavAboutBtn) sidenavAboutBtn.addEventListener('click', () => {
        triggerHaptic(); trackAnalyticsEvent('view_about_page', { location: 'sidebar' }); 
        history.pushState({ modal: 'about' }, '', '#about'); 
        if(aboutModal) { openSmoothModal('about-modal'); } window.closeAppHub(true); 
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
            triggerHaptic();
            trackAnalyticsEvent('select_station', { station: stationSelect.value, route_id: currentRouteId });
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
            triggerHaptic();
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
        openSmoothModal('map-modal');
        window.closeAppHub(true); 
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
    
    setupFeatureButtons(); 
    setupSettingsHub();
    setupModalButtons(); 
    setupFeedbackLogic(); // GUARDIAN PHASE 2: Initializing In-House Feedback System
    startSmartRefresh();
    setupSwipeNavigation(); 
    initTabIndicator(); 
    
    if (typeof setupMapLogic === 'function') {
        setupMapLogic(); 
    }

    const mapImageEl = document.getElementById('map-image');
    if (mapImageEl) {
        mapImageEl.src = currentRegion === 'WC' ? 'images/network-map_wc.png' : 'images/network-map.png';
    }

    let savedDefault = null;
    try { savedDefault = safeStorage.getItem('defaultRoute_' + currentRegion); } catch(e) {}
    
    if (!savedDefault) {
        let legacyDefault = null;
        try { legacyDefault = safeStorage.getItem('defaultRoute'); } catch(e) {}
        if (legacyDefault && ROUTES[legacyDefault] && ROUTES[legacyDefault].region === currentRegion) {
            savedDefault = legacyDefault;
            try { safeStorage.setItem('defaultRoute_' + currentRegion, legacyDefault); } catch(e) {}
        }
    }
    
    if (savedDefault && ROUTES[savedDefault] && ROUTES[savedDefault].region === currentRegion) {
        currentRouteId = savedDefault;
        loadAllSchedules().then(() => {
            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
                    if (result.state === 'granted') {
                        console.log("Location permission already granted. Auto-locating...");
                        findNearestStation(true);
                    }
                });
            }
        });
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
        try { lastActiveTab = localStorage.getItem('activeTab'); } catch(e) {}
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
    if (!fullDatabase) return;
    let displayDate = fullDatabase.lastUpdated || "Unknown";
    const isValidDate = (d) => d && d !== "undefined" && d !== "null" && String(d).length > 5;
    
    if (currentDayType === 'weekday' || currentDayType === 'monday') { 
        if (schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) displayDate = schedules.weekday_to_a.lastUpdated;
    } else if (currentDayType === 'saturday') {
        if (schedules.saturday_to_a && isValidDate(schedules.saturday_to_a.lastUpdated)) displayDate = schedules.saturday_to_a.lastUpdated;
    } else if (currentDayType === 'sunday') {
         if (schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) displayDate = schedules.weekday_to_a.lastUpdated;
    }
    
    displayDate = formatEffectiveDate(displayDate);
    
    // GUARDIAN BUGFIX: Restored "Schedule Effective from:" phrasing to match HTML placeholder
    if (displayDate && lastUpdatedEl) lastUpdatedEl.textContent = `Schedule effective from: ${displayDate}`;
}