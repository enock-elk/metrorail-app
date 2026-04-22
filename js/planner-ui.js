/**
 * METRORAIL NEXT TRAIN - PLANNER UI (V6.04.21 - Guardian Edition)
 * --------------------------------------------------------------
 * THE "HEAD CHEF" (Controller)
 * * This module handles user interaction, DOM updates, and event listeners.
 * It calls the pure logic functions from planner-core.js.
 * * V6.00.21: The Great Decoupling - Absorbed robust UI overrides from monolithic ui.js.
 * * PHASE 10: App Router Parity - Integrated deep history stack for Planner Results.
 * * STRIKE 2: Dynamic Leg Renderer Injection - Unhides 'isRelayComposite' internal transfers.
 * * V7.00.01 (GUARDIAN): Dynamic MULTI_TRANSFER UI Renderer for True Dijkstra Graph.
 * * PHASE 1 (GUARDIAN BUGFIX): Live Map Router Bleed & Grey Screen Interceptor injected.
 * * GUARDIAN PHASE 13: Impossible Route Warning Card integrated via Zero-Hour Probe.
 * * GUARDIAN PHASE 14 & D: Dynamic Time-Sync applied to UI to prevent future-day times matching against today's clock, incorporating dayOffset weekend math.
 * * GUARDIAN PHASE D: Leaflet anti-rubberband flyTo() lock applied to prevent camera snapping race conditions.
 * * GUARDIAN PHASE 20: Map UX Parity - Integrated Action Bar, Naked Halo tooltips, and Dark Mode Tile Inversion from map.html.
 * * GUARDIAN BUGFIX (V6.04.17): Ghost Station Polyline Trap resolved in extractTripCoordinates.
 * * GUARDIAN UX UPGRADE (V6.04.17): Autocomplete native focus-select & Unconditional Swap Protocol.
 */

// --- GUARDIAN PHASE 1: ROUTER BLEED & GREY SCREEN INTERCEPTOR ---
// Resolves the bug where double-tapping "Close Map" fires history.back() twice, dumping the user to the input page.
// Also forces an instant opacity fade to cover the Leaflet engine's tile destruction (the "grey screen" flash).
document.addEventListener('click', (e) => {
    const tripMapCloseBtn = e.target.closest('#close-trip-map-btn, #close-trip-map-btn-2');
    if (tripMapCloseBtn) {
        // Strike 1: Prevent double-tap router bleed
        if (tripMapCloseBtn.dataset.isClosing === "true") {
            e.preventDefault();
            e.stopPropagation();
            console.log("🛡️ Guardian: Suppressed double-tap on Map Close button (Router Bleed Prevented).");
            return;
        }
        tripMapCloseBtn.dataset.isClosing = "true";
        
        // Reset the lock after a safe duration (1 second)
        setTimeout(() => { delete tripMapCloseBtn.dataset.isClosing; }, 1000);

        // Strike 2: Force instant visual hide to prevent the grey screen flash 
        // before ui.js destroys the map instance.
        const modal = document.getElementById('trip-map-modal');
        if (modal) {
            modal.classList.add('opacity-0');
        }
    }
}, true); // Capture phase guarantees we strike before ui.js standard listeners

// State (UI Specific)
let plannerOrigin = null;
let plannerDest = null;
let currentTripOptions = []; 
let currentPlannerStatus = 'NO_PATH'; // GUARDIAN PHASE 13: Track status for Impossible Route Cards
let selectedPlannerDay = null; 
let plannerPulse = null; 
let plannerExpandedState = new Set(); 

// GUARDIAN Phase 10: App Router Parity
window.hidePlannerResults = function() {
    if (typeof plannerPulse !== 'undefined' && plannerPulse) { clearInterval(plannerPulse); plannerPulse = null; }
    const inputSection = document.getElementById('planner-input-section');
    const resultsSection = document.getElementById('planner-results-section');
    if (inputSection) inputSection.classList.remove('hidden');
    if (resultsSection) resultsSection.classList.add('hidden');
    if (typeof plannerExpandedState !== 'undefined') plannerExpandedState.clear(); 
};

// --- GUARDIAN PHASE 6.1 & V7: DATA EXTRACTION ENGINE ---
window.extractTripCoordinates = function(tripIndex) {
    if (typeof triggerHaptic === 'function') triggerHaptic();
    if (!currentTripOptions || !currentTripOptions[tripIndex]) return;
    
    const trip = currentTripOptions[tripIndex];
    const coordinates = [];
    const stationNames = [];
    const validStops = []; // GUARDIAN: New array specifically for clean map markers

    // Helper to safely append stops without duplicating transfer hubs
    const addStops = (stopsArray) => {
        if (!stopsArray) return;
        stopsArray.forEach(stop => {
            // GUARDIAN BUGFIX: The Ghost Station Polyline Trap Fix
            // Early exit prevents "---" stations on branch Y-junctions from being pushed
            // to the path coordinates, curing the chaotic map zigzags!
            if (stop.time === "---") return;

            const name = normalizeStationName(stop.station);
            // Prevent consecutive duplicates (e.g., Hub Arrival followed instantly by Hub Departure)
            if (stationNames.length > 0 && stationNames[stationNames.length - 1] === name) return;
            
            stationNames.push(name);
            
            if (globalStationIndex && globalStationIndex[name] && globalStationIndex[name].lat) {
                const coord = [globalStationIndex[name].lat, globalStationIndex[name].lon];
                coordinates.push(coord); // Now strictly physically visited stations
                
                validStops.push({
                    name: name,
                    lat: coord[0],
                    lon: coord[1]
                });
            }
        });
    };

    // Flatten the nested trip arrays chronologically
    if (trip.type === 'DIRECT') {
        addStops(trip.stops);
    } else if (trip.type === 'TRANSFER') {
        addStops(trip.leg1.stops);
        addStops(trip.leg2.stops);
    } else if (trip.type === 'DOUBLE_TRANSFER') {
        addStops(trip.leg1.stops);
        addStops(trip.leg2.stops);
        addStops(trip.leg3.stops);
    } else if (trip.type === 'MULTI_TRANSFER' || trip.legs) {
        // GUARDIAN V7: Dynamic leg iteration for Dijkstra output
        trip.legs.forEach(leg => addStops(leg.stops));
    }

    if (coordinates.length === 0) {
        showToast("Coordinate data unavailable for this route.", "error");
        return;
    }

    // Package the payload for the Lazy-Loaded Rendering Engine
    const routeData = {
        origin: normalizeStationName(trip.from),
        destination: normalizeStationName(trip.to),
        path: coordinates,        // GUARDIAN: Full curved waypoint path (now scrubbed of Y-junction ghosts)
        stationNames: stationNames, // Legacy array (will be phased out)
        validStops: validStops    // GUARDIAN: Clean stops for precise markers
    };

    // GUARDIAN PHASE C: Telemetry Integration
    if (typeof trackAnalyticsEvent === 'function') {
        trackAnalyticsEvent('open_live_map', {
            origin: trip.from.replace(' STATION', ''),
            destination: trip.to.replace(' STATION', ''),
            trip_type: trip.type
        });
    }

    if (typeof window.openTripMapRenderer === 'function') {
        window.openTripMapRenderer(routeData);
    } else {
        showToast("Initializing Map Engine...", "info");
    }
};

const PlannerRenderer = {
    // GUARDIAN V6.12: Strict Midnight Protocol Evaluator
    isMidnightRollover: () => {
        const isToday = (!selectedPlannerDay || selectedPlannerDay === currentDayType);
        if (!isToday || currentTripOptions.length === 0) return false;
        
        const nowSec = timeToSeconds(currentTime);
        let latestDep = 0;
        currentTripOptions.forEach(t => {
            const sec = timeToSeconds(t.depTime);
            if (sec > latestDep) latestDep = sec;
        });
        
        // If current time is strictly past the absolute last train available on this route
        return nowSec > latestDep;
    },

    format12h: (timeStr) => {
        if (!timeStr) return "--:--";
        const [h, m] = timeStr.split(':');
        let hour = parseInt(h, 10);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${m} ${suffix}`;
    },

    // GUARDIAN V5.01: Standardized Duration Formatter
    formatDuration: (totalMinutes) => {
        if (totalMinutes < 60) return `${totalMinutes} min`;
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
    },

    // GUARDIAN V5.01: Text Intercept for Kempton Park area
    applyUIIntercepts: (stationName) => {
        if (!stationName) return "";
        let name = stationName.replace(' STATION', '').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        const upper = name.toUpperCase();
        if (upper === 'ELANDSFONTEIN' || upper === 'RHODESFIELD') {
            return 'Kempton Park';
        }
        return name;
    },

    // REFACTORED: Shared Logic for Building Stop Lists (GUARDIAN Phase 2: Ghost Buster)
    buildStopListHTML: (stops, id) => {
        if (!stops || stops.length === 0) return '';
        const isExpanded = plannerExpandedState.has(id);

        // Strips origin and destination mathematically, AND completely purges "---" ghost stations
        const intermediateStops = stops.slice(1, -1).filter(s => s.time !== "---");

        // If a direct express skips all intermediate stops, don't even show the toggle button!
        if (intermediateStops.length === 0) return '';

        const renderStops = intermediateStops.map((s) => {
            return `
                <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 py-1 relative pl-6">
                    <div class="absolute -left-[5px] top-1.5 w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800"></div>
                    <span>${s.station.replace(' STATION', '')}</span>
                    <span class="font-mono">${formatTimeDisplay(s.time)}</span>
                </div>
            `;
        }).join('');

        const contentHTML = `<div id="${id}" class="${isExpanded ? "" : "hidden"} space-y-1 mb-2">${renderStops}</div>`;

        return `
            <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                <button id="btn-${id}" onclick="togglePlannerStops('${id}')" class="text-[10px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full transition-colors mb-2 w-fit ml-6 -mt-1 relative top-[-5px] focus:outline-none">
                    ${isExpanded ? "Hide Stops" : "Show All Stops"}
                </button>
                ${contentHTML}
            </div>
        `;
    },

    // GUARDIAN STRIKE 2: Universal Leg Renderer Engine
    renderLegTimeline: (leg, fromStation, toStation, legId, isFinalDest = false) => {
        const formatStation = (s) => PlannerRenderer.applyUIIntercepts(s);
        let trainDest = formatStation(leg.actualDestination || leg.route.destB);
        
        const arriveDotClass = isFinalDest 
            ? "absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-600 ring-4 ring-green-100 dark:ring-green-900" 
            : "absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-gray-400";
        
        if (leg.isRelayComposite && leg.internalTransfer) {
            const it = leg.internalTransfer;
            const sName = formatStation(it.station.replace(' STATION', ''));
            const waitStr = PlannerRenderer.formatDuration(Math.floor(it.wait / 60));
            
            // Mathematically slice the stops array at the internal transfer hub
            const transferIndex = leg.stops.findIndex(s => normalizeStationName(s.station) === normalizeStationName(it.station));
            const stopsBefore = transferIndex !== -1 ? leg.stops.slice(0, transferIndex + 1) : [];
            const stopsAfter = transferIndex !== -1 ? leg.stops.slice(transferIndex + 1) : leg.stops;

            const arrRelay = stopsBefore.length > 0 ? stopsBefore[stopsBefore.length-1].time : leg.depTime;
            const depRelay = stopsAfter.length > 0 ? stopsAfter[0].time : leg.depTime;

            let train1Dest = formatStation(it.station);
            let train2Dest = trainDest;

            return `
                <div class="relative pl-8 pb-6 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${fromStation.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(leg.depTime)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium mb-1">
                            To ${train1Dest} Train ${it.train1}
                        </div>
                    </div>
                </div>
                
                ${PlannerRenderer.buildStopListHTML(stopsBefore, `${legId}-A`)}

                <div class="relative pl-8 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-gray-400"></div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">Arrive ${sName}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(arrRelay)}</span>
                    </div>
                </div>

                <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="relative pl-6 pb-6 pt-2">
                        <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-purple-50 ring-4 ring-purple-100 dark:ring-purple-900 z-10"></div>
                        <div class="mt-1 text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 p-2 rounded border-l-4 border-purple-500">
                            <div class="font-bold uppercase tracking-wide mb-1">INTERNAL TRANSFER @ ${sName}</div>
                            <div class="text-gray-600 dark:text-gray-400 leading-snug">
                                <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${waitStr}</b> Wait</span><br>
                                &bull; Switch to <span class="font-bold text-blue-600 dark:text-blue-400">${train2Dest} Train ${it.train2}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="relative pl-8 pb-6 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${sName}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(depRelay)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium mb-1">
                            ${train2Dest} Train ${it.train2}
                        </div>
                    </div>
                </div>

                ${PlannerRenderer.buildStopListHTML(stopsAfter, `${legId}-B`)}

                <div class="relative pl-8 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="${arriveDotClass}"></div>
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">${isFinalDest ? toStation.replace(' STATION', '') : 'Arrive ' + toStation.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(leg.arrTime)}</span>
                    </div>
                </div>
            `;
        } else {
            // STANDARD SINGLE TRAIN LEG RENDERER
            return `
                <div class="relative pl-8 pb-6 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900"></div>
                    <div class="flex flex-col">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-900 dark:text-white text-sm">Depart ${fromStation.replace(' STATION', '')}</span>
                            <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(leg.depTime)}</span>
                        </div>
                        <div class="text-xs text-blue-500 font-medium mb-1">
                            ${trainDest} Train ${leg.train}
                        </div>
                    </div>
                </div>
                
                ${PlannerRenderer.buildStopListHTML(leg.stops, legId)}

                <div class="relative pl-8 border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                    <div class="${arriveDotClass}"></div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-900 dark:text-white text-sm">${isFinalDest ? toStation.replace(' STATION', '') : 'Arrive ' + toStation.replace(' STATION', '')}</span>
                        <span class="font-mono font-bold text-gray-900 dark:text-white text-sm">${formatTimeDisplay(leg.arrTime)}</span>
                    </div>
                </div>
            `;
        }
    },

    buildCard: (step, isNextDay, allOptions, selectedIndex) => {
        return `
            <div class="bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden mb-4 flex flex-col">
                ${PlannerRenderer.renderHeader(step, isNextDay)}
                ${PlannerRenderer.renderOptionsSelector(allOptions, selectedIndex, isNextDay)}
                ${step.type !== 'TRANSFER' && step.type !== 'DOUBLE_TRANSFER' && step.type !== 'MULTI_TRANSFER' ? PlannerRenderer.renderInstruction(step) : ''}
                <div class="p-4 bg-white dark:bg-gray-800 flex-grow">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-2">Journey Timeline</p>
                    ${PlannerRenderer.renderTimeline(step)}
                </div>
                <button onclick="extractTripCoordinates(${selectedIndex})" class="w-full bg-gray-50 dark:bg-gray-900/50 hover:bg-blue-50 dark:hover:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold py-3.5 text-sm border-t border-gray-200 dark:border-gray-700 transition-colors flex items-center justify-center focus:outline-none mt-auto">
                    <span class="mr-2 text-lg">🗺️</span> View Live Route on Map
                </button>
            </div>
        `;
    },

    renderHeader: (step, isNextDay) => {
        // GUARDIAN V7: True Transfer Counting using Legs Array
        let transferCount = 0;
        if (step.type === 'MULTI_TRANSFER') {
            transferCount = step.legs ? step.legs.length - 1 : (step.transferCount || 3);
            if (step.legs) {
                step.legs.forEach(leg => { if (leg.isRelayComposite) transferCount += 1; });
            }
        } else {
            transferCount = step.type === 'DOUBLE_TRANSFER' ? 2 : (step.type === 'TRANSFER' ? 1 : 0);
            if (step.leg1 && step.leg1.isRelayComposite) transferCount += 1;
            if (step.leg2 && step.leg2.isRelayComposite) transferCount += 1;
            if (step.leg3 && step.leg3.isRelayComposite) transferCount += 1;
        }

        const colorClass = transferCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : (isNextDay ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400');
        
        let headerLabel = 'Direct Trip';
        if (transferCount === 1) headerLabel = 'Transfer Trip';
        else if (transferCount >= 2) headerLabel = `Bridge Trip (${transferCount} Transfers)`;
        if (isNextDay) headerLabel = 'Future Trip';

        const { countdown, duration, isDeparted } = PlannerRenderer.calculateTimes(step, isNextDay);

        let stateBadge = "";
        
        if (isNextDay) {
             // GUARDIAN PHASE 14: Dynamic Typography to handle actual designated day
             const dynamicDayText = step.dayLabel ? `Departure: ${step.dayLabel}` : "Departure: Tomorrow";
             stateBadge = `<div class="flex items-center text-sm font-bold text-orange-600 dark:text-orange-400">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${dynamicDayText}
                          </div>`;
        } else if (isDeparted) {
            stateBadge = `
                <div class="flex flex-col items-start">
                    <div class="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">
                        ${countdown}
                    </div>
                    <button onclick="document.querySelector('#planner-results-list select').selectedIndex += 1; document.querySelector('#planner-results-list select').dispatchEvent(new Event('change'));" class="text-xs text-blue-500 font-bold underline hover:text-blue-600 transition-colors focus:outline-none">
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
                <div class="flex items-center justify-center mb-2">
                    <span class="text-[11px] font-black ${colorClass} uppercase tracking-widest text-center">${headerLabel}</span>
                </div>
                <div class="flex justify-between items-center mt-2">
                    <div class="text-left flex-1 w-0">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Depart</p>
                        <p class="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight tracking-tight truncate" title="${step.from}">${step.from.replace(' STATION', '')}</p>
                        <p class="text-base font-black ${colorClass} mt-1">${PlannerRenderer.format12h(step.depTime)}</p>
                    </div>
                    
                    <button onclick="swapPlannerResults()" class="flex-none p-1.5 bg-white dark:bg-gray-700 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition shadow-sm border border-gray-200 dark:border-gray-600 mx-0.5 focus:outline-none" title="Reverse Trip">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                    </button>

                    <div class="text-right flex-1 w-0">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Arrive</p>
                        <p class="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight tracking-tight truncate" title="${step.to}">${step.to.replace(' STATION', '')}</p>
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
        
        const midnightRollover = PlannerRenderer.isMidnightRollover();

        const optionsHtml = allOptions.map((opt, idx) => {
            const depSec = timeToSeconds(opt.depTime);
            // GUARDIAN PHASE 14: If it's a future day, it's never "past" compared to today's clock
            let isPast = isToday && !midnightRollover && !opt.dayLabel && (depSec < nowSec);
            
            let label = "";
            
            // GUARDIAN V7: Accurately count composite relays and Dijkstra legs
            let transferCount = 0;
            if (opt.type === 'MULTI_TRANSFER') {
                transferCount = opt.legs ? opt.legs.length - 1 : (opt.transferCount || 3);
                if (opt.legs) {
                    opt.legs.forEach(leg => { if (leg.isRelayComposite) transferCount += 1; });
                }
            } else {
                transferCount = opt.type === 'DOUBLE_TRANSFER' ? 2 : (opt.type === 'TRANSFER' ? 1 : 0);
                if (opt.leg1 && opt.leg1.isRelayComposite) transferCount += 1;
                if (opt.leg2 && opt.leg2.isRelayComposite) transferCount += 1;
                if (opt.leg3 && opt.leg3.isRelayComposite) transferCount += 1;
            }

            let typeLabel = transferCount === 0 ? "Direct" : `${transferCount} Transfer${transferCount > 1 ? 's' : ''}`;
            
            // GUARDIAN PHASE 14: Dynamic future label injection
            if (opt.dayLabel) {
                label = ` (${opt.dayLabel})`;
            } else if (midnightRollover) {
                label = " (Tomorrow)";
            }
            
            // Formatted explicitly as "08:59 ➔ 10:30 [1 Transfer]"
            return `<option value="${idx}" ${idx === selectedIndex ? 'selected' : ''} ${isPast ? 'class="text-gray-400 dark:text-gray-500"' : ''}>
                ${formatTimeDisplay(opt.depTime)} ➔ ${formatTimeDisplay(opt.arrTime)} [${typeLabel}]${label}
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
                    <b>Instruction:</b><br> 
                    Take train <b>${step.train}</b> on the <b>${step.route.name}</b> line.
                </p>
            </div>
        </div>
    `,

    renderTimeline: (step) => {
        if (step.type === 'TRANSFER') return PlannerRenderer.renderTransferTimeline(step);
        if (step.type === 'DOUBLE_TRANSFER') return PlannerRenderer.renderDoubleTransferTimeline(step);
        if (step.type === 'MULTI_TRANSFER') return PlannerRenderer.renderMultiTransferTimeline(step);
        
        // DIRECT TRIP (Has no transfer hubs, but might be a relay)
        if (step.isRelayComposite) {
            return `
                <div class="mt-4 ml-0 space-y-0">
                    ${PlannerRenderer.renderLegTimeline(step, step.from, step.to, `stops-direct-${step.train}`, true)}
                </div>
            `;
        }

        // STANDARD PURE DIRECT TRIP (GUARDIAN Phase 2: Ghost Buster)
        let html = '<div class="mt-4 border-l-2 border-gray-300 dark:border-gray-600 ml-2 space-y-4">';
        
        // Purge "---" ghost stations before rendering the physical stops
        const validStops = step.stops.filter(s => s.time !== "---");
        
        validStops.forEach((stop, i) => {
            const isEnd = (i === 0 || i === validStops.length - 1);
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

    // GUARDIAN V7: Dynamic Renderer for unlimited transfers
    renderMultiTransferTimeline: (step) => {
        if (!step.legs || step.legs.length === 0) return '';
        let html = '<div class="mt-4 ml-0 space-y-0">';

        // Safe Tailwind Color Arrays to avoid JIT CSS purging
        const colors = [
            {
                dot: 'bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900',
                box: 'text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500'
            },
            {
                dot: 'bg-purple-500 ring-4 ring-purple-100 dark:ring-purple-900',
                box: 'text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border-purple-500'
            },
            {
                dot: 'bg-teal-500 ring-4 ring-teal-100 dark:ring-teal-900',
                box: 'text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border-teal-500'
            },
            {
                dot: 'bg-pink-500 ring-4 ring-pink-100 dark:ring-pink-900',
                box: 'text-pink-800 dark:text-pink-300 bg-pink-50 dark:bg-pink-900/30 border-pink-500'
            }
        ];

        for (let i = 0; i < step.legs.length; i++) {
            const leg = step.legs[i];
            const isFinalDest = (i === step.legs.length - 1);
            const legId = `l${i+1}-${step.train}`;
            
            html += PlannerRenderer.renderLegTimeline(leg, leg.from, leg.to, legId, isFinalDest);

            if (!isFinalDest) {
                const nextLeg = step.legs[i+1];
                const arr = timeToSeconds(leg.arrTime);
                const dep = timeToSeconds(nextLeg.depTime);
                const waitMins = Math.floor((dep - arr) / 60);
                const waitStr = PlannerRenderer.formatDuration(waitMins);
                const hubName = PlannerRenderer.applyUIIntercepts(leg.to);
                const trainDest = PlannerRenderer.applyUIIntercepts(nextLeg.actualDestination || nextLeg.route.destB);

                const c = colors[i % colors.length];

                html += `
                    <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">
                        <div class="relative pl-6 pb-6 pt-2">
                            <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full ${c.dot} z-10"></div>
                            <div class="mt-1 text-xs ${c.box} p-2 rounded border-l-4">
                                <div class="font-bold uppercase tracking-wide mb-1">TRANSFER ${i+1} @ ${hubName}</div>
                                <div class="text-gray-600 dark:text-gray-400 leading-snug">
                                    <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${waitStr}</b> Wait</span><br>
                                    &bull; Connect to <span class="font-bold text-blue-600 dark:text-blue-400">${trainDest} Train ${nextLeg.train}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        html += '</div>';
        return html;
    },

    renderTransferTimeline: (step) => {
        const hubArr = timeToSeconds(step.leg1.arrTime);
        const hubDep = timeToSeconds(step.leg2.depTime);
        const waitMins = Math.floor((hubDep - hubArr) / 60);
        const waitStr = PlannerRenderer.formatDuration(waitMins);
        
        // Apply Kempton Intercept here
        let train2Dest = PlannerRenderer.applyUIIntercepts(step.leg2.actualDestination || step.leg2.route.destB);

        const standardTransferBlock = `
            <div class="relative pl-6 pb-6 pt-2">
                <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900 z-10"></div>
                <div class="mt-1 text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded border-l-4 border-yellow-500">
                    <div class="font-bold uppercase tracking-wide mb-1">TRANSFER REQUIRED</div>
                    <div class="text-gray-600 dark:text-gray-400 leading-snug">
                        <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${waitStr}</b> Wait</span><br>
                        &bull; Connect to <span class="font-bold text-blue-600 dark:text-blue-400">${train2Dest} Train ${step.leg2.train}</span>
                    </div>
                </div>
            </div>
        `;

        return `
            <div class="mt-4 ml-0 space-y-0">
                ${PlannerRenderer.renderLegTimeline(step.leg1, step.from, step.transferStation, `stops-leg1-${step.train}`, false)}
                <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">${standardTransferBlock}</div>
                ${PlannerRenderer.renderLegTimeline(step.leg2, step.transferStation, step.to, `stops-leg2-${step.train}`, true)}
            </div>
        `;
    },

    renderDoubleTransferTimeline: (step) => {
        // --- CALCULATIONS ---
        const arr1 = timeToSeconds(step.leg1.arrTime);
        const dep2 = timeToSeconds(step.leg2.depTime);
        const wait1Mins = Math.floor((dep2 - arr1) / 60);
        const wait1Str = PlannerRenderer.formatDuration(wait1Mins);

        const arr2 = timeToSeconds(step.leg2.arrTime);
        const dep3 = timeToSeconds(step.leg3.depTime);
        const wait2Mins = Math.floor((dep3 - arr2) / 60);
        const wait2Str = PlannerRenderer.formatDuration(wait2Mins);

        const formatStation = (s) => PlannerRenderer.applyUIIntercepts(s);
        const hub1Name = formatStation(step.hub1);
        const hub2Name = formatStation(step.hub2);
        
        const leg1Id = `l1-${step.train}`;
        const leg2Id = `l2-${step.train}`;
        const leg3Id = `l3-${step.train}`;

        let train2Dest = formatStation(step.leg2.actualDestination || step.leg2.route.destB);
        let train3Dest = formatStation(step.leg3.actualDestination || step.leg3.route.destB);

        const transferBlock1 = `
            <div class="relative pl-6 pb-6 pt-2">
                <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-yellow-500 ring-4 ring-yellow-100 dark:ring-yellow-900 z-10"></div>
                <div class="mt-1 text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded border-l-4 border-yellow-500">
                    <div class="font-bold uppercase tracking-wide mb-1">TRANSFER 1 @ ${hub1Name}</div>
                    <div class="text-gray-600 dark:text-gray-400 leading-snug">
                        <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${wait1Str}</b> Wait</span><br>
                        &bull; Connect to <span class="font-bold text-blue-600 dark:text-blue-400">${train2Dest} Train ${step.leg2.train}</span>
                    </div>
                </div>
            </div>
        `;

        const transferBlock2 = `
            <div class="relative pl-6 pb-6 pt-2">
                <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-100 dark:ring-purple-900 z-10"></div>
                <div class="mt-1 text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 p-2 rounded border-l-4 border-purple-500">
                    <div class="font-bold uppercase tracking-wide mb-1">TRANSFER 2 @ ${hub2Name}</div>
                    <div class="text-gray-600 dark:text-gray-400 leading-snug">
                        <span class="font-bold text-gray-900 dark:text-white">⏱ <b>${wait2Str}</b> Wait</span><br>
                        &bull; Connect to <span class="font-bold text-blue-600 dark:text-blue-400">${train3Dest} Train ${step.leg3.train}</span>
                    </div>
                </div>
            </div>
        `;

        return `
            <div class="mt-4 ml-0 space-y-0">
                ${PlannerRenderer.renderLegTimeline(step.leg1, step.from, step.hub1, leg1Id, false)}
                <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">${transferBlock1}</div>
                ${PlannerRenderer.renderLegTimeline(step.leg2, step.hub1, step.hub2, leg2Id, false)}
                <div class="border-l-2 border-gray-300 dark:border-gray-600 ml-2">${transferBlock2}</div>
                ${PlannerRenderer.renderLegTimeline(step.leg3, step.hub2, step.to, leg3Id, true)}
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
        
        const midnightRollover = PlannerRenderer.isMidnightRollover();
        
        let effectiveDepSec = depSec;
        let isTomorrowOverride = false;
        
        // GUARDIAN PHASE 14 & PHASE D: Protect future trips from triggering departed/missed flags
        // and apply correct weekend math (dayOffset) to prevent 24-hour hallucinations.
        if (midnightRollover || step.dayLabel) { 
            const offsetMultiplier = step.dayOffset ? step.dayOffset : 1;
            effectiveDepSec += (86400 * offsetMultiplier); 
            isTomorrowOverride = true; 
        }

        if (isToday && !isTomorrowOverride) {
            if (effectiveDepSec > nowSec) {
                const diff = effectiveDepSec - nowSec;
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                countdown = h > 0 ? `Departs in ${h}h ${m}m` : (m === 0 ? "Departs in < 1 min" : `Departs in ${m} min`);
            } else { countdown = "Departed"; isDeparted = true; }
        }
        
        const durSec = arrSec - depSec;
        const durMins = Math.floor(durSec / 60);
        return { countdown, duration: PlannerRenderer.formatDuration(durMins), isDeparted };
    }
};

// --- INITIALIZATION ---
function initPlanner() {
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');
    const swapBtn = document.getElementById('planner-swap-btn');
    const searchBtn = document.getElementById('planner-search-btn');
    const resetBtn = document.getElementById('planner-reset-btn');
    const locateBtn = document.getElementById('planner-locate-btn');
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
                <option value="saturday">Saturday / Public Holiday</option>
                <option value="sunday">Sunday</option>
            </select>
        `;
        inputSection.insertBefore(daySelectDiv, searchBtn);
        
        const daySelect = document.getElementById('planner-day-select');
        // GUARDIAN BUGFIX: Ensures the UI dropdown perfectly mirrors the Holiday Sync state 
        // established by logic.js during the startup cycle.
        if (daySelect) {
            daySelect.value = (typeof selectedPlannerDay !== 'undefined' && selectedPlannerDay) ? selectedPlannerDay : (typeof currentDayType !== 'undefined' ? currentDayType : 'weekday');
            daySelect.addEventListener('change', (e) => selectedPlannerDay = e.target.value);
        }
    }

    // Inject History Container
    if (inputSection && !document.getElementById('planner-history-container')) {
        const historyContainer = document.createElement('div');
        historyContainer.id = 'planner-history-container';
        historyContainer.className = "mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 hidden";
        inputSection.appendChild(historyContainer);
        if (typeof renderPlannerHistory === 'function') renderPlannerHistory();
    }

    // Wiring Info Button
    const infoBtn = document.getElementById('planner-info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            if (typeof triggerHaptic === 'function') triggerHaptic();
            if (typeof openSmoothModal === 'function') {
                openSmoothModal('help-modal');
            } else {
                const helpModal = document.getElementById('help-modal');
                if (helpModal) helpModal.classList.remove('hidden');
            }
        });
    }

    // GUARDIAN RESTORE: Developer Access (5-Tap) on Planner Tab
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
                const appTitle = document.getElementById('app-title');
                if (appTitle) appTitle.click(); 
            }
        });
    }

    if (!fromSelect || !toSelect) return;

    setupAutocomplete('planner-from-search', 'planner-from');
    setupAutocomplete('planner-to-search', 'planner-to');

    // GUARDIAN RESTORE: Locate Button Logic
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
                        const nearest = candidates[0];
                        fromSelect.value = nearest.stationName;
                        const fromInputSearch = document.getElementById('planner-from-search');
                        if(fromInputSearch) {
                            fromInputSearch.value = nearest.stationName.replace(' STATION', '');
                            fromInputSearch.dataset.resolvedValue = nearest.stationName;
                        }
                        
                        filterToOptions();
                        showToast(`Located: ${nearest.stationName.replace(' STATION', '')} (${nearest.dist.toFixed(1)}km)`, "success");
                        
                        if (typeof trackAnalyticsEvent === 'function') {
                            trackAnalyticsEvent('planner_auto_locate', { station: nearest.stationName });
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

    // GUARDIAN V6.20: The Ghost Filter Patch
    const filterToOptions = () => {
        const fromInputEl = document.getElementById('planner-from-search');
        const toInputEl = document.getElementById('planner-to-search');
        
        const selectedFrom = (fromInputEl && fromInputEl.dataset.resolvedValue) ? fromInputEl.dataset.resolvedValue : fromSelect.value;
        const selectedTo = (toInputEl && toInputEl.dataset.resolvedValue) ? toInputEl.dataset.resolvedValue : toSelect.value;

        Array.from(toSelect.options).forEach(opt => {
            if (opt.value === selectedFrom && opt.value !== "") {
                opt.disabled = true;
                opt.hidden = true; 
            } else {
                opt.disabled = false;
                opt.hidden = false;
            }
        });
        
        if (selectedFrom && selectedFrom !== "" && selectedTo === selectedFrom) {
            toSelect.value = "";
            if(toInputEl) {
                toInputEl.value = "";
                delete toInputEl.dataset.resolvedValue;
            }
        }
    };
    
    fromSelect.addEventListener('change', filterToOptions);
    const fromInput = document.getElementById('planner-from-search');
    if(fromInput) fromInput.addEventListener('change', filterToOptions);

    if (swapBtn) {
        swapBtn.addEventListener('click', () => {
            if (typeof window.swapPlannerResults === 'function') {
                window.swapPlannerResults();
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (typeof triggerHaptic === 'function') triggerHaptic(); 

            const fromInputSearch = document.getElementById('planner-from-search');
            const toInputSearch = document.getElementById('planner-to-search');

            const resolveStation = (inputEl) => {
                if (!inputEl) return "";
                if (inputEl.dataset.resolvedValue) return inputEl.dataset.resolvedValue;
                
                const inputVal = inputEl.value;
                if (!inputVal || typeof MASTER_STATION_LIST === 'undefined') return "";

                const cleanInput = inputVal.trim().replace(/\s+/g, ' ').toUpperCase();
                const exact = MASTER_STATION_LIST.find(s => s.replace(' STATION', '').trim().toUpperCase() === cleanInput);
                if (exact) {
                    inputEl.dataset.resolvedValue = exact;
                    return exact;
                }

                const matches = MASTER_STATION_LIST.filter(s => s.replace(' STATION', '').trim().toUpperCase().includes(cleanInput));
                if (matches.length === 1) {
                    inputEl.dataset.resolvedValue = matches[0];
                    return matches[0];
                }
                return "";
            };

            const from = resolveStation(fromInputSearch);
            const to = resolveStation(toInputSearch);

            if (from && fromInputSearch) fromInputSearch.value = from.replace(' STATION', '');
            if (to && toInputSearch) toInputSearch.value = to.replace(' STATION', '');

            const fromSelect = document.getElementById('planner-from');
            const toSelect = document.getElementById('planner-to');
            if (fromSelect && from) {
                if (!fromSelect.querySelector(`option[value="${from}"]`)) {
                    fromSelect.appendChild(new Option(from, from));
                }
                fromSelect.value = from;
            }
            if (toSelect && to) {
                if (!toSelect.querySelector(`option[value="${to}"]`)) {
                    toSelect.appendChild(new Option(to, to));
                }
                toSelect.value = to;
            }

            if (!from || !to) return showToast("Please select valid stations from the list.", "error");
            if (from === to) return showToast("Origin and Destination cannot be the same.", "error");

            if (typeof trackAnalyticsEvent === 'function') {
                trackAnalyticsEvent('planner_search', {
                    origin: from,
                    destination: to,
                    day: typeof selectedPlannerDay !== 'undefined' ? selectedPlannerDay : 'unknown'
                });
            }

            if (typeof savePlannerHistory === 'function') savePlannerHistory(from, to);
            if (typeof executeTripPlan === 'function') executeTripPlan(from, to);
        });
    }

    // GUARDIAN Phase 10 & 11: Router-Aware Reset
    const resetAction = () => {
        if (typeof triggerHaptic === 'function') triggerHaptic();
        
        window.hidePlannerResults();
        
        // GUARDIAN Phase 1 (Router Stabilization): 
        // Bypass async history.back() to prevent race conditions with the main ui.js popstate.
        // We explicitly replace the URL state to halt backward bleed to #home.
        if (location.hash === '#planner-results') {
            history.replaceState({ view: 'planner' }, '', '#planner');
        }
    };

    if (resetBtn) resetBtn.addEventListener('click', resetAction);
    if (backBtn) backBtn.addEventListener('click', resetAction);

    // GUARDIAN Phase 10: Clean up state if user switches tabs while deep in planner results
    const tabNextTrain = document.getElementById('tab-next-train');
    if (tabNextTrain) {
        tabNextTrain.addEventListener('click', () => {
            if (location.hash === '#planner-results') {
                history.replaceState({ view: 'home' }, '', '#home');
                window.hidePlannerResults();
            }
        });
    }
}

// --- GUARDIAN V6.15 & V6.04.17: UNCONDITIONAL BULLETPROOF RESULTS SWAP ---
window.swapPlannerResults = function() {
    if (typeof triggerHaptic === 'function') triggerHaptic();

    const fromInput = document.getElementById('planner-from-search');
    const toInput = document.getElementById('planner-to-search');
    const fromSelect = document.getElementById('planner-from');
    const toSelect = document.getElementById('planner-to');

    if (!fromInput || !toInput) return;

    let preferredTime = null;
    const dropdown = document.querySelector('#planner-results-list select');
    if (dropdown && typeof currentTripOptions !== 'undefined' && currentTripOptions.length > 0) {
        const selectedIdx = parseInt(dropdown.value);
        if (currentTripOptions[selectedIdx]) {
            preferredTime = currentTripOptions[selectedIdx].depTime;
        }
    }

    // 1. Unconditional Visual Swap
    const tempFromVal = fromInput.value;
    fromInput.value = toInput.value;
    toInput.value = tempFromVal;

    // Clear datasets to force re-resolution based on the strictly new text
    delete fromInput.dataset.resolvedValue;
    delete toInput.dataset.resolvedValue;

    // 2. Mathematical Resolution Attempt
    const resolveStation = (inputEl) => {
        if (!inputEl) return "";
        const inputVal = inputEl.value;
        if (!inputVal || typeof MASTER_STATION_LIST === 'undefined') return "";

        const cleanInput = inputVal.trim().replace(/\s+/g, ' ').toUpperCase();
        const exact = MASTER_STATION_LIST.find(s => s.replace(' STATION', '').trim().toUpperCase() === cleanInput);
        if (exact) return exact;

        const matches = MASTER_STATION_LIST.filter(s => s.replace(' STATION', '').trim().toUpperCase().includes(cleanInput));
        if (matches.length === 1) return matches[0];
        
        return "";
    };

    const resolvedFrom = resolveStation(fromInput);
    const resolvedTo = resolveStation(toInput);

    // 3. Sync legacy selects securely if resolved
    if (resolvedFrom) {
        fromInput.dataset.resolvedValue = resolvedFrom;
        if (fromSelect) {
            if (!fromSelect.querySelector(`option[value="${resolvedFrom}"]`)) fromSelect.appendChild(new Option(resolvedFrom, resolvedFrom));
            fromSelect.value = resolvedFrom;
        }
    } else {
        if (fromSelect) fromSelect.value = "";
    }

    if (resolvedTo) {
        toInput.dataset.resolvedValue = resolvedTo;
        if (toSelect) {
            if (!toSelect.querySelector(`option[value="${resolvedTo}"]`)) toSelect.appendChild(new Option(resolvedTo, resolvedTo));
            toSelect.value = resolvedTo;
        }
    } else {
        if (toSelect) toSelect.value = "";
    }

    const resultsSection = document.getElementById('planner-results-section');
    const isOnResultsScreen = resultsSection && !resultsSection.classList.contains('hidden');

    // 4. Execution & Dead-End Error Handling
    if (!resolvedFrom || !resolvedTo) {
        showToast("Stations swapped. Please clarify names.", "warning");
        if (isOnResultsScreen) {
            // Bounce the user back to the input screen to fix the ambiguous names
            window.hidePlannerResults();
        } else {
            if (fromSelect) fromSelect.dispatchEvent(new Event('change'));
            if (fromInput) fromInput.dispatchEvent(new Event('change'));
        }
        return; 
    }

    // Successfully resolved both!
    if (isOnResultsScreen) {
        showToast("Reversing Direction...", "info", 1000);
        if (typeof executeTripPlan === 'function') {
            executeTripPlan(resolvedFrom, resolvedTo, preferredTime);
        }
    } else {
        // Just trigger ghost filter update silently
        if (fromSelect) fromSelect.dispatchEvent(new Event('change'));
        if (fromInput) fromInput.dispatchEvent(new Event('change'));
    }
};

// --- HISTORY & AUTOCOMPLETE ---
function savePlannerHistory(from, to) {
    if (!from || !to) return;
    const cleanFrom = from.replace(' STATION', '');
    const cleanTo = to.replace(' STATION', '');
    const routeKey = `${cleanFrom}|${cleanTo}`;
    
    const historyKey = 'plannerHistory_' + (typeof currentRegion !== 'undefined' ? currentRegion : 'GP');
    
    let history = JSON.parse(safeStorage.getItem(historyKey) || "[]");
    history = history.filter(item => `${item.from}|${item.to}` !== routeKey);
    history.unshift({ from: cleanFrom, to: cleanTo, fullFrom: from, fullTo: to });
    if (history.length > 4) history = history.slice(0, 4);
    
    safeStorage.setItem(historyKey, JSON.stringify(history));
    renderPlannerHistory();
}

function renderPlannerHistory() {
    const container = document.getElementById('planner-history-container');
    if (!container) return;
    
    const historyKey = 'plannerHistory_' + (typeof currentRegion !== 'undefined' ? currentRegion : 'GP');
    let rawHistory = JSON.parse(safeStorage.getItem(historyKey) || "[]");

    let validHistory = rawHistory;
    if (typeof MASTER_STATION_LIST !== 'undefined' && MASTER_STATION_LIST.length > 0) {
        validHistory = rawHistory.filter(item =>
            MASTER_STATION_LIST.includes(item.fullFrom) &&
            MASTER_STATION_LIST.includes(item.fullTo)
        );
    } else if (typeof MASTER_STATION_LIST !== 'undefined' && MASTER_STATION_LIST.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    if (validHistory.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="flex items-center justify-between mb-2 px-1">
             <p class="text-xs font-bold text-gray-400 uppercase">Recent Trips</p>
             <button onclick="safeStorage.removeItem('${historyKey}'); renderPlannerHistory()" class="text-[10px] text-gray-400 hover:text-red-500 focus:outline-none">Clear</button>
        </div>
        <div class="flex flex-col gap-2">
            ${validHistory.map(item => `
                <button onclick="restorePlannerSearch('${item.fullFrom}', '${item.fullTo}')" 
                    class="w-full flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 shadow-sm hover:border-blue-50 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors group text-left focus:outline-none">
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
        if (fromInput) {
            fromInput.value = fullFrom.replace(' STATION', '');
            fromInput.dataset.resolvedValue = fullFrom;
        }
        if (toInput) {
            toInput.value = fullTo.replace(' STATION', '');
            toInput.dataset.resolvedValue = fullTo;
        }
        
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

// GUARDIAN V6.20 & V6.04.17: Prevents trailing space bugs & Enables 1-Tap Select List
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
    list.className = "absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-lg shadow-xl max-h-60 overflow-y-auto hidden mt-1 left-0 custom-scrollbar";
    input.parentNode.appendChild(list);

    const renderList = (filterText = '') => {
        list.innerHTML = '';
        const val = filterText.trim().toUpperCase();
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
                    input.dataset.resolvedValue = station;
                    if (select) {
                        if (!select.querySelector(`option[value="${station}"]`)) {
                            const opt = document.createElement('option');
                            opt.value = station;
                            opt.textContent = station;
                            select.appendChild(opt);
                        }
                        select.value = station;
                        const event = new Event('change');
                        select.dispatchEvent(event);
                    }
                    list.classList.add('hidden');
                };
                list.appendChild(li);
            });
        }
        list.classList.remove('hidden');
    };

    input.addEventListener('input', () => { 
        delete input.dataset.resolvedValue;
        if(select) select.value = ""; 
        renderList(input.value); 
    });
    
    // GUARDIAN FIX: Unconditionally select text and display full list on focus,
    // saving the user from having to manually backspace the existing text.
    input.addEventListener('focus', () => {
        input.select();
        renderList('');
    });
    
    chevron.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        if (list.classList.contains('hidden')) {
            renderList('');
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

// --- ORCHESTRATION ---
function executeTripPlan(origin, dest, preferredTime = null) {
    const resultsContainer = document.getElementById('planner-results-list');
    resultsContainer.innerHTML = '<div class="text-center p-4"><svg class="w-8 h-8 animate-spin mx-auto text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-xs text-gray-500">Calculating route...</p></div>';
    
    document.getElementById('planner-input-section').classList.add('hidden');
    document.getElementById('planner-results-section').classList.remove('hidden');
    plannerExpandedState.clear();

    // Push Results State
    if (location.hash !== '#planner-results') {
        history.pushState({ view: 'planner-results' }, '', '#planner-results');
    }

    if (!selectedPlannerDay) selectedPlannerDay = currentDayType;

    setTimeout(() => {
        let plannerResponse = { status: 'NO_PATH', trips: [] };
        if (typeof planUnifiedTrip === 'function') {
            plannerResponse = planUnifiedTrip(origin, dest, selectedPlannerDay);
        } else {
            console.error("Critical Error: planUnifiedTrip is undefined.");
        }

        currentTripOptions = plannerResponse.trips || [];
        currentPlannerStatus = plannerResponse.status; // GUARDIAN PHASE 13: Track status
        
        if (currentTripOptions.length > 0) {
            let nextTripIndex = 0;
            
            if (preferredTime) {
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
            } else {
                const nowSec = timeToSeconds(currentTime);
                const isToday = (!selectedPlannerDay || selectedPlannerDay === currentDayType);
                
                let isMidnightRollover = false;
                if (isToday && currentTripOptions.length > 0) {
                    const latestDep = Math.max(...currentTripOptions.map(t => timeToSeconds(t.depTime)));
                    if (nowSec > latestDep) isMidnightRollover = true;
                }
                
                // GUARDIAN PHASE 14: Dynamic Time-Sync Fix.
                // If it's an impossible route, a normal rollover, OR a simulated rollover (like searching on Sunday for Monday), 
                // instantly snap the dropdown to the 1st train of that day (Index 0).
                if (currentPlannerStatus === 'IMPOSSIBLE_TODAY' || currentPlannerStatus === 'NO_MORE_TODAY') {
                    nextTripIndex = 0;
                } else if (currentTripOptions.length > 0 && currentTripOptions[0].dayLabel) {
                    nextTripIndex = 0;
                } else if (isMidnightRollover) {
                    nextTripIndex = 0;
                } else {
                    const idx = currentTripOptions.findIndex(t => timeToSeconds(t.depTime) >= nowSec);
                    if (idx !== -1) nextTripIndex = idx;
                    else nextTripIndex = currentTripOptions.length - 1;
                }
            }

            renderSelectedTrip(resultsContainer, nextTripIndex);
            startPlannerPulse(nextTripIndex);

        } else {
            if (typeof trackAnalyticsEvent === 'function') {
                trackAnalyticsEvent('planner_no_result', { origin: origin, destination: dest });
            }
            
            updatePlannerHeader("No Route Found", false);

            const errorTitle = "No Route Found";
            const errorMsg = `
                <div class="text-left space-y-2 mt-2">
                    <p>We couldn't find a route connecting these stations within 3 train changes.</p>
                    <ul class="list-disc pl-5 space-y-1 text-xs">
                        <li>Try checking the <strong>Network Map</strong> to visualize available lines.</li>
                        <li>You may need to plan this journey in segments (e.g., 'Home to Hub', then 'Hub to Work').</li>
                        <li>Ensure both stations have active train service today.</li>
                    </ul>
                </div>
            `;
            const actionBtn = `
                <button onclick="document.getElementById('map-modal').classList.remove('hidden')" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors w-full flex items-center justify-center focus:outline-none">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                    Open Network Map
                </button>
            `;
            resultsContainer.innerHTML = renderErrorCard(errorTitle, errorMsg, actionBtn);
        }
    }, 100); 
}

function renderSelectedTrip(container, index) {
    const selectedTrip = currentTripOptions[index];
    if (!selectedTrip) return; 

    const isTomorrow = selectedTrip.dayLabel !== undefined;
    const midnightRollover = PlannerRenderer.isMidnightRollover();

    const effectivelyTomorrow = isTomorrow || midnightRollover;

    if (effectivelyTomorrow) {
        // GUARDIAN PHASE 13: Distinct handling for Mathematically Impossible routes vs simply missing the last train
        if (currentPlannerStatus === 'IMPOSSIBLE_TODAY') {
            renderImpossibleTodayResult(container, currentTripOptions, index);
        } else {
            renderNoMoreTrainsResult(container, currentTripOptions, index, "No more trains today");
        }
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
    const el = document.getElementById(id);
    const btn = document.getElementById(`btn-${id}`);
    if (!el) return;

    el.classList.toggle('hidden');
    const isHidden = el.classList.contains('hidden');

    if (isHidden) plannerExpandedState.delete(id);
    else plannerExpandedState.add(id);

    if(btn) btn.textContent = isHidden ? "Show All Stops" : "Hide Stops";
};

// --- VIEW COMPONENTS ---

function getPlanningDayLabel() {
    const day = selectedPlannerDay || currentDayType;
    if (day === 'sunday') return "Sunday";
    if (day === 'saturday') return "Saturday / Public Holiday Schedule";
    return "Weekday Schedule";
}

function updatePlannerHeader(dayLabel, showShare = true) {
    const headerTitle = document.querySelector('#planner-results-section h4');
    const spacer = document.querySelector('#planner-results-section .w-8, #planner-results-section .planner-share-slot'); 
    
    if (headerTitle) {
        headerTitle.innerHTML = "";
        headerTitle.className = "flex-1 w-0 flex justify-center mx-1"; 
        
        const badge = document.createElement("div");
        badge.className = "relative bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs font-bold rounded-lg border border-blue-100 dark:border-blue-800 shadow-sm flex items-center transition-colors w-full max-w-[150px] cursor-pointer group h-[38px]"; 
        
        let selDay = selectedPlannerDay || (typeof currentDayType !== 'undefined' ? currentDayType : 'weekday');
        
        badge.innerHTML = `
            <select id="planner-header-day-select" class="appearance-none bg-transparent pl-3 pr-7 py-2 outline-none font-bold text-blue-600 dark:text-blue-400 cursor-pointer z-10 relative w-full text-center truncate text-[12px] h-full focus:ring-0">
                <option value="weekday" ${selDay === 'weekday' ? 'selected' : ''}>Mon - Fri</option>
                <option value="saturday" ${selDay === 'saturday' ? 'selected' : ''}>Saturday / Hol</option>
                <option value="sunday" ${selDay === 'sunday' ? 'selected' : ''}>Sunday</option>
            </select>
            <div class="absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none text-blue-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        `;
        
        const selEl = badge.querySelector('select');
        selEl.addEventListener('change', (e) => {
            if (typeof triggerHaptic === 'function') triggerHaptic();
            selectedPlannerDay = e.target.value;
            const daySelect = document.getElementById('planner-day-select');
            if (daySelect) daySelect.value = selectedPlannerDay;
            
            if (typeof showToast === 'function') {
                showToast("Switched to " + e.target.options[e.target.selectedIndex].text, "info", 1500);
            }
            
            // GUARDIAN V7: Safely extract resolved origin and destination directly from the active results memory.
            // If the user is on the NO_PATH screen, fall back robustly to the input fields.
            let fromStation = "";
            let toStation = "";
            
            if (typeof currentTripOptions !== 'undefined' && currentTripOptions.length > 0) {
                fromStation = currentTripOptions[0].from;
                toStation = currentTripOptions[0].to;
            } else {
                const fromInput = document.getElementById('planner-from-search');
                const toInput = document.getElementById('planner-to-search');
                const fromSelect = document.getElementById('planner-from');
                const toSelect = document.getElementById('planner-to');
                
                fromStation = (fromInput && fromInput.dataset.resolvedValue) ? fromInput.dataset.resolvedValue : (fromSelect ? fromSelect.value : "");
                toStation = (toInput && toInput.dataset.resolvedValue) ? toInput.dataset.resolvedValue : (toSelect ? toSelect.value : "");
            }

            if (fromStation && toStation) {
                executeTripPlan(fromStation, toStation);
            } else if (typeof showToast === 'function') {
                showToast("Could not resolve stations for new date.", "error");
            }
        });
        
        headerTitle.appendChild(badge);
        headerTitle.classList.remove('hidden');
    }

    if (spacer) {
        spacer.innerHTML = ""; 
        spacer.style.display = 'block'; 
        
        if (showShare) {
            spacer.className = "flex-none planner-share-slot"; 
            const shareBtn = document.createElement("button");
            shareBtn.className = "flex items-center text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors group flex-none whitespace-nowrap shadow-sm border border-blue-100 dark:border-blue-800 focus:outline-none";
            shareBtn.title = "Share Trip Plan";
            
            shareBtn.onclick = async () => {
                if (typeof triggerHaptic === 'function') triggerHaptic(); 
                
                const dropdown = document.querySelector('#planner-results-list select');
                let selectedTime = null;
                let fromStation = "";
                let toStation = "";
                
                if (currentTripOptions.length > 0) {
                     const idx = dropdown ? (parseInt(dropdown.value) || 0) : 0;
                     const selectedTrip = currentTripOptions[idx] || currentTripOptions[0];
                     selectedTime = selectedTrip.depTime;
                     fromStation = (selectedTrip.from || "").replace(/ STATION/gi, '').trim();
                     toStation = (selectedTrip.to || "").replace(/ STATION/gi, '').trim();
                } else {
                     fromStation = (document.getElementById('planner-from-search').value || "").trim();
                     toStation = (document.getElementById('planner-to-search').value || "").trim();
                }
                
                const safeTime = (selectedTime || "").trim();
                const safeDay = (selectedPlannerDay || "").trim();
                const safeRegion = typeof currentRegion !== 'undefined' ? currentRegion : 'GP';
                
                const params = new URLSearchParams({
                    action: 'planner',
                    from: fromStation,
                    to: toStation,
                    time: safeTime,
                    day: safeDay,
                    region: safeRegion 
                });
                
                const shareLink = `https://nexttrain.co.za/?${params.toString()}`;
                const shareText = `Trip Plan: ${fromStation} to ${toStation}.`;

                const data = { title: 'Next Train Trip Plan', text: shareText, url: shareLink };
                try { 
                    if (navigator.share) await navigator.share(data); 
                    else {
                        const textArea = document.createElement('textarea');
                        textArea.value = `${shareText} Check details here: ${shareLink}`;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        alert('Link copied to clipboard!');
                    }
                } catch(e) {}
            };
            
            shareBtn.innerHTML = `
                Share Trip
                <svg class="w-4 h-4 ml-1.5 transform transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            `;
            
            spacer.appendChild(shareBtn);
        } else {
            spacer.className = "flex-none planner-share-slot invisible w-24";
            spacer.innerHTML = `<div></div>`;
        }
    }
}

function renderTripResult(container, trips, selectedIndex = 0) {
    const selectedTrip = trips[selectedIndex];
    if (!selectedTrip) return; 

    const dayLabel = getPlanningDayLabel();
    
    updatePlannerHeader(dayLabel, true);

    container.innerHTML = PlannerRenderer.buildCard(selectedTrip, false, trips, selectedIndex);
}

function renderNoMoreTrainsResult(container, trips, selectedIndex = 0, title = "No more trains today") {
    const selectedTrip = trips[selectedIndex];
    if (!selectedTrip) return; 

    const dayLabel = getPlanningDayLabel();
    
    updatePlannerHeader(dayLabel, true);

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

// GUARDIAN PHASE 13: Specialized aesthetic for mathematically impossible routes on sparse schedules
function renderImpossibleTodayResult(container, trips, selectedIndex = 0) {
    const selectedTrip = trips[selectedIndex];
    if (!selectedTrip) return;

    const dayLabel = getPlanningDayLabel();
    updatePlannerHeader(dayLabel, true);

    container.innerHTML = `
        <div class="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 shadow-sm">
            <div class="flex items-start mb-3">
                <div class="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span class="text-base">📅</span>
                </div>
                <div>
                    <h3 class="font-bold text-gray-900 dark:text-white">Route Unavailable Today</h3>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-snug">Today's limited schedule does not support this exact route. Showing the next available option for <b>${selectedTrip.dayLabel || 'Tomorrow'}</b>.</p>
                </div>
            </div>
            ${PlannerRenderer.buildCard(selectedTrip, true, trips, selectedIndex)}
        </div>
    `;
}

function renderErrorCard(title, message, actionHtml = "") {
    return `
        <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-5 text-center shadow-sm">
            <div class="flex items-center justify-center mb-2">
                <span class="text-3xl mr-2">⚠️</span>
                <h3 class="font-black text-yellow-800 dark:text-yellow-400 text-lg">${title}</h3>
            </div>
            <div class="text-sm text-gray-700 dark:text-gray-300 border-t border-yellow-200 dark:border-yellow-800/50 pt-3">
                ${message}
            </div>
            ${actionHtml}
        </div>
    `;
}

// --- GUARDIAN PHASE 6 & 20: LAZY-LOADED TRIP MAP ENGINE (ERGONOMICS UPGRADE) ---
let tripMapInstance = null;

window.openTripMapRenderer = async function(routeData) {
    if (typeof triggerHaptic === 'function') triggerHaptic();

    if (!navigator.onLine && !window.L) {
        showToast("Internet connection required to load live map.", "error");
        return;
    }

    showToast("Loading live map...", "info", 1500);

    // 0. GUARDIAN Phase 20: Inject Map UX CSS (Dark Mode, Halos, Pulses)
    if (!document.getElementById('live-map-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'live-map-custom-styles';
        style.innerHTML = `
            .gps-pulse { width: 16px; height: 16px; background: #3b82f6; border-radius: 50%; box-shadow: 0 0 0 rgba(59, 130, 246, 0.4); animation: pulse 2s infinite; border: 3px solid white; }
            @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
            .custom-div-icon { background: transparent; border: none; }
            .dark .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
            .tooltip-dynamic { transition: opacity 0.3s ease, font-size 0.2s ease; font-family: 'Inter', sans-serif; opacity: 0; }
            .leaflet-tooltip.tooltip-halo { background: transparent !important; border: none !important; box-shadow: none !important; white-space: nowrap; color: #1f2937; text-shadow: -1.5px -1.5px 0 #ffffff, 1.5px -1.5px 0 #ffffff, -1.5px 1.5px 0 #ffffff, 1.5px 1.5px 0 #ffffff; }
            .dark .leaflet-tooltip.tooltip-halo { color: #ffffff !important; text-shadow: -1px -1px 0 rgba(0, 0, 0, 0.8), 1px -1px 0 rgba(0, 0, 0, 0.8), -1px 1px 0 rgba(0, 0, 0, 0.8), 1px 1px 0 rgba(0, 0, 0, 0.8), 0 0 8px rgba(0,0,0,0.9) !important; }
            .leaflet-tooltip.tooltip-halo::before { display: none !important; }
        `;
        document.head.appendChild(style);
    }

    // 1. Lazy-load Leaflet if missing
    if (!window.L) {
        try {
            await new Promise((resolve, reject) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
                document.head.appendChild(link);

                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch (e) {
            showToast("Failed to load map engine.", "error");
            return;
        }
    }

    // 2. Build Modal Skeleton with Horizontal Action Bar (GUARDIAN UX)
    let modal = document.getElementById('trip-map-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'trip-map-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-90 z-[100] hidden flex items-center justify-center p-0 full-screen backdrop-blur-md transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-900 rounded-none shadow-2xl w-full h-full flex flex-col transform transition-transform duration-300 scale-100 overflow-hidden relative">
                <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-100 dark:bg-gray-800 z-20 relative shrink-0 shadow-sm">
                    <div class="flex items-center space-x-3 min-w-0 pr-2">
                        <span class="text-2xl shrink-0">🗺️</span>
                        <div class="flex flex-col min-w-0">
                            <h3 class="text-base font-black text-gray-900 dark:text-white truncate uppercase tracking-tight mb-0.5" id="trip-map-title">Route Map</h3>
                            <div class="flex items-center">
                                <p class="text-xs text-blue-600 dark:text-blue-400 font-bold truncate shrink-0 mr-2" id="trip-map-subtitle">Loading...</p>
                                <span class="text-[8px] font-bold text-yellow-800 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border border-yellow-200 dark:border-yellow-800">🧪 In Dev</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 shrink-0">
                        <button id="close-trip-map-btn" class="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition focus:outline-none" aria-label="Close Map">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>
                
                <div class="flex-grow w-full bg-gray-200 dark:bg-gray-800 relative z-10">
                    <div id="trip-map-canvas" class="absolute inset-0"></div>
                    
                    <!-- 🛡️ GUARDIAN UX: HORIZONTAL ACTION BAR -->
                    <div class="absolute bottom-6 left-4 right-4 z-[1000] flex justify-between items-end pointer-events-none">
                        <div class="flex items-end space-x-3 pointer-events-auto">
                            <!-- Zoom Controls -->
                            <div class="flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                                <button id="custom-zoom-in" class="w-11 h-11 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-300 dark:border-gray-600 transition-colors focus:outline-none">+</button>
                                <button id="custom-zoom-out" class="w-11 h-11 flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none">−</button>
                            </div>
                            <!-- Theme Toggle -->
                            <button id="custom-theme-btn" class="w-11 h-11 flex items-center justify-center bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-300 dark:border-gray-600 text-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none">
                                ☀️
                            </button>
                        </div>
                        
                        <!-- Auto-Locate Anti-Rubberband Button -->
                        <button id="custom-locate-btn" class="w-14 h-14 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-300 dark:border-gray-600 hover:scale-105 transition-transform pointer-events-auto text-gray-400 focus:outline-none">
                            <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
                        </button>
                    </div>
                </div>

                <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-b-none z-20 relative shrink-0">
                    <button id="close-trip-map-btn-2" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors focus:outline-none">Close Map</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeAction = () => {
            if (location.hash === '#trip-map') history.back();
            else closeSmoothModal('trip-map-modal');
            
            // Delay map destruction to allow CSS transition to finish
            setTimeout(() => {
                if (tripMapInstance) {
                    tripMapInstance.stopLocate(); // GUARDIAN: Stop background GPS polling
                    tripMapInstance.remove();
                    tripMapInstance = null;
                }
            }, 350);
        };

        const closeBtn1 = document.getElementById('close-trip-map-btn');
        if (closeBtn1) closeBtn1.addEventListener('click', closeAction);
        
        const closeBtn2 = document.getElementById('close-trip-map-btn-2');
        if (closeBtn2) closeBtn2.addEventListener('click', closeAction);
    }

    // 3. Open Modal & Push State (Before rendering so container has dimensions)
    history.pushState({ modal: 'trip-map' }, '', '#trip-map');
    openSmoothModal('trip-map-modal');

    // 4. Initialize Leaflet Canvas
    setTimeout(() => {
        if (tripMapInstance) {
            tripMapInstance.remove();
        }

        // Initialize Map (GUARDIAN Phase 20: Default Attribution enabled so it sits naturally at bottom-right)
        tripMapInstance = L.map('trip-map-canvas', {
            zoomControl: false,
            attributionControl: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(tripMapInstance);

        // --- MAP STATE & RENDERING ENGINE ---
        let routeLayerGroup = L.layerGroup().addTo(tripMapInstance);
        
        const createDot = (bgColor, size) => L.divIcon({
            className: 'custom-map-dot',
            html: `<div style="background-color:${bgColor}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
        });

        // The Master Drawing Function
        const drawRouteElements = () => {
            routeLayerGroup.clearLayers();
            
            let currentPath = routeData.path;
            let currentOrigin = routeData.origin;
            let currentDest = routeData.destination;
            let currentValidStops = routeData.validStops;

            // Update Header Titles
            const titleEl = document.getElementById('trip-map-title');
            if (titleEl) titleEl.textContent = `${currentOrigin.replace(' STATION', '')} to ${currentDest.replace(' STATION', '')}`;
            
            const subTitleEl = document.getElementById('trip-map-subtitle');
            if (subTitleEl) {
                const stopCount = currentValidStops ? currentValidStops.length : currentPath.length;
                subTitleEl.textContent = `${stopCount} stops along route`;
            }

            // 1. Draw Curved Track (Using Full Waypoints)
            const polyline = L.polyline(currentPath, {
                color: '#3b82f6', 
                weight: 6,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(routeLayerGroup);

            // GUARDIAN Phase 20: Naked Halo Label Classes
            const majorLabelClass = 'font-bold text-[11px] text-gray-900 dark:text-white z-50 tooltip-dynamic tooltip-halo';
            const minorLabelClass = 'font-medium text-[9.5px] text-gray-700 dark:text-gray-300 tooltip-dynamic tooltip-halo minor-station-tooltip';

            // 2. Draw Clean Station Markers with Naked Halo Tooltips
            if (currentValidStops && currentValidStops.length > 0) {
                // Ghost Buster: Plot only valid physical stops
                currentValidStops.forEach((stop, idx) => {
                    if (idx !== 0 && idx !== currentValidStops.length - 1) {
                         L.circleMarker([stop.lat, stop.lon], { radius: 2.5, color: '#3b82f6', weight: 1, fillColor: '#ffffff', fillOpacity: 1 })
                          .bindTooltip(stop.name.replace(' STATION', ''), { permanent: true, direction: 'top', offset: [0, -5], className: minorLabelClass })
                          .addTo(routeLayerGroup);
                    }
                });
            } else {
                // Legacy Fallback (If validStops array is missing)
                currentPath.forEach((coord, idx) => {
                    if (idx !== 0 && idx !== currentPath.length - 1) {
                         L.circleMarker(coord, { radius: 2.5, color: '#3b82f6', weight: 1, fillColor: '#ffffff', fillOpacity: 1 }).addTo(routeLayerGroup);
                    }
                });
            }

            // 3. Start Marker (Green)
            const startCoord = currentPath[0];
            L.marker(startCoord, { icon: createDot('#22c55e', 14) })
             .bindTooltip(`<b>Start:</b> ${currentOrigin.replace(' STATION', '')}`, { permanent: true, direction: 'top', offset: [0, -10], className: majorLabelClass })
             .addTo(routeLayerGroup);

            // 4. End Marker (Red)
            const endCoord = currentPath[currentPath.length - 1];
            L.marker(endCoord, { icon: createDot('#ef4444', 14) })
             .bindTooltip(`<b>End:</b> ${currentDest.replace(' STATION', '')}`, { permanent: true, direction: 'top', offset: [0, -10], className: majorLabelClass })
             .addTo(routeLayerGroup);

            return polyline;
        };

        // Execute Initial Draw & Frame Route
        const initialPolyline = drawRouteElements();
        tripMapInstance.fitBounds(initialPolyline.getBounds(), { padding: [50, 50] });

        // --- 🛡️ GUARDIAN UX: ACTION BAR WIRING ---
        
        // 1. Zoom Controls
        const zoomInBtn = document.getElementById('custom-zoom-in');
        const zoomOutBtn = document.getElementById('custom-zoom-out');
        if (zoomInBtn) zoomInBtn.onclick = () => tripMapInstance.zoomIn();
        if (zoomOutBtn) zoomOutBtn.onclick = () => tripMapInstance.zoomOut();

        // 2. Theme Toggle
        const themeBtn = document.getElementById('custom-theme-btn');
        let isDarkNow = document.documentElement.classList.contains('dark');
        if (themeBtn) {
            themeBtn.innerHTML = isDarkNow ? '🌙' : '☀️';
            themeBtn.onclick = () => {
                isDarkNow = !isDarkNow;
                if (isDarkNow) {
                    document.documentElement.classList.add('dark');
                    try { localStorage.setItem('theme', 'dark'); } catch(e){}
                    themeBtn.innerHTML = '🌙';
                } else {
                    document.documentElement.classList.remove('dark');
                    try { localStorage.setItem('theme', 'light'); } catch(e){}
                    themeBtn.innerHTML = '☀️';
                }
            };
        }

        // 3. GPS Anti-Rubberband Logic
        let lastKnownLatLng = null;
        let userMarker = null;
        let userRadius = null;
        let isManualLocate = false; // GUARDIAN PHASE D: Anti-rubberband state flag

        const pulsingIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div class="gps-pulse"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        const locateBtn = document.getElementById('custom-locate-btn');
        const locateIcon = locateBtn ? locateBtn.querySelector('svg') : null;

        // Background Location Tracker
        tripMapInstance.on('locationfound', function(e) {
            lastKnownLatLng = e.latlng;
            const radius = e.accuracy / 2;

            if (!userMarker) {
                userMarker = L.marker(e.latlng, { icon: pulsingIcon, zIndexOffset: 1000 }).addTo(tripMapInstance)
                    .bindPopup("<div class='text-xs font-bold text-center text-gray-900'>You are here<br><span class='text-[10px] text-gray-500 font-normal'>Within " + Math.round(radius) + " meters</span></div>");
                userRadius = L.circle(e.latlng, radius, {
                    color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1
                }).addTo(tripMapInstance);
            } else {
                userMarker.setLatLng(e.latlng);
                userRadius.setLatLng(e.latlng);
                userRadius.setRadius(radius);
            }
            
            if (locateIcon) {
                locateIcon.classList.remove('animate-spin', 'text-gray-400');
                locateIcon.classList.add('text-blue-600', 'dark:text-blue-400');
            }

            // Execute flyTo() only if manual request is active
            if (isManualLocate) {
                tripMapInstance.flyTo(e.latlng, 15, { duration: 1.5 });
                isManualLocate = false; // Reset the lock
            }
        });

        tripMapInstance.on('locationerror', function(e) {
            if (locateIcon) {
                locateIcon.classList.remove('animate-spin', 'text-blue-600', 'dark:text-blue-400');
                locateIcon.classList.add('text-gray-400');
            }
            if (e.code !== 1) console.warn("Location error:", e.message);
        });

        // Start passive tracking silently (no setView)
        tripMapInstance.locate({setView: false, watch: true, enableHighAccuracy: true});

        // Manual Locate Click
        if (locateBtn) {
            locateBtn.onclick = () => {
                if (typeof triggerHaptic === 'function') triggerHaptic();
                
                if (lastKnownLatLng) {
                    // Fly camera to the dot elegantly
                    tripMapInstance.flyTo(lastKnownLatLng, 15, { duration: 1.5 });
                } else {
                    // Spin and wait for locationfound event to trigger flyTo()
                    if (locateIcon) {
                        locateIcon.classList.remove('text-gray-400');
                        locateIcon.classList.add('animate-spin', 'text-blue-600', 'dark:text-blue-400');
                    }
                    isManualLocate = true; // Lock active
                    tripMapInstance.locate({setView: false, enableHighAccuracy: true, maxZoom: 15}); // Ensure setView is strictly FALSE
                }
            };
        }

        // --- DYNAMIC TEXT RESIZING & PROGRESSIVE DISCLOSURE ---
        function updateTooltipSize() {
            const zoom = tripMapInstance.getZoom();
            const allTooltips = document.querySelectorAll('.tooltip-dynamic');
            const minorTooltips = document.querySelectorAll('.minor-station-tooltip');

            if (zoom < 11) {
                allTooltips.forEach(t => t.style.opacity = '0');
            } else {
                allTooltips.forEach(t => t.style.opacity = '1');
                if (zoom < 13) {
                    minorTooltips.forEach(t => t.style.opacity = '0');
                }
            }
        }

        tripMapInstance.on('zoomend', updateTooltipSize);
        updateTooltipSize(); 

    }, 350); 
};