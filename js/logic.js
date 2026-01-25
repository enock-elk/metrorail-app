// --- GLOBAL STATE VARIABLES ---
// Defined here to be shared across scripts
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

// --- SIMULATION STATE ---
let clickCount = 0;
let clickTimer = null;
let isSimMode = false;
let simTimeStr = "";
let simDayIndex = 1;
let toastTimeout;

// --- HELPERS (Removed: Moved to utils.js) ---

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
    // Collect all stations AFTER the current station in the schedule's order
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

    // Check stops strictly AFTER the current station
    for (let i = fromIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        // If the train has a time for this station AND this station is in our target path
        if (row[trainName] && targetStations.has(normalizeStationName(row.STATION))) {
            return true;
        }
    }
    return false;
}

function saveToLocalCache(key, data) { try { const cacheEntry = { timestamp: Date.now(), data: data }; localStorage.setItem(key, JSON.stringify(cacheEntry)); } catch (e) {} }
function loadFromLocalCache(key) { try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : null; } catch (e) { return null; } }

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

// --- DATA FETCHING & PROCESSING ---
async function loadAllSchedules(force = false) {
    try {
        if (!currentRouteId) return; 
        const currentRoute = ROUTES[currentRouteId];
        if (!currentRoute) return;
        
        // UI Updates (handled here for flow, but using global refs)
        if(routeSubtitleText) {
            routeSubtitleText.textContent = currentRoute.name;
            routeSubtitleText.className = `text-lg font-medium ${currentRoute.colorClass} group-hover:opacity-80 transition-colors`;
        }
        
        if(pretoriaHeader) pretoriaHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destA.replace(' STATION', '')}</span>`;
        if(pienaarspoortHeader) pienaarspoortHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destB.replace(' STATION', '')}</span>`;
        
        // --- SKELETON LOADER INJECTION ---
        if (typeof renderSkeletonLoader === 'function') {
            if(pretoriaTimeEl) renderSkeletonLoader(pretoriaTimeEl);
            if(pienaarspoortTimeEl) renderSkeletonLoader(pienaarspoortTimeEl);
        }

        if(offlineIndicator) offlineIndicator.style.display = 'none';
        if (typeof updatePinUI === 'function') updatePinUI(); 

        if (!currentRoute.isActive) {
            if (typeof renderComingSoon === 'function') renderComingSoon(currentRoute.name);
            if(mainContent) mainContent.style.display = 'block';
            if(loadingOverlay) loadingOverlay.style.display = 'none';
        }
        
        const cachedDB = loadFromLocalCache('full_db');
        let usedCache = false;

        if (cachedDB) {
            console.log("Restoring from cache...");
            fullDatabase = cachedDB.data;
            processRouteDataFromDB(currentRoute);
            buildGlobalStationIndex(); 
            buildMasterStationList(); 
            updateLastUpdatedText();
            // Call UI init
            if (typeof initializeApp === 'function') initializeApp();
            usedCache = true;
        }
        
        if(forceReloadBtn) {
            const reloadIcon = forceReloadBtn.querySelector('svg');
            if(reloadIcon) reloadIcon.classList.add('spinning');
            forceReloadBtn.disabled = true;
        }

        const response = await fetch(DATABASE_URL);
        if (!response.ok) throw new Error("Firebase fetch failed");
        const newDatabase = await response.json();
        if (!newDatabase) throw new Error("Empty database");

        const newStr = JSON.stringify(newDatabase);
        const oldStr = cachedDB ? JSON.stringify(cachedDB.data) : "";

        if (newStr !== oldStr) {
            console.log("New data! Updating...");
            fullDatabase = newDatabase;
            saveToLocalCache('full_db', fullDatabase);
            
            processRouteDataFromDB(currentRoute);
            buildGlobalStationIndex(); 
            buildMasterStationList(); 
            updateLastUpdatedText();
            
            if (usedCache) { 
                if(typeof showToast === 'function') showToast("Schedule updated!", "success", 3000); 
                findNextTrains(); 
            } else { 
                if(typeof initializeApp === 'function') initializeApp(); 
            }
        } else {
            console.log("Data is up to date.");
            if (!usedCache) {
                 if(typeof initializeApp === 'function') initializeApp();
            }
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        if (loadFromLocalCache('full_db')) {
            if(offlineIndicator) offlineIndicator.style.display = 'block';
        } else {
            if (typeof renderRouteError === 'function') renderRouteError(error);
        }
    } finally {
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

function processRouteDataFromDB(route) {
    if (!fullDatabase) return;
    const getSched = (key) => {
        const rows = fullDatabase[key];
        const metaKey = key + "_meta"; 
        const metaDate = fullDatabase[metaKey]; 
        return parseJSONSchedule(rows, metaDate); 
    };

    schedules = {
        weekday_to_a: getSched(route.sheetKeys.weekday_to_a),
        weekday_to_b: getSched(route.sheetKeys.weekday_to_b),
        saturday_to_a: getSched(route.sheetKeys.saturday_to_a),
        saturday_to_b: getSched(route.sheetKeys.saturday_to_b)
    };
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
                    extractedLastUpdated = val.replace(/last updated[:\s-]*/i, '').trim();
                } else if (values[dateValueIndex+1]) {
                    extractedLastUpdated = values[dateValueIndex+1];
                }
            }
        }

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

function buildGlobalStationIndex() {
    globalStationIndex = {}; 
    if (!fullDatabase) return;

    // GUARDIAN HELPER: Filter out ghost stations (rows with no time data)
    // Returns true if at least one column (other than metadata) has a value
    const hasActiveService = (row, sKey, cKey) => {
        const ignored = new Set([sKey, cKey, 'KM_MARK', 'row_index']);
        return Object.keys(row).some(k => !ignored.has(k) && row[k] && String(row[k]).trim() !== "");
    };

    Object.values(ROUTES).forEach(route => {
        if (!route.sheetKeys) return;

        Object.values(route.sheetKeys).forEach(dbKey => {
            const sheetData = fullDatabase[dbKey];
            if (!sheetData || !Array.isArray(sheetData)) return;
            
            let headerIndex = -1;
            for (let i = 0; i < Math.min(sheetData.length, 5); i++) {
                 if (Object.values(sheetData[i]).some(val => val && String(val).toUpperCase().includes('STATION'))) {
                     headerIndex = i;
                     break;
                 }
            }
            
            if (headerIndex > -1) {
                 for (let i = headerIndex + 1; i < sheetData.length; i++) {
                      const row = sheetData[i];
                      const headerRow = sheetData[headerIndex];
                      let stationKey = null;
                      let coordKey = null;
                      
                      Object.keys(headerRow).forEach(key => {
                          const valUpper = String(headerRow[key]).toUpperCase();
                          if (valUpper.includes('STATION')) stationKey = key;
                          if (valUpper.includes('COORDINATES')) coordKey = key;
                      });

                      if (!stationKey && row['STATION']) stationKey = 'STATION';
                      if (!coordKey && row['COORDINATES']) coordKey = 'COORDINATES';

                      if (stationKey && row[stationKey]) {
                           // GHOST FILTER: Skip if no active service at this station
                           if (!hasActiveService(row, stationKey, coordKey)) continue;

                           const stationName = normalizeStationName(row[stationKey]);
                           const coordVal = coordKey ? row[coordKey] : null;
                           
                           if (!globalStationIndex[stationName]) {
                               try {
                                   let coords = { lat: null, lon: null };
                                   if (coordVal) {
                                       const parts = String(coordVal).split(',').map(s => parseFloat(s.trim()));
                                       if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                            coords = { lat: parts[0], lon: parts[1] };
                                       }
                                   }
                                   globalStationIndex[stationName] = { 
                                       lat: coords.lat, 
                                       lon: coords.lon, 
                                       routes: new Set()
                                    };
                               } catch (e) { }
                           }
                           if (globalStationIndex[stationName]) globalStationIndex[stationName].routes.add(route.id);
                      }
                 }
            } else {
                 sheetData.forEach(row => {
                    if (row.STATION && row.COORDINATES) {
                        // GHOST FILTER: Fallback branch
                        if (!hasActiveService(row, 'STATION', 'COORDINATES')) return; // forEach uses return to skip

                        const stationName = normalizeStationName(row.STATION);
                        if (!globalStationIndex[stationName]) {
                            try {
                                const parts = String(row.COORDINATES).split(',').map(s => parseFloat(s.trim()));
                                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                    globalStationIndex[stationName] = { lat: parts[0], lon: parts[1], routes: new Set() };
                                }
                            } catch (e) { }
                        }
                        if (globalStationIndex[stationName]) globalStationIndex[stationName].routes.add(route.id);
                    }
                });
            }
        });
    });
    console.log(`Global Index Built: ${Object.keys(globalStationIndex).length} stations mapped.`);
}

function buildMasterStationList() {
    MASTER_STATION_LIST = Object.keys(globalStationIndex).sort();
    console.log(`Master Station List Built: ${MASTER_STATION_LIST.length} stations.`);
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
        if (diffInSeconds < 60) return "(Arriving now)";
        let diffInMinutes = Math.ceil(diffInSeconds / 60);
        const hours = Math.floor(diffInMinutes / 60);
        const minutes = diffInMinutes % 60;
        return (hours > 0) ? `(in ${hours}h ${minutes}m)` : `(in ${minutes}m)`;
    } catch (e) { return ""; }
}

// GUARDIAN UPDATE V4.60.17: Pricing based on CURRENT TIME, not Departure Time.
function getRouteFare(sheetKey, departureTimeStr) {
    const zoneKey = sheetKey + "_zone";
    let zoneCode = fullDatabase[zoneKey]; 
    if (!zoneCode) {
        console.warn(`No zone found for ${zoneKey}, defaulting to Z1 for testing.`);
        zoneCode = "Z1";
    }

    if (!zoneCode || !FARE_CONFIG.zones[zoneCode]) return null;

    let basePrice = FARE_CONFIG.zones[zoneCode];
    let discountLabel = null;
    let isPromo = false; 
    let isOffPeak = false;

    const profile = FARE_CONFIG.profiles[currentUserProfile] || FARE_CONFIG.profiles["Adult"];
    
    let useOffPeakRate = false;
    
    // UPDATED LOGIC: Check 'currentTime' instead of 'departureTimeStr'
    // This allows "Buy Now" pricing display.
    if (currentDayType === 'weekday' && currentTime) {
        try {
            const [nowH, nowM] = currentTime.split(':').map(Number);
            const decimalNow = nowH + (nowM / 60);
            
            if (decimalNow >= FARE_CONFIG.offPeakStart && decimalNow < FARE_CONFIG.offPeakEnd) {
                useOffPeakRate = true;
            }
        } catch (e) { 
            console.error("Time Parse Error in Fare:", e);
        }
    }

    const multiplier = useOffPeakRate ? profile.offPeak : profile.base;

    // Apply Multiplier
    let finalPrice = basePrice * multiplier;

    // GUARDIAN FIX V4.58.3: Rounding to Nearest 50 cents
    finalPrice = Math.ceil(finalPrice * 2) / 2;

    // Determine Label
    if (multiplier < 1.0) {
        isPromo = true; // Trigger color change
        if (currentUserProfile === "Pensioner") {
            discountLabel = "50% Off-Peak";
        } else if (currentUserProfile === "Military") {
            discountLabel = "50% Off-Peak";
        } else if (currentUserProfile === "Scholar") {
            discountLabel = "50% Discount";
        } else if (currentUserProfile === "Adult" && useOffPeakRate) {
            discountLabel = "40% Off-Peak";
        } else {
            discountLabel = "Discounted"; // Fallback
        }
    }

    return {
        price: finalPrice.toFixed(2),
        isOffPeak: useOffPeakRate,
        isPromo: isPromo,
        discountLabel: discountLabel
    };
}

// --- JOURNEY FINDING LOGIC ---

function findNextTrains() {
    if(!currentRouteId) return;

    const selectedStation = stationSelect.value;
    const currentRoute = ROUTES[currentRouteId];
    
    // Helper must be defined BEFORE use
    const isAtStation = (s1, s2) => normalizeStationName(s1) === normalizeStationName(s2);

    if (selectedStation === "FIND_NEAREST") { findNearestStation(false); return; }
    if (!currentRoute) return;
    if (!currentRoute.isActive) { if(typeof renderComingSoon === 'function') renderComingSoon(currentRoute.name); return; }
    
    pretoriaTimeEl.innerHTML = ""; pienaarspoortTimeEl.innerHTML = "";
    pretoriaHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destA.replace(' STATION', '')}</span>`;
    pienaarspoortHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destB.replace(' STATION', '')}</span>`;
    
    if (!selectedStation) { if(typeof renderPlaceholder === 'function') renderPlaceholder(); return; }
    
    if (stationSelect.options[stationSelect.selectedIndex] && stationSelect.options[stationSelect.selectedIndex].textContent.includes("(No Service)")) {
        const msg = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No trains stop here.</div>`;
        pretoriaTimeEl.innerHTML = msg; pienaarspoortTimeEl.innerHTML = msg; return;
    }
    
    // GUARDIAN FIX V4.60.11: Specific "No Service" Logic
    // Must handle "You are here" case BEFORE "No Service" case.
    if (currentDayType === 'sunday') {
        if(typeof renderNoService === 'function') {
            
            // Check DEST A
            if (isAtStation(selectedStation, currentRoute.destA)) {
                if(typeof renderAtDestination === 'function') renderAtDestination(pretoriaTimeEl);
            } else {
                renderNoService(pretoriaTimeEl, currentRoute.destA); 
            }

            // Check DEST B
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
        if (r.id !== currentRouteId && r.isActive && r.corridorId === currentRoute.corridorId) {
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
        const { allJourneys: currentJourneys } = findNextJourneyToDestA(selectedStation, "00:00:00", schedule, currentRoute);
        
        let mergedJourneys = currentJourneys.map(j => ({...j, sourceRoute: currentRoute.name, sheetKey: currentSheetKey}));
        const seenTrainsA = new Set(mergedJourneys.map(j => j.train || j.train1.train));

        // V4.39: Get target stations for direction A
        const targetStationsA = getTargetStations(schedule, selectedStation);

        sharedRoutes.forEach(rId => {
            const otherRoute = ROUTES[rId];
            if (normalizeStationName(otherRoute.destA) === normalizeStationName(currentRoute.destA)) {
                const key = (currentDayType === 'weekday') ? otherRoute.sheetKeys.weekday_to_a : otherRoute.sheetKeys.saturday_to_a;
                const otherRows = fullDatabase[key];
                const otherMeta = fullDatabase[key + "_meta"];
                const otherSchedule = parseJSONSchedule(otherRows, otherMeta);
                const { allJourneys: otherJourneys } = findNextJourneyToDestA(selectedStation, "00:00:00", otherSchedule, otherRoute);
                
                // FILTER: Only include if valid overlaps forward (V4.39)
                const uniqueOther = otherJourneys.filter(j => {
                    const tNum = j.train || j.train1.train;
                    if (seenTrainsA.has(tNum)) return false;
                    
                    // FORWARD OVERLAP CHECK
                    if (!hasForwardOverlap(tNum, otherSchedule, selectedStation, targetStationsA)) {
                        return false; 
                    }

                    seenTrainsA.add(tNum); 
                    return true;
                });

                const tagged = uniqueOther.map(j => ({...j, sourceRoute: otherRoute.name, isShared: true, sheetKey: key}));
                mergedJourneys = [...mergedJourneys, ...tagged];
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
             if(typeof updateFareDisplay === 'function') updateFareDisplay(upcoming.sheetKey, upcoming.departureTime || upcoming.train1.departureTime);
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
        const { allJourneys: currentJourneys } = findNextJourneyToDestB(selectedStation, "00:00:00", schedule, currentRoute);

        let mergedJourneys = currentJourneys.map(j => ({...j, sourceRoute: currentRoute.name, sheetKey: currentSheetKey}));
        const seenTrainsB = new Set(mergedJourneys.map(j => j.train || j.train1.train));

        // V4.39: Get target stations for direction B
        const targetStationsB = getTargetStations(schedule, selectedStation);

        sharedRoutes.forEach(rId => {
            const otherRoute = ROUTES[rId];
            
                 const key = (currentDayType === 'weekday') ? otherRoute.sheetKeys.weekday_to_b : otherRoute.sheetKeys.saturday_to_b;
                 const otherRows = fullDatabase[key];
                 const otherMeta = fullDatabase[key + "_meta"];
                 const otherSchedule = parseJSONSchedule(otherRows, otherMeta);
                 const { allJourneys: otherJourneys } = findNextJourneyToDestB(selectedStation, "00:00:00", otherSchedule, otherRoute);
                 
                 const uniqueOther = otherJourneys.filter(j => {
                     const tNum = j.train || j.train1.train;
                     if (seenTrainsB.has(tNum)) return false; 
                     
                     // FORWARD OVERLAP CHECK (V4.39) - SAFETY CRITICAL
                     // This ensures we only show trains that actually go to one of the target stations.
                     if (!hasForwardOverlap(tNum, otherSchedule, selectedStation, targetStationsB)) {
                         return false; 
                     }

                     seenTrainsB.add(tNum); 
                     return true;
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
                 mergedJourneys = [...mergedJourneys, ...tagged];
        });

        mergedJourneys.sort((a, b) => {
             const timeA = timeToSeconds(a.departureTime || a.train1.departureTime);
             const timeB = timeToSeconds(b.departureTime || b.train1.departureTime);
             return timeA - timeB;
        });

        if(typeof processAndRenderJourney === 'function') processAndRenderJourney(mergedJourneys, pienaarspoortTimeEl, pienaarspoortHeader, currentRoute.destB);
    }
}

function findNextJourneyToDestA(fromStation, timeNow, schedule, routeConfig) {
    const { allJourneys: allDirectJourneys } = findNextDirectTrain(fromStation, schedule, routeConfig.destA);
    let allTransferJourneys = [];
    if (routeConfig.transferStation) {
        const { allJourneys: allTransfers } = findTransfers(fromStation, schedule, routeConfig.transferStation, routeConfig.destA);
        allTransferJourneys = allTransfers;
    }
    
    // FIX (V4.38.2): Reverted Deduplication Logic to V3 Standard.
    // If a Transfer exists for a train, it means the Direct option is likely a "Short Train".
    // We must HIDE the Direct option and SHOW the Transfer so the user isn't stranded.
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

function findNextJourneyToDestB(fromStation, timeNow, schedule, routeConfig) {
    const { allJourneys: allDirectJourneys } = findNextDirectTrain(fromStation, schedule, routeConfig.destB);
    let allTransferJourneys = [];
    if (routeConfig.transferStation) {
        const { allJourneys: allTransfers } = findTransfers(fromStation, schedule, routeConfig.transferStation, routeConfig.destB);
        allTransferJourneys = allTransfers;
    }

    // FIX (V4.38.2): Reverted Deduplication Logic to V3 Standard.
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

function findNextDirectTrain(fromStation, schedule, destinationStation) {
    if (!schedule || !schedule.rows || schedule.rows.length === 0) return { allJourneys: [] };
    const stationCol = schedule.stationColumnName;
    const trainHeaders = schedule.headers.slice(1);
    let allJourneys = [];

    for (const train of trainHeaders) {
        if (!train || train === "") continue;
        const fromRow = schedule.rows.find(row => row[stationCol] === fromStation);
        const departureTime = fromRow ? fromRow[train] : null;

        if (!departureTime) continue;
        let actualLastStop = null;
        let actualArrivalTime = null;
        let destRow = null; 
        
        for (let i = schedule.rows.length - 1; i >= 0; i--) {
            const time = schedule.rows[i][train];
            if (time) {
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

function findTransfers(fromStation, schedule, terminalStation, finalDestination) {
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
        const departureTime = fromRow[train1]; 
        const terminationTime = termRow[train1];
        if (!departureTime || !terminationTime) continue;
        
        const finalDestRow = findRowFuzzy(finalDestination);
        const destinationTime = finalDestRow ? finalDestRow[train1] : null;

        if (!destinationTime) {
            const connectionData = findConnections(terminationTime, schedule, terminalStation, finalDestination, train1);
            if (connectionData && connectionData.earliest) {
                allJourneys.push({ 
                    type: 'transfer', 
                    train1: { 
                        train: train1, 
                        departureTime: departureTime, 
                        arrivalAtTransfer: terminationTime, 
                        terminationStation: terminalStation 
                    }, 
                    connection: connectionData.earliest, 
                    nextFullJourney: connectionData.fullJourney 
                });
            }
        }
    }
    return { allJourneys };
}

function findConnections(arrivalTimeAtTransfer, schedule, connectionStation, finalDestination, incomingTrainName) {
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
        
        const connectionTime = connRow[train];
        if (!connectionTime) continue;
        if (timeToSeconds(connectionTime) < arrivalSeconds) continue;

        let goesFurther = false;
        let actualLastStop = connectionStation;
        let actualArrivalTime = connectionTime;
        
        for (let i = connIndex + 1; i < schedule.rows.length; i++) {
            const time = schedule.rows[i][train];
            if (time) { 
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

// --- LOCATION LOGIC ---
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
                    // --- SYNC PLANNER INPUT ---
                    if (typeof syncPlannerFromMain === 'function') {
                        syncPlannerFromMain(stationSelect.value);
                    }
                    findNextTrains(); 
                    if (!isAuto) {
                        showToast(`Found: ${stationName.replace(' STATION', '')} (${distStr}km)`, "success");
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

// --- POPULATE STATION LIST ---
function populateStationList() {
    const stationSet = new Set();
    const hasTimes = (row) => { const keys = Object.keys(row); return keys.some(key => key !== 'STATION' && key !== 'COORDINATES' && key !== 'KM_MARK' && row[key] && row[key].trim() !== ""); };
    
    if (schedules.weekday_to_a && schedules.weekday_to_a.rows) schedules.weekday_to_a.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.weekday_to_b && schedules.weekday_to_b.rows) schedules.weekday_to_b.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.saturday_to_a && schedules.saturday_to_a.rows) schedules.saturday_to_a.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.saturday_to_b && schedules.saturday_to_b.rows) schedules.saturday_to_b.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });

    allStations = Array.from(stationSet);
    if (schedules.weekday_to_a.rows) { const orderMap = schedules.weekday_to_a.rows.map(r => r.STATION); allStations.sort((a, b) => orderMap.indexOf(a) - orderMap.indexOf(b)); }
    
    const currentSelectedStation = stationSelect.value;
    
    stationSelect.innerHTML = '<option value="">Select a station...</option>';
    
    allStations.forEach(station => {
        if (station && !station.toLowerCase().includes('last updated')) {
            const option = document.createElement('option');
            option.value = station;
            option.textContent = station.replace(/ STATION/g, '');
            stationSelect.appendChild(option);
        }
    });
    if (allStations.includes(currentSelectedStation)) stationSelect.value = currentSelectedStation; else stationSelect.value = ""; 
}