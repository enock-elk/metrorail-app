/**
 * METRORAIL NEXT TRAIN - PLANNER UI (V6.00.33 - Guardian Edition)
 * --------------------------------------------------------------
 * THE "HEAD CHEF" (Controller)
 * * This module handles user interaction, DOM updates, and event listeners.
 * It calls the pure logic functions from planner-core.js.
 * * V6.00.21: The Great Decoupling - Absorbed robust UI overrides from monolithic ui.js.
 * * PHASE 10: App Router Parity - Integrated deep history stack for Planner Results.
 */

// State (UI Specific)
let plannerOrigin = null;
let plannerDest = null;
let currentTripOptions = []; 
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

window.addEventListener('popstate', (event) => {
    const hash = location.hash;
    // If user navigates back to root planner, home, or exit trap, hide results
    if (hash === '#planner' || hash === '#home' || hash === '#exit' || !hash) {
        const resultsSection = document.getElementById('planner-results-section');
        if (resultsSection && !resultsSection.classList.contains('hidden')) {
            window.hidePlannerResults();
        }
    }
});

// --- MOVED TO TOP TO PREVENT TDZ ERRORS (Fix 1) ---
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
                const iWaitText = PlannerRenderer.formatDuration(iWaitMin);
                const sName = it.station.replace(' STATION', '');

                const internalTransferHTML = `
                    <div class="relative pl-6 pb-6 pt-2">
                        <div class="absolute -left-[5px] top-4 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-100 dark:ring-purple-900 z-10"></div>
                        <div class="mt-1 text-xs text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 p-2 rounded border-l-4 border-purple-500">
                            <div class="font-bold uppercase tracking-wide mb-1">INTERNAL TRANSFER @ ${sName}</div>
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
                <button id="btn-${id}" onclick="togglePlannerStops('${id}')" class="text-[10px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full transition-colors mb-2 w-fit ml-6 -mt-1 relative top-[-5px] focus:outline-none">
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
        
        // GUARDIAN V6.12: Utilize the robust Midnight Protocol flag
        const midnightRollover = PlannerRenderer.isMidnightRollover();

        const optionsHtml = allOptions.map((opt, idx) => {
            const depSec = timeToSeconds(opt.depTime);
            // If in rollover mode, nothing is "past"
            let isPast = isToday && !midnightRollover && depSec < nowSec;
            
            let label = "";
            let typeLabel = "Direct";
            if (opt.type === 'TRANSFER') typeLabel = "1 Transfer";
            if (opt.type === 'DOUBLE_TRANSFER') typeLabel = "2 Transfers";
            
            if (midnightRollover) {
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
                    <b>Instruction:</b><br> 
                    Take train <b>${step.train}</b> on the <b>${step.route.name}</b> line.
                </p>
            </div>
        </div>
    `,

    renderTimeline: (step) => {
        if (step.type === 'TRANSFER') return PlannerRenderer.renderTransferTimeline(step);
        if (step.type === 'DOUBLE_TRANSFER') return PlannerRenderer.renderDoubleTransferTimeline(step);
        
        // DIRECT TRIP
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
        const hubArr = timeToSeconds(step.leg1.arrTime);
        const hubDep = timeToSeconds(step.leg2.depTime);
        const waitMins = Math.floor((hubDep - hubArr) / 60);
        const waitStr = PlannerRenderer.formatDuration(waitMins);
        
        // Apply Kempton Intercept here
        let train1Dest = PlannerRenderer.applyUIIntercepts(step.leg1.actualDestination || step.leg1.route.destB);
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

        let train1Dest = formatStation(step.leg1.actualDestination || step.leg1.route.destB);
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
        
        const midnightRollover = PlannerRenderer.isMidnightRollover();
        
        let effectiveDepSec = depSec;
        let isTomorrowOverride = false;
        
        if (midnightRollover) { 
            effectiveDepSec += 86400; 
            isTomorrowOverride = true; 
        }

        if (isToday || isTomorrowOverride) {
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
        if (typeof currentDayType !== 'undefined') daySelect.value = currentDayType;
        daySelect.addEventListener('change', (e) => selectedPlannerDay = e.target.value);
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

    // GUARDIAN V6.20: The Ghost Filter Patch (Absorbed from ui.js)
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

    // GUARDIAN Phase 10 & 11 (Fixed in Phase 2 Polish): Router-Aware Reset
    const resetAction = () => {
        if (typeof triggerHaptic === 'function') triggerHaptic();
        
        // GUARDIAN FIX: DO NOT manually wipe the DOM here!
        // Doing so desyncs the visual state from the history stack and causes the popstate event to jump to the Home tab.
        // We simply call history.back() and let the global popstate listener handle the hiding.
        if (location.hash === '#planner-results') {
            history.back();
        } else {
            // Fallback if hash was somehow lost
            window.hidePlannerResults();
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

// --- GUARDIAN V6.15: BULLETPROOF RESULTS SWAP (Absorbed from ui.js) ---
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

    // 1. Capture current visual & semantic states
    let tempFromVal = fromInput.value;
    let tempFromResolved = fromInput.dataset.resolvedValue;

    let tempToVal = toInput.value;
    let tempToResolved = toInput.dataset.resolvedValue;

    // 2. Swap visual text
    fromInput.value = tempToVal;
    toInput.value = tempFromVal;

    // 3. Swap datasets
    if (tempToResolved) fromInput.dataset.resolvedValue = tempToResolved;
    else delete fromInput.dataset.resolvedValue;

    if (tempFromResolved) toInput.dataset.resolvedValue = tempFromResolved;
    else delete toInput.dataset.resolvedValue;

    // 4. Ensure datasets are fully resolved before executing search
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

    const resolvedFrom = resolveStation(fromInput);
    const resolvedTo = resolveStation(toInput);

    // 5. Sync legacy selects safely
    if (fromSelect && resolvedFrom) {
        if (!fromSelect.querySelector(`option[value="${resolvedFrom}"]`)) fromSelect.appendChild(new Option(resolvedFrom, resolvedFrom));
        fromSelect.value = resolvedFrom;
    }
    if (toSelect && resolvedTo) {
        if (!toSelect.querySelector(`option[value="${resolvedTo}"]`)) toSelect.appendChild(new Option(resolvedTo, resolvedTo));
        toSelect.value = resolvedTo;
    }

    if (!resolvedFrom || !resolvedTo) {
        showToast("Cannot resolve stations for swap. Please select from list.", "error");
        return; 
    }

    // GUARDIAN FIX: Visibility Guard
    const resultsSection = document.getElementById('planner-results-section');
    if (resultsSection && !resultsSection.classList.contains('hidden')) {
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
    
    let history = JSON.parse(localStorage.getItem(historyKey) || "[]");
    history = history.filter(item => `${item.from}|${item.to}` !== routeKey);
    history.unshift({ from: cleanFrom, to: cleanTo, fullFrom: from, fullTo: to });
    if (history.length > 4) history = history.slice(0, 4);
    
    localStorage.setItem(historyKey, JSON.stringify(history));
    renderPlannerHistory();
}

function renderPlannerHistory() {
    const container = document.getElementById('planner-history-container');
    if (!container) return;
    
    const historyKey = 'plannerHistory_' + (typeof currentRegion !== 'undefined' ? currentRegion : 'GP');
    let rawHistory = JSON.parse(localStorage.getItem(historyKey) || "[]");

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
             <button onclick="localStorage.removeItem('${historyKey}'); renderPlannerHistory()" class="text-[10px] text-gray-400 hover:text-red-500 focus:outline-none">Clear</button>
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

// GUARDIAN V6.20: Absorbed from ui.js - Prevents trailing space bugs
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

    // GUARDIAN Phase 10: Push Results State
    if (location.hash !== '#planner-results') {
        history.pushState({ view: 'planner-results' }, '', '#planner-results');
    }

    if (!selectedPlannerDay) selectedPlannerDay = currentDayType;

    // Run Asynchronously to prevent UI freeze
    setTimeout(() => {
        const directPlan = planDirectTrip(origin, dest, selectedPlannerDay);
        const transferPlan = planHubTransferTrip(origin, dest, selectedPlannerDay);
        const relayPlan = planRelayTransferTrip(origin, dest, selectedPlannerDay);

        let mergedTrips = [];
        if (directPlan.trips) mergedTrips = [...mergedTrips, ...directPlan.trips];
        if (transferPlan.trips) mergedTrips = [...mergedTrips, ...transferPlan.trips];
        if (relayPlan.trips) mergedTrips = [...mergedTrips, ...relayPlan.trips];

        if (mergedTrips.length === 0) {
            console.log("No simple route found. Attempting 2-Transfer Bridge...");
            const doubleTransferPlan = planDoubleTransferTrip(origin, dest, selectedPlannerDay);
            if (doubleTransferPlan.trips) {
                mergedTrips = [...mergedTrips, ...doubleTransferPlan.trips];
            }
        }

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
                
                if (isMidnightRollover) {
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

            const errorMsg = "We couldn't find a route within 3 legs. Try checking the <b>Network Map</b> to visualize your path. You may need to plan this journey in segments (e.g., 'Home to Pretoria', then 'Pretoria to Work').";
            const actionBtn = `
                <button onclick="document.getElementById('map-modal').classList.remove('hidden')" class="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors w-full flex items-center justify-center focus:outline-none">
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
    if (!selectedTrip) return; 

    const isTomorrow = selectedTrip.dayLabel !== undefined;
    const midnightRollover = PlannerRenderer.isMidnightRollover();

    const effectivelyTomorrow = isTomorrow || midnightRollover;

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
            
            const fromSelect = document.getElementById('planner-from');
            const toSelect = document.getElementById('planner-to');
            if (fromSelect && toSelect && fromSelect.value && toSelect.value) {
                executeTripPlan(fromSelect.value, toSelect.value);
            }
        });
        
        headerTitle.appendChild(badge);
        headerTitle.classList.remove('hidden');
    }

    if (spacer) {
        spacer.innerHTML = ""; 
        spacer.style.display = 'block'; 
        spacer.className = "flex-none planner-share-slot"; 

        if (showShare) {
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

function renderErrorCard(title, message, actionHtml = "") {
    return `
        <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:yellow-700 rounded-lg p-4 text-center">
            <h3 class="font-bold text-yellow-800 dark:text-yellow-200 mb-1">${title}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">${message}</p>
            ${actionHtml}
        </div>
    `;
}