// --- TRIP PLANNER LOGIC ---

// State
let plannerOrigin = null;
let plannerDest = null;
let currentTripOptions = []; // Store multiple train options

// Initialize Planner Modal
function initPlanner() {
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');
    const swapBtn = document.getElementById('planner-swap-btn');
    const searchBtn = document.getElementById('planner-search-btn');
    const resetBtn = document.getElementById('planner-reset-btn');
    const locateBtn = document.getElementById('planner-locate-btn');
    
    // Update Planner Time Display periodically (syncs with main clock)
    const plannerTimeEl = document.createElement('div');
    plannerTimeEl.id = 'planner-time-display';
    plannerTimeEl.className = 'text-center mb-4';
    
    // Insert after header
    const header = document.querySelector('#planner-modal .p-4.border-b');
    if (header && !document.getElementById('planner-time-display')) {
        header.parentNode.insertBefore(plannerTimeEl, header.nextSibling);
    }

    // Function to update the planner clock
    const updatePlannerClock = () => {
        if (!document.getElementById('planner-time-display')) return;
        const timeEl = document.getElementById('planner-time-display');
        
        // Use global variables from logic.js (currentTime, currentDayType)
        if (typeof currentTime !== 'undefined') {
            let displayType = "";
            if (currentDayType === 'sunday') displayType = "No Service";
            else if (currentDayType === 'saturday') displayType = "Saturday Schedule";
            else displayType = "Weekday Schedule";

            timeEl.innerHTML = `
                <p class="text-base text-gray-700 dark:text-gray-300 font-medium">Current Time: ${currentTime} ${typeof isSimMode !== 'undefined' && isSimMode ? '(SIM)' : ''}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    ${currentDayType.charAt(0).toUpperCase() + currentDayType.slice(1)} <span class="text-blue-600 dark:text-blue-400 font-bold">${displayType}</span>
                </p>
            `;
        }
    };

    // Update immediately and then hook into the global interval or set its own
    updatePlannerClock();
    setInterval(updatePlannerClock, 1000);

    // Developer Mode Access (Header Tap)
    const plannerHeader = document.querySelector('#planner-modal h3');
    if (plannerHeader) {
        let pClickCount = 0;
        let pClickTimer = null;
        plannerHeader.classList.add('cursor-pointer', 'select-none'); 
        plannerHeader.addEventListener('click', () => {
            pClickCount++;
            if (pClickTimer) clearTimeout(pClickTimer);
            pClickTimer = setTimeout(() => { pClickCount = 0; }, 1000);
            if (pClickCount >= 5) {
                pClickCount = 0;
                // Open global PIN modal
                const pinModal = document.getElementById('pin-modal');
                const pinInput = document.getElementById('pin-input');
                const pinSubmit = document.getElementById('pin-submit-btn');
                
                if (pinModal) {
                    pinModal.classList.remove('hidden');
                    if(pinInput) { pinInput.value = ''; pinInput.focus(); }
                    
                    const handlePlannerUnlock = () => {
                        if (pinInput.value === "101101") { 
                            renderPlannerDevUI(); 
                            pinSubmit.removeEventListener('click', handlePlannerUnlock); 
                        }
                    };
                    pinSubmit.addEventListener('click', handlePlannerUnlock);
                }
            }
        });
    }

    if (!fromSelect || !toSelect) return;

    // 1. Setup Autocomplete Logic
    setupAutocomplete('planner-from-search', 'planner-from');
    setupAutocomplete('planner-to-search', 'planner-to');

    // 2. Populate Selects
    const populate = (select) => {
        select.innerHTML = '<option value="">Select...</option>';
        if (typeof MASTER_STATION_LIST !== 'undefined' && MASTER_STATION_LIST.length > 0) {
            MASTER_STATION_LIST.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s.replace(' STATION', '').trim();
                select.appendChild(opt);
            });
        }
    };
    populate(fromSelect);
    populate(toSelect);

    // 3. Auto Locate
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            const icon = locateBtn.querySelector('svg');
            icon.classList.add('animate-spin'); 
            
            if (!navigator.geolocation) {
                showToast("Geolocation is not supported.", "error");
                icon.classList.remove('animate-spin');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    
                    let candidates = [];
                    for (const [stationName, coords] of Object.entries(globalStationIndex)) {
                        const dist = getDistanceFromLatLonInKm(userLat, userLon, coords.lat, coords.lon);
                        candidates.push({ stationName, dist });
                    }
                    
                    candidates.sort((a, b) => a.dist - b.dist);

                    if (candidates.length > 0 && candidates[0].dist <= 6) { 
                        const nearest = candidates[0].stationName;
                        const fromInput = document.getElementById('planner-from-search');
                        fromSelect.value = nearest;
                        if(fromInput) fromInput.value = nearest.replace(' STATION', '');
                        showToast(`Located: ${nearest.replace(' STATION', '')}`, "success");
                    } else {
                        showToast("No stations found nearby.", "error");
                    }
                    icon.classList.remove('animate-spin');
                },
                (err) => {
                    showToast("Could not retrieve location.", "error");
                    icon.classList.remove('animate-spin');
                }
            );
        });
    }

    // 4. Event Listeners
    swapBtn.addEventListener('click', () => {
        const fromInput = document.getElementById('planner-from-search');
        const toInput = document.getElementById('planner-to-search');
        
        const tempVal = fromSelect.value;
        fromSelect.value = toSelect.value;
        toSelect.value = tempVal;
        
        const tempText = fromInput.value;
        fromInput.value = toInput.value;
        toInput.value = tempText;
    });

    searchBtn.addEventListener('click', () => {
        const from = fromSelect.value;
        const to = toSelect.value;
        
        if (!from || !to) {
            showToast("Please select both stations.", "error");
            return;
        }
        if (from === to) {
            showToast("Origin and Destination cannot be the same.", "error");
            return;
        }

        executeTripPlan(from, to);
    });

    resetBtn.addEventListener('click', () => {
        document.getElementById('planner-input-section').classList.remove('hidden');
        document.getElementById('planner-results-section').classList.add('hidden');
        fromSelect.value = "";
        toSelect.value = "";
        document.getElementById('planner-from-search').value = "";
        document.getElementById('planner-to-search').value = "";
    });
}

// --- AUTOCOMPLETE HELPER ---
function setupAutocomplete(inputId, selectId) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;

    select.classList.add('hidden');
    
    const list = document.createElement('ul');
    list.className = "absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-xl max-h-60 overflow-y-auto hidden mt-1";
    input.parentNode.style.position = 'relative'; 
    input.parentNode.appendChild(list);

    input.addEventListener('input', () => {
        const val = input.value.toUpperCase();
        list.innerHTML = '';
        
        if (val.length < 1) {
            list.classList.add('hidden');
            return;
        }

        const matches = MASTER_STATION_LIST.filter(s => s.includes(val));
        
        if (matches.length === 0) {
            const li = document.createElement('li');
            li.className = "p-3 text-sm text-gray-400 italic";
            li.textContent = "No stations found";
            list.appendChild(li);
        } else {
            matches.forEach(station => {
                const li = document.createElement('li');
                li.className = "p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors";
                li.textContent = station.replace(' STATION', '');
                
                li.onclick = () => {
                    input.value = station.replace(' STATION', '');
                    select.value = station;
                    list.classList.add('hidden');
                };
                list.appendChild(li);
            });
        }
        list.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !list.contains(e.target)) {
            list.classList.add('hidden');
        }
    });
    
    input.addEventListener('focus', () => {
        if(input.value.length > 0) input.dispatchEvent(new Event('input'));
    });
}

// --- DEV TOOLS INJECTION ---
function renderPlannerDevUI() {
    const container = document.getElementById('planner-input-section');
    if (!container) return;
    if (document.getElementById('planner-dev-tools')) return;

    const devDiv = document.createElement('div');
    devDiv.id = "planner-dev-tools";
    devDiv.className = "mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700 animate-fade-in-up";
    
    devDiv.innerHTML = `
        <h4 class="text-xs font-bold text-green-400 uppercase mb-3 flex justify-between items-center">
            <span>Developer Simulation</span>
            <button onclick="document.getElementById('planner-dev-tools').remove()" class="text-gray-500 hover:text-white">&times;</button>
        </h4>
        <div class="space-y-3">
            <div class="flex items-center justify-between text-white text-sm">
                <label>Enable Sim</label>
                <input type="checkbox" id="p-sim-enabled" class="h-4 w-4 rounded" ${typeof isSimMode !== 'undefined' && isSimMode ? 'checked' : ''}>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1">Time</label>
                <input type="time" id="p-sim-time" step="1" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white text-sm">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-400 mb-1">Day</label>
                <select id="p-sim-day" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white text-sm">
                    <option value="1">Monday (Weekday)</option>
                    <option value="6">Saturday</option>
                    <option value="0">Sunday</option>
                </select>
            </div>
            <button id="p-sim-apply" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded text-xs uppercase transition-colors">Apply Override</button>
        </div>
    `;
    
    container.prepend(devDiv);
    
    document.getElementById('p-sim-apply').addEventListener('click', () => {
        if (typeof isSimMode === 'undefined') { showToast("Sim vars not found", "error"); return; }
        
        isSimMode = document.getElementById('p-sim-enabled').checked;
        simTimeStr = document.getElementById('p-sim-time').value + ":00";
        simDayIndex = parseInt(document.getElementById('p-sim-day').value);
        
        const globalCheck = document.getElementById('sim-enabled');
        if(globalCheck) globalCheck.checked = isSimMode;
        
        if (typeof updateTime === 'function') updateTime();
        showToast("Simulation Applied! Press Find Route again.", "success");
    });
}

// --- UPDATED CORE LOGIC (V3.53 - Transfer Support & Robust Next Day Check) ---
function executeTripPlan(origin, dest) {
    const resultsContainer = document.getElementById('planner-results-list');
    
    resultsContainer.innerHTML = '<div class="text-center p-4"><svg class="w-8 h-8 animate-spin mx-auto text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-xs text-gray-500">Calculating route...</p></div>';
    
    document.getElementById('planner-input-section').classList.add('hidden');
    document.getElementById('planner-results-section').classList.remove('hidden');

    setTimeout(() => {
        // 1. Try Direct Trip First
        const directPlan = planDirectTrip(origin, dest);

        if (directPlan.status === 'FOUND') {
            currentTripOptions = directPlan.trips;
            renderTripResult(resultsContainer, currentTripOptions, 0);
        } 
        else if (directPlan.status === 'NO_MORE_TODAY') {
            currentTripOptions = directPlan.trips;
            renderNoMoreTrainsResult(resultsContainer, currentTripOptions, 0, "No more trains today");
        }
        else if (directPlan.status === 'NO_SERVICE_TODAY_FUTURE_FOUND') {
            // Case: Sunday with no trains, but Monday has trains
            currentTripOptions = directPlan.trips;
            renderNoMoreTrainsResult(resultsContainer, currentTripOptions, 0, "No Service Today");
        }
        else {
            // 2. No Direct? Try Transfer Logic (Including Inter-Route)
            const transferPlan = planHubTransferTrip(origin, dest);
            
            if (transferPlan.status === 'FOUND') {
                currentTripOptions = transferPlan.trips;
                renderTripResult(resultsContainer, currentTripOptions, 0);
            } 
            else if (directPlan.status === 'NO_SERVICE') {
                 // Explicitly handle "No Service" separately from "No Route"
                 // This means the path is valid, but no trains run today AND no trains found for next day (rare, but possible)
                 resultsContainer.innerHTML = renderErrorCard("No Service", "This route exists, but there are no trains scheduled.");
            } 
            else {
                 resultsContainer.innerHTML = renderErrorCard(
                     "No Route Found", 
                     `We couldn't find a route between these stations. Transfers between different corridors are coming soon in V3.60.`
                 );
            }
        }
    }, 500); 
}

window.selectPlannerTrip = function(index) {
    const resultsContainer = document.getElementById('planner-results-list');
    const idx = parseInt(index);
    if (!currentTripOptions || !currentTripOptions[idx]) return;
    
    const isNextDay = currentTripOptions[0].dayLabel !== undefined;
    
    if (isNextDay) {
        // Infer title context
        const title = currentDayType === 'sunday' ? "No Service Today" : "No more trains today";
        renderNoMoreTrainsResult(resultsContainer, currentTripOptions, idx, title);
    } else {
        renderTripResult(resultsContainer, currentTripOptions, idx);
    }
};

// --- LOGIC: DIRECT TRIPS ---
function planDirectTrip(origin, dest) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    const commonRoutes = [...originRoutes].filter(x => destRoutes.has(x));

    if (commonRoutes.length === 0) return { status: 'NO_PATH' };

    let bestTrips = [];
    let nextDayTrips = [];
    let pathFoundToday = false;
    let pathExistsGenerally = false;

    for (const routeId of commonRoutes) {
        const routeConfig = ROUTES[routeId];
        
        // A. Check Today's Schedule
        let directions = getDirectionsForRoute(routeConfig, currentDayType);
        for (let dir of directions) {
            if (!fullDatabase || !fullDatabase[dir.key]) continue;
            
            const schedule = parseJSONSchedule(fullDatabase[dir.key]);
            const originRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(origin));
            const destRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(dest));

            if (originRow && destRow) {
                const originIdx = schedule.rows.indexOf(originRow);
                const destIdx = schedule.rows.indexOf(destRow);

                if (originIdx < destIdx) {
                    pathFoundToday = true; // We found the path in today's sheets (even if empty)
                    pathExistsGenerally = true;
                    
                    const upcomingTrains = findUpcomingTrainsForLeg(schedule, originRow, destRow);
                    
                    if (upcomingTrains.length > 0) {
                        const tripObjects = upcomingTrains.map(info => 
                            createTripObject(routeConfig, info, schedule, originIdx, destIdx, origin, dest)
                        );
                        bestTrips = [...bestTrips, ...tripObjects];
                    }
                }
            }
        }

        // B. Check Next Day (Fallback if no trips today OR if path not found today - e.g. Sunday using Sat sheets)
        // If we didn't find trips today, OR if we simply want to be robust, check next day.
        if (bestTrips.length === 0) {
             const next = findNextDayTrips(routeConfig, origin, dest);
             if (next && next.length > 0) {
                 nextDayTrips = [...nextDayTrips, ...next];
                 pathExistsGenerally = true;
             }
        }
    }

    // Sort Results
    if (bestTrips.length > 0) {
        bestTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime));
        return { status: 'FOUND', trips: bestTrips };
    }
    
    if (nextDayTrips.length > 0) {
        nextDayTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime));
        // Distinguish between "Train Left" (Late Night) and "No Service" (Sunday)
        // If we found the path in today's sheet but no trains -> Late Night (NO_MORE_TODAY)
        // If we didn't find path today (Sunday) but found it tomorrow -> No Service Today (NO_SERVICE_TODAY_FUTURE_FOUND)
        // NOTE: On Sunday, pathFoundToday might be false if the sheet is empty or missing. 
        
        const status = pathFoundToday ? 'NO_MORE_TODAY' : 'NO_SERVICE_TODAY_FUTURE_FOUND';
        return { status: status, trips: nextDayTrips };
    }

    if (pathExistsGenerally || pathFoundToday) return { status: 'NO_SERVICE' }; 
    return { status: 'NO_PATH' };
}

// --- LOGIC: INTER-ROUTE / HUB TRANSFERS (V3.60) ---
function planHubTransferTrip(origin, dest) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    
    // Define Hubs
    const HUBS = ['PRETORIA STATION', 'GERMISTON STATION', 'JOHANNESBURG STATION']; 
    let potentialHubs = [];

    // 1. Identify which hub connects Origin and Dest
    for (const hub of HUBS) {
        // Can we get from Origin to Hub?
        const toHub = [...originRoutes].some(rId => {
            const r = ROUTES[rId];
            return normalizeStationName(r.destA) === normalizeStationName(hub) || normalizeStationName(r.destB) === normalizeStationName(hub);
        });
        
        // Can we get from Hub to Dest?
        const fromHub = [...destRoutes].some(rId => {
            const r = ROUTES[rId];
            return normalizeStationName(r.destA) === normalizeStationName(hub) || normalizeStationName(r.destB) === normalizeStationName(hub);
        });

        if (toHub && fromHub) {
            potentialHubs.push(hub);
        }
    }

    // Also check for "Within Route" transfers defined in config
    [...originRoutes].forEach(rId => {
        const r = ROUTES[rId];
        if(r.transferStation && !potentialHubs.includes(normalizeStationName(r.transferStation))) {
             potentialHubs.push(r.transferStation);
        }
    });

    if (potentialHubs.length === 0) return { status: 'NO_PATH' };

    let allTransferOptions = [];

    // 2. Iterate Hubs and find paths
    for (const hub of potentialHubs) {
        // Find ALL routes from Origin -> Hub
        const leg1Options = findAllLegsBetween(origin, hub, originRoutes);
        if (leg1Options.length === 0) continue;

        // Find ALL routes from Hub -> Dest
        const leg2Options = findAllLegsBetween(hub, dest, destRoutes); 
        if (leg2Options.length === 0) continue;

        // 3. Match Connections
        const TRANSFER_BUFFER_SEC = 3 * 60; // 3 Min Buffer

        leg1Options.forEach(leg1 => {
            const arrivalSec = timeToSeconds(leg1.arrTime);
            
            // Find valid Leg 2s
            leg2Options.forEach(leg2 => {
                const departSec = timeToSeconds(leg2.depTime);
                if (departSec > (arrivalSec + TRANSFER_BUFFER_SEC)) {
                    allTransferOptions.push({
                        type: 'TRANSFER',
                        route: leg1.route, 
                        from: origin,
                        to: dest,
                        transferStation: hub,
                        depTime: leg1.depTime,
                        arrTime: leg2.arrTime,
                        train: leg1.train,
                        leg1: leg1,
                        leg2: leg2,
                        totalDuration: (timeToSeconds(leg2.arrTime) - timeToSeconds(leg1.depTime))
                    });
                }
            });
        });
    }

    if (allTransferOptions.length > 0) {
        // Sort by Departure Time first, then Total Duration
        allTransferOptions.sort((a,b) => {
            const depDiff = timeToSeconds(a.depTime) - timeToSeconds(b.depTime);
            if (depDiff !== 0) return depDiff;
            return a.totalDuration - b.totalDuration;
        });
        
        // Remove duplicates and keep only best connection for each departure time
        const unique = [];
        const seenDepTimes = new Set();
        
        allTransferOptions.forEach(opt => {
            if(!seenDepTimes.has(opt.depTime)) {
                seenDepTimes.add(opt.depTime);
                unique.push(opt);
            }
        });

        return { status: 'FOUND', trips: unique };
    }

    return { status: 'NO_PATH' };
}

// Helper: Generic "Find all trains between A and B" across specific routes
function findAllLegsBetween(stationA, stationB, routeSet) {
    let legs = [];
    const routesToCheck = routeSet ? [...routeSet] : Object.keys(ROUTES);

    for (const rId of routesToCheck) {
        const routeConfig = ROUTES[rId];
        let directions = getDirectionsForRoute(routeConfig, currentDayType);

        for (let dir of directions) {
            if (!fullDatabase || !fullDatabase[dir.key]) continue;
            const schedule = parseJSONSchedule(fullDatabase[dir.key]);
            
            const rowA = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(stationA));
            const rowB = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(stationB));

            if (rowA && rowB) {
                const idxA = schedule.rows.indexOf(rowA);
                const idxB = schedule.rows.indexOf(rowB);

                if (idxA < idxB) {
                    const trains = findUpcomingTrainsForLeg(schedule, rowA, rowB);
                    trains.forEach(t => {
                        legs.push(createTripObject(routeConfig, t, schedule, idxA, idxB, stationA, stationB));
                    });
                }
            }
        }
    }
    return legs;
}

// [EXISTING HELPERS: findNextDayTrips, getDirectionsForRoute, etc. REMAIN UNCHANGED]
function findNextDayTrips(routeConfig, origin, dest) {
    let nextDayType = 'weekday';
    let dayName = 'Tomorrow';
    
    // Explicit Next Day Logic
    if (currentDayIndex === 5) { nextDayType = 'saturday'; dayName = 'Saturday'; } 
    else if (currentDayIndex === 6) { nextDayType = 'weekday'; dayName = 'Monday'; } 
    else if (currentDayIndex === 0) { nextDayType = 'weekday'; dayName = 'Monday'; } 
    else { nextDayType = 'weekday'; dayName = 'Tomorrow'; }

    let directions = getDirectionsForRoute(routeConfig, nextDayType);
    let allNextDayTrains = [];

    for (let dir of directions) {
         if (!fullDatabase || !fullDatabase[dir.key]) continue;
         const schedule = parseJSONSchedule(fullDatabase[dir.key]);
         
         const originRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(origin));
         const destRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(dest));
         
         if (originRow && destRow) {
             const originIdx = schedule.rows.indexOf(originRow);
             const destIdx = schedule.rows.indexOf(destRow);

             if (originIdx < destIdx) {
                 const trains = schedule.headers.slice(1);
                 
                 trains.forEach(tName => {
                     const dTime = originRow[tName];
                     const aTime = destRow[tName];
                     if(dTime && aTime) {
                         allNextDayTrains.push({ trainName: tName, depTime: dTime, arrTime: aTime });
                     }
                 });
             }
         }
    }
    
    if (allNextDayTrains.length > 0) {
        allNextDayTrains.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime));
        return allNextDayTrains.map(info => {
            const trip = createTripObject(routeConfig, info, null, 0, 0, origin, dest); 
            trip.dayLabel = dayName;
            return trip;
        });
    }
    return [];
}

function getDirectionsForRoute(route, dayType) {
    let dirs = [];
    if (dayType === 'weekday') {
        dirs.push({ key: route.sheetKeys.weekday_to_a });
        dirs.push({ key: route.sheetKeys.weekday_to_b });
    } else {
        dirs.push({ key: route.sheetKeys.saturday_to_a });
        dirs.push({ key: route.sheetKeys.saturday_to_b });
    }
    return dirs;
}

function createTripObject(route, trainInfo, schedule, startIdx, endIdx, origin, dest) {
    const trip = {
        type: 'DIRECT',
        route: route,
        from: origin,
        to: dest,
        train: trainInfo.trainName,
        depTime: trainInfo.depTime,
        arrTime: trainInfo.arrTime,
        stops: []
    };
    
    if (schedule && startIdx !== undefined && endIdx !== undefined) {
        trip.stops = getIntermediateStops(schedule, startIdx, endIdx, trainInfo.trainName);
    }
    return trip;
}

function findUpcomingTrainsForLeg(schedule, originRow, destRow) {
    const nowSeconds = timeToSeconds(currentTime);
    const trains = schedule.headers.slice(1);
    
    let upcomingTrains = [];

    trains.forEach(trainName => {
        const depTime = originRow[trainName];
        const arrTime = destRow[trainName];
        
        if (depTime && arrTime) {
            const depSeconds = timeToSeconds(depTime);
            if (depSeconds >= nowSeconds) {
                upcomingTrains.push({
                    trainName: trainName,
                    depTime: depTime,
                    arrTime: arrTime,
                    seconds: depSeconds
                });
            }
        }
    });

    upcomingTrains.sort((a, b) => a.seconds - b.seconds);
    return upcomingTrains; 
}

function getIntermediateStops(schedule, startIndex, endIndex, trainName) {
    let stops = [];
    for (let i = startIndex; i <= endIndex; i++) {
        const row = schedule.rows[i];
        const time = row[trainName];
        if (time) {
            stops.push({
                station: row.STATION,
                time: time
            });
        }
    }
    return stops;
}

// UI Renderers
function renderTripResult(container, trips, selectedIndex = 0) {
    const selectedTrip = trips[selectedIndex];
    if (!selectedTrip) return;
    container.innerHTML = generateTripCardHTML(selectedTrip, false, trips, selectedIndex);
}

function renderNoMoreTrainsResult(container, trips, selectedIndex = 0, title = "No more trains today") {
    const selectedTrip = trips[selectedIndex];
    const html = `
        <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
            <div class="flex items-center mb-3">
                <span class="text-2xl mr-3">🌙</span>
                <div>
                    <h3 class="font-bold text-orange-800 dark:text-orange-200">${title}</h3>
                    <p class="text-xs text-orange-700 dark:text-orange-300">Showing trains for <b>${selectedTrip.dayLabel || 'Tomorrow'}</b></p>
                </div>
            </div>
            ${generateTripCardHTML(selectedTrip, true, trips, selectedIndex)}
        </div>
    `;
    container.innerHTML = html;
}

function renderErrorCard(title, message) {
    return `
        <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 text-center">
            <h3 class="font-bold text-yellow-800 dark:text-yellow-200 mb-1">${title}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">${message}</p>
        </div>
    `;
}

// UPDATED HTML GENERATOR (Improved transfer text)
function generateTripCardHTML(step, isNextDay = false, allOptions = [], selectedIndex = 0) {
    let timelineHtml = '';
    
    // --- DIRECT TRIP TIMELINE ---
    if (step.type === 'DIRECT') {
        if (step.stops && step.stops.length > 0) {
            timelineHtml = '<div class="mt-4 border-l-2 border-gray-300 dark:border-gray-600 ml-2 space-y-4">';
            step.stops.forEach((stop, i) => {
                const isFirst = i === 0;
                const isLast = i === step.stops.length - 1;
                const circleClass = (isFirst || isLast) ? "bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900" : "bg-gray-400";
                const textClass = (isFirst || isLast) ? "font-bold text-gray-900 dark:text-white text-sm" : "text-gray-500 dark:text-gray-400 text-xs";
                
                timelineHtml += `
                    <div class="relative pl-6">
                        <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full ${circleClass}"></div>
                        <div class="flex justify-between items-center">
                            <span class="${textClass}">${stop.station.replace(' STATION', '')}</span>
                            <span class="font-mono ${textClass}">${stop.time}</span>
                        </div>
                    </div>
                `;
            });
            timelineHtml += '</div>';
        }
    } 
    // --- TRANSFER TRIP TIMELINE ---
    else if (step.type === 'TRANSFER') {
        timelineHtml = '<div class="mt-4 border-l-2 border-gray-300 dark:border-gray-600 ml-2 space-y-6">';
        
        // Leg 1
        timelineHtml += `
            <div class="relative pl-6">
                <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                <div class="flex flex-col">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${step.from.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${step.leg1.depTime}</span>
                    </div>
                    <div class="text-xs text-blue-500 font-medium">Train ${step.leg1.train}</div>
                </div>
            </div>
        `;

        // Calculate Transfer Wait Time
        const arrivalSec = timeToSeconds(step.leg1.arrTime);
        const departSec = timeToSeconds(step.leg2.depTime);
        let waitMinutes = Math.floor((departSec - arrivalSec) / 60);
        
        // Format wait time string
        let waitString = `${waitMinutes} Minutes`;
        if (waitMinutes > 59) {
            const hrs = Math.floor(waitMinutes / 60);
            const mins = waitMinutes % 60;
            waitString = `${hrs} hr ${mins > 0 ? mins + ' min' : ''}`;
        }

        // Transfer Point (Arrival)
        timelineHtml += `
            <div class="relative pl-6">
                <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900"></div>
                <div class="flex flex-col">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">Arrive at ${step.transferStation.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${step.leg1.arrTime}</span>
                    </div>
                    <div class="text-xs text-yellow-600 dark:text-yellow-400 font-medium bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded border border-yellow-100 dark:border-yellow-800">
                        <span class="block font-bold">⚠️ Move to the correct platform</span>
                        <span class="block mt-1">Wait ${waitString}</span>
                    </div>
                </div>
            </div>
        `;

        // Leg 2 (Departure)
        timelineHtml += `
            <div class="relative pl-6">
                <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                <div class="flex flex-col">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">Depart at ${step.transferStation.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${step.leg2.depTime}</span>
                    </div>
                    <div class="text-xs text-blue-500 font-medium">Train ${step.leg2.train}</div>
                </div>
            </div>
        `;

        // Final Destination
        timelineHtml += `
            <div class="relative pl-6">
                <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-green-600 ring-4 ring-green-100 dark:ring-green-900"></div>
                <div class="flex justify-between items-center">
                    <span class="font-bold text-gray-900 dark:text-white text-sm">${step.to.replace(' STATION', '')}</span>
                    <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${step.leg2.arrTime}</span>
                </div>
            </div>
        `;
        timelineHtml += '</div>';
    }

    const routeName = step.route.name;
    const timeColorClass = isNextDay ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400";
    const headerLabel = step.type === 'TRANSFER' ? 'Transfer Trip' : (isNextDay ? 'Future Trip' : 'Direct Trip');
    const headerBg = step.type === 'TRANSFER' ? 'text-yellow-600 dark:text-yellow-400' : timeColorClass;

    // Build Selector Options
    let optionsHtml = '';
    if (allOptions.length > 1) {
        optionsHtml = `<div class="px-4 pb-2">
            <label class="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Choose Departure:</label>
            <select onchange="selectPlannerTrip(this.value)" class="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded p-2 focus:ring-blue-500 focus:border-blue-500">`;
        
        allOptions.forEach((opt, idx) => {
            const selected = idx === selectedIndex ? 'selected' : '';
            const typeLabel = opt.type === 'TRANSFER' ? 'Transfer' : 'Direct';
            optionsHtml += `<option value="${idx}" ${selected}>${opt.depTime} - ${typeLabel}</option>`;
        });
        
        optionsHtml += `</select></div>`;
    }

    return `
        <div class="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden mb-4">
            
            <!-- HEADER -->
            <div class="p-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold ${headerBg} uppercase tracking-wider">${headerLabel}</span>
                    <span class="text-xs font-bold text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Train ${step.train}</span>
                </div>
                <div class="flex justify-between items-center mt-2">
                    <div class="text-left">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Depart</p>
                        <p class="text-lg font-black text-gray-900 dark:text-white leading-tight">${step.from.replace(' STATION', '')}</p>
                        <p class="text-sm font-bold ${timeColorClass} mt-1">${step.depTime}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Arrive</p>
                        <p class="text-lg font-black text-gray-900 dark:text-white leading-tight">${step.to.replace(' STATION', '')}</p>
                        <p class="text-sm font-bold ${timeColorClass} mt-1">${step.arrTime}</p>
                    </div>
                </div>
            </div>

            <!-- OPTIONS DROPDOWN -->
            ${optionsHtml}

            <!-- INSTRUCTION -->
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/50">
                <div class="flex items-start">
                    <span class="text-xl mr-3">💡</span>
                    <p class="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                        ${step.type === 'TRANSFER' 
                            ? `<b>Transfer Required:</b> Change at <b>${step.transferStation.replace(' STATION','')}</b> to reach your destination.` 
                            : `<b>Instruction:</b> Take train <b>${step.train}</b> on the <b>${routeName}</b> line.`}
                    </p>
                </div>
            </div>

            <!-- TIMELINE -->
            <div class="p-4 bg-white dark:bg-gray-800">
                <p class="text-xs font-bold text-gray-400 uppercase mb-2">Schedule Timeline</p>
                ${timelineHtml}
            </div>

        </div>
    `;
}