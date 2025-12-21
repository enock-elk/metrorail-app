// --- GLOBAL STATE VARIABLES ---
let globalStationIndex = {}; 
let currentRouteId = 'pta-pien'; 
let fullDatabase = null; 
let schedules = {};
let allStations = []; 
let currentTime = null;
let currentDayType = 'weekday'; 
let currentDayIndex = 0; 
let currentScheduleData = {};
let refreshTimer = null;
let currentUserProfile = "Adult"; // Default Profile

// --- PWA INSTALL PROMPT LOGIC (MOVED TO GLOBAL SCOPE) ---
// We must capture this event IMMEDIATELY, before the DOM loads.
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    console.log("PWA Install Event captured!");

    // If the DOM is already ready (rare), show the button now.
    // Otherwise, the DOMContentLoaded listener below will handle it.
    const btn = document.getElementById('install-app-btn');
    if (btn) {
        btn.classList.remove('hidden');
        showToast("App is ready to install!", "success", 4000);
    }
});

window.addEventListener('appinstalled', () => {
    // Log install to analytics
    console.log('PWA was installed');
    deferredPrompt = null;
    const btn = document.getElementById('install-app-btn');
    if (btn) btn.classList.add('hidden');
    showToast("App Installed Successfully!", "success", 4000);
});


// --- HOLIDAY CONFIGURATION ---
const SPECIAL_DATES = {
    "12-16": "saturday",
    "12-22": "saturday", "12-23": "saturday", "12-24": "saturday",
    "12-25": "sunday", "12-26": "sunday",
    "12-29": "saturday", "12-30": "saturday", "12-31": "saturday",
    "01-01": "sunday", "01-02": "saturday"
};

// --- ELEMENT REFERENCES ---
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

// --- SIMULATION STATE ---
let clickCount = 0;
let clickTimer = null;
let isSimMode = false;
let simTimeStr = "";
let simDayIndex = 1;
let toastTimeout;

// --- SAFETY HELPER: Compatible Pad Function ---
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

// --- UPDATED ERROR HANDLER ---
window.onerror = function(msg, url, line) {
    console.error("Global Error Caught:", msg);
    if(loadingOverlay) loadingOverlay.style.display = 'none';
    if(mainContent) mainContent.style.display = 'block';
    
    if(toast) {
        toast.textContent = "Error: " + msg; 
        toast.className = "toast-error show";
    }
    return false;
};

// --- DATA & TIME LOGIC ---

function normalizeStationName(name) {
    if (!name) return "";
    return name.toUpperCase().replace(/ STATION/g, '').trim();
}

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

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { loadAllSchedules(); startSmartRefresh(); }
});

// --- CORE DATA FETCHING ---
async function loadAllSchedules(force = false) {
    try {
        const currentRoute = ROUTES[currentRouteId];
        if (!currentRoute) return;
        
        routeSubtitleText.textContent = currentRoute.name;
        routeSubtitleText.className = `text-lg font-medium ${currentRoute.colorClass} group-hover:opacity-80 transition-colors`;
        
        pretoriaHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destA.replace(' STATION', '')}</span>`;
        pienaarspoortHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destB.replace(' STATION', '')}</span>`;
        renderPlaceholder();
        offlineIndicator.style.display = 'none';
        updatePinUI(); 

        if (!currentRoute.isActive) {
            renderComingSoon(currentRoute.name);
            mainContent.style.display = 'block';
            loadingOverlay.style.display = 'none';
        }
        
        const cachedDB = loadFromLocalCache('full_db');
        let usedCache = false;

        if (cachedDB) {
            console.log("Restoring from cache...");
            fullDatabase = cachedDB.data;
            processRouteDataFromDB(currentRoute);
            buildGlobalStationIndex(); 
            updateLastUpdatedText();
            initializeApp();
            usedCache = true;
        }

        if (!usedCache) loadingOverlay.style.display = 'flex';
        
        const reloadIcon = forceReloadBtn.querySelector('svg');
        if(reloadIcon) reloadIcon.classList.add('spinning');
        forceReloadBtn.disabled = true;

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
            
            if (usedCache) { showToast("Schedule updated!", "success", 3000); findNextTrains(); } 
            else { initializeApp(); }
        } else {
            console.log("Data is up to date.");
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        if (loadFromLocalCache('full_db')) {
            offlineIndicator.style.display = 'block';
        } else {
            renderRouteError(error);
        }
    } finally {
        forceReloadBtn.disabled = false;
        const reloadIcon = forceReloadBtn.querySelector('svg');
        if(reloadIcon) reloadIcon.classList.remove('spinning');
        loadingOverlay.style.display = 'none';
        mainContent.style.display = 'block';
    }
}

function updateLastUpdatedText() {
    if (!fullDatabase) return;
    
    let displayDate = fullDatabase.lastUpdated || "Unknown";
    const isValidDate = (d) => d && d !== "undefined" && d !== "null" && d.length > 5;

    if (currentDayType === 'weekday' || currentDayType === 'monday') { 
        if (schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) {
            displayDate = schedules.weekday_to_a.lastUpdated;
        }
    } else if (currentDayType === 'saturday') {
        if (schedules.saturday_to_a && isValidDate(schedules.saturday_to_a.lastUpdated)) {
             displayDate = schedules.saturday_to_a.lastUpdated;
        }
    } else if (currentDayType === 'sunday') {
         if (schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) {
            displayDate = schedules.weekday_to_a.lastUpdated;
        }
    }

    displayDate = displayDate.replace(/^last updated[:\s-]*/i, '').trim();

    if (displayDate && lastUpdatedEl) {
         lastUpdatedEl.textContent = `Schedule updated: ${displayDate}`;
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

function renderRouteError(error) {
    const html = `<div class="text-center p-4 bg-red-100 dark:bg-red-900 rounded-md border border-red-400 dark:border-red-700"><div class="text-2xl mb-2">⚠️</div><p class="text-red-800 dark:text-red-200 font-medium">Connection failed. Please check internet.</p></div>`;
    pretoriaTimeEl.innerHTML = html; pienaarspoortTimeEl.innerHTML = html; stationSelect.innerHTML = '<option>Unable to load stations</option>';
}

function initializeApp() {
    loadUserProfile(); 
    populateStationList();
    startClock();
    findNextTrains(); 
    loadingOverlay.style.display = 'none';
    mainContent.style.display = 'block';
}

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

function startClock() { updateTime(); setInterval(updateTime, 1000); }

function updateTime() {
    try {
        let day, timeString, now;
        
        if (isSimMode) {
            day = parseInt(simDayIndex);
            timeString = simTimeStr; 
        } else {
            now = new Date();
            day = now.getDay(); 
            timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
        }

        currentTime = timeString; 
        if(currentTimeEl) currentTimeEl.textContent = `Current Time: ${timeString} ${isSimMode ? '(SIM)' : ''}`;
        
        let newDayType = (day === 0) ? 'sunday' : (day === 6 ? 'saturday' : 'weekday');
        let specialStatusText = "";

        if (!isSimMode && now) {
            var m = pad(now.getMonth() + 1);
            var d = pad(now.getDate());
            var dateKey = m + "-" + d;

            if (SPECIAL_DATES[dateKey]) {
                newDayType = SPECIAL_DATES[dateKey];
                specialStatusText = " (Holiday Schedule)";
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

        if(currentDayEl) currentDayEl.innerHTML = `${dayNames[day]} <span class="text-blue-600 dark:text-blue-400 font-bold">${displayType}</span>${specialStatusText}`;
        
        findNextTrains();
    } catch(e) {
        console.error("Error in updateTime", e);
    }
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

function timeToSeconds(timeStr) {
    try {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        const h = parts[0] || 0; const m = parts[1] || 0; const s = parts[2] || 0;
        return (h * 3600) + (m * 60) + s;
    } catch (e) { return 0; }
}

function renderPlaceholder() {
    const placeholderHTML = `<div class="h-32 flex flex-col justify-center items-center text-gray-400 dark:text-gray-500"><svg class="w-8 h-8 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><span class="text-sm font-medium">Select a station above</span></div>`;
    pretoriaTimeEl.innerHTML = placeholderHTML;
    pienaarspoortTimeEl.innerHTML = placeholderHTML;
    if(fareContainer) fareContainer.classList.add('hidden'); // Hide fare box
}

// --- GEOLOCATION LOGIC ---
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

function deg2rad(deg) { return deg * (Math.PI/180); }

// --- FIND TRAINS LOGIC ---
function findNextTrains() {
    const selectedStation = stationSelect.value;
    const currentRoute = ROUTES[currentRouteId];
    
    if (selectedStation === "FIND_NEAREST") { findNearestStation(false); return; }
    
    if (!currentRoute) return;
    if (!currentRoute.isActive) { renderComingSoon(currentRoute.name); return; }
    
    pretoriaTimeEl.innerHTML = ""; pienaarspoortTimeEl.innerHTML = "";
    pretoriaHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destA.replace(' STATION', '')}</span>`;
    pienaarspoortHeader.innerHTML = `Next train to <span class="text-blue-500 dark:text-blue-400">${currentRoute.destB.replace(' STATION', '')}</span>`;
    
    if (!selectedStation) { renderPlaceholder(); return; }
    if (stationSelect.options[stationSelect.selectedIndex] && stationSelect.options[stationSelect.selectedIndex].textContent.includes("(No Service)")) {
        const msg = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No trains stop here.</div>`;
        pretoriaTimeEl.innerHTML = msg; pienaarspoortTimeEl.innerHTML = msg; return;
    }
    if (currentDayType === 'sunday') {
        renderNoService(pretoriaTimeEl, currentRoute.destA); renderNoService(pienaarspoortTimeEl, currentRoute.destB); return;
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
        renderAtDestination(pretoriaTimeEl);
    } else {
        const schedule = (currentDayType === 'weekday') ? schedules.weekday_to_a : schedules.saturday_to_a;
        const currentSheetKey = (currentDayType === 'weekday') ? currentRoute.sheetKeys.weekday_to_a : currentRoute.sheetKeys.saturday_to_a;
        const { allJourneys: currentJourneys } = findNextJourneyToDestA(selectedStation, "00:00:00", schedule, currentRoute);
        
        let mergedJourneys = currentJourneys.map(j => ({...j, sourceRoute: currentRoute.name, sheetKey: currentSheetKey}));

        sharedRoutes.forEach(rId => {
            const otherRoute = ROUTES[rId];
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

        // Use first upcoming journey time, or primary sheet if none
        const nowInSeconds = timeToSeconds(currentTime);
        const upcoming = mergedJourneys.find(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= nowInSeconds);
        if (upcoming) {
             updateFareDisplay(upcoming.sheetKey, upcoming.departureTime || upcoming.train1.departureTime);
        } else {
             updateFareDisplay(primarySheetKey, currentTime);
        }

        processAndRenderJourney(mergedJourneys, pretoriaTimeEl, pretoriaHeader, currentRoute.destA);
    }

    // --- DESTINATION B ---
    if (isAtStation(selectedStation, currentRoute.destB)) {
        renderAtDestination(pienaarspoortTimeEl);
    } else {
        const schedule = (currentDayType === 'weekday') ? schedules.weekday_to_b : schedules.saturday_to_b;
        const currentSheetKey = (currentDayType === 'weekday') ? currentRoute.sheetKeys.weekday_to_b : currentRoute.sheetKeys.saturday_to_b;
        const { allJourneys: currentJourneys } = findNextJourneyToDestB(selectedStation, "00:00:00", schedule, currentRoute);

        let mergedJourneys = currentJourneys.map(j => ({...j, sourceRoute: currentRoute.name, sheetKey: currentSheetKey}));

        sharedRoutes.forEach(rId => {
            const otherRoute = ROUTES[rId];
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

        processAndRenderJourney(mergedJourneys, pienaarspoortTimeEl, pienaarspoortHeader, currentRoute.destB);
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

function processAndRenderJourney(allJourneys, element, header, destination) {
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
    } else {
        if (allJourneys.length === 0) {
              element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No scheduled trains from this station today.</div>`;
              return;
        }
    }
    renderJourney(element, header, nextJourney, firstTrainName, destination);
}

function renderJourney(element, headerElement, journey, firstTrainName, destination) {
    element.innerHTML = "";
    if (!journey) { renderNextAvailableTrain(element, destination); return; }

    let timeClass = "bg-gray-200 dark:bg-gray-900";
    if (journey.isLastTrain) {
        timeClass = "bg-red-100 dark:bg-red-900 border-2 border-red-500";
    } else if (journey.isFirstTrain) {
        timeClass = "bg-green-100 dark:bg-green-900 border-2 border-green-500";
    }
    
    const safeDepTime = escapeHTML(journey.departureTime || journey.train1.departureTime);
    const safeTrainName = escapeHTML(journey.train || journey.train1.train);
    const safeDest = escapeHTML(destination);
    const timeDiffStr = calculateTimeDiffString(journey.departureTime || journey.train1.departureTime);
    const safeDestForClick = safeDest.replace(/'/g, "\\'"); 
    const buttonHtml = `<button onclick="openScheduleModal('${safeDestForClick}')" class="absolute bottom-0 left-0 w-full text-[10px] uppercase tracking-wide font-bold py-1 bg-black bg-opacity-10 hover:bg-opacity-20 dark:bg-white dark:bg-opacity-10 dark:hover:bg-opacity-20 rounded-b-md transition-colors truncate">See Full Schedule</button>`;

    // --- VISUAL TAG FOR SHARED TRAINS ---
    let sharedTag = "";
    if (journey.isShared && journey.sourceRoute) {
         const routeName = journey.sourceRoute.replace("Pretoria <-> ", "").replace("Route", "").trim();
         // SAFEGUARD: If divergent, use WARNING color
         if (journey.isDivergent) {
             sharedTag = `<span class="block text-[10px] uppercase font-bold text-red-600 dark:text-red-400 mt-1 bg-red-100 dark:bg-red-900 px-1 rounded w-fit mx-auto border border-red-300 dark:border-red-700">⚠️ To ${journey.actualDestName}</span>`;
         } else {
             sharedTag = `<span class="block text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 mt-1 bg-purple-100 dark:bg-purple-900 px-1 rounded w-fit mx-auto">From ${routeName}</span>`;
         }
    }

    if (journey.type === 'direct') {
        const actualDest = journey.actualDestination ? normalizeStationName(journey.actualDestination) : '';
        const normDest = normalizeStationName(destination);
        let destinationText = journey.arrivalTime ? `Arrives ${escapeHTML(journey.arrivalTime)}` : "Arrival time not available.";
        if (actualDest && normDest && actualDest !== normDest) {
            destinationText = `Terminates at ${escapeHTML(journey.actualDestination.replace(/ STATION/g,''))}.`;
        }
        
        let trainTypeText = `<span class="font-bold text-yellow-600 dark:text-yellow-400">Direct train (${safeTrainName})</span>`;
        if (journey.isLastTrain) trainTypeText = `<span class="font-bold text-red-600 dark:text-red-400">Last Direct train (${safeTrainName})</span>`;

        element.innerHTML = `<div class="flex flex-row items-center w-full space-x-3"><div class="relative w-1/2 h-32 flex flex-col justify-center items-center text-center p-2 pb-6 ${timeClass} rounded-lg shadow-sm flex-shrink-0"><div class="text-3xl font-bold text-gray-900 dark:text-white">${safeDepTime}</div><div class="text-sm text-gray-700 dark:text-gray-300 font-medium mt-1">${timeDiffStr}</div>${sharedTag}${buttonHtml}</div><div class="w-1/2 flex flex-col justify-center items-center text-center space-y-1"><div class="text-sm text-gray-800 dark:text-gray-200 font-medium leading-tight">${trainTypeText}</div><div class="text-xs text-gray-500 dark:text-gray-400 leading-tight font-medium">${destinationText}</div></div></div>`;
    }

    if (journey.type === 'transfer') {
        const conn = journey.connection; 
        const nextFull = journey.nextFullJourney; 
        const termStation = escapeHTML(journey.train1.terminationStation.replace(/ STATION/g, ''));
        const arrivalAtTransfer = escapeHTML(journey.train1.arrivalAtTransfer);
        let train1Info = `Train ${safeTrainName} (Terminates at ${termStation} at ${arrivalAtTransfer})`;
        if (journey.isLastTrain) train1Info = `<span class="text-red-600 dark:text-red-400 font-bold">Last Train (${safeTrainName})</span> (Terminates at ${termStation})`;

        let connectionInfoHTML = "";
        if (nextFull) {
            const connTrain = escapeHTML(conn.train);
            const connDest = escapeHTML(conn.actualDestination.replace(/ STATION/g, ''));
            const connDep = escapeHTML(conn.departureTime);
            const nextTrain = escapeHTML(nextFull.train);
            const nextDest = escapeHTML(nextFull.actualDestination.replace(/ STATION/g, ''));
            const nextDep = escapeHTML(nextFull.departureTime);
            const connection1Text = `Connect to Train ${connTrain} (to ${connDest}) at <b>${connDep}</b>`;
            const connection2Text = `Next Train ${nextTrain} (to ${nextDest}) is at <b>${nextDep}</b>`;
            connectionInfoHTML = `<div class="space-y-1"><div class="text-yellow-600 dark:text-yellow-400 font-medium">${connection1Text}</div><div class="text-gray-500 dark:text-gray-400 text-xs font-medium">${connection2Text}</div></div>`;
        } else {
            const connTrain = escapeHTML(conn.train);
            const connDep = escapeHTML(conn.departureTime);
            const connArr = escapeHTML(conn.arrivalTime);
            let connDestName = `(Arrives ${connArr})`; 
            const connectionText = `Connect to Train ${connTrain} at <b>${connDep}</b> ${connDestName}`;
            connectionInfoHTML = `<div class="text-yellow-600 dark:text-yellow-400 font-medium">${connectionText}</div>`;
        }
        element.innerHTML = `<div class="flex flex-row items-center w-full space-x-3"><div class="relative w-1/2 h-32 flex flex-col justify-center items-center text-center p-2 pb-6 ${timeClass} rounded-lg shadow-sm flex-shrink-0"><div class="text-3xl font-bold text-gray-900 dark:text-white">${safeDepTime}</div><div class="text-sm text-gray-700 dark:text-gray-300 font-medium mt-1">${timeDiffStr}</div>${sharedTag}${buttonHtml}</div><div class="w-1/2 flex flex-col justify-center items-center text-center space-y-1"><div class="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Transfer Required</div><div class="text-xs text-yellow-600 dark:text-yellow-400 leading-tight font-medium">${train1Info}</div><div class="text-xs leading-tight">${connectionInfoHTML}</div></div></div>`;
    }
}

function renderNextAvailableTrain(element, destination) {
    const currentRoute = ROUTES[currentRouteId];
    let nextDayName = ""; let nextDaySheetKey = ""; let dayOffset = 1; 
    switch (currentDayIndex) {
        case 6: nextDayName = "Monday"; dayOffset = 2; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; break;
        case 5: nextDayName = "Saturday"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b'; break;
        default: nextDayName = "tomorrow"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; break;
    }
    const nextSchedule = schedules[nextDaySheetKey];
    if (!nextSchedule) { element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No schedule found for next service day.</div>`; return; }
    const selectedStation = stationSelect.value;
    let allJourneys = [];
    if (destination === currentRoute.destA) { const res = findNextJourneyToDestA(selectedStation, "00:00:00", nextSchedule, currentRoute); allJourneys = res.allJourneys; } 
    else { const res = findNextJourneyToDestB(selectedStation, "00:00:00", nextSchedule, currentRoute); allJourneys = res.allJourneys; }
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    const firstTrainOfNextDay = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    if (!firstTrainOfNextDay) { element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No trains found for ${nextDayName}.</div>`; return; }
    const departureTime = firstTrainOfNextDay.departureTime || firstTrainOfNextDay.train1.departureTime;
    const timeDiffStr = calculateTimeDiffString(departureTime, dayOffset);
    element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center w-full"><div class="text-lg font-bold text-gray-600 dark:text-gray-400">No more trains today</div><p class="text-sm text-gray-400 dark:text-gray-500 mt-2">First train ${nextDayName} is at:</p><div class="text-center p-3 bg-gray-200 dark:bg-gray-900 rounded-md transition-all mt-2 w-3/4"><div class="text-2xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-base text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div></div></div>`;
}

function renderAtDestination(element) { element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-green-500 dark:text-green-400">You are at this station</div>`; }

function renderNoService(element, destination) {
    const normalize = (s) => s ? s.toUpperCase().replace(/ STATION/g, '').trim() : '';
    const selectedStation = stationSelect.value;
    if (normalize(selectedStation) === normalize(destination)) {
        renderAtDestination(element);
        return;
    }
    const currentRoute = ROUTES[currentRouteId];
    const sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b';
    const schedule = schedules[sheetKey];
    let allJourneys = [];
    if (destination === currentRoute.destA) { const res = findNextJourneyToDestA(selectedStation, "00:00:00", schedule, currentRoute); allJourneys = res.allJourneys; } 
    else { const res = findNextJourneyToDestB(selectedStation, "00:00:00", schedule, currentRoute); allJourneys = res.allJourneys; }
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    const firstTrain = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    let timeHTML = 'N/A';
    if (firstTrain) {
        const departureTime = firstTrain.departureTime || firstTrain.train1.departureTime;
        const timeDiffStr = calculateTimeDiffString(departureTime, 1); 
        timeHTML = `<div class="text-2xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-base text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>`;
    }
    element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center w-full"><div class="text-xl font-bold text-gray-600 dark:text-gray-400">No service on Sundays/Holidays.</div><p class="text-sm text-gray-400 dark:text-gray-500 mt-2">First train next weekday is at:</p><div class="text-center p-3 bg-gray-200 dark:bg-gray-900 rounded-md transition-all mt-2 w-3/4">${timeHTML}</div></div>`;
}

function renderComingSoon(routeName) {
    const msg = `<div class="h-32 flex flex-col justify-center items-center text-center p-6 bg-yellow-100 dark:bg-yellow-900 rounded-lg"><h3 class="text-xl font-bold text-yellow-700 dark:text-yellow-300 mb-2">🚧 Coming Soon</h3><p class="text-gray-700 dark:text-gray-300">We are working on the <strong>${routeName}</strong> schedule.</p></div>`;
    pretoriaTimeEl.innerHTML = msg; pienaarspoortTimeEl.innerHTML = msg; stationSelect.innerHTML = '<option>Route not available</option>';
}

// --- LEGAL MODAL LOGIC ---
window.openLegal = function(type) {
    legalTitle.textContent = type === 'terms' ? 'Terms of Use' : 'Privacy Policy';
    legalContent.innerHTML = LEGAL_TEXTS[type];
    legalModal.classList.remove('hidden');
    sidenav.classList.remove('open');
    sidenavOverlay.classList.remove('open');
    document.body.classList.remove('sidenav-open');
};

function closeLegal() {
    legalModal.classList.add('hidden');
}

// --- UTILITY FUNCTIONS ---
function copyToClipboard(text) { const textArea = document.createElement('textarea'); textArea.value = text; textArea.style.position = "fixed"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { const successful = document.execCommand('copy'); if (successful) showToast("Link copied to clipboard!", "success", 2000); } catch (err) {} document.body.removeChild(textArea); }
function showToast(message, type = 'info', duration = 3000) { if (toastTimeout) clearTimeout(toastTimeout); toast.textContent = message; toast.className = `toast-info`; if (type === 'success') toast.classList.add('toast-success'); else if (type === 'error') toast.classList.add('toast-error'); toast.classList.add('show'); toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, duration); }
function updatePinUI() {
    const savedDefault = localStorage.getItem('defaultRoute'); const isPinned = savedDefault === currentRouteId;
    if (isPinned) { pinOutline.classList.add('hidden'); pinFilled.classList.remove('hidden'); pinRouteBtn.title = "Unpin this route"; } else { pinOutline.classList.remove('hidden'); pinFilled.classList.add('hidden'); pinRouteBtn.title = "Pin this route as default"; }
    if (savedDefault && ROUTES[savedDefault]) { pinnedSection.classList.remove('hidden'); pinnedSection.innerHTML = `<li class="route-category mt-0 pt-0 text-blue-500 dark:text-blue-400">Pinned Route</li><li class="route-item"><a class="${savedDefault === currentRouteId ? 'active' : ''}" data-route-id="${savedDefault}"><span class="route-dot dot-green"></span>${ROUTES[savedDefault].name}</a></li>`; } else { pinnedSection.classList.add('hidden'); }
}
function saveToLocalCache(key, data) { try { const cacheEntry = { timestamp: Date.now(), data: data }; localStorage.setItem(key, JSON.stringify(cacheEntry)); } catch (e) {} }
function loadFromLocalCache(key) { try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : null; } catch (e) { return null; } }

// --- USER PROFILE LOGIC ---
function loadUserProfile() {
    profileModal = document.getElementById('profile-modal');
    navProfileDisplay = document.getElementById('nav-profile-display');
    const savedProfile = localStorage.getItem('userProfile');
    
    if (savedProfile) {
        currentUserProfile = savedProfile;
        if(navProfileDisplay) navProfileDisplay.textContent = currentUserProfile;
    } else {
        if(profileModal) profileModal.classList.remove('hidden');
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
    if(sidenav) {
        sidenav.classList.remove('open');
        sidenavOverlay.classList.remove('open');
        document.body.classList.remove('sidenav-open');
    }
};

// --- UPDATE FARE BOX LOGIC ---
function updateFareDisplay(sheetKey, nextTrainTimeStr) {
    fareContainer = document.getElementById('fare-container');
    fareAmount = document.getElementById('fare-amount');
    fareType = document.getElementById('fare-type');
    passengerTypeLabel = document.getElementById('passenger-type-label');

    if (!fareContainer) return;
    
    if (passengerTypeLabel) passengerTypeLabel.textContent = currentUserProfile;

    const fareData = getRouteFare(sheetKey, nextTrainTimeStr);

    if (fareData) {
        fareAmount.textContent = `R${fareData.price}`;
        
        if (fareData.isPromo) {
            fareType.textContent = "Discounted";
            fareType.className = "text-[10px] font-bold text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full mb-1";
            fareAmount.className = "text-xl font-black text-blue-600 dark:text-blue-400";
        } else if (fareData.isOffPeak) {
            fareType.textContent = "40% Off-Peak";
            fareType.className = "text-[10px] font-bold text-green-600 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full mb-1";
            fareAmount.className = "text-xl font-black text-green-600 dark:text-green-400";
        } else {
            fareType.textContent = "Standard";
            fareType.className = "text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full mb-1";
            fareAmount.className = "text-xl font-black text-gray-900 dark:text-white";
        }
        
        fareContainer.classList.remove('hidden');
    } else {
        fareContainer.classList.add('hidden');
    }
}

// --- FLAT FARE CALCULATION ---
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
    // We check time first to see if we should apply the off-peak multiplier
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
    // If it's off-peak time, use the offPeak multiplier. Otherwise use base multiplier.
    const multiplier = useOffPeakRate ? profile.offPeak : profile.base;

    // If multiplier is less than 1, we consider it a "promo" or "discounted" fare for UI purposes
    if (multiplier < 1.0) {
        basePrice = basePrice * multiplier;
        // Distinguish between a standard promo (scholar always) and time-based off-peak
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

// --- UI SETUP & EVENT LISTENERS ---
function setupModalButtons() { 
    const closeAction = () => { scheduleModal.classList.add('hidden'); document.body.style.overflow = ''; }; 
    closeModalBtn.addEventListener('click', closeAction); 
    closeModalBtn2.addEventListener('click', closeAction); 
    scheduleModal.addEventListener('click', (e) => { if (e.target === scheduleModal) closeAction(); }); 
}

window.openScheduleModal = function(destination) {
    if (!currentScheduleData || !currentScheduleData[destination]) { showToast("No full schedule data available.", "error"); return; }
    const journeys = currentScheduleData[destination]; 
    modalTitle.textContent = `Schedule to ${destination.replace(' STATION', '')}`; 
    modalList.innerHTML = '';
    const nowSeconds = timeToSeconds(currentTime);
    let firstNextTrainFound = false;

    journeys.forEach(j => {
        const dep = j.departureTime || j.train1.departureTime; 
        const trainName = j.train || j.train1.train; 
        const type = j.type === 'transfer' ? 'Transfer' : 'Direct';
        const depSeconds = timeToSeconds(dep);
        const isPassed = depSeconds < nowSeconds;

        let divClass = "p-3 rounded shadow-sm flex justify-between items-center transition-opacity duration-300";
        if (isPassed) {
            divClass += " bg-gray-50 dark:bg-gray-800 opacity-50 grayscale"; 
        } else {
            divClass += " bg-white dark:bg-gray-700"; 
        }

        const div = document.createElement('div'); 
        div.className = divClass;
        if (!isPassed && !firstNextTrainFound) {
            div.id = "next-train-marker";
            firstNextTrainFound = true;
        }

        // --- TAG IN MODAL ---
        let modalTag = "";
        if (j.isShared && j.sourceRoute) {
             const routeName = j.sourceRoute.replace("Pretoria <-> ", "").replace("Route", "").trim();
             if (j.isDivergent) {
                 modalTag = `<span class="text-[9px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-200 dark:border-red-800">⚠️ To ${j.actualDestName}</span>`;
             } else {
                 modalTag = `<span class="text-[9px] font-bold text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900 px-1.5 py-0.5 rounded uppercase ml-2">From ${routeName}</span>`;
             }
        }

        div.innerHTML = `<div><span class="text-lg font-bold text-gray-900 dark:text-white">${dep}</span><div class="text-xs text-gray-500 dark:text-gray-400">Train ${trainName} ${modalTag}</div></div><div class="flex flex-col items-end gap-1">${type === 'Direct' ? '<span class="text-[10px] font-bold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900 px-2 py-0.5 rounded-full uppercase">Direct</span>' : `<span class="text-[10px] font-bold text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900 px-2 py-0.5 rounded-full uppercase">Transfer @ ${j.train1.terminationStation.replace(' STATION','')}</span>`} ${j.isLastTrain ? '<span class="text-[10px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-2 py-0.5 rounded-full uppercase border border-red-200 dark:border-red-800">LAST TRAIN</span>' : ''}</div>`;
        modalList.appendChild(div);
    });
    
    scheduleModal.classList.remove('hidden'); 
    document.body.style.overflow = 'hidden'; 
    setTimeout(() => {
        const target = document.getElementById('next-train-marker');
        if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 10);
};

function setupRedirectLogic() {
    feedbackBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        showRedirectModal("https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform", "Open Google Form to send feedback?"); 
    }); 
    checkUpdatesBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        showRedirectModal(checkUpdatesBtn.href, "Visit Facebook for official updates?"); 
    }); 
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

function setupFeatureButtons() {
    if (localStorage.theme === 'light') { document.documentElement.classList.remove('dark'); darkIcon.classList.add('hidden'); lightIcon.classList.remove('hidden'); } 
    else { localStorage.theme = 'dark'; document.documentElement.classList.add('dark'); darkIcon.classList.remove('hidden'); lightIcon.classList.add('hidden'); }
    themeToggleBtn.addEventListener('click', () => { if (localStorage.theme === 'dark') { localStorage.theme = 'light'; document.documentElement.classList.remove('dark'); darkIcon.classList.add('hidden'); lightIcon.classList.remove('hidden'); } else { localStorage.theme = 'dark'; document.documentElement.classList.add('dark'); darkIcon.classList.remove('hidden'); lightIcon.classList.add('hidden'); } });
    shareBtn.addEventListener('click', async () => { const shareData = { title: 'Metrorail Next Train', text: 'Say Goodbye to Waiting\nUse Next Train to check when your train is due to arrive', url: '\n\nhttps://nexttrain.co.za' }; try { if (navigator.share) await navigator.share(shareData); else copyToClipboard(shareData.text + shareData.url); } catch (err) { copyToClipboard(shareData.text + shareData.url); } });
    
    // --- UPDATED INSTALL PROMPT LOGIC ---
    // Check if the install button element exists before trying to manipulate it
    installBtn = document.getElementById('install-app-btn');
    if (installBtn && deferredPrompt) {
        // If the event fired before we got here, show the button now
        installBtn.classList.remove('hidden');
    }
    
    if (installBtn) {
        installBtn.addEventListener('click', () => { 
            installBtn.classList.add('hidden'); 
            if (deferredPrompt) {
                deferredPrompt.prompt(); 
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the install prompt');
                    } else {
                        console.log('User dismissed the install prompt');
                    }
                    deferredPrompt = null;
                });
            }
        }); 
    }

    const openNav = () => { sidenav.classList.add('open'); sidenavOverlay.classList.add('open'); document.body.classList.add('sidenav-open'); };
    openNavBtn.addEventListener('click', openNav); routeSubtitle.addEventListener('click', openNav);
    const closeNav = () => { sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open'); };
    closeNavBtn.addEventListener('click', closeNav); sidenavOverlay.addEventListener('click', closeNav);
    routeList.addEventListener('click', (e) => { const routeLink = e.target.closest('a'); if (routeLink && routeLink.dataset.routeId) { const routeId = routeLink.dataset.routeId; if (routeId === currentRouteId) { showToast("You are already viewing this route.", "info", 1500); closeNav(); return; } document.querySelectorAll('#route-list a').forEach(a => a.classList.remove('active')); routeLink.classList.add('active'); closeNav(); currentRouteId = routeId; loadAllSchedules(); } });
    forceReloadBtn.addEventListener('click', () => { showToast("Forcing schedule reload...", "info", 2000); loadAllSchedules(true); });
    pinRouteBtn.addEventListener('click', () => { const savedDefault = localStorage.getItem('defaultRoute'); if (savedDefault === currentRouteId) { localStorage.removeItem('defaultRoute'); showToast("Route unpinned from top.", "info", 2000); } else { localStorage.setItem('defaultRoute', currentRouteId); showToast("Route pinned to top of menu!", "success", 2000); } updatePinUI(); });
}

// --- PWA SERVICE WORKER REGISTRATION ---
// Fixed Path for GitHub Pages compatibility
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.log('Service Worker registration failed', err));
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    stationSelect = document.getElementById('station-select');
    locateBtn = document.getElementById('locate-btn');
    pretoriaTimeEl = document.getElementById('pretoria-time');
    pienaarspoortTimeEl = document.getElementById('pienaarspoort-time');
    pretoriaHeader = document.getElementById('pretoria-header');
    pienaarspoortHeader = document.getElementById('pienaarspoort-header');
    currentTimeEl = document.getElementById('current-time');
    currentDayEl = document.getElementById('current-day');
    loadingOverlay = document.getElementById('loading-overlay');
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
    checkUpdatesBtn = document.getElementById('check-updates-btn');
    feedbackBtn = document.getElementById('feedback-btn');
    lastUpdatedEl = document.getElementById('last-updated-date');

    simPanel = document.getElementById('sim-panel');
    simEnabledCheckbox = document.getElementById('sim-enabled');
    simTimeInput = document.getElementById('sim-time');
    simDaySelect = document.getElementById('sim-day');
    simApplyBtn = document.getElementById('sim-apply-btn');
    appTitle = document.getElementById('app-title');
    pinModal = document.getElementById('pin-modal');
    pinInput = document.getElementById('pin-input');
    pinCancelBtn = document.getElementById('pin-cancel-btn');
    pinSubmitBtn = document.getElementById('pin-submit-btn');
    legalModal = document.getElementById('legal-modal');
    legalTitle = document.getElementById('legal-modal-title');
    legalContent = document.getElementById('legal-modal-content');
    closeLegalBtn = document.getElementById('close-legal-btn');
    closeLegalBtn2 = document.getElementById('close-legal-btn-2');

    closeLegalBtn.addEventListener('click', closeLegal);
    closeLegalBtn2.addEventListener('click', closeLegal);
    legalModal.addEventListener('click', (e) => { if (e.target === legalModal) closeLegal(); });
    
    // Manual Locate Click - pass false to indicate manual interaction
    locateBtn.addEventListener('click', () => findNearestStation(false));
    
    appTitle.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 1000); 
        if (clickCount >= 5) {
            clickCount = 0;
            pinModal.classList.remove('hidden');
            pinInput.value = '';
            pinInput.focus();
        }
    });

    pinCancelBtn.addEventListener('click', () => { pinModal.classList.add('hidden'); });
    
    // NEW: Enter key submits PIN
    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            pinSubmitBtn.click();
        }
    });

    pinSubmitBtn.addEventListener('click', () => {
        if (pinInput.value === "101101") {
            pinModal.classList.add('hidden');
            simPanel.classList.remove('hidden');
            showToast("Developer Mode Unlocked!", "success");
        } else {
            showToast("Invalid PIN", "error");
            pinInput.value = '';
        }
    });

    simApplyBtn.addEventListener('click', () => {
        isSimMode = simEnabledCheckbox.checked;
        simTimeStr = simTimeInput.value + ":00";
        simDayIndex = parseInt(simDaySelect.value);
        if (isSimMode && !simTimeInput.value) { showToast("Please enter a time first!", "error"); return; }
        showToast(isSimMode ? "Dev Simulation Active!" : "Real-time Mode Active", "success");
        updateTime(); 
    });

    const savedDefault = localStorage.getItem('defaultRoute');
    if (savedDefault && ROUTES[savedDefault]) currentRouteId = savedDefault;
    
    stationSelect.addEventListener('change', findNextTrains);
    setupFeatureButtons(); updatePinUI(); setupModalButtons(); setupRedirectLogic(); startSmartRefresh();

    loadAllSchedules().then(() => {
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
                if (result.state === 'granted') {
                    console.log("Location permission already granted. Auto-locating...");
                    // Auto Locate - pass true
                    findNearestStation(true);
                }
            });
        }
    });
});