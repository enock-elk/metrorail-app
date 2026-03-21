/**
 * METRORAIL NEXT TRAIN - UI CONTROLLER (V6.00.29 - Guardian Edition)
 * ----------------------------------------------------------------
 * THE "WAITER" (Controller)
 * * This module handles DOM interaction, Event Listeners, and UI Rendering.
 * * V6.00.22: The Great Purge - Migrated monolithic overrides, silenced error toasts.
 * * PHASE 9: App Router injected. Unified History API and Exit Trap Protocol.
 */

// --- GLOBAL HAPTIC ENGINE ---
function triggerHaptic() {
    // GUARDIAN: Check if haptics are enabled by user preference (defaults to true)
    const isEnabled = localStorage.getItem('hapticsEnabled') !== 'false';
    if (isEnabled && navigator.vibrate) {
        try { navigator.vibrate(50); } catch(e) {}
    }
}

// --- GUARDIAN V6.18: GLOBAL SCROLL-LOCK PROTOCOL ---
function lockBackgroundScroll() {
    document.body.classList.add('modal-active');
}
function unlockBackgroundScroll() {
    document.body.classList.remove('modal-active');
}

// --- GLOBAL APP HUB CLOSER (GUARDIAN UX FIX) ---
window.closeAppHub = function(fromPopState = false) {
    const sn = document.getElementById('sidenav');
    const overlay = document.getElementById('sidenav-overlay');
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
    
    const hasReloaded = sessionStorage.getItem('error_reloaded');

    if (!hasReloaded) {
        sessionStorage.setItem('error_reloaded', 'true');
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
            const queue = JSON.parse(localStorage.getItem(OfflineTracker.queueKey) || "[]");
            queue.push({ event: eventName, params: params, timestamp: Date.now() });
            if (queue.length > 50) queue.shift();
            localStorage.setItem(OfflineTracker.queueKey, JSON.stringify(queue));
        } catch (e) { console.warn("OfflineTracker Error:", e); }
    },
    flush: () => {
        if (!navigator.onLine) return;
        try {
            const queue = JSON.parse(localStorage.getItem(OfflineTracker.queueKey) || "[]");
            if (queue.length === 0) return;
            console.log(`[OfflineTracker] Flushing ${queue.length} events...`);
            queue.forEach(item => {
                const enrichedParams = { ...item.params, offline_captured: true, original_ts: item.timestamp };
                trackAnalyticsEvent(item.event, enrichedParams);
            });
            localStorage.removeItem(OfflineTracker.queueKey);
        } catch (e) { console.warn("OfflineTracker Flush Error:", e); }
    }
};

// --- ANALYTICS HELPER ---
function trackAnalyticsEvent(eventName, params = {}) {
    params.region = typeof currentRegion !== 'undefined' ? currentRegion : 'GP';

    if (!navigator.onLine) { OfflineTracker.enqueue(eventName, params); return; }
    
    try {
        if (typeof gtag === 'function') { 
            gtag('set', 'user_properties', { crm_region: params.region });
            gtag('event', eventName, params); 
        }
    } catch (e) { console.warn("[Analytics] GA4 Error:", e); }
    
    try {
        if (typeof clarity === 'function') {
            clarity("set", "crm_region", params.region);
            clarity("event", eventName);
            if (params) { Object.keys(params).forEach(key => { clarity("set", key, String(params[key])); }); }
        }
    } catch (e) { console.warn("[Analytics] Clarity Error:", e); }
}

window.addEventListener('online', () => { console.log("Network restored. Flushing analytics queue."); OfflineTracker.flush(); });

const HOLIDAY_NAMES = {
    "01-01": "New Year's Day", "03-21": "Human Rights Day", "04-03": "Good Friday",
    "04-06": "Family Day", "04-27": "Freedom Day", "05-01": "Workers' Day",
    "06-16": "Youth Day", "08-09": "National Women's Day", "09-24": "Heritage Day",
    "12-16": "Day of Reconciliation", "12-25": "Christmas Day", "12-26": "Day of Goodwill"
};

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
        li.className = "p-3 text-sm text-gray-400 italic";
        li.textContent = "No stations on this route";
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
    if (!chevron) {
        chevron = document.createElement('div');
        chevron.id = 'next-train-chevron';
        chevron.className = "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer p-2 hover:text-blue-500 z-10 transition-colors";
        chevron.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
        input.parentNode.appendChild(chevron);
    }

    let list = document.getElementById('next-train-autocomplete-list');
    if (!list) {
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
        
        chevron.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if (list.classList.contains('hidden')) {
                window._renderNextTrainList();
            } else {
                list.classList.add('hidden');
                unlockBackgroundScroll(); 
            }
        });
        
        document.addEventListener('click', (e) => { 
            if (!input.contains(e.target) && !list.contains(e.target) && !chevron.contains(e.target)) {
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
function renderComingSoon(routeName) {
    if (typeof Renderer !== 'undefined') {
        if(pretoriaTimeEl) Renderer.renderComingSoon(pretoriaTimeEl, routeName);
        if(pienaarspoortTimeEl) Renderer.renderComingSoon(pienaarspoortTimeEl, routeName);
    }
    if(stationSelect) stationSelect.innerHTML = '<option>Route not available</option>';
}
function renderAtDestination(element) { if (element && typeof Renderer !== 'undefined') Renderer.renderAtDestination(element); }

function renderNoService(element, destination) {
    if (!element) return;
    const currentRoute = ROUTES[currentRouteId];
    if (!currentRoute) return;
    let sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b';
    const schedule = schedules[sheetKey];
    let allJourneys = [];
    if (typeof findNextJourneyToDestA === 'function') {
        const res = (destination === currentRoute.destA) 
            ? findNextJourneyToDestA(stationSelect.value, "00:00:00", schedule, currentRoute)
            : findNextJourneyToDestB(stationSelect.value, "00:00:00", schedule, currentRoute);
        allJourneys = res.allJourneys;
    }
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    const firstTrain = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    if (typeof Renderer !== 'undefined') Renderer.renderNoService(element, destination, firstTrain, 1);
}

function processAndRenderJourney(allJourneys, element, header, destination) {
    if (!element) return;
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

function renderNextAvailableTrain(element, destination) {
    if (!element) return;
    const currentRoute = ROUTES[currentRouteId];
    if (!currentRoute) return;

    let nextDayName = "", nextDaySheetKey = "", dayOffset = 1, nextDayType = 'weekday'; 
    let checkMondayFallback = false;

    switch (currentDayIndex) {
        case 6: 
            nextDayName = "Monday"; 
            dayOffset = 2; 
            nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; 
            nextDayType = 'weekday'; 
            break;
        case 5: 
            nextDayName = "Saturday"; 
            dayOffset = 1; 
            nextDaySheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b'; 
            nextDayType = 'saturday'; 
            checkMondayFallback = true; 
            break;
        default: 
            nextDayName = "tomorrow"; 
            dayOffset = 1; 
            nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; 
            nextDayType = 'weekday'; 
            break;
    }

    let nextSchedule = schedules[nextDaySheetKey];
    let res = { allJourneys: [] };
    
    if (nextSchedule) {
        res = (destination === currentRoute.destA) 
            ? findNextJourneyToDestA(stationSelect.value, "00:00:00", nextSchedule, currentRoute)
            : findNextJourneyToDestB(stationSelect.value, "00:00:00", nextSchedule, currentRoute);
    }

    let firstTrainOfNextDay = res.allJourneys.find(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);

    if (!firstTrainOfNextDay && checkMondayFallback) {
        nextDayName = "Monday";
        dayOffset = 3; 
        nextDayType = 'weekday';
        nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b';
        nextSchedule = schedules[nextDaySheetKey];
        
        if (nextSchedule) {
            res = (destination === currentRoute.destA) 
                ? findNextJourneyToDestA(stationSelect.value, "00:00:00", nextSchedule, currentRoute)
                : findNextJourneyToDestB(stationSelect.value, "00:00:00", nextSchedule, currentRoute);
            firstTrainOfNextDay = res.allJourneys.find(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
        }
    }

    if (!firstTrainOfNextDay) { 
        element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No upcoming trains.</div>`; 
        return; 
    }
    
    if (typeof Renderer !== 'undefined') Renderer.renderNextAvailableTrain(element, destination, firstTrainOfNextDay, nextDayName, nextDayType, dayOffset);
}

function updateFareDisplay(sheetKey, nextTrainTimeStr) {
    fareContainer = document.getElementById('fare-container');
    fareAmount = document.getElementById('fare-amount');
    fareType = document.getElementById('fare-type');
    passengerTypeLabel = document.getElementById('passenger-type-label');
    if (!fareContainer) return;
    if (passengerTypeLabel) passengerTypeLabel.textContent = currentUserProfile;

    const newFareContainer = fareContainer.cloneNode(true);
    fareContainer.parentNode.replaceChild(newFareContainer, fareContainer);
    fareContainer = newFareContainer;
    fareAmount = document.getElementById('fare-amount');
    fareType = document.getElementById('fare-type');
    passengerTypeLabel = document.getElementById('passenger-type-label');

    fareContainer.classList.add('cursor-pointer', 'hover:bg-blue-100', 'dark:hover:bg-gray-700', 'transition-colors', 'group', 'relative');

    const fareData = getRouteFare(sheetKey, nextTrainTimeStr);
    const detailed = typeof getDetailedFare === 'function' ? getDetailedFare(sheetKey) : null;
    
    if (detailed && detailed.prices) {
        fareContainer.onclick = () => openFareModal(detailed);
        
        if (!document.getElementById('fare-chevron')) {
            const chevron = document.createElement('div');
            chevron.id = 'fare-chevron';
            chevron.className = "absolute right-3 top-1/2 transform -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity";
            chevron.innerHTML = `<svg class="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
            fareContainer.appendChild(chevron);
        }
    } else {
        const existingChevron = document.getElementById('fare-chevron');
        if(existingChevron) existingChevron.remove();
        fareContainer.classList.remove('cursor-pointer', 'hover:bg-blue-100', 'dark:hover:bg-gray-700');
    }

    if (fareData) {
        fareAmount.textContent = `R${fareData.price}`;
        
        if (nextTrainTimeStr) {
            if (fareData.isPromo) {
                fareType.textContent = fareData.discountLabel || "Discounted";
                fareType.className = "text-[10px] font-bold text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full mb-2";
                fareAmount.className = "text-xl font-black text-blue-600 dark:text-blue-400";
            } else if (fareData.isOffPeak) {
                fareType.textContent = "40% Off-Peak";
                fareType.className = "text-[10px] font-bold text-green-600 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full mb-2";
                fareAmount.className = "text-xl font-black text-green-600 dark:text-green-400";
            } else {
                fareType.textContent = "Standard";
                fareType.className = "text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full mb-2";
                fareAmount.className = "text-xl font-black text-gray-900 dark:text-white";
            }
        } 
        else {
            fareType.textContent = "General Pricing";
            fareType.className = "text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full mb-2";
            fareAmount.className = "text-xl font-black text-gray-900 dark:text-white";
        }
        
    } else {
        fareAmount.textContent = "R --.--";
        if (stationSelect && stationSelect.value) {
             fareType.textContent = "Rate Unavailable";
             fareType.className = "text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full mb-2";
        } else {
             fareType.textContent = "Select Station";
             fareType.className = "text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full mb-2";
        }
        fareAmount.className = "text-xl font-black text-gray-300 dark:text-gray-600";
    }
    
    fareContainer.classList.remove('hidden');
}

window.openFareModal = function(fareDetails) {
    if (!fareDetails) return;
    trackAnalyticsEvent('view_fare_modal', { zone: fareDetails.code });

    let modal = document.getElementById('fare-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fare-modal';
        modal.className = 'fixed inset-0 bg-black/80 z-[140] hidden flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col transform transition-transform duration-300 scale-95 max-h-[85vh]">
                <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-2xl shrink-0">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center" id="fare-zone-badge">Ticket Prices</h3>
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
    
    zoneEl.innerHTML = `Ticket Prices <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 ml-2 px-2 py-0.5 rounded-full uppercase tracking-widest">Zone ${fareDetails.code}</span>`;

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
    }

    toast.className = `flex items-center justify-between px-4 py-3 rounded-full shadow-2xl backdrop-blur-md border ${bgClass} ${borderClass} ${textClass}`; 

    toast.innerHTML = `
        <div class="flex items-center gap-2">
            ${iconHTML}
            <span class="text-sm font-medium tracking-wide whitespace-nowrap">${message}</span>
        </div>
        ${actionHTML ? `<div class="ml-3 pl-3 border-l border-white/20">${actionHTML}</div>` : ''}
    `;
    
    toast.classList.add('show'); 
    
    toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, safeDuration); 
}

function copyToClipboard(text) { const textArea = document.createElement('textarea'); textArea.value = text; textArea.style.position = "fixed"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { const successful = document.execCommand('copy'); if (successful) showToast("Link copied to clipboard!", "success", 2000); } catch (err) {} document.body.removeChild(textArea); }

function loadUserProfile() {
    profileModal = document.getElementById('profile-modal');
    const settingsProfileDisplay = document.getElementById('settings-profile-display');
    const savedProfile = localStorage.getItem('userProfile');
    
    if (savedProfile) {
        currentUserProfile = savedProfile;
    } else {
        currentUserProfile = "Adult";
        localStorage.setItem('userProfile', "Adult");
    }
    
    if(settingsProfileDisplay) settingsProfileDisplay.textContent = currentUserProfile;
}

window.selectProfile = function(profileType) {
    currentUserProfile = profileType;
    localStorage.setItem('userProfile', profileType);
    
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
    const savedDefault = localStorage.getItem('defaultRoute_' + currentRegion); 
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

function updateLastUpdatedText() {
    if (!fullDatabase) return;
    let displayDate = fullDatabase.lastUpdated || "Unknown";
    const isValidDate = (d) => d && d !== "undefined" && d !== "null" && d.length > 5;
    if (currentDayType === 'weekday' || currentDayType === 'monday') { 
        if (schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) displayDate = schedules.weekday_to_a.lastUpdated;
    } else if (currentDayType === 'saturday') {
        if (schedules.saturday_to_a && isValidDate(schedules.saturday_to_a.lastUpdated)) displayDate = schedules.saturday_to_a.lastUpdated;
    } else if (currentDayType === 'sunday') {
         if (schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) displayDate = schedules.weekday_to_a.lastUpdated;
    }
    displayDate = displayDate.replace(/^last updated[:\s-]*/i, '').trim();
    if (displayDate && lastUpdatedEl) lastUpdatedEl.textContent = `Schedule Effective from: ${displayDate}`;
}

function startClock() { updateTime(); setInterval(updateTime, 1000); }

function updateTime() {
    try {
        let day, timeString;
        let dateToCheck = null; 
        const simActive = (typeof window.isSimMode !== 'undefined') ? window.isSimMode : false;
        if (simActive) {
            day = parseInt(window.simDayIndex || 1);
            timeString = window.simTimeStr || "12:00:00"; 
            const dateInput = document.getElementById('sim-date');
            if (dateInput && dateInput.value) {
                const parts = dateInput.value.split('-');
                if(parts.length === 3) dateToCheck = new Date(parts[0], parts[1] - 1, parts[2]);
            } 
        } else {
            const now = new Date();
            day = now.getDay(); 
            timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
            dateToCheck = now;
        }
        currentTime = timeString; 
        if(currentTimeEl) currentTimeEl.textContent = `Current Time: ${timeString} ${simActive ? '(SIM)' : ''}`;
        
        let newDayType = (day === 0) ? 'sunday' : (day === 6 ? 'saturday' : 'weekday');
        let specialStatusText = "";
        if (dateToCheck) {
            var m = pad(dateToCheck.getMonth() + 1);
            var d = pad(dateToCheck.getDate());
            var dateKey = m + "-" + d;
            if (SPECIAL_DATES[dateKey]) { newDayType = SPECIAL_DATES[dateKey]; specialStatusText = HOLIDAY_NAMES[dateKey] ? " (Holiday)" : " (Holiday Schedule)"; }
        }
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        if (newDayType !== currentDayType) { currentDayType = newDayType; currentDayIndex = day; updateLastUpdatedText(); } else { currentDayIndex = day; }
        
        let displayType = "";
        if (newDayType === 'sunday') displayType = "No Service";
        else if (newDayType === 'saturday') displayType = "Saturday Schedule";
        else displayType = "Weekday Schedule";
        if (dateToCheck) {
            var m = pad(dateToCheck.getMonth() + 1);
            var d = pad(dateToCheck.getDate());
            var dateKey = m + "-" + d;
            if (HOLIDAY_NAMES[dateKey]) { displayType = `${HOLIDAY_NAMES[dateKey]} Schedule`; specialStatusText = ""; }
        }
        if(currentDayEl) currentDayEl.innerHTML = `${dayNames[day]} <span class="font-bold text-blue-600 dark:text-blue-400">${displayType}</span>${specialStatusText}`;
        const plannerDaySelect = document.getElementById('planner-day-select');
        if (plannerDaySelect && !selectedPlannerDay) { plannerDaySelect.value = currentDayType; selectedPlannerDay = currentDayType; }
        findNextTrains();
    } catch(e) { console.error("Error in updateTime", e); }
}

function handleShortcutActions() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const route = urlParams.get('route');
    const view = urlParams.get('view'); 
    const linkRegion = urlParams.get('region'); 

    if (linkRegion && typeof currentRegion !== 'undefined' && linkRegion !== currentRegion) {
        console.log(`[DeepLink] Region mismatch. Switching from ${currentRegion} to ${linkRegion} and reloading...`);
        localStorage.setItem('userRegion', linkRegion);
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
            localStorage.setItem('userRegion', ROUTES[route].region);
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

window.performHardCacheClear = function() {
    window.closeAppHub(true); // GUARDIAN: Bypass automatic history.back() to prevent race condition
    showToast("Clearing offline data and syncing...", "info", 5000);
    const modal = document.getElementById('cache-clear-modal');
    if (modal) {
        closeSmoothModal('cache-clear-modal');
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
        });
    }

    if ('caches' in window) {
        caches.keys().then(names => {
            for (let name of names) {
                caches.delete(name);
            }
        });
    }
    
    localStorage.removeItem(`full_db_${currentRegion}`); 
    localStorage.removeItem('app_installed_version');
    
    setTimeout(() => {
        window.location.reload(true);
    }, 800);
};

window.showCacheClearWarning = function() {
    window.closeAppHub(true); // GUARDIAN: Bypass automatic history.back() to prevent race condition
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
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">This will clear your offline cache and download the absolute latest train times from the server.</p>
                    <div class="flex space-x-3">
                        <button onclick="closeSmoothModal('cache-clear-modal')" class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-colors focus:outline-none">Cancel</button>
                        <button onclick="performHardCacheClear()" class="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors focus:outline-none">Sync Now</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // GUARDIAN: Keep state router pure
    history.pushState({ modal: 'cache-clear-modal' }, '', '#cacheclear');
    openSmoothModal('cache-clear-modal');
}

function initializeApp() {
    if (window.location.pathname.endsWith('index.html')) {
        const newPath = window.location.pathname.replace('index.html', '');
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);
    }
    
    // GUARDIAN Phase 9: Exit Trap Initialization
    if (!sessionStorage.getItem('exitTrapSet')) {
        // GUARDIAN FIX: Only inject exit trap for installed PWAs
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (isStandalone) {
            history.replaceState({ view: 'exit-trap' }, '', '#exit');
            history.pushState({ view: 'home' }, '', '#home');
        } else {
            history.replaceState({ view: 'home' }, '', '#home');
        }
        sessionStorage.setItem('exitTrapSet', 'true');
    }

    loadUserProfile(); 
    populateStationList();
    if (typeof initPlanner === 'function') initPlanner();
    if (typeof Renderer !== 'undefined') Renderer.renderRouteMenu('route-list', getRoutesForCurrentRegion(), currentRouteId);
    startClock();
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('action') && !urlParams.has('route')) { findNextTrains(); }
    checkServiceAlerts();
    checkMaintenanceStatus(); 
    handleShortcutActions();
    
    if(mainContent && currentRouteId) {
        mainContent.style.display = 'block';
    }
    
    updateNextTrainView();
    if(!stationSelect) return;
    if(!stationSelect.value) renderPlaceholder();

    if (navigator.onLine) { setTimeout(OfflineTracker.flush, 5000); }
}

async function checkMaintenanceStatus() {
    if (!navigator.onLine) return; 
    try {
        const res = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/config/maintenance.json`);
        const isActive = await res.json();
        
        if (isActive === true) {
            if (!document.getElementById('maintenance-banner')) {
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
        }
    } catch(e) { /* silent fail */ }
}

async function checkServiceAlerts() {
    const bellBtn = document.getElementById('notice-bell');
    const dot = document.getElementById('notice-dot');
    const modal = document.getElementById('notice-modal');
    const content = document.getElementById('notice-content');
    const timestamp = document.getElementById('notice-timestamp');
    if (!bellBtn) return;
    try {
        const response = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/notices.json?t=${Date.now()}`);
        if (!response.ok) return; 
        const notices = await response.json();
        if (!notices) { bellBtn.classList.add('hidden'); return; }
        
        let activeNotice = notices[currentRouteId] || notices['all'];
        
        if (activeNotice) {
            const now = Date.now();
            if (activeNotice.expiresAt && now > activeNotice.expiresAt) { bellBtn.classList.add('hidden'); return; }
            
            const seenKey = `seen_notice_${activeNotice.id}`;
            const hasSeen = localStorage.getItem(seenKey) === 'true';
            
            const severity = activeNotice.severity || 'info';
            
            bellBtn.className = "absolute top-4 right-4 z-50 p-1.5 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 shadow-md focus:outline-none hover:scale-105 transition-transform";
            dot.className = "absolute top-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 bg-red-600 transform translate-x-1/4 -translate-y-1/4 hidden";
            
            if (severity === 'critical') {
                bellBtn.classList.add('bg-red-100', 'dark:bg-red-900', 'text-red-600', 'dark:text-red-300');
                dot.classList.add('bg-red-600');
                if (!hasSeen) bellBtn.classList.add('animate-shake'); 
            } else if (severity === 'warning') {
                bellBtn.classList.add('bg-yellow-100', 'dark:bg-yellow-900', 'text-yellow-600', 'dark:text-yellow-300');
                dot.classList.add('bg-yellow-500');
            } else {
                bellBtn.classList.add('bg-blue-100', 'dark:bg-blue-900', 'text-blue-600', 'dark:text-blue-300');
                dot.classList.add('bg-blue-500');
            }

            bellBtn.classList.remove('hidden');
            if (!hasSeen) dot.classList.remove('hidden');

            bellBtn.onclick = () => {
                triggerHaptic();
                // GUARDIAN Phase 3: Analytics for Alert Bell
                trackAnalyticsEvent('view_service_alert', { severity: severity, route_id: currentRouteId || 'all' });
                
                localStorage.setItem(seenKey, 'true');
                bellBtn.classList.remove('animate-shake');
                dot.classList.add('hidden');
                
                content.innerHTML = activeNotice.message;
                
                if (severity === 'critical') {
                    content.innerHTML += `<div class="mt-3 text-xs text-red-600 font-bold border border-red-200 bg-red-50 p-2 rounded text-center">🔴 CRITICAL SERVICE DISRUPTION</div>`;
                }
                
                const date = new Date(activeNotice.postedAt);
                timestamp.textContent = `Posted: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, ${date.toLocaleDateString()}`;
                
                history.pushState({ modal: 'notice' }, '', '#notice');
                openSmoothModal('notice-modal');
            };
            
            const closeBtn = modal.querySelector('button.bg-red-600');
            const topCloseBtn = modal.querySelector('button.text-gray-400');
            
            const closeNotice = () => {
                if(location.hash === '#notice') history.back();
                else closeSmoothModal('notice-modal');
            };
            
            if (closeBtn) closeBtn.onclick = closeNotice;
            if (topCloseBtn) topCloseBtn.onclick = closeNotice;

        } else { bellBtn.classList.add('hidden'); }
    } catch (e) { console.warn("Alert check failed:", e); }
}

// GUARDIAN V6.19: Decoupled Planner State Sync
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
    // GUARDIAN V6.18: Removed brittle inline overflow styles and injected global unlock
    const closeAction = () => { 
        if (location.hash === '#schedule') history.back();
        else { 
            closeSmoothModal('schedule-modal'); 
        }
    }; 
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeAction); 
    if (closeModalBtn2) closeModalBtn2.addEventListener('click', closeAction); 
    if (scheduleModal) scheduleModal.addEventListener('click', (e) => { if (e.target === scheduleModal) closeAction(); }); 

    // GUARDIAN PHASE 3: Wire up Map close buttons here
    const closeMapAction = () => {
        if (location.hash === '#map') history.back();
        else closeSmoothModal('map-modal');
    };
    const closeMapBtn = document.getElementById('close-map-btn');
    const closeMapBtn2 = document.getElementById('close-map-btn-2');
    if (closeMapBtn) closeMapBtn.addEventListener('click', closeMapAction);
    if (closeMapBtn2) closeMapBtn2.addEventListener('click', closeMapAction);
}

function switchTab(tab) {
    triggerHaptic();
    // GUARDIAN FIX: Push state for Planner to allow natural back-button routing without exiting
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
        document.getElementById('view-next-train').classList.add('active');
    } else {
        targetBtn = document.getElementById('tab-trip-planner');
        document.getElementById('view-trip-planner').classList.add('active');
    }
    
    if(targetBtn) { 
        targetBtn.classList.add('active'); 
        setTimeout(() => moveTabIndicator(targetBtn), 50); 
    }
    localStorage.setItem('activeTab', tab);
}

// GUARDIAN Phase 9: Unified App Router Stack & Exit Trap
window.addEventListener('popstate', (event) => {
    const hash = location.hash;

    // EXIT TRAP PROTOCOL
    if (hash === '#exit') {
        // GUARDIAN FIX: Only trap exits on installed PWAs. Browsers handle naturally.
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        if (!isStandalone) {
            return; // Let standard browser behaviors take over.
        }

        const activeTab = localStorage.getItem('activeTab');
        
        if (activeTab === 'trip-planner') {
            // Smart Intercept: Route from Planner back to Home Tab instead of exiting
            history.pushState({ view: 'home' }, '', '#home');
            switchTab('next-train');
            return;
        } else {
            // Root Level: Trigger Exit Confirmation
            openSmoothModal('exit-modal');
            // Bounce state forward so they don't exit the app yet
            history.pushState({ view: 'home' }, '', '#home');
            return;
        }
    }

    if (document.body.classList.contains('sidenav-open')) {
        window.closeAppHub(true);
        return; 
    }

    const activeModals = [];
    const modalIds = [
        'pin-modal', 'dev-modal', 'about-modal', 'help-modal', 'legal-modal', 
        'profile-modal', 'notice-modal', 'cache-clear-modal', 'fare-modal', 
        'schedule-modal', 'full-schedule-modal', 'map-modal', 'redirect-modal', 'welcome-modal', 'changelog-modal', 'region-confirm-modal',
        'route-modal', 'install-modal'
    ];
    
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
            activeModals.push(id);
        }
    });

    if (activeModals.length > 0) {
        const topTier = ['pin-modal', 'dev-modal', 'notice-modal', 'cache-clear-modal', 'fare-modal', 'about-modal', 'help-modal', 'legal-modal', 'profile-modal', 'changelog-modal', 'region-confirm-modal', 'route-modal', 'install-modal'];
        const midTier = ['schedule-modal', 'full-schedule-modal', 'redirect-modal', 'welcome-modal'];
        const baseTier = ['map-modal'];

        let modalToClose = null;
        for (const id of topTier) { if (activeModals.includes(id)) { modalToClose = id; break; } }
        if (!modalToClose) { for (const id of midTier) { if (activeModals.includes(id)) { modalToClose = id; break; } } }
        if (!modalToClose) { for (const id of baseTier) { if (activeModals.includes(id)) { modalToClose = id; break; } } }

        if (modalToClose) {
            closeSmoothModal(modalToClose);
            
            // GHOST STATE HEALER: If back-press landed on a closed sidenav, pop again
            if (location.hash === '#sidenav' && !document.body.classList.contains('sidenav-open')) {
                setTimeout(() => history.back(), 10);
            }
            return; 
        }
    }

    // GHOST STATE HEALER: Standalone check
    if (location.hash === '#sidenav' && !document.body.classList.contains('sidenav-open')) {
         history.back();
         return;
    }

    if (!location.hash || location.hash === '#home') {
        const activeTab = localStorage.getItem('activeTab');
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
        if (document.body.classList.contains('sidenav-open') || !document.getElementById('map-modal').classList.contains('hidden') || !document.getElementById('schedule-modal').classList.contains('hidden') || !document.getElementById('about-modal').classList.contains('hidden')) return;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});
    contentArea.addEventListener('touchend', (e) => {
        if (document.body.classList.contains('sidenav-open') || !document.getElementById('map-modal').classList.contains('hidden') || !document.getElementById('schedule-modal').classList.contains('hidden') || !document.getElementById('about-modal').classList.contains('hidden')) return;
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
    }, {passive: true});
}

window.openScheduleModal = function(destination, dayOverride = null) {
    history.pushState({ modal: 'schedule' }, '', '#schedule');
    let journeys = [];
    let titleSuffix = "";
    if (dayOverride) {
        const currentRoute = ROUTES[currentRouteId];
        let sheetKey = null;
        if (dayOverride === 'weekday') { sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; titleSuffix = " (Weekday)"; } 
        else if (dayOverride === 'saturday') { sheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b'; titleSuffix = " (Saturday)"; } 
        else if (dayOverride === 'sunday') { sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; titleSuffix = " (Monday)"; }
        const schedule = schedules[sheetKey];
        if (schedule) {
            if (destination === currentRoute.destA) { journeys = findNextJourneyToDestA(stationSelect.value, "00:00:00", schedule, currentRoute).allJourneys; } 
            else { journeys = findNextJourneyToDestB(stationSelect.value, "00:00:00", schedule, currentRoute).allJourneys; }
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
    modalTitle.textContent = `${fromStationName} -> ${destination.replace(' STATION', '')}${titleSuffix}`; 
    
    const toTitleCase = (str) => {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    };

    modalList.innerHTML = '';
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
        
        let modalTag = "";
        if (j.isShared && j.sourceRoute) {
             const routeName = j.sourceRoute.replace(/^(Pretoria|JHB|Germiston|Mabopane)\s+<->\s+/i, "").replace("Route", "").trim();
             if (j.isDivergent) modalTag = `<span class="text-[9px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-200 dark:border-red-800">⚠️ To ${toTitleCase(j.actualDestName)}</span>`;
             else modalTag = `<span class="text-[9px] font-bold text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900 px-1.5 py-0.5 rounded uppercase ml-2">From ${routeName}</span>`;
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

        if (modalTag && modalTag !== "") { 
            rightPillHTML = modalTag; 
            modalTag = ""; 
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
                <div class="text-xs text-gray-500 dark:text-gray-400">Train ${trainName} ${modalTag}</div>
                ${terminationBadge}
            </div>
            <div class="flex flex-col items-end gap-1 text-right">
                ${rightPillHTML}
            </div>
        `;
        modalList.appendChild(div);
    });
    openSmoothModal('schedule-modal');
    
    if (!dayOverride) { setTimeout(() => { const target = document.getElementById('next-train-marker'); if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 10); } 
    else { const container = document.getElementById('modal-list'); if(container) container.scrollTop = 0; }
};

function setupRedirectLogic() {
    if (feedbackBtn) feedbackBtn.addEventListener('click', (e) => { e.preventDefault(); showRedirectModal("https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform", "Open Google Form to send feedback?"); }); 
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
    const storedTheme = localStorage.theme;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const welcomeThemeToggleBtn = document.getElementById('welcome-theme-toggle');
    const welcomeDarkIcon = document.getElementById('welcome-theme-dark-icon');
    const welcomeLightIcon = document.getElementById('welcome-theme-light-icon');
    const welcomeThemeText = document.getElementById('welcome-theme-text');
    
    const settingsThemeCheckbox = document.getElementById('settings-theme-checkbox');
    const settingsThemeEmoji = document.getElementById('settings-theme-emoji');
    const settingsThemeTextEl = document.getElementById('settings-theme-text');

    const applyTheme = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark'; 
            if(welcomeDarkIcon) welcomeDarkIcon.classList.remove('hidden');
            if(welcomeLightIcon) welcomeLightIcon.classList.add('hidden');
            if(welcomeThemeText) welcomeThemeText.textContent = "Dark Mode";

            if(settingsThemeCheckbox) settingsThemeCheckbox.checked = true;
            if(settingsThemeEmoji) settingsThemeEmoji.textContent = "🌙";
            if(settingsThemeTextEl) settingsThemeTextEl.textContent = "Currently On";
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            if(welcomeDarkIcon) welcomeDarkIcon.classList.add('hidden');
            if(welcomeLightIcon) welcomeLightIcon.classList.remove('hidden');
            if(welcomeThemeText) welcomeThemeText.textContent = "Light Mode";

            if(settingsThemeCheckbox) settingsThemeCheckbox.checked = false;
            if(settingsThemeEmoji) settingsThemeEmoji.textContent = "☀️";
            if(settingsThemeTextEl) settingsThemeTextEl.textContent = "Currently Off";
        }
    };

    if (storedTheme === 'dark' || (!storedTheme && systemDark)) {
        applyTheme(true);
    } else {
        applyTheme(false);
    }

    const handleThemeToggle = () => { triggerHaptic(); applyTheme(localStorage.theme !== 'dark'); };
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
        localStorage.setItem('hapticsEnabled', isEnabled ? 'true' : 'false');
        if (hapticsCheckbox) hapticsCheckbox.checked = isEnabled;
        if (hapticsTextEl) hapticsTextEl.textContent = isEnabled ? "Currently On" : "Currently Off";
    };

    applyHaptics(localStorage.getItem('hapticsEnabled') !== 'false');

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
                copyToClipboard(`${shareText} ${shareUrl}`); 
            } 
        });
    }

    installBtn = document.getElementById('install-app-btn');
    const installBtnPlanner = document.getElementById('install-app-btn-planner');
    
    const showInstallButton = () => { 
        if (installBtn) installBtn.classList.remove('hidden'); 
        if (installBtnPlanner) installBtnPlanner.classList.remove('hidden'); 
    };
    
    if (window.deferredInstallPrompt) { showInstallButton(); } else { window.addEventListener('pwa-install-ready', () => { showInstallButton(); }); }
    
    const handleInstallClick = () => { 
        triggerHaptic();
        trackAnalyticsEvent('install_app_click', { location: 'main_view' });
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
        sidenav.classList.remove('-translate-x-full');
        sidenav.classList.add('translate-x-0'); 
        sidenav.classList.add('open'); // GUARDIAN: Force CSS transform rule
        sidenavOverlay.classList.add('open'); 
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
                } else {
                    trackAnalyticsEvent('select_route', { route_name: ROUTES[routeId].name, route_id: routeId });
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

function setupSettingsHub() {
    const regionGP = document.getElementById('settings-region-gp');
    const regionWC = document.getElementById('settings-region-wc');
    
    const updateRegionUI = () => {
        if (!regionGP || !regionWC) return;
        if (currentRegion === 'GP') {
            regionGP.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
            regionWC.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
        } else {
            regionWC.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
            regionGP.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
        }
    };
    
    updateRegionUI();

    const handleRegionSwitchClick = (newRegion, name) => {
        triggerHaptic();
        if (currentRegion === newRegion) return;

        if (!navigator.onLine) {
            const cacheKey = `full_db_${newRegion}`;
            const cachedData = localStorage.getItem(cacheKey);
            if (!cachedData) {
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
            // Replace sidenav state with region confirm
            history.pushState({ modal: 'region-confirm' }, '', '#regionconfirm');
            title.textContent = `Switch Region?`;
            desc.textContent = `Are you sure you want to switch to ${name}?`;
            openSmoothModal('region-confirm-modal');
            window.closeAppHub(true);

            const cleanup = () => {
                actionBtn.removeEventListener('click', confirmAction);
                cancelBtn.removeEventListener('click', cancelAction);
            };

            const confirmAction = () => {
                triggerHaptic();
                localStorage.setItem('userRegion', newRegion);
                window.location.reload();
            };

            const cancelAction = () => {
                if (location.hash === '#regionconfirm') history.back();
                else closeSmoothModal('region-confirm-modal');
                cleanup();
            };

            actionBtn.addEventListener('click', confirmAction);
            cancelBtn.addEventListener('click', cancelAction);
        }
    };

    if (regionGP) regionGP.addEventListener('click', () => handleRegionSwitchClick('GP', 'Gauteng'));
    if (regionWC) regionWC.addEventListener('click', () => handleRegionSwitchClick('WC', 'Western Cape'));
    
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
                // Renderer does not open it automatically in the new modular structure, or it does. We just push state and let it handle UI
            }
            window.closeAppHub(true); 
        };
    }
}

function showWelcomeScreen() {
    if (!welcomeModal || !welcomeRouteList) return;

    if (!document.getElementById('welcome-region-selector')) {
        const regionDiv = document.createElement('div');
        regionDiv.id = 'welcome-region-selector';
        regionDiv.className = 'w-full mb-4 flex justify-center space-x-2 shrink-0';
        
        const btnGP = document.createElement('button');
        btnGP.className = `px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors ${currentRegion === 'GP' ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-300'}`;
        btnGP.textContent = 'Gauteng';
        btnGP.onclick = () => { localStorage.setItem('userRegion', 'GP'); window.location.reload(); };
        
        const btnWC = document.createElement('button');
        btnWC.className = `px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors ${currentRegion === 'WC' ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-300'}`;
        btnWC.textContent = 'Western Cape';
        btnWC.onclick = () => { localStorage.setItem('userRegion', 'WC'); window.location.reload(); };
        
        regionDiv.appendChild(btnGP);
        regionDiv.appendChild(btnWC);
        
        welcomeRouteList.parentNode.insertBefore(regionDiv, welcomeRouteList);
    }

    if (typeof Renderer !== 'undefined') Renderer.renderWelcomeList('welcome-route-list', getRoutesForCurrentRegion(), selectWelcomeRoute);
    openSmoothModal('welcome-modal');
}

function selectWelcomeRoute(routeId) {
    currentRouteId = routeId;
    localStorage.setItem('defaultRoute_' + currentRegion, routeId);
    closeSmoothModal('welcome-modal'); 
    setTimeout(() => {
        updateSidebarActiveState(); updatePinUI(); loadAllSchedules(); checkServiceAlerts(); 
    }, 300);
}

window.openLegal = function(type) {
    trackAnalyticsEvent('view_legal_doc', { type: type });
    history.pushState({ modal: 'legal' }, '', '#legal');
    legalTitle.textContent = type === 'terms' ? 'Terms of Use' : 'Privacy Policy';
    legalContent.innerHTML = LEGAL_TEXTS[type];
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
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        handleUpdateFound(reg);
                    }
                });
            });
        }).catch(err => console.error('SW reg failed:', err));

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload(); 
        });
        
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'sw-update-available') {
                // Handle broadcast update
            }
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

function updateNextTrainView() {
    const fareBox = document.getElementById('fare-container');
    const container = fareBox ? fareBox.parentNode : null;
    if (!container) return;

    if (!document.getElementById('grid-trigger-container')) {
        const triggerDiv = document.createElement('div');
        triggerDiv.id = 'grid-trigger-container';
        triggerDiv.className = "mb-5 mt-2 px-1"; 
        triggerDiv.innerHTML = `
            <button onclick="triggerHaptic(); renderFullScheduleGrid('A')" class="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg ring-4 ring-blue-100 dark:ring-blue-900 transition-all transform active:scale-95 group">
                <span class="text-xl">📅</span>
                <span class="tracking-wide">VIEW FULL TIMETABLE</span>
            </button>
        `;
        container.insertBefore(triggerDiv, fareBox);
    } else {
        document.getElementById('grid-trigger-container').classList.remove('hidden');
    }
}

function enforceAppVersion() {
    const currentVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown';
    const storedVersion = localStorage.getItem('app_installed_version');

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
    
    if (!storedVersion) localStorage.setItem('app_installed_version', currentVersion);
}

window.handleUpdateClick = function(newVersion) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
        });
    }
    if ('caches' in window) {
        caches.keys().then(names => {
            for (let name of names) {
                caches.delete(name);
            }
        });
    }
    localStorage.setItem('app_installed_version', newVersion);
    window.location.reload(true);
};

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
    shareBtn = document.getElementById('share-app-btn');
    installBtn = document.getElementById('install-app-btn');
    
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
    const closeSideNav = () => { window.closeAppHub(); };

    if(closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
    if(closeHelpBtn2) closeHelpBtn2.addEventListener('click', closeHelp);
    if(helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

    if(closeAboutBtn) closeAboutBtn.addEventListener('click', closeAbout);
    if(aboutModal) aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) closeAbout(); });

    // GUARDIAN Phase 9: Replaced blind state pushes with history-replacements and true sync bypasses
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
    
    // GUARDIAN Phase 9: Exit Modal Listeners
    const exitConfirmBtn = document.getElementById('exit-confirm-btn');
    const exitCancelBtn = document.getElementById('exit-cancel-btn');
    
    if (exitConfirmBtn) {
        exitConfirmBtn.addEventListener('click', () => {
            if (navigator.app && navigator.app.exitApp) {
                navigator.app.exitApp();
            } else {
                closeSmoothModal('exit-modal');
                setTimeout(() => { history.go(-2); }, 300);
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
            const savedDefault = localStorage.getItem(regionKey); 
            
            if (savedDefault === currentRouteId) { 
                localStorage.removeItem(regionKey); showToast("Route unpinned.", "info", 2000); 
            } else { 
                localStorage.setItem(regionKey, currentRouteId); showToast("Route pinned!", "success", 2000); 
            } 
            updatePinUI(); 
        });
    }

    const viewMapBtn = document.getElementById('view-map-btn');
    if (viewMapBtn) viewMapBtn.addEventListener('click', () => { 
        triggerHaptic(); trackAnalyticsEvent('click_network_map', { location: 'sidebar' }); 
        history.pushState({ modal: 'map' }, '', '#map'); 
        openSmoothModal('map-modal');
        window.closeAppHub(true); 
    });
    
    const openInteractiveMapBtn = document.getElementById('open-interactive-map-btn');
    if (openInteractiveMapBtn) openInteractiveMapBtn.addEventListener('click', () => { triggerHaptic(); trackAnalyticsEvent('open_interactive_map', { source: 'modal' }); });
    
    // GUARDIAN V6.18: Added Scroll Lock and History State to Route Selector open button
    const routeSelectorBtn = document.getElementById('route-selector-btn');
    if (routeSelectorBtn) {
        routeSelectorBtn.addEventListener('click', () => {
            history.pushState({ modal: 'route' }, '', '#route');
        });
    }
    
    setupFeatureButtons(); 
    setupSettingsHub();
    updatePinUI(); 
    setupModalButtons(); 
    setupRedirectLogic(); 
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

    let savedDefault = localStorage.getItem('defaultRoute_' + currentRegion);
    
    if (!savedDefault) {
        const legacyDefault = localStorage.getItem('defaultRoute');
        if (legacyDefault && ROUTES[legacyDefault] && ROUTES[legacyDefault].region === currentRegion) {
            savedDefault = legacyDefault;
            localStorage.setItem('defaultRoute_' + currentRegion, legacyDefault);
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
        const lastActiveTab = localStorage.getItem('activeTab');
        if (lastActiveTab) {
            switchTab(lastActiveTab);
        } else {
            switchTab('next-train');
        }
    }

    initializeApp();
});