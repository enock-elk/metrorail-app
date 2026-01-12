// --- TRIP PLANNER LOGIC (V4.46 - Guardian Edition: Night Mode Fix & Clarity) ---
// - FIX: Late night "Tomorrow Morning" status override.
// - FIX: Transfer connection now shows destination (e.g., "Train 1234 to Mabopane").
// - FIX: "Smart To" filtering prevents selecting same station.
// - LOGIC: Show ALL trains in dropdown, but clarify status.

// State
let plannerOrigin = null;
let plannerDest = null;
let currentTripOptions = []; // Store multiple train options
let selectedPlannerDay = null; // Store user-selected day for planning
let plannerPulse = null; // Heartbeat timer ID

// --- INITIALIZATION ---
function initPlanner() {
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');
    const swapBtn = document.getElementById('planner-swap-btn');
    const searchBtn = document.getElementById('planner-search-btn');
    const resetBtn = document.getElementById('planner-reset-btn');
    const locateBtn = document.getElementById('planner-locate-btn');
    
    // Inject Day Selector
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
        inputSection.insertBefore(daySelectDiv, searchBtn);
        
        const daySelect = document.getElementById('planner-day-select');
        if (typeof currentDayType !== 'undefined') daySelect.value = currentDayType;
        daySelect.addEventListener('change', (e) => selectedPlannerDay = e.target.value);
    }

    // Inject History Container
    if (inputSection && !document.getElementById('planner-history-container')) {
        const historyContainer = document.createElement('div');
        historyContainer.id = 'planner-history-container';
        historyContainer.className = "mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 hidden";
        inputSection.appendChild(historyContainer);
        renderPlannerHistory();
    }

    // --- INFO BUTTON WIRING ---
    const infoBtn = document.getElementById('planner-info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            const helpModal = document.getElementById('help-modal');
            if (helpModal) helpModal.classList.remove('hidden');
        });
    }

    // Developer Mode Access
    const plannerTab = document.getElementById('tab-trip-planner');
    if (plannerTab) {
        let pClickCount = 0;
        let pClickTimer = null;
        plannerTab.addEventListener('click', () => {
            pClickCount++;
            if (pClickTimer) clearTimeout(pClickTimer);
            pClickTimer = setTimeout(() => { pClickCount = 0; }, 1000);
            
            if (pClickCount >= 5) {
                pClickCount = 0;
                const devModal = document.getElementById('dev-modal');
                const pinModal = document.getElementById('pin-modal');
                const pinInput = document.getElementById('pin-input');
                
                if (pinModal) {
                    pinModal.classList.remove('hidden');
                    if(pinInput) { pinInput.value = ''; pinInput.focus(); }
                }
            }
        });
    }

    if (!fromSelect || !toSelect) return;

    // 1. Setup Autocomplete
    setupAutocomplete('planner-from-search', 'planner-from');
    setupAutocomplete('planner-to-search', 'planner-to');

    // 2. Populate Selects
    const populate = (select) => {
        select.innerHTML = '<option value="">Select...</option>';
        if (typeof MASTER_STATION_LIST !== 'undefined') {
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

    // --- NEW: SMART TO FILTERING ---
    const filterToOptions = () => {
        const selectedFrom = fromSelect.value;
        Array.from(toSelect.options).forEach(opt => {
            if (opt.value === selectedFrom && opt.value !== "") {
                opt.disabled = true;
                opt.hidden = true; // Visually hide it too
            } else {
                opt.disabled = false;
                opt.hidden = false;
            }
        });
        
        // If current 'To' is invalid, reset it
        if (toSelect.value === selectedFrom) {
            toSelect.value = "";
            const toInput = document.getElementById('planner-to-search');
            if(toInput) toInput.value = "";
        }
    };
    
    // Attach listener to From dropdown changes
    fromSelect.addEventListener('change', filterToOptions);
    // Also trigger on manual input selection via autocomplete
    const fromInput = document.getElementById('planner-from-search');
    if(fromInput) fromInput.addEventListener('change', filterToOptions);


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
                    const { latitude: userLat, longitude: userLon } = position.coords;
                    let candidates = [];
                    for (const [stationName, coords] of Object.entries(globalStationIndex)) {
                        const dist = getDistanceFromLatLonInKm(userLat, userLon, coords.lat, coords.lon);
                        candidates.push({ stationName, dist });
                    }
                    candidates.sort((a, b) => a.dist - b.dist);

                    if (candidates.length > 0 && candidates[0].dist <= 6) { 
                        const nearest = candidates[0].stationName;
                        fromSelect.value = nearest;
                        const fromInput = document.getElementById('planner-from-search');
                        if(fromInput) fromInput.value = nearest.replace(' STATION', '');
                        
                        // Trigger Smart Filter
                        filterToOptions();
                        
                        showToast(`Located: ${nearest.replace(' STATION', '')}`, "success");
                    } else {
                        showToast("No stations found nearby.", "error");
                    }
                    icon.classList.remove('animate-spin');
                },
                () => {
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
        
        [fromSelect.value, toSelect.value] = [toSelect.value, fromSelect.value];
        [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
        
        // Re-run filter after swap
        filterToOptions();
    });

    searchBtn.addEventListener('click', () => {
        const resolveStation = (inputVal, selectEl) => {
            if (selectEl.value) return selectEl.value;
            if (!inputVal || typeof MASTER_STATION_LIST === 'undefined') return "";

            const cleanInput = inputVal.trim().toUpperCase();
            const exact = MASTER_STATION_LIST.find(s => s.replace(' STATION', '').toUpperCase() === cleanInput);
            if (exact) return exact;

            const matches = MASTER_STATION_LIST.filter(s => s.replace(' STATION', '').toUpperCase().includes(cleanInput));
            return matches.length === 1 ? matches[0] : "";
        };

        const fromInput = document.getElementById('planner-from-search');
        const toInput = document.getElementById('planner-to-search');

        if (!fromSelect.value && fromInput) fromSelect.value = resolveStation(fromInput.value, fromSelect);
        if (!toSelect.value && toInput) toSelect.value = resolveStation(toInput.value, toSelect);

        const from = fromSelect.value;
        const to = toSelect.value;
        
        if (!from || !to) return showToast("Please select valid stations from the list.", "error");
        if (from === to) return showToast("Origin and Destination cannot be the same.", "error");

        savePlannerHistory(from, to);
        executeTripPlan(from, to);
    });

    resetBtn.addEventListener('click', () => {
        // STOP PULSE
        if (plannerPulse) { clearInterval(plannerPulse); plannerPulse = null; }
        
        document.getElementById('planner-input-section').classList.remove('hidden');
        document.getElementById('planner-results-section').classList.add('hidden');
        fromSelect.value = ""; toSelect.value = "";
        document.getElementById('planner-from-search').value = "";
        document.getElementById('planner-to-search').value = "";
        
        // Reset Smart Filter
        Array.from(toSelect.options).forEach(opt => { opt.disabled = false; opt.hidden = false; });
        
        const daySelect = document.getElementById('planner-day-select');
        if (daySelect && typeof currentDayType !== 'undefined') {
            daySelect.value = currentDayType;
            selectedPlannerDay = currentDayType;
        }
    });
}

// --- HISTORY FUNCTIONS ---
function savePlannerHistory(from, to) {
    if (!from || !to) return;
    const cleanFrom = from.replace(' STATION', '');
    const cleanTo = to.replace(' STATION', '');
    const routeKey = `${cleanFrom}|${cleanTo}`;
    
    let history = JSON.parse(localStorage.getItem('plannerHistory') || "[]");
    history = history.filter(item => `${item.from}|${item.to}` !== routeKey);
    history.unshift({ from: cleanFrom, to: cleanTo, fullFrom: from, fullTo: to });
    if (history.length > 4) history = history.slice(0, 4);
    
    localStorage.setItem('plannerHistory', JSON.stringify(history));
    renderPlannerHistory();
}

function renderPlannerHistory() {
    const container = document.getElementById('planner-history-container');
    if (!container) return;
    
    const history = JSON.parse(localStorage.getItem('plannerHistory') || "[]");
    if (history.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="flex items-center justify-between mb-2 px-1">
             <p class="text-xs font-bold text-gray-400 uppercase">Recent Trips</p>
             <button onclick="localStorage.removeItem('plannerHistory'); renderPlannerHistory()" class="text-[10px] text-gray-400 hover:text-red-500">Clear</button>
        </div>
        <div class="flex flex-wrap gap-2">
            ${history.map(item => `
                <button onclick="restorePlannerSearch('${item.fullFrom}', '${item.fullTo}')" 
                    class="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full px-3 py-1.5 shadow-sm hover:border-blue-500 hover:text-blue-500 transition-colors group">
                    <span class="text-xs font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">${item.from} <span class="text-gray-300 mx-1">&rarr;</span> ${item.to}</span>
                </button>
            `).join('')}
        </div>
    `;
}

window.restorePlannerSearch = function(fullFrom, fullTo) {
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');
    const fromInput = document.getElementById('planner-from-search');
    const toInput = document.getElementById('planner-to-search');
    
    if (fromSelect && toSelect) {
        fromSelect.value = fullFrom;
        toSelect.value = fullTo;
        if (fromInput) fromInput.value = fullFrom.replace(' STATION', '');
        if (toInput) toInput.value = fullTo.replace(' STATION', '');
        
        const daySelect = document.getElementById('planner-day-select');
        if (daySelect) {
            selectedPlannerDay = daySelect.value;
        }

        showToast("Restored recent search", "info", 1000);
        executeTripPlan(fullFrom, fullTo);
    }
};

// --- AUTOCOMPLETE HELPER ---
function setupAutocomplete(inputId, selectId) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;

    select.classList.add('hidden');
    if (input.parentNode) input.parentNode.style.position = 'relative';

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
        const matches = val.length === 0 ? MASTER_STATION_LIST : MASTER_STATION_LIST.filter(s => s.includes(val));

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
                    // TRIGGER CHANGE EVENT MANUALLY FOR SMART FILTER
                    const event = new Event('change');
                    select.dispatchEvent(event);
                    
                    list.classList.add('hidden');
                };
                list.appendChild(li);
            });
        }
        list.classList.remove('hidden');
    };

    input.addEventListener('input', () => { select.value = ""; renderList(input.value); });
    input.addEventListener('focus', () => renderList(input.value));
    chevron.addEventListener('click', (e) => { e.stopPropagation(); list.classList.contains('hidden') ? (renderList(input.value), input.focus()) : list.classList.add('hidden'); });
    document.addEventListener('click', (e) => { if (!input.contains(e.target) && !list.contains(e.target) && !chevron.contains(e.target)) list.classList.add('hidden'); });
}

// --- CORE PLANNING LOGIC ---
function executeTripPlan(origin, dest) {
    const resultsContainer = document.getElementById('planner-results-list');
    resultsContainer.innerHTML = '<div class="text-center p-4"><svg class="w-8 h-8 animate-spin mx-auto text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-xs text-gray-500">Calculating route...</p></div>';
    
    document.getElementById('planner-input-section').classList.add('hidden');
    document.getElementById('planner-results-section').classList.remove('hidden');

    if (!selectedPlannerDay) selectedPlannerDay = currentDayType;

    try {
        if (typeof gtag === 'function') {
            gtag('event', 'planner_search', {
                'event_category': 'Engagement',
                'event_label': `${origin.replace(' STATION', '')} to ${dest.replace(' STATION', '')}`,
                'origin': origin,
                'destination': dest,
                'day_type': selectedPlannerDay
            });
            console.log("Analytics: Tracked Search", origin, "->", dest);
        }
    } catch (e) {
        console.warn("Analytics Error:", e);
    }

    setTimeout(() => {
        // Run BOTH strategies and combine valid results
        const directPlan = planDirectTrip(origin, dest);
        const transferPlan = planHubTransferTrip(origin, dest);
        
        let mergedTrips = [];
        
        if (directPlan.trips) mergedTrips = [...mergedTrips, ...directPlan.trips];
        if (transferPlan.trips) mergedTrips = [...mergedTrips, ...transferPlan.trips];
        
        // --- DIRECT SUPERIORITY & SAME-ROUTE FILTER ---
        const directDepartureTimes = new Set();
        mergedTrips.forEach(t => {
            if (t.type === 'DIRECT') directDepartureTimes.add(t.depTime);
        });

        const uniqueTrips = [];
        const seenKeys = new Set();
        
        mergedTrips.forEach(trip => {
            // Filter 1: Phantom Transfer Check
            if (trip.type === 'TRANSFER' && directDepartureTimes.has(trip.depTime)) {
                return; 
            }

            // Filter 2: Standard Deduplication
            const key = `${trip.train}-${trip.depTime}-${trip.type}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueTrips.push(trip);
            }
        });
        
        // Sort by Departure Time (earliest first)
        uniqueTrips.sort((a, b) => {
            const tA = timeToSeconds(a.depTime);
            const tB = timeToSeconds(b.depTime);
            if (tA !== tB) return tA - tB;
            // Fallback: Prioritize DIRECT over TRANSFER if times equal
            if (a.type === 'DIRECT' && b.type !== 'DIRECT') return -1;
            if (b.type === 'DIRECT' && a.type !== 'DIRECT') return 1;
            return 0;
        });

        currentTripOptions = uniqueTrips;
        
        if (currentTripOptions.length > 0) {
            // Smart Selection Logic (Night Owl)
            let nextTripIndex = 0;
            if (!selectedPlannerDay || selectedPlannerDay === currentDayType) {
                const nowSec = timeToSeconds(currentTime);
                // Night Owl Check: After 8 PM (20:00)
                const isLateNight = nowSec > (20 * 3600);
                
                if (isLateNight) {
                    // Try to find the first train of the NEXT day (e.g., 4 AM)
                    // We assume anything < 12:00 is 'next morning' relative to 20:00
                    const morningIdx = currentTripOptions.findIndex(t => timeToSeconds(t.depTime) < (12 * 3600));
                    if (morningIdx !== -1) nextTripIndex = morningIdx;
                } else {
                    // Standard: Find next upcoming train
                    const idx = currentTripOptions.findIndex(t => timeToSeconds(t.depTime) >= nowSec);
                    if (idx !== -1) nextTripIndex = idx;
                    else nextTripIndex = currentTripOptions.length - 1; 
                }
            }
            
            renderSelectedTrip(resultsContainer, nextTripIndex);
            
            // --- START LIVE PULSE ---
            startPlannerPulse(nextTripIndex);

        } else {
            // No trips found at all
            if (directPlan.status === 'SUNDAY_NO_SERVICE' || transferPlan.status === 'SUNDAY_NO_SERVICE') {
                 resultsContainer.innerHTML = renderErrorCard("No Service", "This route exists, but there are no trains scheduled for the selected day.");
            } else if (directPlan.status === 'NO_SERVICE' && transferPlan.status === 'NO_PATH') {
                 resultsContainer.innerHTML = renderErrorCard("No Service", "This route exists, but there are no trains scheduled for the selected day.");
            } else {
                 resultsContainer.innerHTML = renderErrorCard("No Route Found", `We couldn't find a route between these stations. Transfers between different corridors are coming soon.`);
            }
        }
    }, 500); 
}

function renderSelectedTrip(container, index) {
    const selectedTrip = currentTripOptions[index];
    const isTomorrow = selectedTrip.dayLabel !== undefined;
    const nowSec = timeToSeconds(currentTime);
    
    // Updated Night Owl Logic: 
    // If it is late night (> 20:00) AND the selected trip is early morning (< 12:00),
    // Treat it as 'effectively tomorrow' for rendering purposes
    const isLateNight = nowSec > (20 * 3600);
    const effectivelyTomorrow = isTomorrow || (isLateNight && timeToSeconds(selectedTrip.depTime) < (12 * 3600));

    if (effectivelyTomorrow) {
        renderNoMoreTrainsResult(container, currentTripOptions, index, "No more trains today");
    } else {
        renderTripResult(container, currentTripOptions, index);
    }
}

// --- GUARDIAN UPDATE: PASSIVE PERSISTENCE PULSE ---
function startPlannerPulse(currentIndex) {
    // Clear any existing pulse
    if (plannerPulse) clearInterval(plannerPulse);
    
    // Safety check: Only pulse if we are looking at 'Today'
    if (selectedPlannerDay && selectedPlannerDay !== currentDayType) return;

    let trackedIndex = currentIndex;

    plannerPulse = setInterval(() => {
        const trip = currentTripOptions[trackedIndex];
        if (!trip) return;

        const nowSec = timeToSeconds(currentTime);
        const depSec = timeToSeconds(trip.depTime);
        
        // 1. UPDATE UI: Always re-render to update countdowns
        // (This ensures status changes from "Departs in 1m" to "Departed" automatically)
        
        // Check dropdown to ensure we render the user's currently selected index, not just the tracked one
        const dropdown = document.querySelector('#planner-results-list select');
        if(dropdown) trackedIndex = parseInt(dropdown.value);
        
        // Re-render the current card in place
        renderSelectedTrip(document.getElementById('planner-results-list'), trackedIndex);

        // NOTE: We do NOT auto-advance (trackedIndex++) anymore.
        // We let the user see "Departed" state and decide to change trains manually.

    }, 30000); // Update every 30 seconds
}

window.selectPlannerTrip = function(index) {
    const idx = parseInt(index);
    if (!currentTripOptions || !currentTripOptions[idx]) return;
    
    renderSelectedTrip(document.getElementById('planner-results-list'), idx);
    
    // Restart pulse with new index focus
    startPlannerPulse(idx);
};

// --- ALGORITHMS: DIRECT & TRANSFER ---
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

    // SUNDAY CHECK
    if (planningDay === 'sunday') {
        for (const routeId of commonRoutes) {
            const routeConfig = ROUTES[routeId];
            const next = findNextDayTrips(routeConfig, origin, dest, 'sunday');
            if (next && next.length > 0) {
                nextDayTrips = [...nextDayTrips, ...next];
            }
        }
        if (nextDayTrips.length > 0) {
            return { status: 'SUNDAY_NO_SERVICE', trips: nextDayTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime)) };
        }
        return { status: 'NO_SERVICE' };
    }

    for (const routeId of commonRoutes) {
        const routeConfig = ROUTES[routeId];
        const directions = getDirectionsForRoute(routeConfig, planningDay);
        
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
                    // Note: findUpcomingTrainsForLeg logic assumes 'today', but we want ALL for planning
                    const upcomingTrains = findUpcomingTrainsForLeg(schedule, originRow, destRow, true); 
                    if (upcomingTrains.length > 0) {
                        bestTrips = [...bestTrips, ...upcomingTrains.map(info => 
                            createTripObject(routeConfig, info, schedule, originIdx, destIdx, origin, dest)
                        )];
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

    if (bestTrips.length > 0) return { status: 'FOUND', trips: bestTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime)) };
    if (nextDayTrips.length > 0) return { status: pathFoundToday ? 'NO_MORE_TODAY' : 'NO_SERVICE_TODAY_FUTURE_FOUND', trips: nextDayTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime)) };
    return { status: (pathExistsGenerally || pathFoundToday) ? 'NO_SERVICE' : 'NO_PATH' };
}

function planHubTransferTrip(origin, dest) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    const planningDay = selectedPlannerDay || currentDayType;
    
    // START OPTIMIZED LOGIC
    const HUBS = ['PRETORIA STATION', 'GERMISTON STATION', 'JOHANNESBURG STATION', 'KEMPTON PARK STATION', 'HERCULES STATION', 'PRETORIA WEST STATION', 'WINTERSNEST STATION', 'WOLMERTON STATION', 'PRETORIA NOORD STATION', 'KOEDOESPOORT STATION']; 
    
    let dynamicHubs = new Set(HUBS);
    
    // Add dynamic hubs from config
    [...originRoutes].forEach(rId => {
        if(ROUTES[rId] && ROUTES[rId].transferStation) dynamicHubs.add(normalizeStationName(ROUTES[rId].transferStation));
    });
    [...destRoutes].forEach(rId => {
        if(ROUTES[rId] && ROUTES[rId].transferStation) dynamicHubs.add(normalizeStationName(ROUTES[rId].transferStation));
    });

    const potentialHubs = [...dynamicHubs].filter(hub => {
        const hubData = globalStationIndex[normalizeStationName(hub)];
        if (!hubData) return false;
        
        const toHub = [...originRoutes].some(rId => hubData.routes.has(rId));
        const fromHub = [...destRoutes].some(rId => hubData.routes.has(rId));
        const isTrivial = (normalizeStationName(hub) === normalizeStationName(origin)) || (normalizeStationName(hub) === normalizeStationName(dest));
        
        return toHub && fromHub && !isTrivial;
    });

    if (potentialHubs.length === 0) return { status: 'NO_PATH' };

    // SUNDAY CHECK
    if (planningDay === 'sunday') {
        const mondayPlan = planHubTransferTripForNextDay(origin, dest, potentialHubs);
        if (mondayPlan.trips.length > 0) {
             return { status: 'SUNDAY_NO_SERVICE', trips: mondayPlan.trips };
        }
        return { status: 'NO_SERVICE' };
    }

    let allTransferOptions = [];
    for (const hub of potentialHubs) {
        const leg1Options = findAllLegsBetween(origin, hub, originRoutes, planningDay);
        if (leg1Options.length === 0) continue;
        
        const leg2Options = findAllLegsBetween(hub, dest, destRoutes, planningDay); 
        if (leg2Options.length === 0) continue;

        const TRANSFER_BUFFER_SEC = 3 * 60;
        leg1Options.forEach(leg1 => {
            const arrivalSec = timeToSeconds(leg1.arrTime);
            leg2Options.forEach(leg2 => {
                
                // --- CRITICAL FIX: SAME-ROUTE BLOCK ---
                // If Leg 1 and Leg 2 are on the exact same route (e.g., both "pta-pien"), discard.
                // This prevents "back-tracking" suggestions.
                if (leg1.route.id === leg2.route.id) {
                    return; 
                }

                const departSec = timeToSeconds(leg2.depTime);
                if (departSec > (arrivalSec + TRANSFER_BUFFER_SEC)) {
                    allTransferOptions.push({
                        type: 'TRANSFER',
                        route: leg1.route, 
                        from: origin, to: dest,
                        transferStation: hub,
                        depTime: leg1.depTime, arrTime: leg2.arrTime,
                        train: leg1.train, leg1: leg1, leg2: leg2,
                        totalDuration: (timeToSeconds(leg2.arrTime) - timeToSeconds(leg1.depTime))
                    });
                }
            });
        });
    }

    if (allTransferOptions.length > 0) {
        allTransferOptions.sort((a,b) => {
            const depDiff = timeToSeconds(a.depTime) - timeToSeconds(b.depTime);
            return depDiff !== 0 ? depDiff : a.totalDuration - b.totalDuration;
        });
        const unique = [];
        const seenDepTimes = new Set();
        allTransferOptions.forEach(opt => {
            if(!seenDepTimes.has(opt.depTime)) { seenDepTimes.add(opt.depTime); unique.push(opt); }
        });
        return { status: 'FOUND', trips: unique };
    }
    return { status: 'NO_PATH' };
}

// Helper for Sunday Transfer -> Monday
function planHubTransferTripForNextDay(origin, dest, potentialHubs) {
    let allTransferOptions = [];
    const nextDay = 'weekday';
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();

    for (const hub of potentialHubs) {
        const leg1Options = findAllLegsBetween(origin, hub, originRoutes, nextDay);
        if (leg1Options.length === 0) continue;
        const leg2Options = findAllLegsBetween(hub, dest, destRoutes, nextDay); 
        if (leg2Options.length === 0) continue;

        const TRANSFER_BUFFER_SEC = 3 * 60;
        leg1Options.forEach(leg1 => {
            const arrivalSec = timeToSeconds(leg1.arrTime);
            leg2Options.forEach(leg2 => {
                
                // SAME-ROUTE BLOCK (Also for Next Day Logic)
                if (leg1.route.id === leg2.route.id) {
                    return; 
                }

                const departSec = timeToSeconds(leg2.depTime);
                if (departSec > (arrivalSec + TRANSFER_BUFFER_SEC)) {
                    allTransferOptions.push({
                        type: 'TRANSFER',
                        route: leg1.route, 
                        from: origin, to: dest,
                        transferStation: hub,
                        depTime: leg1.depTime, arrTime: leg2.arrTime,
                        train: leg1.train, leg1: leg1, leg2: leg2,
                        totalDuration: (timeToSeconds(leg2.arrTime) - timeToSeconds(leg1.depTime)),
                        dayLabel: 'Monday' 
                    });
                }
            });
        });
    }
    
    if (allTransferOptions.length > 0) {
        allTransferOptions.sort((a,b) => {
            const depDiff = timeToSeconds(a.depTime) - timeToSeconds(b.depTime);
            return depDiff !== 0 ? depDiff : a.totalDuration - b.totalDuration;
        });
        const unique = [];
        const seenDepTimes = new Set();
        allTransferOptions.forEach(opt => {
            if(!seenDepTimes.has(opt.depTime)) { seenDepTimes.add(opt.depTime); unique.push(opt); }
        });
        return { trips: unique };
    }
    return { trips: [] };
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
                    findUpcomingTrainsForLeg(schedule, rowA, rowB, true).forEach(t => {
                        legs.push(createTripObject(routeConfig, t, schedule, idxA, idxB, stationA, stationB));
                    });
                }
            }
        }
    }
    return legs;
}

function findNextDayTrips(routeConfig, origin, dest, baseDay) {
    let dayName = 'Tomorrow', nextDayType = 'weekday';
    
    if (baseDay === 'weekday') { 
        nextDayType = 'weekday'; 
        dayName = 'Tomorrow'; 
    } else if (baseDay === 'saturday') { 
        nextDayType = 'weekday'; 
        dayName = 'Monday'; 
    } else if (baseDay === 'sunday') { 
        nextDayType = 'weekday'; 
        dayName = 'Monday'; 
    }

    let allNextDayTrains = [];
    getDirectionsForRoute(routeConfig, nextDayType).forEach(dir => {
         if (!fullDatabase || !fullDatabase[dir.key]) return;
         const schedule = parseJSONSchedule(fullDatabase[dir.key]);
         const originRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(origin));
         const destRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(dest));
         if (originRow && destRow && schedule.rows.indexOf(originRow) < schedule.rows.indexOf(destRow)) {
             schedule.headers.slice(1).forEach(tName => {
                 const dTime = originRow[tName], aTime = destRow[tName];
                 if(dTime && aTime) allNextDayTrains.push({ trainName: tName, depTime: dTime, arrTime: aTime });
             });
         }
    });
    return allNextDayTrains.map(info => {
        const trip = createTripObject(routeConfig, info, null, 0, 0, origin, dest); 
        trip.dayLabel = dayName;
        return trip;
    });
}

function getDirectionsForRoute(route, dayType) {
    if (dayType === 'weekday') return [{ key: route.sheetKeys.weekday_to_a }, { key: route.sheetKeys.weekday_to_b }];
    if (dayType === 'saturday') return [{ key: route.sheetKeys.saturday_to_a }, { key: route.sheetKeys.saturday_to_b }];
    return []; 
}

function createTripObject(route, trainInfo, schedule, startIdx, endIdx, origin, dest) {
    return {
        type: 'DIRECT', route: route, from: origin, to: dest,
        train: trainInfo.trainName, depTime: trainInfo.depTime, arrTime: trainInfo.arrTime,
        stops: (schedule && startIdx !== undefined) ? getIntermediateStops(schedule, startIdx, endIdx, trainInfo.trainName) : []
    };
}

function findUpcomingTrainsForLeg(schedule, originRow, destRow, allowPast = false) {
    const isToday = (!selectedPlannerDay || selectedPlannerDay === currentDayType);
    const nowSeconds = (isToday && !allowPast) ? timeToSeconds(currentTime) : 0; 
    let upcomingTrains = [];
    schedule.headers.slice(1).forEach(trainName => {
        const depTime = originRow[trainName], arrTime = destRow[trainName];
        if (depTime && arrTime) {
            const depSeconds = timeToSeconds(depTime);
            if (depSeconds >= 0) upcomingTrains.push({ trainName, depTime, arrTime, seconds: depSeconds });
        }
    });
    return upcomingTrains.sort((a, b) => a.seconds - b.seconds);
}

function getIntermediateStops(schedule, startIndex, endIndex, trainName) {
    let stops = [];
    for (let i = startIndex; i <= endIndex; i++) {
        const row = schedule.rows[i];
        if (row[trainName]) stops.push({ station: row.STATION, time: row[trainName] });
    }
    return stops;
}

// --- UI RENDERING ---

function getPlanningDayLabel() {
    const day = selectedPlannerDay || currentDayType;
    if (day === 'sunday') return "Sunday / Public Holiday";
    if (day === 'saturday') return "Saturday Schedule";
    return "Weekday Schedule";
}

function renderTripResult(container, trips, selectedIndex = 0) {
    const selectedTrip = trips[selectedIndex];
    const dayLabel = getPlanningDayLabel();
    const infoHtml = `<div class="mb-3 px-1 text-center"><p class="text-xs text-gray-500 dark:text-gray-400">Planning for: <span class="font-bold text-blue-600 dark:text-blue-400">${dayLabel}</span></p></div>`;
    
    if (selectedTrip) {
        container.innerHTML = infoHtml + PlannerRenderer.buildCard(selectedTrip, false, trips, selectedIndex);
    }
}

function renderNoMoreTrainsResult(container, trips, selectedIndex = 0, title = "No more trains today") {
    const selectedTrip = trips[selectedIndex];
    const dayLabel = getPlanningDayLabel();
    const infoHtml = `<div class="mb-3 px-1 text-center"><p class="text-xs text-gray-500 dark:text-gray-400">Planning for: <span class="font-bold text-blue-600 dark:text-blue-400">${dayLabel}</span></p></div>`;

    container.innerHTML = infoHtml + `
        <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
            <div class="flex items-center mb-3">
                <span class="text-2xl mr-3">🚫</span>
                <div>
                    <h3 class="font-bold text-orange-800 dark:text-orange-200">${title}</h3>
                    <p class="text-xs text-orange-700 dark:text-orange-300">Showing trains for <b>${selectedTrip.dayLabel || 'Tomorrow'}</b></p>
                </div>
            </div>
            ${PlannerRenderer.buildCard(selectedTrip, true, trips, selectedIndex)}
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

// --- PLANNER RENDERER ---
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
        return `
            <div class="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden mb-4">
                ${PlannerRenderer.renderHeader(step, isNextDay)}
                ${PlannerRenderer.renderOptionsSelector(allOptions, selectedIndex, isNextDay)}
                ${step.type !== 'TRANSFER' ? PlannerRenderer.renderInstruction(step) : ''}
                <div class="p-4 bg-white dark:bg-gray-800">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-2">Journey Timeline</p>
                    ${PlannerRenderer.renderTimeline(step)}
                </div>
            </div>
        `;
    },

    renderHeader: (step, isNextDay) => {
        const isTransfer = step.type === 'TRANSFER';
        const colorClass = isTransfer ? 'text-yellow-600 dark:text-yellow-400' : (isNextDay ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400');
        const headerLabel = isTransfer ? 'Transfer Trip' : (isNextDay ? 'Future Trip' : 'Direct Trip');
        const { countdown, duration, isDeparted } = PlannerRenderer.calculateTimes(step, isNextDay);

        // Dynamic State UI:
        let stateBadge = "";
        
        // --- NEW: FORCE 'TOMORROW' STATUS ---
        // If isNextDay is TRUE, disregard the countdown and show "Tomorrow Morning"
        if (isNextDay) {
             stateBadge = `<div class="flex items-center text-sm font-bold text-orange-600 dark:text-orange-400">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Tomorrow Morning
                          </div>`;
        } else if (isDeparted) {
            stateBadge = `
                <div class="flex flex-col items-start">
                    <div class="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">
                        ${countdown}
                    </div>
                    <button onclick="document.querySelector('#planner-results-list select').selectedIndex += 1; document.querySelector('#planner-results-list select').dispatchEvent(new Event('change'));" class="text-xs text-blue-500 font-bold underline hover:text-blue-600 transition-colors">
                        Missed it? Show Next Train &rarr;
                    </button>
                </div>
            `;
        } else {
            stateBadge = `<div class="flex items-center text-sm font-bold text-blue-600 dark:text-blue-400">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${countdown}
                          </div>`;
        }

        return `
            <div class="p-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold ${colorClass} uppercase tracking-wider">${headerLabel}</span>
                    <span class="text-xs font-bold text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Train ${step.train}</span>
                </div>
                <div class="flex justify-between items-center mt-2">
                    <div class="text-left">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Depart</p>
                        <p class="text-lg font-black text-gray-900 dark:text-white leading-tight">${step.from.replace(' STATION', '')}</p>
                        <p class="text-base font-black ${colorClass} mt-1">${PlannerRenderer.format12h(step.depTime)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Arrive</p>
                        <p class="text-lg font-black text-gray-900 dark:text-white leading-tight">${step.to.replace(' STATION', '')}</p>
                        <p class="text-base font-black ${colorClass} mt-1">${PlannerRenderer.format12h(step.arrTime)}</p>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                     ${stateBadge}
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
        const nowSec = timeToSeconds(currentTime);
        const isToday = (!selectedPlannerDay || selectedPlannerDay === currentDayType);
        
        const isLateNight = nowSec > (20 * 3600); 

        const optionsHtml = allOptions.map((opt, idx) => {
            const depSec = timeToSeconds(opt.depTime);
            
            let isPast = isToday && depSec < nowSec;
            let label = "";
            
            if (isToday && isLateNight && depSec < (14 * 3600)) {
                isPast = false; // Treat as future (tomorrow)
                label = " (Tomorrow)";
            } else if (isPast) {
                label = " (Departed)";
            }
            
            return `<option value="${idx}" ${idx === selectedIndex ? 'selected' : ''} ${isPast ? 'class="text-gray-400 dark:text-gray-500"' : ''}>
                ${formatTimeDisplay(opt.depTime)} - ${opt.type === 'TRANSFER' ? 'Transfer' : 'Direct'}${label}
            </option>`;
        }).join('');

        return `
            <div class="px-4 pb-2">
                <label class="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Choose Departure:</label>
                <select onchange="selectPlannerTrip(this.value)" class="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded p-2 focus:ring-blue-500 focus:border-blue-500">
                    ${optionsHtml}
                </select>
            </div>
        `;
    },

    renderInstruction: (step) => `
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/50">
            <div class="flex items-start">
                <span class="text-xl mr-3">ℹ️</span>
                <p class="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                    <b>Instruction:</b> Take train <b>${step.train}</b> on the <b>${step.route.name}</b> line.
                </p>
            </div>
        </div>
    `,

    renderTimeline: (step) => {
        if (step.type === 'TRANSFER') return PlannerRenderer.renderTransferTimeline(step);
        
        let html = '<div class="mt-4 border-l-2 border-gray-300 dark:border-gray-600 ml-2 space-y-4">';
        step.stops.forEach((stop, i) => {
            const isEnd = (i === 0 || i === step.stops.length - 1);
            html += `
                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full ${isEnd ? "bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900" : "bg-gray-400"}"></div>
                    <div class="flex justify-between items-center">
                        <span class="${isEnd ? "font-bold text-gray-900 dark:text-white text-sm" : "text-gray-500 dark:text-gray-400 text-xs"}">${stop.station.replace(' STATION', '')}</span>
                        <span class="font-mono ${isEnd ? "font-bold text-gray-900 dark:text-white text-sm" : "text-gray-500 dark:text-gray-400 text-xs"}">${formatTimeDisplay(stop.time)}</span>
                    </div>
                </div>
            `;
        });
        
        return html + `</div>`;
    },

    renderTransferTimeline: (step) => {
        const arrSec = timeToSeconds(step.leg1.arrTime);
        const depSec = timeToSeconds(step.leg2.depTime);
        const waitMins = Math.floor((depSec - arrSec) / 60);
        const waitStr = waitMins > 59 ? `${Math.floor(waitMins/60)} hr ${waitMins%60} min` : `${waitMins} Minutes`;
        
        // --- NEW: CLARITY FIX (Show Destination for Connection) ---
        const connectionDest = step.leg2.to.replace(' STATION', '');

        return `
            <div class="mt-4 border-l-2 border-gray-300 dark:border-gray-600 ml-2 space-y-6">
                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${step.from.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg1.depTime)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium">Train ${step.leg1.train}</div>
                    </div>
                </div>

                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Arrive ${step.transferStation.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg1.arrTime)}</span>
                        </div>
                        <div class="mt-1 text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded border-l-4 border-yellow-500">
                            <div class="font-bold uppercase tracking-wide mb-1">Transfer Required</div>
                            <div class="text-gray-600 dark:text-gray-400">
                                <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${waitStr}</b> Layover</span> &bull; Connect to Train ${step.leg2.train} <span class="font-bold text-blue-600 dark:text-blue-400">(to ${connectionDest})</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${step.transferStation.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg2.depTime)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium">Train ${step.leg2.train}</div>
                    </div>
                </div>

                <div class="relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-green-600 ring-4 ring-green-100 dark:ring-green-900"></div>
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">${step.to.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg2.arrTime)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    calculateTimes: (step, isNextDay) => {
        const nowSec = timeToSeconds(currentTime);
        const depSec = timeToSeconds(step.depTime);
        const arrSec = timeToSeconds(step.arrTime);
        const isToday = (!selectedPlannerDay || selectedPlannerDay === currentDayType);
        
        let countdown = "Scheduled";
        let isDeparted = false;
        
        // --- NIGHT OWL LOGIC FOR COUNTDOWN ---
        const isLateNight = nowSec > (20 * 3600);
        let effectiveDepSec = depSec;
        let isTomorrowOverride = false;

        if (isToday && isLateNight && depSec < (14 * 3600)) {
             effectiveDepSec += 86400; // Shift to tomorrow (add 24h in seconds)
             isTomorrowOverride = true;
        }

        if (isToday || isTomorrowOverride) {
            if (effectiveDepSec > nowSec) {
                const diff = effectiveDepSec - nowSec;
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                countdown = h > 0 ? `Departs in ${h}h ${m}m` : (m === 0 ? "Departs in < 1 min" : `Departs in ${m} min`);
            } else {
                countdown = "Departed";
                isDeparted = true;
            }
        }

        const durSec = arrSec - depSec;
        const h = Math.floor(durSec / 3600);
        const m = Math.floor((durSec % 3600) / 60);
        
        return { countdown, duration: h > 0 ? `${h}h ${m}m` : `${m}m`, isDeparted };
    }
};