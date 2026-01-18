/**
 * METRORAIL NEXT TRAIN - RENDERER ENGINE (V4.60.11)
 * ------------------------------------------------
 * This module handles all DOM injection and HTML string generation.
 * It separates the "View" from the "Logic" (ui.js/logic.js).
 * * PART OF PHASE 1: MODULARIZATION
 */

const Renderer = {

    // --- 1. DYNAMIC MENU GENERATION (New for App Shell) ---

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

            btn.className = `w-full text-left p-4 rounded-xl shadow-md flex items-center justify-between group transition-all transform hover:scale-[1.02] active:scale-95 bg-white dark:bg-gray-800 border-l-4 ${borderColor}`;
            
            btn.innerHTML = `
                <div>
                    <span class="block text-sm font-bold text-gray-900 dark:text-white">${route.name}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">View schedules</span>
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            `;

            // Attach Click Event (using the callback passed from UI)
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
                <!-- Left Time Box Skeleton -->
                <div class="relative w-1/2 h-full bg-gray-300 dark:bg-gray-700 rounded-lg shadow-sm flex-shrink-0"></div>
                
                <!-- Right Info Skeleton -->
                <div class="w-1/2 flex flex-col justify-center items-center space-y-2">
                    <div class="h-3 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                    <div class="h-2 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                    <div class="h-5 bg-gray-300 dark:bg-gray-700 rounded w-full mt-1"></div>
                </div>
            </div>
        `;
    },

    renderPlaceholder: (element1, element2) => {
        const placeholderHTML = `
            <div class="h-24 flex flex-col justify-center items-center text-gray-400 dark:text-gray-500">
                <svg class="w-6 h-6 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span class="text-xs font-medium">Select a station above</span>
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

    // "Night Owl" No Service Card
    renderNoService: (element, destination, firstNextTrain, dayOffset, openModalCallback) => {
        let timeHTML = 'N/A';
        
        if (firstNextTrain) {
            const rawTime = firstNextTrain.departureTime || firstNextTrain.train1.departureTime;
            const departureTime = formatTimeDisplay(rawTime);
            // Assuming calculateTimeDiffString is available globally via logic.js
            const timeDiffStr = (typeof calculateTimeDiffString === 'function') 
                ? calculateTimeDiffString(rawTime, dayOffset) 
                : ""; 
            
            timeHTML = `<div class="text-xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>`;
        } else {
            timeHTML = `<div class="text-lg font-bold text-gray-500">No Data</div>`;
        }
        
        const safeDestForClick = escapeHTML(destination).replace(/'/g, "\\'");
        
        // Note: We use a specialized onclick attribute that ui.js will need to handle or we rely on global scope.
        // For Phase 1, we assume openScheduleModal is global (it is in ui.js).
        const buttonHTML = `<button onclick="openScheduleModal('${safeDestForClick}', 'weekday')" class="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">Check Monday's Schedule</button>`;

        element.innerHTML = `
            <div class="flex flex-col justify-center items-center w-full py-2">
                <div class="text-sm font-bold text-gray-600 dark:text-gray-400">No service today</div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">First train next weekday is at:</p>
                <div class="text-center p-2 bg-gray-200 dark:bg-gray-900 rounded-md transition-all mt-1 w-3/4">
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
            <div class="flex flex-col justify-center items-center w-full py-2">
                <div class="text-sm font-bold text-gray-600 dark:text-gray-400">No more trains today</div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">First train ${dayName} is at:</p>
                <div class="text-center p-2 bg-gray-200 dark:bg-gray-900 rounded-md transition-all mt-1 w-3/4">
                    <div class="text-xl font-bold text-gray-900 dark:text-white">${departureTime}</div>
                    <div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>
                </div>
                <button onclick="openScheduleModal('${safeDestForClick}', '${dayType}')" class="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">See Full Schedule</button>
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
        const buttonHtml = `<button onclick="openScheduleModal('${safeDestForClick}')" class="absolute bottom-0 left-0 w-full text-[9px] uppercase tracking-wide font-bold py-1 bg-black bg-opacity-10 hover:bg-opacity-20 dark:bg-white dark:bg-opacity-10 dark:hover:bg-opacity-20 rounded-b-md transition-colors truncate">See Full Schedule</button>`;

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
                        <div class="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-0.5">Transfer Required</div>
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
        if (colorClass.includes('blue')) return 'dot-blue';
        if (colorClass.includes('yellow')) return 'dot-yellow';
        if (colorClass.includes('red')) return 'dot-red';
        return 'dot-gray';
    }
};