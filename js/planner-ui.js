/**
 * METRORAIL NEXT TRAIN - PLANNER UI (V4.60.14 - Guardian Edition)
 * --------------------------------------------------------------
 * THE "HEAD CHEF" (Controller)
 * * This module handles user interaction, DOM updates, and event listeners.
 * It calls the pure logic functions from planner-core.js.
 */

// State (UI Specific)
let plannerOrigin = null;
let plannerDest = null;
let currentTripOptions = []; 
let selectedPlannerDay = null; 
let plannerPulse = null; 
let plannerExpandedState = new Set(); 

// --- INITIALIZATION ---
function initPlanner() {
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');
    const swapBtn = document.getElementById('planner-swap-btn');
    const searchBtn = document.getElementById('planner-search-btn');
    const resetBtn = document.getElementById('planner-reset-btn');
    const locateBtn = document.getElementById('planner-locate-btn');
    
    // NEW: Action Buttons in Results Header
    const backBtn = document.getElementById('planner-back-btn');

    // Inject Day Selector if missing
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

    // Wiring Info Button
    const infoBtn = document.getElementById('planner-info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            const helpModal = document.getElementById('help-modal');
            if (helpModal) helpModal.classList.remove('hidden');
        });
    }

    // Developer Access (5-Tap)
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
                // Delegate to Global Admin Trigger
                const appTitle = document.getElementById('app-title');
                if (appTitle) appTitle.click(); // Hack to trigger main logic
            }
        });
    }

    if (!fromSelect || !toSelect) return;

    setupAutocomplete('planner-from-search', 'planner-from');
    setupAutocomplete('planner-to-search', 'planner-to');

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

    const filterToOptions = () => {
        const selectedFrom = fromSelect.value;
        Array.from(toSelect.options).forEach(opt => {
            if (opt.value === selectedFrom && opt.value !== "") {
                opt.disabled = true;
                opt.hidden = true; 
            } else {
                opt.disabled = false;
                opt.hidden = false;
            }
        });
        if (toSelect.value === selectedFrom) {
            toSelect.value = "";
            const toInput = document.getElementById('planner-to-search');
            if(toInput) toInput.value = "";
        }
    };
    
    fromSelect.addEventListener('change', filterToOptions);
    const fromInput = document.getElementById('planner-from-search');
    if(fromInput) fromInput.addEventListener('change', filterToOptions);

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
                    // Using globalStationIndex from logic.js
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
                        
                        filterToOptions();
                        showToast(`Located: ${nearest.replace(' STATION', '')}`, "success");
                        
                        if (typeof trackAnalyticsEvent === 'function') {
                            trackAnalyticsEvent('planner_auto_locate', { station: nearest });
                        }
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

    // --- ROBUST SWAP LOGIC (Fixes Empty Swap Bug) ---
    swapBtn.addEventListener('click', () => {
        const fromInput = document.getElementById('planner-from-search');
        const toInput = document.getElementById('planner-to-search');
        
        // 1. Capture Visible Text (Source of Truth)
        let txtFrom = fromInput.value;
        let txtTo = toInput.value;

        // 2. Perform Swap
        fromInput.value = txtTo;
        toInput.value = txtFrom;

        // 3. Resolve to Select Options
        // We use the helper logic to find the exact station ID for the hidden select
        const resolve = (txt) => {
            if (!txt) return "";
            const clean = txt.trim().toUpperCase();
            if (typeof MASTER_STATION_LIST !== 'undefined') {
                return MASTER_STATION_LIST.find(s => s.replace(' STATION', '').toUpperCase() === clean) || "";
            }
            return "";
        };

        fromSelect.value = resolve(toInput.value); // Use 'toInput' because we just swapped it into there? No, fromInput has the NEW 'from' value.
        fromSelect.value = resolve(fromInput.value);
        toSelect.value = resolve(toInput.value);

        // 4. Trigger Filter to update disabled states
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

        if (typeof trackAnalyticsEvent === 'function') {
            trackAnalyticsEvent('planner_search', {
                origin: from,
                destination: to,
                day: selectedPlannerDay || currentDayType || 'unknown'
            });
        }

        savePlannerHistory(from, to);
        executeTripPlan(from, to);
    });

    // --- RESET / BACK BUTTON LOGIC ---
    const resetAction = () => {
        if (plannerPulse) { clearInterval(plannerPulse); plannerPulse = null; }
        
        document.getElementById('planner-input-section').classList.remove('hidden');
        document.getElementById('planner-results-section').classList.add('hidden');
        
        // Don't clear inputs if just going back, allows refinement
        // But reset expanded state
        plannerExpandedState.clear(); 
        
        const daySelect = document.getElementById('planner-day-select');
        if (daySelect && typeof currentDayType !== 'undefined') {
            // Keep user selected day
        }
    };

    if (resetBtn) resetBtn.addEventListener('click', resetAction);
    if (backBtn) backBtn.addEventListener('click', resetAction);
}

// --- UPDATED: SMART SWAP RESULTS FUNCTION ---
window.swapPlannerResults = function() {
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');
    const fromInput = document.getElementById('planner-from-search');
    const toInput = document.getElementById('planner-to-search');

    // 1. Capture Smart Time Context
    let preferredTime = null;
    const dropdown = document.querySelector('#planner-results-list select');
    if (dropdown && currentTripOptions.length > 0) {
        const selectedIdx = parseInt(dropdown.value);
        if (currentTripOptions[selectedIdx]) {
            preferredTime = currentTripOptions[selectedIdx].depTime;
        }
    }

    // 2. Perform Robust Swap (Reading Inputs first)
    if (!fromInput || !toInput) return;
    
    let txtFrom = fromInput.value;
    let txtTo = toInput.value;
    
    // Fallback: If inputs empty (glitch), read selects
    if (!txtFrom && fromSelect.value) txtFrom = fromSelect.value.replace(' STATION', '');
    if (!txtTo && toSelect.value) txtTo = toSelect.value.replace(' STATION', '');

    if (!txtFrom || !txtTo) return; // Cannot swap empty

    // Update Inputs
    fromInput.value = txtTo;
    toInput.value = txtFrom;

    // Resolve IDs
    const resolve = (txt) => {
        if (!txt) return "";
        const clean = txt.trim().toUpperCase();
        if (typeof MASTER_STATION_LIST !== 'undefined') {
            return MASTER_STATION_LIST.find(s => s.replace(' STATION', '').toUpperCase() === clean) || "";
        }
        return "";
    };

    const newFromId = resolve(txtTo);
    const newToId = resolve(txtFrom);

    if (fromSelect) fromSelect.value = newFromId;
    if (toSelect) toSelect.value = newToId;

    showToast("Reversing Direction...", "info", 1000);
    
    // 3. Trigger Search with Context
    executeTripPlan(newFromId, newToId, preferredTime);
};

// --- HISTORY & AUTOCOMPLETE ---
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
        <div class="flex flex-col gap-2">
            ${history.map(item => `
                <button onclick="restorePlannerSearch('${item.fullFrom}', '${item.fullTo}')" 
                    class="w-full flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 shadow-sm hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors group text-left">
                    <span class="text-xs font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        ${item.from} <span class="text-gray-400 mx-1">&rarr;</span> ${item.to}
                    </span>
                    <svg class="w-3 h-3 text-gray-300 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
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
        
        if (typeof trackAnalyticsEvent === 'function') {
            trackAnalyticsEvent('planner_history_restore', { origin: fullFrom, destination: fullTo });
        }

        executeTripPlan(fullFrom, fullTo);
    }
};

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

// --- ORCHESTRATION ---
function executeTripPlan(origin, dest, preferredTime = null) {
    const resultsContainer = document.getElementById('planner-results-list');
    resultsContainer.innerHTML = '<div class="text-center p-4"><svg class="w-8 h-8 animate-spin mx-auto text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-xs text-gray-500">Calculating route...</p></div>';
    
    document.getElementById('planner-input-section').classList.add('hidden');
    document.getElementById('planner-results-section').classList.remove('hidden');
    plannerExpandedState.clear();

    if (!selectedPlannerDay) selectedPlannerDay = currentDayType;

    // Run Asynchronously to prevent UI freeze
    setTimeout(() => {
        // --- CALL TO PLANNER CORE ---
        // We pass 'selectedPlannerDay' to all functions to ensure they are stateless
        const directPlan = planDirectTrip(origin, dest, selectedPlannerDay);
        const transferPlan = planHubTransferTrip(origin, dest, selectedPlannerDay);
        const relayPlan = planRelayTransferTrip(origin, dest, selectedPlannerDay);

        let mergedTrips = [];
        if (directPlan.trips) mergedTrips = [...mergedTrips, ...directPlan.trips];
        if (transferPlan.trips) mergedTrips = [...mergedTrips, ...transferPlan.trips];
        if (relayPlan.trips) mergedTrips = [...mergedTrips, ...relayPlan.trips];

        // 4. Try Double Transfer (Bridge) if results are thin
        if (mergedTrips.length === 0) {
            console.log("No simple route found. Attempting 2-Transfer Bridge...");
            const doubleTransferPlan = planDoubleTransferTrip(origin, dest, selectedPlannerDay);
            if (doubleTransferPlan.trips) {
                mergedTrips = [...mergedTrips, ...doubleTransferPlan.trips];
            }
        }

        // 5. Best-In-Slot Deduplication (UI Logic)
        const bestTripsMap = new Map();
        mergedTrips.forEach(trip => {
            const key = trip.depTime;
            if (!bestTripsMap.has(key)) {
                bestTripsMap.set(key, trip);
            } else {
                const existing = bestTripsMap.get(key);
                if (trip.type === 'DIRECT' && existing.type !== 'DIRECT') {
                    bestTripsMap.set(key, trip); 
                } else if (trip.type === existing.type || (trip.type !== 'DIRECT' && existing.type !== 'DIRECT')) {
                    const existingArr = timeToSeconds(existing.arrTime);
                    const newArr = timeToSeconds(trip.arrTime);
                    if (newArr < existingArr) bestTripsMap.set(key, trip); 
                }
            }
        });

        const uniqueTrips = Array.from(bestTripsMap.values());
        uniqueTrips.sort((a, b) => {
            const depDiff = timeToSeconds(a.depTime) - timeToSeconds(b.depTime);
            if (depDiff !== 0) return depDiff;
            return timeToSeconds(a.arrTime) - timeToSeconds(b.arrTime);
        });
        
        currentTripOptions = uniqueTrips;
        
        if (currentTripOptions.length > 0) {
            let nextTripIndex = 0;
            
            // --- SMART SELECTION LOGIC ---
            if (preferredTime) {
                // Find trip closest to preferred time (e.g. user just swapped)
                const targetSec = timeToSeconds(preferredTime);
                let closestDist = Infinity;
                
                currentTripOptions.forEach((trip, index) => {
                    const tripSec = timeToSeconds(trip.depTime);
                    const dist = Math.abs(tripSec - targetSec);
                    if (dist < closestDist) {
                        closestDist = dist;
                        nextTripIndex = index;
                    }
                });
                console.log(`Smart Swap: Preserved context near ${preferredTime} -> Selected ${currentTripOptions[nextTripIndex].depTime}`);
                
            } else {
                // Default: Next Train from Now
                const nowSec = timeToSeconds(currentTime);
                const isLateNight = nowSec > (20 * 3600);
                
                const idx = currentTripOptions.findIndex(t => timeToSeconds(t.depTime) >= nowSec);
                if (idx !== -1) nextTripIndex = idx;
                else nextTripIndex = currentTripOptions.length - 1;
            }

            renderSelectedTrip(resultsContainer, nextTripIndex);
            startPlannerPulse(nextTripIndex);

        } else {
            // Error Handling (Map Fallback)
            if (typeof trackAnalyticsEvent === 'function') {
                trackAnalyticsEvent('planner_no_result', { origin: origin, destination: dest });
            }

            const errorMsg = "We couldn't find a route within 3 legs. Try checking the <b>Network Map</b> to visualize your path. You may need to plan this journey in segments (e.g., 'Home to Pretoria', then 'Pretoria to Work').";
            const actionBtn = `
                <button onclick="document.getElementById('map-modal').classList.remove('hidden')" class="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors w-full flex items-center justify-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                    Open Network Map
                </button>
            `;
            resultsContainer.innerHTML = renderErrorCard("No Route Found", errorMsg, actionBtn);
        }
    }, 100); 
}

function renderSelectedTrip(container, index) {
    const selectedTrip = currentTripOptions[index];
    const isTomorrow = selectedTrip.dayLabel !== undefined;
    const nowSec = timeToSeconds(currentTime);
    const isLateNight = nowSec > (20 * 3600);
    const effectivelyTomorrow = isTomorrow || (isLateNight && timeToSeconds(selectedTrip.depTime) < (12 * 3600));

    if (effectivelyTomorrow) {
        renderNoMoreTrainsResult(container, currentTripOptions, index, "No more trains today");
    } else {
        renderTripResult(container, currentTripOptions, index);
    }
}

function startPlannerPulse(currentIndex) {
    if (plannerPulse) clearInterval(plannerPulse);
    if (selectedPlannerDay && selectedPlannerDay !== currentDayType) return;

    let trackedIndex = currentIndex;
    plannerPulse = setInterval(() => {
        const trip = currentTripOptions[trackedIndex];
        if (!trip) return;
        const dropdown = document.querySelector('#planner-results-list select');
        if(dropdown) trackedIndex = parseInt(dropdown.value);
        renderSelectedTrip(document.getElementById('planner-results-list'), trackedIndex);
    }, 30000); 
}

window.selectPlannerTrip = function(index) {
    const idx = parseInt(index);
    if (!currentTripOptions || !currentTripOptions[idx]) return;
    
    if (typeof trackAnalyticsEvent === 'function') {
        const trip = currentTripOptions[idx];
        trackAnalyticsEvent('planner_trip_select', { 
            train: trip.train, 
            time: trip.depTime,
            type: trip.type
        });
    }

    plannerExpandedState.clear();
    renderSelectedTrip(document.getElementById('planner-results-list'), idx);
    startPlannerPulse(idx);
};

window.togglePlannerStops = function(id) {
    // Try finding the standard ID first
    const el = document.getElementById(id);
    const btn = document.getElementById(`btn-${id}`);
    
    // Try finding split IDs (for internal transfers)
    const elBefore = document.getElementById(`${id}-before`);
    const elAfter = document.getElementById(`${id}-after`);

    let isHidden = true;

    if (elBefore && elAfter) {
        // Toggle both
        elBefore.classList.toggle('hidden');
        elAfter.classList.toggle('hidden');
        isHidden = elBefore.classList.contains('hidden');
    } else if (el) {
        // Toggle standard
        el.classList.toggle('hidden');
        isHidden = el.classList.contains('hidden');
    }

    if (isHidden) plannerExpandedState.delete(id);
    else plannerExpandedState.add(id);

    if(btn) btn.textContent = isHidden ? "Show All Stops" : "Hide Stops";
};

// --- VIEW COMPONENTS ---

function getPlanningDayLabel() {
    const day = selectedPlannerDay || currentDayType;
    if (day === 'sunday') return "Sunday / Public Holiday";
    if (day === 'saturday') return "Saturday Schedule";
    return "Weekday Schedule";
}

// NEW: Helper to update the External Header
function updatePlannerHeader(dayLabel) {
    const headerTitle = document.querySelector('#planner-results-section h4');
    const spacer = document.querySelector('#planner-results-section .w-8');
    if (headerTitle) {
        headerTitle.innerHTML = `
            <span class="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-200 shadow-sm flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Schedule: ${dayLabel}
            </span>
        `;
        // Ensure it's visible if hidden previously
        headerTitle.classList.remove('hidden');
    }
    // Hide the spacer so the flex-between pins the badge to the right
    if (spacer) spacer.style.display = 'none';
}

function renderTripResult(container, trips, selectedIndex = 0) {
    const selectedTrip = trips[selectedIndex];
    const dayLabel = getPlanningDayLabel();
    
    // Update Header Badge OUTSIDE the card
    updatePlannerHeader(dayLabel);

    if (selectedTrip) {
        container.innerHTML = PlannerRenderer.buildCard(selectedTrip, false, trips, selectedIndex);
    }
}

function renderNoMoreTrainsResult(container, trips, selectedIndex = 0, title = "No more trains today") {
    const selectedTrip = trips[selectedIndex];
    const dayLabel = getPlanningDayLabel();
    
    // Update Header Badge OUTSIDE the card
    updatePlannerHeader(dayLabel);

    container.innerHTML = `
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

function renderErrorCard(title, message, actionHtml = "") {
    return `
        <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 text-center">
            <h3 class="font-bold text-yellow-800 dark:text-yellow-200 mb-1">${title}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">${message}</p>
            ${actionHtml}
        </div>
    `;
}

const PlannerRenderer = {
    format12h: (timeStr) => {
        if (!timeStr) return "--:--";
        const [h, m] = timeStr.split(':');
        let hour = parseInt(h, 10);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${m} ${suffix}`;
    },

    // REFACTORED: Shared Logic for Building Stop Lists
    buildStopListHTML: (stops, id, internalTransfer) => {
        if (!stops || stops.length === 0) return '';
        const isExpanded = plannerExpandedState.has(id);

        const renderStops = (list) => list.map(s => `
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 py-1 relative pl-6">
                <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800"></div>
                <span>${s.station.replace(' STATION', '')}</span>
                <span class="font-mono">${formatTimeDisplay(s.time)}</span>
            </div>
        `).join('');

        let contentHTML = '';

        if (internalTransfer) {
            // Split list for internal transfers (Complex Case)
            const transferIndex = stops.findIndex(s => normalizeStationName(s.station) === normalizeStationName(internalTransfer.station));
            if (transferIndex !== -1) {
                const stopsBefore = stops.slice(0, transferIndex + 1);
                const stopsAfter = stops.slice(transferIndex + 1);
                
                const it = internalTransfer;
                const iWaitMin = Math.floor(it.wait / 60);
                const iWaitText = iWaitMin > 59 ? `${Math.floor(iWaitMin/60)}h ${iWaitMin%60}m` : `${iWaitMin} min`;
                const sName = it.station.replace(' STATION', '');

                const internalTransferHTML = `
                    <div class="relative pl-6 pb-6 pt-2">
                        <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-100 dark:ring-purple-900 z-10"></div>
                        <div class="mt-1 text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 p-2 rounded border-l-4 border-purple-500">
                            <div class="font-bold uppercase tracking-wide mb-1">Internal Transfer @ ${sName}</div>
                            <div class="text-gray-600 dark:text-gray-400 leading-snug">
                                <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${iWaitText}</b> Wait</span><br>
                                &bull; Switch from Train ${it.train1} to ${it.train2}
                            </div>
                        </div>
                    </div>
                `;

                contentHTML = `
                    <div id="${id}-before" class="${isExpanded ? "" : "hidden"} space-y-1 mb-0">${renderStops(stopsBefore)}</div>
                    <div>${internalTransferHTML}</div>
                    <div id="${id}-after" class="${isExpanded ? "" : "hidden"} space-y-1 mb-2">${renderStops(stopsAfter)}</div>
                `;
            } else {
                // Fallback to standard if transfer station not found in stops
                contentHTML = `<div id="${id}" class="${isExpanded ? "" : "hidden"} space-y-1 mb-2">${renderStops(stops)}</div>`;
            }
        } else {
            // Standard Simple List
            contentHTML = `<div id="${id}" class="${isExpanded ? "" : "hidden"} space-y-1 mb-2">${renderStops(stops)}</div>`;
        }

        return `
            <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                <button id="btn-${id}" onclick="togglePlannerStops('${id}')" class="text-[10px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full transition-colors mb-2 w-fit ml-6 -mt-1 relative top-[-5px]">
                    ${isExpanded ? "Hide Stops" : "Show All Stops"}
                </button>
                ${contentHTML}
            </div>
        `;
    },

    buildCard: (step, isNextDay, allOptions, selectedIndex) => {
        return `
            <div class="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden mb-4">
                ${PlannerRenderer.renderHeader(step, isNextDay)}
                ${PlannerRenderer.renderOptionsSelector(allOptions, selectedIndex, isNextDay)}
                ${step.type !== 'TRANSFER' && step.type !== 'DOUBLE_TRANSFER' ? PlannerRenderer.renderInstruction(step) : ''}
                <div class="p-4 bg-white dark:bg-gray-800">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-2">Journey Timeline</p>
                    ${PlannerRenderer.renderTimeline(step)}
                </div>
            </div>
        `;
    },

    renderHeader: (step, isNextDay) => {
        const isTransfer = step.type === 'TRANSFER';
        const isDoubleTransfer = step.type === 'DOUBLE_TRANSFER';
        const colorClass = (isTransfer || isDoubleTransfer) ? 'text-yellow-600 dark:text-yellow-400' : (isNextDay ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400');
        
        let headerLabel = 'Direct Trip';
        if (isDoubleTransfer) headerLabel = 'Bridge Trip (2 Transfers)';
        else if (isTransfer) headerLabel = 'Transfer Trip';
        else if (isNextDay) headerLabel = 'Future Trip';

        const { countdown, duration, isDeparted } = PlannerRenderer.calculateTimes(step, isNextDay);

        let stateBadge = "";
        
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
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold ${colorClass} uppercase tracking-wider">${headerLabel}</span>
                    <span class="text-xs font-bold text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Train ${step.train}</span>
                </div>
                <div class="flex justify-between items-center mt-2">
                    <div class="text-left flex-1 w-0">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Depart</p>
                        <p class="text-lg font-black text-gray-900 dark:text-white leading-tight truncate" title="${step.from}">${step.from.replace(' STATION', '')}</p>
                        <p class="text-base font-black ${colorClass} mt-1">${PlannerRenderer.format12h(step.depTime)}</p>
                    </div>
                    
                    <button onclick="swapPlannerResults()" class="flex-none p-1 bg-white dark:bg-gray-700 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition shadow-sm border border-gray-200 dark:border-gray-600 mx-1" title="Reverse Trip">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                    </button>

                    <div class="text-right flex-1 w-0">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Arrive</p>
                        <p class="text-lg font-black text-gray-900 dark:text-white leading-tight truncate" title="${step.to}">${step.to.replace(' STATION', '')}</p>
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
            let typeLabel = "Direct";
            if (opt.type === 'TRANSFER') typeLabel = "1 Transfer";
            if (opt.type === 'DOUBLE_TRANSFER') typeLabel = "2 Transfers";
            
            if (isToday && isLateNight && depSec < (14 * 3600)) {
                isPast = false;
                label = " (Tomorrow)";
            } else if (isPast) {
                label = " (Departed)";
            }
            
            return `<option value="${idx}" ${idx === selectedIndex ? 'selected' : ''} ${isPast ? 'class="text-gray-400 dark:text-gray-500"' : ''}>
                ${formatTimeDisplay(opt.depTime)} - ${typeLabel}${label}
            </option>`;
        }).join('');

        return `
            <div class="px-4 pb-2">
                <label class="text-[10px] uppercase font-bold text-blue-500 dark:text-blue-400 mb-1 block animate-pulse">👇 Tap to Change Time:</label>
                <select onchange="selectPlannerTrip(this.value)" class="w-full bg-blue-50 dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-900 text-gray-900 dark:text-white text-sm rounded p-2 focus:ring-blue-500 focus:border-blue-500 font-bold shadow-sm">
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
        if (step.type === 'DOUBLE_TRANSFER') return PlannerRenderer.renderDoubleTransferTimeline(step);
        
        // DIRECT TRIP
        let html = '<div class="mt-4 border-l-2 border-gray-300 dark:border-gray-600 ml-2 space-y-4">';
        // Use inline generation for simple direct list to avoid overhead of expandable logic if not needed, 
        // OR we can unify everything. For now, keeping the simple look for Direct.
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
        const hubArr = timeToSeconds(step.leg1.arrTime);
        const hubDep = timeToSeconds(step.leg2.depTime);
        const waitMins = Math.floor((hubDep - hubArr) / 60);
        const waitStr = waitMins > 59 ? `${Math.floor(waitMins/60)} hr ${waitMins%60} min` : `${waitMins} Minutes`;
        
        let train1Dest = step.leg1.actualDestination || step.leg1.route.destB;
        train1Dest = train1Dest.replace(' STATION', '').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

        let train2Dest = step.leg2.actualDestination || step.leg2.route.destB;
        train2Dest = train2Dest.replace(' STATION', '').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

        const standardTransferBlock = `
            <div class="relative pl-6 pb-6 pt-2">
                <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900 z-10"></div>
                <div class="mt-1 text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded border-l-4 border-yellow-500">
                    <div class="font-bold uppercase tracking-wide mb-1">Transfer Required</div>
                    <div class="text-gray-600 dark:text-gray-400 leading-snug">
                        <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${waitStr}</b> Layover</span><br>
                        &bull; Connect to <span class="font-bold text-blue-600 dark:text-blue-400">${train2Dest} Train ${step.leg2.train}</span>
                    </div>
                </div>
            </div>
        `;

        const leg1StopsId = `stops-leg1-${step.train}`;
        const leg2StopsId = `stops-leg2-${step.train}`;

        return `
            <div class="mt-4 ml-0 space-y-0">
                <!-- LEG 1 START -->
                <div class="relative pl-8 pb-6 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${step.from.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg1.depTime)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium mb-1">
                            ${train1Dest} Train ${step.leg1.train}
                        </div>
                    </div>
                </div>
                
                ${PlannerRenderer.buildStopListHTML(step.leg1.stops, leg1StopsId, null)}

                <div class="relative pl-8 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-gray-400"></div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">Arrive ${step.transferStation.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg1.arrTime)}</span>
                    </div>
                </div>

                <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    ${standardTransferBlock}
                </div>

                <div class="relative pl-8 pb-6 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${step.transferStation.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg2.depTime)}</span>
                        </div>
                        
                        <div class="text-xs text-blue-500 font-medium mb-1">
                            ${train2Dest} Train ${step.leg2.train}
                        </div>
                    </div>
                </div>

                ${PlannerRenderer.buildStopListHTML(step.leg2.stops, leg2StopsId, step.leg2.internalTransfer)}

                <div class="relative pl-8 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-600 ring-4 ring-green-100 dark:ring-green-900"></div>
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">${step.to.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg2.arrTime)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderDoubleTransferTimeline: (step) => {
        // --- CALCULATIONS ---
        const arr1 = timeToSeconds(step.leg1.arrTime);
        const dep2 = timeToSeconds(step.leg2.depTime);
        const wait1Mins = Math.floor((dep2 - arr1) / 60);
        const wait1Str = wait1Mins > 59 ? `${Math.floor(wait1Mins/60)} hr ${wait1Mins%60} min` : `${wait1Mins} Minutes`;

        const arr2 = timeToSeconds(step.leg2.arrTime);
        const dep3 = timeToSeconds(step.leg3.depTime);
        const wait2Mins = Math.floor((dep3 - arr2) / 60);
        const wait2Str = wait2Mins > 59 ? `${Math.floor(wait2Mins/60)} hr ${wait2Mins%60} min` : `${wait2Mins} Minutes`;

        const formatStation = (s) => s.replace(' STATION', '').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        const hub1Name = formatStation(step.hub1);
        const hub2Name = formatStation(step.hub2);
        
        const leg1Id = `l1-${step.train}`;
        const leg2Id = `l2-${step.train}`;
        const leg3Id = `l3-${step.train}`;

        // --- NEW: DESTINATION NAMES ---
        let train1Dest = step.leg1.actualDestination || step.leg1.route.destB;
        train1Dest = train1Dest.replace(' STATION', '').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

        let train2Dest = step.leg2.actualDestination || step.leg2.route.destB;
        train2Dest = train2Dest.replace(' STATION', '').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

        let train3Dest = step.leg3.actualDestination || step.leg3.route.destB;
        train3Dest = train3Dest.replace(' STATION', '').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

        const transferBlock1 = `
            <div class="relative pl-6 pb-6 pt-2">
                <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900 z-10"></div>
                <div class="mt-1 text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded border-l-4 border-yellow-500">
                    <div class="font-bold uppercase tracking-wide mb-1">Transfer 1 @ ${hub1Name}</div>
                    <div class="text-gray-600 dark:text-gray-400 leading-snug">
                        <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${wait1Str}</b> Layover</span><br>
                        &bull; Connect to <span class="font-bold text-blue-600 dark:text-blue-400">${train2Dest} Train ${step.leg2.train}</span>
                    </div>
                </div>
            </div>
        `;

        const transferBlock2 = `
            <div class="relative pl-6 pb-6 pt-2">
                <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-100 dark:ring-purple-900 z-10"></div>
                <div class="mt-1 text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 p-2 rounded border-l-4 border-purple-500">
                    <div class="font-bold uppercase tracking-wide mb-1">Transfer 2 @ ${hub2Name}</div>
                    <div class="text-gray-600 dark:text-gray-400 leading-snug">
                        <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${wait2Str}</b> Layover</span><br>
                        &bull; Connect to <span class="font-bold text-blue-600 dark:text-blue-400">${train3Dest} Train ${step.leg3.train}</span>
                    </div>
                </div>
            </div>
        `;

        return `
            <div class="mt-4 ml-0 space-y-0">
                <!-- LEG 1 -->
                <div class="relative pl-8 pb-6 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${step.from.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg1.depTime)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium">
                            ${train1Dest} Train ${step.leg1.train}
                        </div>
                    </div>
                </div>
                
                ${PlannerRenderer.buildStopListHTML(step.leg1.stops, leg1Id, null)}

                <!-- HUB 1 -->
                <div class="relative pl-8 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-gray-400"></div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">Arrive ${hub1Name}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg1.arrTime)}</span>
                    </div>
                </div>

                <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">${transferBlock1}</div>

                <!-- LEG 2 -->
                <div class="relative pl-8 pb-6 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${hub1Name}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg2.depTime)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium">
                            ${train2Dest} Train ${step.leg2.train}
                        </div>
                    </div>
                </div>

                ${PlannerRenderer.buildStopListHTML(step.leg2.stops, leg2Id, null)}

                <!-- HUB 2 -->
                <div class="relative pl-8 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-gray-400"></div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">Arrive ${hub2Name}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg2.arrTime)}</span>
                    </div>
                </div>

                <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">${transferBlock2}</div>

                <!-- LEG 3 -->
                <div class="relative pl-8 pb-6 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${hub2Name}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg3.depTime)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium">
                            ${train3Dest} Train ${step.leg3.train}
                        </div>
                    </div>
                </div>

                ${PlannerRenderer.buildStopListHTML(step.leg3.stops, leg3Id, null)}

                <!-- FINAL DEST -->
                <div class="relative pl-8 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-600 ring-4 ring-green-100 dark:ring-green-900"></div>
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">${step.to.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(step.leg3.arrTime)}</span>
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
        const isLateNight = nowSec > (20 * 3600);
        let effectiveDepSec = depSec;
        let isTomorrowOverride = false;
        if (isToday && isLateNight && depSec < (14 * 3600)) { effectiveDepSec += 86400; isTomorrowOverride = true; }
        if (isToday || isTomorrowOverride) {
            if (effectiveDepSec > nowSec) {
                const diff = effectiveDepSec - nowSec;
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                countdown = h > 0 ? `Departs in ${h}h ${m}m` : (m === 0 ? "Departs in < 1 min" : `Departs in ${m} min`);
            } else { countdown = "Departed"; isDeparted = true; }
        }
        const durSec = arrSec - depSec;
        const h = Math.floor(durSec / 3600);
        const m = Math.floor((durSec % 3600) / 60);
        return { countdown, duration: h > 0 ? `${h}h ${m}m` : `${m}m`, isDeparted };
    }
};