// --- TRIP PLANNER LOGIC (V4.09 Optimized) ---

// State
let plannerOrigin = null;
let plannerDest = null;
let currentTripOptions = []; // Store multiple train options
let selectedPlannerDay = null; // Store user-selected day for planning

// --- INITIALIZATION ---
function initPlanner() {
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');
    const swapBtn = document.getElementById('planner-swap-btn');
    const searchBtn = document.getElementById('planner-search-btn');
    const resetBtn = document.getElementById('planner-reset-btn');
    const locateBtn = document.getElementById('planner-locate-btn');
    
    // Inject Day Selector into Input Section
    const inputSection = document.getElementById('planner-input-section');
    if (inputSection && !document.getElementById('planner-day-select')) {
        const daySelectDiv = document.createElement('div');
        daySelectDiv.className = "mb-4";
        daySelectDiv.innerHTML = `
            <label class="block text-xs font-bold text-gray-500 uppercase ml-1 mb-1">Travel Day</label>
            <select id="planner-day-select" class="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500">
                <option value="weekday">Weekday (Mon-Fri)</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday / Public Holiday</option>
            </select>
        `;
        // Insert before the search button
        inputSection.insertBefore(daySelectDiv, searchBtn);
        
        // Set default based on current real time
        const daySelect = document.getElementById('planner-day-select');
        if (typeof currentDayType !== 'undefined') {
            daySelect.value = currentDayType;
        }
        
        // Listen for changes
        daySelect.addEventListener('change', (e) => {
            selectedPlannerDay = e.target.value;
        });
    }

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
            // Use selected day if available, otherwise global currentDayType
            const activeDay = selectedPlannerDay || currentDayType;
            
            let displayType = "";
            if (activeDay === 'sunday') displayType = "No Service / Sunday";
            else if (activeDay === 'saturday') displayType = "Saturday Schedule";
            else displayType = "Weekday Schedule";

            timeEl.innerHTML = `
                <p class="text-base text-gray-700 dark:text-gray-300 font-medium">Current Time: ${currentTime} ${typeof isSimMode !== 'undefined' && isSimMode ? '(SIM)' : ''}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    Planning for: <span class="text-blue-600 dark:text-blue-400 font-bold">${displayType}</span>
                </p>
            `;
        }
    };

    updatePlannerClock();
    setInterval(updatePlannerClock, 1000);

    // Developer Mode Access
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
        // --- AUTO-RESOLVE LOGIC ---
        const resolveStation = (inputVal, selectEl) => {
            if (selectEl.value) return selectEl.value; // Already set properly
            if (!inputVal) return "";
            if (typeof MASTER_STATION_LIST === 'undefined') return "";

            const cleanInput = inputVal.trim().toUpperCase();
            
            // 1. Exact Match
            const exact = MASTER_STATION_LIST.find(s => s.replace(' STATION', '').toUpperCase() === cleanInput);
            if (exact) return exact;

            // 2. Fuzzy Match (if it's the only one)
            const matches = MASTER_STATION_LIST.filter(s => s.replace(' STATION', '').toUpperCase().includes(cleanInput));
            if (matches.length === 1) return matches[0];
            
            return "";
        };

        const fromInput = document.getElementById('planner-from-search');
        const toInput = document.getElementById('planner-to-search');

        // Attempt resolution
        if (!fromSelect.value && fromInput) fromSelect.value = resolveStation(fromInput.value, fromSelect);
        if (!toSelect.value && toInput) toSelect.value = resolveStation(toInput.value, toSelect);

        const from = fromSelect.value;
        const to = toSelect.value;
        
        if (!from || !to) {
            showToast("Please select valid stations from the list.", "error");
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
        
        // Reset day selection to current default
        const daySelect = document.getElementById('planner-day-select');
        if (daySelect && typeof currentDayType !== 'undefined') {
            daySelect.value = currentDayType;
            selectedPlannerDay = currentDayType;
        }
    });
}

// --- AUTOCOMPLETE HELPER ---
function setupAutocomplete(inputId, selectId) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;

    select.classList.add('hidden');
    if (input.parentNode) {
        input.parentNode.style.position = 'relative';
    }

    const chevron = document.createElement('div');
    chevron.className = "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer p-2 hover:text-blue-500 z-10";
    chevron.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
    input.parentNode.appendChild(chevron);

    const list = document.createElement('ul');
    list.className = "absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-xl max-h-60 overflow-y-auto hidden mt-1 left-0";
    input.parentNode.appendChild(list);

    const renderList = (filterText = '') => {
        list.innerHTML = '';
        const val = filterText.toUpperCase();
        
        let matches = [];
        if (val.length === 0) {
            matches = MASTER_STATION_LIST;
        } else {
            matches = MASTER_STATION_LIST.filter(s => s.includes(val));
        }

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
    };

    input.addEventListener('input', () => {
        select.value = ""; 
        renderList(input.value);
    });

    input.addEventListener('focus', () => {
        renderList(input.value);
    });

    chevron.addEventListener('click', (e) => {
        e.stopPropagation(); 
        if (list.classList.contains('hidden')) {
            renderList(input.value);
            input.focus();
        } else {
            list.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !list.contains(e.target) && !chevron.contains(e.target)) {
            list.classList.add('hidden');
        }
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

// --- CORE PLANNING LOGIC ---
function executeTripPlan(origin, dest) {
    const resultsContainer = document.getElementById('planner-results-list');
    
    resultsContainer.innerHTML = '<div class="text-center p-4"><svg class="w-8 h-8 animate-spin mx-auto text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-xs text-gray-500">Calculating route...</p></div>';
    
    document.getElementById('planner-input-section').classList.add('hidden');
    document.getElementById('planner-results-section').classList.remove('hidden');

    if (!selectedPlannerDay) selectedPlannerDay = currentDayType;

    setTimeout(() => {
        // 1. Try Direct Trip First
        const directPlan = planDirectTrip(origin, dest);

        let nextTripIndex = 0;
        if (directPlan.trips && directPlan.trips.length > 0) {
            if (!selectedPlannerDay || selectedPlannerDay === currentDayType) {
                const nowSec = timeToSeconds(currentTime);
                const idx = directPlan.trips.findIndex(t => timeToSeconds(t.depTime) >= nowSec);
                if (idx !== -1) nextTripIndex = idx;
                else nextTripIndex = directPlan.trips.length - 1; 
            }
        }

        if (directPlan.status === 'FOUND') {
            currentTripOptions = directPlan.trips;
            renderTripResult(resultsContainer, currentTripOptions, nextTripIndex);
        } 
        else if (directPlan.status === 'NO_MORE_TODAY') {
            currentTripOptions = directPlan.trips;
            renderNoMoreTrainsResult(resultsContainer, currentTripOptions, 0, "No more trains today");
        }
        else if (directPlan.status === 'NO_SERVICE_TODAY_FUTURE_FOUND') {
            currentTripOptions = directPlan.trips;
            renderNoMoreTrainsResult(resultsContainer, currentTripOptions, 0, "No Service Today");
        }
        else {
            // 2. No Direct? Try Transfer
            const transferPlan = planHubTransferTrip(origin, dest);
            
            let nextTransferIndex = 0;
            if (transferPlan.trips && transferPlan.trips.length > 0) {
                if (!selectedPlannerDay || selectedPlannerDay === currentDayType) {
                    const nowSec = timeToSeconds(currentTime);
                    const idx = transferPlan.trips.findIndex(t => timeToSeconds(t.depTime) >= nowSec);
                    if (idx !== -1) nextTransferIndex = idx;
                }
            }
            
            if (transferPlan.status === 'FOUND') {
                currentTripOptions = transferPlan.trips;
                renderTripResult(resultsContainer, currentTripOptions, nextTransferIndex);
            } 
            else if (directPlan.status === 'NO_SERVICE') {
                 resultsContainer.innerHTML = renderErrorCard("No Service", "This route exists, but there are no trains scheduled for the selected day.");
            } 
            else {
                 resultsContainer.innerHTML = renderErrorCard(
                     "No Route Found", 
                     `We couldn't find a route between these stations. Transfers between different corridors are coming soon.`
                 );
            }
        }
    }, 500); 
}

// UI Binding for Dropdown
window.selectPlannerTrip = function(index) {
    const resultsContainer = document.getElementById('planner-results-list');
    const idx = parseInt(index);
    if (!currentTripOptions || !currentTripOptions[idx]) return;
    
    const isNextDay = currentTripOptions[0].dayLabel !== undefined;
    
    if (isNextDay) {
        const title = selectedPlannerDay === 'sunday' ? "No Service Today" : "No more trains today";
        renderNoMoreTrainsResult(resultsContainer, currentTripOptions, idx, title);
    } else {
        renderTripResult(resultsContainer, currentTripOptions, idx);
    }
};

// --- ALGORITHMS: DIRECT ---
function planDirectTrip(origin, dest) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    const commonRoutes = [...originRoutes].filter(x => destRoutes.has(x));

    if (commonRoutes.length === 0) return { status: 'NO_PATH' };

    let bestTrips = [];
    let nextDayTrips = [];
    let pathFoundToday = false;
    let pathExistsGenerally = false;

    const planningDay = selectedPlannerDay || currentDayType;

    for (const routeId of commonRoutes) {
        const routeConfig = ROUTES[routeId];
        
        let directions = getDirectionsForRoute(routeConfig, planningDay);
        for (let dir of directions) {
            if (!fullDatabase || !fullDatabase[dir.key]) continue;
            
            const schedule = parseJSONSchedule(fullDatabase[dir.key]);
            const originRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(origin));
            const destRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(dest));

            if (originRow && destRow) {
                const originIdx = schedule.rows.indexOf(originRow);
                const destIdx = schedule.rows.indexOf(destRow);

                if (originIdx < destIdx) {
                    pathFoundToday = true; 
                    pathExistsGenerally = true;
                    
                    const upcomingTrains = findUpcomingTrainsForLeg(schedule, originRow, destRow, true);
                    
                    if (upcomingTrains.length > 0) {
                        const tripObjects = upcomingTrains.map(info => 
                            createTripObject(routeConfig, info, schedule, originIdx, destIdx, origin, dest)
                        );
                        bestTrips = [...bestTrips, ...tripObjects];

                        if (typeof findNextDirectTrain === 'function') {
                            const { allJourneys } = findNextDirectTrain(origin, schedule, dest);
                            if (!currentScheduleData) currentScheduleData = {};
                            currentScheduleData[dest] = allJourneys;
                        }
                    }
                }
            }
        }

        if (bestTrips.length === 0) {
             const next = findNextDayTrips(routeConfig, origin, dest, planningDay);
             if (next && next.length > 0) {
                 nextDayTrips = [...nextDayTrips, ...next];
                 pathExistsGenerally = true;
             }
        }
    }

    if (bestTrips.length > 0) {
        bestTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime));
        return { status: 'FOUND', trips: bestTrips };
    }
    
    if (nextDayTrips.length > 0) {
        nextDayTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime));
        const status = pathFoundToday ? 'NO_MORE_TODAY' : 'NO_SERVICE_TODAY_FUTURE_FOUND';
        return { status: status, trips: nextDayTrips };
    }

    if (pathExistsGenerally || pathFoundToday) return { status: 'NO_SERVICE' }; 
    return { status: 'NO_PATH' };
}

// --- ALGORITHMS: TRANSFERS ---
function planHubTransferTrip(origin, dest) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    
    const planningDay = selectedPlannerDay || currentDayType;
    
    const HUBS = [
        'PRETORIA STATION', 'GERMISTON STATION', 'JOHANNESBURG STATION', 'KEMPTON PARK STATION',
        'HERCULES STATION', 'PRETORIA WEST STATION', 'WINTERSNEST STATION', 'WOLMERTON STATION', 'PRETORIA NOORD STATION'
    ]; 
    
    let potentialHubs = [];

    for (const hub of HUBS) {
        const hubNorm = normalizeStationName(hub);
        const hubData = globalStationIndex[hubNorm];
        if (!hubData) continue;

        const toHub = [...originRoutes].some(rId => hubData.routes.has(rId));
        const fromHub = [...destRoutes].some(rId => hubData.routes.has(rId));

        if (toHub && fromHub) potentialHubs.push(hub);
    }

    if (potentialHubs.length === 0) return { status: 'NO_PATH' };

    let allTransferOptions = [];

    for (const hub of potentialHubs) {
        const leg1Options = findAllLegsBetween(origin, hub, originRoutes, planningDay);
        if (leg1Options.length === 0) continue;

        const leg2Options = findAllLegsBetween(hub, dest, destRoutes, planningDay); 
        if (leg2Options.length === 0) continue;

        const TRANSFER_BUFFER_SEC = 3 * 60; // 3 Min Buffer

        leg1Options.forEach(leg1 => {
            const arrivalSec = timeToSeconds(leg1.arrTime);
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
        allTransferOptions.sort((a,b) => {
            const depDiff = timeToSeconds(a.depTime) - timeToSeconds(b.depTime);
            if (depDiff !== 0) return depDiff;
            return a.totalDuration - b.totalDuration;
        });
        
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

function findAllLegsBetween(stationA, stationB, routeSet, dayType) {
    let legs = [];
    const routesToCheck = routeSet ? [...routeSet] : Object.keys(ROUTES);

    for (const rId of routesToCheck) {
        const routeConfig = ROUTES[rId];
        let directions = getDirectionsForRoute(routeConfig, dayType);

        for (let dir of directions) {
            if (!fullDatabase || !fullDatabase[dir.key]) continue;
            const schedule = parseJSONSchedule(fullDatabase[dir.key]);
            
            const rowA = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(stationA));
            const rowB = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(stationB));

            if (rowA && rowB) {
                const idxA = schedule.rows.indexOf(rowA);
                const idxB = schedule.rows.indexOf(rowB);

                if (idxA < idxB) {
                    if (typeof findNextDirectTrain === 'function') {
                        const { allJourneys } = findNextDirectTrain(stationA, schedule, stationB);
                        if (!currentScheduleData) currentScheduleData = {};
                        currentScheduleData[stationB] = allJourneys;
                    }
                    
                    const trains = findUpcomingTrainsForLeg(schedule, rowA, rowB, true);
                    trains.forEach(t => {
                        legs.push(createTripObject(routeConfig, t, schedule, idxA, idxB, stationA, stationB));
                    });
                }
            }
        }
    }
    return legs;
}

function findNextDayTrips(routeConfig, origin, dest, currentDayTypeOverride = null) {
    let dayName = 'Tomorrow';
    let nextDayType = 'weekday';
    
    const baseDay = currentDayTypeOverride || currentDayType;
    
    if (baseDay === 'weekday') { nextDayType = 'weekday'; dayName = 'Tomorrow'; } 
    else if (baseDay === 'saturday') { nextDayType = 'sunday'; dayName = 'Sunday'; }
    else if (baseDay === 'sunday') { nextDayType = 'weekday'; dayName = 'Monday'; }

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

function findUpcomingTrainsForLeg(schedule, originRow, destRow, allowPast = false) {
    const isToday = (!selectedPlannerDay || selectedPlannerDay === currentDayType);
    const nowSeconds = (isToday && !allowPast) ? timeToSeconds(currentTime) : 0; 

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
            stops.push({ station: row.STATION, time: time });
        }
    }
    return stops;
}

// --- UI RENDERING (MODULARIZED) ---

function renderTripResult(container, trips, selectedIndex = 0) {
    const selectedTrip = trips[selectedIndex];
    if (!selectedTrip) return;
    container.innerHTML = PlannerRenderer.buildCard(selectedTrip, false, trips, selectedIndex);
}

function renderNoMoreTrainsResult(container, trips, selectedIndex = 0, title = "No more trains today") {
    const selectedTrip = trips[selectedIndex];
    const cardHtml = PlannerRenderer.buildCard(selectedTrip, true, trips, selectedIndex);
    
    container.innerHTML = `
        <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
            <div class="flex items-center mb-3">
                <span class="text-2xl mr-3">🌙</span>
                <div>
                    <h3 class="font-bold text-orange-800 dark:text-orange-200">${title}</h3>
                    <p class="text-xs text-orange-700 dark:text-orange-300">Showing trains for <b>${selectedTrip.dayLabel || 'Tomorrow'}</b></p>
                </div>
            </div>
            ${cardHtml}
        </div>
    `;
}

function renderErrorCard(title, message) {
    return `
        <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 text-center">
            <h3 class="font-bold text-yellow-800 dark:text-yellow-200 mb-1">${title}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">${message}</p>
        </div>
    `;
}

// --- NEW PLANNER RENDERER (Clean Template Engine) ---
const PlannerRenderer = {
    
    format12h: (timeStr) => {
        if (!timeStr) return "--:--";
        const [h, m] = timeStr.split(':');
        let hour = parseInt(h, 10);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${m} ${suffix}`;
    },

    buildCard: (step, isNextDay, allOptions, selectedIndex) => {
        const header = PlannerRenderer.renderHeader(step, isNextDay);
        const options = PlannerRenderer.renderOptionsSelector(allOptions, selectedIndex, isNextDay);
        const instruction = PlannerRenderer.renderInstruction(step);
        const timeline = PlannerRenderer.renderTimeline(step);

        return `
            <div class="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden mb-4">
                ${header}
                ${options}
                ${instruction}
                <div class="p-4 bg-white dark:bg-gray-800">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-2">Journey Timeline</p>
                    ${timeline}
                </div>
            </div>
        `;
    },

    renderHeader: (step, isNextDay) => {
        const timeColor = isNextDay ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400";
        const headerLabel = step.type === 'TRANSFER' ? 'Transfer Trip' : (isNextDay ? 'Future Trip' : 'Direct Trip');
        const headerBg = step.type === 'TRANSFER' ? 'text-yellow-600 dark:text-yellow-400' : timeColor;

        const depTime = PlannerRenderer.format12h(step.depTime);
        const arrTime = PlannerRenderer.format12h(step.arrTime);
        const { countdown, duration } = PlannerRenderer.calculateTimes(step, isNextDay);

        return `
            <div class="p-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold ${headerBg} uppercase tracking-wider">${headerLabel}</span>
                    <span class="text-xs font-bold text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Train ${step.train}</span>
                </div>
                <div class="flex justify-between items-center mt-2">
                    <div class="text-left">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Depart</p>
                        <p class="text-lg font-black text-gray-900 dark:text-white leading-tight">${step.from.replace(' STATION', '')}</p>
                        <p class="text-base font-black ${timeColor} mt-1">${depTime}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Arrive</p>
                        <p class="text-lg font-black text-gray-900 dark:text-white leading-tight">${step.to.replace(' STATION', '')}</p>
                        <p class="text-base font-black ${timeColor} mt-1">${arrTime}</p>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                     <div class="flex items-center text-sm font-bold text-blue-600 dark:text-blue-400">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        ${countdown}
                     </div>
                     <div class="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Duration: ${duration}
                     </div>
                </div>
            </div>
        `;
    },

    renderOptionsSelector: (allOptions, selectedIndex, isNextDay) => {
        if (!allOptions || allOptions.length <= 1) return '';
        
        let optionsHtml = '';
        const nowSec = timeToSeconds(currentTime);
        const isToday = (!selectedPlannerDay || selectedPlannerDay === currentDayType);

        allOptions.forEach((opt, idx) => {
            const selected = idx === selectedIndex ? 'selected' : '';
            const typeLabel = opt.type === 'TRANSFER' ? 'Transfer' : 'Direct';
            const optTime = formatTimeDisplay(opt.depTime);
            
            // Grey out past trains logic
            const trainSec = timeToSeconds(opt.depTime);
            const isPast = isToday && trainSec < nowSec;
            const pastStyle = isPast ? 'style="color: #9ca3af;"' : ''; 
            const pastLabel = isPast ? ' (Departed)' : '';

            optionsHtml += `<option value="${idx}" ${selected} ${pastStyle} ${isPast ? 'class="text-gray-400"' : ''}>${optTime} - ${typeLabel}${pastLabel}</option>`;
        });

        return `
            <div class="px-4 pb-2">
                <label class="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Choose Departure:</label>
                <select onchange="selectPlannerTrip(this.value)" class="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded p-2 focus:ring-blue-500 focus:border-blue-500">
                    ${optionsHtml}
                </select>
            </div>
        `;
    },

    renderInstruction: (step) => {
        if (step.type === 'TRANSFER') return ''; 
        return `
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/50">
                <div class="flex items-start">
                    <span class="text-xl mr-3">💡</span>
                    <p class="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                        <b>Instruction:</b> Take train <b>${step.train}</b> on the <b>${step.route.name}</b> line.
                    </p>
                </div>
            </div>
        `;
    },

    renderTimeline: (step) => {
        if (step.type === 'TRANSFER') return PlannerRenderer.renderTransferTimeline(step);
        return PlannerRenderer.renderDirectTimeline(step);
    },

    renderDirectTimeline: (step) => {
        if (!step.stops || step.stops.length === 0) return '';
        
        let html = '<div class="mt-4 border-l-2 border-gray-300 dark:border-gray-600 ml-2 space-y-4">';
        step.stops.forEach((stop, i) => {
            const isFirst = i === 0;
            const isLast = i === step.stops.length - 1;
            const circleClass = (isFirst || isLast) ? "bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900" : "bg-gray-400";
            const textClass = (isFirst || isLast) ? "font-bold text-gray-900 dark:text-white text-sm" : "text-gray-500 dark:text-gray-400 text-xs";
            const stopTime = formatTimeDisplay(stop.time);
            
            html += `
                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full ${circleClass}"></div>
                    <div class="flex justify-between items-center">
                        <span class="${textClass}">${stop.station.replace(' STATION', '')}</span>
                        <span class="font-mono ${textClass}">${stopTime}</span>
                    </div>
                </div>
            `;
        });
        
        const safeDest = step.to.replace(/'/g, "\\'").replace(' STATION', '');
        html += `
            <div class="mt-4 pl-6">
                <button onclick="openScheduleModal('${safeDest}')" class="text-xs font-bold text-blue-500 hover:text-blue-600 underline">See Full Schedule</button>
            </div></div>`;
        return html;
    },

    renderTransferTimeline: (step) => {
        const leg1Dep = formatTimeDisplay(step.leg1.depTime);
        const leg1Arr = formatTimeDisplay(step.leg1.arrTime);
        const leg2Dep = formatTimeDisplay(step.leg2.depTime);
        const leg2Arr = formatTimeDisplay(step.leg2.arrTime);

        // Wait time calculation
        const arrivalSec = timeToSeconds(step.leg1.arrTime);
        const departSec = timeToSeconds(step.leg2.depTime);
        let waitMinutes = Math.floor((departSec - arrivalSec) / 60);
        let waitString = waitMinutes > 59 
            ? `<b>${Math.floor(waitMinutes/60)} hr ${waitMinutes%60 > 0 ? (waitMinutes%60)+' min' : ''}</b>` 
            : `<b>${waitMinutes} Minutes</b>`;

        return `
            <div class="mt-4 border-l-2 border-gray-300 dark:border-gray-600 ml-2 space-y-6">
                <!-- Leg 1 Dep -->
                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart from ${step.from.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${leg1Dep}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium">Train ${step.leg1.train}</div>
                    </div>
                </div>

                <!-- Transfer Point -->
                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Arrive at ${step.transferStation.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${leg1Arr}</span>
                        </div>
                        <div class="mt-1 text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded border-l-4 border-yellow-500">
                            <div class="font-bold uppercase tracking-wide mb-1">Transfer Required</div>
                            <div class="text-gray-600 dark:text-gray-400">
                                <span class="font-bold text-gray-900 dark:text-white">⏳ ${waitString} Layover</span> &bull; Connect to Train ${step.leg2.train}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Leg 2 Dep -->
                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart from ${step.transferStation.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${leg2Dep}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium">Train ${step.leg2.train}</div>
                    </div>
                </div>

                <!-- Final Dest -->
                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-green-600 ring-4 ring-green-100 dark:ring-green-900"></div>
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">${step.to.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${leg2Arr}</span>
                    </div>
                </div>
            </div>
        `;
    },

    calculateTimes: (step, isNextDay) => {
        const nowSec = timeToSeconds(currentTime);
        const depSec = timeToSeconds(step.depTime);
        const arrSec = timeToSeconds(step.arrTime);
        
        let countdown = "";
        if ((!selectedPlannerDay || selectedPlannerDay === currentDayType) && depSec > nowSec) {
            const diff = depSec - nowSec;
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            countdown = h > 0 ? `Departs in ${h}h ${m}m` : `Departs in ${m} min`;
        } else if ((!selectedPlannerDay || selectedPlannerDay === currentDayType) && depSec <= nowSec) {
            countdown = "Departed";
        } else if (isNextDay) {
            countdown = "Scheduled";
        }

        let durSec = arrSec - depSec;
        let duration = "";
        if (durSec > 0) {
            const h = Math.floor(durSec / 3600);
            const m = Math.floor((durSec % 3600) / 60);
            duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
        }

        return { countdown, duration };
    }
};