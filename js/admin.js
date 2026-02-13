/**
 * METRORAIL NEXT TRAIN - ADMIN TOOLS (V4.60.75 - Smart Picker Edition)
 * --------------------------------------------
 * This module handles Developer Mode features:
 * 1. Service Alerts Manager (Write Access)
 * 2. PIN Unlock Logic & Signature Mgmt
 * 3. Simulation Controls
 * 4. Ghost Train Exclusion Manager (Enhanced)
 * * * PART OF PHASE 1: MODULARIZATION
 */

const Admin = {
    
    // --- 1. INITIALIZATION ---
    init: () => {
        Admin.setupPinAccess();
        Admin.setupSimulationControls();
        // Service Alerts Manager is lazy-loaded when the modal opens
        // Exclusion Manager is lazy-loaded too
    },

    // --- 2. PIN ACCESS LOGIC ---
    setupPinAccess: () => {
        const appTitle = document.getElementById('app-title');
        const pinModal = document.getElementById('pin-modal');
        const pinInput = document.getElementById('pin-input');
        const pinSubmitBtn = document.getElementById('pin-submit-btn');
        const pinCancelBtn = document.getElementById('pin-cancel-btn');
        const devModal = document.getElementById('dev-modal');
        const simTimeInput = document.getElementById('sim-time');

        if (!appTitle) return;

        let clickCount = 0;
        let clickTimer = null;

        appTitle.style.cursor = 'pointer'; 
        appTitle.title = "Developer Access (Tap 5 times)";

        // 5-Tap Trigger
        appTitle.addEventListener('click', (e) => {
            e.preventDefault(); 
            clickCount++;
            
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 2000); 
            
            if (clickCount >= 5) {
                clickCount = 0;
                const now = new Date();
                const timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());

                if (window.isSimMode) {
                    // If already in dev mode, just open the panel
                    if (devModal) {
                        devModal.classList.remove('hidden');
                        Admin.setupServiceAlertsManager(); // Init alerts logic
                        Admin.setupExclusionManager(); // Init exclusion logic
                    }
                    showToast("Developer Session Active", "info");
                } else {
                    // Otherwise, show PIN entry
                    if(simTimeInput) simTimeInput.value = timeString;
                    if (pinModal) {
                        pinModal.classList.remove('hidden');
                        if(pinInput) { pinInput.value = ''; pinInput.focus(); }
                    }
                }
            }
        });

        // PIN Form Logic
        if (pinCancelBtn) pinCancelBtn.addEventListener('click', () => { pinModal.classList.add('hidden'); });
        
        if (pinInput) {
            pinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && pinSubmitBtn) pinSubmitBtn.click();
            });
        }

        if (pinSubmitBtn) {
            pinSubmitBtn.addEventListener('click', () => {
                // UPDATE V4.60.41: Multi-Admin Support
                const PIN_MAP = {
                    "101101": "Enock",  // Lead Developer
                    "202626": "Admin"   // Fallback/Guest
                };

                const enteredPin = pinInput.value;
                const adminName = PIN_MAP[enteredPin];

                if (adminName) {
                    pinModal.classList.add('hidden');
                    
                    // Store identity for session
                    sessionStorage.setItem('admin_session_name', adminName);
                    
                    localStorage.setItem('analytics_ignore', 'true');
                    console.log(`🛡️ Guardian: Analytics filter enabled for ${adminName}.`);

                    const now = new Date();
                    const timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
                    if(simTimeInput) simTimeInput.value = timeString;

                    if (devModal) {
                        devModal.classList.remove('hidden');
                        Admin.setupServiceAlertsManager();
                        Admin.setupExclusionManager();
                    }
                    showToast(`Welcome back, ${adminName}!`, "success");
                } else {
                    showToast("Invalid PIN", "error");
                    pinInput.value = '';
                }
            });
        }
    },

    // --- 3. SIMULATION CONTROLS ---
    setupSimulationControls: () => {
        const simApplyBtn = document.getElementById('sim-apply-btn');
        const simExitBtn = document.getElementById('sim-exit-btn');
        const simEnabledCheckbox = document.getElementById('sim-enabled');
        const simTimeInput = document.getElementById('sim-time');
        const dayDropdown = document.getElementById('sim-day');
        const dateContainer = document.getElementById('sim-date-container');
        const dateInput = document.getElementById('sim-date');
        const devModal = document.getElementById('dev-modal');

        // Toggle Date Picker
        if (dayDropdown && dateContainer && dateInput) {
            dayDropdown.addEventListener('change', () => {
                if (dayDropdown.value === 'specific') {
                    dateContainer.classList.remove('hidden');
                    dateInput.focus();
                } else {
                    dateContainer.classList.add('hidden');
                }
            });
        }

        // Apply Simulation
        if (simApplyBtn) {
            simApplyBtn.addEventListener('click', () => {
                if (!simEnabledCheckbox || !simTimeInput) return;

                // Update Global State (window scope used in logic.js)
                window.isSimMode = simEnabledCheckbox.checked;
                window.simTimeStr = simTimeInput.value + ":00";
                
                if (dayDropdown && dayDropdown.value === 'specific') {
                    if (dateInput && dateInput.value) {
                        const d = new Date(dateInput.value);
                        window.simDayIndex = d.getDay(); 
                        showToast(`Simulating specific date: ${dateInput.value}`, "info");
                    } else {
                        showToast("Please select a valid date.", "error");
                        return;
                    }
                } else if (dayDropdown) {
                    window.simDayIndex = parseInt(dayDropdown.value);
                } else {
                    window.simDayIndex = 1;
                }

                if (window.isSimMode && !simTimeInput.value) { 
                    showToast("Please enter a time first!", "error"); 
                    return; 
                }
                
                showToast(window.isSimMode ? "Dev Simulation Active!" : "Real-time Mode Active", "success");
                
                if(devModal) devModal.classList.add('hidden');
                
                // Trigger Updates (Assuming global functions exist)
                if (typeof updateTime === 'function') updateTime(); 
                if (typeof findNextTrains === 'function') findNextTrains();
            });
        }

        // Exit Simulation
        if (simExitBtn) {
            simExitBtn.addEventListener('click', () => {
                window.isSimMode = false;
                
                if(simEnabledCheckbox) simEnabledCheckbox.checked = false;
                if(simTimeInput) simTimeInput.value = '';
                
                if(dayDropdown) dayDropdown.value = '1'; 
                if(dateContainer) dateContainer.classList.add('hidden');
                if(dateInput) dateInput.value = '';
                
                if(devModal) devModal.classList.add('hidden');
                
                showToast("Exited Developer Mode", "info");
                
                if (typeof updateTime === 'function') updateTime(); 
                if (typeof findNextTrains === 'function') findNextTrains();
            });
        }
    },

    // --- 4. SERVICE ALERTS MANAGER ---
    setupServiceAlertsManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        const alertMsg = document.getElementById('alert-msg');
        const alertTarget = document.getElementById('alert-target');
        const alertDuration = document.getElementById('alert-duration');
        const alertKey = document.getElementById('alert-key');
        const alertRemember = document.getElementById('alert-remember');
        const sendBtn = document.getElementById('alert-send-btn');
        const clearBtn = document.getElementById('alert-clear-btn');

        if (!sendBtn || !alertPanel) return; 

        // Prevent double binding
        if (alertPanel.dataset.adminLoaded === "true") return;
        alertPanel.dataset.adminLoaded = "true";

        // Accordion Logic
        if (!document.getElementById('alert-header-btn')) {
            const header = document.createElement('button');
            header.id = 'alert-header-btn';
            header.className = "w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none mb-4";
            header.innerHTML = `
                <span class="flex items-center"><span class="mr-2">📢</span> Service Alerts Manager</span>
                <svg id="alert-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            `;

            const body = document.createElement('div');
            body.id = 'alert-body';
            body.className = "hidden transition-all duration-300";

            // Move children to body
            while (alertPanel.firstChild) {
                if (alertPanel.firstChild.tagName === 'H4') {
                    alertPanel.removeChild(alertPanel.firstChild);
                } else {
                    body.appendChild(alertPanel.firstChild);
                }
            }

            alertPanel.appendChild(header);
            alertPanel.appendChild(body);

            header.addEventListener('click', () => {
                body.classList.toggle('hidden');
                const chevron = document.getElementById('alert-chevron');
                if (body.classList.contains('hidden')) {
                    chevron.classList.add('-rotate-90');
                } else {
                    chevron.classList.remove('-rotate-90');
                }
            });
        }

        // Populate Target Dropdown
        if (alertTarget && alertTarget.options.length <= 1) {
            // Need access to ROUTES global
            if (typeof ROUTES !== 'undefined') {
                Object.values(ROUTES).forEach(r => {
                    if (r.isActive) {
                        const opt = document.createElement('option');
                        opt.value = r.id;
                        opt.textContent = r.name;
                        alertTarget.appendChild(opt);
                    }
                });
            }
        }

        // Admin Key Persistence
        const savedKey = localStorage.getItem('admin_firebase_key');
        
        if (!document.getElementById('key-status-div')) {
            const keyStatusDiv = document.createElement('div');
            keyStatusDiv.id = 'key-status-div';
            keyStatusDiv.className = "hidden flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800 mb-2";
            keyStatusDiv.innerHTML = `
                <span class="text-xs font-bold text-green-700 dark:text-green-400 flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    Key Saved
                </span>
                <button id="alert-key-reset-btn" class="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 font-bold underline px-2">Reset</button>
            `;
            
            if (alertKey && alertKey.parentNode) {
                alertKey.parentNode.insertBefore(keyStatusDiv, alertKey);
            }

            const resetBtn = keyStatusDiv.querySelector('#alert-key-reset-btn');
            if (resetBtn) {
                resetBtn.onclick = (e) => {
                    e.preventDefault();
                    localStorage.removeItem('admin_firebase_key');
                    alertKey.value = '';
                    if(alertRemember) alertRemember.checked = false;
                    
                    keyStatusDiv.classList.add('hidden');
                    alertKey.classList.remove('hidden');
                    if (alertKey.nextElementSibling) alertKey.nextElementSibling.classList.remove('hidden'); 
                    
                    showToast("Key cleared from device.", "info");
                };
            }
        }

        const keyStatusDiv = document.getElementById('key-status-div');
        const showSavedMode = () => {
            if(keyStatusDiv) keyStatusDiv.classList.remove('hidden');
            alertKey.classList.add('hidden');
            if (alertKey.nextElementSibling) alertKey.nextElementSibling.classList.add('hidden');
        };

        if (savedKey && alertKey) {
            alertKey.value = savedKey;
            if(alertRemember) alertRemember.checked = true;
            showSavedMode();
        }

        // Custom Duration Picker
        if (alertDuration && alertDuration.tagName === 'SELECT') {
            const dateInput = document.createElement('input');
            dateInput.type = 'datetime-local';
            dateInput.id = 'alert-duration-custom';
            dateInput.className = alertDuration.className; 
            
            const now = new Date();
            now.setHours(now.getHours() + 2);
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            dateInput.value = now.toISOString().slice(0, 16);

            alertDuration.parentNode.replaceChild(dateInput, alertDuration);
            
            const durationLabel = dateInput.previousElementSibling;
            if(durationLabel) durationLabel.textContent = "Expiry Time";
        }

        // Fetch Current Alert for Editing
        const fetchCurrentAlert = async (target) => {
            try {
                const res = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/notices/${target}.json?t=${Date.now()}`);
                const data = await res.json();
                
                const dateInput = document.getElementById('alert-duration-custom');

                if (data && data.message) {
                    // Strip HTML breaks for editing
                    const rawMsg = data.message
                        .replace(/<br>/g, "\n")
                        .replace(/<b>/g, "*")
                        .replace(/<\/b>/g, "*")
                        .split("<br><br><span")[0]; // Remove signature

                    alertMsg.value = rawMsg;
                    
                    if(data.expiresAt && dateInput) {
                        const expiryDate = new Date(data.expiresAt);
                        expiryDate.setMinutes(expiryDate.getMinutes() - expiryDate.getTimezoneOffset());
                        dateInput.value = expiryDate.toISOString().slice(0, 16);
                    }
                    showToast("Loaded existing alert for editing.", "info");
                    sendBtn.textContent = "Update Alert"; 
                } else {
                    alertMsg.value = "";
                    sendBtn.textContent = "Post Alert";
                }
            } catch (e) { console.log("No active alert to pre-fill."); }
        };

        if (!alertTarget.dataset.listenerAttached) {
            alertTarget.addEventListener('change', () => fetchCurrentAlert(alertTarget.value));
            alertTarget.dataset.listenerAttached = "true";
        }
        
        fetchCurrentAlert(alertTarget.value);

        // POST Logic
        sendBtn.onclick = async () => {
            let msg = alertMsg.value.trim();
            const secret = localStorage.getItem('admin_firebase_key') || alertKey.value.trim();
            const target = alertTarget.value;
            const dateInput = document.getElementById('alert-duration-custom');
            
            if (!msg || !secret) {
                showToast("Message and Key required!", "error");
                return;
            }

            // UPDATE V4.60.41: Rich Text Formatting
            msg = msg.replace(/\n/g, "<br>");
            msg = msg.replace(/\*(.*?)\*/g, "<b>$1</b>");
            
            const author = sessionStorage.getItem('admin_session_name') || "Admin";
            msg += `<br><br><span class="opacity-75 text-xs">— ${author}</span>`;

            let expiresAtVal;
            if (dateInput && dateInput.value) {
                expiresAtVal = new Date(dateInput.value).getTime();
            } else {
                expiresAtVal = Date.now() + (2 * 60 * 60 * 1000); 
            }

            if (alertRemember && alertRemember.checked) {
                localStorage.setItem('admin_firebase_key', secret);
                showSavedMode();
            } else {
                if(!localStorage.getItem('admin_firebase_key')) {
                    localStorage.removeItem('admin_firebase_key');
                }
            }

            const now = Date.now();
            const payload = {
                id: now.toString(), 
                message: msg,
                postedAt: now,
                expiresAt: expiresAtVal
            };

            const url = `https://metrorail-next-train-default-rtdb.firebaseio.com/notices/${target}.json?auth=${secret}`;

            try {
                sendBtn.textContent = "Posting...";
                sendBtn.disabled = true;
                
                const res = await fetch(url, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showToast("Alert Posted Successfully!", "success");
                    if (typeof checkServiceAlerts === 'function') checkServiceAlerts(); 
                } else {
                    showToast("Failed. Check Admin Key.", "error");
                }
            } catch (e) {
                showToast("Network Error: " + e.message, "error");
            } finally {
                sendBtn.textContent = "Update Alert";
                sendBtn.disabled = false;
            }
        };

        // DELETE Logic
        clearBtn.onclick = async () => {
            const secret = localStorage.getItem('admin_firebase_key') || alertKey.value.trim();
            const target = alertTarget.value;

            if (!secret) {
                showToast("Admin Key required to clear.", "error");
                return;
            }

            const targetName = target === 'all' ? "GLOBAL Alert" : (ROUTES[target]?.name || target);

            if(!confirm(`Delete the active alert for: ${targetName}?`)) return;

            const url = `https://metrorail-next-train-default-rtdb.firebaseio.com/notices/${target}.json?auth=${secret}`;

            try {
                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    showToast("Alert Cleared!", "info");
                    alertMsg.value = "";
                    sendBtn.textContent = "Post Alert";
                    if (typeof checkServiceAlerts === 'function') setTimeout(checkServiceAlerts, 500); 
                } else {
                    showToast("Failed. Check Admin Key.", "error");
                }
            } catch (e) {
                showToast("Error: " + e.message, "error");
            }
        };
    },

    // --- 5. EXCLUSION MANAGER (Ghost Train Protocol - Enhanced) ---
    setupExclusionManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel || !alertPanel.parentNode) return;

        // Create Panel if missing
        let exclPanel = document.getElementById('exclusion-panel');
        if (!exclPanel) {
            exclPanel = document.createElement('div');
            exclPanel.id = 'exclusion-panel';
            exclPanel.className = "bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4 border border-red-200 dark:border-red-900";
            alertPanel.parentNode.insertBefore(exclPanel, alertPanel.nextSibling);
        }

        // Only init once
        if (exclPanel.dataset.adminLoaded === "true") return;
        exclPanel.dataset.adminLoaded = "true";

        // Generate UI with Train Picker
        exclPanel.innerHTML = `
            <button id="excl-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none mb-4">
                <span class="flex items-center"><span class="mr-2">⛔</span> Schedule Exceptions</span>
                <svg id="excl-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div id="excl-body" class="hidden transition-all duration-300 space-y-3">
                
                <!-- ROUTE SELECTOR -->
                <select id="excl-route" class="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white">
                    <option value="">Select Route...</option>
                </select>
                
                <!-- SCHEDULE TYPE (For fetching list) -->
                <div class="flex space-x-2">
                    <select id="excl-schedule-type" class="w-1/2 p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm">
                        <option value="weekday">Weekday Schedule</option>
                        <option value="saturday">Saturday Schedule</option>
                        <option value="sunday">Sunday Schedule</option>
                    </select>
                    <button id="excl-load-trains-btn" class="w-1/2 bg-blue-100 text-blue-700 font-bold rounded text-xs hover:bg-blue-200">Load Trains</button>
                </div>

                <!-- TRAIN PICKER GRID -->
                <div id="excl-train-picker" class="hidden border border-gray-200 dark:border-gray-700 rounded p-2 bg-gray-50 dark:bg-gray-900">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Select Trains to Ban:</p>
                    <div id="excl-train-grid" class="grid grid-cols-4 gap-2 text-xs max-h-40 overflow-y-auto"></div>
                </div>
                
                <input id="excl-train-manual" type="text" placeholder="Or type manually (e.g. 4401)" class="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white hidden">

                <!-- DAY CHECKBOXES -->
                <div class="flex justify-between items-center bg-gray-100 dark:bg-gray-900 p-2 rounded">
                    <span class="text-xs font-bold text-gray-500 mr-2">Exclude On:</span>
                    <div class="flex space-x-1" id="excl-days-container">
                        <!-- Checkboxes generated by JS -->
                    </div>
                </div>

                <input id="excl-reason" type="text" placeholder="Reason (e.g. Testing)" class="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white">

                <button id="excl-save-btn" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors text-sm">Ban Selected Trains</button>
                
                <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Active Exclusions:</p>
                    <div id="excl-list" class="space-y-1 max-h-40 overflow-y-auto"></div>
                </div>
            </div>
        `;

        // Wiring
        const header = document.getElementById('excl-header-btn');
        const body = document.getElementById('excl-body');
        const chevron = document.getElementById('excl-chevron');
        const routeSelect = document.getElementById('excl-route');
        const schedTypeSelect = document.getElementById('excl-schedule-type');
        const loadTrainsBtn = document.getElementById('excl-load-trains-btn');
        const trainGrid = document.getElementById('excl-train-grid');
        const pickerContainer = document.getElementById('excl-train-picker');
        const saveBtn = document.getElementById('excl-save-btn');
        const listDiv = document.getElementById('excl-list');
        const daysContainer = document.getElementById('excl-days-container');

        header.onclick = () => {
            body.classList.toggle('hidden');
            if (body.classList.contains('hidden')) chevron.classList.add('-rotate-90');
            else chevron.classList.remove('-rotate-90');
        };

        // Populate Routes
        if (typeof ROUTES !== 'undefined') {
            Object.values(ROUTES).forEach(r => {
                if (r.isActive) {
                    const opt = document.createElement('option');
                    opt.value = r.id;
                    opt.textContent = r.name;
                    routeSelect.appendChild(opt);
                }
            });
        }

        // Generate Days Checkboxes
        const days = ['S','M','T','W','T','F','S'];
        days.forEach((d, idx) => {
            const label = document.createElement('label');
            label.className = "flex flex-col items-center cursor-pointer";
            label.innerHTML = `
                <input type="checkbox" value="${idx}" class="form-checkbox h-3 w-3 text-red-600 bg-gray-200 border-gray-300 rounded mb-1 focus:ring-0">
                <span class="text-[9px] font-bold text-gray-500">${d}</span>
            `;
            daysContainer.appendChild(label);
        });

        const getSelectedDays = () => Array.from(daysContainer.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

        // SMART PICKER: Fetch Train Numbers from Logic.js
        loadTrainsBtn.onclick = () => {
            const rId = routeSelect.value;
            const type = schedTypeSelect.value;
            if (!rId) { showToast("Select a route first", "error"); return; }

            const route = ROUTES[rId];
            if (!route) return;

            // Map UI selection to Logic Sheet Keys
            // Default to Direction A for the master list
            let sheetKey = null;
            if (type === 'weekday') sheetKey = route.sheetKeys.weekday_to_a;
            else if (type === 'saturday') sheetKey = route.sheetKeys.saturday_to_a;
            // logic.js schedules object holds the parsed data
            // We need to access 'schedules' global from logic.js context
            // But 'schedules' might not be fully loaded for *this* specific route/day combo if we aren't viewing it?
            // Fallback: We look at 'fullDatabase' global directly.
            
            if (typeof fullDatabase === 'undefined' || !fullDatabase) {
                showToast("Database not ready. Refresh app.", "error");
                return;
            }

            const dbKey = sheetKey; // The actual key in fullDatabase
            const rawData = fullDatabase[dbKey];
            
            if (!rawData) {
                showToast(`No data found for ${type}`, "error");
                return;
            }

            // Quick Parse Headers (Simpler version of logic.js parser)
            let trainNumbers = [];
            try {
                // Find header row (usually index 0 or 1)
                let headerRow = rawData.find(r => Object.values(r).some(v => String(v).includes('STATION')));
                if(!headerRow) headerRow = rawData[0]; // Fallback

                // Extract keys that look like train numbers (4 digits)
                Object.keys(headerRow).forEach(k => {
                    // In raw DB, keys might be '4401', 'STATION', etc.
                    // Actually, rawData is array of objects. Keys are the headers?
                    // Firebase structure varies. Usually it's Array of Objects.
                    // If parsed by logic.js, 'schedules' is better.
                    
                    // Lets try to use the 'schedules' global if available and matches
                    // If not, we do a quick scan of the first row keys
                    if (k.match(/^\d{4}/)) trainNumbers.push(k);
                });
                
                // If header scanning failed, scan row keys
                if (trainNumbers.length === 0 && rawData.length > 1) {
                    const sample = rawData[1]; // Row 1 usually has data
                    Object.keys(sample).forEach(k => {
                        if (k.match(/^\d{4}[a-zA-Z]*/)) trainNumbers.push(k);
                    });
                }
            } catch(e) { console.log(e); }

            trainNumbers.sort();
            
            // Render Grid
            trainGrid.innerHTML = '';
            if (trainNumbers.length === 0) {
                trainGrid.innerHTML = '<div class="col-span-4 text-gray-400">No trains found.</div>';
            } else {
                trainNumbers.forEach(tNum => {
                    const div = document.createElement('div');
                    div.className = "flex items-center space-x-1";
                    div.innerHTML = `
                        <input type="checkbox" value="${tNum}" class="rounded text-blue-600 focus:ring-0 w-3 h-3">
                        <span class="font-mono">${tNum}</span>
                    `;
                    trainGrid.appendChild(div);
                });
            }
            pickerContainer.classList.remove('hidden');
        };

        // LIST Logic (View active bans)
        const fetchExclusions = async () => {
            const rId = routeSelect.value;
            listDiv.innerHTML = '<div class="text-xs text-gray-400 italic">Loading...</div>';
            
            try {
                const res = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/exclusions/${rId}.json?t=${Date.now()}`);
                const data = await res.json();
                
                listDiv.innerHTML = '';
                if (!data) {
                    listDiv.innerHTML = '<div class="text-xs text-gray-400 italic">No active exclusions.</div>';
                    return;
                }

                Object.keys(data).forEach(trainNum => {
                    const item = data[trainNum];
                    const dayLabels = item.days.map(d => days[d]).join(',');
                    
                    const row = document.createElement('div');
                    row.className = "flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs";
                    row.innerHTML = `
                        <div>
                            <span class="font-bold text-red-600">#${trainNum}</span>
                            <span class="text-gray-500 mx-1">|</span>
                            <span class="text-gray-700 dark:text-gray-300 font-mono">[${dayLabels}]</span>
                            <div class="text-[9px] text-gray-400">${item.reason || 'No reason'}</div>
                        </div>
                        <button class="text-red-500 hover:text-white hover:bg-red-500 rounded px-1.5 py-0.5 transition-colors font-bold" onclick="Admin.deleteExclusion('${rId}', '${trainNum}')">✕</button>
                    `;
                    listDiv.appendChild(row);
                });

            } catch(e) {
                listDiv.innerHTML = `<div class="text-xs text-red-500">Error loading list.</div>`;
            }
        };

        routeSelect.addEventListener('change', fetchExclusions);

        // SAVE Logic (Bulk)
        saveBtn.onclick = async () => {
            const rId = routeSelect.value;
            const reason = document.getElementById('excl-reason').value.trim() || "Service Adjustment";
            const selectedDays = getSelectedDays();
            const secret = localStorage.getItem('admin_firebase_key') || document.getElementById('alert-key').value.trim();

            // Gather Selected Trains
            const selectedTrains = Array.from(trainGrid.querySelectorAll('input:checked')).map(cb => cb.value);
            // Fallback to manual input if grid is empty/hidden
            const manualTrain = document.getElementById('excl-train-manual').value.trim();
            if (manualTrain) selectedTrains.push(manualTrain);

            if (selectedTrains.length === 0 || selectedDays.length === 0) {
                showToast("Select trains and days.", "error");
                return;
            }
            if (!secret) {
                showToast("Admin Key required.", "error");
                return;
            }

            // Bulk Updates Object
            const updates = {};
            selectedTrains.forEach(tNum => {
                updates[`${tNum}`] = {
                    days: selectedDays,
                    reason: reason,
                    updatedAt: Date.now()
                };
            });

            // Firebase PATCH is not ideal for this structure if we want to merge deep.
            // We'll iterate and send PUT requests or construct a multi-path update.
            // Simplest safe way: Loop fetch.
            
            try {
                saveBtn.textContent = `Banning ${selectedTrains.length} trains...`;
                saveBtn.disabled = true;

                // Loop updates (Parallel)
                const promises = selectedTrains.map(tNum => {
                    const url = `https://metrorail-next-train-default-rtdb.firebaseio.com/exclusions/${rId}/${tNum}.json?auth=${secret}`;
                    return fetch(url, {
                        method: 'PUT',
                        body: JSON.stringify(updates[tNum])
                    });
                });

                await Promise.all(promises);

                showToast(`Updated ${selectedTrains.length} exclusions!`, "success");
                
                // Reset UI
                trainGrid.querySelectorAll('input').forEach(cb => cb.checked = false);
                document.getElementById('excl-train-manual').value = '';
                fetchExclusions();
                
                // Force refresh main app
                if (typeof loadAllSchedules === 'function') loadAllSchedules();

            } catch (e) {
                showToast("Network Error: " + e.message, "error");
            } finally {
                saveBtn.textContent = "Ban Selected Trains";
                saveBtn.disabled = false;
            }
        };

        // DELETE Helper
        Admin.deleteExclusion = async (rId, trainNum) => {
            if(!confirm(`Unban Train #${trainNum}?`)) return;
            const secret = localStorage.getItem('admin_firebase_key') || document.getElementById('alert-key').value.trim();
            if (!secret) { showToast("Key required.", "error"); return; }

            const url = `https://metrorail-next-train-default-rtdb.firebaseio.com/exclusions/${rId}/${trainNum}.json?auth=${secret}`;
            try {
                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    showToast("Unbanned.", "success");
                    fetchExclusions();
                    if (typeof loadAllSchedules === 'function') loadAllSchedules();
                } else {
                    showToast("Delete failed.", "error");
                }
            } catch(e) { showToast(e.message, "error"); }
        };
    }
};

// Auto-Init when DOM is ready (if script is loaded)
document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});