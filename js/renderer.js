/**
 * METRORAIL NEXT TRAIN - RENDERER ENGINE (V6.04.08 - Guardian Edition)
 * ------------------------------------------------
 * This module handles all DOM injection and HTML string generation.
 * It separates the "View" from the "Logic" (ui.js/logic.js).
 * * PART OF PHASE 5: NATIVE EXPERIENCE (Targeted Haptics & Grid UI)
 * * PHASE 1 (BUGFIX 4): Dynamic Holiday Lookahead bindings for UI buttons. Grid dropdowns relabeled.
 * * GUARDIAN PHASE 12: Integrated specific metadata styling for "SPL" vs "NO SVC" in the Timetable Grid.
 * * GUARDIAN PHASE 15: Ultra-Wide Data Matrix Polish (Zebra Striping, Right-Side Anchors, Typography scaling).
 * * GUARDIAN PHASE 16: Ultra-Compact Matrix Mode for routes with 20+ trains (Negative tracking, dynamic min-widths, asymmetrical padding).
 * * GUARDIAN PHASE 17: "Tall Grid" mode for Web UI vertical compression, strict Export sandbox, and Ghost Number transparency fix.
 */

const Renderer = {

    // --- 1. DYNAMIC MENU GENERATION ---

    renderRouteMenu: (containerId, routes, activeRouteId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const categoryMap = {
            "EAST_LINE": "Northern Corridor (Pretoria)",
            "NORTH_LINE": "Northern Corridor (Pretoria)",
            "SAUL_LINE": "Northern Corridor (Pretoria)",
            "SOUTH_LINE": "Pretoria - JHB Line",
            "JHB_EAST": "Pretoria - JHB Line",
            "JHB_CORE": "Pretoria - JHB Line",
            "JHB_WEST": "JHB West Line",
            "JHB_SOUTH": "JHB West Line",
            "WC_CENTRAL": "Cape Town Central Line",
            "WC_SOUTHERN": "Cape Town Southern Line",
            "WC_FLATS": "Cape Flats Line",
            "WC_NORTHERN": "Cape Town Northern Line"
        };

        const categoryOrder = [
            "Northern Corridor (Pretoria)",
            "Pretoria - JHB Line",
            "JHB West Line",
            "Cape Town Central Line",
            "Cape Town Southern Line",
            "Cape Flats Line",
            "Cape Town Northern Line"
        ];
        const groups = {};
        Object.values(routes).forEach(route => {
            if (route.id === 'special_event') return;
            const cat = categoryMap[route.corridorId] || "Other Routes";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(route);
        });

        let html = '';

        if (routes['special_event'] && routes['special_event'].isActive) {
            const r = routes['special_event'];
            const isActive = r.id === activeRouteId;
            const activeBg = isActive ? 'bg-yellow-100 dark:bg-yellow-900/40' : 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20';
            html += `
                <div id="special-event-section" class="mb-3 rounded-xl overflow-hidden border border-yellow-200 dark:border-yellow-800 shadow-sm">
                    <li class="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase tracking-widest px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 flex items-center animate-pulse"><span class="mr-1">⭐</span> SPECIAL EVENT</li>
                    <li class="list-none">
                        <a class="block px-4 py-3 ${activeBg} transition-colors cursor-pointer flex items-center justify-between text-sm font-black text-yellow-700 dark:text-yellow-400" data-route-id="${r.id}">
                            <div class="flex items-center min-w-0 pr-2">
                                <span class="mr-2 flex-shrink-0">⭐</span>
                                <span class="truncate">${r.name}</span>
                            </div>
                            ${isActive ? '<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
                        </a>
                    </li>
                </div>
            `;
        }

        const savedDefault = localStorage.getItem('defaultRoute_' + (typeof currentRegion !== 'undefined' ? currentRegion : 'GP'));
        if (savedDefault && routes[savedDefault] && savedDefault !== 'special_event') {
            const r = routes[savedDefault];
            const isActive = r.id === activeRouteId;
            const activeBg = isActive ? 'bg-blue-50 dark:bg-blue-900/20 font-black text-blue-700 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold';
            const dotColor = Renderer._getDotColor(r.colorClass);
            
            // GUARDIAN Phase 3: Compressed Pinned Route into a single line
            html += `
                <div id="pinned-section" class="mb-3 rounded-xl overflow-hidden border border-blue-200 dark:border-blue-900/50 shadow-sm">
                    <li class="list-none">
                        <a class="block px-4 py-3 ${activeBg} transition-colors cursor-pointer flex items-center justify-between text-sm" data-route-id="${r.id}">
                            <div class="flex items-center min-w-0 pr-2">
                                <span class="w-3 h-3 rounded-full mr-3 flex-shrink-0 ${dotColor} ${isActive ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''}"></span>
                                <span class="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mr-2 flex-shrink-0">Pinned:</span>
                                <span class="truncate">${r.name.replace('<->', '↔')}</span>
                            </div>
                            ${isActive ? '<svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
                        </a>
                    </li>
                </div>
            `;
        }

        categoryOrder.forEach(cat => {
            if (groups[cat]) {
                // GUARDIAN Phase 3: Stripped background/shadows, centered text, making them pure clean dividers
                html += `<li class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center pb-2 pt-4 list-none select-none">${cat}</li>`;
                
                // Made the container fully rounded since the header no longer serves as a visual flat cap
                html += `<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">`;
                
                groups[cat].forEach(r => {
                    const isActive = r.id === activeRouteId;
                    const activeBg = isActive ? 'bg-blue-50 dark:bg-blue-900/20 font-black text-blue-700 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200 font-medium';
                    const dotColor = Renderer._getDotColor(r.colorClass);
                    const displayName = r.name.replace('<->', '↔');
                    
                    if (!r.isActive) {
                        html += `
                            <li class="list-none opacity-60 bg-gray-50 dark:bg-gray-800/30">
                                <a class="block px-4 py-3 cursor-not-allowed flex items-center justify-between text-sm text-gray-500 dark:text-gray-400" data-route-id="${r.id}">
                                    <div class="flex items-center min-w-0 pr-2">
                                        <span class="w-2.5 h-2.5 rounded-full mr-3 flex-shrink-0 bg-gray-300 dark:bg-gray-600"></span>
                                        <span class="truncate">${displayName}</span>
                                    </div>
                                    <span class="ml-2 text-[8px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded uppercase font-black tracking-widest flex-shrink-0">Soon</span>
                                </a>
                            </li>
                        `;
                    } else {
                        html += `
                            <li class="list-none">
                                <a class="block px-4 py-3 ${activeBg} transition-colors cursor-pointer flex items-center justify-between text-sm group" data-route-id="${r.id}">
                                    <div class="flex items-center min-w-0 pr-2">
                                        <span class="w-3 h-3 rounded-full mr-3 flex-shrink-0 ${dotColor} ${isActive ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''}"></span>
                                        <span class="truncate">${displayName}</span>
                                    </div>
                                    ${isActive ? '<svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
                                </a>
                            </li>
                        `;
                    }
                });
                html += `</div>`;
            }
        });

        container.innerHTML = html;
    },

    renderWelcomeList: (containerId, routes, onSelectCallback) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = "";
        
        Object.values(routes).forEach(route => {
            if (route.id === 'special_event') return;

            const btn = document.createElement('button');
            const displayName = route.name.replace('<->', '↔');
            
            if (route.isActive) {
                let borderColor = 'border-gray-500';
                if (route.colorClass.includes('orange')) borderColor = 'border-orange-500';
                else if (route.colorClass.includes('purple')) borderColor = 'border-purple-500';
                else if (route.colorClass.includes('green')) borderColor = 'border-green-500';
                else if (route.colorClass.includes('blue')) borderColor = 'border-blue-500';
                else if (route.colorClass.includes('red')) borderColor = 'border-red-500';
                else if (route.colorClass.includes('yellow')) borderColor = 'border-yellow-500';
                else if (route.colorClass.includes('indigo')) borderColor = 'border-indigo-500';

                btn.className = `w-full text-left p-4 rounded-xl shadow-md flex items-center justify-between group transition-all transform hover:scale-[1.02] active:scale-95 bg-white dark:bg-gray-800 border-l-4 ${borderColor}`;
                
                btn.innerHTML = `
                    <div class="min-w-0 pr-2">
                        <span class="block text-sm font-bold text-gray-900 dark:text-white truncate">${displayName}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">View schedules</span>
                    </div>
                    <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                `;

                if (typeof onSelectCallback === 'function') {
                    btn.onclick = () => onSelectCallback(route.id);
                }
            } else {
                btn.className = `w-full text-left p-4 rounded-xl shadow-md flex items-center justify-between bg-gray-50 dark:bg-gray-800/40 border-l-4 border-gray-300 dark:border-gray-700 opacity-80 cursor-not-allowed transition-all`;
                
                btn.innerHTML = `
                    <div class="min-w-0 pr-2">
                        <span class="block text-sm font-bold text-gray-500 dark:text-gray-400 truncate">${displayName}</span>
                        <span class="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest mt-0.5 inline-block">🚧 Coming Soon</span>
                    </div>
                    <svg class="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                `;

                btn.onclick = () => {
                    if (typeof showToast === 'function') {
                        showToast(`The ${displayName} schedule is launching soon!`, 'info', 2500);
                    }
                };
            }

            container.appendChild(btn);
        });
    },

    // --- 2. JOURNEY CARDS & STATUS ---

    renderSkeletonLoader: (element) => {
        element.innerHTML = `
            <div class="flex flex-row items-center w-full space-x-3 h-24 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
                <div class="relative w-1/2 h-full bg-gray-300 dark:bg-gray-700 rounded-lg shadow-sm flex-shrink-0"></div>
                <div class="w-1/2 flex flex-col justify-center items-center space-y-2">
                    <div class="h-3 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                    <div class="h-2 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                    <div class="h-5 bg-gray-300 dark:bg-gray-700 rounded w-full mt-1"></div>
                </div>
            </div>
        `;
    },

    renderPlaceholder: (element1, element2) => {
        const triggerShake = "document.getElementById('station-select').classList.add('animate-shake', 'ring-4', 'ring-blue-300'); setTimeout(() => document.getElementById('station-select').classList.remove('animate-shake', 'ring-4', 'ring-blue-300'), 500); document.getElementById('station-select').focus();";
        
        const placeholderHTML = `
            <div onclick="${triggerShake}" class="h-24 flex flex-col justify-center items-center text-gray-400 dark:text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group w-full">
                <svg class="w-6 h-6 mb-1 opacity-50 group-hover:scale-110 transition-transform text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <span class="text-xs font-bold group-hover:text-blue-500 transition-colors">Tap to select station</span>
            </div>`;
            
        if (element1) element1.innerHTML = placeholderHTML;
        if (element2) element2.innerHTML = placeholderHTML;
    },

    renderRouteError: (element, error) => {
        const html = `<div class="text-center p-3 bg-red-100 dark:bg-red-900 rounded-md border border-red-400 dark:border-red-700"><div class="text-xl mb-1">⚠️</div><p class="text-red-800 dark:text-red-200 text-sm font-medium">Connection failed. Please check internet.</p></div>`;
        if (element) element.innerHTML = html;
    },

    renderComingSoon: (element, routeName) => {
        const msg = `
            <div class="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-center w-full">
                <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <span class="text-3xl">🚧</span>
                </div>
                <h3 class="text-xl font-black text-gray-900 dark:text-white mb-2">Route Under Construction</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    We are currently building the digital timetable for the <strong class="text-blue-600 dark:text-blue-400">${routeName.replace('<->', '↔')}</strong> corridor.
                </p>
                
                <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 w-full text-left">
                    <p class="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1 uppercase tracking-wider">Do you commute on this line?</p>
                    <p class="text-xs text-gray-700 dark:text-gray-300 mb-4">
                        If you have recent photos of the official station timetables, you can help us launch this route faster!
                    </p>
                    <a href="https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform" target="_blank" class="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow transition-colors text-sm group">
                        <svg class="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0L8 8m4-4v12"></path></svg>
                        Share Schedules
                    </a>
                </div>
            </div>
        `;
        if (element) {
            const pHeader = document.getElementById('pretoria-header');
            const pienHeader = document.getElementById('pienaarspoort-header');
            
            if (pHeader) pHeader.parentElement.style.display = 'none';
            if (pienHeader) pienHeader.parentElement.style.display = 'none';
            
            const parent = element.closest('.space-y-6') || element.closest('.space-y-4');
            if (parent) {
                parent.innerHTML = msg;
            } else {
                element.innerHTML = msg;
            }
        }
    },

    renderAtDestination: (element) => {
        if (element) element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-green-500 dark:text-green-400">You are at this station</div>`;
    },

    // GUARDIAN BUGFIX 4: Dynamically consumes nextDayInfo to build UI buttons
    renderNoService: (element, destination, firstNextTrain, dayOffset, openModalCallback) => {
        let timeHTML = 'N/A';
        
        // Fetch the dynamic day info using the offset passed from ui.js
        const nextDayInfo = typeof window.getLookaheadDayInfo === 'function' 
            ? window.getLookaheadDayInfo(dayOffset || 1) 
            : { name: 'Monday', type: 'weekday' };

        if (firstNextTrain) {
            const rawTime = firstNextTrain.departureTime || firstNextTrain.train1.departureTime;
            const departureTime = formatTimeDisplay(rawTime);
            let timeDiffStr = (typeof calculateTimeDiffString === 'function') 
                ? calculateTimeDiffString(rawTime, dayOffset) 
                : ""; 
            
            if (timeDiffStr) timeDiffStr = timeDiffStr.replace(/(\d+)h\s(\d+)m/, '$1 hr $2 min').replace(/(\d+)m\)/, '$1 min)');
            
            timeHTML = `<div class="text-xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>`;
        } else {
            timeHTML = `<div class="text-lg font-bold text-gray-500">No Data</div>`;
        }
        
        const safeDestForClick = escapeHTML(destination).replace(/'/g, "\\'");
        const buttonHTML = `<button onclick="openScheduleModal('${safeDestForClick}', '${nextDayInfo.type}')" class="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">Check ${nextDayInfo.name} Schedule</button>`;

        let dayText = nextDayInfo.name;
        if (dayText !== "Tomorrow") dayText = `on ${dayText}`;

        element.innerHTML = `
            <div class="flex flex-col justify-center items-center w-full py-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in-up">
                <div class="text-sm font-bold text-gray-600 dark:text-gray-400">No service today</div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">First train ${dayText} is at:</p>
                <div class="text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md transition-all mt-1 w-3/4 shadow-sm border border-gray-100 dark:border-gray-800">
                    ${timeHTML}
                </div>
                ${buttonHTML}
            </div>
        `;
    },

    // GUARDIAN BUGFIX 4: Dynamically consumes nextDayInfo to build UI buttons
    renderNextAvailableTrain: (element, destination, firstTrain, dayName, dayType, dayOffset) => {
        const rawTime = firstTrain.departureTime || firstTrain.train1.departureTime;
        const departureTime = formatTimeDisplay(rawTime);
        let timeDiffStr = (typeof calculateTimeDiffString === 'function') 
            ? calculateTimeDiffString(rawTime, dayOffset) 
            : "";
        
        if (timeDiffStr) timeDiffStr = timeDiffStr.replace(/(\d+)h\s(\d+)m/, '$1 hr $2 min').replace(/(\d+)m\)/, '$1 min)');
        
        const safeDest = escapeHTML(destination);
        const safeDestForClick = safeDest.replace(/'/g, "\\'"); 

        let dayText = dayName;
        if (dayText !== "Tomorrow") dayText = `on ${dayText}`;

        element.innerHTML = `
            <div class="flex flex-col justify-center items-center w-full py-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in-up">
                <div class="text-sm font-bold text-gray-600 dark:text-gray-400">No more trains today</div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">First train ${dayText} is at:</p>
                <div class="text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md transition-all mt-1 w-3/4 shadow-sm border border-gray-100 dark:border-gray-800">
                    <div class="text-xl font-bold text-gray-900 dark:text-white">${departureTime}</div>
                    <div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>
                </div>
                <button onclick="openScheduleModal('${safeDestForClick}', '${dayType}')" class="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">See ${dayName} Schedule</button>
            </div>
        `;
    },

    renderJourney: (element, journey, destination) => {
        element.innerHTML = "";
        
        let timeClass = "bg-gray-200 dark:bg-gray-900";
        if (journey.isLastTrain) {
            timeClass = "bg-red-100 dark:bg-red-900 border-2 border-red-500";
        } else if (journey.isFirstTrain) {
            timeClass = "bg-green-100 dark:bg-green-900 border-2 border-green-500";
        }
        
        const rawTime = journey.departureTime || journey.train1.departureTime;
        const safeDepTime = escapeHTML(formatTimeDisplay(rawTime));
        const safeTrainName = escapeHTML(journey.train || journey.train1.train);
        const safeDest = escapeHTML(destination);
        let timeDiffStr = (typeof calculateTimeDiffString === 'function') 
            ? calculateTimeDiffString(rawTime) 
            : "";
            
        if (timeDiffStr) timeDiffStr = timeDiffStr.replace(/(\d+)h\s(\d+)m/, '$1 hr $2 min').replace(/(\d+)m\)/, '$1 min)');
        
        const safeDestForClick = safeDest.replace(/'/g, "\\'"); 
        const buttonHtml = `<button onclick="openScheduleModal('${safeDestForClick}')" class="absolute bottom-0 left-0 w-full text-[9px] uppercase tracking-wide font-bold py-1 bg-black bg-opacity-10 hover:bg-opacity-20 dark:bg-white dark:bg-opacity-10 dark:hover:bg-opacity-20 rounded-b-lg transition-colors truncate">See Upcoming Trains</button>`;

        let sharedTag = "";
        if (journey.isShared && journey.sourceRoute) {
             const routeName = journey.sourceRoute
                .replace(/^(Pretoria|JHB|Germiston|Mabopane)\s+<->\s+/i, "") 
                .replace("Route", "")
                .trim();

             if (journey.isDivergent) {
                 const divDest = Renderer._applyUIIntercepts(journey.actualDestName);
                 sharedTag = `<span class="block text-[9px] uppercase font-bold text-red-600 dark:text-red-400 mt-0.5 bg-red-100 dark:bg-red-900 px-1 rounded w-fit mx-auto border border-red-200 dark:border-red-700">⚠️ To ${divDest}</span>`;
             } else {
                 sharedTag = `<span class="block text-[9px] uppercase font-bold text-purple-600 dark:text-purple-400 mt-0.5 bg-purple-100 dark:bg-purple-900 px-1 rounded w-fit mx-auto">From ${routeName.replace('<->', '↔')}</span>`;
             }
        }

        if (journey.type === 'direct') {
            const actualDest = journey.actualDestination ? Renderer._applyUIIntercepts(normalizeStationName(journey.actualDestination)) : '';
            const normDest = Renderer._applyUIIntercepts(normalizeStationName(destination));
            
            let trainTitle = `Direct Train ${safeTrainName}`;
            let titleColor = "text-gray-900 dark:text-white";
            
            if (journey.isLastTrain) {
                trainTitle = `Direct Train ${safeTrainName}`;
                titleColor = "text-red-600 dark:text-red-400";
            }

            let detailLine = journey.arrivalTime ? `Arrives ${escapeHTML(formatTimeDisplay(journey.arrivalTime))}` : "Arrival time n/a.";
            let detailColor = "text-gray-700 dark:text-gray-300";

            if (actualDest && normDest && actualDest !== normDest) {
                detailLine = `Terminates at ${actualDest}`;
                detailColor = "text-orange-700 dark:text-orange-400 font-bold";
            }

            element.innerHTML = `
                <div class="flex flex-row items-center w-full space-x-3">
                    <!-- TIME BOX -->
                    <div class="relative w-1/2 h-24 flex flex-col justify-center items-center text-center p-1 pb-5 ${timeClass} rounded-lg shadow-sm flex-shrink-0">
                        <div class="text-2xl font-black text-gray-900 dark:text-white leading-tight">${safeDepTime}</div>
                        <div class="text-xs text-gray-700 dark:text-gray-300 font-bold">${timeDiffStr}</div>
                        ${sharedTag}
                        ${buttonHtml}
                    </div>
                    
                    <!-- DESCRIPTION BOX -->
                    <div class="w-1/2 h-24 flex flex-col justify-center items-center text-center p-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden">
                        <div class="text-[11px] font-bold ${titleColor} leading-tight mb-1 uppercase tracking-wide truncate w-full px-1 min-w-0" title="${trainTitle}">
                            ${trainTitle}
                        </div>
                        <div class="text-[10px] ${detailColor} font-medium leading-tight truncate w-full px-1 min-w-0" title="${detailLine}">
                            ${detailLine}
                        </div>
                    </div>
                </div>
            `;
        } else if (journey.type === 'transfer') {
            const conn = journey.connection; 
            const nextFull = journey.nextFullJourney; 
            
            const rawDest = journey.train1.headboardDestination || journey.train1.terminationStation;
            const displayDest = Renderer._applyUIIntercepts(escapeHTML(rawDest));
            const arrivalAtTransfer = escapeHTML(formatTimeDisplay(journey.train1.arrivalAtTransfer));
            
            const connTrain = escapeHTML(conn.train);
            const connDest = Renderer._applyUIIntercepts(escapeHTML(conn.actualDestination));
            const connDep = escapeHTML(formatTimeDisplay(conn.departureTime));
            const finalDestTitle = Renderer._applyUIIntercepts(escapeHTML(destination));

            let train1Label = `Train ${safeTrainName}`;
            let titleColor = "text-gray-900 dark:text-white";
            if (journey.isLastTrain) titleColor = "text-red-600 dark:text-red-400";
            
            let bottomBlock = "";
            
            if (nextFull) {
                const nextTrain = escapeHTML(nextFull.train);
                const nextDep = escapeHTML(formatTimeDisplay(nextFull.departureTime));
                
                bottomBlock = `
                    <div class="text-[9px] leading-tight w-full space-y-1 min-w-0">
                        <div class="mb-1">
                             <div class="text-[11px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-0.5 truncate w-full">Connect Train ${connTrain}</div>
                             <div class="text-[9px] text-gray-600 dark:text-gray-400 font-bold truncate w-full">To ${connDest} <span class="font-normal opacity-80">(From ${connDep})</span></div>
                        </div>
                        <div class="italic text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-1 mt-1 truncate w-full" title="${finalDestTitle}: Train ${nextTrain} from ${nextDep}">
                            ${finalDestTitle}: Train ${nextTrain} from ${nextDep}
                        </div>
                    </div>
                `;
            } else {
                bottomBlock = `
                    <div class="text-[10px] leading-tight w-full min-w-0">
                        <div class="text-[11px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-0.5 truncate w-full">Connect Train ${connTrain}</div>
                        <div class="text-[9px] text-gray-600 dark:text-gray-400 font-bold truncate w-full">To ${connDest} <span class="font-normal opacity-80">(From ${connDep})</span></div>
                    </div>
                `;
            }
            
            element.innerHTML = `
                <div class="flex flex-row items-center w-full space-x-3">
                    <!-- TIME BOX -->
                    <div class="relative w-1/2 h-auto min-h-[110px] flex flex-col justify-center items-center text-center p-1 pb-5 ${timeClass} rounded-lg shadow-sm flex-shrink-0 self-stretch">
                        <div class="text-2xl font-black text-gray-900 dark:text-white leading-tight">${safeDepTime}</div>
                        <div class="text-xs text-gray-700 dark:text-gray-300 font-bold">${timeDiffStr}</div>
                        ${sharedTag}
                        ${buttonHtml}
                    </div>
                    
                    <!-- DESCRIPTION BOX -->
                    <div class="w-1/2 flex flex-col justify-center items-center text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg h-full min-h-[110px] overflow-hidden">
                        <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 w-full min-w-0">
                            <div class="text-[11px] font-black ${titleColor} uppercase tracking-wide mb-0.5 truncate w-full px-1" title="Shuttle ${train1Label}">Shuttle ${train1Label}</div>
                            <div class="text-[9px] text-gray-600 dark:text-gray-400 font-bold truncate w-full px-1" title="To ${displayDest} (Arr ${arrivalAtTransfer})">To ${displayDest} <span class="font-normal opacity-80">(Arr ${arrivalAtTransfer})</span></div>
                        </div>
                        ${bottomBlock}
                    </div>
                </div>
            `;
        }
    },

    // --- 3. INTERNAL HELPERS ---
    
    _toTitleCase: (str) => {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    },
    
    // GUARDIAN V6.05 FIX: Completely rebuilt to return strict Tailwind utilities instead of brittle CSS classes
    _getDotColor: (colorClass) => {
        if (!colorClass) return 'bg-gray-400';
        if (colorClass.includes('green')) return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
        if (colorClass.includes('orange')) return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]';
        if (colorClass.includes('purple')) return 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]';
        if (colorClass.includes('indigo')) return 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'; 
        if (colorClass.includes('blue')) return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
        if (colorClass.includes('yellow')) return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]';
        if (colorClass.includes('red')) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
        return 'bg-gray-400';
    },

    _applyUIIntercepts: (stationName) => {
        if (!stationName) return '';
        let name = stationName.replace(/ STATION/gi, '');
        if (name.toUpperCase() === 'ELANDSFONTEIN' || name.toUpperCase() === 'RHODESFIELD') {
            return 'Kempton Park';
        }
        return Renderer._toTitleCase(name);
    },

    // --- 4. CHANGELOG MODAL ---
    renderChangelogModal: (changelogData) => {
        if (document.getElementById('sidenav')) {
            const sidenav = document.getElementById('sidenav');
            const overlay = document.getElementById('sidenav-overlay');
            if (sidenav.classList.contains('open')) {
                sidenav.classList.remove('open');
                overlay.classList.remove('open');
                document.body.classList.remove('sidenav-open');
            }
        }

        history.pushState({ modal: 'changelog' }, '', '#changelog');
        let modal = document.getElementById('changelog-modal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'changelog-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-[140] hidden flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300';
            modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-0 overflow-hidden transform transition-all scale-95 flex flex-col max-h-[85vh]">
                    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                        <h3 class="font-bold text-lg text-gray-900 dark:text-white flex items-center">
                            <span class="mr-2">🚅</span> What's New
                        </h3>
                        <button onclick="history.back()" class="text-gray-500 hover:text-gray-900 dark:hover:text-white p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="p-6 overflow-y-auto flex-grow space-y-6" id="changelog-list">
                        <!-- Items Injected Here -->
                    </div>
                    <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center">
                        <button onclick="history.back()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors">Got it!</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const listContainer = document.getElementById('changelog-list');
        listContainer.innerHTML = '';

        if (!changelogData || changelogData.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-gray-500 italic">No updates found.</p>';
        } else {
            changelogData.forEach((entry, index) => {
                const isLatest = index === 0;
                listContainer.innerHTML += `
                    <div class="relative pl-4 border-l-2 ${isLatest ? 'border-blue-500' : 'border-gray-300 dark:border-gray-700'}">
                        ${isLatest ? '<span class="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900"></span>' : '<span class="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-700"></span>'}
                        <div class="mb-1 flex items-baseline justify-between">
                            <h4 class="font-bold text-gray-900 dark:text-white ${isLatest ? 'text-lg' : 'text-sm'}">${entry.version}</h4>
                            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">${entry.date}</span>
                        </div>
                        <ul class="space-y-2">
                            ${entry.features.map(f => `<li class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">${f}</li>`).join('')}
                        </ul>
                    </div>
                `;
            });
        }

        modal.classList.remove('hidden');
    },

    // --- 5. GRID GENERATION HELPER ---
    _buildGridHTML: (schedule, sheetName, routeId, dayIdx, highlightNextTrain = true, isExport = false) => {
        const trainCols = schedule.headers.slice(1).filter(header => /^\d{4}[a-zA-Z]*$/.test(header.trim()));
        let sortedCols = [];

        if (typeof MANUAL_GRID_ORDER !== 'undefined' && MANUAL_GRID_ORDER[sheetName]) {
            const manualOrder = MANUAL_GRID_ORDER[sheetName];
            manualOrder.forEach(tNum => { if (trainCols.includes(tNum)) sortedCols.push(tNum); });
            const manualSet = new Set(manualOrder);
            const remainingCols = trainCols.filter(t => !manualSet.has(t));
            remainingCols.sort((a, b) => a.localeCompare(b));
            sortedCols = [...sortedCols, ...remainingCols];
        } else {
            const isValidTime = (val) => val && val !== '-' && /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(String(val).trim());
            const colStats = trainCols.map(colId => {
                let earliestTime = 86400 * 2;
                let hasData = false;
                for (const row of schedule.rows) {
                    const val = row[colId];
                    if (isValidTime(val)) {
                        const t = timeToSeconds(val);
                        if (t > 0) {
                            if (t < earliestTime) earliestTime = t;
                            hasData = true;
                        }
                    }
                }
                return { id: colId, time: earliestTime, hasData };
            });
            colStats.sort((a, b) => {
                if (!a.hasData && !b.hasData) return a.id.localeCompare(b.id);
                if (!a.hasData) return 1;
                if (!b.hasData) return -1;
                return a.time - b.time;
            });
            sortedCols = colStats.map(c => c.id);
        }

        let activeColIndex = -1;
        
        if (highlightNextTrain && !isExport && typeof currentTime !== 'undefined') {
             const nowSec = timeToSeconds(currentTime);
             for (let i = 0; i < sortedCols.length; i++) {
                 let firstTimeSec = 0;
                 for (const row of schedule.rows) {
                     const val = row[sortedCols[i]];
                     if (val && val !== "-" && /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(String(val).trim())) {
                         firstTimeSec = timeToSeconds(val);
                         break;
                     }
                 }
                 if (firstTimeSec >= nowSec) { activeColIndex = i; break; }
             }
        }

        let selectedStation = "";
        if (!isExport && typeof document !== 'undefined') {
            const selectEl = document.getElementById('station-select');
            if (selectEl && selectEl.value) {
                selectedStation = selectEl.value;
            }
        }

        // GUARDIAN PHASE 15 & 16: Right-Side Anchor Dictionary & Ultra-Compact Matrix Mode (EXPORT ONLY)
        const showRightAnchor = isExport && sortedCols.length >= 20;
        const getAbbrev = (name) => {
            const map = {
                "PRETORIA": "PTA",
                "JOHANNESBURG": "JHB",
                "GERMISTON": "GERM",
                "MABOPANE": "MABO",
                "SAULSVILLE": "SAUL",
                "BELLE OMBRE": "BELL",
                "PIENAARSPOORT": "PIEN",
                "KEMPTON PARK": "KEMP",
                "CAPE TOWN": "CPT",
                "BELLVILLE": "BELL",
                "KOEDOESPOORT": "KOED",
                "ATTERIDGEVILLE": "ATTR",
                "LERALLA": "LERA",
                "KWESINE": "KWES",
                "RANDFONTEIN": "RAND",
                "NALEDI": "NALD"
            };
            const upper = name.trim().toUpperCase();
            return map[upper] || upper.substring(0, 4);
        };

        // GUARDIAN: Tall Grid Mode - Compress vertical padding for mobile view if many stations
        const isTallGrid = !isExport && schedule.rows.length > 15;
        const paddingClass = isExport ? 'p-2' : (isTallGrid ? 'py-2 px-3' : 'p-3'); 
        const fontSizeClass = isExport ? 'text-sm' : 'text-xs'; 
        const minWidthClass = showRightAnchor ? 'min-w-[46px]' : 'min-w-[70px]';
        
        let tableClass = isExport ? (showRightAnchor ? 'export-compact' : '') : 'bg-white dark:bg-gray-900';
        let theadClass = isExport ? '' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200'; 
        let stickyHeaderClass = isExport ? '' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'; 
        let borderClass = isExport ? 'border-gray-300' : 'border-gray-300 dark:border-gray-700';
        let tbodyClass = isExport ? '' : 'bg-white dark:bg-gray-900';
        let stickyCellClass = isExport ? '' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white';

        let html = `
            <table class="w-full ${fontSizeClass} text-left border-collapse ${tableClass}">
                <thead class="text-[10px] uppercase ${theadClass} sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th class="sticky left-0 z-30 ${stickyHeaderClass} ${paddingClass} border-b border-r font-bold min-w-[140px] shadow-lg text-left pl-3">Station</th>
                        ${sortedCols.map((h, i) => {
                            const isHighlight = i === activeColIndex;
                            const exclusionType = (typeof isTrainExcluded === 'function') ? isTrainExcluded(h, routeId, dayIdx) : false;
                            
                            let bgClass = '';
                            let headerContent = h;
                            
                            if (!isExport) {
                                if (exclusionType === 'special') {
                                    bgClass = 'bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300 opacity-95';
                                    headerContent = `<span class="block text-[8px] text-green-600 dark:text-green-400 font-black mb-0.5 tracking-tight">⭐ SPL</span>${h}`;
                                } else if (exclusionType) {
                                    bgClass = 'bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 opacity-90';
                                    headerContent = `<span class="block text-[8px] text-red-600 dark:text-red-400 font-black mb-0.5 tracking-tight">🚫 NO SVC</span>${h}`;
                                } else if (isHighlight) {
                                    bgClass = 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 font-bold';
                                }
                            }

                            return `<th class="${paddingClass} border-b border-r ${borderClass} whitespace-nowrap text-center ${bgClass} ${minWidthClass}" ${isHighlight ? 'id="grid-active-col"' : ''}>${headerContent}</th>`;
                        }).join('')}
                        ${showRightAnchor ? `<th class="right-anchor-header sticky right-0 z-30 ${stickyHeaderClass} ${paddingClass} border-b border-l ${borderClass} font-bold min-w-[50px] shadow-[-4px_0_10px_rgba(0,0,0,0.05)] text-center bg-gray-100 dark:bg-gray-800">STN</th>` : ''}
                    </tr>
                </thead>
                <tbody class="divide-y ${borderClass} ${tbodyClass}">
        `;

        let validRowIndex = 0;
        schedule.rows.forEach(row => {
            if (!row.STATION || row.STATION.toLowerCase().includes('updated')) return; 
            const cleanStation = row.STATION.replace(' STATION', '');
            let hasData = false;
            sortedCols.forEach(col => { if (row[col] && row[col] !== "-" && row[col] !== "") hasData = true; });
            if (!hasData) return;

            const isSelectedRow = (!isExport && row.STATION === selectedStation);
            const isZebra = (validRowIndex % 2 === 1);
            let currentStickyCellClass = stickyCellClass;
            
            // GUARDIAN FIX: Removed opacity from sticky cells to prevent "Ghost Numbers" bleeding through
            if (isSelectedRow) {
                currentStickyCellClass = isExport ? '' : 'bg-blue-50 dark:bg-blue-900 border-gray-300 dark:border-gray-700 text-blue-900 dark:text-blue-100';
            } else if (isZebra && !isExport) {
                currentStickyCellClass = 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white';
            }

            let rowClass = isSelectedRow ? 'bg-blue-50 dark:bg-blue-900/20' : (isZebra && !isExport ? 'bg-gray-50 dark:bg-gray-800/40' : '');
            if (isZebra && isExport) rowClass += ' export-zebra';

            html += `
                <tr class="${rowClass.trim()}">
                    <td class="sticky left-0 z-10 ${currentStickyCellClass} ${paddingClass} border-r font-bold truncate max-w-[140px] shadow-lg border-b text-left pl-3">${cleanStation}</td>
                    ${sortedCols.map((col, i) => {
                        let val = row[col] || "-";
                        if (val !== "-") {
                            const isValidTime = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(String(val).trim());
                            if (isValidTime) {
                                val = formatTimeDisplay(val); 
                            } else {
                                val = "-";
                            }
                        }
                        
                        if (isExport && val === "-") val = "";

                        const isHighlight = i === activeColIndex;
                        const exclusionType = (typeof isTrainExcluded === 'function') ? isTrainExcluded(col, routeId, dayIdx) : false;

                        let cellClass = `${paddingClass} text-center border-r ${borderClass} border-b`;
                        
                        if (val !== "" && val !== "-") {
                            cellClass += " font-mono font-medium";
                            if (!isExport) {
                                if (exclusionType === 'special') {
                                    cellClass += " text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 opacity-95 font-bold";
                                } else if (exclusionType) {
                                    cellClass += " text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 opacity-80 font-normal decoration-slice";
                                } else {
                                    cellClass += " text-gray-900 dark:text-gray-200";
                                    if (isHighlight) cellClass += " bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-800 dark:text-blue-300";
                                }
                            }
                        } else { 
                            if (!isExport) {
                                cellClass += " text-gray-300 dark:text-gray-700"; 
                                if (exclusionType === 'special') {
                                    cellClass += " bg-green-50 dark:bg-green-900/10";
                                } else if (exclusionType) {
                                    cellClass += " bg-red-50 dark:bg-red-900/10";
                                }
                            }
                        }
                        return `<td class="${cellClass}">${val}</td>`;
                    }).join('')}
                    ${showRightAnchor ? `<td class="right-anchor-col sticky right-0 z-10 ${currentStickyCellClass || (isExport ? '' : 'bg-gray-50 dark:bg-gray-800/80')} ${paddingClass} border-l ${borderClass} border-b font-mono font-bold text-center shadow-[-4px_0_10px_rgba(0,0,0,0.05)] text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs">${getAbbrev(cleanStation)}</td>` : ''}
                </tr>
            `;
            validRowIndex++;
        });

        html += `</tbody></table>`;
        return html;
    }
};

window.takeGridSnapshot = async function(direction = 'A', dayType = 'weekday') {
    if (typeof triggerHaptic === 'function') triggerHaptic(); // GUARDIAN: Targeted Haptic

    if (typeof html2canvas === 'undefined') {
        showToast("Loading snapshot engine...", "info", 1500);
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch(e) {
            showToast("Failed to load snapshot engine.", "error");
            return;
        }
    }

    showToast("📄 Generating Commuter Notice...", "info", 4000);

    const route = ROUTES[currentRouteId];
    if (!route) return;

    const selectedDay = dayType || 'weekday';
    let sheetDayType = selectedDay;
    if (selectedDay === 'sunday') sheetDayType = 'weekday'; 

    const keyA = `${sheetDayType}_to_a`;
    const keyB = `${sheetDayType}_to_b`;
    const schedA = schedules[keyA];
    const schedB = schedules[keyB];

    const bgColor = '#ffffff'; 
    const textColor = '#111827'; 
    const borderColor = '#cbd5e1'; // GUARDIAN: Darkened gridlines (Slate-300)
    const accentColor = '#2563eb';
    const mutedColor = '#6b7280';
    const tableHeaderBg = '#f1f5f9'; // GUARDIAN: Solid Slate-100 header
    const headerTextColor = '#1e293b'; // GUARDIAN: Darker text for headers
    const zebraBg = '#f8fafc'; // GUARDIAN: Slate-50 for Zebra Striping

    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '-9999px';
    exportContainer.style.top = '0';
    exportContainer.style.width = 'auto'; 
    exportContainer.style.minWidth = '800px'; 
    exportContainer.style.padding = '20px';
    exportContainer.style.fontFamily = 'system-ui, sans-serif';
    exportContainer.style.backgroundColor = bgColor;
    exportContainer.style.color = textColor;
    
    exportContainer.classList.remove('dark');

    const destAName = route.destA.replace(' STATION', '');
    const destBName = route.destB.replace(' STATION', '');
    const dateText = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    const scheduleTypeLabel = selectedDay === 'weekday' ? 'WEEKDAY' : 'WEEKEND';
    
    const displayRouteName = route.name.replace('<->', '↔');
    
    let effectiveDateText = "";
    if (schedA && schedA.lastUpdated) {
        effectiveDateText = schedA.lastUpdated.replace(/^last updated[:\s-]*/i, '').trim();
    }

    let dummyDayIdx = selectedDay === 'weekday' ? 1 : 6;
    
    const htmlA = schedA 
        ? Renderer._buildGridHTML(schedA, route.sheetKeys[keyA], currentRouteId, dummyDayIdx, false, true) 
        : `<div class="p-8 text-center italic border rounded" style="color:${mutedColor}; border-color:${borderColor}">No service scheduled for this direction.</div>`;
        
    const htmlB = schedB 
        ? Renderer._buildGridHTML(schedB, route.sheetKeys[keyB], currentRouteId, dummyDayIdx, false, true) 
        : `<div class="p-8 text-center italic border rounded" style="color:${mutedColor}; border-color:${borderColor}">No service scheduled for this direction.</div>`;

    exportContainer.innerHTML = `
        <div class="mb-6 border-b-4 pb-4" style="border-color: ${accentColor}">
            <div class="flex justify-between items-end">
                <div>
                    <h1 class="text-4xl font-black uppercase tracking-tight mb-1" style="color: ${accentColor}">Commuter Notice</h1>
                    <h2 class="text-xl font-bold uppercase tracking-widest" style="color: ${mutedColor}">${displayRouteName} Corridor</h2>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold" style="color: ${textColor}">${scheduleTypeLabel} TIMETABLE</div>
                    ${effectiveDateText ? `<div class="text-sm font-bold uppercase mt-1" style="color: ${mutedColor}">EFFECTIVE FROM: ${effectiveDateText}</div>` : ''}
                </div>
            </div>
        </div>

        <div class="mb-8">
            <div class="p-2 mb-0 border-l-4" style="background-color: ${tableHeaderBg}; border-color: ${accentColor}">
                <h3 class="font-bold text-lg uppercase" style="color: ${textColor}"> ${destBName} ➔ ${destAName}</h3>
            </div>
            <div class="schedule-table-wrapper">
                ${htmlA}
            </div>
        </div>

        <div class="flex items-center justify-center my-8 opacity-50">
            <div class="h-px w-full" style="background-color: ${borderColor}"></div>
            <span class="px-4 text-xs font-bold uppercase" style="color: ${mutedColor}">Return Service</span>
            <div class="h-px w-full" style="background-color: ${borderColor}"></div>
        </div>

        <div class="mb-8">
            <div class="p-2 mb-0 border-l-4" style="background-color: ${tableHeaderBg}; border-color: ${accentColor}">
                <h3 class="font-bold text-lg uppercase" style="color: ${textColor}"> ${destAName} ➔ ${destBName}</h3>
            </div>
            <div class="schedule-table-wrapper">
                ${htmlB}
            </div>
        </div>

        <div class="mt-8 p-5 rounded-lg flex justify-between items-center" style="background-color: ${tableHeaderBg}; border: 1px solid ${borderColor}">
            <div class="flex flex-col space-y-1.5">
                <span class="text-xs font-mono font-bold" style="color: #4b5563">GENERATED: ${dateText}</span>
                <span class="font-black text-sm" style="color: #374151">Data Source: PRASA / Metrorail Facebook</span>
                <span class="text-xs font-bold uppercase tracking-wider" style="color: #6b7280">Unofficial Guide • Not affiliated with PRASA</span>
            </div>
            <span class="font-black text-2xl tracking-tight" style="color: ${accentColor}">NextTrain.co.za</span>
        </div>
    `;

    const tables = exportContainer.querySelectorAll('table');
    tables.forEach(t => {
        t.style.width = '100%';
        t.style.borderCollapse = 'collapse';
        
        // GUARDIAN PHASE 16: Ultra-Compact Matrix Trigger
        const isCompact = t.classList.contains('export-compact');
        
        t.querySelectorAll('th').forEach(th => {
            th.style.backgroundColor = tableHeaderBg;
            th.style.color = headerTextColor;
            th.style.border = `1px solid ${borderColor}`;
            th.className = th.className; // Maintain logic classes like 'right-anchor-header'
            th.style.padding = isCompact ? '8px 3px' : '8px 6px'; // Dynamic asymmetrical padding
            th.style.fontSize = isCompact ? '12.5px' : '13px';
            th.style.fontWeight = '900';
            th.style.textAlign = 'center';
            if (isCompact) th.style.letterSpacing = '-0.5px'; // Kerning reduction
        });
        
        t.querySelectorAll('td').forEach(td => {
            td.style.border = `1px solid ${borderColor}`;
            td.style.padding = isCompact ? '6px 2.5px' : '6px'; // Dynamic asymmetrical padding
            td.style.color = textColor;
            td.style.fontSize = isCompact ? '13.5px' : '15px'; // Dynamic typography scaling
            td.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
            td.style.textAlign = 'center'; 
            td.style.fontWeight = '600'; 
            if (isCompact) td.style.letterSpacing = '-0.5px'; // Kerning reduction
        });

        // GUARDIAN: Apply Zebra Striping safely
        t.querySelectorAll('tr.export-zebra td').forEach(td => {
            td.style.backgroundColor = zebraBg;
        });

        // GUARDIAN: Specific styling for the Right-Side Anchor column
        t.querySelectorAll('.right-anchor-header').forEach(th => {
            th.style.backgroundColor = '#e2e8f0'; // Slightly darker for distinction
            th.style.color = '#475569';
            th.style.letterSpacing = 'normal'; // Reset tracking
            th.style.padding = '8px 6px'; // Standard padding
        });
        t.querySelectorAll('.right-anchor-col').forEach(td => {
            td.style.backgroundColor = '#f1f5f9';
            td.style.color = '#64748b';
            td.style.fontWeight = '800';
            td.style.fontSize = '13px';
            td.style.letterSpacing = 'normal'; // Reset tracking
            td.style.padding = '6px 6px'; // Standard padding
        });

        t.querySelectorAll('.sticky').forEach(el => {
            el.style.position = 'static';
            el.classList.remove('sticky');
        });
        
        // Reset the overrides for the station names (1st column)
        t.querySelectorAll('th:first-child, td:first-child').forEach(cell => {
            cell.style.textAlign = 'left';
            cell.style.paddingLeft = '12px';
            cell.style.paddingRight = '12px';
            cell.style.letterSpacing = 'normal';
        });

        t.querySelectorAll('td:first-child').forEach(td => {
            td.style.fontFamily = 'system-ui, -apple-system, sans-serif';
            td.style.fontWeight = '800';
            td.style.color = '#1f2937';
        });
    });

    document.body.appendChild(exportContainer);

    try {
        await new Promise(r => setTimeout(r, 100));

        // GUARDIAN PHASE 15: Scale bumped to 2 for crisp Retina text rendering
        const canvas = await html2canvas(exportContainer, {
            scale: 2,
            backgroundColor: bgColor,
            logging: false,
            useCORS: true
        });

        canvas.toBlob(async (blob) => {
            const timestampStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 12); 
            const fileName = `Schedule_${route.name.replace(/\s|<->/g,'_').replace(/_+/g, '_')}_${selectedDay}_${timestampStr}.png`;
            const file = new File([blob], fileName, { type: "image/png" });
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.download = fileName;
            link.href = blobUrl;
            link.click();
            
            window._pendingShareFile = file;
            window._pendingShareText = `Commuter Notice: ${route.name.replace('<->', '↔')} (${selectedDay})`;
            
            const canShare = navigator.canShare && navigator.canShare({ files: [file] });
            const shareBtnHTML = canShare 
                ? `<button onclick="triggerNoticeShare()" class="bg-white text-blue-600 px-3 py-1 rounded text-xs font-bold shadow-sm hover:bg-gray-100 transition-colors ml-3 whitespace-nowrap border border-gray-200">SHARE 📤</button>` 
                : '';

            showToast("✅ Image saved to gallery!", "success", 8000, shareBtnHTML);
            
            if (typeof trackAnalyticsEvent === 'function') {
                trackAnalyticsEvent('grid_save_image', { 
                    route_id: currentRouteId,
                    day_type: selectedDay,
                    direction: direction 
                });
            }
            
            document.body.removeChild(exportContainer);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000); 
        });
    } catch (e) {
        console.error(e);
        showToast("Snapshot failed.", "error");
        if(document.body.contains(exportContainer)) document.body.removeChild(exportContainer);
    }
};

window.triggerNoticeShare = async function() {
    if (window._pendingShareFile && navigator.share) {
        try {
            await navigator.share({
                files: [window._pendingShareFile],
                text: window._pendingShareText
            });
            showToast("Shared successfully!", "success");
            
            if (typeof trackAnalyticsEvent === 'function') {
                trackAnalyticsEvent('grid_share_image', { 
                    route_id: currentRouteId 
                });
            }
        } catch(e) {
            console.log("Share cancelled or failed", e);
        }
    }
};