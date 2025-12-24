// --- GLOBAL STATE VARIABLES ---
// Defined here to be shared across scripts
let globalStationIndex = {}; 
let currentRouteId = null; 
let fullDatabase = null; 
let schedules = {};
let allStations = []; 
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

// --- HOLIDAY CONFIGURATION ---
const SPECIAL_DATES = {
    "12-16": "saturday",
    "12-22": "saturday", "12-23": "saturday",
    "12-25": "sunday", "12-26": "sunday",
    "12-29": "saturday", "12-30": "saturday", "12-31": "saturday",
    "01-01": "sunday", "01-02": "saturday"
};

// --- SIMULATION STATE ---
let clickCount = 0;
let clickTimer = null;
let isSimMode = false;
let simTimeStr = "";
let simDayIndex = 1;
let toastTimeout;

// --- HELPERS ---
function pad(num) {
    var s = "00" + num;
    return s.substr(s.length - 2);
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

function normalizeStationName(name) {
    if (!name) return "";
    return name.toUpperCase().replace(/ STATION/g, '').trim();
}

function timeToSeconds(timeStr) {
    try {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        const h = parts[0] || 0; const m = parts[1] || 0; const s = parts[2] || 0;
        return (h * 3600) + (m * 60) + s;
    } catch (e) { return 0; }
}

function deg2rad(deg) { return deg * (Math.PI/180); }

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
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
        
        if (typeof renderPlaceholder === 'function') renderPlaceholder();
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
            updateLastUpdatedText();
            // Call UI init
            if (typeof initializeApp === 'function') initializeApp();
            usedCache = true;
        }

        if (!usedCache && loadingOverlay) loadingOverlay.style.display = 'flex';
        
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
            updateLastUpdatedText();
            
            if (usedCache) { 
                if(typeof showToast === 'function') showToast("Schedule updated!", "success", 3000); 
                findNextTrains(); 
            } else { 
                if(typeof initializeApp === 'function') initializeApp(); 
            }
        } else {
            console.log("Data is up to date.");
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
        if(loadingOverlay) loadingOverlay.style.display = 'none';
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
                           const stationName = String(row[stationKey]).toUpperCase().trim();
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
                        const stationName = row.STATION.toUpperCase().trim();
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

function getRouteFare(sheetKey, departureTimeStr) {
    const zoneKey = sheetKey + "_zone";
    let zoneCode = fullDatabase[zoneKey]; 
    
    // DEBUG FALLBACK: If no zone found in DB, assume Z1 for testing
    if (!zoneCode) {
        console.warn(`No zone found for ${zoneKey}, defaulting to Z1 for testing.`);
        zoneCode = "Z1";
    }

    if (!zoneCode || !FARE_CONFIG.zones[zoneCode]) return null;

    let basePrice = FARE_CONFIG.zones[zoneCode];
    let isOffPeak = false;
    let isPromo = false;

    // 1. Get Profile Config
    const profile = FARE_CONFIG.profiles[currentUserProfile] || FARE_CONFIG.profiles["Adult"];
    
    // 2. Check Time for Off-Peak Status
    let useOffPeakRate = false;
    if (departureTimeStr) {
        try {
            const hour = parseInt(departureTimeStr.split(':')[0], 10);
            if (hour >= FARE_CONFIG.offPeakStart && hour < FARE_CONFIG.offPeakEnd) {
                useOffPeakRate = true;
            }
        } catch (e) { }
    }

    // 3. Apply Multiplier
    const multiplier = useOffPeakRate ? profile.offPeak : profile.base;

    if (multiplier < 1.0) {
        basePrice = basePrice * multiplier;
        if (useOffPeakRate && profile.base === 1.0) {
             isOffPeak = true; // Adult/Pensioner during off-peak
        } else {
             isPromo = true; // Scholar always, or other permanent discounts
        }
    }

    return {
        price: basePrice.toFixed(2),
        isOffPeak: isOffPeak,
        isPromo: isPromo
    };
}

// --- JOURNEY FINDING LOGIC ---

function findNextTrains() {
    // If no route selected (e.g. welcome screen active), do nothing
    if(!currentRouteId) return;

    const selectedStation = stationSelect.value;
    const currentRoute = ROUTES[currentRouteId];
    
    // UI Calls
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
    
    if (currentDayType === 'sunday') {
        if(typeof renderNoService === 'function') {
            renderNoService(pretoriaTimeEl, currentRoute.destA); 
            renderNoService(pienaarspoortTimeEl, currentRoute.destB); 
        }
        return;
    }

    const normalize = (s) => s ? s.toUpperCase().replace(/ STATION/g, '').trim() : '';
    const isAtStation = (s1, s2) => normalize(s1) === normalize(s2);

    let sharedRoutes = [];
    if (fullDatabase && globalStationIndex[normalize(selectedStation)]) {
        const stationData = globalStationIndex[normalize(selectedStation)];
        stationData.routes.forEach(rId => {
            if (rId !== currentRouteId && ROUTES[rId].isActive) {
                sharedRoutes.push(rId);
            }
        });
    }

    let primarySheetKey = (currentDayType === 'weekday') ? currentRoute.sheetKeys.weekday_to_a : currentRoute.sheetKeys.saturday_to_a;

    // --- DESTINATION A ---
    if (isAtStation(selectedStation, currentRoute.destA)) {
        if(typeof renderAtDestination === 'function') renderAtDestination(pretoriaTimeEl);
    } else {
        const schedule = (currentDayType === 'weekday') ? schedules.weekday_to_a : schedules.saturday_to_a;
        const currentSheetKey = (currentDayType === 'weekday') ? currentRoute.sheetKeys.weekday_to_a : currentRoute.sheetKeys.saturday_to_a;
        const { allJourneys: currentJourneys } = findNextJourneyToDestA(selectedStation, "00:00:00", schedule, currentRoute);
        
        let mergedJourneys = currentJourneys.map(j => ({...j, sourceRoute: currentRoute.name, sheetKey: currentSheetKey}));

        sharedRoutes.forEach(rId => {
            const otherRoute = ROUTES[rId];
            if (otherRoute.corridorId !== currentRoute.corridorId) return;

            if (normalize(otherRoute.destA) === normalize(currentRoute.destA)) {
                const key = (currentDayType === 'weekday') ? otherRoute.sheetKeys.weekday_to_a : otherRoute.sheetKeys.saturday_to_a;
                const otherRows = fullDatabase[key];
                const otherMeta = fullDatabase[key + "_meta"];
                const otherSchedule = parseJSONSchedule(otherRows, otherMeta);
                const { allJourneys: otherJourneys } = findNextJourneyToDestA(selectedStation, "00:00:00", otherSchedule, otherRoute);
                const tagged = otherJourneys.map(j => ({...j, sourceRoute: otherRoute.name, isShared: true, sheetKey: key}));
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

        sharedRoutes.forEach(rId => {
            const otherRoute = ROUTES[rId];
            if (otherRoute.corridorId !== currentRoute.corridorId) return;

            if (normalize(otherRoute.destA) === normalize(currentRoute.destA)) {
                const key = (currentDayType === 'weekday') ? otherRoute.sheetKeys.weekday_to_b : otherRoute.sheetKeys.saturday_to_b;
                const otherRows = fullDatabase[key];
                const otherMeta = fullDatabase[key + "_meta"];
                const otherSchedule = parseJSONSchedule(otherRows, otherMeta);
                const { allJourneys: otherJourneys } = findNextJourneyToDestB(selectedStation, "00:00:00", otherSchedule, otherRoute);
                const isDivergent = normalize(otherRoute.destB) !== normalize(currentRoute.destB);
                const tagged = otherJourneys.map(j => ({
                    ...j, 
                    sourceRoute: otherRoute.name, 
                    isShared: true,
                    isDivergent: isDivergent, 
                    actualDestName: otherRoute.destB.replace(' STATION', ''),
                    sheetKey: key
                }));
                mergedJourneys = [...mergedJourneys, ...tagged];
            }
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