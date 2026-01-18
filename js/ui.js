// --- GLOBAL ERROR HANDLER ---
window.onerror = function(msg, url, line) {
    console.error("Global Error Caught:", msg);
    
    // Safety check: Ensure main content is visible if error occurs during init
    if(mainContent) mainContent.style.display = 'block';
    
    if(toast) {
        toast.textContent = "Error: " + msg; 
        toast.className = "toast-error show";
    }
    return false;
};

// --- ANALYTICS HELPER (Google Analytics + MS Clarity) ---
function trackAnalyticsEvent(eventName, params = {}) {
    // 1. Google Analytics 4
    try {
        if (typeof gtag === 'function') {
            gtag('event', eventName, params);
            console.log(`[Analytics] GA4 Tracked: ${eventName}`, params);
        } else {
            console.log(`[Analytics] Skipped GA4 (not found): ${eventName}`);
        }
    } catch (e) {
        console.warn("[Analytics] GA4 Error:", e);
    }

    // 2. Microsoft Clarity
    try {
        if (typeof clarity === 'function') {
            // A. Log the Event (Smart Event)
            clarity("event", eventName);

            // B. Set Tags (Session Labels)
            // Note: Clarity treats params as session tags. 
            // Useful for filtering recordings (e.g., "Watch all sessions where user selected Route X")
            if (params) {
                Object.keys(params).forEach(key => {
                    clarity("set", key, String(params[key]));
                });
            }
            console.log(`[Analytics] Clarity Tagged: ${eventName}`);
        }
    } catch (e) {
        console.warn("[Analytics] Clarity Error:", e);
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

// --- BRIDGES TO RENDERER (Safety Wrapped) ---

function renderSkeletonLoader(element) {
    if (element && typeof Renderer !== 'undefined') Renderer.renderSkeletonLoader(element);
}

function renderPlaceholder() {
    if (typeof Renderer !== 'undefined') {
        if(pretoriaTimeEl) Renderer.renderPlaceholder(pretoriaTimeEl, null);
        if(pienaarspoortTimeEl) Renderer.renderPlaceholder(null, pienaarspoortTimeEl);
    }
    if(fareContainer) fareContainer.classList.add('hidden');
}

function renderRouteError(error) {
    if (typeof Renderer !== 'undefined') {
        if(pretoriaTimeEl) Renderer.renderRouteError(pretoriaTimeEl, error);
        if(pienaarspoortTimeEl) Renderer.renderRouteError(pienaarspoortTimeEl, error);
    }
    if(stationSelect) stationSelect.innerHTML = '<option>Unable to load stations</option>';
}

function renderComingSoon(routeName) {
    if (typeof Renderer !== 'undefined') {
        if(pretoriaTimeEl) Renderer.renderComingSoon(pretoriaTimeEl, routeName);
        if(pienaarspoortTimeEl) Renderer.renderComingSoon(pienaarspoortTimeEl, routeName);
    }
    if(stationSelect) stationSelect.innerHTML = '<option>Route not available</option>';
}

function renderAtDestination(element) {
    if (element && typeof Renderer !== 'undefined') Renderer.renderAtDestination(element);
}

function renderNoService(element, destination) {
    if (!element) return;
    
    const currentRoute = ROUTES[currentRouteId];
    if (!currentRoute) return;

    let sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b';
    const schedule = schedules[sheetKey];
    let allJourneys = [];
    
    // Safety check for logic functions
    if (typeof findNextJourneyToDestA === 'function') {
        if (destination === currentRoute.destA) { 
            const res = findNextJourneyToDestA(stationSelect.value, "00:00:00", schedule, currentRoute); 
            allJourneys = res.allJourneys; 
        } else { 
            const res = findNextJourneyToDestB(stationSelect.value, "00:00:00", schedule, currentRoute); 
            allJourneys = res.allJourneys; 
        }
    }
    
    const remainingJourneys = allJourneys.filter(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    const firstTrain = remainingJourneys.length > 0 ? remainingJourneys[0] : null;

    if (typeof Renderer !== 'undefined') {
        Renderer.renderNoService(element, destination, firstTrain, 1);
    }
}

function processAndRenderJourney(allJourneys, element, header, destination) {
    if (!element) return;

    const nowInSeconds = timeToSeconds(currentTime);
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
        
        if (typeof Renderer !== 'undefined') Renderer.renderJourney(element, nextJourney, destination);
    } else {
        if (allJourneys.length === 0) {
              element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No scheduled trains.</div>`;
              return;
        }
        renderNextAvailableTrain(element, destination);
    }
}

function renderNextAvailableTrain(element, destination) {
    if (!element) return;

    const currentRoute = ROUTES[currentRouteId];
    if (!currentRoute) return;

    let nextDayName = ""; let nextDaySheetKey = ""; let dayOffset = 1; 
    let nextDayType = 'weekday'; 

    switch (currentDayIndex) {
        case 6: // Saturday -> Monday
            nextDayName = "Monday"; dayOffset = 2; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; nextDayType = 'weekday'; break;
        case 5: // Friday -> Saturday
            nextDayName = "Saturday"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b'; nextDayType = 'saturday'; break;
        default: // Sun-Thu -> Next Day
            nextDayName = "tomorrow"; dayOffset = 1; nextDaySheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; nextDayType = 'weekday'; break;
    }
    
    const nextSchedule = schedules[nextDaySheetKey];
    if (!nextSchedule) { element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No schedule found.</div>`; return; }
    
    const res = (destination === currentRoute.destA) 
        ? findNextJourneyToDestA(stationSelect.value, "00:00:00", nextSchedule, currentRoute)
        : findNextJourneyToDestB(stationSelect.value, "00:00:00", nextSchedule, currentRoute);
        
    const firstTrainOfNextDay = res.allJourneys.find(j => timeToSeconds(j.departureTime || j.train1.departureTime) >= 0);
    
    if (!firstTrainOfNextDay) { element.innerHTML = `<div class="h-24 flex flex-col justify-center items-center text-lg font-bold text-gray-600 dark:text-gray-400">No trains found.</div>`; return; }
    
    if (typeof Renderer !== 'undefined') {
        Renderer.renderNextAvailableTrain(element, destination, firstTrainOfNextDay, nextDayName, nextDayType, dayOffset);
    }
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
    const savedDefault = localStorage.getItem('defaultRoute'); 
    const isPinned = savedDefault === currentRouteId;
    if (isPinned) { pinOutline.classList.add('hidden'); pinFilled.classList.remove('hidden'); pinRouteBtn.title = "Unpin this route"; } else { pinOutline.classList.remove('hidden'); pinFilled.classList.add('hidden'); pinRouteBtn.title = "Pin this route as default"; }
    
    // Dynamic Pin Section update via Renderer
    if (typeof Renderer !== 'undefined') {
        Renderer.renderRouteMenu('route-list', ROUTES, currentRouteId);
    }
}

function updateSidebarActiveState() {
    if (typeof Renderer !== 'undefined') {
        Renderer.renderRouteMenu('route-list', ROUTES, currentRouteId);
    }
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

        // Check if Admin global is available for simulation state
        const simActive = (typeof window.isSimMode !== 'undefined') ? window.isSimMode : false;

        if (simActive) {
            day = parseInt(window.simDayIndex || 1);
            timeString = window.simTimeStr || "12:00:00"; 
            
            // Check for specific date in DOM (Admin injected)
            const dateInput = document.getElementById('sim-date');
            if (dateInput && dateInput.value) {
                const parts = dateInput.value.split('-');
                if(parts.length === 3) dateToCheck = new Date(parts[0], parts[1] - 1, parts[2]);
            } 
        } else {
            const now = new Date();
            day = now.getDay(); 
            timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
            dateToCheck = now;
        }

        currentTime = timeString; 
        if(currentTimeEl) currentTimeEl.textContent = `Current Time: ${timeString} ${simActive ? '(SIM)' : ''}`;
        
        let newDayType = (day === 0) ? 'sunday' : (day === 6 ? 'saturday' : 'weekday');
        let specialStatusText = "";

        if (dateToCheck) {
            var m = pad(dateToCheck.getMonth() + 1);
            var d = pad(dateToCheck.getDate());
            var dateKey = m + "-" + d;

            if (SPECIAL_DATES[dateKey]) {
                newDayType = SPECIAL_DATES[dateKey];
                specialStatusText = HOLIDAY_NAMES[dateKey] ? " (Holiday)" : " (Holiday Schedule)";
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

        if (dateToCheck) {
            var m = pad(dateToCheck.getMonth() + 1);
            var d = pad(dateToCheck.getDate());
            var dateKey = m + "-" + d;
            if (HOLIDAY_NAMES[dateKey]) {
                displayType = `${HOLIDAY_NAMES[dateKey]} Schedule`;
                specialStatusText = "";
            }
        }

        if(currentDayEl) currentDayEl.innerHTML = `${dayNames[day]} <span class="font-bold text-blue-600 dark:text-blue-400">${displayType}</span>${specialStatusText}`;
        
        const plannerDaySelect = document.getElementById('planner-day-select');
        if (plannerDaySelect && !selectedPlannerDay) {
            plannerDaySelect.value = currentDayType;
            selectedPlannerDay = currentDayType;
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
        switchTab('trip-planner');
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
        
    } else if (action === 'map') {
        if (typeof setupMapLogic === 'function') {
            const mapModal = document.getElementById('map-modal');
            if (mapModal) {
                mapModal.classList.remove('hidden');
                history.pushState({ modal: 'map' }, '', '#map');
                const mapImage = document.getElementById('map-image');
                if(mapImage) mapImage.style.transform = `translate(0px, 0px) scale(1)`;
            }
        }
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
    }
}

function initializeApp() {
    if (window.location.pathname.endsWith('index.html')) {
        const newPath = window.location.pathname.replace('index.html', '');
        window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);
    }

    loadUserProfile(); 
    populateStationList();
    
    if (typeof initPlanner === 'function') initPlanner();

    // DYNAMIC MENU INJECTION
    if (typeof Renderer !== 'undefined') {
        Renderer.renderRouteMenu('route-list', ROUTES, currentRouteId);
    }

    startClock();
    findNextTrains(); 
    
    checkServiceAlerts();
    
    handleShortcutActions();

    if(mainContent) mainContent.style.display = 'block';
}

// --- READ-ONLY SERVICE ALERTS (Passenger View) ---
async function checkServiceAlerts() {
    const bellBtn = document.getElementById('notice-bell');
    const dot = document.getElementById('notice-dot');
    const modal = document.getElementById('notice-modal');
    const content = document.getElementById('notice-content');
    const timestamp = document.getElementById('notice-timestamp');
    
    if (!bellBtn) return;

    try {
        const response = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/notices.json?t=${Date.now()}`);
        if (!response.ok) return; 
        
        const notices = await response.json();
        if (!notices) { bellBtn.classList.add('hidden'); return; }

        let activeNotice = notices[currentRouteId] || notices['all'];
        
        if (activeNotice) {
            const now = Date.now();
            if (activeNotice.expiresAt && now > activeNotice.expiresAt) {
                bellBtn.classList.add('hidden'); return;
            }

            const seenKey = `seen_notice_${activeNotice.id}`;
            const hasSeen = localStorage.getItem(seenKey) === 'true';

            bellBtn.classList.remove('hidden');
            
            if (!hasSeen) {
                bellBtn.classList.add('animate-shake');
                dot.classList.remove('hidden');
            } else {
                bellBtn.classList.remove('animate-shake');
                dot.classList.add('hidden');
            }

            bellBtn.onclick = () => {
                localStorage.setItem(seenKey, 'true');
                bellBtn.classList.remove('animate-shake');
                dot.classList.add('hidden');
                
                content.textContent = activeNotice.message;
                const date = new Date(activeNotice.postedAt);
                timestamp.textContent = `Posted: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, ${date.toLocaleDateString()}`;
                
                modal.classList.remove('hidden');
            };
        } else {
            bellBtn.classList.add('hidden');
        }
    } catch (e) { console.warn("Alert check failed:", e); }
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
    const closeAction = () => { 
        if (location.hash === '#schedule') history.back();
        else { scheduleModal.classList.add('hidden'); document.body.style.overflow = ''; }
    }; 
    closeModalBtn.addEventListener('click', closeAction); 
    closeModalBtn2.addEventListener('click', closeAction); 
    scheduleModal.addEventListener('click', (e) => { if (e.target === scheduleModal) closeAction(); }); 
}

function switchTab(tab) {
    if (tab === 'trip-planner') {
        if (location.hash !== '#planner') history.pushState({ tab: 'planner' }, '', '#planner');
    } else {
        if (location.hash === '#planner') history.replaceState({ tab: 'next-train' }, '', ' '); 
    }

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
    
    if(targetBtn) { targetBtn.classList.add('active'); moveTabIndicator(targetBtn); }
    localStorage.setItem('activeTab', tab);
}

// --- GLOBAL BACK BUTTON HANDLER ---
window.addEventListener('popstate', (event) => {
    const modals = [
        { id: 'schedule-modal', hash: '#schedule' },
        { id: 'map-modal', hash: '#map' },
        { id: 'legal-modal', hash: '#legal' },
        { id: 'help-modal', hash: '#help' },
        { id: 'about-modal', hash: '#about' }
    ];

    let modalClosed = false;
    modals.forEach(m => {
        const el = document.getElementById(m.id);
        if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
            document.body.style.overflow = ''; 
            modalClosed = true;
        }
    });

    if (modalClosed) return;

    if (!location.hash) {
        const activeTab = localStorage.getItem('activeTab');
        if (activeTab === 'trip-planner') switchTab('next-train');
    }
});

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
            !document.getElementById('about-modal').classList.contains('hidden')) { 
            return;
        }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: true});

    contentArea.addEventListener('touchend', (e) => {
        if (document.body.classList.contains('sidenav-open') || 
            !document.getElementById('map-modal').classList.contains('hidden') ||
            !document.getElementById('schedule-modal').classList.contains('hidden') ||
            !document.getElementById('about-modal').classList.contains('hidden')) { 
            return;
        }

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
    }, {passive: true});
}

// UPDATED: Modal now supports dynamic Day Override
window.openScheduleModal = function(destination, dayOverride = null) {
    history.pushState({ modal: 'schedule' }, '', '#schedule');

    let journeys = [];
    let titleSuffix = "";

    if (dayOverride) {
        const currentRoute = ROUTES[currentRouteId];
        let sheetKey = null;
        
        if (dayOverride === 'weekday') {
            sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b';
            titleSuffix = " (Weekday)";
        } else if (dayOverride === 'saturday') {
            sheetKey = (destination === currentRoute.destA) ? 'saturday_to_a' : 'saturday_to_b';
            titleSuffix = " (Saturday)";
        } else if (dayOverride === 'sunday') {
            sheetKey = (destination === currentRoute.destA) ? 'weekday_to_a' : 'weekday_to_b'; 
            titleSuffix = " (Monday)";
        }

        const schedule = schedules[sheetKey];
        if (schedule) {
            if (destination === currentRoute.destA) {
                journeys = findNextJourneyToDestA(stationSelect.value, "00:00:00", schedule, currentRoute).allJourneys;
            } else {
                journeys = findNextJourneyToDestB(stationSelect.value, "00:00:00", schedule, currentRoute).allJourneys;
            }
        }
    } else {
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
        
        let isPassed = false;
        if (!dayOverride) isPassed = depSeconds < nowSeconds;

        let divClass = "p-3 rounded shadow-sm flex justify-between items-center transition-opacity duration-300";
        if (isPassed) divClass += " bg-gray-50 dark:bg-gray-800 opacity-50 grayscale"; 
        else divClass += " bg-white dark:bg-gray-700"; 

        const div = document.createElement('div'); 
        div.className = divClass;
        
        if (!isPassed && !firstNextTrainFound && !dayOverride) {
            div.id = "next-train-marker"; firstNextTrainFound = true;
        }

        let modalTag = "";
        if (j.isShared && j.sourceRoute) {
             const routeName = j.sourceRoute.replace(/^(Pretoria|JHB|Germiston|Mabopane)\s+<->\s+/i, "").replace("Route", "").trim();
             if (j.isDivergent) modalTag = `<span class="text-[9px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-200 dark:border-red-800">⚠️ To ${j.actualDestName}</span>`;
             else modalTag = `<span class="text-[9px] font-bold text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900 px-1.5 py-0.5 rounded uppercase ml-2">From ${routeName}</span>`;
        }

        const formattedDep = formatTimeDisplay(dep);
        let rightPillHTML = "";
        
        if (modalTag && modalTag !== "") { rightPillHTML = modalTag; modalTag = ""; } 
        else {
            if (type === 'Direct') rightPillHTML = '<span class="text-[10px] font-bold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900 px-2 py-0.5 rounded-full uppercase">Direct</span>';
            else rightPillHTML = `<span class="text-[10px] font-bold text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900 px-2 py-0.5 rounded-full uppercase">Transfer @ ${j.train1.terminationStation.replace(' STATION','')}</span>`;
        }

        if (j.isLastTrain) rightPillHTML += ' <span class="text-[10px] font-bold text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900 px-2 py-0.5 rounded-full uppercase border border-red-200 dark:border-red-800">LAST TRAIN</span>';
        
        div.innerHTML = `<div><span class="text-lg font-bold text-gray-900 dark:text-white">${formattedDep}</span><div class="text-xs text-gray-500 dark:text-gray-400">Train ${trainName} ${modalTag}</div></div><div class="flex flex-col items-end gap-1">${rightPillHTML}</div>`;
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
    
    shareBtn.addEventListener('click', async () => { 
        trackAnalyticsEvent('click_share', { location: 'main_view' });
        const shareData = { title: 'Metrorail Next Train', text: 'Say Goodbye to Waiting\nUse Next Train to check when your train is due to arrive:', url: '\n\nhttps://nexttrain.co.za' }; 
        try { if (navigator.share) await navigator.share(shareData); else copyToClipboard(shareData.text + shareData.url); } catch (err) { copyToClipboard(shareData.text + shareData.url); } 
    });
    
    installBtn = document.getElementById('install-app-btn');
    const showInstallButton = () => { if (installBtn) installBtn.classList.remove('hidden'); };

    if (window.deferredInstallPrompt) { console.log("Found trapped install event from HEAD"); showInstallButton(); } 
    else { window.addEventListener('pwa-install-ready', () => { console.log("Received custom install ready event"); showInstallButton(); }); }
    
    if (installBtn) {
        installBtn.addEventListener('click', () => { 
            trackAnalyticsEvent('install_app_click', { location: 'main_view' });
            installBtn.classList.add('hidden'); 
            const promptEvent = window.deferredInstallPrompt;
            if (promptEvent) {
                promptEvent.prompt(); 
                promptEvent.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') { console.log('User accepted the install prompt'); trackAnalyticsEvent('install_app_accepted'); } 
                    else { console.log('User dismissed the install prompt'); trackAnalyticsEvent('install_app_dismissed'); }
                    window.deferredInstallPrompt = null;
                });
            }
        }); 
    }

    const openNav = () => { sidenav.classList.add('open'); sidenavOverlay.classList.add('open'); document.body.classList.add('sidenav-open'); };
    openNavBtn.addEventListener('click', openNav); routeSubtitle.addEventListener('click', openNav);
    const closeNav = () => { sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open'); };
    closeNavBtn.addEventListener('click', closeNav); sidenavOverlay.addEventListener('click', closeNav);
    
    // Updated Logic: Delegate click handling to dynamic items
    // But routeList itself exists, so this delegation works.
    routeList.addEventListener('click', (e) => { 
        const routeLink = e.target.closest('a'); 
        if (routeLink && routeLink.dataset.routeId) { 
            const routeId = routeLink.dataset.routeId; 
            if (routeId === currentRouteId) { showToast("You are already viewing this route.", "info", 1500); closeNav(); return; } 
            
            if (ROUTES[routeId]) { trackAnalyticsEvent('select_route', { route_name: ROUTES[routeId].name, route_id: routeId }); }

            currentRouteId = routeId;
            updateSidebarActiveState(); 
            closeNav(); 
            loadAllSchedules(); 
            // Re-check alerts for the new route
            checkServiceAlerts(); 
        } 
    });
    
    forceReloadBtn.addEventListener('click', () => { showToast("Forcing schedule reload...", "info", 2000); loadAllSchedules(true); });
    pinRouteBtn.addEventListener('click', () => { const savedDefault = localStorage.getItem('defaultRoute'); if (savedDefault === currentRouteId) { localStorage.removeItem('defaultRoute'); showToast("Route unpinned from top.", "info", 2000); } else { localStorage.setItem('defaultRoute', currentRouteId); showToast("Route pinned to top of menu!", "success", 2000); } updatePinUI(); });
}

function showWelcomeScreen() {
    if (!welcomeModal || !welcomeRouteList) return;
    
    // DYNAMIC: Use Renderer for List
    if (typeof Renderer !== 'undefined') {
        Renderer.renderWelcomeList('welcome-route-list', ROUTES, selectWelcomeRoute);
    }

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
        checkServiceAlerts(); 
    }, 300);
}

window.openLegal = function(type) {
    trackAnalyticsEvent('view_legal_doc', { type: type });
    history.pushState({ modal: 'legal' }, '', '#legal');
    legalTitle.textContent = type === 'terms' ? 'Terms of Use' : 'Privacy Policy';
    legalContent.innerHTML = LEGAL_TEXTS[type];
    legalModal.classList.remove('hidden');
    sidenav.classList.remove('open');
    sidenavOverlay.classList.remove('open');
    document.body.classList.remove('sidenav-open');
};

function closeLegal() {
    if(location.hash === '#legal') history.back();
    else legalModal.classList.add('hidden');
}

// --- SERVICE WORKER UPDATE HANDLING & REGISTRATION ---
let newWorker;
function showUpdateToast(worker) {
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
            if (reg.waiting) { showUpdateToast(reg.waiting); return; }
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(newWorker);
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
    
    // Safety check for main content
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
    feedbackBtn = document.getElementById('feedback-btn');
    lastUpdatedEl = document.getElementById('last-updated-date');
    appTitle = document.getElementById('app-title');
    
    legalModal = document.getElementById('legal-modal');
    legalTitle = document.getElementById('legal-modal-title');
    legalContent = document.getElementById('legal-modal-content');
    closeLegalBtn = document.getElementById('close-legal-btn');
    closeLegalBtn2 = document.getElementById('close-legal-btn-2');

    welcomeModal = document.getElementById('welcome-modal');
    welcomeRouteList = document.getElementById('welcome-route-list');

    // Event Bindings
    if(closeLegalBtn) closeLegalBtn.addEventListener('click', closeLegal);
    if(closeLegalBtn2) closeLegalBtn2.addEventListener('click', closeLegal);
    if(legalModal) legalModal.addEventListener('click', (e) => { if (e.target === legalModal) closeLegal(); });
    
    document.getElementById('tab-next-train').addEventListener('click', () => switchTab('next-train'));
    document.getElementById('tab-trip-planner').addEventListener('click', () => switchTab('trip-planner'));

    const versionFooter = document.getElementById('app-version-footer');
    if (versionFooter && typeof APP_VERSION !== 'undefined') versionFooter.textContent = APP_VERSION;

    const helpModal = document.getElementById('help-modal');
    const openHelpBtn = document.getElementById('open-help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const closeHelpBtn2 = document.getElementById('close-help-btn-2');
    
    const aboutModal = document.getElementById('about-modal');
    const openAboutBtn = document.getElementById('open-about-btn');
    const closeAboutBtn = document.getElementById('close-about-btn');

    const facebookBtn = document.getElementById('facebook-connect-link');
    if (facebookBtn) facebookBtn.addEventListener('click', () => trackAnalyticsEvent('click_social_facebook', { location: 'about_modal' }));

    const closeSideNav = () => { if(sidenav) { sidenav.classList.remove('open'); sidenavOverlay.classList.remove('open'); document.body.classList.remove('sidenav-open'); } };

    const openHelp = () => { trackAnalyticsEvent('view_user_guide', { location: 'sidebar' }); history.pushState({ modal: 'help' }, '', '#help'); if(helpModal) helpModal.classList.remove('hidden'); closeSideNav(); };
    const closeHelp = () => { if(location.hash === '#help') history.back(); else if(helpModal) helpModal.classList.add('hidden'); };
    
    const openAbout = () => { trackAnalyticsEvent('view_about_page', { location: 'sidebar' }); history.pushState({ modal: 'about' }, '', '#about'); if(aboutModal) aboutModal.classList.remove('hidden'); closeSideNav(); };
    const closeAbout = () => { if(location.hash === '#about') history.back(); else if(aboutModal) aboutModal.classList.add('hidden'); };
    
    if(openHelpBtn) openHelpBtn.addEventListener('click', openHelp);
    if(closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
    if(closeHelpBtn2) closeHelpBtn2.addEventListener('click', closeHelp);
    if(helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

    if(openAboutBtn) openAboutBtn.addEventListener('click', openAbout);
    if(closeAboutBtn) closeAboutBtn.addEventListener('click', closeAbout);
    if(aboutModal) aboutModal.addEventListener('click', (e) => { if (e.target === aboutModal) closeAbout(); });

    locateBtn.addEventListener('click', () => { trackAnalyticsEvent('click_auto_locate', { location: 'home_header' }); findNearestStation(false); });
    
    const viewMapBtn = document.getElementById('view-map-btn');
    if (viewMapBtn) viewMapBtn.addEventListener('click', () => trackAnalyticsEvent('click_network_map', { location: 'sidebar' }));

    const openInteractiveMapBtn = document.getElementById('open-interactive-map-btn');
    if (openInteractiveMapBtn) openInteractiveMapBtn.addEventListener('click', () => trackAnalyticsEvent('open_interactive_map', { source: 'modal' }));
    
    // --- ADMIN / DEV TRIGGER ---
    if (appTitle) {
        // Delegate logic to Admin module if available
        if (typeof Admin !== 'undefined' && Admin.setupPinAccess) {
            Admin.setupPinAccess(); 
        }
    }

    stationSelect.addEventListener('change', () => { syncPlannerFromMain(stationSelect.value); findNextTrains(); });
    
    setupFeatureButtons(); updatePinUI(); setupModalButtons(); setupRedirectLogic(); startSmartRefresh();
    setupSwipeNavigation(); initTabIndicator(); 
    
    if (typeof setupMapLogic === 'function') setupMapLogic(); 

    const savedDefault = localStorage.getItem('defaultRoute');
    if (savedDefault && ROUTES[savedDefault]) {
        currentRouteId = savedDefault;
        loadAllSchedules().then(() => {
            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
                    if (result.state === 'granted') { console.log("Location permission already granted. Auto-locating..."); findNearestStation(true); }
                });
            }
        });
    } else {
        console.log("First time user (or no pinned route). Showing Welcome Screen.");
        showWelcomeScreen();
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('action')) console.log("Shortcut action detected, ignoring saved tab preference.");
    else {
        const lastActiveTab = localStorage.getItem('activeTab');
        if (lastActiveTab) switchTab(lastActiveTab);
        else switchTab('next-train');
    }
});