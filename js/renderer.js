/**
 * METRORAIL NEXT TRAIN - RENDERER ENGINE (V5.00.10 - Guardian Stability & Defaults)
 * ------------------------------------------------
 * This module handles all DOM injection and HTML string generation.
 * It separates the "View" from the "Logic" (ui.js/logic.js).
 * * PART OF PHASE 3 & 4: LOADING GUARDRAILS & SMART DEFAULTS
 * * UPDATES: Sunday->Weekday Default, Loading State Protection
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
            "JHB_SOUTH": "JHB West Line"
        };

        const categoryOrder = [
            "Northern Corridor (Pretoria)",
            "Pretoria - JHB Line",
            "JHB West Line"
        ];

        const groups = {};
        Object.values(routes).forEach(route => {
            if (!route.isActive) return;
            const cat = categoryMap[route.corridorId] || "Other Routes";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(route);
        });

        let html = '';

        const savedDefault = localStorage.getItem('defaultRoute');
        if (savedDefault && routes[savedDefault]) {
            const r = routes[savedDefault];
            const isActive = r.id === activeRouteId ? 'active' : '';
            const dotColor = Renderer._getDotColor(r.colorClass);
            
            html += `
                <div id="pinned-section" class="border-b border-gray-700 dark:border-gray-600 pb-2 mb-2">
                    <li class="route-category mt-0 pt-0 text-blue-500 dark:text-blue-400">Pinned Route</li>
                    <li class="route-item">
                        <a class="${isActive}" data-route-id="${r.id}">
                            <span class="route-dot ${dotColor}"></span>${r.name}
                        </a>
                    </li>
                </div>
            `;
        }

        categoryOrder.forEach(cat => {
            if (groups[cat]) {
                html += `<li class="route-category">${cat}</li>`;
                groups[cat].forEach(r => {
                    const isActive = r.id === activeRouteId ? 'active' : '';
                    const dotColor = Renderer._getDotColor(r.colorClass);
                    html += `
                        <li class="route-item">
                            <a class="${isActive}" data-route-id="${r.id}">
                                <span class="route-dot ${dotColor}"></span>${r.name}
                            </a>
                        </li>
                    `;
                });
            }
        });

        container.innerHTML = html;
    },

    renderWelcomeList: (containerId, routes, onSelectCallback) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = "";
        
        Object.values(routes).forEach(route => {
            if (!route.isActive) return;

            const btn = document.createElement('button');
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
                <div>
                    <span class="block text-sm font-bold text-gray-900 dark:text-white">${route.name}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">View schedules</span>
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            `;

            if (typeof onSelectCallback === 'function') {
                btn.onclick = () => onSelectCallback(route.id);
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
                <svg class="w-6 h-6 mb-1 opacity-50 group-hover:scale-110 transition-transform text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
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
        const msg = `<div class="h-24 flex flex-col justify-center items-center text-center p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg"><h3 class="text-lg font-bold text-yellow-700 dark:text-yellow-300 mb-1">🚧 Coming Soon</h3><p class="text-xs text-gray-700 dark:text-gray-300">We are working on the <strong>${routeName}</strong> schedule.</p></div>`;
        if (element) element.innerHTML = msg;
    },

    renderAtDestination: (element) => {
        if (element) element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-green-500 dark:text-green-400">You are at this station</div>`;
    },

    renderNoService: (element, destination, firstNextTrain, dayOffset, openModalCallback) => {
        let timeHTML = 'N/A';
        
        if (firstNextTrain) {
            const rawTime = firstNextTrain.departureTime || firstNextTrain.train1.departureTime;
            const departureTime = formatTimeDisplay(rawTime);
            const timeDiffStr = (typeof calculateTimeDiffString === 'function') 
                ? calculateTimeDiffString(rawTime, dayOffset) 
                : ""; 
            
            timeHTML = `<div class="text-xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>`;
        } else {
            timeHTML = `<div class="text-lg font-bold text-gray-500">No Data</div>`;
        }
        
        const safeDestForClick = escapeHTML(destination).replace(/'/g, "\\'");
        const buttonHTML = `<button onclick="openScheduleModal('${safeDestForClick}', 'weekday')" class="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">Check Monday's Schedule</button>`;

        element.innerHTML = `
            <div class="flex flex-col justify-center items-center w-full py-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-bold text-gray-600 dark:text-gray-400">No service today</div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">First train next weekday is at:</p>
                <div class="text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md transition-all mt-1 w-3/4 shadow-sm border border-gray-100 dark:border-gray-800">
                    ${timeHTML}
                </div>
                ${buttonHTML}
            </div>
        `;
    },

    renderNextAvailableTrain: (element, destination, firstTrain, dayName, dayType, dayOffset) => {
        const rawTime = firstTrain.departureTime || firstTrain.train1.departureTime;
        const departureTime = formatTimeDisplay(rawTime);
        const timeDiffStr = (typeof calculateTimeDiffString === 'function') 
            ? calculateTimeDiffString(rawTime, dayOffset) 
            : "";
        
        const safeDest = escapeHTML(destination);
        const safeDestForClick = safeDest.replace(/'/g, "\\'"); 

        element.innerHTML = `
            <div class="flex flex-col justify-center items-center w-full py-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-bold text-gray-600 dark:text-gray-400">No more trains today</div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">First train ${dayName} is at:</p>
                <div class="text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md transition-all mt-1 w-3/4 shadow-sm border border-gray-100 dark:border-gray-800">
                    <div class="text-xl font-bold text-gray-900 dark:text-white">${departureTime}</div>
                    <div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>
                </div>
                <button onclick="openScheduleModal('${safeDestForClick}', '${dayType}')" class="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">See Upcoming Trains</button>
            </div>
        `;
    },

    // Main Journey Card Renderer
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
        const timeDiffStr = (typeof calculateTimeDiffString === 'function') 
            ? calculateTimeDiffString(rawTime) 
            : "";
        
        const safeDestForClick = safeDest.replace(/'/g, "\\'"); 
        const buttonHtml = `<button onclick="openScheduleModal('${safeDestForClick}')" class="absolute bottom-0 left-0 w-full text-[9px] uppercase tracking-wide font-bold py-1 bg-black bg-opacity-10 hover:bg-opacity-20 dark:bg-white dark:bg-opacity-10 dark:hover:bg-opacity-20 rounded-b-lg transition-colors truncate">See Upcoming Trains</button>`;

        let sharedTag = "";
        if (journey.isShared && journey.sourceRoute) {
             const routeName = journey.sourceRoute
                .replace(/^(Pretoria|JHB|Germiston|Mabopane)\s+<->\s+/i, "") 
                .replace("Route", "")
                .trim();

             if (journey.isDivergent) {
                 sharedTag = `<span class="block text-[9px] uppercase font-bold text-red-600 dark:text-red-400 mt-0.5 bg-red-100 dark:bg-red-900 px-1 rounded w-fit mx-auto border border-red-200 dark:border-red-700">⚠️ To ${journey.actualDestName}</span>`;
             } else {
                 sharedTag = `<span class="block text-[9px] uppercase font-bold text-purple-600 dark:text-purple-400 mt-0.5 bg-purple-100 dark:bg-purple-900 px-1 rounded w-fit mx-auto">From ${routeName}</span>`;
             }
        }

        if (journey.type === 'direct') {
            const actualDest = journey.actualDestination ? normalizeStationName(journey.actualDestination) : '';
            const normDest = normalizeStationName(destination);
            let destinationText = journey.arrivalTime ? `Arrives ${escapeHTML(formatTimeDisplay(journey.arrivalTime))}` : "Arrival time n/a.";
            if (actualDest && normDest && actualDest !== normDest) {
                destinationText = `Terminates at ${escapeHTML(journey.actualDestination.replace(/ STATION/g,''))}.`;
            }
            
            let trainTypeText = `<span class="font-bold text-yellow-600 dark:text-yellow-400">Direct (${safeTrainName})</span>`;
            if (journey.isLastTrain) trainTypeText = `<span class="font-bold text-red-600 dark:text-red-400">Last Direct (${safeTrainName})</span>`;

            element.innerHTML = `
                <div class="flex flex-row items-center w-full space-x-3">
                    <div class="relative w-1/2 h-24 flex flex-col justify-center items-center text-center p-1 pb-5 ${timeClass} rounded-lg shadow-sm flex-shrink-0">
                        <div class="text-2xl font-bold text-gray-900 dark:text-white leading-tight">${safeDepTime}</div>
                        <div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>
                        ${sharedTag}
                        ${buttonHtml}
                    </div>
                    <div class="w-1/2 flex flex-col justify-center items-center text-center space-y-0.5">
                        <div class="text-xs text-gray-800 dark:text-gray-200 font-medium leading-tight">${trainTypeText}</div>
                        <div class="text-[10px] text-gray-500 dark:text-gray-400 leading-tight font-medium">${destinationText}</div>
                    </div>
                </div>
            `;
        } else if (journey.type === 'transfer') {
            const conn = journey.connection; 
            const nextFull = journey.nextFullJourney; 
            const termStation = escapeHTML(journey.train1.terminationStation.replace(/ STATION/g, ''));
            const arrivalAtTransfer = escapeHTML(formatTimeDisplay(journey.train1.arrivalAtTransfer));
            let train1Info = `Train ${safeTrainName} (Terminates at ${termStation} at ${arrivalAtTransfer})`;
            if (journey.isLastTrain) train1Info = `<span class="text-red-600 dark:text-red-400 font-bold">Last Train (${safeTrainName})</span>`;

            let connectionInfoHTML = "";
            if (nextFull) {
                const connTrain = escapeHTML(conn.train);
                const connDest = escapeHTML(conn.actualDestination.replace(/ STATION/g, ''));
                const connDep = escapeHTML(formatTimeDisplay(conn.departureTime));
                const nextTrain = escapeHTML(nextFull.train);
                const nextDest = escapeHTML(nextFull.actualDestination.replace(/ STATION/g, ''));
                const nextDep = escapeHTML(formatTimeDisplay(nextFull.departureTime));
                const connection1Text = `Connect: Train ${connTrain} (to ${connDest}) @ <b>${connDep}</b>`;
                const connection2Text = `Next: Train ${nextTrain} (to ${nextDest}) @ <b>${nextDep}</b>`;
                connectionInfoHTML = `<div class="space-y-0.5"><div class="text-yellow-600 dark:text-yellow-400 font-medium">${connection1Text}</div><div class="text-gray-500 dark:text-gray-400 text-[9px] font-medium">${connection2Text}</div></div>`;
            } else {
                const connTrain = escapeHTML(conn.train);
                const connDep = escapeHTML(formatTimeDisplay(conn.departureTime));
                const connArr = escapeHTML(formatTimeDisplay(conn.arrivalTime));
                let connDestName = `(Arr ${connArr})`; 
                const connectionText = `Connect: Train ${connTrain} @ <b>${connDep}</b> ${connDestName}`;
                connectionInfoHTML = `<div class="text-yellow-600 dark:text-yellow-400 font-medium">${connectionText}</div>`;
            }
            
            element.innerHTML = `
                <div class="flex flex-row items-center w-full space-x-3">
                    <div class="relative w-1/2 h-24 flex flex-col justify-center items-center text-center p-1 pb-5 ${timeClass} rounded-lg shadow-sm flex-shrink-0">
                        <div class="text-2xl font-bold text-gray-900 dark:text-white leading-tight">${safeDepTime}</div>
                        <div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>
                        ${sharedTag}
                        ${buttonHtml}
                    </div>
                    <div class="w-1/2 flex flex-col justify-center items-center text-center space-y-0.5">
                        <div class="text-[10px] text-yellow-600 dark:text-yellow-400 leading-tight font-medium mb-1">${train1Info}</div>
                        <div class="text-[10px] leading-tight">${connectionInfoHTML}</div>
                    </div>
                </div>
            `;
        }
    },

    // --- 3. INTERNAL HELPERS ---
    
    _getDotColor: (colorClass) => {
        if (!colorClass) return 'dot-gray';
        if (colorClass.includes('green')) return 'dot-green';
        if (colorClass.includes('orange')) return 'dot-orange';
        if (colorClass.includes('purple')) return 'dot-purple';
        if (colorClass.includes('indigo')) return 'dot-purple'; // GUARDIAN FIX: Maps Indigo to Purple for visual fallback
        if (colorClass.includes('blue')) return 'dot-blue';
        if (colorClass.includes('yellow')) return 'dot-yellow';
        if (colorClass.includes('red')) return 'dot-red';
        return 'dot-gray';
    },

    // --- 4. CHANGELOG MODAL ---
    renderChangelogModal: (changelogData) => {
        // GUARDIAN UPDATE V5.00.10: Auto-close sidenav when opening modal
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
            modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-[100] hidden flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300';
            modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-0 overflow-hidden transform transition-all scale-95 flex flex-col max-h-[85vh]">
                    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                        <h3 class="font-bold text-lg text-gray-900 dark:text-white flex items-center">
                            <span class="mr-2">🚀</span> What's New
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

    // --- 5. GRID GENERATION HELPER (NEW V5.00.09 - Visual Polish) ---
    _buildGridHTML: (schedule, sheetName, routeId, dayIdx, highlightNextTrain = true, isExport = false) => {
        // 1. Column Sorting Logic
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

        // 2. Active Column Logic
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

        // 3. HTML Generation (VISUAL POLISH)
        const paddingClass = isExport ? 'p-2' : 'p-3'; 
        const fontSizeClass = isExport ? 'text-sm' : 'text-xs'; // Bigger text for export
        
        // GUARDIAN FIX: Dynamic Dark Mode Classes + Explicit Light Mode Text
        let tableClass = isExport ? '' : 'bg-white dark:bg-gray-900';
        let theadClass = isExport ? '' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200'; // Explicit gray-900
        let stickyHeaderClass = isExport ? '' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'; // Stronger border
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
                            const isExcluded = (typeof isTrainExcluded === 'function') && isTrainExcluded(h, routeId, dayIdx);
                            
                            let bgClass = '';
                            if (!isExport) {
                                if (isHighlight) bgClass = 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 font-bold'; // Darker blue text
                                if (isExcluded) bgClass = 'bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 opacity-90';
                            }

                            const headerContent = (isExcluded && !isExport) ? `<span class="block text-[8px] text-red-600 dark:text-red-400 font-black mb-0.5 tracking-tight">🚫 NO SVC</span>${h}` : h;

                            return `<th class="${paddingClass} border-b border-r ${borderClass} whitespace-nowrap text-center ${bgClass} min-w-[70px]" ${isHighlight ? 'id="grid-active-col"' : ''}>${headerContent}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y ${borderClass} ${tbodyClass}">
        `;

        schedule.rows.forEach(row => {
            if (!row.STATION || row.STATION.toLowerCase().includes('updated')) return; 
            const cleanStation = row.STATION.replace(' STATION', '');
            let hasData = false;
            sortedCols.forEach(col => { if (row[col] && row[col] !== "-" && row[col] !== "") hasData = true; });
            if (!hasData) return;

            html += `
                <tr class="">
                    <td class="sticky left-0 z-10 ${stickyCellClass} ${paddingClass} border-r font-bold truncate max-w-[140px] shadow-lg border-b text-left pl-3">${cleanStation}</td>
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
                        const isExcluded = (typeof isTrainExcluded === 'function') && isTrainExcluded(col, routeId, dayIdx);

                        let cellClass = `${paddingClass} text-center border-r ${borderClass} border-b`;
                        
                        if (val !== "" && val !== "-") {
                            cellClass += " font-mono font-medium";
                            if (!isExport) {
                                cellClass += " text-gray-900 dark:text-gray-200"; // FIX: Explicit Black Text for Light Mode
                                if (isHighlight) cellClass += " bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-800 dark:text-blue-300";
                                if (isExcluded) cellClass += " text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 opacity-80 font-normal decoration-slice";
                            }
                        } else { 
                            if (!isExport) {
                                cellClass += " text-gray-300 dark:text-gray-700"; 
                                if (isExcluded) cellClass += " bg-red-50 dark:bg-red-900/10";
                            }
                        }
                        return `<td class="${cellClass}">${val}</td>`;
                    }).join('')}
                </tr>
            `;
        });

        html += `</tbody></table>`;
        return html;
    }
};

// --- WINDOW FUNCTIONS (RESTORED & STABLE) ---

window.renderFullScheduleGrid = function(direction = 'A', dayOverride = null) {
    // GUARDIAN PHASE 3: Loading Guardrail
    if (!schedules || Object.keys(schedules).length === 0) {
        showToast("Loading latest schedules... please wait.", "info", 2000);
        return;
    }

    const route = ROUTES[currentRouteId];
    if (!route) return;

    const selectedDay = dayOverride || currentDayType;
    let sheetDayType = 'weekday';
    
    // GUARDIAN PHASE 4: Smart Defaults (Sunday -> Weekday)
    if (selectedDay === 'saturday') {
        sheetDayType = 'saturday';
    } else if (selectedDay === 'sunday') {
        // Explicitly map Sunday to Weekday for next-day planning
        sheetDayType = 'weekday';
    } else {
        sheetDayType = 'weekday';
    }

    let dayIdx = (typeof currentDayIndex !== 'undefined') ? currentDayIndex : new Date().getDay();
    
    if (dayOverride) {
        const isSameType = (dayOverride === currentDayType);
        if (!isSameType) {
            if (dayOverride === 'weekday') dayIdx = 1; 
            else if (dayOverride === 'saturday') dayIdx = 6;
            else if (dayOverride === 'sunday') dayIdx = 0;
        }
    }

    trackAnalyticsEvent('view_full_grid', { 
        route: route.name, 
        direction: direction,
        day: selectedDay 
    });

    const destName = (direction === 'A' ? route.destA : route.destB).replace(' STATION', '');
    
    const sheetKey = `${sheetDayType}_to_${direction.toLowerCase()}`;
    const schedule = schedules[sheetKey];

    if (!schedule || !schedule.rows || schedule.rows.length === 0) {
        showToast(`No ${sheetDayType} schedule available for this route.`, "error");
        return;
    }

    let modal = document.getElementById('full-schedule-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'full-schedule-modal';
        modal.className = 'fixed inset-0 bg-white dark:bg-gray-900 z-[95] hidden flex items-center justify-center p-0 full-screen transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-900 rounded-none shadow-2xl w-full h-full flex flex-col transform transition-transform duration-300 scale-100 overflow-hidden relative">
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800 z-20 relative">
                    <h3 class="flex-grow min-w-0 pr-2"></h3>
                    <button onclick="document.getElementById('full-schedule-modal').classList.add('hidden')" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition flex-shrink-0" aria-label="Close Grid">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div id="grid-controls" class="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-20 relative"></div>
                <div id="grid-container" class="flex-grow overflow-auto bg-white dark:bg-gray-900 relative"></div>
                <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 z-20 relative">
                    <button onclick="document.getElementById('full-schedule-modal').classList.add('hidden')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors">Close Timetable</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const container = document.getElementById('grid-container');
    const headerTitle = modal.querySelector('h3');
    const controlsDiv = modal.querySelector('#grid-controls');
    
    let effectiveDate = "Standard Schedule";
    if (schedule.lastUpdated) {
        const cleanDate = schedule.lastUpdated.replace(/^last updated[:\s-]*/i, '').trim();
        effectiveDate = `Effective: ${cleanDate}`;
    }

    if (headerTitle) {
        headerTitle.innerHTML = `
            <div class="flex flex-col w-full">
                <span class="text-sm font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider truncate">Trains to ${destName}</span>
                <span class="text-[10px] text-gray-400 font-mono mt-0.5 truncate">${effectiveDate}</span>
            </div>
        `;
    }

    if (controlsDiv) {
        const isWk = sheetDayType === 'weekday';
        const shareUrl = `https://nexttrain.co.za/?action=route&route=${currentRouteId}&view=grid&dir=${direction}&day=${selectedDay}`;
        const shareText = `Check out the ${sheetDayType} schedule to ${destName}`;
        
        window.shareCurrentGrid = async () => {
            const data = { title: 'Next Train Schedule', text: shareText, url: shareUrl };
            try {
                if (navigator.share) await navigator.share(data);
                else {
                    const textArea = document.createElement('textarea');
                    textArea.value = shareUrl;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Schedule link copied to clipboard!');
                }
            } catch (e) {}
        };

        controlsDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <select onchange="renderFullScheduleGrid('${direction}', this.value)" class="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-gray-700 dark:text-gray-200 focus:outline-none shadow-sm">
                    <option value="weekday" ${isWk ? 'selected' : ''}>Monday-Friday</option>
                    <option value="saturday" ${!isWk ? 'selected' : ''}>Saturday</option>
                </select>
                <button onclick="renderFullScheduleGrid('${direction === 'A' ? 'B' : 'A'}', '${selectedDay}')" class="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap shadow-sm">
                    ⇄ Return
                </button>
            </div>
            
            <div class="flex items-center space-x-2 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">
                <button onclick="takeGridSnapshot()" class="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition shadow-sm border border-gray-200 dark:border-gray-600" title="Save Image">
                    <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300">Save</span>
                    <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </button>
                <button onclick="shareCurrentGrid()" class="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 transition shadow-sm" title="Share Link">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                </button>
            </div>
        `;
    }

    const isTodayType = (currentDayType === 'weekday' && sheetDayType === 'weekday') || 
                        (currentDayType !== 'weekday' && sheetDayType === 'saturday');
    
    const html = Renderer._buildGridHTML(schedule, route.sheetKeys[sheetKey], currentRouteId, dayIdx, isTodayType, false);

    container.innerHTML = html;
    modal.classList.remove('hidden');
    history.pushState({ modal: 'grid' }, '', '#grid');

    setTimeout(() => {
        const activeCol = document.getElementById('grid-active-col');
        if (activeCol) activeCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
};

window.highlightGridRow = function(tr) {
    const allRows = document.querySelectorAll('#grid-container tr');
    allRows.forEach(r => {
        r.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/40');
        const sticky = r.querySelector('td.sticky');
        if(sticky) { sticky.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/40'); sticky.classList.add('bg-white', 'dark:bg-gray-900'); }
    });
    tr.classList.add('bg-yellow-100', 'dark:bg-yellow-900/40');
    const stickyCell = tr.querySelector('td.sticky');
    if (stickyCell) { stickyCell.classList.remove('bg-white', 'dark:bg-gray-900'); stickyCell.classList.add('bg-yellow-100', 'dark:bg-yellow-900/40'); }
};

// --- SNAPSHOT ENGINE V2.2 (Header Swap & Light Mode Tweaks) ---
window.takeGridSnapshot = async function() {
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

    const daySelect = document.querySelector('#grid-controls select');
    const selectedDay = daySelect ? daySelect.value : 'weekday';
    let sheetDayType = selectedDay;
    if (selectedDay === 'sunday') sheetDayType = 'weekday'; 

    const keyA = `${sheetDayType}_to_a`;
    const keyB = `${sheetDayType}_to_b`;
    const schedA = schedules[keyA];
    const schedB = schedules[keyB];

    // THEME & COLOR LOGIC (Updated for softer Dark Mode)
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Guardian: Changed dark background from #111827 (very dark) to #1f2937 (gray-800) for better readability
    const bgColor = isDarkMode ? '#1f2937' : '#ffffff'; 
    const textColor = isDarkMode ? '#f3f4f6' : '#111827'; // Darker text for light mode
    const borderColor = isDarkMode ? '#374151' : '#e5e7eb';
    const accentColor = isDarkMode ? '#60a5fa' : '#2563eb';
    const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';
    const tableHeaderBg = isDarkMode ? '#374151' : '#f3f4f6'; // Lighter header for dark mode

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
    
    if (isDarkMode) exportContainer.classList.add('dark');
    else exportContainer.classList.remove('dark');

    const destAName = route.destA.replace(' STATION', '');
    const destBName = route.destB.replace(' STATION', '');
    const dateText = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    const scheduleTypeLabel = selectedDay === 'weekday' ? 'WEEKDAY' : 'WEEKEND';
    
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
        <!-- HEADER BLOCK (SWAPPED LAYOUT) -->
        <div class="mb-6 border-b-4 pb-4" style="border-color: ${accentColor}">
            <div class="flex justify-between items-end">
                <div>
                    <h1 class="text-4xl font-black uppercase tracking-tight mb-1" style="color: ${accentColor}">Commuter Notice</h1>
                    <h2 class="text-xl font-bold uppercase tracking-widest" style="color: ${mutedColor}">${route.name} Corridor</h2>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold" style="color: ${textColor}">${scheduleTypeLabel} TIMETABLE</div>
                    ${effectiveDateText ? `<div class="text-sm font-bold uppercase mt-1" style="color: ${mutedColor}">EFFECTIVE: ${effectiveDateText}</div>` : ''}
                </div>
            </div>
        </div>

        <!-- TABLE BLOCK A -->
        <div class="mb-8">
            <div class="p-2 mb-0 border-l-4" style="background-color: ${isDarkMode ? '#374151' : '#f3f4f6'}; border-color: ${accentColor}">
                <h3 class="font-bold text-lg uppercase" style="color: ${textColor}">DIRECTION: ${destBName} ↔ ${destAName}</h3>
            </div>
            <div class="schedule-table-wrapper">
                ${htmlA}
            </div>
        </div>

        <!-- DIVIDER -->
        <div class="flex items-center justify-center my-8 opacity-50">
            <div class="h-px w-full" style="background-color: ${borderColor}"></div>
            <span class="px-4 text-xs font-bold uppercase" style="color: ${mutedColor}">Return Service</span>
            <div class="h-px w-full" style="background-color: ${borderColor}"></div>
        </div>

        <!-- TABLE BLOCK B -->
        <div class="mb-8">
            <div class="p-2 mb-0 border-l-4" style="background-color: ${isDarkMode ? '#374151' : '#f3f4f6'}; border-color: ${accentColor}">
                <h3 class="font-bold text-lg uppercase" style="color: ${textColor}">DIRECTION: ${destAName} ↔ ${destBName}</h3>
            </div>
            <div class="schedule-table-wrapper">
                ${htmlB}
            </div>
        </div>

        <!-- ENHANCED FOOTER (GENERATED MOVED HERE) -->
        <div class="mt-8 p-4 rounded-lg flex justify-between items-center" style="background-color: ${isDarkMode ? '#374151' : '#f3f4f6'}">
            <div class="flex flex-col">
                <span class="text-[10px] font-mono mb-1" style="color: ${mutedColor}">GENERATED: ${dateText}</span>
                <span class="font-bold text-xs" style="color: ${mutedColor}">Data Source: PRASA / Metrorail Web</span>
                <span class="text-[10px] uppercase tracking-wider opacity-75" style="color: ${mutedColor}">Unofficial Guide • Not affiliated with PRASA</span>
            </div>
            <span class="font-black text-xl" style="color: ${accentColor}">nexttrain.co.za</span>
        </div>
    `;

    // Force styling on injected tables
    const tables = exportContainer.querySelectorAll('table');
    tables.forEach(t => {
        t.style.width = '100%';
        t.style.borderCollapse = 'collapse';
        t.querySelectorAll('th').forEach(th => {
            th.style.backgroundColor = tableHeaderBg;
            th.style.color = mutedColor;
            th.style.border = `1px solid ${borderColor}`;
            th.className = ''; 
            th.style.padding = '6px'; // Increased padding
            th.style.fontSize = '12px'; // Larger Text
            th.style.fontWeight = 'bold';
            th.style.textAlign = 'left'; // Left Align Stations
        });
        t.querySelectorAll('td').forEach(td => {
            td.style.border = `1px solid ${borderColor}`;
            td.style.padding = '6px'; // Increased padding
            td.style.color = textColor;
            td.style.fontSize = '14px'; // Larger Times
            td.style.fontFamily = 'monospace';
            td.style.textAlign = 'center'; // Center Times
            td.style.fontWeight = '600'; // Bolder
        });
        // Sticky removal
        t.querySelectorAll('.sticky').forEach(el => {
            el.style.position = 'static';
            el.classList.remove('sticky');
        });
        // Force station column alignment
        t.querySelectorAll('td:first-child').forEach(td => {
            td.style.textAlign = 'left';
            td.style.paddingLeft = '10px';
        });
    });

    document.body.appendChild(exportContainer);

    try {
        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(exportContainer, {
            scale: 1.5,
            backgroundColor: bgColor,
            logging: false,
            useCORS: true
        });

        canvas.toBlob(async (blob) => {
            const fileName = `Schedule_${route.name.replace(/\s/g,'_')}_${selectedDay}.png`;
            
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile && navigator.share && navigator.canShare) {
                const file = new File([blob], fileName, { type: "image/png" });
                try {
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            text: `Commuter Notice: ${route.name} (${selectedDay})` 
                        });
                        showToast("Shared!", "success");
                    } else {
                        throw new Error("File sharing not supported");
                    }
                } catch (e) {}
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = canvas.toDataURL();
                link.click();
                showToast("Image saved.", "success");
            }
            
            document.body.removeChild(exportContainer);
        });
    } catch (e) {
        console.error(e);
        showToast("Snapshot failed.", "error");
        if(document.body.contains(exportContainer)) document.body.removeChild(exportContainer);
    }
};

// Deprecated old Share
window.shareGridDeepLink = function(direction) { console.warn("Use snapshot."); };