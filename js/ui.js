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

// --- RENDERING FUNCTIONS ---

// NEW: Skeleton Loader for Schedule Cards
function renderSkeletonLoader(element) {
    // Exact height match for h-32 cards
    element.innerHTML = `
        <div class="flex flex-row items-center w-full space-x-3 h-32 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-2">
            <!-- Left Time Box Skeleton -->
            <div class="relative w-1/2 h-full bg-gray-300 dark:bg-gray-700 rounded-lg shadow-sm flex-shrink-0"></div>
            
            <!-- Right Info Skeleton -->
            <div class="w-1/2 flex flex-col justify-center items-center space-y-3">
                <div class="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                <div class="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                <div class="h-6 bg-gray-300 dark:bg-gray-700 rounded w-full mt-2"></div>
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

function renderPlaceholder() {
    const placeholderHTML = `<div class="h-32 flex flex-col justify-center items-center text-gray-400 dark:text-gray-500"><svg class="w-8 h-8 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><span class="text-sm font-medium">Select a station above</span></div>`;
    pretoriaTimeEl.innerHTML = placeholderHTML;
    pienaarspoortTimeEl.innerHTML = placeholderHTML;
    if(fareContainer) fareContainer.classList.add('hidden'); // Hide fare box
}

function renderRouteError(error) {
    const html = `<div class="text-center p-4 bg-red-100 dark:bg-red-900 rounded-md border border-red-400 dark:border-red-700"><div class="text-2xl mb-2">⚠️</div><p class="text-red-800 dark:text-red-200 font-medium">Connection failed. Please check internet.</p></div>`;
    pretoriaTimeEl.innerHTML = html; pienaarspoortTimeEl.innerHTML = html; stationSelect.innerHTML = '<option>Unable to load stations</option>';
}

function renderComingSoon(routeName) {
    const msg = `<div class="h-32 flex flex-col justify-center items-center text-center p-6 bg-yellow-100 dark:bg-yellow-900 rounded-lg"><h3 class="text-xl font-bold text-yellow-700 dark:text-yellow-300 mb-2">🚧 Coming Soon</h3><p class="text-gray-700 dark:text-gray-300">We are working on the <strong>${routeName}</strong> schedule.</p></div>`;
    pretoriaTimeEl.innerHTML = msg; pienaarspoortTimeEl.innerHTML = msg; stationSelect.innerHTML = '<option>Route not available</option>';
}

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
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    const firstTrain = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    let timeHTML = 'N/A';
    if (firstTrain) {
        // UPDATED: Use formatTimeDisplay
        const departureTime = formatTimeDisplay(firstTrain.departureTime || firstTrain.train1.departureTime);
        const timeDiffStr = calculateTimeDiffString(firstTrain.departureTime || firstTrain.train1.departureTime, 1); 
        timeHTML = `<div class="text-2xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-base text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div>`;
    }
    element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center w-full"><div class="text-xl font-bold text-gray-600 dark:text-gray-400">No service on Sundays/Holidays.</div><p class="text-sm text-gray-400 dark:text-gray-500 mt-2">First train next weekday is at:</p><div class="text-center p-3 bg-gray-200 dark:bg-gray-900 rounded-md transition-all mt-2 w-3/4">${timeHTML}</div></div>`;
}

function renderAtDestination(element) { element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-green-500 dark:text-green-400">You are at this station</div>`; }

function processAndRenderJourney(allJourneys, element, header, destination) {
    const nowInSeconds = timeToSeconds(currentTime);
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= nowInSeconds);
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
              element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No scheduled trains from this station today.</div>`;
              return;
        }
    }
    renderJourney(element, header, nextJourney, firstTrainName, destination);
}

function renderJourney(element, headerElement, journey, firstTrainName, destination) {
    element.innerHTML = "";
    if (!journey) { renderNextAvailableTrain(element, destination); return; }

    let timeClass = "bg-gray-200 dark:bg-gray-900";
    if (journey.isLastTrain) {
        timeClass = "bg-red-100 dark:bg-red-900 border-2 border-red-500";
    } else if (journey.isFirstTrain) {
        timeClass = "bg-green-100 dark:bg-green-900 border-2 border-green-500";
    }
    
    // UPDATED: Use formatTimeDisplay for the main card time
    const rawTime = journey.departureTime || journey.train1.departureTime;
    const safeDepTime = escapeHTML(formatTimeDisplay(rawTime));
    
    const safeTrainName = escapeHTML(journey.train || journey.train1.train);
    const safeDest = escapeHTML(destination);
    const timeDiffStr = calculateTimeDiffString(rawTime);
    const safeDestForClick = safeDest.replace(/'/g, "\\'"); 
    const buttonHtml = `<button onclick="openScheduleModal('${safeDestForClick}')" class="absolute bottom-0 left-0 w-full text-[10px] uppercase tracking-wide font-bold py-1 bg-black bg-opacity-10 hover:bg-opacity-20 dark:bg-white dark:bg-opacity-10 dark:hover:bg-opacity-20 rounded-b-md transition-colors truncate">See Full Schedule</button>`;

    // --- VISUAL TAG FOR SHARED TRAINS ---
    let sharedTag = "";
    if (journey.isShared && journey.sourceRoute) {
         const routeName = journey.sourceRoute.replace("Pretoria <-> ", "").replace("Route", "").trim();
         // SAFEGUARD: If divergent, use WARNING color
         if (journey.isDivergent) {
             sharedTag = `<span class="block text-[10px] uppercase font-bold text-red-600 dark:text-red-400 mt-1 bg-red-100 dark:bg-red-900 px-1 rounded w-fit mx-auto border border-red-300 dark:border-red-700">⚠️ To ${journey.actualDestName}</span>`;
         } else {
             sharedTag = `<span class="block text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 mt-1 bg-purple-100 dark:bg-purple-900 px-1 rounded w-fit mx-auto">From ${routeName}</span>`;
         }
    }

    if (journey.type === 'direct') {
        const actualDest = journey.actualDestination ? normalizeStationName(journey.actualDestination) : '';
        const normDest = normalizeStationName(destination);
        // UPDATED: Format arrival time if present
        let destinationText = journey.arrivalTime ? `Arrives ${escapeHTML(formatTimeDisplay(journey.arrivalTime))}` : "Arrival time not available.";
        if (actualDest && normDest && actualDest !== normDest) {
            destinationText = `Terminates at ${escapeHTML(journey.actualDestination.replace(/ STATION/g,''))}.`;
        }
        
        let trainTypeText = `<span class="font-bold text-yellow-600 dark:text-yellow-400">Direct train (${safeTrainName})</span>`;
        if (journey.isLastTrain) trainTypeText = `<span class="font-bold text-red-600 dark:text-red-400">Last Direct train (${safeTrainName})</span>`;

        element.innerHTML = `<div class="flex flex-row items-center w-full space-x-3"><div class="relative w-1/2 h-32 flex flex-col justify-center items-center text-center p-2 pb-6 ${timeClass} rounded-lg shadow-sm flex-shrink-0"><div class="text-3xl font-bold text-gray-900 dark:text-white">${safeDepTime}</div><div class="text-sm text-gray-700 dark:text-gray-300 font-medium mt-1">${timeDiffStr}</div>${sharedTag}${buttonHtml}</div><div class="w-1/2 flex flex-col justify-center items-center text-center space-y-1"><div class="text-sm text-gray-800 dark:text-gray-200 font-medium leading-tight">${trainTypeText}</div><div class="text-xs text-gray-500 dark:text-gray-400 leading-tight font-medium">${destinationText}</div></div></div>`;
    }

    if (journey.type === 'transfer') {
        const conn = journey.connection; 
        const nextFull = journey.nextFullJourney; 
        const termStation = escapeHTML(journey.train1.terminationStation.replace(/ STATION/g, ''));
        // UPDATED: Format arrival at transfer
        const arrivalAtTransfer = escapeHTML(formatTimeDisplay(journey.train1.arrivalAtTransfer));
        let train1Info = `Train ${safeTrainName} (Terminates at ${termStation} at ${arrivalAtTransfer})`;
        if (journey.isLastTrain) train1Info = `<span class="text-red-600 dark:text-red-400 font-bold">Last Train (${safeTrainName})</span> (Terminates at ${termStation})`;

        let connectionInfoHTML = "";
        if (nextFull) {
            const connTrain = escapeHTML(conn.train);
            const connDest = escapeHTML(conn.actualDestination.replace(/ STATION/g, ''));
            // UPDATED: Format connection times
            const connDep = escapeHTML(formatTimeDisplay(conn.departureTime));
            const nextTrain = escapeHTML(nextFull.train);
            const nextDest = escapeHTML(nextFull.actualDestination.replace(/ STATION/g, ''));
            const nextDep = escapeHTML(formatTimeDisplay(nextFull.departureTime));
            const connection1Text = `Connect to Train ${connTrain} (to ${connDest}) at <b>${connDep}</b>`;
            const connection2Text = `Next Train ${nextTrain} (to ${nextDest}) is at <b>${nextDep}</b>`;
            connectionInfoHTML = `<div class="space-y-1"><div class="text-yellow-600 dark:text-yellow-400 font-medium">${connection1Text}</div><div class="text-gray-500 dark:text-gray-400 text-xs font-medium">${connection2Text}</div></div>`;
        } else {
            const connTrain = escapeHTML(conn.train);
            // UPDATED: Format connection times
            const connDep = escapeHTML(formatTimeDisplay(conn.departureTime));
            const connArr = escapeHTML(formatTimeDisplay(conn.arrivalTime));
            let connDestName = `(Arrives ${connArr})`; 
            const connectionText = `Connect to Train ${connTrain} at <b>${connDep}</b> ${connDestName}`;
            connectionInfoHTML = `<div class="text-yellow-600 dark:text-yellow-400 font-medium">${connectionText}</div>`;
        }
        element.innerHTML = `<div class="flex flex-row items-center w-full space-x-3"><div class="relative w-1/2 h-32 flex flex-col justify-center items-center text-center p-2 pb-6 ${timeClass} rounded-lg shadow-sm flex-shrink-0"><div class="text-3xl font-bold text-gray-900 dark:text-white">${safeDepTime}</div><div class="text-sm text-gray-700 dark:text-gray-300 font-medium mt-1">${timeDiffStr}</div>${sharedTag}${buttonHtml}</div><div class="w-1/2 flex flex-col justify-center items-center text-center space-y-1"><div class="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Transfer Required</div><div class="text-xs text-yellow-600 dark:text-yellow-400 leading-tight font-medium">${train1Info}</div><div class="text-xs leading-tight">${connectionInfoHTML}</div></div></div>`;
    }
}

function renderNextAvailableTrain(element, destination) {
    const currentRoute = ROUTES[currentRouteId];
    let nextDayName = ""; let nextDaySheetKey = ""; let dayOffset = 1; 
    switch (currentDayIndex) {
        case 6: nextDayName = "Monday"; dayOffset = 2; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; break;
        case 5: nextDayName = "Saturday"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b'; break;
        default: nextDayName = "tomorrow"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; break;
    }
    const nextSchedule = schedules[nextDaySheetKey];
    if (!nextSchedule) { element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No schedule found for next service day.</div>`; return; }
    const selectedStation = stationSelect.value;
    let allJourneys = [];
    if (destination === currentRoute.destA) { const res = findNextJourneyToDestA(selectedStation, "00:00:00", nextSchedule, currentRoute); allJourneys = res.allJourneys; } 
    else { const res = findNextJourneyToDestB(selectedStation, "00:00:00", nextSchedule, currentRoute); allJourneys = res.allJourneys; }
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    const firstTrainOfNextDay = remainingJourneys.length > 0 ? remainingJourneys[0] : null;
    if (!firstTrainOfNextDay) { element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center text-xl font-bold text-gray-600 dark:text-gray-400">No trains found for ${nextDayName}.</div>`; return; }
    
    // UPDATED: Format next day time
    const rawTime = firstTrainOfNextDay.departureTime || firstTrainOfNextDay.train1.departureTime;
    const departureTime = formatTimeDisplay(rawTime);
    const timeDiffStr = calculateTimeDiffString(rawTime, dayOffset);
    element.innerHTML = `<div class="h-32 flex flex-col justify-center items-center w-full"><div class="text-lg font-bold text-gray-600 dark:text-gray-400">No more trains today</div><p class="text-sm text-gray-400 dark:text-gray-500 mt-2">First train ${nextDayName} is at:</p><div class="text-center p-3 bg-gray-200 dark:bg-gray-900 rounded-md transition-all mt-2 w-3/4"><div class="text-2xl font-bold text-gray-900 dark:text-white">${departureTime}</div><div class="text-base text-gray-700 dark:text-gray-300 font-medium">${timeDiffStr}</div></div></div>`;
}

// --- UPDATE FARE BOX LOGIC ---
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

// NEW FUNCTION: Force the side navigation to highlight the correct current route
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
         lastUpdatedEl.textContent = `Schedule updated: ${displayDate}`;
    }
}

// --- CLOCK & INIT ---
function startClock() { updateTime(); setInterval(updateTime, 1000); }

function updateTime() {
    try {
        let day, timeString, now;
        
        if (isSimMode) {
            day = parseInt(simDayIndex);
            timeString = simTimeStr; 
        } else {
            now = new Date();
            day = now.getDay(); 
            // NOTE: Keeping seconds here as requested by user
            timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
        }

        currentTime = timeString; 
        
        // --- UPDATED: Time Format "Current Time: HH:MM:SS" ---
        if(currentTimeEl) currentTimeEl.textContent = `Current Time: ${timeString} ${isSimMode ? '(SIM)' : ''}`;
        
        let newDayType = (day === 0) ? 'sunday' : (day === 6 ? 'saturday' : 'weekday');
        let specialStatusText = "";

        if (!isSimMode && now) {
            var m = pad(now.getMonth() + 1);
            var d = pad(now.getDate());
            var dateKey = m + "-" + d;

            if (SPECIAL_DATES[dateKey]) {
                newDayType = SPECIAL_DATES[dateKey];
                specialStatusText = " (Holiday Schedule)";
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

        // --- SPECIFIC DATE OVERRIDES (Dec 2025 / Jan 2026) ---
        // STRICTLY for header text modification as requested. 
        if (!isSimMode && now) {
            const d = now.getDate();
            const m = now.getMonth(); // 0-11
            const y = now.getFullYear();

            // 30 & 31 Dec 2025
            if (y === 2025 && m === 11 && (d === 30 || d === 31)) {
                displayType = "Scaled-Down Weekday Schedule";
                specialStatusText = ""; // Clear holiday text to match exact request
            }
            // 1 Jan 2026
            else if (y === 2026 && m === 0 && d === 1) {
                displayType = "New Year's Day Schedule";
                specialStatusText = "";
            }
            // 2 Jan 2026
            else if (y === 2026 && m === 0 && d === 2) {
                displayType = "Scaled-Down Weekday Schedule";
                specialStatusText = "";
            }
        }
        // -----------------------------------------------------

        if(currentDayEl) currentDayEl.innerHTML = `${dayNames[day]} <span class="font-bold text-blue-600 dark:text-blue-400">${displayType}</span>${specialStatusText}`;
        
        // --- NEW: Auto-update Planner Day Selector ---
        const plannerDaySelect = document.getElementById('planner-day-select');
        if (plannerDaySelect) {
            // Only update if not user-interacted or if we want forced sync (preferred for "Live" feel)
            // Or simpler: just ensure it defaults to current day if not set
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

function initializeApp() {
    loadUserProfile(); 
    populateStationList();
    
    // --- INIT PLANNER (New V3.51) ---
    if (typeof initPlanner === 'function') {
        initPlanner();
    }

    // NEW: Ensure Sidebar State is Correct on Startup
    updateSidebarActiveState();

    startClock();
    findNextTrains(); 
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
    
    // POPULATE HIDDEN SELECT
    stationSelect.innerHTML = '<option value="">Select a station...</option>';
    
    allStations.forEach(station => {
        if (station && !station.toLowerCase().includes('last updated')) {
            const option = document.createElement('option');
            option.value = station;
            option.textContent = station.replace(/ STATION/g, '');
            stationSelect.appendChild(option);
        }
    });
    
    if (allStations.includes(currentSelectedStation)) {
        stationSelect.value = currentSelectedStation; 
    } else {
        stationSelect.value = ""; 
    }

    // --- NEW: SYNC SEARCH INPUT (Search 2.0) ---
    const searchInput = document.getElementById('station-select-search');
    if (searchInput) {
        if (stationSelect.value) {
            searchInput.value = stationSelect.value.replace(' STATION', '');
        } else {
            searchInput.value = '';
        }
    }
}

// --- SYNC HELPER: Updates Planner from Main Select ---
function syncPlannerFromMain(stationName) {
    if (!stationName) return;
    const plannerInput = document.getElementById('planner-from-search');
    const plannerSelect = document.getElementById('planner-from');
    const mainInput = document.getElementById('station-select-search');
    
    // 1. Sync Planner Inputs
    if (plannerInput && plannerSelect) {
        plannerSelect.value = stationName;
        plannerInput.value = stationName.replace(' STATION', '');
    }

    // 2. Sync Main Search Input (New for Search 2.0)
    // Only update if it doesn't match, to avoid overwriting user typing if focused? 
    // Actually, force sync is good when coming from Auto-Locate.
    if (mainInput) {
        mainInput.value = stationName.replace(' STATION', '');
    }
}

// --- MAIN SEARCH 2.0 LOGIC ---
function setupMainAutocomplete() {
    const input = document.getElementById('station-select-search');
    const select = document.getElementById('station-select');
    if (!input || !select) return;

    if (input.parentNode) {
        input.parentNode.style.position = 'relative';
    }

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
        
        // Use allStations (Current Route) instead of Master List
        let matches = [];
        if (val.length === 0) {
            matches = allStations;
        } else {
            matches = allStations.filter(s => s.includes(val));
        }

        if (matches.length === 0) {
            const li = document.createElement('li');
            li.className = "p-3 text-sm text-gray-400 italic";
            li.textContent = "No stations on this route";
            list.appendChild(li);
        } else {
            matches.forEach(station => {
                // Filter out metadata rows just in case
                if (station.toLowerCase().includes('last updated')) return;

                const li = document.createElement('li');
                li.className = "p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors";
                li.textContent = station.replace(' STATION', '');
                
                li.onclick = () => {
                    input.value = station.replace(' STATION', '');
                    select.value = station; // Update hidden select
                    list.classList.add('hidden');
                    
                    // Trigger Logic
                    syncPlannerFromMain(station);
                    findNextTrains();
                };
                list.appendChild(li);
            });
        }
        list.classList.remove('hidden');
    };

    input.addEventListener('input', () => {
        // Clear select if user clears input
        if(input.value === '') {
            select.value = "";
            renderPlaceholder(); // Show "Select a station" UI
        }
        renderList(input.value);
    });

    input.addEventListener('focus', () => {
        renderList(input.value);
    });

    chevron.addEventListener('click', (e) => {
        e.stopPropagation(); 
        if (list.classList.contains('hidden')) {
            renderList(input.value);
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

// --- SETUP FUNCTIONS ---

function setupModalButtons() { 
    const closeAction = () => { scheduleModal.classList.add('hidden'); document.body.style.overflow = ''; }; 
    closeModalBtn.addEventListener('click', closeAction); 
    closeModalBtn2.addEventListener('click', closeAction); 
    scheduleModal.addEventListener('click', (e) => { if (e.target === scheduleModal) closeAction(); }); 
}

// --- TAB SWITCHING LOGIC (New V3.70 & V4.05 Animated) ---
function switchTab(tab) {
    // Reset Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // Hide Views
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
    
    // Save state
    localStorage.setItem('activeTab', tab);
}

// NEW: Animated Tab Indicator Logic
function initTabIndicator() {
    const tabNext = document.getElementById('tab-next-train');
    if (!tabNext) return;
    
    const container = tabNext.parentElement;
    if (!container) return;
    
    container.classList.add('relative'); // Ensure positioning context

    // 1. Create the sliding line if missing
    let indicator = document.getElementById('tab-sliding-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'tab-sliding-indicator';
        // Tailwind: absolute bottom, height, transition
        indicator.className = "absolute bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-300 ease-out z-10";
        container.appendChild(indicator);
        
        // 2. Inject CSS to hide the default borders on buttons
        const style = document.createElement('style');
        style.innerHTML = `
            .tab-btn { border-bottom-color: transparent !important; }
            .tab-btn.active { border-bottom-color: transparent !important; }
        `;
        document.head.appendChild(style);
    }

    // 3. Set initial position
    const activeBtn = document.querySelector('.tab-btn.active') || tabNext;
    moveTabIndicator(activeBtn);

    // 4. Handle Resize
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

// --- SWIPE NAVIGATION LOGIC (New V4.04) ---
function setupSwipeNavigation() {
    let touchStartX = 0;
    let touchStartY = 0;
    const contentArea = document.getElementById('main-content');

    if (!contentArea) return;

    contentArea.addEventListener('touchstart', (e) => {
        // Guard: Don't track if Sidenav or Modals are open
        if (document.body.classList.contains('sidenav-open') || 
            !document.getElementById('map-modal').classList.contains('hidden') ||
            !document.getElementById('schedule-modal').classList.contains('hidden')) {
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});

    contentArea.addEventListener('touchend', (e) => {
        // Guard: Same checks
        if (document.body.classList.contains('sidenav-open') || 
            !document.getElementById('map-modal').classList.contains('hidden') ||
            !document.getElementById('schedule-modal').classList.contains('hidden')) {
            return;
        }

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
    }, {passive: true});
}

function handleSwipe(startX, endX, startY, endY) {
    const minSwipeDistance = 75;
    const maxVerticalVariance = 50; // Don't switch if scrolling down

    const distX = startX - endX;
    const distY = Math.abs(startY - endY);

    // 1. Check Vertical variance (ignore if user was scrolling page)
    if (distY > maxVerticalVariance) return;

    // 2. Check Swipe Distance
    if (Math.abs(distX) > minSwipeDistance) {
        if (distX > 0) {
            // Swiped Left (Next Train -> Planner)
            switchTab('trip-planner');
        } else {
            // Swiped Right (Planner -> Next Train)
            switchTab('next-train');
        }
    }
}

window.openScheduleModal = function(destination) {
    if (!currentScheduleData || !currentScheduleData[destination]) { showToast("No full schedule data available.", "error"); return; }
    const journeys = currentScheduleData[destination]; 
    modalTitle.textContent = `Schedule to ${destination.replace(' STATION', '')}`; 
    modalList.innerHTML = '';
    const nowSeconds = timeToSeconds(currentTime);
    let firstNextTrainFound = false;

    journeys.forEach(j => {
        const dep = j.departureTime || j.train1.departureTime; 
        const trainName = j.train || j.train1.train; 
        const type = j.type === 'transfer' ? 'Transfer' : 'Direct';
        const depSeconds = timeToSeconds(dep);
        const isPassed = depSeconds < nowSeconds;

        let divClass = "p-3 rounded shadow-sm flex justify-between items-center transition-opacity duration-300";
        if (isPassed) {
            divClass += " bg-gray-50 dark:bg-gray-800 opacity-50 grayscale"; 
        } else {
            divClass += " bg-white dark:bg-gray-700"; 
        }

        const div = document.createElement('div'); 
        div.className = divClass;
        if (!isPassed && !firstNextTrainFound) {
            div.id = "next-train-marker";
            firstNextTrainFound = true;
        }

        // --- TAG IN MODAL ---
        let modalTag = "";
        if (j.isShared && j.sourceRoute) {
             const routeName = j.sourceRoute.replace("Pretoria <-> ", "").replace("Route", "").trim();
             if (j.isDivergent) {
                 modalTag = `<span class="text-[9px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-200 dark:border-red-800">⚠️ To ${j.actualDestName}</span>`;
             } else {
                 modalTag = `<span class="text-[9px] font-bold text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900 px-1.5 py-0.5 rounded uppercase ml-2">From ${routeName}</span>`;
             }
        }

        // UPDATED: Use formatTimeDisplay in modal list
        const formattedDep = formatTimeDisplay(dep);
        
        div.innerHTML = `<div><span class="text-lg font-bold text-gray-900 dark:text-white">${formattedDep}</span><div class="text-xs text-gray-500 dark:text-gray-400">Train ${trainName} ${modalTag}</div></div><div class="flex flex-col items-end gap-1">${type === 'Direct' ? '<span class="text-[10px] font-bold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900 px-2 py-0.5 rounded-full uppercase">Direct</span>' : `<span class="text-[10px] font-bold text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900 px-2 py-0.5 rounded-full uppercase">Transfer @ ${j.train1.terminationStation.replace(' STATION','')}</span>`} ${j.isLastTrain ? '<span class="text-[10px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-2 py-0.5 rounded-full uppercase border border-red-200 dark:border-red-800">LAST TRAIN</span>' : ''}</div>`;
        modalList.appendChild(div);
    });
    
    scheduleModal.classList.remove('hidden'); 
    document.body.style.overflow = 'hidden'; 
    setTimeout(() => {
        const target = document.getElementById('next-train-marker');
        if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 10);
};

function setupRedirectLogic() {
    feedbackBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        showRedirectModal("https://docs.google.com/forms/d/e/1FAIpQLSe7lhoUNKQFOiW1d6_7ezCHJvyOL5GkHNH1Oetmvdqgee16jw/viewform", "Open Google Form to send feedback?"); 
    }); 
    // REMOVED: checkUpdatesBtn event listener logic
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

// --- HELPER: Detect iOS ---
function isIOS() {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

function setupFeatureButtons() {
    if (localStorage.theme === 'light') { document.documentElement.classList.remove('dark'); darkIcon.classList.add('hidden'); lightIcon.classList.remove('hidden'); } 
    else { localStorage.theme = 'dark'; document.documentElement.classList.add('dark'); darkIcon.classList.remove('hidden'); lightIcon.classList.add('hidden'); }
    themeToggleBtn.addEventListener('click', () => { if (localStorage.theme === 'dark') { localStorage.theme = 'light'; document.documentElement.classList.remove('dark'); darkIcon.classList.add('hidden'); lightIcon.classList.remove('hidden'); } else { localStorage.theme = 'dark'; document.documentElement.classList.add('dark'); darkIcon.classList.remove('hidden'); lightIcon.classList.add('hidden'); } });
    shareBtn.addEventListener('click', async () => { const shareData = { title: 'Metrorail Next Train', text: 'Say Goodbye to Waiting\nUse Next Train to check when your train is due to arrive', url: '\n\nhttps://nexttrain.co.za' }; try { if (navigator.share) await navigator.share(shareData); else copyToClipboard(shareData.text + shareData.url); } catch (err) { copyToClipboard(shareData.text + shareData.url); } });
    
    // --- UPDATED INSTALL PROMPT LOGIC (V4.13 Always-Visible Trigger) ---
    installBtn = document.getElementById('install-app-btn');
    const installSideBtn = document.getElementById('install-side-btn');
    const installSideContainer = document.getElementById('install-side-container');
    const installModal = document.getElementById('install-modal');

    // Handler for Install Clicks
    const handleInstallClick = () => {
        // Logic A: Android / Desktop (Native Prompt is READY)
        if (window.deferredInstallPrompt) {
            window.deferredInstallPrompt.prompt();
            window.deferredInstallPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                window.deferredInstallPrompt = null;
                // Ideally hide button, but keeping it visible for "retry" is okay
            });
        } 
        // Logic B: iOS (Instruction Modal)
        else if (isIOS()) {
            if (installModal) installModal.classList.remove('hidden');
            // Close side nav if open
            const sidenav = document.getElementById('sidenav');
            const overlay = document.getElementById('sidenav-overlay');
            if (sidenav && overlay) {
                sidenav.classList.remove('open');
                overlay.classList.remove('open');
                document.body.classList.remove('sidenav-open');
            }
        }
        // Logic C: Fallback (Browser not ready / already installed / not supported)
        else {
            showToast("To install: Tap your browser menu (⋮) -> 'Install App'", "info", 4000);
        }
    };

    // Attach Click Listeners
    if (installBtn) installBtn.addEventListener('click', handleInstallClick);
    if (installSideBtn) installSideBtn.addEventListener('click', handleInstallClick);

    // OPTIONAL: If main install button was hidden by default in CSS, show it if prompt is ready
    if (window.deferredInstallPrompt && installBtn) {
        installBtn.classList.remove('hidden');
    }
    
    // (Note: Side button is now ALWAYS visible via HTML update)

    const openNav = () => { sidenav.classList.add('open'); sidenavOverlay.classList.add('open'); document.body.classList.add('sidenav-open'); };
    openNavBtn.addEventListener('click', openNav); routeSubtitle.addEventListener('click', openNav);
    const closeNav = () => { sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open'); };
    closeNavBtn.addEventListener('click', closeNav); sidenavOverlay.addEventListener('click', closeNav);
    
    // UPDATED: Using updateSidebarActiveState for consistent highlighting
    routeList.addEventListener('click', (e) => { 
        const routeLink = e.target.closest('a'); 
        if (routeLink && routeLink.dataset.routeId) { 
            const routeId = routeLink.dataset.routeId; 
            if (routeId === currentRouteId) { 
                showToast("You are already viewing this route.", "info", 1500); 
                closeNav(); 
                return; 
            } 
            
            // Set current route
            currentRouteId = routeId;
            
            // Update UI State immediately
            updateSidebarActiveState(); 
            
            closeNav(); 
            loadAllSchedules(); 
        } 
    });
    
    forceReloadBtn.addEventListener('click', () => { showToast("Forcing schedule reload...", "info", 2000); loadAllSchedules(true); });
    pinRouteBtn.addEventListener('click', () => { const savedDefault = localStorage.getItem('defaultRoute'); if (savedDefault === currentRouteId) { localStorage.removeItem('defaultRoute'); showToast("Route unpinned from top.", "info", 2000); } else { localStorage.setItem('defaultRoute', currentRouteId); showToast("Route pinned to top of menu!", "success", 2000); } updatePinUI(); });
}

// --- WELCOME SCREEN LOGIC ---
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
        
        // Use central function to update highlights
        updateSidebarActiveState();
        
        updatePinUI();
        
        loadAllSchedules();
    }, 300);
}

// --- LEGAL MODAL LOGIC ---
window.openLegal = function(type) {
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

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.log('Service Worker registration failed', err));
    });
}

// --- INITIALIZATION (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Assign Global References
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

    // 2. Event Listeners
    closeLegalBtn.addEventListener('click', closeLegal);
    closeLegalBtn2.addEventListener('click', closeLegal);
    legalModal.addEventListener('click', (e) => { if (e.target === legalModal) closeLegal(); });
    
    // NEW: Tab Switch Listeners (V3.70)
    document.getElementById('tab-next-train').addEventListener('click', () => switchTab('next-train'));
    document.getElementById('tab-trip-planner').addEventListener('click', () => switchTab('trip-planner'));

    // NEW: Help Modal Listeners (V3.62)
    const helpModal = document.getElementById('help-modal');
    const openHelpBtn = document.getElementById('open-help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const closeHelpBtn2 = document.getElementById('close-help-btn-2');
    
    const openHelp = () => {
        if(helpModal) helpModal.classList.remove('hidden');
        if(sidenav) {
            sidenav.classList.remove('open');
            sidenavOverlay.classList.remove('open');
            document.body.classList.remove('sidenav-open');
        }
    };
    
    const closeHelp = () => {
        if(helpModal) helpModal.classList.add('hidden');
    };
    
    if(openHelpBtn) openHelpBtn.addEventListener('click', openHelp);
    if(closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
    if(closeHelpBtn2) closeHelpBtn2.addEventListener('click', closeHelp);
    if(helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

    // Manual Locate Click - pass false to indicate manual interaction
    locateBtn.addEventListener('click', () => findNearestStation(false));
    
    appTitle.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 1000); 
        if (clickCount >= 5) {
            clickCount = 0;
            pinModal.classList.remove('hidden');
            pinInput.value = '';
            pinInput.focus();
        }
    });

    pinCancelBtn.addEventListener('click', () => { pinModal.classList.add('hidden'); });
    
    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            pinSubmitBtn.click();
        }
    });

    pinSubmitBtn.addEventListener('click', () => {
        if (pinInput.value === "101101") {
            pinModal.classList.add('hidden');
            simPanel.classList.remove('hidden');
            showToast("Developer Mode Unlocked!", "success");
        } else {
            showToast("Invalid PIN", "error");
            pinInput.value = '';
        }
    });

    simApplyBtn.addEventListener('click', () => {
        isSimMode = simEnabledCheckbox.checked;
        simTimeStr = simTimeInput.value + ":00";
        simDayIndex = parseInt(simDaySelect.value);
        if (isSimMode && !simTimeInput.value) { showToast("Please enter a time first!", "error"); return; }
        showToast(isSimMode ? "Dev Simulation Active!" : "Real-time Mode Active", "success");
        updateTime(); 
    });

    // --- UPDATED: Listener calls sync helper ---
    stationSelect.addEventListener('change', () => {
        syncPlannerFromMain(stationSelect.value);
        findNextTrains();
    });
    
    setupFeatureButtons(); updatePinUI(); setupModalButtons(); setupRedirectLogic(); startSmartRefresh();
    setupSwipeNavigation(); // NEW SWIPE LOGIC
    initTabIndicator(); // NEW ANIMATED TABS
    setupMainAutocomplete(); // NEW MAIN SEARCH
    
    // --- MAP VIEWER INIT (Extracted) ---
    if (typeof setupMapLogic === 'function') {
        setupMapLogic(); // Calls logic from map-viewer.js
    }

    // 3. Startup Logic
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

    // --- RESTORE ACTIVE TAB (New Requirement) ---
    // If user has a saved tab preference, load it. Otherwise, default to 'next-train'.
    // If first load (no localStorage entry), it defaults to 'next-train'.
    const lastActiveTab = localStorage.getItem('activeTab');
    if (lastActiveTab) {
        switchTab(lastActiveTab);
    } else {
        // Explicitly set default if nothing saved
        switchTab('next-train');
    }
});