/**
 * METRORAIL NEXT TRAIN - RENDERER ENGINE (V5.00.02 - Stacked Layout)
 * ------------------------------------------------
 * This module handles all DOM injection and HTML string generation.
 * It separates the "View" from the "Logic" (ui.js/logic.js).
 * * PART OF PHASE 1: MODULARIZATION
 */

const Renderer = {

    // --- 1. DYNAMIC MENU GENERATION ---

    /**
     * Renders the Sidebar Route Menu dynamically from config.js
     * Groups routes by Corridor ID mapped to display categories.
     */
    renderRouteMenu: (containerId, routes, activeRouteId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Grouping Map (Maps Config Corridor IDs to Display Categories)
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

        // Custom Order for Categories
        const categoryOrder = [
            "Northern Corridor (Pretoria)",
            "Pretoria - JHB Line",
            "JHB West Line"
        ];

        // Group Routes
        const groups = {};
        Object.values(routes).forEach(route => {
            if (!route.isActive) return;
            const cat = categoryMap[route.corridorId] || "Other Routes";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(route);
        });

        let html = '';

        // Render Pinned Section First
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

        // Render Categories
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

    /**
     * Renders the Welcome Modal Route List dynamically
     */
    renderWelcomeList: (containerId, routes, onSelectCallback) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = "";
        
        Object.values(routes).forEach(route => {
            if (!route.isActive) return;

            const btn = document.createElement('button');
            
            // Determine Border Color based on config colorClass
            let borderColor = 'border-gray-500';
            if (route.colorClass.includes('orange')) borderColor = 'border-orange-500';
            else if (route.colorClass.includes('purple')) borderColor = 'border-purple-500';
            else if (route.colorClass.includes('green')) borderColor = 'border-green-500';
            else if (route.colorClass.includes('blue')) borderColor = 'border-blue-500';
            else if (route.colorClass.includes('red')) borderColor = 'border-red-500';
            else if (route.colorClass.includes('yellow')) borderColor = 'border-yellow-500';
            else if (route.colorClass.includes('indigo')) borderColor = 'border-indigo-500'; // Added for Hercules

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

    // --- 4. CHANGELOG MODAL (NEW V5.00.00) ---
    renderChangelogModal: (changelogData) => {
        history.pushState({ modal: 'changelog' }, '', '#changelog');
        let modal = document.getElementById('changelog-modal');
        
        // Build if missing
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
    }
};

// --- GRID ENGINE (Moved from UI.js) ---

// GUARDIAN UPDATE V4.60.87: Stacked Toolbar Layout (Optimized)
window.renderFullScheduleGrid = function(direction = 'A', dayOverride = null) {
    const route = ROUTES[currentRouteId];
    if (!route) return;

    // 1. Determine Day Context (Fixed: Use currentDayIndex if available)
    const selectedDay = dayOverride || currentDayType;
    let sheetDayType = 'weekday';
    
    if (selectedDay === 'saturday' || selectedDay === 'sunday') {
        sheetDayType = 'saturday';
    }

    // GUARDIAN FIX: Respect Simulation Mode / Current State logic
    let dayIdx = (typeof currentDayIndex !== 'undefined') ? currentDayIndex : new Date().getDay();
    
    if (dayOverride) {
        // Smart Context: If the requested view matches the current day's type,
        // keep the specific day index (e.g. Keep "Thursday" instead of resetting to "Monday").
        // This ensures "Ghost Trains" for today stay visible when toggling direction.
        const isSameType = (dayOverride === currentDayType);
        
        if (!isSameType) {
            if (dayOverride === 'weekday') dayIdx = 1; // Default to Mon
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
    const altDestName = (direction === 'A' ? route.destB : route.destA).replace(' STATION', '');
    
    const sheetKey = `${sheetDayType}_to_${direction.toLowerCase()}`;
    const schedule = schedules[sheetKey];

    if (!schedule || !schedule.rows || schedule.rows.length === 0) {
        showToast(`No ${sheetDayType} schedule available for this route.`, "error");
        return;
    }

    // Auto-Inject Modal if Missing (Updated Structure for Stacked Toolbar)
    let modal = document.getElementById('full-schedule-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'full-schedule-modal';
        modal.className = 'fixed inset-0 bg-white dark:bg-gray-900 z-[95] hidden flex items-center justify-center p-0 full-screen transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-900 rounded-none shadow-2xl w-full h-full flex flex-col transform transition-transform duration-300 scale-100 overflow-hidden relative">
                <!-- ROW 1: HEADER (TITLE + CLOSE) -->
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800 z-20 relative">
                    <h3 class="flex-grow min-w-0 pr-2"><!-- Dynamic Title --></h3>
                    <button onclick="document.getElementById('full-schedule-modal').classList.add('hidden')" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition flex-shrink-0" aria-label="Close Grid">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                <!-- ROW 2: TOOLBAR (CONTROLS) -->
                <div id="grid-controls" class="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-20 relative">
                    <!-- Dynamic Controls -->
                </div>

                <!-- ROW 3: GRID -->
                <div id="grid-container" class="flex-grow overflow-auto bg-white dark:bg-gray-900 relative"></div>
                
                <!-- ROW 4: FOOTER -->
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
                <span class="text-sm font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider truncate">To ${destName}</span>
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

        // NEW LAYOUT: Grouped Controls
        controlsDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <select onchange="renderFullScheduleGrid('${direction}', this.value)" class="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-gray-700 dark:text-gray-200 focus:outline-none shadow-sm">
                    <option value="weekday" ${isWk ? 'selected' : ''}>Mon-Fri</option>
                    <option value="saturday" ${!isWk ? 'selected' : ''}>Sat/Sun</option>
                </select>
                <button onclick="renderFullScheduleGrid('${direction === 'A' ? 'B' : 'A'}', '${selectedDay}')" class="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap shadow-sm">
                    ⇄ Return
                </button>
            </div>
            
            <div class="flex items-center space-x-2 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">
                <button onclick="takeGridSnapshot()" class="p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition shadow-sm" title="Save as Image">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
                <button onclick="shareCurrentGrid()" class="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 transition shadow-sm" title="Share Link">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                </button>
            </div>
        `;
    }

    const trainCols = schedule.headers.slice(1).filter(header => /^\d{4}[a-zA-Z]*$/.test(header.trim()));
    let sortedCols = [];
    const actualSheetName = route.sheetKeys[sheetKey];

    if (typeof MANUAL_GRID_ORDER !== 'undefined' && MANUAL_GRID_ORDER[actualSheetName]) {
        const manualOrder = MANUAL_GRID_ORDER[actualSheetName];
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
    const isTodayType = (currentDayType === 'weekday' && sheetDayType === 'weekday') || 
                        (currentDayType !== 'weekday' && sheetDayType === 'saturday');

    if (currentTime && isTodayType) {
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

    let html = `
        <table class="w-full text-xs text-left border-collapse">
            <thead class="text-[10px] uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 sticky top-0 z-20 shadow-sm">
                <tr>
                    <th class="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 p-3 border-b border-r border-gray-200 dark:border-gray-700 font-bold min-w-[120px] shadow-lg">Station</th>
                    ${sortedCols.map((h, i) => {
                        const isHighlight = i === activeColIndex;
                        const isExcluded = (typeof isTrainExcluded === 'function') && isTrainExcluded(h, currentRouteId, dayIdx);
                        
                        let bgClass = isHighlight ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold' : '';
                        if (isExcluded) bgClass = 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300 opacity-90';

                        const headerContent = isExcluded ? `<span class="block text-[8px] text-red-600 font-black mb-0.5 tracking-tight">🚫 NO SVC</span>${h}` : h;

                        return `<th class="p-3 border-b border-r border-gray-200 dark:border-gray-700 whitespace-nowrap text-center ${bgClass} min-w-[60px]" ${isHighlight ? 'id="grid-active-col"' : ''}>${headerContent}</th>`;
                    }).join('')}
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
    `;

    schedule.rows.forEach(row => {
        if (!row.STATION || row.STATION.toLowerCase().includes('updated')) return; 
        const cleanStation = row.STATION.replace(' STATION', '');
        let hasData = false;
        sortedCols.forEach(col => { if (row[col] && row[col] !== "-" && row[col] !== "") hasData = true; });
        if (!hasData) return;

        html += `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer" onclick="highlightGridRow(this)">
                <td class="sticky left-0 z-10 bg-white dark:bg-gray-900 p-2 border-r border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-gray-100 truncate max-w-[120px] shadow-lg border-b">${cleanStation}</td>
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
                    const isHighlight = i === activeColIndex;
                    const isExcluded = (typeof isTrainExcluded === 'function') && isTrainExcluded(col, currentRouteId, dayIdx);

                    let cellClass = "p-2 text-center border-r border-gray-100 dark:border-gray-800 border-b";
                    
                    if (val !== "-") {
                        cellClass += " font-mono text-gray-700 dark:text-gray-300";
                        if (isHighlight) cellClass += " bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-700 dark:text-blue-300";
                        // GUARDIAN FIX V4.60.81: Improved Contrast for Ghost Trains
                        if (isExcluded) cellClass += " text-red-400 dark:text-red-400 bg-red-50 dark:bg-red-900/20 opacity-80 font-normal decoration-slice";
                    } else { 
                        cellClass += " text-gray-200 dark:text-gray-700"; 
                        if (isExcluded) cellClass += " bg-red-50 dark:bg-red-900/10";
                    }
                    return `<td class="${cellClass}">${val}</td>`;
                }).join('')}
            </tr>
        `;
    });

    html += `</tbody></table>`;
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

// GUARDIAN SNAPSHOT ENGINE (Phase 5.1 - Fixes)
window.takeGridSnapshot = async function() {
    // 1. Load Engine
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

    const sourceTable = document.querySelector('#grid-container table');
    if (!sourceTable) { showToast("Table not ready.", "error"); return; }

    showToast("📸 Processing image...", "info", 3000);

    // 2. Clone & Brand
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '-9999px';
    exportContainer.style.top = '0';
    // GUARDIAN FIX: Dynamic width based on scrollWidth + padding
    exportContainer.style.width = (sourceTable.scrollWidth + 60) + 'px'; 
    exportContainer.style.padding = '30px';
    exportContainer.style.fontFamily = 'system-ui, sans-serif';
    
    // Theme Match
    const isDark = document.documentElement.classList.contains('dark');
    exportContainer.style.backgroundColor = isDark ? '#111827' : '#ffffff';
    exportContainer.style.color = isDark ? '#f3f4f6' : '#111827';
    if(isDark) exportContainer.classList.add('dark');

    // GUARDIAN FIX: Smart Directional Header (Origin -> Destination)
    const routeConfig = ROUTES[currentRouteId];
    // Scrape "To [Dest]" text from DOM header (reliable source of truth for current view)
    const headerDestText = document.querySelector('#full-schedule-modal h3 span')?.innerText || "";
    // Clean "To " prefix
    const cleanDest = headerDestText.replace(/^To\s+/i, '').trim(); 
    
    // Infer Origin based on Route Config
    let originName = "Origin";
    if (routeConfig) {
        // If viewing Dest A, Origin is B. If viewing B, Origin is A.
        if (cleanDest.toUpperCase() === routeConfig.destA.replace(' STATION', '')) {
            originName = routeConfig.destB.replace(' STATION', '');
        } else {
            originName = routeConfig.destA.replace(' STATION', '');
        }
    }
    
    const formattedTitle = `${originName} ➝ ${cleanDest}`;
    const dateText = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });

    exportContainer.innerHTML = `
        <div style="margin-bottom: 20px; text-align: center; border-bottom: 3px solid #3b82f6; padding-bottom: 15px;">
            <h1 style="font-size: 28px; font-weight: 900; color: ${isDark ? '#60a5fa' : '#1e3a8a'}; margin: 0; text-transform: uppercase; letter-spacing: 1px;">${formattedTitle}</h1>
            <h2 style="font-size: 14px; font-weight: bold; color: ${isDark ? '#9ca3af' : '#4b5563'}; margin: 8px 0;">${dateText} • Generated by NextTrain.co.za</h2>
        </div>
        <div id="export-table-wrapper" style="font-size: 12px;"></div>
    `;

    document.body.appendChild(exportContainer);
    
    const tableClone = sourceTable.cloneNode(true);
    
    // GUARDIAN FIX: "De-Sticky" Logic (Flatten table for screenshot)
    // Remove sticky classes that cause rendering artifacts in html2canvas
    tableClone.querySelectorAll('.sticky').forEach(el => {
        el.classList.remove('sticky', 'left-0', 'top-0', 'z-10', 'z-20', 'z-30', 'shadow-lg', 'shadow-sm');
        el.style.position = 'static'; // Force static positioning
        el.style.boxShadow = 'none';
        if(isDark) el.style.backgroundColor = '#111827'; // Ensure bg matches container
    });

    // Force border colors for visibility
    if (isDark) {
        tableClone.querySelectorAll('td, th').forEach(el => el.style.borderColor = '#374151');
    }
    
    exportContainer.querySelector('#export-table-wrapper').appendChild(tableClone);

    // 3. Render
    try {
        const canvas = await html2canvas(exportContainer, {
            scale: 2, // Retina quality
            backgroundColor: isDark ? '#111827' : '#ffffff',
            logging: false,
            useCORS: true,
            windowWidth: exportContainer.scrollWidth, // Capture full width
            height: exportContainer.scrollHeight
        });

        canvas.toBlob(async (blob) => {
            const fileName = `Schedule_${cleanDest.replace(/\s/g,'_')}.png`;
            
            // GUARDIAN FIX: Desktop Fallback Logic
            // Windows 'navigator.share' often fails. Force download on non-mobile user agents.
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile && navigator.share && navigator.canShare) {
                const file = new File([blob], fileName, { type: "image/png" });
                try {
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            text: `Schedule: ${formattedTitle}` // Caption logic
                        });
                        showToast("Shared!", "success");
                    } else {
                        throw new Error("File sharing not supported");
                    }
                } catch (e) {
                    // Fallback to download if share sheet cancelled or failed
                    // console.warn(e); 
                }
            } else {
                // Desktop / Windows Fallback
                const link = document.createElement('a');
                link.download = fileName;
                link.href = canvas.toDataURL();
                link.click();
                showToast("Schedule downloaded.", "success");
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