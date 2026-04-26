// --- METRORAIL NEXT TRAIN LOGIC (V6.04.27 - Guardian Edition) ---
// --- GLOBAL STATE VARIABLES ---
// Defined here to be shared across scripts
let currentRegion = safeStorage.getItem('userRegion') || 'GP'; // GUARDIAN: Regional State (Default GP, Safe Storage Protected)

// 🛡️ GUARDIAN PHASE 5: SILENT IP GEOLOCATION HOOK
// Fires instantly during script parsing to catch edge-cache region headers before DOMContentLoaded
window.regionCheckPromise = Promise.resolve(); // Default resolved state

if (!safeStorage.getItem('userRegion')) {
    const fetchGeo = fetch('https://nexttrain-telemetry.enock.workers.dev/region')
        .then(r => r.json())
        .then(data => {
            if (data && data.region && (data.region === 'WC' || data.region === 'GP')) {
                currentRegion = data.region;
                console.log(`🛡️ Guardian: Silent IP Geolocation successfully bound to ${currentRegion}`);
                
                // If the UI has already rendered the Welcome Screen by the time this resolves, update it in-place
                if (typeof document !== 'undefined') {
                    const gpBtn = Array.from(document.querySelectorAll('#welcome-region-selector button')).find(b => b.textContent.includes('Gauteng'));
                    const wcBtn = Array.from(document.querySelectorAll('#welcome-region-selector button')).find(b => b.textContent.includes('Western Cape'));
                    
                    if (gpBtn && wcBtn) {
                        if (currentRegion === 'WC') {
                            wcBtn.className = "px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300";
                            gpBtn.className = "px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-300";
                        } else {
                            gpBtn.className = "px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300";
                            wcBtn.className = "px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors bg-transparent border-gray-300 dark:border-gray-600 text-gray-500 hover:border-blue-300";
                        }
                        
                        // Re-render the route list with the new region seamlessly
                        if (typeof Renderer !== 'undefined' && typeof getRoutesForCurrentRegion === 'function' && typeof selectWelcomeRoute === 'function') {
                            Renderer.renderWelcomeList('welcome-route-list', getRoutesForCurrentRegion(), selectWelcomeRoute);
                        }
                    }

                    // Sync Sidenav & Route Modal Puppeteer displays
                    const sideDisp = document.getElementById('sidenav-region-display');
                    const modalDisp = document.getElementById('route-modal-region-display');
                    const sideSel = document.getElementById('app-hub-region-select');
                    const modalSel = document.getElementById('route-modal-region-select');

                    if (sideDisp) sideDisp.textContent = currentRegion === 'WC' ? 'Western Cape' : 'Gauteng';
                    if (modalDisp) modalDisp.textContent = currentRegion === 'WC' ? 'Region: Western Cape' : 'Region: Gauteng';
                    if (sideSel) sideSel.value = currentRegion;
                    if (modalSel) modalSel.value = currentRegion;
                }
            }
        })
        .catch(e => console.log("🛡️ Guardian: IP Geolocation bypassed (AdBlocker or Offline)"));

    // 🛡️ GUARDIAN PHASE 1: Fast-Fail Timeout Lock
    const geoTimeout = new Promise(resolve => {
        setTimeout(() => {
            console.log("🛡️ Guardian: IP Geolocation timed out (1500ms). Proceeding with default region.");
            resolve();
        }, 1500);
    });

    window.regionCheckPromise = Promise.race([fetchGeo, geoTimeout]);
}

let globalStationIndex = {}; 
let currentRouteId = null; 
let fullDatabase = null; 
let schedules = {};
let allStations = []; // Stations for CURRENT route
let MASTER_STATION_LIST = []; // Stations for ALL routes (New for Planner)
let currentTime = null;
let currentDayType = 'weekday'; 
let currentDayIndex = 0; 
let currentScheduleData = {};
let refreshTimer = null;
let currentUserProfile = "Adult"; 
// GUARDIAN V4.60.70: Ghost Train Exclusions
let globalExclusions = {}; 
// GUARDIAN PHASE 2: Tiered Disruptions State
let globalDisruptions = {};
// GUARDIAN V5.01.00: Analytics state for O-D Matrix
let lastTrackedOD = null; 
// GUARDIAN V6.00.33 Phase 3: RAM Fallback Engine for devices with 100% full storage
let memoryFallbackCache = {}; 
// GUARDIAN PERFORMANCE PATCH: Track last minute to prevent CPU thrashing
let lastRenderedMinute = -1;
// GUARDIAN PHASE 4: Async Route-Swap Bleed Prevention
let scheduleAbortController = null; 

// --- SHARED UI REFERENCES (Declared here, Assigned in UI.js) ---
let stationSelect, locateBtn, pretoriaTimeEl, pienaarspoortTimeEl, pretoriaHeader, pienaarspoortHeader;
let currentTimeEl, currentDayEl, loadingOverlay, mainContent, offlineIndicator;
let scheduleModal, modalTitle, modalList, closeModalBtn, closeModalBtn2;
let redirectModal, redirectMessage, redirectConfirmBtn, redirectCancelBtn;
let themeToggleBtn, darkIcon, lightIcon, shareBtn, installBtn, forceReloadBtn;
let pinRouteBtn, pinOutline, pinFilled, openNavBtn, closeNavBtn;
let sidenav, sidenavOverlay, routeList, routeSubtitle, routeSubtitleText, pinnedSection;
let toast, checkUpdatesBtn, feedbackBtn, lastUpdatedEl;
let simPanel, simEnabledCheckbox, simTimeInput, simDaySelect, simApplyBtn;
let appTitle, pinModal, pinInput, pinCancelBtn, pinSubmitBtn;
let legalModal, legalTitle, legalContent, closeLegalBtn, closeLegalBtn2;
let profileModal, navProfileDisplay, fareContainer, fareAmount, fareType, passengerTypeLabel;
let welcomeModal, welcomeRouteList; 

// --- HOLIDAY CONFIGURATION (2026) ---
// Rule: Weekday Holidays -> 'saturday' schedule.
const SPECIAL_DATES = {
    // 2026
    "01-01": "saturday", // New Year's Day
    // "01-02" REMOVED: Normal Friday (Weekday)
    "03-21": "saturday", // Human Rights Day
    "04-03": "saturday", // Good Friday
    "04-06": "saturday", // Family Day
    "04-27": "saturday", // Freedom Day
    "05-01": "saturday", // Workers' Day
    "06-16": "saturday", // Youth Day
    "08-09": "sunday",   // National Women's Day
    "08-10": "saturday", // Women's Day Observed
    "09-24": "saturday", // Heritage Day
    "12-16": "saturday", // Day of Reconciliation
    "12-25": "sunday",   // Christmas Day
    "12-26": "sunday"  // Day of Goodwill
};

// GUARDIAN Phase 1: Typography Polish Mapping
const HOLIDAY_NAMES = {
    "01-01": "New Year's Day",
    "03-21": "Human Rights Day",
    "04-03": "Good Friday",
    "04-06": "Family Day",
    "04-27": "Freedom Day",
    "05-01": "Workers' Day",
    "06-16": "Youth Day",
    "08-09": "National Women's Day",
    "08-10": "Women's Day Observed",
    "09-24": "Heritage Day",
    "12-16": "Day of Reconciliation",
    "12-25": "Christmas Day",
    "12-26": "Day of Goodwill"
};

// --- GUARDIAN PHASE B: THE LIE-FI DETECTOR & FETCH WRAPPER ---
window.isLieFi = false;
window.guardianFetch = async function(url, options = {}, timeoutMs = 5000) {
    if (!navigator.onLine) {
        window.isLieFi = true;
        throw new Error("OS reports offline state.");
    }
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    
    // GUARDIAN PHASE 4: Bridge external abort signals seamlessly
    if (options.signal) {
        if (options.signal.aborted) {
            controller.abort();
        } else {
            options.signal.addEventListener('abort', () => controller.abort());
        }
    }
    
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        window.isLieFi = false;
        
        // Hide the offline indicator if network succeeded
        const oi = document.getElementById('offline-indicator');
        if (oi) oi.style.display = 'none';
        
        return response;
    } catch (error) {
        clearTimeout(id);
        
        // GUARDIAN PHASE 4 & 2 (Growth Mode): Suppress offline UI triggers if the request was deliberately aborted by a route swap
        if (options.signal && options.signal.aborted) {
            console.log(`🛡️ Guardian: Request to ${url} cleanly aborted by user navigation.`);
            window.isLieFi = false; // <-- 🛡️ The Deadlock Fix: Reset cleanly on deliberate aborts to prevent permanent deadlock
            throw error;
        }

        if (error.name === 'AbortError' || error.message.includes('fetch') || error.message.includes('Network')) {
            window.isLieFi = true;
            console.warn(`🛡️ Guardian Lie-Fi Detector: Request to ${url} timed out/failed. Assumed offline.`);
            
            // Show Lie-Fi Toast (Phase A UX Integration)
            const offlineToast = document.getElementById('offline-toast');
            if (offlineToast) {
                offlineToast.classList.remove('translate-y-[150%]', 'opacity-0');
                setTimeout(() => offlineToast.classList.add('translate-y-[150%]', 'opacity-0'), 4000);
            }

            // Priority Clash Fix: Suppress Maintenance Banner if offline
            const maintBanner = document.getElementById('maintenance-banner');
            if (maintBanner) maintBanner.style.display = 'none'; 

            // Show standard offline indicator
            const oi = document.getElementById('offline-indicator');
            if (oi) oi.style.display = 'flex';
        }
        throw error;
    }
};

// --- GUARDIAN PHASE 1 (Bug 4 Fix): Universal Holiday Lookahead Engine ---
window.getLookaheadDayInfo = function(daysAhead = 1) {
    let baseDate = new Date();
    
    // Respect Developer Sim Mode Base Date
    if (typeof window.isSimMode !== 'undefined' && window.isSimMode) {
        const dateInput = document.getElementById('sim-date');
        if (dateInput && dateInput.value) {
            const parts = dateInput.value.split('-');
            if(parts.length === 3) {
                baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
        }
    }

    // Advance the physical date
    baseDate.setDate(baseDate.getDate() + daysAhead);

    const dayOfWeek = baseDate.getDay(); // 0 = Sunday, 6 = Saturday
    let dayType = (dayOfWeek === 0) ? 'sunday' : (dayOfWeek === 6 ? 'saturday' : 'weekday');
    
    // GUARDIAN BUGFIX: Do not overwrite physical day names with Holiday Titles.
    // Commuters need to read "First train on Monday is at", not "Public Holiday".
    let dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek];
    if (daysAhead === 1) dayName = "Tomorrow";

    // Pad month and date for dictionary matching (e.g. "04-06")
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d = String(baseDate.getDate()).padStart(2, '0');
    const dateKey = `${m}-${d}`;

    // Override the Schedule Type if it's a Special Date (Public Holiday)
    if (typeof SPECIAL_DATES !== 'undefined' && SPECIAL_DATES[dateKey]) {
        dayType = SPECIAL_DATES[dateKey];
    }

    return {
        type: dayType,
        name: dayName,
        idx: dayOfWeek,
        isHoliday: !!(typeof SPECIAL_DATES !== 'undefined' && SPECIAL_DATES[dateKey])
    };
};

// --- GUARDIAN PHASE 1 (Bug 4 Fix): The True Day Simulator ---
// Looks up to 7 days ahead to find the very next physical train that runs,
// securely bypassing Ghost Exclusions on Public Holidays and weekends.
window.simulateNextActiveService = function(selectedStation, destination) {
    if (!currentRouteId || !ROUTES[currentRouteId]) return null;
    const currentRoute = ROUTES[currentRouteId];
    
    let firstTrain = null;
    let daysAhead = 1;
    let nextDayInfo = null;

    const isDestA = (destination === currentRoute.destA);

    while (daysAhead <= 7 && !firstTrain) {
        nextDayInfo = window.getLookaheadDayInfo(daysAhead);
        
        // GUARDIAN BUGFIX: The Sunday Mirage Patch.
        if (nextDayInfo.type === 'sunday') {
            daysAhead++;
            continue;
        }

        const sheetKey = isDestA
            ? (nextDayInfo.type === 'weekday' ? 'weekday_to_a' : 'saturday_to_a')
            : (nextDayInfo.type === 'weekday' ? 'weekday_to_b' : 'saturday_to_b');

        const schedule = schedules[sheetKey];
        
        if (schedule && schedule.rows && schedule.rows.length > 0) {
            const res = isDestA
                ? findNextJourneyToDestA(selectedStation, "00:00:00", schedule, currentRoute, nextDayInfo.idx)
                : findNextJourneyToDestB(selectedStation, "00:00:00", schedule, currentRoute, nextDayInfo.idx);
            
            const remainingJourneys = res.allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
            if (remainingJourneys.length > 0) {
                firstTrain = remainingJourneys[0];
            }
        }
        
        if (!firstTrain) daysAhead++;
    }

    if (firstTrain) {
        return {
            train: firstTrain,
            dayInfo: nextDayInfo,
            daysAhead: daysAhead
        };
    }
    return null;
};

// --- SIMULATION STATE ---
let clickCount = 0;
let clickTimer = null;
let isSimMode = false;
let simTimeStr = "";
let simDayIndex = 1;
let toastTimeout;

// --- HELPERS ---

// GUARDIAN V6.1: Date Formatter Helper
function formatEffectiveDate(rawDateStr) {
    if (!rawDateStr || String(rawDateStr).toLowerCase().includes("undefined") || rawDateStr === "null") return "Unknown";
    let cleanStr = String(rawDateStr).replace(/^last updated[:\s-]*/i, '').trim();
    try {
        if (cleanStr.includes(',')) cleanStr = cleanStr.split(',')[0].trim();
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) {
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }
    } catch(e) {}
    return cleanStr;
}

// NEW HELPER: Count shared stations between two routes
function getSharedStationCount(routeAId, routeBId) {
    let count = 0;
    for (const stationName in globalStationIndex) {
        const routes = globalStationIndex[stationName].routes;
        if (routes.has(routeAId) && routes.has(routeBId)) {
            count++;
        }
    }
    return count;
}

// NEW HELPER (V4.39): Get all future stations on the current route from a starting point
function getTargetStations(schedule, fromStation) {
    if (!schedule || !schedule.rows) return new Set();
    const rows = schedule.rows;
    const fromIdx = rows.findIndex(r => normalizeStationName(r.STATION) === normalizeStationName(fromStation));
    
    if (fromIdx === -1) return new Set();
    
    const targets = new Set();
    for (let i = fromIdx + 1; i < rows.length; i++) {
        targets.add(normalizeStationName(rows[i].STATION));
    }
    return targets;
}

// NEW HELPER (V4.39): Check if a shared train actually stops at any of our target future stations
function hasForwardOverlap(trainName, otherSchedule, fromStation, targetStations) {
    if (!otherSchedule || !otherSchedule.rows) return false;
    const rows = otherSchedule.rows;
    const fromIdx = rows.findIndex(r => normalizeStationName(r.STATION) === normalizeStationName(fromStation));
    
    if (fromIdx === -1) return false;

    for (let i = fromIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        // GUARDIAN BUGFIX: Safely cast to string to prevent .trim() crash on numeric cells
        const val = row[trainName] ? String(row[trainName]).trim() : "";
        if (val && val !== "-" && targetStations.has(normalizeStationName(row.STATION))) {
            return true;
        }
    }
    return false;
}

// GUARDIAN HELPER V4.60.70: Ghost Train Logic
function isTrainExcluded(trainNumber, routeId, dayIdx) {
    if (!trainNumber) return false;
    
    const rules = (globalExclusions && globalExclusions[routeId]) 
                  ? globalExclusions[routeId] 
                  : (typeof DEFAULT_EXCLUSIONS !== 'undefined' ? DEFAULT_EXCLUSIONS[routeId] : null);
    
    if (rules && rules[trainNumber]) {
        const rule = rules[trainNumber];
        
        // GUARDIAN PHASE C: Automatic Expiry Enforcement
        if (rule.expiresAt && Date.now() > rule.expiresAt) {
            return false; // The ban has expired, treat the train as active
        }
        
        if (rule.days && rule.days.includes(parseInt(dayIdx))) {
            // GUARDIAN PHASE 12: Return specific metadata string instead of generic boolean
            return rule.type || 'banned'; 
        }
    }
    return false;
}

// --- GUARDIAN PHASE 3: CROSS-CORRIDOR TIERED INCIDENT MANAGEMENT HELPERS ---
window.checkDisruption = function(routeId, stationA, stationB) {
    if (!globalDisruptions) return null;
    
    let highestDisruption = null;
    const normA = normalizeStationName(stationA);
    const normB = normalizeStationName(stationB);

    const prioritizeDisruption = (current, incoming) => {
        if (!current) return incoming;
        if (incoming.tier === 'CRITICAL' && current.tier !== 'CRITICAL') return incoming;
        return current;
    };

    // GUARDIAN PHASE 3: Cross-Corridor Geometry Scan
    // We scan ALL disruptions across the entire network. If a disruption's coordinates
    // match the current commuter's route geometry, we apply it, regardless of the routeId it was filed under.
    for (const dRouteId in globalDisruptions) {
        const activeDisruptions = globalDisruptions[dRouteId];
        
        for (const d of activeDisruptions) {
            // If no specific stations are defined, it's a route-wide suspension.
            // This MUST strictly apply only to its parent route to avoid shutting down the whole app.
            if (!d.stations || d.stations.length === 0) {
                if (dRouteId === routeId) {
                    highestDisruption = prioritizeDisruption(highestDisruption, d);
                }
                continue;
            }

            const normDisruptedStations = d.stations.map(s => normalizeStationName(s));

            // Segment block (e.g., Centurion to Irene) - APPLIES UNIVERSALLY to any route crossing it
            if (normDisruptedStations.length >= 2) {
                if (normDisruptedStations.includes(normA) && normDisruptedStations.includes(normB)) {
                    highestDisruption = prioritizeDisruption(highestDisruption, d);
                }
            } 
            // Single station block - APPLIES UNIVERSALLY to any route touching it
            else if (normDisruptedStations.length === 1) {
                if (normDisruptedStations.includes(normA) || normDisruptedStations.includes(normB)) {
                    highestDisruption = prioritizeDisruption(highestDisruption, d);
                }
            }
        }
    }
    return highestDisruption;
};

// GUARDIAN PHASE 3 (ZONE ENGINE): Cross-Corridor "First Point of Contact" Calculation
window.getTripDisruptions = function(routeId, stopsArray) {
    if (!globalDisruptions || !stopsArray || stopsArray.length === 0) return [];
    
    const hits = [];
    const seenIds = new Set();
    
    // Helper: Extract the physical geometry (Master Station List) for this specific route.
    const getRouteMasterStations = (rId) => {
        if (!rId || !fullDatabase || !ROUTES[rId]) return [];
        const route = ROUTES[rId];
        // Prefer B-direction (outbound) to establish a consistent geographical array
        const key = route.sheetKeys.weekday_to_b || route.sheetKeys.weekday_to_a;
        if (!fullDatabase[key]) return [];
        return fullDatabase[key]
            .filter(r => r.STATION && !r.STATION.toLowerCase().includes('updated'))
            .map(r => normalizeStationName(r.STATION));
    };

    // The Master Geography for the current route being evaluated
    const currentRouteMasterStations = getRouteMasterStations(routeId);

    // Scan ALL active disruptions across the network (Cross-Corridor Scan)
    for (const dRouteId in globalDisruptions) {
        const activeDisruptions = globalDisruptions[dRouteId];
        
        for (const d of activeDisruptions) {
            if (seenIds.has(d.id)) continue;

            // 1. Route-Wide Advisory (0 Stations)
            // Strict limitation: Only applies if the commuter is actually ON the severed route
            if (!d.stations || d.stations.length === 0) {
                if (dRouteId === routeId) {
                    seenIds.add(d.id);
                    hits.push({
                        ...d,
                        triggerStopIndex: 0,
                        triggerStationA: stopsArray[0].station,
                        triggerStationB: stopsArray[stopsArray.length - 1].station
                    });
                }
                continue;
            }

            const normDisrupted = d.stations.map(s => normalizeStationName(s));

            // 2. Single Station Incident (Universal Match)
            if (normDisrupted.length === 1) {
                const targetNorm = normDisrupted[0];
                const contactIdx = stopsArray.findIndex(s => normalizeStationName(s.station) === targetNorm);
                
                if (contactIdx !== -1) {
                    seenIds.add(d.id);
                    hits.push({
                        ...d,
                        triggerStopIndex: contactIdx,
                        triggerStationA: d.stations[0],
                        triggerStationB: d.stations[0]
                    });
                }
                continue;
            }

            // 3. Multi-Station / Non-Adjacent "Danger Zone" Incident (Cross-Corridor Match)
            if (normDisrupted.length >= 2) {
                // We check the disruption geometry against the CURRENT ROUTE's master list
                const idxA = currentRouteMasterStations.indexOf(normDisrupted[0]);
                const idxB = currentRouteMasterStations.indexOf(normDisrupted[1]);

                // If BOTH stations exist on the current route, the Danger Zone intersects!
                if (idxA !== -1 && idxB !== -1) {
                    const minZone = Math.min(idxA, idxB);
                    const maxZone = Math.max(idxA, idxB);

                    let firstContactIdx = -1;
                    
                    // Trace the commuter's physical trip to find the very first point of entry into the Danger Zone
                    for (let i = 0; i < stopsArray.length; i++) {
                        const stopNorm = normalizeStationName(stopsArray[i].station);
                        const stopMasterIdx = currentRouteMasterStations.indexOf(stopNorm);
                        
                        if (stopMasterIdx >= minZone && stopMasterIdx <= maxZone) {
                            firstContactIdx = i;
                            break;
                        }
                    }

                    if (firstContactIdx !== -1) {
                        seenIds.add(d.id);
                        hits.push({
                            ...d,
                            triggerStopIndex: firstContactIdx,
                            triggerStationA: d.stations[0], 
                            triggerStationB: d.stations[1]  
                        });
                    }
                }
            }
        }
    }
    
    // Priority: CRITICAL events float to the top. Then sort by earliest contact index in the journey.
    hits.sort((a, b) => {
        if (a.tier === 'CRITICAL' && b.tier !== 'CRITICAL') return -1;
        if (a.tier !== 'CRITICAL' && b.tier === 'CRITICAL') return 1;
        return a.triggerStopIndex - b.triggerStopIndex;
    });
    
    return hits;
};

// --- DATABASE ENGINE (IndexedDB / Async Storage) ---
// GUARDIAN V6.00.12: Migrated from synchronous localStorage to asynchronous IndexedDB to stop UI freezing on data loads.
// GUARDIAN Phase 3: Injected memoryFallbackCache to prevent Sentry IO errors when device disk is at 100% capacity.
const DB_NAME = 'NextTrainDB';
const STORE_NAME = 'SchedulesStore';
const DB_VERSION = 1;

function initDB(retryCount = 0) {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB not supported"));
            return;
        }
        
        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (e) => {
                if (retryCount === 0) {
                    console.warn("🛡️ Guardian: IndexedDB Corruption trap triggered. Auto-healing...", e.target.error);
                    const deleteReq = indexedDB.deleteDatabase(DB_NAME);
                    deleteReq.onsuccess = () => {
                        console.log("🛡️ Guardian: Corrupted DB purged. Rebuilding...");
                        initDB(1).then(resolve).catch(reject);
                    };
                    deleteReq.onerror = () => {
                        reject(new Error("Fatal IDB Deletion Failure"));
                    };
                } else {
                    reject(e.target.error || new Error("IDB Open Error"));
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        } catch(err) {
            reject(err);
        }
    });
}

async function saveToLocalCache(key, data) {
    const cacheEntry = { timestamp: Date.now(), data: data };
    memoryFallbackCache[key] = cacheEntry;

    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(cacheEntry, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("🛡️ Guardian: IndexedDB Save Failed (Possible Disk Full). Falling back...", e);
        try { 
            safeStorage.setItem(key, JSON.stringify(cacheEntry)); 
        } catch(ex) {
            console.warn("🛡️ Guardian: LocalStorage also failed. Operating strictly in RAM mode.");
        }
    }
}

async function loadFromLocalCache(key) {
    if (memoryFallbackCache[key]) {
        console.log("🛡️ Guardian: Serving schedule from RAM cache.");
        return memoryFallbackCache[key];
    }

    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => {
                if (request.result) {
                    memoryFallbackCache[key] = request.result; 
                    resolve(request.result);
                } else {
                    try {
                        const lsItem = safeStorage.getItem(key);
                        if (lsItem) {
                            const parsed = JSON.parse(lsItem);
                            memoryFallbackCache[key] = parsed; 
                            resolve(parsed);
                            saveToLocalCache(key, parsed.data); 
                            safeStorage.removeItem(key); 
                        } else {
                            resolve(null);
                        }
                    } catch(ex) { resolve(null); }
                }
            }
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("🛡️ Guardian: IndexedDB Load Failed (Disk IO Error). Checking LocalStorage...", e);
        try { 
            const item = safeStorage.getItem(key); 
            if (item) {
                const parsed = JSON.parse(item);
                memoryFallbackCache[key] = parsed;
                return parsed;
            }
            return null;
        } catch (ex) { 
            return null; 
        }
    }
}

window.clearScheduleCache = async function() {
    memoryFallbackCache = {}; 
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    } catch(e) {} finally {
        safeStorage.removeItem(`full_db_GP`);
        safeStorage.removeItem(`full_db_WC`);
    }
};

// --- GUARDIAN PHASE 2 (GROWTH MODE): Seamless SPA Region Swap Engine ---
window.executeRegionSwap = function(newRegion) {
    console.log(`🛡️ Guardian: Executing seamless SPA region swap to ${newRegion}...`);

    // 1. Update Region
    currentRegion = newRegion;

    // 2. Wipe RAM caches to prevent data bleeding
    memoryFallbackCache = {}; 
    fullDatabase = null; 
    schedules = {};
    globalStationIndex = {}; 
    allStations = [];
    currentScheduleData = {};
    lastTrackedOD = null;

    // 3. Clear existing route and UI components
    currentRouteId = null;
    
    // 🛡️ GUARDIAN PHASE 1 (UI State Hardening): Explicitly hide main content to prevent layout bleed
    if (typeof mainContent !== 'undefined' && mainContent) {
        mainContent.style.display = 'none';
    }
    
    if (typeof stationSelect !== 'undefined' && stationSelect) {
        stationSelect.innerHTML = '<option value="">Loading stations...</option>';
        stationSelect.value = "";
    }
    
    if (typeof document !== 'undefined') {
        const searchInput = document.getElementById('station-search-input');
        if (searchInput) {
            searchInput.value = "";
            delete searchInput.dataset.resolvedValue;
        }
        
        // 🛡️ GUARDIAN PHASE 1: Trip Planner State Isolation
        // Aggressively purge Trip Planner inputs to prevent cross-region OD matrix bleeding
        const plannerFrom = document.getElementById('planner-from-search');
        const plannerTo = document.getElementById('planner-to-search');
        const plannerFromSelect = document.getElementById('planner-from');
        const plannerToSelect = document.getElementById('planner-to');
        
        if (plannerFrom) { plannerFrom.value = ""; delete plannerFrom.dataset.resolvedValue; }
        if (plannerTo) { plannerTo.value = ""; delete plannerTo.dataset.resolvedValue; }
        
        if (plannerFromSelect) {
            plannerFromSelect.innerHTML = '<option value="">Loading stations...</option>';
            plannerFromSelect.value = "";
        }
        if (plannerToSelect) {
            plannerToSelect.innerHTML = '<option value="">Loading stations...</option>';
            plannerToSelect.value = "";
        }
        
        // Forcefully collapse the Planner Results view if it was open
        if (typeof window.hidePlannerResults === 'function') {
            window.hidePlannerResults();
        }
    }

    // 4. Update the sidebar UI to reflect new region routes
    if (typeof Renderer !== 'undefined' && typeof getRoutesForCurrentRegion === 'function') {
        Renderer.renderRouteMenu('route-list', getRoutesForCurrentRegion(), null);
    }

    // 5. Look for a saved default route for this new region
    let savedDefault = null;
    try { savedDefault = typeof safeStorage !== 'undefined' ? safeStorage.getItem('defaultRoute_' + currentRegion) : null; } catch(e) {}
    
    if (savedDefault && typeof ROUTES !== 'undefined' && ROUTES[savedDefault] && ROUTES[savedDefault].region === currentRegion) {
        currentRouteId = savedDefault;
        if (typeof updateSidebarActiveState === 'function') updateSidebarActiveState();
        if (typeof updatePinUI === 'function') updatePinUI();
        
        // Re-render UI with loading skeleton
        if (typeof renderSkeletonLoader === 'function') {
            if (typeof pretoriaTimeEl !== 'undefined' && pretoriaTimeEl) renderSkeletonLoader(pretoriaTimeEl);
            if (typeof pienaarspoortTimeEl !== 'undefined' && pienaarspoortTimeEl) renderSkeletonLoader(pienaarspoortTimeEl);
        }
        
        // Force a full data fetch seamlessly
        if (typeof loadAllSchedules === 'function') {
            loadAllSchedules(true).then(() => {
                if (typeof checkServiceAlerts === 'function') checkServiceAlerts();
            });
        }
    } else {
        // No default route: show Welcome Screen seamlessly
        if (typeof showWelcomeScreen === 'function') {
            showWelcomeScreen();
        }
    }
};

// --- REFRESH LOGIC ---
function startSmartRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    scheduleNextRefresh();
}

function scheduleNextRefresh() {
    if (document.hidden) return; 
    const hour = new Date().getHours();
    if (hour >= REFRESH_CONFIG.nightModeStart || hour < REFRESH_CONFIG.nightModeEnd) {
        refreshTimer = setTimeout(scheduleNextRefresh, 60 * 60 * 1000);
        return;
    }
    let nextInterval = REFRESH_CONFIG.standardInterval;
    refreshTimer = setTimeout(async () => { await loadAllSchedules(); scheduleNextRefresh(); }, nextInterval);
}

// GUARDIAN PHASE 8: Nuclear Killswitch Listener
async function checkKillswitch(force = false) {
    if (!navigator.onLine || (window.isLieFi && !force)) return false;
    try {
        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        const res = await window.guardianFetch(`${dynamicEndpoint}config/killswitch.json?t=${Date.now()}`, {}, 3000);
        if (res.ok) {
            const data = await res.json();
            if (data && data.timestamp) {
                const localTimestamp = safeStorage.getItem('last_killswitch_timestamp');
                if (!localTimestamp || data.timestamp > parseInt(localTimestamp)) {
                    console.log("☢️ GUARDIAN KILLSWITCH ACTIVATED. Wiping all local data...");
                    safeStorage.setItem('last_killswitch_timestamp', data.timestamp);
                    
                    if (typeof window.performHardCacheClear === 'function') {
                        window.performHardCacheClear('system_killswitch'); 
                    } else {
                        if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.getRegistrations().then(regs => {
                                for (let reg of regs) reg.unregister();
                            });
                        }
                        if ('caches' in window) {
                            caches.keys().then(names => {
                                for (let name of names) caches.delete(name);
                            });
                        }
                        safeStorage.removeItem(`full_db_${currentRegion}`); 
                        safeStorage.removeItem('app_installed_version');
                        setTimeout(() => { window.location.reload(true); }, 500);
                    }
                    return true; 
                }
            }
        }
    } catch(e) { console.warn("Killswitch check failed:", e); }
    return false;
}

// GUARDIAN PHASE 3: Task 7.2 Remote Config Fetch
async function fetchSpecialEventConfig(force = false) {
    if (!navigator.onLine || (window.isLieFi && !force)) return;
    try {
        const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
        const eventResp = await window.guardianFetch(`${dynamicEndpoint}config/special_event.json?t=${Date.now()}`, {}, 4000);
        
        if (eventResp.ok) {
            const eventData = await eventResp.json();
            if (eventData && ROUTES['special_event']) {
                ROUTES['special_event'].isActive = eventData.isActive === true;
                if (eventData.name) ROUTES['special_event'].name = eventData.name;
                if (eventData.destA) ROUTES['special_event'].destA = eventData.destA;
                if (eventData.destB) ROUTES['special_event'].destB = eventData.destB;
                
                // GUARDIAN FIX: Prevent Route Bleed by filtering regional routes before rendering
                if (typeof Renderer !== 'undefined') {
                    const regionalRoutes = typeof getRoutesForCurrentRegion === 'function' ? getRoutesForCurrentRegion() : ROUTES;
                    Renderer.renderRouteMenu('route-list', regionalRoutes, currentRouteId);
                }
            }
        }
    } catch(e) { console.warn("Failed to fetch special event config", e); }
}

// --- DATA FETCHING & PROCESSING ---

// 🛡️ GUARDIAN PHASE 1: Asynchronous Database Parsers with Main Thread Yielding
async function processRouteDataFromDBAsync(route, targetDB) {
    if (!targetDB) return {};
    const getSched = async (key) => {
        // Yield to Main Thread to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
        const rows = targetDB[key];
        const metaKey = key + "_meta"; 
        const metaDate = targetDB[metaKey]; 
        return parseJSONSchedule(rows, metaDate); 
    };

    return {
        weekday_to_a: await getSched(route.sheetKeys.weekday_to_a),
        weekday_to_b: await getSched(route.sheetKeys.weekday_to_b),
        saturday_to_a: await getSched(route.sheetKeys.saturday_to_a),
        saturday_to_b: await getSched(route.sheetKeys.saturday_to_b)
    };
}

async function buildGlobalStationIndexAsync(targetDB) {
    let tempIndex = {}; 
    if (!targetDB) return tempIndex;

    const hasActiveService = (row, sKey, cKey) => {
        const ignored = new Set([sKey, cKey, 'KM_MARK', 'row_index']);
        return Object.keys(row).some(k => !ignored.has(k) && row[k] && String(row[k]).trim() !== "");
    };

    const routeList = Object.values(ROUTES);
    for (let i = 0; i < routeList.length; i++) {
        const route = routeList[i];
        if (route.region !== currentRegion) continue;
        if (!route.sheetKeys) continue;

        // Yield to Main Thread per route
        await new Promise(resolve => setTimeout(resolve, 0));

        Object.values(route.sheetKeys).forEach(dbKey => {
            const sheetData = targetDB[dbKey];
            if (!sheetData || !Array.isArray(sheetData)) return;
            
            let headerIndex = -1;
            for (let j = 0; j < Math.min(sheetData.length, 5); j++) {
                 if (Object.values(sheetData[j]).some(val => val && String(val).toUpperCase().includes('STATION'))) {
                     headerIndex = j;
                     break;
                 }
            }
            
            if (headerIndex > -1) {
                 for (let j = headerIndex + 1; j < sheetData.length; j++) {
                      const row = sheetData[j];
                      const headerRow = sheetData[headerIndex];
                      let stationKey = null;
                      let coordKey = null;
                      
                      Object.keys(headerRow).forEach(key => {
                          const valUpper = String(headerRow[key]).toUpperCase();
                          if (valUpper.includes('STATION')) stationKey = key;
                          if (valUpper.includes('COORDINATES')) coordKey = key;
                      });

                      if (!stationKey && row[stationKey]) stationKey = 'STATION';
                      if (!coordKey && row['COORDINATES']) coordKey = 'COORDINATES';

                      if (stationKey && row[stationKey]) {
                           if (!hasActiveService(row, stationKey, coordKey)) continue;

                           const stationName = normalizeStationName(row[stationKey]);
                           const coordVal = coordKey ? row[coordKey] : null;
                           let coords = { lat: null, lon: null };
                           
                           try {
                               if (coordVal) {
                                   const parts = String(coordVal).split(',').map(s => parseFloat(s.trim()));
                                   if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                        coords = { lat: parts[0], lon: parts[1] };
                                   }
                               }
                           } catch (e) { }

                           if (!tempIndex[stationName]) {
                               tempIndex[stationName] = { 
                                   lat: coords.lat, 
                                   lon: coords.lon, 
                                   routes: new Set()
                                };
                           } else if (tempIndex[stationName].lat === null && coords.lat !== null) {
                               // GUARDIAN Phase 5: Coordinate Resurrector
                               tempIndex[stationName].lat = coords.lat;
                               tempIndex[stationName].lon = coords.lon;
                           }
                           if (tempIndex[stationName]) tempIndex[stationName].routes.add(route.id);
                      }
                 }
            } else {
                 sheetData.forEach(row => {
                    let stationKey = row['STATION'] !== undefined ? 'STATION' : null;
                    let coordKey = row['COORDINATES'] !== undefined ? 'COORDINATES' : null;

                    if (stationKey && row[stationKey]) {
                        if (!hasActiveService(row, stationKey, coordKey)) return;

                        const stationName = normalizeStationName(row[stationKey]);
                        let coords = { lat: null, lon: null };
                        
                        try {
                            if (coordKey && row[coordKey]) {
                                const parts = String(row[coordKey]).split(',').map(s => parseFloat(s.trim()));
                                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                    coords = { lat: parts[0], lon: parts[1] };
                                }
                            }
                        } catch (e) { }

                        if (!tempIndex[stationName]) {
                            tempIndex[stationName] = { lat: coords.lat, lon: coords.lon, routes: new Set() };
                        } else if (tempIndex[stationName].lat === null && coords.lat !== null) {
                            // GUARDIAN Phase 5: Coordinate Resurrector
                            tempIndex[stationName].lat = coords.lat;
                            tempIndex[stationName].lon = coords.lon;
                        }
                        if (tempIndex[stationName]) tempIndex[stationName].routes.add(route.id);
                    }
                });
            }
        });
    }
    return tempIndex;
}

// GUARDIAN PHASE B: EAGER RENDERING PROTOCOL
async function loadAllSchedules(force = false) {
    let usedCache = false; // 🛡️ GUARDIAN FIX: Hoisted to prevent ReferenceError in catch block
    
    // 🛡️ GUARDIAN PHASE 1: Await Region Synchronization
    if (window.regionCheckPromise) {
        await window.regionCheckPromise;
    }
    
    // GUARDIAN PHASE 4: Async Route-Swap Bleed Prevention
    if (scheduleAbortController) {
        scheduleAbortController.abort();
    }
    scheduleAbortController = new AbortController();
    const fetchSignal = scheduleAbortController.signal;
    const requestedRouteId = currentRouteId;
    
    try {
        if (!currentRouteId) return; 
        const currentRoute = ROUTES[currentRouteId];
        if (!currentRoute) return;

        // 🛡️ GUARDIAN PHASE 2: Unwrap Unified Database Export safely with Smart Merge
        const unwrapDatabase = (db, region) => {
            if (!db) return null;
            let regionalData = {};
            if (region === 'GP' && db.gauteng) {
                regionalData = db.gauteng;
            } else if (region === 'WC' && db.westerncape) {
                regionalData = db.westerncape;
            } else if (region === 'GP' && db.schedules && !db.gauteng) {
                regionalData = db.schedules;
            }
            const mergedDb = { ...db, ...regionalData };
            delete mergedDb.gauteng;
            delete mergedDb.westerncape;
            delete mergedDb.schedules;
            return mergedDb;
        };

        // SETUP HEADERS INSTANTLY
        if(routeSubtitleText) {
            routeSubtitleText.textContent = currentRoute.name;
            const twColors = {
                'route-orange': 'text-orange-500 dark:text-orange-400',
                'route-purple': 'text-purple-600 dark:text-purple-400',
                'route-green': 'text-green-600 dark:text-green-400',
                'route-blue': 'text-blue-600 dark:text-blue-400',
                'route-yellow': 'text-yellow-600 dark:text-yellow-400',
                'route-red': 'text-red-600 dark:text-red-400',
                'route-indigo': 'text-indigo-600 dark:text-indigo-400'
            };
            const mappedColor = twColors[currentRoute.colorClass] || currentRoute.colorClass;
            routeSubtitleText.className = `text-base sm:text-lg font-medium ${mappedColor} group-hover:opacity-80 transition-colors truncate w-full px-1 min-w-0 text-center`;
        }
        
        if(pretoriaHeader) pretoriaHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destA.replace(' STATION', '')}</span>`;
        if(pienaarspoortHeader) pienaarspoortHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destB.replace(' STATION', '')}</span>`;

        // GUARDIAN PHASE B: EAGER ROUTE GUARD (Stop Grid Crashes)
        if (!currentRoute.isActive) {
            if (typeof renderComingSoon === 'function') renderComingSoon(currentRoute.name);
            if(mainContent) mainContent.style.display = 'block';
            if(loadingOverlay) loadingOverlay.style.display = 'none';
            
            const fContainer = document.getElementById('fare-container');
            if (fContainer) fContainer.classList.add('hidden');
            const gContainer = document.getElementById('grid-trigger-container');
            if (gContainer) gContainer.classList.add('hidden');
            const sBtn = document.getElementById('share-app-btn');
            if (sBtn && sBtn.closest('.border-t')) sBtn.closest('.border-t').classList.add('hidden');
            
            return; // HALT EXECUTION: Inactive routes do not render grids or query Firebase.
        } else {
            const sBtn = document.getElementById('share-app-btn');
            if (sBtn && sBtn.closest('.border-t')) sBtn.closest('.border-t').classList.remove('hidden');
            updateNextTrainView(); 
        }

        // --- 1. EAGER RENDER CACHE LOAD ---
        // Instantly parse IndexedDB and paint the DOM before doing any network checks
        const cacheKey = `full_db_${currentRegion}`;
        const cachedDB = await loadFromLocalCache(cacheKey);

        if (fetchSignal.aborted || currentRouteId !== requestedRouteId) {
            console.log("🛡️ Guardian: Route swapped during local cache load. Aborting stale render.");
            return;
        }

        if (cachedDB) {
            console.log("🛡️ Guardian Eager Render: Restoring from local cache instantly...");
            try {
                // 🛡️ GUARDIAN PHASE 1: Shadow-Clone & Main Thread Yielding
                const proposedDB = unwrapDatabase(cachedDB.data, currentRegion);
                const proposedSchedules = await processRouteDataFromDBAsync(currentRoute, proposedDB);
                const proposedStationIndex = await buildGlobalStationIndexAsync(proposedDB);
                
                // Commit state atomically to prevent UI crashes on malformed data
                fullDatabase = proposedDB;
                schedules = proposedSchedules;
                globalStationIndex = proposedStationIndex;
                
                buildMasterStationList(); 
                updateLastUpdatedText();
                
                if (typeof initializeApp === 'function') initializeApp();
                if (typeof findNextTrains === 'function') findNextTrains();
                usedCache = true;
                
                if (typeof hideLoadingOverlay === 'function') hideLoadingOverlay();
                else if(loadingOverlay) loadingOverlay.style.display = 'none';
                
                if(currentRouteId && mainContent) mainContent.style.display = 'block';
            } catch(err) {
                console.error("🛡️ Guardian: Cached DB shadow-clone parsing failed.", err);
            }
        } else {
            if (typeof renderSkeletonLoader === 'function') {
                if(pretoriaTimeEl) renderSkeletonLoader(pretoriaTimeEl);
                if(pienaarspoortTimeEl) renderSkeletonLoader(pienaarspoortTimeEl);
            }
        }

        // --- 2. BACKGROUND NETWORK SYNC (LIE-FI PROTECTED) ---
        if (!navigator.onLine || (window.isLieFi && !force)) {
            console.log("🛡️ Guardian: Offline/Lie-Fi detected. Halting background network sync.");
            return; 
        }

        const wasKilled = await checkKillswitch(force);
        if (wasKilled || fetchSignal.aborted || currentRouteId !== requestedRouteId) return; 

        await fetchSpecialEventConfig(force);
        if (fetchSignal.aborted || currentRouteId !== requestedRouteId) return; 

        try {
            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const exclResp = await window.guardianFetch(`${dynamicEndpoint}exclusions.json?t=${Date.now()}`, { signal: fetchSignal }, 4000);
            if (exclResp.ok) {
                const exclData = await exclResp.json();
                if (exclData) globalExclusions = exclData;
            }
        } catch(e) { console.warn("Exclusions fetch failed, using defaults."); }

        // GUARDIAN PHASE 2: Disruptions Fetcher (Unwrap Nested JSON)
        try {
            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const disrResp = await window.guardianFetch(`${dynamicEndpoint}disruptions.json?t=${Date.now()}`, { signal: fetchSignal }, 4000);
            if (disrResp.ok) {
                const disrData = await disrResp.json();
                if (disrData) {
                    const now = Date.now();
                    globalDisruptions = {};
                    
                    // GUARDIAN FIX: Double-loop to unwrap Firebase's nested route objects
                    // Format: { "pta-kempton": { "12345": { id: "12345", routeId: "pta-kempton", tier: "CRITICAL"... } } }
                    Object.keys(disrData).forEach(routeKey => {
                        const routeObj = disrData[routeKey];
                        if (routeObj && typeof routeObj === 'object') {
                            Object.values(routeObj).forEach(d => {
                                if (d && d.routeId) {
                                    // Clean up expired disruptions locally
                                    if (!d.expiresAt || d.expiresAt > now) {
                                        if (!globalDisruptions[d.routeId]) globalDisruptions[d.routeId] = [];
                                        globalDisruptions[d.routeId].push(d);
                                    }
                                }
                            });
                        }
                    });
                }
            }
        } catch(e) { console.warn("Disruptions fetch failed."); }

        // GUARDIAN SMART SYNC PROTOCOL
        let needsDownload = true;
        if (usedCache && !force && fullDatabase && fullDatabase.lastUpdated) {
            if (typeof DATA_SOURCE_MODE !== 'undefined' && DATA_SOURCE_MODE === 'GITHUB') {
                // CDN relies on browser cache policies
            } else {
                try {
                    const nodePath = REGIONS[currentRegion].dbNode.replace('.json', '');
                    const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : FIREBASE_BASE_URL;
                    const pingUrl = `${dynamicEndpoint}${nodePath}/lastUpdated.json?t=${Date.now()}`;
                    
                    const pingRes = await window.guardianFetch(pingUrl, { signal: fetchSignal }, 4000);
                    if (pingRes.ok) {
                        const remoteUpdated = await pingRes.json();
                        if (remoteUpdated && remoteUpdated === fullDatabase.lastUpdated) {
                            console.log("🛡️ Guardian Smart Sync: Schedule is up-to-date. Skipping heavy payload download.");
                            needsDownload = false;
                        }
                    }
                } catch(e) {
                    console.warn("Smart Sync Ping failed, proceeding with full data fetch.", e);
                }
            }
        }

        if (needsDownload) {
            const activeScheduleUrl = typeof SCHEDULE_BASE_URL !== 'undefined' ? SCHEDULE_BASE_URL : FIREBASE_BASE_URL;
            const regionDbUrl = activeScheduleUrl + REGIONS[currentRegion].dbNode;
            
            const response = await window.guardianFetch(regionDbUrl, { signal: fetchSignal }, 10000);
            
            if (fetchSignal.aborted || currentRouteId !== requestedRouteId) return; 

            if (!response.ok) throw new Error("Schedule Data fetch failed");
            const newDatabase = await response.json();
            if (!newDatabase) throw new Error("Empty database");

            const newStr = JSON.stringify(newDatabase);
            const oldStr = cachedDB ? JSON.stringify(cachedDB.data) : "";

            if (newStr !== oldStr) {
                if (fetchSignal.aborted || currentRouteId !== requestedRouteId) return; 
                
                console.log("New data detected! Updating local storage...");
                
                try {
                    // 🛡️ GUARDIAN PHASE 1: Shadow-Clone & Main Thread Yielding
                    const proposedDB = unwrapDatabase(newDatabase, currentRegion);
                    const proposedSchedules = await processRouteDataFromDBAsync(currentRoute, proposedDB);
                    const proposedStationIndex = await buildGlobalStationIndexAsync(proposedDB);
                    
                    // Commit state atomically
                    fullDatabase = proposedDB;
                    schedules = proposedSchedules;
                    globalStationIndex = proposedStationIndex;
                    
                    await saveToLocalCache(cacheKey, newDatabase); 
                    
                    buildMasterStationList();
                    updateLastUpdatedText();
                    
                    if (usedCache) { 
                        if(typeof showToast === 'function') showToast("Schedule updated!", "success", 3000); 
                        findNextTrains(); 
                    } else { 
                        if(typeof initializeApp === 'function') initializeApp(); 
                    }
                } catch(e) {
                    console.error("Network data parsing failed, reverting to previous state.", e);
                    throw e; // Hit the main catch block for UI handling
                }
            } else {
                console.log("Data verified up to date after full fetch (Hit Edge Cache).");
                if (!usedCache) {
                     if(typeof initializeApp === 'function') initializeApp();
                }
            }
        }

    } catch (error) {
        // Ignore AbortErrors natively, as they are expected during rapid route swapping
        if (error.name === 'AbortError') return;
        
        console.error("Fetch Error:", error);
        // GUARDIAN FIX: Now safely reads usedCache from outer scope without crashing
        if (!usedCache) {
            if(offlineIndicator) offlineIndicator.style.display = 'flex'; 
            if (typeof renderRouteError === 'function') renderRouteError(error);
        }
    } finally {
        // If it was aborted mid-flight, the user is looking at a new route loading overlay, 
        // so DO NOT hide the loading overlay or re-enable the refresh button for the old route.
        if (fetchSignal && fetchSignal.aborted) return;

        if(forceReloadBtn) {
            forceReloadBtn.disabled = false;
            const reloadIcon = forceReloadBtn.querySelector('svg');
            if(reloadIcon) reloadIcon.classList.remove('spinning');
        }
        
        if (typeof hideLoadingOverlay === 'function') {
            hideLoadingOverlay();
        } else if(loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }

        if(currentRouteId && mainContent) mainContent.style.display = 'block';
    }
}

function parseJSONSchedule(jsonRows, externalMetaDate = null) {
    try {
        if (!jsonRows || !Array.isArray(jsonRows) || jsonRows.length === 0) 
            return { headers: [], rows: [], stationColumnName: 'STATION', lastUpdated: externalMetaDate };

        let extractedLastUpdated = externalMetaDate;
        
        if (jsonRows.length > 0) {
            const firstRow = jsonRows[0];
            const values = Object.values(firstRow).map(String);
            const dateValueIndex = values.findIndex(v => /last updated/i.test(v));
            if (dateValueIndex !== -1) {
                 let val = values[dateValueIndex];
                 if (val.length > 15) {
                    extractedLastUpdated = val;
                } else if (values[dateValueIndex+1]) {
                    extractedLastUpdated = values[dateValueIndex+1];
                }
            }
        }
        
        // GUARDIAN V6.1: Clean the date string for the Grid display immediately
        extractedLastUpdated = formatEffectiveDate(extractedLastUpdated);

        const cleanRows = jsonRows.filter(row => {
            const s = row['STATION'];
            if (!s || typeof s !== 'string') return false;
            const lower = s.toLowerCase().trim();
            if (lower.startsWith('last updated') || lower.startsWith('updated:')) return false; 
            if (lower.includes('inter-station')) return false;
            if (lower.includes('trip')) return false; 
            return true;
        });

        if (cleanRows.length === 0) return { headers: [], rows: [], stationColumnName: 'STATION', lastUpdated: extractedLastUpdated };

        const allHeaders = new Set();
        cleanRows.forEach(row => { 
            Object.keys(row).forEach(key => { 
                if (key !== 'STATION' && key !== 'COORDINATES' && key !== 'row_index' && key !== 'KM_MARK') allHeaders.add(key); 
            }); 
        });
        const trainNumbers = Array.from(allHeaders).sort();
        
        return { 
            stationColumnName: 'STATION', 
            headers: ['STATION', ...trainNumbers], 
            rows: cleanRows,
            lastUpdated: extractedLastUpdated 
        };

    } catch (e) {
        console.error("Parser Error:", e);
        return { headers: [], rows: [], stationColumnName: 'STATION', lastUpdated: externalMetaDate };
    }
}

function buildMasterStationList() {
    MASTER_STATION_LIST = Object.keys(globalStationIndex).sort();
    if (typeof renderPlannerHistory === 'function') renderPlannerHistory();
}

function calculateTimeDiffString(departureTimeStr, dayOffset = 0) {
    try {
        if (!departureTimeStr || typeof departureTimeStr !== 'string') return "";
        const [nowH, nowM, nowS] = currentTime.split(':').map(Number);
        const depParts = departureTimeStr.split(':').map(Number);
        if (depParts.length < 2) return ""; 
        const depH = depParts[0]; const depM = depParts[1]; const depS = depParts[2] || 0;
        let nowTotalSeconds = (nowH * 3600) + (nowM * 60) + nowS;
        let depTotalSeconds = (depH * 3600) + (depM * 60) + depS;
        let diffInSeconds = (depTotalSeconds - nowTotalSeconds) + (dayOffset * 86400);
        if (diffInSeconds < -30) return ""; 
        if (diffInSeconds < 60) return "(Departing now)";
        let diffInMinutes = Math.ceil(diffInSeconds / 60);
        const hours = Math.floor(diffInMinutes / 60);
        const minutes = diffInMinutes % 60;
        return (hours > 0) ? `(in ${hours} hr ${minutes} min)` : `(in ${minutes} min)`;
    } catch (e) { return ""; }
}

function resolveZoneForRoute(routeId) {
    if (!fullDatabase || !routeId || !ROUTES[routeId]) return null;
    const route = ROUTES[routeId];
    const keysToCheck = Object.values(route.sheetKeys);
    for (const key of keysToCheck) {
        const zoneVal = fullDatabase[key + "_zone"];
        if (zoneVal && FARE_CONFIG.zones[zoneVal]) return zoneVal; 
    }
    for (const key of keysToCheck) {
        if (key.includes('_to_')) {
            const parts = key.split('_to_');
            if (parts.length === 2) {
                const prefix = parts[0]; 
                const rest = parts[1];
                let suffix = "";
                let dest = "";
                if (rest.endsWith('_weekday')) { suffix = '_weekday'; dest = rest.replace('_weekday', ''); }
                else if (rest.endsWith('_saturday')) { suffix = '_saturday'; dest = rest.replace('_saturday', ''); }
                if (dest && suffix) {
                    const reverseKey = `${dest}_to_${prefix}${suffix}_zone`;
                    const reverseZone = fullDatabase[reverseKey];
                    if (reverseZone && FARE_CONFIG.zones[reverseZone]) return reverseZone;
                }
            }
        }
    }
    return null;
}

function getRouteFare(sheetKey, departureTimeStr) {
    let zoneCode = null;
    if (sheetKey) {
        const zoneKey = sheetKey + "_zone";
        zoneCode = fullDatabase[zoneKey];
    }
    if (!zoneCode && currentRouteId) {
        zoneCode = resolveZoneForRoute(currentRouteId);
    }
    if (!zoneCode || !FARE_CONFIG.zones[zoneCode]) return null; 

    let basePrice = FARE_CONFIG.zones[zoneCode];
    let discountLabel = null;
    let isPromo = false; 
    let isOffPeak = false; 

    const profile = FARE_CONFIG.profiles[currentUserProfile] || FARE_CONFIG.profiles["Adult"];
    let useOffPeakRate = false;
    
    // GUARDIAN BUGFIX 1: Tie Off-Peak explicitly to the Sheet Type (No discounts on Sat/Sun/Holidays)
    let isWeekdaySheet = (currentDayType === 'weekday');
    if (sheetKey) {
        isWeekdaySheet = sheetKey.includes('weekday');
    }
    
    if (isWeekdaySheet) {
        let checkH, checkM;
        
        // GUARDIAN PHASE 2A: Decouple Off-Peak pricing from individual train departures.
        // Strict adherence to global physical/simulated clock.
        if (typeof window.isSimMode !== 'undefined' && window.isSimMode && window.simTimeStr) {
            const parts = window.simTimeStr.split(':');
            checkH = parseInt(parts[0], 10);
            checkM = parseInt(parts[1], 10);
        } else if (typeof currentTime !== 'undefined' && currentTime && currentTime.includes(':')) {
            const parts = currentTime.split(':');
            checkH = parseInt(parts[0], 10);
            checkM = parseInt(parts[1], 10);
        } else {
            const now = new Date();
            checkH = now.getHours();
            checkM = now.getMinutes();
        }
        
        const decimalTime = checkH + (checkM / 60);
        if (decimalTime >= FARE_CONFIG.offPeakStart && decimalTime < FARE_CONFIG.offPeakEnd) {
            useOffPeakRate = true;
        }
    }

    const multiplier = useOffPeakRate ? profile.offPeak : profile.base;
    let finalPrice = basePrice * multiplier;
    finalPrice = Math.ceil(finalPrice * 2) / 2;

    // GUARDIAN FIX: Mutually exclusive Promo vs OffPeak flags to prevent UI collisions
    if (currentUserProfile === "Adult") {
        isPromo = false; // Adults only get the time-based green Off-Peak badge
        if (useOffPeakRate) {
            discountLabel = "40% Off-Peak";
        }
    } else if (multiplier < 1.0) {
        isPromo = true; // Special profiles get the purple Promo badge
        if (currentUserProfile === "Pensioner") discountLabel = "50% Off-Peak";
        else if (currentUserProfile === "Military") discountLabel = "50% Off-Peak";
        else if (currentUserProfile === "Scholar") discountLabel = "50% Discount";
        else discountLabel = "Discounted"; 
    }

    return {
        price: finalPrice.toFixed(2),
        isOffPeak: useOffPeakRate, 
        isPromo: isPromo,
        discountLabel: discountLabel 
    };
}

function getDetailedFare(sheetKey) {
    if (!fullDatabase) return null;
    let zoneCode = null;
    if (sheetKey) {
        const zoneKey = sheetKey + "_zone";
        zoneCode = fullDatabase[zoneKey];
    }
    if (!zoneCode && currentRouteId) {
        zoneCode = resolveZoneForRoute(currentRouteId);
    }
    if (!zoneCode) return null; 

    if (FARE_CONFIG.zones_detailed && FARE_CONFIG.zones_detailed[zoneCode]) {
        return { code: zoneCode, prices: FARE_CONFIG.zones_detailed[zoneCode] };
    }
    return null;
}

// --- JOURNEY FINDING LOGIC ---

function findNextTrains() {
    if(!currentRouteId) return;

    const selectedStation = stationSelect.value;
    const currentRoute = ROUTES[currentRouteId];
    
    const isAtStation = (s1, s2) => normalizeStationName(s1) === normalizeStationName(s2);

    if (!currentRoute) return;
    
    // GUARDIAN V6.1: The Hoist - Strict Inactive Route Nuke
    // If the route is inactive, we destroy the UI and halt immediately.
    // This stops the R9.50 state bleed and removes ghost buttons.
    if (!currentRoute.isActive) { 
        if(typeof renderComingSoon === 'function') renderComingSoon(currentRoute.name); 
        
        const fContainer = document.getElementById('fare-container');
        if (fContainer) fContainer.classList.add('hidden');
        
        const gContainer = document.getElementById('grid-trigger-container');
        if (gContainer) gContainer.classList.add('hidden');
        
        const sBtn = document.getElementById('share-app-btn');
        if (sBtn && sBtn.closest('.border-t')) sBtn.closest('.border-t').classList.add('hidden');
        
        return; // HALT EXECUTION
    } else {
        const sBtn = document.getElementById('share-app-btn');
        if (sBtn && sBtn.closest('.border-t')) sBtn.closest('.border-t').classList.remove('hidden');
    }

    if (selectedStation === "FIND_NEAREST") { findNearestStation(false); return; }
    
    pretoriaTimeEl.innerHTML = ""; pienaarspoortTimeEl.innerHTML = "";
    pretoriaHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destA.replace(' STATION', '')}</span>`;
    pienaarspoortHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destB.replace(' STATION', '')}</span>`;
    
    if (!selectedStation) { if(typeof renderPlaceholder === 'function') renderPlaceholder(); return; }
    
    if (!stationSelect.options[stationSelect.selectedIndex]) return;

    if (stationSelect.options[stationSelect.selectedIndex].textContent.includes("(No Service)")) {
        const msg = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No trains stop here.</div>`;
        pretoriaTimeEl.innerHTML = msg; pienaarspoortTimeEl.innerHTML = msg; return;
    }

    const currentODKey = `${currentRouteId}_${selectedStation}`;
    if (lastTrackedOD !== currentODKey && typeof trackAnalyticsEvent === 'function') {
        lastTrackedOD = currentODKey;
        trackAnalyticsEvent('od_matrix_view', {
            origin: selectedStation.replace(' STATION', ''),
            dest_a: currentRoute.destA.replace(' STATION', ''),
            dest_b: currentRoute.destB.replace(' STATION', ''),
            route_id: currentRouteId,
            time_of_search: currentTime,
            day_type: currentDayType,
            trip_type: 'live_board_view',
            region: currentRegion
        });
    }
    
    if (currentDayType === 'sunday') {
        if(typeof renderNoService === 'function') {
            if (isAtStation(selectedStation, currentRoute.destA)) {
                if(typeof renderAtDestination === 'function') renderAtDestination(pretoriaTimeEl);
            } else {
                renderNoService(pretoriaTimeEl, currentRoute.destA); 
            }
            if (isAtStation(selectedStation, currentRoute.destB)) {
                if(typeof renderAtDestination === 'function') renderAtDestination(pienaarspoortTimeEl);
            } else {
                renderNoService(pienaarspoortTimeEl, currentRoute.destB); 
            }
        }
        return;
    }

    let sharedRoutes = [];
    Object.values(ROUTES).forEach(r => {
        if (r.region === currentRegion && r.id !== currentRouteId && r.isActive && r.corridorId === currentRoute.corridorId) {
            sharedRoutes.push(r.id);
        }
    });

    if (fullDatabase && globalStationIndex[normalizeStationName(selectedStation)]) {
        const stationData = globalStationIndex[normalizeStationName(selectedStation)];
        stationData.routes.forEach(rId => {
            if (rId !== currentRouteId && ROUTES[rId].isActive && !sharedRoutes.includes(rId)) {
                sharedRoutes.push(rId);
            }
        });
    }

    sharedRoutes = sharedRoutes.filter(rId => getSharedStationCount(currentRouteId, rId) > 1);
    let primarySheetKey = (currentDayType === 'weekday') ? currentRoute.sheetKeys.weekday_to_a : currentRoute.sheetKeys.saturday_to_a;

    // --- DESTINATION A ---
    if (isAtStation(selectedStation, currentRoute.destA)) {
        if(typeof renderAtDestination === 'function') renderAtDestination(pretoriaTimeEl);
    } else {
        const schedule = (currentDayType === 'weekday') ? schedules.weekday_to_a : schedules.saturday_to_a;
        const currentSheetKey = (currentDayType === 'weekday') ? currentRoute.sheetKeys.weekday_to_a : currentRoute.sheetKeys.saturday_to_a;
        const { allJourneys: currentJourneys } = findNextJourneyToDestA(selectedStation, "00:00:00", schedule, currentRoute, currentDayIndex);
        
        let mergedJourneys = currentJourneys.map(j => ({...j, sourceRoute: currentRoute.name, sheetKey: currentSheetKey}));
        const seenTrainsA = new Set(mergedJourneys.map(j => j.train || j.train1.train));
        const targetStationsA = getTargetStations(schedule, selectedStation);

        sharedRoutes.forEach(rId => {
            const otherRoute = ROUTES[rId];
            if (normalizeStationName(otherRoute.destA) === normalizeStationName(currentRoute.destA)) {
                const key = (currentDayType === 'weekday') ? otherRoute.sheetKeys.weekday_to_a : otherRoute.sheetKeys.saturday_to_a;
                const otherRows = fullDatabase[key];
                const otherMeta = fullDatabase[key + "_meta"];
                const otherSchedule = parseJSONSchedule(otherRows, otherMeta);
                const { allJourneys: otherJourneys } = findNextJourneyToDestA(selectedStation, "00:00:00", otherSchedule, otherRoute, currentDayIndex);
                
                const uniqueOther = otherJourneys.filter(j => {
                    const tNum = j.train || j.train1.train;
                    return hasForwardOverlap(tNum, otherSchedule, selectedStation, targetStationsA);
                });

                const tagged = uniqueOther.map(j => ({
                    ...j, 
                    sourceRoute: otherRoute.name, 
                    isShared: true, 
                    isDivergent: false,
                    sheetKey: key
                }));
                
                tagged.forEach(sharedJ => {
                    const tNum = sharedJ.train || sharedJ.train1.train;
                    // GUARDIAN BUGFIX: Safely replace native train with rich shared train without dynamic filter collision
                    mergedJourneys = mergedJourneys.filter(mj => (mj.train || mj.train1.train) !== tNum);
                    seenTrainsA.add(tNum);
                    mergedJourneys.push(sharedJ);
                });
            }
        });
        
        mergedJourneys.sort((a, b) => {
             const timeA = timeToSeconds(a.departureTime || a.train1.departureTime);
             const timeB = timeToSeconds(b.departureTime || b.train1.departureTime);
             return timeA - timeB;
        });

        const nowInSeconds = timeToSeconds(currentTime);
        const upcoming = mergedJourneys.find(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= nowInSeconds);
        if (upcoming) {
             if(typeof updateFareDisplay === 'function') updateFareDisplay(currentSheetKey, upcoming.departureTime || upcoming.train1.departureTime);
        } else {
             if(typeof updateFareDisplay === 'function') updateFareDisplay(primarySheetKey, currentTime);
        }

        if(typeof processAndRenderJourney === 'function') processAndRenderJourney(mergedJourneys, pretoriaTimeEl, pretoriaHeader, currentRoute.destA);
    }

    // --- DESTINATION B ---
    if (isAtStation(selectedStation, currentRoute.destB)) {
        if(typeof renderAtDestination === 'function') renderAtDestination(pienaarspoortTimeEl);
    } else {
        const schedule = (currentDayType === 'weekday') ? schedules.weekday_to_b : schedules.saturday_to_b;
        const currentSheetKey = (currentDayType === 'weekday') ? currentRoute.sheetKeys.weekday_to_b : currentRoute.sheetKeys.saturday_to_b;
        const { allJourneys: currentJourneys } = findNextJourneyToDestB(selectedStation, "00:00:00", schedule, currentRoute, currentDayIndex);

        let mergedJourneys = currentJourneys.map(j => ({...j, sourceRoute: currentRoute.name, sheetKey: currentSheetKey}));
        const seenTrainsB = new Set(mergedJourneys.map(j => j.train || j.train1.train));
        const targetStationsB = getTargetStations(schedule, selectedStation);

        sharedRoutes.forEach(rId => {
            const otherRoute = ROUTES[rId];
            
                 const key = (currentDayType === 'weekday') ? otherRoute.sheetKeys.weekday_to_b : otherRoute.sheetKeys.saturday_to_b;
                 const otherRows = fullDatabase[key];
                 const otherMeta = fullDatabase[key + "_meta"];
                 const otherSchedule = parseJSONSchedule(otherRows, otherMeta);
                 const { allJourneys: otherJourneys } = findNextJourneyToDestB(selectedStation, "00:00:00", otherSchedule, otherRoute, currentDayIndex);
                 
                 const uniqueOther = otherJourneys.filter(j => {
                     const tNum = j.train || j.train1.train;
                     return hasForwardOverlap(tNum, otherSchedule, selectedStation, targetStationsB);
                 });
 
                 const isDivergent = normalizeStationName(otherRoute.destB) !== normalizeStationName(currentRoute.destB);
                 
                 const tagged = uniqueOther.map(j => ({
                     ...j, 
                     sourceRoute: otherRoute.name, 
                     isShared: true,
                     isDivergent: isDivergent, 
                     actualDestName: otherRoute.destB.replace(' STATION', ''),
                     sheetKey: key
                 }));
                 
                 tagged.forEach(sharedJ => {
                     const tNum = sharedJ.train || sharedJ.train1.train;
                     // GUARDIAN BUGFIX: Safely replace native train with rich shared train without dynamic filter collision
                     mergedJourneys = mergedJourneys.filter(mj => (mj.train || mj.train1.train) !== tNum);
                     seenTrainsB.add(tNum);
                     mergedJourneys.push(sharedJ);
                 });
        });

        mergedJourneys.sort((a, b) => {
             const timeA = timeToSeconds(a.departureTime || a.train1.departureTime);
             const timeB = timeToSeconds(b.departureTime || b.train1.departureTime);
             return timeA - timeB;
        });

        if(typeof processAndRenderJourney === 'function') processAndRenderJourney(mergedJourneys, pienaarspoortTimeEl, pienaarspoortHeader, currentRoute.destB);
    }
}

function findNextJourneyToDestA(fromStation, timeNow, schedule, routeConfig, targetDayIdx = currentDayIndex) {
    const { allJourneys: allDirectJourneys } = findNextDirectTrain(fromStation, schedule, routeConfig.destA, targetDayIdx, routeConfig.id);
    let allTransferJourneys = [];
    
    const transferHub = routeConfig.transferStation || routeConfig.relayStation;
    if (transferHub) {
        const { allJourneys: allTransfers } = findTransfers(fromStation, schedule, transferHub, routeConfig.destA, targetDayIdx, routeConfig.id);
        allTransferJourneys = allTransfers;
    }
    
    const transferTrainNames = new Set(allTransferJourneys.map(j => j.train1.train));
    const uniqueDirects = allDirectJourneys.filter(j => !transferTrainNames.has(j.train));
    
    const allJourneys = [...uniqueDirects, ...allTransferJourneys];
    
    allJourneys.sort((a, b) => {
        const timeA = timeToSeconds(a.departureTime || a.train1.departureTime);
        const timeB = timeToSeconds(b.departureTime || b.train1.departureTime);
        if (timeA !== timeB) return timeA - timeB; 
        if (a.type === 'transfer' && b.type === 'direct') return -1;
        if (a.type === 'direct' && b.type === 'transfer') return 1;
        return 0;
    });
    return { allJourneys };
}

function findNextJourneyToDestB(fromStation, timeNow, schedule, routeConfig, targetDayIdx = currentDayIndex) {
    const { allJourneys: allDirectJourneys } = findNextDirectTrain(fromStation, schedule, routeConfig.destB, targetDayIdx, routeConfig.id);
    let allTransferJourneys = [];
    
    const transferHub = routeConfig.transferStation || routeConfig.relayStation;
    if (transferHub) {
        const { allJourneys: allTransfers } = findTransfers(fromStation, schedule, transferHub, routeConfig.destB, targetDayIdx, routeConfig.id);
        allTransferJourneys = allTransfers;
    }

    const transferTrainNames = new Set(allTransferJourneys.map(j => j.train1.train));
    const uniqueDirects = allDirectJourneys.filter(j => !transferTrainNames.has(j.train));
    
    const allJourneys = [...uniqueDirects, ...allTransferJourneys];
    
    allJourneys.sort((a, b) => {
        const timeA = timeToSeconds(a.departureTime || a.train1.departureTime);
        const timeB = timeToSeconds(b.departureTime || b.train1.departureTime);
        if (timeA !== timeB) return timeA - timeB; 
        if (a.type === 'transfer' && b.type === 'direct') return -1;
        if (a.type === 'direct' && b.type === 'transfer') return 1;
        return 0; 
    });
    return { allJourneys };
}

function findNextDirectTrain(fromStation, schedule, destinationStation, targetDayIdx = currentDayIndex, routeId = currentRouteId) {
    if (!schedule || !schedule.rows || schedule.rows.length === 0) return { allJourneys: [] };
    const stationCol = schedule.stationColumnName;
    const trainHeaders = schedule.headers.slice(1);
    let allJourneys = [];

    const cleanTargetStation = normalizeStationName(fromStation);

    for (const train of trainHeaders) {
        if (!train || train === "") continue;
        if (isTrainExcluded(train, routeId, targetDayIdx)) continue; 

        const fromRow = schedule.rows.find(row => {
            const val = row[stationCol];
            return val && normalizeStationName(val) === cleanTargetStation;
        });

        const departureTime = fromRow ? fromRow[train] : null;

        // GUARDIAN BUGFIX: Ignore cells that contain generic dashes indicating no stop
        if (!departureTime || departureTime.trim() === "-" || departureTime.trim() === "") continue;

        let actualLastStop = null;
        let actualArrivalTime = null;
        let destRow = null; 
        
        for (let i = schedule.rows.length - 1; i >= 0; i--) {
            const time = schedule.rows[i][train];
            if (time && time.trim() !== "-" && time.trim() !== "") {
                actualLastStop = schedule.rows[i][stationCol];
                actualArrivalTime = time;
                destRow = schedule.rows[i]; 
                break; 
            }
        }
        
        if (fromRow && destRow) {
            const fromIndex = schedule.rows.indexOf(fromRow);
            const destIndex = schedule.rows.indexOf(destRow);
            if (fromIndex < destIndex) { 
                allJourneys.push({
                    type: 'direct',
                    train: train,
                    departureTime: departureTime,
                    arrivalTime: actualArrivalTime,
                    actualDestination: actualLastStop,
                });
            }
        }
    }
    allJourneys.sort((a, b) => timeToSeconds(a.departureTime) - timeToSeconds(b.departureTime));
    return { allJourneys };
}

function findTransfers(fromStation, schedule, terminalStation, finalDestination, targetDayIdx = currentDayIndex, routeId = currentRouteId) {
    if (!schedule || !schedule.rows || schedule.rows.length === 0) return { allJourneys: [] };
    const stationCol = schedule.stationColumnName;
    const trainHeaders = schedule.headers.slice(1);
    let allJourneys = [];
    const findRowFuzzy = (name) => schedule.rows.find(row => normalizeStationName(row[stationCol]) === normalizeStationName(name));
    
    const fromRow = findRowFuzzy(fromStation);
    const termRow = findRowFuzzy(terminalStation); 
    if (!fromRow || !termRow) return { allJourneys: [] };
    
    const fromIndex = schedule.rows.indexOf(fromRow); 
    const termIndex = schedule.rows.indexOf(termRow);
    if (fromIndex >= termIndex) return { allJourneys: [] }; 

    for (const train1 of trainHeaders) {
        if (!train1 || train1 === "") continue;
        if (isTrainExcluded(train1, routeId, targetDayIdx)) continue; 

        const departureTime = fromRow[train1]; 
        const terminationTime = termRow[train1];
        if (!departureTime || !terminationTime || departureTime.trim() === "-" || terminationTime.trim() === "-") continue;
        
        const finalDestRow = findRowFuzzy(finalDestination);
        const destinationTime = finalDestRow ? finalDestRow[train1] : null;

        if (!destinationTime || destinationTime.trim() === "-") {
            const connectionData = findConnections(terminationTime, schedule, terminalStation, finalDestination, train1, targetDayIdx, routeId);
            if (connectionData && connectionData.earliest) {
                let realHeadboardDest = terminalStation;
                for (let k = termIndex + 1; k < schedule.rows.length; k++) {
                    const nextRow = schedule.rows[k];
                    if (nextRow[train1] && nextRow[train1] !== '-' && nextRow[train1].trim() !== '') {
                        realHeadboardDest = nextRow[stationCol];
                    }
                }

                allJourneys.push({ 
                    type: 'transfer', 
                    train1: { 
                        train: train1, 
                        departureTime: departureTime, 
                        arrivalAtTransfer: terminationTime, 
                        terminationStation: terminalStation,
                        headboardDestination: realHeadboardDest
                    }, 
                    connection: connectionData.earliest, 
                    nextFullJourney: connectionData.fullJourney 
                });
            }
        }
    }
    return { allJourneys };
}

function findConnections(arrivalTimeAtTransfer, schedule, connectionStation, finalDestination, incomingTrainName, targetDayIdx = currentDayIndex, routeId = currentRouteId) {
    if (!schedule || !schedule.rows) return null;
    const stationCol = schedule.stationColumnName;
    const trainHeaders = schedule.headers.slice(1);
    let possibleConnections = [];
    
    const findRowFuzzy = (name) => schedule.rows.find(row => normalizeStationName(row[stationCol]) === normalizeStationName(name));
    const connRow = findRowFuzzy(connectionStation);
    if (!connRow) return null;
    const connIndex = schedule.rows.indexOf(connRow);
    const arrivalSeconds = timeToSeconds(arrivalTimeAtTransfer);

    for (const train of trainHeaders) {
        if (!train || train === "") continue;
        if (train === incomingTrainName) continue; 
        if (isTrainExcluded(train, routeId, targetDayIdx)) continue; 

        const connectionTime = connRow[train];
        if (!connectionTime || connectionTime.trim() === "-" || connectionTime.trim() === "") continue;
        if (timeToSeconds(connectionTime) < arrivalSeconds) continue;

        let goesFurther = false;
        let actualLastStop = connectionStation;
        let actualArrivalTime = connectionTime;
        
        for (let i = connIndex + 1; i < schedule.rows.length; i++) {
            const time = schedule.rows[i][train];
            if (time && time.trim() !== "-" && time.trim() !== "") { 
                goesFurther = true;
                actualLastStop = schedule.rows[i][stationCol]; 
                actualArrivalTime = time; 
            }
        }

        if (goesFurther) {
            possibleConnections.push({ 
                train: train, 
                departureTime: connectionTime, 
                arrivalTime: actualArrivalTime, 
                actualDestination: actualLastStop, 
                connectionStation: connectionStation 
            });
        }
    }
    
    if (possibleConnections.length === 0) return null; 
    possibleConnections.sort((a, b) => timeToSeconds(a.departureTime) - timeToSeconds(b.departureTime));
    const earliestConnection = possibleConnections[0];
    let earliestFullJourneyConnection = null;
    if (normalizeStationName(earliestConnection.actualDestination) !== normalizeStationName(finalDestination)) {
        earliestFullJourneyConnection = possibleConnections.find(conn => normalizeStationName(conn.actualDestination) === normalizeStationName(finalDestination)) || null; 
    }
    return { earliest: earliestConnection, fullJourney: earliestFullJourneyConnection };
}

// --- GUARDIAN V6.21: THE GREAT DECOUPLING - STATION LOGIC MOVED HERE ---

function findNearestStation(isAuto = false) {
    if (!navigator.geolocation) {
        if (!isAuto) showToast("Geolocation is not supported by your browser.", "error");
        if (!isAuto) stationSelect.value = "";
        return;
    }
    
    if (!isAuto) {
        showToast("Locating nearest station...", "info", 4000);
        const icon = locateBtn.querySelector('svg');
        if(icon) icon.classList.add('spinning');
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            
            let candidates = [];
            for (const [stationName, coords] of Object.entries(globalStationIndex)) {
                if (coords.routes.has(currentRouteId)) {
                    const dist = getDistanceFromLatLonInKm(userLat, userLon, coords.lat, coords.lon);
                    candidates.push({ stationName, dist });
                }
            }
            
            candidates.sort((a, b) => a.dist - b.dist);

            if (candidates.length === 0) {
                 if(!isAuto) showToast("No stations on this route found in database.", "error");
                 return;
            }

            const nearest = candidates[0];
            
            if (nearest.dist <= MAX_RADIUS_KM) {
                const stationName = nearest.stationName;
                const distStr = nearest.dist.toFixed(1);

                let matched = false;
                const options = stationSelect.options;
                
                for (let i = 0; i < options.length; i++) {
                    if (normalizeStationName(options[i].value) === normalizeStationName(stationName)) {
                        stationSelect.selectedIndex = i;
                        stationSelect.value = options[i].value; 
                        matched = true;
                        break;
                    }
                }

                if (matched) {
                    if (typeof syncPlannerFromMain === 'function') {
                        syncPlannerFromMain(stationSelect.value);
                    }
                    
                    // GUARDIAN V6.21: Unified Dataset Sync logic absorbed from UI
                    const searchInput = document.getElementById('station-search-input');
                    if (searchInput) {
                        searchInput.value = stationSelect.value.replace(/ STATION/g, '');
                        searchInput.dataset.resolvedValue = stationSelect.value;
                    }
                    
                    findNextTrains(); 
                    if (!isAuto) {
                        showToast(`Found: ${stationName.replace(' STATION', '')} (${distStr}km)`, "success");
                    }

                    // GUARDIAN PHASE 1 (ANALYTICS): Inject 'auto_locate_success' event tracking
                    if (typeof trackAnalyticsEvent === 'function') {
                        trackAnalyticsEvent('auto_locate_success', {
                            station: stationName.replace(' STATION', ''),
                            route_id: currentRouteId,
                            distance_km: parseFloat(distStr),
                            is_background_check: isAuto
                        });
                    }
                    
                } else {
                     if (!isAuto) showToast("Station found nearby, but not available in dropdown.", "error");
                }
            } else {
                if (!isAuto) showToast(`No stations on this route within ${MAX_RADIUS_KM}km.`, "error");
            }
            
            if (!isAuto) {
                const icon = locateBtn.querySelector('svg');
                if(icon) icon.classList.remove('spinning');
            }
        },
        (error) => {
            if (!isAuto) {
                let msg = "Unable to retrieve location.";
                if (error.code === 1) msg = "Location permission denied.";
                showToast(msg, "error");
                stationSelect.value = "";
                const icon = locateBtn.querySelector('svg');
                if(icon) icon.classList.remove('spinning');
            }
        }
    );
}

function populateStationList() {
    const stationSet = new Set();
    const hasTimes = (row) => { const keys = Object.keys(row); return keys.some(key => key !== 'STATION' && key !== 'COORDINATES' && key !== 'KM_MARK' && row[key] && row[key].trim() !== ""); };
    
    if (schedules.weekday_to_a && schedules.weekday_to_a.rows) schedules.weekday_to_a.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.weekday_to_b && schedules.weekday_to_b.rows) schedules.weekday_to_b.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.saturday_to_a && schedules.saturday_to_a.rows) schedules.saturday_to_a.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.saturday_to_b && schedules.saturday_to_b.rows) schedules.saturday_to_b.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });

    allStations = Array.from(stationSet);
    
    // GUARDIAN UX FIX: Sort by outbound (weekday_to_b) so Hubs (Dest A) appear naturally at the top
    if (schedules.weekday_to_b && schedules.weekday_to_b.rows) { 
        const orderMap = schedules.weekday_to_b.rows.map(r => r.STATION); 
        allStations.sort((a, b) => orderMap.indexOf(a) - orderMap.indexOf(b)); 
    } else if (schedules.weekday_to_a && schedules.weekday_to_a.rows) {
        // Safe fallback: If B is missing, sort by A but in reverse to maintain the Hub-Top flow
        const orderMap = schedules.weekday_to_a.rows.map(r => r.STATION); 
        allStations.sort((a, b) => orderMap.indexOf(b) - orderMap.indexOf(a));
    }
    
    const currentSelectedStation = stationSelect.value;
    
    stationSelect.innerHTML = '<option value="">Select a station...</option>';
    stationSelect.disabled = false; // GUARDIAN V6.1: Ensure enabled on populate
    
    allStations.forEach(station => {
        if (station && !station.toLowerCase().includes('last updated')) {
            const option = document.createElement('option');
            option.value = station;
            option.textContent = station.replace(/ STATION/g, '');
            stationSelect.appendChild(option);
        }
    });

    // GUARDIAN V6.21: Unified Dataset Sync logic absorbed from UI
    const searchInput = document.getElementById('station-search-input');
    if (allStations.includes(currentSelectedStation)) {
        stationSelect.value = currentSelectedStation; 
        if (searchInput) {
            searchInput.value = currentSelectedStation.replace(/ STATION/g, '');
            searchInput.dataset.resolvedValue = currentSelectedStation;
        }
    } else { 
        stationSelect.value = ""; 
        if (searchInput) {
            searchInput.value = "";
            delete searchInput.dataset.resolvedValue;
        }
    }
}

// GUARDIAN V6.1: Helper added to strictly handle Coming Soon visual state without bleeding into logic
function renderComingSoon(routeName) {
    if (typeof Renderer !== 'undefined') {
        if(pretoriaTimeEl) Renderer.renderComingSoon(pretoriaTimeEl, routeName);
    }
    if(stationSelect) {
        stationSelect.innerHTML = '<option>Coming Soon</option>';
        stationSelect.disabled = true;
    }
}

// GUARDIAN V6.1: Formatter applied here as final fallback
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
    
    if (displayDate && lastUpdatedEl) lastUpdatedEl.textContent = `Schedule effective from: ${displayDate}`;
}

// Update the global clock
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
            // Manual padding inside updateTime since pad() was historically used here
            const p = n => (n < 10 ? '0' + n : n);
            timeString = p(now.getHours()) + ":" + p(now.getMinutes()) + ":" + p(now.getSeconds());
            dateToCheck = now;
        }
        currentTime = timeString; 
        if(currentTimeEl) currentTimeEl.textContent = `Current Time: ${timeString} ${simActive ? '(SIM)' : ''}`;
        
        let newDayType = (day === 0) ? 'sunday' : (day === 6 ? 'saturday' : 'weekday');
        let specialStatusText = "";
        
        if (dateToCheck) {
            var m = String(dateToCheck.getMonth() + 1).padStart(2, '0');
            var d = String(dateToCheck.getDate()).padStart(2, '0');
            var dateKey = m + "-" + d;
            if (SPECIAL_DATES[dateKey]) { 
                newDayType = SPECIAL_DATES[dateKey]; 
                specialStatusText = (typeof HOLIDAY_NAMES !== 'undefined' && HOLIDAY_NAMES[dateKey]) ? " (Holiday)" : " (Holiday Schedule)"; 
            }
        }
        
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        if (newDayType !== currentDayType) { 
            currentDayType = newDayType; 
            currentDayIndex = day; 
            updateLastUpdatedText(); 
        } else { 
            currentDayIndex = day; 
        }
        
        let displayType = "";
        if (newDayType === 'sunday') displayType = "No Service";
        else if (newDayType === 'saturday') displayType = "Saturday Schedule";
        else displayType = "Weekday Schedule";
        
        if (dateToCheck) {
            var m = String(dateToCheck.getMonth() + 1).padStart(2, '0');
            var d = String(dateToCheck.getDate()).padStart(2, '0');
            var dateKey = m + "-" + d;
            if (typeof HOLIDAY_NAMES !== 'undefined' && HOLIDAY_NAMES[dateKey]) { 
                displayType = `${HOLIDAY_NAMES[dateKey]} Schedule`; 
                specialStatusText = ""; 
            }
        }
        
        if(currentDayEl) currentDayEl.innerHTML = `${dayNames[day]} <span class="font-bold text-blue-600 dark:text-blue-400 ml-1">${displayType}</span>`;
        
        const plannerDaySelect = document.getElementById('planner-day-select');
        // GUARDIAN BUGFIX: Cleaned syntax error for dynamic Holiday Sync
        if (plannerDaySelect && (typeof selectedPlannerDay === 'undefined' || !selectedPlannerDay)) { 
            // We NO LONGER explicitly set plannerDaySelect.value directly because it has been converted to a custom dropdown
            // handled in planner-ui.js natively. The fallback remains active purely for logic states.
            selectedPlannerDay = currentDayType; 
        }
        
        // GUARDIAN PERFORMANCE PATCH: The Battery Torch Loop Fix
        // Extract current minute safely
        let currentMinute = -1;
        if (dateToCheck) {
            currentMinute = dateToCheck.getMinutes();
        } else {
            const parts = timeString.split(':');
            if (parts.length > 1) currentMinute = parseInt(parts[1], 10);
        }

        // Throttle the heavy UI/DOM recalculation to only run once per minute,
        // UNLESS the user is actively tinkering with the Dev Sim Mode (which requires instant feedback).
        if (lastRenderedMinute !== currentMinute || simActive) {
            lastRenderedMinute = currentMinute;
            if (typeof findNextTrains === 'function') findNextTrains();
        }

    } catch(e) { console.error("Error in updateTime", e); }
}

// Attach startClock to logic to ensure updateTime is bound properly.
// This replaces the inline call in ui.js to keep time logic centralized.
window.startClock = function() { 
    updateTime(); 
    setInterval(updateTime, 1000); 
}

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