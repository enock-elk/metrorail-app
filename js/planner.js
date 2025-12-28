// --- TRIP PLANNER LOGIC ---

// State
let plannerOrigin = null;
let plannerDest = null;

// Initialize Planner Modal
function initPlanner() {
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');
    const swapBtn = document.getElementById('planner-swap-btn');
    const searchBtn = document.getElementById('planner-search-btn');
    const resetBtn = document.getElementById('planner-reset-btn');
    const locateBtn = document.getElementById('planner-locate-btn');
    const fromSearch = document.getElementById('planner-from-search');
    const toSearch = document.getElementById('planner-to-search');

    if (!fromSelect || !toSelect) return;

    // 1. Populate Dropdowns from MASTER LIST
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

    // 2. Filter Logic (Search)
    const filterOptions = (input, select) => {
        const filter = input.value.toUpperCase();
        const options = select.getElementsByTagName('option');
        for (let i = 0; i < options.length; i++) {
            const txtValue = options[i].textContent || options[i].innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1 || options[i].value === "") {
                options[i].style.display = "";
            } else {
                options[i].style.display = "none";
            }
        }
    };

    if (fromSearch) {
        fromSearch.addEventListener('keyup', () => filterOptions(fromSearch, fromSelect));
    }
    if (toSearch) {
        toSearch.addEventListener('keyup', () => filterOptions(toSearch, toSelect));
    }

    // 3. Auto Locate
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            const icon = locateBtn.querySelector('svg');
            icon.classList.add('animate-spin'); // Using Tailwind's spin
            
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
                    // Using globalStationIndex which is available in logic.js
                    for (const [stationName, coords] of Object.entries(globalStationIndex)) {
                        const dist = getDistanceFromLatLonInKm(userLat, userLon, coords.lat, coords.lon);
                        candidates.push({ stationName, dist });
                    }
                    
                    candidates.sort((a, b) => a.dist - b.dist);

                    if (candidates.length > 0 && candidates[0].dist <= 6) { // 6km limit
                        const nearest = candidates[0].stationName;
                        // Select it in dropdown
                        fromSelect.value = nearest;
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
        const temp = fromSelect.value;
        fromSelect.value = toSelect.value;
        toSelect.value = temp;
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
        if(fromSearch) fromSearch.value = "";
        if(toSearch) toSearch.value = "";
        // Reset filters
        if(fromSelect) {
             const opts = fromSelect.getElementsByTagName('option');
             for(let i=0; i<opts.length; i++) opts[i].style.display = "";
        }
        if(toSelect) {
             const opts = toSelect.getElementsByTagName('option');
             for(let i=0; i<opts.length; i++) opts[i].style.display = "";
        }
    });
}

// Core Logic: Find the Path
function executeTripPlan(origin, dest) {
    const resultsContainer = document.getElementById('planner-results-list');
    resultsContainer.innerHTML = '<div class="text-center p-4"><svg class="w-8 h-8 animate-spin mx-auto text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-xs text-gray-500">Calculating route...</p></div>';
    
    // UI Transition
    document.getElementById('planner-input-section').classList.add('hidden');
    document.getElementById('planner-results-section').classList.remove('hidden');

    // --- STEP 1: CHECK DIRECT ROUTES ---
    // We check if both stations exist on the SAME active route key
    const directRoute = findDirectRoute(origin, dest);

    setTimeout(() => {
        if (directRoute) {
            renderTripResult(resultsContainer, [directRoute]);
        } else {
            // --- STEP 2: CHECK TRANSFERS (Future Implementation) ---
            // For now, show "No Direct Route" message
            resultsContainer.innerHTML = `
                <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 text-center">
                    <h3 class="font-bold text-yellow-800 dark:text-yellow-200 mb-1">No Direct Train</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        Transfers are not yet supported in V3.52.<br>
                        Please check the <a onclick="document.getElementById('close-planner-btn').click(); document.getElementById('view-map-btn').click();" class="underline cursor-pointer text-blue-500">Network Map</a>.
                    </p>
                </div>
            `;
        }
    }, 500); // Fake delay for UX
}

function findDirectRoute(origin, dest) {
    // 1. Identify which routes serve Origin
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();

    // 2. Find Intersection
    const commonRoutes = [...originRoutes].filter(x => destRoutes.has(x));

    if (commonRoutes.length > 0) {
        // Pick the first valid one (usually there's only one, unless corridor overlap)
        const routeId = commonRoutes[0];
        const routeConfig = ROUTES[routeId];
        
        return {
            type: 'DIRECT',
            route: routeConfig,
            from: origin,
            to: dest,
            instructions: `Take any train on the <strong>${routeConfig.name}</strong> line.`
        };
    }
    return null;
}

function renderTripResult(container, steps) {
    let html = "";
    
    steps.forEach((step, index) => {
        html += `
            <div class="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
                <div class="bg-blue-600 p-3 flex justify-between items-center text-white">
                    <span class="font-bold text-sm">Step ${index + 1}</span>
                    <span class="text-xs bg-white/20 px-2 py-0.5 rounded uppercase tracking-wide">${step.type}</span>
                </div>
                <div class="p-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-left">
                            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Depart</p>
                            <p class="font-bold text-gray-900 dark:text-white truncate max-w-[100px]">${step.from.replace(' STATION', '')}</p>
                        </div>
                        <div class="flex-grow mx-2 flex items-center justify-center">
                            <div class="h-0.5 w-full bg-gray-300 dark:bg-gray-500"></div>
                            <svg class="w-4 h-4 text-gray-400 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Arrive</p>
                            <p class="font-bold text-gray-900 dark:text-white truncate max-w-[100px]">${step.to.replace(' STATION', '')}</p>
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 dark:bg-gray-800 p-3 rounded-lg border border-blue-100 dark:border-gray-600">
                        <p class="text-sm text-gray-700 dark:text-gray-300">
                            ${step.instructions}
                        </p>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}