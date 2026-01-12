// --- GLOBAL ERROR HANDLER ---
window.onerror = function(msg, url, line) {
    console.error("Global Error Caught:", msg);
    if(loadingOverlay) loadingOverlay.style.display = 'none';
    if(mainContent) mainContent.style.display = 'block';
    
    if(toast) {
        toast.textContent = "Error: " + msg; 
        toast.className = "toast-error show";
    }
    return false;
};

// --- ANALYTICS HELPER (New) ---
function trackAnalyticsEvent(eventName, params = {}) {
    try {
        if (typeof gtag === 'function') {
            gtag('event', eventName, params);
            console.log(`[Analytics] Tracked: ${eventName}`, params);
        } else {
            console.log(`[Analytics] Skipped (gtag not found): ${eventName}`);
        }
    } catch (e) {
        console.warn("[Analytics] Error tracking event:", e);
    }
}

// --- HOLIDAY NAME MAPPING ---
const HOLIDAY_NAMES = {
    "01-01": "New Year's Day",
    "03-21": "Human Rights Day",
    "04-03": "Good Friday",
    "04-06": "Family Day",
    "04-27": "Freedom Day",
    "05-01": "Workers' Day",
    "06-16": "Youth Day",
    "08-09": "National Women's Day",
    "09-24": "Heritage Day",
    "12-16": "Day of Reconciliation",
    "12-25": "Christmas Day",
    "12-26": "Day of Goodwill"
};

// --- RENDERING FUNCTIONS ---

// UPDATED: Compact Skeleton Loader (h-24)
function renderSkeletonLoader(element) {
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
}

// NEW: Smooth Fade Out for Loading Overlay
window.hideLoadingOverlay = function() {
    if (!loadingOverlay) return;
    
    loadingOverlay.style.transition = 'opacity 0.3s ease-out';
    loadingOverlay.style.opacity = '0';
    
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        // Reset opacity for next time it might be needed (though normally we use skeletons now)
        loadingOverlay.style.opacity = '1'; 
    }, 300);
};

// UPDATED: Compact Placeholder (h-24)
function renderPlaceholder() {
    const placeholderHTML = `<div class="h-24 flex flex-col justify-center items-center text-gray-400 dark:text-gray-500"><svg class="w-6 h-6 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><span class="text-xs font-medium">Select a station above</span></div>`;
    pretoriaTimeEl.innerHTML = placeholderHTML;
    pienaarspoortTimeEl.innerHTML = placeholderHTML;
    if(fareContainer) fareContainer.classList.add('hidden'); // Hide fare box
}

function renderRouteError(error) {
    const html = `<div class="text-center p-3 bg-red-100 dark:bg-red-900 rounded-md border border-red-400 dark:border-red-700"><div class="text-xl mb-1">⚠️</div><p class="text-red-800 dark:text-red-200 text-sm font-medium">Connection failed. Please check internet.</p></div>`;
    pretoriaTimeEl.innerHTML = html; pienaarspoortTimeEl.innerHTML = html; stationSelect.innerHTML = '<option>Unable to load stations</option>';
}

function renderComingSoon(routeName) {
    const msg = `<div class="h-24 flex flex-col justify-center items-center text-center p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg"><h3 class="text-lg font-bold text-yellow-700 dark:text-yellow-300 mb-1">🚧 Coming Soon</h3><p class="text-xs text-gray-700 dark:text-gray-300">We are working on the <strong>${routeName}</strong> schedule.</p></div>`;
    pretoriaTimeEl.innerHTML = msg; pienaarspoortTimeEl.innerHTML = msg; stationSelect.innerHTML = '<option>Route not available</option>';
}

// UPDATED: "Night Owl" Style Layout for No Service
function renderNoService(element, destination) {
    const normalize = (s) => s ? s.toUpperCase().replace(/ STATION/g, '').trim() : '';
    const selectedStation = stationSelect.value;
    if (normalize(selectedStation) === normalize(destination)) {
        renderAtDestination(element);
        return;
    }
    const currentRoute = ROUTES[currentRouteId];
    const sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b';
    const schedule = schedules[sheetKey];
    let allJourneys = [];
    if (destination === currentRoute.destA) { const res = findNextJourneyToDestA(selectedStation, "00:00:00", schedule, currentRoute); allJourneys = res.allJourneys; } 
    else { const res = findNextJourneyToDestB(selectedStation, "00:00:00", schedule, currentRoute); allJourneys = res.allJourneys; }
    
    // Find next available train (simulating next day)
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    const firstTrain = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    
    let timeHTML = 'N/A';
    let timeDiffStr = '';
    
    if (firstTrain) {
        const rawTime = firstTrain.departureTime || firstTrain.train1.departureTime;
        const departureTime = formatTimeDisplay(rawTime);
        timeDiffStr = calculateTimeDiffString(rawTime, 1); // 1 day offset for next day
        timeHTML = `<div class="text-xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>`;
    } else {
        timeHTML = `<div class="text-lg font-bold text-gray-500">No Data</div>`;
    }
    
    // NEW: "Check Monday" Button with Night Owl Layout
    const safeDestForClick = escapeHTML(destination).replace(/'/g, "\\'");
    
    element.innerHTML = `
        <div class="flex flex-col justify-center items-center w-full py-2">
            <div class="text-sm font-bold text-gray-600 dark:text-gray-400">No service today</div>
            <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">First train next weekday is at:</p>
            <div class="text-center p-2 bg-gray-200 dark:bg-gray-900 rounded-md transition-all mt-1 w-3/4">
                ${timeHTML}
            </div>
            <button onclick="openScheduleModal('${safeDestForClick}', 'weekday')" class="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">Check Monday's Schedule</button>
        </div>
    `;
}

// UPDATED: Compact At Destination (h-24)
function renderAtDestination(element) { element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-green-500 dark:text-green-400">You are at this station</div>`; }

function processAndRenderJourney(allJourneys, element, header, destination) {
    const nowInSeconds = timeToSeconds(currentTime);
    
    // --- V4.37 UPDATE: SIMULATION LOGIC CLEANUP ---
    const remainingJourneys = allJourneys.filter(j => {
        return timeToSeconds(j.departureTime || j.train1.departureTime) >= nowInSeconds;
    });

    const nextJourney = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    const firstTrainName = allJourneys.length > 0 ? (allJourneys[0].train || allJourneys[0].train1.train) : null;
    
    if (!currentScheduleData) currentScheduleData = {};
    currentScheduleData[destination] = allJourneys;

    if (nextJourney) {
        const journeyTrainName = nextJourney.train || nextJourney.train1.train;
        nextJourney.isFirstTrain = (journeyTrainName === firstTrainName);
        const allRemainingTrainNames = new Set(remainingJourneys.map(j => j.train || j.train1.train));
        nextJourney.isLastTrain = (allRemainingTrainNames.size === 1);
    } else {
        if (allJourneys.length === 0) {
              element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No scheduled trains.</div>`;
              return;
        }
    }
    renderJourney(element, header, nextJourney, firstTrainName, destination);
}

// UPDATED: Compact Render Journey (h-24)
function renderJourney(element, headerElement, journey, firstTrainName, destination) {
    element.innerHTML = "";
    if (!journey) { renderNextAvailableTrain(element, destination); return; }

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
    const timeDiffStr = calculateTimeDiffString(rawTime);
    const safeDestForClick = safeDest.replace(/'/g, "\\'"); 
    const buttonHtml = `<button onclick="openScheduleModal('${safeDestForClick}')" class="absolute bottom-0 left-0 w-full text-[9px] uppercase tracking-wide font-bold py-1 bg-black bg-opacity-10 hover:bg-opacity-20 dark:bg-white dark:bg-opacity-10 dark:hover:bg-opacity-20 rounded-b-md transition-colors truncate">See Full Schedule</button>`;

    let sharedTag = "";
    if (journey.isShared && journey.sourceRoute) {
         const routeName = journey.sourceRoute.replace("Pretoria <-> ", "").replace("Route", "").trim();
         if (journey.isDivergent) {
             sharedTag = `<span class="block text-[9px] uppercase font-bold text-red-600 dark:text-red-400 mt-0.5 bg-red-100 dark:bg-red-900 px-1 rounded w-fit mx-auto border border-red-300 dark:border-red-700">⚠️ To ${journey.actualDestName}</span>`;
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

        element.innerHTML = `<div class="flex flex-row items-center w-full space-x-3"><div class="relative w-1/2 h-24 flex flex-col justify-center items-center text-center p-1 pb-5 ${timeClass} rounded-lg shadow-sm flex-shrink-0"><div class="text-2xl font-bold text-gray-900 dark:text-white leading-tight">${safeDepTime}</div><div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>${sharedTag}${buttonHtml}</div><div class="w-1/2 flex flex-col justify-center items-center text-center space-y-0.5"><div class="text-xs text-gray-800 dark:text-gray-200 font-medium leading-tight">${trainTypeText}</div><div class="text-[10px] text-gray-500 dark:text-gray-400 leading-tight font-medium">${destinationText}</div></div></div>`;
    }

    if (journey.type === 'transfer') {
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
        element.innerHTML = `<div class="flex flex-row items-center w-full space-x-3"><div class="relative w-1/2 h-24 flex flex-col justify-center items-center text-center p-1 pb-5 ${timeClass} rounded-lg shadow-sm flex-shrink-0"><div class="text-2xl font-bold text-gray-900 dark:text-white leading-tight">${safeDepTime}</div><div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>${sharedTag}${buttonHtml}</div><div class="w-1/2 flex flex-col justify-center items-center text-center space-y-0.5"><div class="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-0.5">Transfer Required</div><div class="text-[10px] text-yellow-600 dark:text-yellow-400 leading-tight font-medium mb-1">${train1Info}</div><div class="text-[10px] leading-tight">${connectionInfoHTML}</div></div></div>`;
    }
}

// UPDATED: Compact Next Available (h-24)
function renderNextAvailableTrain(element, destination) {
    const currentRoute = ROUTES[currentRouteId];
    let nextDayName = ""; let nextDaySheetKey = ""; let dayOffset = 1; 
    switch (currentDayIndex) {
        case 6: nextDayName = "Monday"; dayOffset = 2; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; break;
        case 5: nextDayName = "Saturday"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b'; break;
        default: nextDayName = "tomorrow"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; break;
    }
    const nextSchedule = schedules[nextDaySheetKey];
    if (!nextSchedule) { element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No schedule found.</div>`; return; }
    const selectedStation = stationSelect.value;
    let allJourneys = [];
    if (destination === currentRoute.destA) { const res = findNextJourneyToDestA(selectedStation, "00:00:00", nextSchedule, currentRoute); allJourneys = res.allJourneys; } 
    else { const res = findNextJourneyToDestB(selectedStation, "00:00:00", nextSchedule, currentRoute); allJourneys = res.allJourneys; }
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    const firstTrainOfNextDay = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    if (!firstTrainOfNextDay) { element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No trains found.</div>`; return; }
    
    const rawTime = firstTrainOfNextDay.departureTime || firstTrainOfNextDay.train1.departureTime;
    const departureTime = formatTimeDisplay(rawTime);
    const timeDiffStr = calculateTimeDiffString(rawTime, dayOffset);
    
    const safeDest = escapeHTML(destination);
    const safeDestForClick = safeDest.replace(/'/g, "\\'"); 

    element.innerHTML = `<div class="flex flex-col justify-center items-center w-full py-2"><div class="text-sm font-bold text-gray-600 dark:text-gray-400">No more trains today</div><p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">First train ${nextDayName} is at:</p><div class="text-center p-2 bg-gray-200 dark:bg-gray-900 rounded-md transition-all mt-1 w-3/4"><div class="text-xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-xs text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div></div><button onclick="openScheduleModal('${safeDestForClick}')" class="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">See Full Schedule</button></div>`;
}

// --- UPDATE FARE BOX LOGIC (V4.44.1) ---
function updateFareDisplay(sheetKey, nextTrainTimeStr) {
    fareContainer = document.getElementById('fare-container');
    fareAmount = document.getElementById('fare-amount');
    fareType = document.getElementById('fare-type');
    passengerTypeLabel = document.getElementById('passenger-type-label');

    if (!fareContainer) return;
    
    if (passengerTypeLabel) passengerTypeLabel.textContent = currentUserProfile;

    const fareData = getRouteFare(sheetKey, nextTrainTimeStr);

    if (fareData) {
        fareAmount.textContent = `R${fareData.price}`;
        
        if (fareData.isPromo) {
            fareType.textContent = "Discounted";
            fareType.className = "text-[10px] font-bold text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full mb-1";
            fareAmount.className = "text-xl font-black text-blue-600 dark:text-blue-400";
        } else if (fareData.isOffPeak) {
            fareType.textContent = "40% Off-Peak";
            fareType.className = "text-[10px] font-bold text-green-600 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full mb-1";
            fareAmount.className = "text-xl font-black text-green-600 dark:text-green-400";
        } else {
            fareType.textContent = "Standard";
            fareType.className = "text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full mb-1";
            fareAmount.className = "text-xl font-black text-gray-900 dark:text-white";
        }
        
        fareContainer.classList.remove('hidden');
    } else {
        fareContainer.classList.add('hidden');
    }
}

// --- USER PROFILE & UTILS ---
function showToast(message, type = 'info', duration = 3000) { if (toastTimeout) clearTimeout(toastTimeout); toast.textContent = message; toast.className = `toast-info`; if (type === 'success') toast.classList.add('toast-success'); else if (type === 'error') toast.classList.add('toast-error'); toast.classList.add('show'); toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, duration); }
function copyToClipboard(text) { const textArea = document.createElement('textarea'); textArea.value = text; textArea.style.position = "fixed"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { const successful = document.execCommand('copy'); if (successful) showToast("Link copied to clipboard!", "success", 2000); } catch (err) {} document.body.removeChild(textArea); }

function loadUserProfile() {
    profileModal = document.getElementById('profile-modal');
    navProfileDisplay = document.getElementById('nav-profile-display');
    const savedProfile = localStorage.getItem('userProfile');
    
    if (savedProfile) {
        currentUserProfile = savedProfile;
        if(navProfileDisplay) navProfileDisplay.textContent = currentUserProfile;
    } else {
        if(profileModal) profileModal.classList.remove('hidden');
    }
}

window.selectProfile = function(profileType) {
    currentUserProfile = profileType;
    localStorage.setItem('userProfile', profileType);
    if(navProfileDisplay) navProfileDisplay.textContent = profileType;
    if(profileModal) profileModal.classList.add('hidden');
    showToast(`Profile set to: ${profileType}`, "success");
    findNextTrains(); 
};

window.resetProfile = function() {
    if(profileModal) profileModal.classList.remove('hidden');
    if(sidenav) {
        sidenav.classList.remove('open');
        sidenavOverlay.classList.remove('open');
        document.body.classList.remove('sidenav-open');
    }
};

function updatePinUI() {
    const savedDefault = localStorage.getItem('defaultRoute'); const isPinned = savedDefault === currentRouteId;
    if (isPinned) { pinOutline.classList.add('hidden'); pinFilled.classList.remove('hidden'); pinRouteBtn.title = "Unpin this route"; } else { pinOutline.classList.remove('hidden'); pinFilled.classList.add('hidden'); pinRouteBtn.title = "Pin this route as default"; }
    if (savedDefault && ROUTES[savedDefault]) { pinnedSection.classList.remove('hidden'); pinnedSection.innerHTML = `<li class="route-category mt-0 pt-0 text-blue-500 dark:text-blue-400">Pinned Route</li><li class="route-item"><a class="${savedDefault === currentRouteId ? 'active' : ''}" data-route-id="${savedDefault}"><span class="route-dot dot-green"></span>${ROUTES[savedDefault].name}</a></li>`; } else { pinnedSection.classList.add('hidden'); }
}

function updateSidebarActiveState() {
    if (!currentRouteId) return;
    const allLinks = document.querySelectorAll('#route-list a');
    allLinks.forEach(a => {
        if (a.dataset.routeId === currentRouteId) {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });
}

function updateLastUpdatedText() {
    if (!fullDatabase) return;
    
    let displayDate = fullDatabase.lastUpdated || "Unknown";
    const isValidDate = (d) => d && d !== "undefined" && d !== "null" && d.length > 5;

    if (currentDayType === 'weekday' || currentDayType === 'monday') { 
        if (schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) {
            displayDate = schedules.weekday_to_a.lastUpdated;
        }
    } else if (currentDayType === 'saturday') {
        if (schedules.saturday_to_a && isValidDate(schedules.saturday_to_a.lastUpdated)) {
             displayDate = schedules.saturday_to_a.lastUpdated;
        }
    } else if (currentDayType === 'sunday') {
         if (schedules.weekday_to_a && isValidDate(schedules.weekday_to_a.lastUpdated)) {
            displayDate = schedules.weekday_to_a.lastUpdated;
        }
    }

    displayDate = displayDate.replace(/^last updated[:\s-]*/i, '').trim();

    if (displayDate && lastUpdatedEl) {
         lastUpdatedEl.textContent = `Schedule Effective from: ${displayDate}`;
    }
}

// --- CLOCK & INIT ---
function startClock() { updateTime(); setInterval(updateTime, 1000); }

function updateTime() {
    try {
        let day, timeString;
        let dateToCheck = null; 

        if (isSimMode) {
            day = parseInt(simDayIndex);
            timeString = simTimeStr; 
            
            // SIM MODE: Construct local date from input value to enable holiday check
            const dateInput = document.getElementById('sim-date');
            if (dateInput && dateInput.value) {
                // Parse "YYYY-MM-DD" as local time components to avoid UTC shifts
                const parts = dateInput.value.split('-');
                if(parts.length === 3) {
                    dateToCheck = new Date(parts[0], parts[1] - 1, parts[2]);
                }
            } 
        } else {
            const now = new Date();
            day = now.getDay(); 
            timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
            dateToCheck = now;
        }

        currentTime = timeString; 
        
        if(currentTimeEl) currentTimeEl.textContent = `Current Time: ${timeString} ${isSimMode ? '(SIM)' : ''}`;
        
        let newDayType = (day === 0) ? 'sunday' : (day === 6 ? 'saturday' : 'weekday');
        let specialStatusText = "";

        // Check for holidays (Now works in Sim Mode too!)
        if (dateToCheck) {
            var m = pad(dateToCheck.getMonth() + 1);
            var d = pad(dateToCheck.getDate());
            var dateKey = m + "-" + d;

            if (SPECIAL_DATES[dateKey]) {
                newDayType = SPECIAL_DATES[dateKey];
                
                // Use Specific Name if available, otherwise generic
                if (HOLIDAY_NAMES[dateKey]) {
                    // We'll construct a custom display string below
                    specialStatusText = " (Holiday)"; 
                } else {
                    specialStatusText = " (Holiday Schedule)";
                }
            }
        }
        
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        
        if (newDayType !== currentDayType) {
             currentDayType = newDayType;
             currentDayIndex = day; 
             updateLastUpdatedText(); 
        } else {
             currentDayIndex = day;
        }
        
        let displayType = "";
        if (newDayType === 'sunday') displayType = "No Service";
        else if (newDayType === 'saturday') displayType = "Saturday Schedule";
        else displayType = "Weekday Schedule";

        // OVERRIDE FOR NAMED HOLIDAYS
        if (dateToCheck) {
            var m = pad(dateToCheck.getMonth() + 1);
            var d = pad(dateToCheck.getDate());
            var dateKey = m + "-" + d;
            
            if (HOLIDAY_NAMES[dateKey]) {
                // E.g. "Workers' Day Schedule" replacing "Saturday Schedule"
                displayType = `${HOLIDAY_NAMES[dateKey]} Schedule`;
                specialStatusText = ""; // Clear redundant text
            }
        }

        // --- SPECIFIC DATE OVERRIDES (Dec 2025 / Jan 2026) ---
        if (!isSimMode && dateToCheck) {
            const d = dateToCheck.getDate();
            const m = dateToCheck.getMonth(); 
            const y = dateToCheck.getFullYear();

            if (y === 2025 && m === 11 && (d === 30 || d === 31)) {
                displayType = "Scaled-Down Weekday Schedule";
                specialStatusText = ""; 
            }
            else if (y === 2026 && m === 0 && d === 1) {
                displayType = "New Year's Day Schedule";
                specialStatusText = "";
            }
            else if (y === 2026 && m === 0 && d === 2) {
                displayType = "Scaled-Down Weekday Schedule";
                specialStatusText = "";
            }
        }

        if(currentDayEl) currentDayEl.innerHTML = `${dayNames[day]} <span class="font-bold text-blue-600 dark:text-blue-400">${displayType}</span>${specialStatusText}`;
        
        const plannerDaySelect = document.getElementById('planner-day-select');
        if (plannerDaySelect) {
            if (!selectedPlannerDay) {
                plannerDaySelect.value = currentDayType;
                selectedPlannerDay = currentDayType;
            }
        }

        findNextTrains();
    } catch(e) {
        console.error("Error in updateTime", e);
    }
}

// --- NEW: URL SHORTCUT HANDLER ---
function handleShortcutActions() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'planner') {
        // Force Switch to Planner Tab
        switchTab('trip-planner');
        
        // Clean URL so refresh doesn't stick
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
        
    } else if (action === 'map') {
        // Open Map Modal
        if (typeof setupMapLogic === 'function') {
            const mapModal = document.getElementById('map-modal');
            if (mapModal) {
                mapModal.classList.remove('hidden');
                // Reset map zoom/pan if needed
                const mapImage = document.getElementById('map-image');
                if(mapImage) mapImage.style.transform = `translate(0px, 0px) scale(1)`;
            }
        }
        // Clean URL
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
    }
}

function initializeApp() {
    loadUserProfile(); 
    populateStationList();
    
    if (typeof initPlanner === 'function') {
        initPlanner();
    }

    updateSidebarActiveState();

    startClock();
    findNextTrains(); 
    
    // --- CHECK FOR SHORTCUT ACTIONS ---
    handleShortcutActions();

    loadingOverlay.style.display = 'none';
    mainContent.style.display = 'block';
}

function populateStationList() {
    const stationSet = new Set();
    const hasTimes = (row) => { const keys = Object.keys(row); return keys.some(key => key !== 'STATION' && key !== 'COORDINATES' && key !== 'KM_MARK' && row[key] && row[key].trim() !== ""); };
    
    if (schedules.weekday_to_a && schedules.weekday_to_a.rows) schedules.weekday_to_a.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.weekday_to_b && schedules.weekday_to_b.rows) schedules.weekday_to_b.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.saturday_to_a && schedules.saturday_to_a.rows) schedules.saturday_to_a.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });
    if (schedules.saturday_to_b && schedules.saturday_to_b.rows) schedules.saturday_to_b.rows.forEach(row => { if (hasTimes(row)) stationSet.add(row.STATION); });

    allStations = Array.from(stationSet);
    if (schedules.weekday_to_a.rows) { const orderMap = schedules.weekday_to_a.rows.map(r => r.STATION); allStations.sort((a, b) => orderMap.indexOf(a) - orderMap.indexOf(b)); }
    
    const currentSelectedStation = stationSelect.value;
    
    stationSelect.innerHTML = '<option value="">Select a station...</option>';
    
    allStations.forEach(station => {
        if (station && !station.toLowerCase().includes('last updated')) {
            const option = document.createElement('option');
            option.value = station;
            option.textContent = station.replace(/ STATION/g, '');
            stationSelect.appendChild(option);
        }
    });
    if (allStations.includes(currentSelectedStation)) stationSelect.value = currentSelectedStation; else stationSelect.value = ""; 
}

function syncPlannerFromMain(stationName) {
    if (!stationName) return;
    const plannerInput = document.getElementById('planner-from-search');
    const plannerSelect = document.getElementById('planner-from');
    
    if (plannerInput && plannerSelect) {
        plannerSelect.value = stationName;
        plannerInput.value = stationName.replace(' STATION', '');
    }
}

function setupModalButtons() { 
    const closeAction = () => { scheduleModal.classList.add('hidden'); document.body.style.overflow = ''; }; 
    closeModalBtn.addEventListener('click', closeAction); 
    closeModalBtn2.addEventListener('click', closeAction); 
    scheduleModal.addEventListener('click', (e) => { if (e.target === scheduleModal) closeAction(); }); 
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    
    let targetBtn;
    if (tab === 'next-train') {
        targetBtn = document.getElementById('tab-next-train');
        document.getElementById('view-next-train').classList.add('active');
    } else {
        targetBtn = document.getElementById('tab-trip-planner');
        document.getElementById('view-trip-planner').classList.add('active');
    }
    
    if(targetBtn) {
        targetBtn.classList.add('active');
        moveTabIndicator(targetBtn);
    }
    
    // Logic: Do not save 'activeTab' if we are in a shortcut action (to avoid getting stuck there on reload)
    // But since handleShortcutActions cleans the URL, we are safe to save normally.
    localStorage.setItem('activeTab', tab);
}

function initTabIndicator() {
    const tabNext = document.getElementById('tab-next-train');
    if (!tabNext) return;
    
    const container = tabNext.parentElement;
    if (!container) return;
    
    container.classList.add('relative'); 

    let indicator = document.getElementById('tab-sliding-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'tab-sliding-indicator';
        indicator.className = "absolute bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-300 ease-out z-10";
        container.appendChild(indicator);
        
        const style = document.createElement('style');
        style.innerHTML = `
            .tab-btn { border-bottom-color: transparent !important; }
            .tab-btn.active { border-bottom-color: transparent !important; }
        `;
        document.head.appendChild(style);
    }

    const activeBtn = document.querySelector('.tab-btn.active') || tabNext;
    moveTabIndicator(activeBtn);

    window.addEventListener('resize', () => {
        const current = document.querySelector('.tab-btn.active');
        if (current) moveTabIndicator(current);
    });
}

function moveTabIndicator(element) {
    const indicator = document.getElementById('tab-sliding-indicator');
    if (!indicator || !element) return;
    
    indicator.style.width = `${element.offsetWidth}px`;
    indicator.style.transform = `translateX(${element.offsetLeft}px)`;
}

function setupSwipeNavigation() {
    let touchStartX = 0;
    let touchStartY = 0;
    const contentArea = document.getElementById('main-content');

    if (!contentArea) return;

    contentArea.addEventListener('touchstart', (e) => {
        if (document.body.classList.contains('sidenav-open') || 
            !document.getElementById('map-modal').classList.contains('hidden') ||
            !document.getElementById('schedule-modal').classList.contains('hidden') ||
            !document.getElementById('about-modal').classList.contains('hidden')) { // Block swipe if About is open
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});

    contentArea.addEventListener('touchend', (e) => {
        if (document.body.classList.contains('sidenav-open') || 
            !document.getElementById('map-modal').classList.contains('hidden') ||
            !document.getElementById('schedule-modal').classList.contains('hidden') ||
            !document.getElementById('about-modal').classList.contains('hidden')) { // Block swipe if About is open
            return;
        }

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
    }, {passive: true});
}

function handleSwipe(startX, endX, startY, endY) {
    const minSwipeDistance = 75;
    const maxVerticalVariance = 50; 

    const distX = startX - endX;
    const distY = Math.abs(startY - endY);

    if (distY > maxVerticalVariance) return;

    if (Math.abs(distX) > minSwipeDistance) {
        if (distX > 0) {
            switchTab('trip-planner');
        } else {
            switchTab('next-train');
        }
    }
}

// UPDATED: Modal now supports dynamic Day Override for "Check Monday" feature
window.openScheduleModal = function(destination, dayOverride = null) {
    
    let journeys = [];
    let titleSuffix = "";

    // 1. Determine Journey Data Source
    if (dayOverride === 'weekday') {
        // Dynamic fetch for Monday (Weekday) override
        const currentRoute = ROUTES[currentRouteId];
        const sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b';
        const schedule = schedules[sheetKey];
        if (schedule) {
            // Re-run logic for Weekday
            if (destination === currentRoute.destA) {
                journeys = findNextJourneyToDestA(stationSelect.value, "00:00:00", schedule, currentRoute).allJourneys;
            } else {
                journeys = findNextJourneyToDestB(stationSelect.value, "00:00:00", schedule, currentRoute).allJourneys;
            }
            titleSuffix = " (Monday/Weekday)";
        }
    } else {
        // Default: Use pre-calculated current day data
        if (!currentScheduleData || !currentScheduleData[destination]) { 
            showToast("No full schedule data available.", "error"); 
            return; 
        }
        journeys = currentScheduleData[destination]; 
    }

    if (!journeys || journeys.length === 0) {
        showToast("No trains found for this schedule.", "error");
        return;
    }

    modalTitle.textContent = `Schedule to ${destination.replace(' STATION', '')}${titleSuffix}`; 
    modalList.innerHTML = '';
    const nowSeconds = timeToSeconds(currentTime);
    let firstNextTrainFound = false;

    journeys.forEach(j => {
        const dep = j.departureTime || j.train1.departureTime; 
        const trainName = j.train || j.train1.train; 
        const type = j.type === 'transfer' ? 'Transfer' : 'Direct';
        const depSeconds = timeToSeconds(dep);
        
        // If overriding, everything is in the future relative to "Now" logic, 
        // unless we want to highlight "past" trains of a theoretical day. 
        // For Monday Preview, we treat all as valid list.
        let isPassed = false;
        if (!dayOverride) {
            isPassed = depSeconds < nowSeconds;
        }

        let divClass = "p-3 rounded shadow-sm flex justify-between items-center transition-opacity duration-300";
        if (isPassed) {
            divClass += " bg-gray-50 dark:bg-gray-800 opacity-50 grayscale"; 
        } else {
            divClass += " bg-white dark:bg-gray-700"; 
        }

        const div = document.createElement('div'); 
        div.className = divClass;
        
        // Marker for scrolling
        if (!isPassed && !firstNextTrainFound && !dayOverride) {
            div.id = "next-train-marker";
            firstNextTrainFound = true;
        }

        let modalTag = "";
        if (j.isShared && j.sourceRoute) {
             const routeName = j.sourceRoute.replace("Pretoria <-> ", "").replace("Route", "").trim();
             if (j.isDivergent) {
                 modalTag = `<span class="text-[9px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-200 dark:border-red-800">⚠️ To ${j.actualDestName}</span>`;
             } else {
                 modalTag = `<span class="text-[9px] font-bold text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900 px-1.5 py-0.5 rounded uppercase ml-2">From ${routeName}</span>`;
             }
        }

        const formattedDep = formatTimeDisplay(dep);
        
        div.innerHTML = `<div><span class="text-lg font-bold text-gray-900 dark:text-white">${formattedDep}</span><div class="text-xs text-gray-500 dark:text-gray-400">Train ${trainName} ${modalTag}</div></div><div class="flex flex-col items-end gap-1">${type === 'Direct' ? '<span class="text-[10px] font-bold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900 px-2 py-0.5 rounded-full uppercase">Direct</span>' : `<span class="text-[10px] font-bold text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900 px-2 py-0.5 rounded-full uppercase">Transfer @ ${j.train1.terminationStation.replace(' STATION','')}</span>`} ${j.isLastTrain ? '<span class="text-[10px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-2 py-0.5 rounded-full uppercase border border-red-200 dark:border-red-800">LAST TRAIN</span>' : ''}</div>`;
        modalList.appendChild(div);
    });
    
    scheduleModal.classList.remove('hidden'); 
    document.body.style.overflow = 'hidden'; 
    
    if (!dayOverride) {
        setTimeout(() => {
            const target = document.getElementById('next-train-marker');
            if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 10);
    } else {
        // Scroll to top for Monday preview
        const container = document.getElementById('modal-list');
        if(container) container.scrollTop = 0;
    }
};

function setupRedirectLogic() {
    feedbackBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        showRedirectModal("https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform", "Open Google Form to send feedback?"); 
    }); 
}

function showRedirectModal(url, message) {
    redirectMessage.textContent = message;
    redirectModal.classList.remove('hidden');
    const confirmHandler = () => { window.open(url, '_blank'); redirectModal.classList.add('hidden'); cleanup(); };
    const cancelHandler = () => { redirectModal.classList.add('hidden'); cleanup(); };
    const cleanup = () => { redirectConfirmBtn.removeEventListener('click', confirmHandler); redirectCancelBtn.removeEventListener('click', cancelHandler); };
    redirectConfirmBtn.addEventListener('click', confirmHandler);
    redirectCancelBtn.addEventListener('click', cancelHandler);
}

function setupFeatureButtons() {
    if (localStorage.theme === 'light') { document.documentElement.classList.remove('dark'); darkIcon.classList.add('hidden'); lightIcon.classList.remove('hidden'); } 
    else { localStorage.theme = 'dark'; document.documentElement.classList.add('dark'); darkIcon.classList.remove('hidden'); lightIcon.classList.add('hidden'); }
    themeToggleBtn.addEventListener('click', () => { if (localStorage.theme === 'dark') { localStorage.theme = 'light'; document.documentElement.classList.remove('dark'); darkIcon.classList.add('hidden'); lightIcon.classList.remove('hidden'); } else { localStorage.theme = 'dark'; document.documentElement.classList.add('dark'); darkIcon.classList.remove('hidden'); lightIcon.classList.add('hidden'); } });
    shareBtn.addEventListener('click', async () => { const shareData = { title: 'Metrorail Next Train', text: 'Say Goodbye to Waiting\nUse Next Train to check when your train is due to arrive:', url: '\n\nhttps://nexttrain.co.za' }; try { if (navigator.share) await navigator.share(shareData); else copyToClipboard(shareData.text + shareData.url); } catch (err) { copyToClipboard(shareData.text + shareData.url); } });
    
    installBtn = document.getElementById('install-app-btn');
    
    const showInstallButton = () => {
        if (installBtn) {
            installBtn.classList.remove('hidden');
        }
    };

    if (window.deferredInstallPrompt) {
        console.log("Found trapped install event from HEAD");
        showInstallButton();
    } 
    else {
        window.addEventListener('pwa-install-ready', () => {
            console.log("Received custom install ready event");
            showInstallButton();
        });
    }
    
    if (installBtn) {
        installBtn.addEventListener('click', () => { 
            // ANALYTICS: Track Install Click
            trackAnalyticsEvent('install_app_click', { location: 'main_view' });
            
            installBtn.classList.add('hidden'); 
            const promptEvent = window.deferredInstallPrompt;
            if (promptEvent) {
                promptEvent.prompt(); 
                promptEvent.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the install prompt');
                        trackAnalyticsEvent('install_app_accepted');
                    } else {
                        console.log('User dismissed the install prompt');
                        trackAnalyticsEvent('install_app_dismissed');
                    }
                    window.deferredInstallPrompt = null;
                });
            }
        }); 
    }

    const openNav = () => { sidenav.classList.add('open'); sidenavOverlay.classList.add('open'); document.body.classList.add('sidenav-open'); };
    openNavBtn.addEventListener('click', openNav); routeSubtitle.addEventListener('click', openNav);
    const closeNav = () => { sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open'); };
    closeNavBtn.addEventListener('click', closeNav); sidenavOverlay.addEventListener('click', closeNav);
    
    routeList.addEventListener('click', (e) => { 
        const routeLink = e.target.closest('a'); 
        if (routeLink && routeLink.dataset.routeId) { 
            const routeId = routeLink.dataset.routeId; 
            if (routeId === currentRouteId) { 
                showToast("You are already viewing this route.", "info", 1500); 
                closeNav(); 
                return; 
            } 
            currentRouteId = routeId;
            updateSidebarActiveState(); 
            closeNav(); 
            loadAllSchedules(); 
        } 
    });
    
    forceReloadBtn.addEventListener('click', () => { showToast("Forcing schedule reload...", "info", 2000); loadAllSchedules(true); });
    pinRouteBtn.addEventListener('click', () => { const savedDefault = localStorage.getItem('defaultRoute'); if (savedDefault === currentRouteId) { localStorage.removeItem('defaultRoute'); showToast("Route unpinned from top.", "info", 2000); } else { localStorage.setItem('defaultRoute', currentRouteId); showToast("Route pinned to top of menu!", "success", 2000); } updatePinUI(); });
}

function showWelcomeScreen() {
    if (!welcomeModal || !welcomeRouteList) return;
    
    welcomeRouteList.innerHTML = "";
    
    Object.values(ROUTES).forEach(route => {
        if (!route.isActive) return;

        const btn = document.createElement('button');
        btn.className = `w-full text-left p-4 rounded-xl shadow-md flex items-center justify-between group transition-all transform hover:scale-[1.02] active:scale-95 bg-white dark:bg-gray-800 border-l-4`;
        
        if(route.colorClass.includes('orange')) btn.classList.add('border-orange-500');
        else if(route.colorClass.includes('purple')) btn.classList.add('border-purple-500');
        else if(route.colorClass.includes('green')) btn.classList.add('border-green-500');
        else if(route.colorClass.includes('blue')) btn.classList.add('border-blue-500');
        else btn.classList.add('border-gray-500');

        btn.innerHTML = `
            <div>
                <span class="block text-sm font-bold text-gray-900 dark:text-white">${route.name}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">View schedules</span>
            </div>
            <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
        `;

        btn.onclick = () => {
            selectWelcomeRoute(route.id);
        };

        welcomeRouteList.appendChild(btn);
    });

    welcomeModal.classList.remove('hidden');
}

function selectWelcomeRoute(routeId) {
    currentRouteId = routeId;
    localStorage.setItem('defaultRoute', routeId);
    welcomeModal.classList.add('opacity-0'); 
    setTimeout(() => {
        welcomeModal.classList.add('hidden');
        welcomeModal.classList.remove('opacity-0');
        updateSidebarActiveState();
        updatePinUI();
        loadAllSchedules();
    }, 300);
}

window.openLegal = function(type) {
    // ANALYTICS: Track Legal View
    trackAnalyticsEvent('view_legal_doc', { type: type });

    legalTitle.textContent = type === 'terms' ? 'Terms of Use' : 'Privacy Policy';
    legalContent.innerHTML = LEGAL_TEXTS[type];
    legalModal.classList.remove('hidden');
    sidenav.classList.remove('open');
    sidenavOverlay.classList.remove('open');
    document.body.classList.remove('sidenav-open');
};

function closeLegal() {
    legalModal.classList.add('hidden');
}

// --- SERVICE WORKER UPDATE HANDLING & REGISTRATION ---
let newWorker;

function showUpdateToast(worker) {
    // Check if toast already exists
    if (document.getElementById('update-toast')) return;

    const updateToastHTML = `
        <div id="update-toast" class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center space-x-3 z-50 cursor-pointer border border-gray-700 hover:scale-105 transition-transform" onclick="window.location.reload()">
            <div class="bg-blue-600 rounded-full p-1 animate-pulse">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15"></path></svg>
            </div>
            <div class="flex flex-col">
                <span class="text-sm font-bold">New Schedule Available</span>
                <span class="text-xs text-gray-400">Tap to Refresh</span>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = updateToastHTML;
    document.body.appendChild(div.firstElementChild);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then(reg => {
            console.log('SW registered:', reg);

            // Check if there's a waiting worker (update ready)
            if (reg.waiting) {
                showUpdateToast(reg.waiting);
                return;
            }

            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateToast(newWorker);
                    }
                });
            });
        }).catch(err => console.error('SW reg failed:', err));
        
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    });
}

// --- INITIALIZATION (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    stationSelect = document.getElementById('station-select');
    locateBtn = document.getElementById('locate-btn');
    pretoriaTimeEl = document.getElementById('pretoria-time');
    pienaarspoortTimeEl = document.getElementById('pienaarspoort-time');
    pretoriaHeader = document.getElementById('pretoria-header');
    pienaarspoortHeader = document.getElementById('pienaarspoort-header');
    currentTimeEl = document.getElementById('current-time');
    currentDayEl = document.getElementById('current-day');
    loadingOverlay = document.getElementById('loading-overlay');
    mainContent = document.getElementById('main-content');
    offlineIndicator = document.getElementById('offline-indicator');
    scheduleModal = document.getElementById('schedule-modal');
    modalTitle = document.getElementById('modal-title');
    modalList = document.getElementById('modal-list');
    closeModalBtn = document.getElementById('close-modal-btn');
    closeModalBtn2 = document.getElementById('close-modal-btn-2');
    redirectModal = document.getElementById('redirect-modal');
    redirectMessage = document.getElementById('redirect-message');
    redirectConfirmBtn = document.getElementById('redirect-confirm-btn');
    redirectCancelBtn = document.getElementById('redirect-cancel-btn');
    themeToggleBtn = document.getElementById('theme-toggle-btn');
    darkIcon = document.getElementById('theme-toggle-dark-icon');
    lightIcon = document.getElementById('theme-toggle-light-icon');
    shareBtn = document.getElementById('share-app-btn');
    installBtn = document.getElementById('install-app-btn');
    forceReloadBtn = document.getElementById('force-reload-btn');
    pinRouteBtn = document.getElementById('pin-route-btn');
    pinOutline = document.getElementById('pin-outline');
    pinFilled = document.getElementById('pin-filled');
    openNavBtn = document.getElementById('open-nav-btn');
    closeNavBtn = document.getElementById('close-nav-btn');
    sidenav = document.getElementById('sidenav');
    sidenavOverlay = document.getElementById('sidenav-overlay');
    routeList = document.getElementById('route-list');
    routeSubtitle = document.getElementById('route-subtitle');
    routeSubtitleText = document.getElementById('route-subtitle-text');
    pinnedSection = document.getElementById('pinned-section');
    toast = document.getElementById('toast');
    checkUpdatesBtn = document.getElementById('check-updates-btn');
    feedbackBtn = document.getElementById('feedback-btn');
    lastUpdatedEl = document.getElementById('last-updated-date');

    simPanel = document.getElementById('sim-panel');
    simEnabledCheckbox = document.getElementById('sim-enabled');
    simTimeInput = document.getElementById('sim-time');
    simDaySelect = document.getElementById('sim-day');
    simApplyBtn = document.getElementById('sim-apply-btn');
    appTitle = document.getElementById('app-title');
    pinModal = document.getElementById('pin-modal');
    pinInput = document.getElementById('pin-input');
    pinCancelBtn = document.getElementById('pin-cancel-btn');
    pinSubmitBtn = document.getElementById('pin-submit-btn');
    legalModal = document.getElementById('legal-modal');
    legalTitle = document.getElementById('legal-modal-title');
    legalContent = document.getElementById('legal-modal-content');
    closeLegalBtn = document.getElementById('close-legal-btn');
    closeLegalBtn2 = document.getElementById('close-legal-btn-2');

    welcomeModal = document.getElementById('welcome-modal');
    welcomeRouteList = document.getElementById('welcome-route-list');

    closeLegalBtn.addEventListener('click', closeLegal);
    closeLegalBtn2.addEventListener('click', closeLegal);
    legalModal.addEventListener('click', (e) => { if (e.target === legalModal) closeLegal(); });
    
    document.getElementById('tab-next-train').addEventListener('click', () => switchTab('next-train'));
    document.getElementById('tab-trip-planner').addEventListener('click', () => switchTab('trip-planner'));

    // --- V4.44.1: INJECT VERSION NUMBER ---
    const versionFooter = document.getElementById('app-version-footer');
    if (versionFooter && typeof APP_VERSION !== 'undefined') {
        versionFooter.textContent = APP_VERSION;
    }

    // --- NEW: ABOUT & HELP MODAL WIRING ---
    const helpModal = document.getElementById('help-modal');
    const openHelpBtn = document.getElementById('open-help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const closeHelpBtn2 = document.getElementById('close-help-btn-2');
    
    const aboutModal = document.getElementById('about-modal');
    const openAboutBtn = document.getElementById('open-about-btn');
    const closeAboutBtn = document.getElementById('close-about-btn');

    const closeSideNav = () => {
        if(sidenav) {
            sidenav.classList.remove('open');
            sidenavOverlay.classList.remove('open');
            document.body.classList.remove('sidenav-open');
        }
    };

    const openHelp = () => {
        trackAnalyticsEvent('view_user_guide', { location: 'sidebar' });
        if(helpModal) helpModal.classList.remove('hidden');
        closeSideNav();
    };
    
    const closeHelp = () => {
        if(helpModal) helpModal.classList.add('hidden');
    };
    
    const openAbout = () => {
        trackAnalyticsEvent('view_about_page', { location: 'sidebar' });
        if(aboutModal) aboutModal.classList.remove('hidden');
        closeSideNav();
    };

    const closeAbout = () => {
        if(aboutModal) aboutModal.classList.add('hidden');
    };
    
    if(openHelpBtn) openHelpBtn.addEventListener('click', openHelp);
    if(closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
    if(closeHelpBtn2) closeHelpBtn2.addEventListener('click', closeHelp);
    if(helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

    if(openAboutBtn) openAboutBtn.addEventListener('click', openAbout);
    if(closeAboutBtn) closeAboutBtn.addEventListener('click', closeAbout);
    if(aboutModal) aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) closeAbout(); });

    locateBtn.addEventListener('click', () => {
        // ANALYTICS: Track Auto-Locate Click
        trackAnalyticsEvent('click_auto_locate', { location: 'home_header' });
        findNearestStation(false);
    });
    
    // ANALYTICS: Network Map Button
    const viewMapBtn = document.getElementById('view-map-btn');
    if (viewMapBtn) {
        viewMapBtn.addEventListener('click', () => {
            trackAnalyticsEvent('click_network_map', { location: 'sidebar' });
            // The button likely opens via href or separate map.js logic, but tracking happens here.
        });
    }
    
    if (appTitle) {
        let localClickCount = 0; 
        let localClickTimer = null;
        
        appTitle.style.cursor = 'pointer'; 
        appTitle.title = "Developer Access (Tap 5 times)";

        appTitle.addEventListener('click', (e) => {
            e.preventDefault(); 
            localClickCount++;
            
            if (localClickTimer) clearTimeout(localClickTimer);
            localClickTimer = setTimeout(() => { localClickCount = 0; }, 2000); 
            
            if (localClickCount >= 5) {
                localClickCount = 0;
                // NEW: Open the Global Dev Modal (#dev-modal) instead of PIN modal
                const devModal = document.getElementById('dev-modal');
                const devPinModal = document.getElementById('pin-modal');
                
                // AUTO-FILL CURRENT TIME (Pre-calculation)
                const now = new Date();
                const timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());

                if (isSimMode) {
                    // SESSION PERSISTENCE: Bypass PIN if already in simulation mode
                    if (devModal) devModal.classList.remove('hidden');
                    showToast("Developer Session Active", "info");
                } else {
                    // NEW SESSION: Require PIN & Auto-fill time
                    if(simTimeInput) simTimeInput.value = timeString;
                    if (devPinModal) {
                        devPinModal.classList.remove('hidden');
                        if(pinInput) { pinInput.value = ''; pinInput.focus(); }
                    }
                }
            }
        });
    }

    pinCancelBtn.addEventListener('click', () => { pinModal.classList.add('hidden'); });
    
    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            pinSubmitBtn.click();
        }
    });

    pinSubmitBtn.addEventListener('click', () => {
        if (pinInput.value === "101101") {
            pinModal.classList.add('hidden');
            const devModal = document.getElementById('dev-modal');
            
            // AUTO-FILL CURRENT TIME (Redundant safety check)
            const now = new Date();
            const timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
            if(simTimeInput) simTimeInput.value = timeString;

            if (devModal) devModal.classList.remove('hidden');
            showToast("Developer Mode Unlocked!", "success");
        } else {
            showToast("Invalid PIN", "error");
            pinInput.value = '';
        }
    });

    // --- TOGGLE DATE PICKER VISIBILITY ---
    const dayDropdown = document.getElementById('sim-day');
    const dateContainer = document.getElementById('sim-date-container');
    const dateInput = document.getElementById('sim-date');

    if (dayDropdown && dateContainer && dateInput) {
        dayDropdown.addEventListener('change', () => {
            if (dayDropdown.value === 'specific') {
                dateContainer.classList.remove('hidden');
                dateInput.focus();
            } else {
                dateContainer.classList.add('hidden');
                // Removed dateInput.value = '' to persist date selection
            }
        });
    }

    // --- UPDATED SIMULATION APPLY LOGIC ---
    if (simApplyBtn) {
        simApplyBtn.addEventListener('click', () => {
            if (!simEnabledCheckbox || !simTimeInput) return;

            isSimMode = simEnabledCheckbox.checked;
            simTimeStr = simTimeInput.value + ":00";
            
            // Logic: Check Dropdown Value First
            if (dayDropdown && dayDropdown.value === 'specific') {
                // If specific date is chosen, validate input
                if (dateInput && dateInput.value) {
                    const d = new Date(dateInput.value);
                    simDayIndex = d.getDay(); // 0-6
                    showToast(`Simulating specific date: ${dateInput.value}`, "info");
                } else {
                    showToast("Please select a valid date.", "error");
                    return;
                }
            } else if (dayDropdown) {
                // Use generic day value
                simDayIndex = parseInt(dayDropdown.value);
            } else {
                simDayIndex = 1; // Default fallback
            }

            if (isSimMode && !simTimeInput.value) { 
                showToast("Please enter a time first!", "error"); 
                return; 
            }
            
            showToast(isSimMode ? "Dev Simulation Active!" : "Real-time Mode Active", "success");
            
            // NEW: Minimize Modal on Apply (UX Requirement)
            const devModal = document.getElementById('dev-modal');
            if(devModal) devModal.classList.add('hidden');
            
            // Force immediate update
            updateTime(); 
            findNextTrains();
        });
    }

    // --- NEW: SIMULATION EXIT LOGIC ---
    const simExitBtn = document.getElementById('sim-exit-btn');
    if (simExitBtn) {
        simExitBtn.addEventListener('click', () => {
            isSimMode = false;
            
            // Reset UI Controls
            if(simEnabledCheckbox) simEnabledCheckbox.checked = false;
            if(simTimeInput) simTimeInput.value = '';
            
            if(dayDropdown) dayDropdown.value = '1'; // Reset to Monday
            if(dateContainer) dateContainer.classList.add('hidden');
            if(dateInput) dateInput.value = '';
            
            // Close Modal
            const devModal = document.getElementById('dev-modal');
            if(devModal) devModal.classList.add('hidden');
            
            showToast("Exited Developer Mode", "info");
            
            // Force Real-Time Update
            updateTime();
            findNextTrains();
        });
    }

    stationSelect.addEventListener('change', () => {
        syncPlannerFromMain(stationSelect.value);
        findNextTrains();
    });
    
    setupFeatureButtons(); updatePinUI(); setupModalButtons(); setupRedirectLogic(); startSmartRefresh();
    setupSwipeNavigation(); 
    initTabIndicator(); 
    
    if (typeof setupMapLogic === 'function') {
        setupMapLogic(); 
    }

    const savedDefault = localStorage.getItem('defaultRoute');
    
    if (savedDefault && ROUTES[savedDefault]) {
        currentRouteId = savedDefault;
        loadAllSchedules().then(() => {
            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
                    if (result.state === 'granted') {
                        console.log("Location permission already granted. Auto-locating...");
                        findNearestStation(true);
                    }
                });
            }
        });
    } else {
        console.log("First time user (or no pinned route). Showing Welcome Screen.");
        loadingOverlay.style.display = 'none';
        showWelcomeScreen();
    }

    // --- RESTORE ACTIVE TAB (Updated for URL Shortcuts) ---
    // If URL has action, do not restore previous tab, respect the action.
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('action')) {
        console.log("Shortcut action detected, ignoring saved tab preference.");
    } else {
        const lastActiveTab = localStorage.getItem('activeTab');
        if (lastActiveTab) {
            switchTab(lastActiveTab);
        } else {
            switchTab('next-train');
        }
    }
});