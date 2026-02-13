// --- GLOBAL ERROR HANDLER ---
window.onerror = function(msg, url, line) {
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
    
    // FIX 2: Use getElementById directly
    const overlay = document.getElementById('loading-overlay');
    const content = document.getElementById('main-content');
    
    if (overlay) overlay.style.display = 'none';
    if (content) content.style.display = 'block';
    
    const hasReloaded = sessionStorage.getItem('error_reloaded');

    if (!hasReloaded) {
        sessionStorage.setItem('error_reloaded', 'true');
        const t = document.getElementById('toast');
        if(t) {
            t.textContent = "Error detected. Recovering...";
            t.className = "toast-error show";
        }
        setTimeout(() => window.location.reload(), 1000);
        return false;
    }

    // GUARDIAN UPDATE V4.60.33: Versioned Error & Auto-Dismiss
    const toastEl = document.getElementById('toast');
    const versionStr = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'Unknown Ver';
    
    if(toastEl) {
        toastEl.innerHTML = `
            <div class="flex justify-between items-start">
                <span class="mr-2 text-xs">Error: ${msg} <br><span class="opacity-50">[${versionStr}]</span></span>
                <button onclick="this.closest('#toast').classList.remove('show')" class="text-white bg-white/20 hover:bg-white/40 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0" aria-label="Dismiss Error">✕</button>
            </div>
        `;
        toastEl.className = "toast-error show";
        
        // Auto-dismiss after 5 seconds to prevent obstruction
        setTimeout(() => {
            if (toastEl.classList.contains('show')) {
                toastEl.classList.remove('show');
            }
        }, 5000);
    }
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

window.addEventListener('online', () => { console.log("Network restored. Flushing analytics queue."); OfflineTracker.flush(); });

// --- ANALYTICS HELPER ---
function trackAnalyticsEvent(eventName, params = {}) {
    if (!navigator.onLine) { OfflineTracker.enqueue(eventName, params); return; }
    try {
        if (typeof gtag === 'function') { gtag('event', eventName, params); }
    } catch (e) { console.warn("[Analytics] GA4 Error:", e); }
    try {
        if (typeof clarity === 'function') {
            clarity("event", eventName);
            if (params) { Object.keys(params).forEach(key => { clarity("set", key, String(params[key])); }); }
        }
    } catch (e) { console.warn("[Analytics] Clarity Error:", e); }
}

const HOLIDAY_NAMES = {
    "01-01": "New Year's Day", "03-21": "Human Rights Day", "04-03": "Good Friday",
    "04-06": "Family Day", "04-27": "Freedom Day", "05-01": "Workers' Day",
    "06-16": "Youth Day", "08-09": "National Women's Day", "09-24": "Heritage Day",
    "12-16": "Day of Reconciliation", "12-25": "Christmas Day", "12-26": "Day of Goodwill"
};

// --- RENDERER BRIDGES ---
function renderSkeletonLoader(element) { if (element && typeof Renderer !== 'undefined') Renderer.renderSkeletonLoader(element); }

// GUARDIAN UPDATE V4.60.19: Custom Placeholder Logic (Full Click Area, No Border)
function renderPlaceholder() {
    const triggerShake = "document.getElementById('station-select').classList.add('animate-shake', 'ring-4', 'ring-blue-300'); setTimeout(() => document.getElementById('station-select').classList.remove('animate-shake', 'ring-4', 'ring-blue-300'), 500); document.getElementById('station-select').focus();";
    
    const placeholderHTML = `
        <div onclick="${triggerShake}" class="h-24 flex flex-col justify-center items-center text-gray-400 dark:text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group w-full">
            <svg class="w-6 h-6 mb-1 opacity-50 group-hover:scale-110 transition-transform text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <span class="text-xs font-bold group-hover:text-blue-500 transition-colors">Tap to select station</span>
        </div>`;

    if(pretoriaTimeEl) pretoriaTimeEl.innerHTML = placeholderHTML;
    if(pienaarspoortTimeEl) pienaarspoortTimeEl.innerHTML = placeholderHTML;

    if(fareContainer) {
        fareContainer.classList.remove('hidden'); 
        if(fareAmount) fareAmount.textContent = "R --.--";
        if(fareType) { 
            fareType.textContent = "Select Stations"; 
            fareType.className = "text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full mb-2"; 
        }
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

// --- LOGIC BRIDGES ---
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
    switch (currentDayIndex) {
        case 6: nextDayName = "Monday"; dayOffset = 2; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; nextDayType = 'weekday'; break;
        case 5: nextDayName = "Saturday"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b'; nextDayType = 'saturday'; break;
        default: nextDayName = "tomorrow"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; nextDayType = 'weekday'; break;
    }
    const nextSchedule = schedules[nextDaySheetKey];
    if (!nextSchedule) { element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No schedule found.</div>`; return; }
    const res = (destination === currentRoute.destA) 
        ? findNextJourneyToDestA(stationSelect.value, "00:00:00", nextSchedule, currentRoute)
        : findNextJourneyToDestB(stationSelect.value, "00:00:00", nextSchedule, currentRoute);
    const firstTrainOfNextDay = res.allJourneys.find(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    if (!firstTrainOfNextDay) { element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No trains found.</div>`; return; }
    if (typeof Renderer !== 'undefined') Renderer.renderNextAvailableTrain(element, destination, firstTrainOfNextDay, nextDayName, nextDayType, dayOffset);
}

function updateFareDisplay(sheetKey, nextTrainTimeStr) {
    fareContainer = document.getElementById('fare-container');
    fareAmount = document.getElementById('fare-amount');
    fareType = document.getElementById('fare-type');
    passengerTypeLabel = document.getElementById('passenger-type-label');
    if (!fareContainer) return;
    if (passengerTypeLabel) passengerTypeLabel.textContent = currentUserProfile;

    // Reset Click Listener (Avoid duplication)
    const newFareContainer = fareContainer.cloneNode(true);
    fareContainer.parentNode.replaceChild(newFareContainer, fareContainer);
    fareContainer = newFareContainer;
    fareAmount = document.getElementById('fare-amount');
    fareType = document.getElementById('fare-type');
    passengerTypeLabel = document.getElementById('passenger-type-label');

    // Make it look interactive
    fareContainer.classList.add('cursor-pointer', 'hover:bg-blue-100', 'dark:hover:bg-gray-700', 'transition-colors', 'group', 'relative');

    if (!sheetKey || !nextTrainTimeStr) {
        fareContainer.classList.remove('hidden');
        fareAmount.textContent = "R --.--";
        fareType.textContent = "Select Station";
        // GUARDIAN: Increased bottom margin for better spacing
        fareType.className = "text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full mb-2";
        fareAmount.className = "text-xl font-black text-gray-300 dark:text-gray-600";
        return;
    }

    const fareData = getRouteFare(sheetKey, nextTrainTimeStr);
    
    // UPDATE V4.60.42: Get detailed fares if available
    const detailed = typeof getDetailedFare === 'function' ? getDetailedFare(sheetKey) : null;
    
    // Bind Click to Open Modal
    if (detailed && detailed.prices) {
        fareContainer.onclick = () => openFareModal(detailed);
        
        // Add visual hint icon
        if (!document.getElementById('fare-chevron')) {
            const chevron = document.createElement('div');
            chevron.id = 'fare-chevron';
            // Pushed to the right edge with absolute positioning or flex alignment
            chevron.className = "absolute right-3 top-1/2 transform -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity";
            chevron.innerHTML = `<svg class="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
            fareContainer.appendChild(chevron);
        }
    }

    if (fareData) {
        fareAmount.textContent = `R${fareData.price}`;
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
        
        fareContainer.classList.remove('hidden');
    } else {
        fareContainer.classList.remove('hidden');
        fareAmount.textContent = "R --.--";
        fareType.textContent = "Rate Unavailable";
        fareType.className = "text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full mb-2";
        fareAmount.className = "text-xl font-black text-gray-400";
    }
}

// --- NEW V4.60.43: FARE TABLE MODAL (Updated) ---
window.openFareModal = function(fareDetails) {
    if (!fareDetails) return;
    
    // TRACK ANALYTICS
    trackAnalyticsEvent('view_fare_modal', { zone: fareDetails.code });

    // Lazy Load Modal HTML
    let modal = document.getElementById('fare-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fare-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-[100] hidden flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-0 overflow-hidden transform transition-all scale-95">
                <div class="p-4 bg-blue-600 dark:bg-blue-800 text-white flex justify-between items-center">
                    <h3 class="font-bold text-lg">Ticket Prices</h3>
                    <button onclick="document.getElementById('fare-modal').classList.add('hidden')" class="text-white hover:bg-white/20 rounded-full p-1">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div class="p-6">
                    <div id="fare-zone-badge" class="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300 mb-4">
                        Zone -- Pricing:
                    </div>
                    <div id="fare-table-content" class="space-y-3"></div>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-center">
                    <button onclick="document.getElementById('fare-modal').classList.add('hidden')" class="w-full text-sm font-bold text-blue-600 py-2">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Populate Data
    const zoneEl = document.getElementById('fare-zone-badge');
    const tableEl = document.getElementById('fare-table-content');
    
    zoneEl.textContent = `Zone ${fareDetails.code} Pricing:`;

    // Calculate Prices based on Profile
    const profile = FARE_CONFIG.profiles[currentUserProfile] || FARE_CONFIG.profiles["Adult"];
    const prices = fareDetails.prices;
    
    const calc = (basePrice) => (Math.ceil((basePrice * profile.base) * 2) / 2).toFixed(2);
    
    // Generate Rows (Updated V4.60.42: Includes split weekly tickets)
    tableEl.innerHTML = `
        <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span class="text-gray-600 dark:text-gray-400 text-sm">Single Trip</span>
            <span class="font-bold text-gray-900 dark:text-white">R${calc(prices.single)}</span>
        </div>
        <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span class="text-gray-600 dark:text-gray-400 text-sm">Return Trip</span>
            <span class="font-bold text-gray-900 dark:text-white">R${calc(prices.return)}</span>
        </div>
        <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 bg-green-50 dark:bg-green-900/10 -mx-2 px-2 rounded">
            <span class="text-green-700 dark:text-green-400 text-sm font-bold">Weekly (Mon-Fri)</span>
            <span class="font-bold text-green-700 dark:text-green-400">R${calc(prices.weekly_mon_fri)}</span>
        </div>
        <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 bg-green-50 dark:bg-green-900/10 -mx-2 px-2 rounded">
            <span class="text-green-700 dark:text-green-400 text-sm font-bold">Weekly (Mon-Sat)</span>
            <span class="font-bold text-green-700 dark:text-green-400">R${calc(prices.weekly_mon_sat)}</span>
        </div>
        <div class="flex justify-between items-center py-2 bg-blue-50 dark:bg-blue-900/10 -mx-2 px-2 rounded">
            <span class="text-blue-700 dark:text-blue-400 text-sm font-bold">Monthly</span>
            <span class="font-bold text-blue-700 dark:text-blue-400">R${calc(prices.monthly)}</span>
        </div>
    `;

    modal.classList.remove('hidden');
};

// --- UTILS ---
function showToast(message, type = 'info', duration = 3000) { 
    if (toastTimeout) clearTimeout(toastTimeout); 
    toast.textContent = message; 
    toast.className = `toast-info`; 
    if (type === 'success') toast.classList.add('toast-success'); 
    else if (type === 'error') toast.classList.add('toast-error'); 
    toast.classList.add('show'); 
    toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, duration); 
}

function copyToClipboard(text) { const textArea = document.createElement('textarea'); textArea.value = text; textArea.style.position = "fixed"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { const successful = document.execCommand('copy'); if (successful) showToast("Link copied to clipboard!", "success", 2000); } catch (err) {} document.body.removeChild(textArea); }

function loadUserProfile() {
    profileModal = document.getElementById('profile-modal');
    navProfileDisplay = document.getElementById('nav-profile-display');
    const savedProfile = localStorage.getItem('userProfile');
    
    // UPDATE V4.60.41: Auto-Select Adult if New User
    if (savedProfile) {
        currentUserProfile = savedProfile;
    } else {
        // Silent default for new users (UX improvement)
        currentUserProfile = "Adult";
        localStorage.setItem('userProfile', "Adult");
    }
    
    // Ensure UI is synced
    if(navProfileDisplay) navProfileDisplay.textContent = currentUserProfile;
    
    // Check URL params for edge case overrides (optional but safe to keep)
    const urlParams = new URLSearchParams(window.location.search);
    if (!savedProfile && !urlParams.has('action') && !urlParams.has('route')) {
        // We used to show modal here. Now we skip it.
        // If you ever want to force the modal back for marketing, uncomment below:
        // if(profileModal) profileModal.classList.remove('hidden');
    }
}

window.selectProfile = function(profileType) {
    currentUserProfile = profileType;
    localStorage.setItem('userProfile', profileType);
    if(navProfileDisplay) navProfileDisplay.textContent = profileType;
    if(profileModal) profileModal.classList.add('hidden');
    showToast(`Profile set to: ${profileType}`, "success");
    findNextTrains(); 
};

window.resetProfile = function() {
    if(profileModal) profileModal.classList.remove('hidden');
    if(sidenav) { sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open'); }
};

function updatePinUI() {
    const savedDefault = localStorage.getItem('defaultRoute'); 
    const isPinned = savedDefault === currentRouteId;
    if (isPinned) { pinOutline.classList.add('hidden'); pinFilled.classList.remove('hidden'); pinRouteBtn.title = "Unpin this route"; } else { pinOutline.classList.remove('hidden'); pinFilled.classList.add('hidden'); pinRouteBtn.title = "Pin this route as default"; }
    if (typeof Renderer !== 'undefined') Renderer.renderRouteMenu('route-list', ROUTES, currentRouteId);
}

function updateSidebarActiveState() {
    if (typeof Renderer !== 'undefined') Renderer.renderRouteMenu('route-list', ROUTES, currentRouteId);
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

// --- DEEP LINK HANDLER (UPDATED V5.00.01 - LOOP FIX) ---
// Now supports Grid Deep Links via 'view=grid', 'dir', and 'day' parameters
function handleShortcutActions() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const route = urlParams.get('route');
    const view = urlParams.get('view'); 

    // GUARDIAN FIX V5.00.01: Clean URL IMMEDIATELY to prevent reload loops
    // If the renderer crashes or user refreshes, we want a clean state so it doesn't loop.
    if (action || route) {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
        console.log("[DeepLink] URL Params Sanitized.");
    }

    if (route && ROUTES[route]) {
        console.log(`[DeepLink] Auto-loading route: ${route}`);
        if (ROUTES[route].isActive) {
            currentRouteId = route;
            if (welcomeModal) welcomeModal.classList.add('hidden');
            loadAllSchedules().then(() => {
                trackAnalyticsEvent('deep_link_open', { type: 'route', route_id: route });
                // GUARDIAN UPDATE V4.60.30: Reduced Toast Duration (2s)
                showToast(`Opened shared route: ${ROUTES[route].name}`, "success", 2000);
                
                // GUARDIAN UPDATE V4.60.60: Grid View Deep Link
                if (view === 'grid') {
                    const direction = urlParams.get('dir') || 'A';
                    const dayOverride = urlParams.get('day') || null;
                    if (typeof renderFullScheduleGrid === 'function') {
                        // Delay slightly to ensure UI is ready
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
        
        // GUARDIAN UPDATE V4.60.33: Timeout Logic for Planner Deep Link
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds max

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
                    if (fromInput) fromInput.value = fromId.replace(' STATION', '');
                    if (toInput) toInput.value = toId.replace(' STATION', '');
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
        // Note: Clean up logic is now handled at top of function
    } else if (action === 'map') {
        if (typeof setupMapLogic === 'function') {
            const mapModal = document.getElementById('map-modal');
            if (mapModal) {
                mapModal.classList.remove('hidden');
                history.pushState({ modal: 'map' }, '', '#map');
                const mapImage = document.getElementById('map-image');
                if(mapImage) mapImage.style.transform = `translate(0px, 0px) scale(1)`;
            }
        }
        // Note: Clean up logic is now handled at top of function
    }
}

function initializeApp() {
    if (window.location.pathname.endsWith('index.html')) {
        const newPath = window.location.pathname.replace('index.html', '');
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);
    }
    loadUserProfile(); 
    populateStationList();
    if (typeof initPlanner === 'function') initPlanner();
    if (typeof Renderer !== 'undefined') Renderer.renderRouteMenu('route-list', ROUTES, currentRouteId);
    startClock();
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('action') && !urlParams.has('route')) { findNextTrains(); }
    checkServiceAlerts();
    checkMaintenanceStatus(); // NEW: V5.00.00
    handleShortcutActions();
    if(mainContent) mainContent.style.display = 'block';
    
    // GUARDIAN UPDATE V4.60.18: Force Trigger Visible on Init
    updateNextTrainView();
    if(!stationSelect.value) renderPlaceholder();

    if (navigator.onLine) { setTimeout(OfflineTracker.flush, 5000); }
}

// GUARDIAN UPDATE V5.00.00: Maintenance Mode Checker
async function checkMaintenanceStatus() {
    if (!navigator.onLine) return; // Only relevant for online users
    try {
        const res = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/config/maintenance.json`);
        const isActive = await res.json();
        
        if (isActive === true) {
            // Inject Banner if not present
            if (!document.getElementById('maintenance-banner')) {
                const banner = document.createElement('div');
                banner.id = 'maintenance-banner';
                // Striped Yellow Background
                banner.style.background = 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 10px, #d97706 10px, #d97706 20px)';
                banner.className = "text-white text-xs font-bold text-center py-2 px-4 shadow-md sticky top-0 z-[100]";
                banner.innerHTML = `⚠️ MAINTENANCE IN PROGRESS. Schedules may be intermittent.`;
                
                // Insert at TOP of body
                document.body.prepend(banner);
            }
        }
    } catch(e) { /* silent fail */ }
}

// GUARDIAN UPDATE V5.00.00: Tiered Service Alerts
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
        
        // Priority: Route Specific > Global
        let activeNotice = notices[currentRouteId] || notices['all'];
        
        if (activeNotice) {
            const now = Date.now();
            if (activeNotice.expiresAt && now > activeNotice.expiresAt) { bellBtn.classList.add('hidden'); return; }
            
            const seenKey = `seen_notice_${activeNotice.id}`;
            const hasSeen = localStorage.getItem(seenKey) === 'true';
            
            // TIERED ALERT LOGIC
            const severity = activeNotice.severity || 'info';
            
            // Reset Classes
            bellBtn.className = "relative p-2 rounded-full focus:outline-none mr-1 transition-all duration-300";
            dot.className = "absolute top-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white transform translate-x-1/4 -translate-y-1/4 hidden";
            
            // Apply Severity Styles
            if (severity === 'critical') {
                bellBtn.classList.add('bg-red-100', 'dark:bg-red-900', 'text-red-600', 'dark:text-red-300');
                dot.classList.add('bg-red-600');
                if (!hasSeen) bellBtn.classList.add('animate-shake'); // Only critical shakes
            } else if (severity === 'warning') {
                bellBtn.classList.add('bg-yellow-100', 'dark:bg-yellow-900', 'text-yellow-600', 'dark:text-yellow-300');
                dot.classList.add('bg-yellow-500');
            } else {
                // Info (Blue)
                bellBtn.classList.add('bg-blue-100', 'dark:bg-blue-900', 'text-blue-600', 'dark:text-blue-300');
                dot.classList.add('bg-blue-500');
            }

            bellBtn.classList.remove('hidden');
            if (!hasSeen) dot.classList.remove('hidden');

            bellBtn.onclick = () => {
                localStorage.setItem(seenKey, 'true');
                bellBtn.classList.remove('animate-shake');
                dot.classList.add('hidden');
                
                // Content Rendering
                content.innerHTML = activeNotice.message;
                
                // Inject "Verified" Badge if Critical
                if (severity === 'critical') {
                    content.innerHTML += `<div class="mt-3 text-xs text-red-600 font-bold border border-red-200 bg-red-50 p-2 rounded text-center">🔴 CRITICAL SERVICE DISRUPTION</div>`;
                }
                
                const date = new Date(activeNotice.postedAt);
                timestamp.textContent = `Posted: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, ${date.toLocaleDateString()}`;
                
                // NEW: Boss Note Button Injection (Hook for Step 3)
                // We will add a container div here for the button to be injected by Renderer later if needed
                // For now, we keep it simple.
                
                modal.classList.remove('hidden');
            };
        } else { bellBtn.classList.add('hidden'); }
    } catch (e) { console.warn("Alert check failed:", e); }
}

function syncPlannerFromMain(stationName) {
    if (!stationName) return;
    const plannerInput = document.getElementById('planner-from-search');
    const plannerSelect = document.getElementById('planner-from');
    if (plannerInput && plannerSelect) {
        plannerSelect.value = stationName;
        plannerInput.value = stationName.replace(' STATION', '');
    }
}

function setupModalButtons() { 
    const closeAction = () => { 
        if (location.hash === '#schedule') history.back();
        else { scheduleModal.classList.add('hidden'); document.body.style.overflow = ''; }
    }; 
    closeModalBtn.addEventListener('click', closeAction); 
    closeModalBtn2.addEventListener('click', closeAction); 
    scheduleModal.addEventListener('click', (e) => { if (e.target === scheduleModal) closeAction(); }); 
}

function switchTab(tab) {
    if (tab === 'trip-planner') {
        if (location.hash !== '#planner') history.pushState({ tab: 'planner' }, '', '#planner');
    } else {
        if (location.hash === '#planner') history.replaceState({ tab: 'next-train' }, '', ' '); 
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
        // GUARDIAN FIX V4.60.42: Delay tab indicator update to ensure layout stability
        setTimeout(() => moveTabIndicator(targetBtn), 50); 
    }
    localStorage.setItem('activeTab', tab);
}

window.addEventListener('popstate', (event) => {
    const modals = [
        { id: 'schedule-modal', hash: '#schedule' },
        { id: 'map-modal', hash: '#map' },
        { id: 'legal-modal', hash: '#legal' },
        { id: 'help-modal', hash: '#help' },
        { id: 'about-modal', hash: '#about' },
        { id: 'full-schedule-modal', hash: '#grid' },
        { id: 'changelog-modal', hash: '#changelog' } // NEW: Changelog support
    ];
    let modalClosed = false;
    modals.forEach(m => {
        const el = document.getElementById(m.id);
        if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
            document.body.style.overflow = ''; 
            modalClosed = true;
        }
    });
    if (modalClosed) return;
    if (!location.hash) {
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
    const activeBtn = document.querySelector('.tab-btn.active') || tabNext;
    
    // GUARDIAN FIX V5.00.02: Lazy Selector to fix Race Condition (Ghost Revert)
    // We re-query the DOM inside the timeout to ensure we capture the state *after* Deep Links have processed.
    requestAnimationFrame(() => {
        setTimeout(() => {
            const currentActive = document.querySelector('.tab-btn.active') || document.getElementById('tab-next-train');
            if (currentActive) moveTabIndicator(currentActive);
        }, 150); // Slight bump to 150ms to be safe
    });
    
    window.addEventListener('resize', () => { const current = document.querySelector('.tab-btn.active'); if (current) moveTabIndicator(current); });
}

function moveTabIndicator(element) {
    const indicator = document.getElementById('tab-sliding-indicator');
    if (!indicator || !element) return;
    
    // GUARDIAN FIX V4.60.31: Use requestAnimationFrame for layout accuracy
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

// --- UPDATED MODAL LOGIC (Supports dayOverride) ---
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
    
    // UPDATED V4.60.20: Use "From [Current] towards [Dest]" format
    let fromStationName = "Upcoming Trains";
    if (stationSelect && stationSelect.value) {
        fromStationName = stationSelect.value.replace(' STATION', '');
    }
    modalTitle.textContent = `${fromStationName} -> ${destination.replace(' STATION', '')}${titleSuffix}`; 
    
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
             if (j.isDivergent) modalTag = `<span class="text-[9px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-200 dark:border-red-800">⚠️ To ${j.actualDestName}</span>`;
             else modalTag = `<span class="text-[9px] font-bold text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900 px-1.5 py-0.5 rounded uppercase ml-2">From ${routeName}</span>`;
        }
        const formattedDep = formatTimeDisplay(dep);
        let rightPillHTML = "";
        if (modalTag && modalTag !== "") { rightPillHTML = modalTag; modalTag = ""; } 
        else {
            if (type === 'Direct') rightPillHTML = '<span class="text-[10px] font-bold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900 px-2 py-0.5 rounded-full uppercase">Direct</span>';
            else rightPillHTML = `<span class="text-[10px] font-bold text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900 px-2 py-0.5 rounded-full uppercase">Transfer @ ${j.train1.terminationStation.replace(' STATION','')}</span>`;
        }
        if (j.isLastTrain) rightPillHTML += ' <span class="text-[10px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-2 py-0.5 rounded-full uppercase border border-red-200 dark:border-red-800">LAST TRAIN</span>';
        div.innerHTML = `<div><span class="text-lg font-bold text-gray-900 dark:text-white">${formattedDep}</span><div class="text-xs text-gray-500 dark:text-gray-400">Train ${trainName} ${modalTag}</div></div><div class="flex flex-col items-end gap-1">${rightPillHTML}</div>`;
        modalList.appendChild(div);
    });
    scheduleModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; 
    if (!dayOverride) { setTimeout(() => { const target = document.getElementById('next-train-marker'); if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' }); }, 10); } 
    else { const container = document.getElementById('modal-list'); if(container) container.scrollTop = 0; }
};

function setupRedirectLogic() {
    feedbackBtn.addEventListener('click', (e) => { e.preventDefault(); showRedirectModal("https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform", "Open Google Form to send feedback?"); }); 
}

function showRedirectModal(url, message) {
    redirectMessage.textContent = message;
    redirectModal.classList.remove('hidden');
    const confirmHandler = () => { window.open(url, '_blank'); redirectModal.classList.add('hidden'); cleanup(); };
    const cancelHandler = () => { redirectModal.classList.add('hidden'); cleanup(); };
    const cleanup = () => { redirectConfirmBtn.removeEventListener('click', confirmHandler); redirectCancelBtn.removeEventListener('click', cancelHandler); };
    redirectConfirmBtn.addEventListener('click', confirmHandler);
    redirectCancelBtn.addEventListener('click', cancelHandler);
}

// GUARDIAN UPDATE V4.60.60: System Theme Detection Logic
function setupFeatureButtons() {
    // 1. Determine Initial Theme (Respect System Preference if no override)
    const storedTheme = localStorage.theme;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (storedTheme === 'dark' || (!storedTheme && systemDark)) {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark'; // Save it so we don't flip-flop
        darkIcon.classList.remove('hidden');
        lightIcon.classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
        darkIcon.classList.add('hidden');
        lightIcon.classList.remove('hidden');
    }

    // 2. Toggle Handler
    themeToggleBtn.addEventListener('click', () => { 
        if (localStorage.theme === 'dark') { 
            localStorage.theme = 'light'; 
            document.documentElement.classList.remove('dark'); 
            darkIcon.classList.add('hidden'); 
            lightIcon.classList.remove('hidden'); 
        } else { 
            localStorage.theme = 'dark'; 
            document.documentElement.classList.add('dark'); 
            darkIcon.classList.remove('hidden'); 
            lightIcon.classList.add('hidden'); 
        } 
    });
    
    // UPDATED V4.60.33: Share Button Always Shares Homepage (No Deep Links)
    shareBtn.addEventListener('click', async () => { 
        trackAnalyticsEvent('click_share', { location: 'main_view' });
        
        // GUARDIAN FIX V4.60.34: Remove URL from text body to prevent duplication
        const shareText = 'Say Goodbye to Waiting\nUse Next Train to check when your train is due to arrive.';
        const shareUrl = 'https://nexttrain.co.za/';

        const shareData = { title: "Metrorail Next Train", text: shareText, url: shareUrl }; 
        try { 
            if (navigator.share) {
                await navigator.share(shareData); 
            } else { 
                copyToClipboard(`${shareText} ${shareUrl}`); 
            } 
        } catch (err) { 
            copyToClipboard(`${shareText} ${shareUrl}`); 
        } 
    });

    installBtn = document.getElementById('install-app-btn');
    const showInstallButton = () => { if (installBtn) installBtn.classList.remove('hidden'); };
    if (window.deferredInstallPrompt) { showInstallButton(); } else { window.addEventListener('pwa-install-ready', () => { showInstallButton(); }); }
    if (installBtn) {
        installBtn.addEventListener('click', () => { 
            trackAnalyticsEvent('install_app_click', { location: 'main_view' });
            installBtn.classList.add('hidden'); 
            const promptEvent = window.deferredInstallPrompt;
            if (promptEvent) {
                promptEvent.prompt(); 
                promptEvent.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') { trackAnalyticsEvent('install_app_accepted'); } else { trackAnalyticsEvent('install_app_dismissed'); }
                    window.deferredInstallPrompt = null;
                });
            }
        }); 
    }
    const openNav = () => { sidenav.classList.add('open'); sidenavOverlay.classList.add('open'); document.body.classList.add('sidenav-open'); };
    openNavBtn.addEventListener('click', openNav); routeSubtitle.addEventListener('click', openNav);
    const closeNav = () => { sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open'); };
    closeNavBtn.addEventListener('click', closeNav); sidenavOverlay.addEventListener('click', closeNav);
    routeList.addEventListener('click', (e) => { 
        const routeLink = e.target.closest('a'); 
        if (routeLink && routeLink.dataset.routeId) { 
            const routeId = routeLink.dataset.routeId; 
            if (routeId === currentRouteId) { showToast("You are already viewing this route.", "info", 1500); closeNav(); return; } 
            if (ROUTES[routeId]) { trackAnalyticsEvent('select_route', { route_name: ROUTES[routeId].name, route_id: routeId }); }
            currentRouteId = routeId;
            updateSidebarActiveState(); closeNav(); loadAllSchedules(); checkServiceAlerts(); 
        } 
    });
    forceReloadBtn.addEventListener('click', () => { showToast("Forcing schedule reload...", "info", 2000); loadAllSchedules(true); });
    pinRouteBtn.addEventListener('click', () => { const savedDefault = localStorage.getItem('defaultRoute'); if (savedDefault === currentRouteId) { localStorage.removeItem('defaultRoute'); showToast("Route unpinned from top.", "info", 2000); } else { localStorage.setItem('defaultRoute', currentRouteId); showToast("Route pinned to top of menu!", "success", 2000); } updatePinUI(); });
}

function showWelcomeScreen() {
    if (!welcomeModal || !welcomeRouteList) return;
    if (typeof Renderer !== 'undefined') Renderer.renderWelcomeList('welcome-route-list', ROUTES, selectWelcomeRoute);
    welcomeModal.classList.remove('hidden');
}

function selectWelcomeRoute(routeId) {
    currentRouteId = routeId;
    localStorage.setItem('defaultRoute', routeId);
    welcomeModal.classList.add('opacity-0'); 
    setTimeout(() => {
        welcomeModal.classList.add('hidden'); welcomeModal.classList.remove('opacity-0');
        updateSidebarActiveState(); updatePinUI(); loadAllSchedules(); checkServiceAlerts(); 
    }, 300);
}

window.openLegal = function(type) {
    trackAnalyticsEvent('view_legal_doc', { type: type });
    history.pushState({ modal: 'legal' }, '', '#legal');
    legalTitle.textContent = type === 'terms' ? 'Terms of Use' : 'Privacy Policy';
    legalContent.innerHTML = LEGAL_TEXTS[type];
    legalModal.classList.remove('hidden');
    sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open');
};

function closeLegal() { if(location.hash === '#legal') history.back(); else legalModal.classList.add('hidden'); }

// --- SERVICE WORKER ---
// CLEANED UP V4.60.42: Removed duplicate "Grey Toast" logic to prevent echo effect.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => {
                // Registration successful.
                // We do NOT listen for 'updatefound' here anymore because we rely on the controller change below.
            })
            .catch(err => console.error('SW reg failed:', err));
        
        let refreshing; 
        // This is the ONE source of truth for updates. When the new SW takes over (via skipWaiting), this fires.
        navigator.serviceWorker.addEventListener('controllerchange', () => { 
            if (refreshing) return; 
            refreshing = true;
            
            // GUARDIAN UPDATE V4.60.42: Streamlined Green Toast
            if(toast) {
                toast.textContent = "New app version, reloading...";
                toast.className = "toast-success show";
            }
            setTimeout(() => window.location.reload(), 1000);
        });
    });
}

// --- PHASE 4: THE GRID ENGINE ---

// 1. DYNAMIC TRIGGER INJECTION
function updateNextTrainView() {
    const fareBox = document.getElementById('fare-container');
    const container = fareBox ? fareBox.parentNode : null;
    if (!container) return;

    // Check if button already exists
    if (!document.getElementById('grid-trigger-container')) {
        const triggerDiv = document.createElement('div');
        triggerDiv.id = 'grid-trigger-container';
        triggerDiv.className = "mb-4 mt-2 px-1"; // Minimal vertical spacing
        triggerDiv.innerHTML = `
            <button onclick="renderFullScheduleGrid('A')" class="w-full flex items-center justify-center space-x-2 bg-white dark:bg-gray-800 border-2 border-blue-100 dark:border-blue-900 rounded-xl py-3 shadow-sm hover:border-blue-500 transition-all group">
                <span class="text-xl">📅</span>
                <span class="font-bold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">View Full Timetable</span>
                <svg class="w-4 h-4 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
        `;
        // Insert BEFORE the Fare Box
        container.insertBefore(triggerDiv, fareBox);
    } else {
        document.getElementById('grid-trigger-container').classList.remove('hidden');
    }
}

// --- VERSION ENFORCER: POLITE NOTIFICATION (Guardian V4.60.40) ---
function enforceAppVersion() {
    // Get version from config.js (which must be loaded first)
    const currentVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown';
    const storedVersion = localStorage.getItem('app_installed_version');

    // If version mismatch (and not first run), Prompt User instead of Nuke
    if (storedVersion && storedVersion !== currentVersion) {
        console.log(`[Guardian] Version Upgrade Available: ${storedVersion} -> ${currentVersion}`);
        
        // 4. Polite Notification (No Auto-Reload)
        // We do NOT update the storage key yet. We wait for user action.
        // localStorage.setItem('app_installed_version', currentVersion);

        // Show a persistent, non-dismissible update prompt
        const updateToastHTML = `
            <div id="update-toast" class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4 z-[100] cursor-pointer hover:scale-105 transition-transform w-[90%] max-w-sm" onclick="handleUpdateClick('${currentVersion}')">
                <div class="bg-white/20 rounded-full p-2 animate-pulse">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15"></path></svg>
                </div>
                <div class="flex flex-col">
                    <span class="text-base font-bold">Update Complete</span>
                    <span class="text-xs text-blue-100">Tap here to load the new schedule.</span>
                </div>
            </div>`;

        const div = document.createElement('div'); 
        div.innerHTML = updateToastHTML; 
        document.body.appendChild(div.firstElementChild);
        return; 
    }
    
    // First run or same version: just update storage
    if (!storedVersion) localStorage.setItem('app_installed_version', currentVersion);
}

// Helper for the toast click
window.handleUpdateClick = function(newVersion) {
    // 1. Unregister All Service Workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
        });
    }
    // 2. Clear Caches
    if ('caches' in window) {
        caches.keys().then(names => {
            for (let name of names) {
                caches.delete(name);
            }
        });
    }
    // 3. Update Storage
    localStorage.setItem('app_installed_version', newVersion);
    
    // 4. Reload
    window.location.reload(true);
};

// --- INITIALIZATION HOOK ---
document.addEventListener('DOMContentLoaded', () => {
    // Run Version Enforcer FIRST
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
    themeToggleBtn = document.getElementById('theme-toggle-btn');
    darkIcon = document.getElementById('theme-toggle-dark-icon');
    lightIcon = document.getElementById('theme-toggle-light-icon');
    shareBtn = document.getElementById('share-app-btn');
    installBtn = document.getElementById('install-app-btn');
    forceReloadBtn = document.getElementById('force-reload-btn');
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

    if(closeLegalBtn) closeLegalBtn.addEventListener('click', closeLegal);
    if(closeLegalBtn2) closeLegalBtn2.addEventListener('click', closeLegal);
    if(legalModal) legalModal.addEventListener('click', (e) => { if (e.target === legalModal) closeLegal(); });
    
    document.getElementById('tab-next-train').addEventListener('click', () => switchTab('next-train'));
    document.getElementById('tab-trip-planner').addEventListener('click', () => switchTab('trip-planner'));

    // GUARDIAN UPDATE V5.00.00: Clickable Changelog
    const versionFooter = document.getElementById('app-version-footer');
    if (versionFooter && typeof APP_VERSION !== 'undefined') {
        versionFooter.textContent = APP_VERSION;
        versionFooter.classList.add('cursor-pointer', 'underline', 'hover:text-blue-500', 'transition-colors');
        versionFooter.onclick = () => {
            if (typeof Renderer !== 'undefined' && Renderer.renderChangelogModal) {
                Renderer.renderChangelogModal(typeof CHANGELOG_DATA !== 'undefined' ? CHANGELOG_DATA : []);
            }
        };
    }

    const helpModal = document.getElementById('help-modal');
    const openHelpBtn = document.getElementById('open-help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const closeHelpBtn2 = document.getElementById('close-help-btn-2');
    const aboutModal = document.getElementById('about-modal');
    const openAboutBtn = document.getElementById('open-about-btn');
    const closeAboutBtn = document.getElementById('close-about-btn');
    const facebookBtn = document.getElementById('facebook-connect-link');
    if (facebookBtn) facebookBtn.addEventListener('click', () => trackAnalyticsEvent('click_social_facebook', { location: 'about_modal' }));

    const closeSideNav = () => { if(sidenav) { sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open'); } };
    const openHelp = () => { trackAnalyticsEvent('view_user_guide', { location: 'sidebar' }); history.pushState({ modal: 'help' }, '', '#help'); if(helpModal) helpModal.classList.remove('hidden'); closeSideNav(); };
    const closeHelp = () => { if(location.hash === '#help') history.back(); else if(helpModal) helpModal.classList.add('hidden'); };
    const openAbout = () => { trackAnalyticsEvent('view_about_page', { location: 'sidebar' }); history.pushState({ modal: 'about' }, '', '#about'); if(aboutModal) aboutModal.classList.remove('hidden'); closeSideNav(); };
    const closeAbout = () => { if(location.hash === '#about') history.back(); else if(aboutModal) aboutModal.classList.add('hidden'); };
    
    if(openHelpBtn) openHelpBtn.addEventListener('click', openHelp);
    if(closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
    if(closeHelpBtn2) closeHelpBtn2.addEventListener('click', closeHelp);
    if(helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });
    if(openAboutBtn) openAboutBtn.addEventListener('click', openAbout);
    if(closeAboutBtn) closeAboutBtn.addEventListener('click', closeAbout);
    if(aboutModal) aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) closeAbout(); });

    // FIX 3: Safety check for locateBtn before adding listener
    if (locateBtn) {
        locateBtn.addEventListener('click', () => { 
            trackAnalyticsEvent('click_auto_locate', { location: 'home_header' }); 
            findNearestStation(false); 
        });
    }
    
    const viewMapBtn = document.getElementById('view-map-btn');
    if (viewMapBtn) viewMapBtn.addEventListener('click', () => trackAnalyticsEvent('click_network_map', { location: 'sidebar' }));
    const openInteractiveMapBtn = document.getElementById('open-interactive-map-btn');
    if (openInteractiveMapBtn) openInteractiveMapBtn.addEventListener('click', () => trackAnalyticsEvent('open_interactive_map', { source: 'modal' }));
    
    if (appTitle && typeof Admin !== 'undefined' && Admin.setupPinAccess) { Admin.setupPinAccess(); }

    stationSelect.addEventListener('change', () => { syncPlannerFromMain(stationSelect.value); findNextTrains(); });
    
    setupFeatureButtons(); updatePinUI(); setupModalButtons(); setupRedirectLogic(); startSmartRefresh();
    setupSwipeNavigation(); initTabIndicator(); 
    
    if (typeof setupMapLogic === 'function') {
        setupMapLogic(); 
    }

    const savedDefault = localStorage.getItem('defaultRoute');
    
    if (savedDefault && ROUTES[savedDefault]) {
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
        console.log("First time user (or no pinned route). Showing Welcome Screen.");
        // GUARD CLAUSE ADDED HERE (V4.60.17)
        if (typeof loadingOverlay !== 'undefined' && loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        showWelcomeScreen();
    }

    // --- RESTORE ACTIVE TAB (Updated for URL Shortcuts) ---
    // If URL has action, do not restore previous tab, respect the action.
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