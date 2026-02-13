/**
 * METRORAIL NEXT TRAIN - ADMIN TOOLS (V5.00.01 - Guardian Edition)
 * --------------------------------------------
 * This module handles Developer Mode features:
 * 1. Service Alerts Manager (Tiered)
 * 2. Maintenance Mode Toggle
 * 3. PIN Unlock Logic & Signature Mgmt
 * 4. Simulation Controls
 * 5. Ghost Train Exclusion Manager
 */

const Admin = {
    
    // --- 0. CONFIGURATION ---
    DIRECTORY: {
        "101101": { name: "Enock", role: "Lead Developer" },
        "202626": { name: "Guest Admin", role: "Support" } // Scalable!
    },

    // --- 1. INITIALIZATION ---
    init: () => {
        Admin.setupPinAccess();
        Admin.setupSimulationControls();
        // Dynamic modules are lazy-loaded when the modal opens
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
                
                // GUARDIAN FIX: Calculate and Set Time BEFORE Auth Check
                const now = new Date();
                const timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
                
                // Pre-fill time input immediately (even if already logged in)
                if(simTimeInput) simTimeInput.value = timeString;

                // Check if already authenticated via session
                const sessionName = sessionStorage.getItem('admin_session_name');

                if (sessionName || window.isSimMode) {
                    if (devModal) {
                        devModal.classList.remove('hidden');
                        Admin.renderAdminModules(); // Load all dynamic cards
                    }
                    showToast("Developer Session Active", "info");
                } else {
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
                const enteredPin = pinInput.value;
                const adminUser = Admin.DIRECTORY[enteredPin];

                if (adminUser) {
                    pinModal.classList.add('hidden');
                    sessionStorage.setItem('admin_session_name', adminUser.name);
                    localStorage.setItem('analytics_ignore', 'true');
                    console.log(`🛡️ Guardian: Analytics filter enabled for ${adminUser.name} (${adminUser.role}).`);

                    const now = new Date();
                    const timeString = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
                    
                    // Also set here just in case pin was entered manually
                    if(simTimeInput) simTimeInput.value = timeString;

                    if (devModal) {
                        devModal.classList.remove('hidden');
                        Admin.renderAdminModules();
                    }
                    showToast(`Welcome back, ${adminUser.name}!`, "success");
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

        if (simApplyBtn) {
            simApplyBtn.addEventListener('click', () => {
                if (!simEnabledCheckbox || !simTimeInput) return;

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
                
                if (typeof updateTime === 'function') updateTime(); 
                if (typeof findNextTrains === 'function') findNextTrains();
            });
        }

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

    // --- HELPER: RENDER ALL DYNAMIC MODULES ---
    renderAdminModules: () => {
        Admin.setupServiceAlertsManager();
        Admin.setupExclusionManager();
        Admin.setupMaintenanceManager();
    },

    // --- 4. SERVICE ALERTS MANAGER (GUARDIAN CARD STYLE) ---
    setupServiceAlertsManager: () => {
        // We reuse the existing div from index.html if possible, or style it
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel) return;
        
        // Ensure strictly one initialization
        if (alertPanel.dataset.adminLoaded === "true") return;
        alertPanel.dataset.adminLoaded = "true";

        // Apply Guardian Card Classes to the container
        alertPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        // Inject Content
        alertPanel.innerHTML = `
            <button id="alert-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">📢</span> Service Alerts Manager</span>
                <svg id="alert-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="alert-body" class="hidden mt-4 space-y-4">
                
                <!-- Target Route -->
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Target Route</label>
                    <select id="alert-target" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="all">Global Alert (All Routes)</option>
                    </select>
                </div>

                <!-- Severity & Message -->
                <div class="grid grid-cols-1 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Severity</label>
                        <select id="alert-severity" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="info" selected>🔵 Info (General)</option>
                            <option value="warning">🟡 Warning (Delays)</option>
                            <option value="critical">🔴 Critical (Suspended)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Message</label>
                        <textarea id="alert-msg" rows="3" class="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="e.g. Delays of 45min due to cable theft..."></textarea>
                    </div>
                </div>

                <!-- Duration & Key -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Expiry Time</label>
                        <input type="datetime-local" id="alert-duration-custom" class="w-full h-10 px-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Admin Key</label>
                        <input type="password" id="alert-key" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="******">
                        <!-- Saved Key UI Injection Target -->
                        <div id="key-status-wrapper"></div> 
                    </div>
                </div>

                <div class="flex items-center">
                    <input type="checkbox" id="alert-remember" class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                    <label for="alert-remember" class="ml-2 text-[10px] font-medium text-gray-500 dark:text-gray-400">Remember Key</label>
                </div>

                <!-- Actions -->
                <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                     <button id="alert-send-btn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-sm transition-colors text-xs uppercase tracking-wide">
                        Post Alert
                    </button>
                    <button id="alert-clear-btn" class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-2.5 rounded-lg shadow-sm transition-colors text-xs uppercase tracking-wide">
                        Clear
                    </button>
                </div>
            </div>
        `;

        // --- Logic Wiring ---
        const header = document.getElementById('alert-header-btn');
        const body = document.getElementById('alert-body');
        const chevron = document.getElementById('alert-chevron');
        const alertTarget = document.getElementById('alert-target');
        const dateInput = document.getElementById('alert-duration-custom');
        const alertKey = document.getElementById('alert-key');
        const alertRemember = document.getElementById('alert-remember');
        const alertMsg = document.getElementById('alert-msg');
        const sendBtn = document.getElementById('alert-send-btn');
        const clearBtn = document.getElementById('alert-clear-btn');
        const severitySelect = document.getElementById('alert-severity');

        // Toggle
        header.onclick = () => {
            body.classList.toggle('hidden');
            if (body.classList.contains('hidden')) {
                chevron.classList.add('-rotate-90');
                header.classList.remove('mb-4');
            } else {
                chevron.classList.remove('-rotate-90');
                header.classList.add('mb-4');
            }
        };

        // Populate Targets
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

        // Default Time (2 hours)
        const now = new Date();
        now.setHours(now.getHours() + 2);
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        if(dateInput) dateInput.value = now.toISOString().slice(0, 16);

        // Key Persistence
        const savedKey = localStorage.getItem('admin_firebase_key');
        const keyWrapper = document.getElementById('key-status-wrapper');
        
        const showSavedMode = () => {
            if(!keyWrapper) return;
            keyWrapper.innerHTML = `
                <div class="flex items-center justify-between bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800 h-10 mt-0">
                    <span class="text-[10px] font-bold text-green-700 dark:text-green-400 flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Key Saved
                    </span>
                    <button id="alert-key-reset-btn" class="text-[10px] text-red-500 hover:text-red-700 dark:hover:text-red-300 font-bold underline">Reset</button>
                </div>
            `;
            alertKey.classList.add('hidden');
            
            document.getElementById('alert-key-reset-btn').onclick = (e) => {
                e.preventDefault();
                localStorage.removeItem('admin_firebase_key');
                alertKey.value = '';
                if(alertRemember) alertRemember.checked = false;
                keyWrapper.innerHTML = '';
                alertKey.classList.remove('hidden');
                showToast("Key cleared.", "info");
            };
        };

        if (savedKey) {
            alertKey.value = savedKey;
            if(alertRemember) alertRemember.checked = true;
            showSavedMode();
        }

        // Fetch Current Alert
        const fetchCurrentAlert = async (target) => {
            try {
                const res = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/notices/${target}.json?t=${Date.now()}`);
                const data = await res.json();
                
                if (data && data.message) {
                    const rawMsg = data.message.replace(/<br>/g, "\n").replace(/<b>/g, "*").replace(/<\/b>/g, "*").split("<br><br><span")[0]; 
                    alertMsg.value = rawMsg;
                    
                    if(data.expiresAt && dateInput) {
                        const expiryDate = new Date(data.expiresAt);
                        expiryDate.setMinutes(expiryDate.getMinutes() - expiryDate.getTimezoneOffset());
                        dateInput.value = expiryDate.toISOString().slice(0, 16);
                    }
                    if (severitySelect && data.severity) severitySelect.value = data.severity;
                    else if (severitySelect) severitySelect.value = 'info';

                    sendBtn.textContent = "Update Alert"; 
                } else {
                    alertMsg.value = "";
                    if(severitySelect) severitySelect.value = 'info';
                    sendBtn.textContent = "Post Alert";
                }
            } catch (e) { console.log("No active alert."); }
        };

        alertTarget.addEventListener('change', () => fetchCurrentAlert(alertTarget.value));
        fetchCurrentAlert('all'); // Default load

        // Actions
        sendBtn.onclick = async () => {
            let msg = alertMsg.value.trim();
            const secret = localStorage.getItem('admin_firebase_key') || alertKey.value.trim();
            const target = alertTarget.value;
            const severity = severitySelect.value;
            
            if (!msg || !secret) { showToast("Message and Key required!", "error"); return; }

            msg = msg.replace(/\n/g, "<br>").replace(/\*(.*?)\*/g, "<b>$1</b>");
            const author = sessionStorage.getItem('admin_session_name') || "Admin";
            msg += `<br><br><span class="opacity-75 text-xs">— ${author}</span>`;

            let expiresAtVal = dateInput && dateInput.value ? new Date(dateInput.value).getTime() : Date.now() + (2 * 3600 * 1000);

            if (alertRemember && alertRemember.checked) {
                localStorage.setItem('admin_firebase_key', secret);
                showSavedMode();
            }

            const payload = {
                id: Date.now().toString(), 
                message: msg,
                postedAt: Date.now(),
                expiresAt: expiresAtVal,
                severity: severity
            };

            const url = `https://metrorail-next-train-default-rtdb.firebaseio.com/notices/${target}.json?auth=${secret}`;

            try {
                sendBtn.textContent = "Posting...";
                sendBtn.disabled = true;
                const res = await fetch(url, { method: 'PUT', body: JSON.stringify(payload) });
                if (res.ok) {
                    showToast("Alert Posted!", "success");
                    if (typeof checkServiceAlerts === 'function') checkServiceAlerts(); 
                } else {
                    showToast("Failed. Check Key.", "error");
                }
            } catch (e) { showToast("Error: " + e.message, "error"); } 
            finally { sendBtn.textContent = "Update Alert"; sendBtn.disabled = false; }
        };

        clearBtn.onclick = async () => {
            const secret = localStorage.getItem('admin_firebase_key') || alertKey.value.trim();
            const target = alertTarget.value;
            if (!secret) { showToast("Key required.", "error"); return; }
            if(!confirm(`Delete alert for: ${target}?`)) return;

            const url = `https://metrorail-next-train-default-rtdb.firebaseio.com/notices/${target}.json?auth=${secret}`;
            try {
                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    showToast("Cleared!", "info");
                    alertMsg.value = "";
                    sendBtn.textContent = "Post Alert";
                    if (typeof checkServiceAlerts === 'function') setTimeout(checkServiceAlerts, 500); 
                } else { showToast("Failed.", "error"); }
            } catch (e) { showToast(e.message, "error"); }
        };
    },

    // --- 5. EXCLUSION MANAGER (GUARDIAN CARD + DIRECTION SUPPORT) ---
    setupExclusionManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel || !alertPanel.parentNode) return;

        let exclPanel = document.getElementById('exclusion-panel');
        if (!exclPanel) {
            exclPanel = document.createElement('div');
            exclPanel.id = 'exclusion-panel';
            alertPanel.parentNode.appendChild(exclPanel);
        }

        if (exclPanel.dataset.adminLoaded === "true") return;
        exclPanel.dataset.adminLoaded = "true";

        // Apply Guardian Card Classes
        exclPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        exclPanel.innerHTML = `
            <button id="excl-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">⛔</span> Schedule Exceptions</span>
                <svg id="excl-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="excl-body" class="hidden mt-4 space-y-3">
                <div class="flex space-x-2">
                    <select id="excl-route" class="w-2/3 h-10 px-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white outline-none">
                        <option value="">Select Route...</option>
                    </select>
                    <!-- NEW: Direction Switcher -->
                    <select id="excl-direction" class="w-1/3 h-10 px-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white outline-none">
                        <option value="A">To Dest A</option>
                        <option value="B">To Dest B</option>
                    </select>
                </div>

                <div class="flex space-x-2">
                    <select id="excl-schedule-type" class="w-2/3 h-10 px-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs outline-none text-gray-900 dark:text-white">
                        <option value="weekday">Weekday Schedule</option>
                        <option value="saturday">Saturday Schedule</option>
                        <option value="sunday">Sunday Schedule</option>
                    </select>
                    <button id="excl-load-trains-btn" class="w-1/3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold rounded-lg text-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">Load</button>
                </div>

                <div id="excl-train-picker" class="hidden border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-900">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Select Trains to Ban:</p>
                    <div id="excl-train-grid" class="grid grid-cols-4 gap-2 text-xs max-h-40 overflow-y-auto"></div>
                </div>

                <input id="excl-train-manual" type="text" placeholder="Or type manually (e.g. 4401)" class="w-full h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white outline-none hidden">
                
                <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span class="text-xs font-bold text-gray-500 mr-2">Exclude On:</span>
                    <div class="flex space-x-1" id="excl-days-container"></div>
                </div>

                <input id="excl-reason" type="text" placeholder="Reason (e.g. Testing)" class="w-full h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white outline-none">
                
                <button id="excl-save-btn" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors text-xs uppercase tracking-wide">
                    Ban Selected Trains
                </button>

                <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Active Exclusions:</p>
                    <div id="excl-list" class="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar"></div>
                </div>
            </div>
        `;

        // --- Wiring ---
        const header = document.getElementById('excl-header-btn');
        const body = document.getElementById('excl-body');
        const chevron = document.getElementById('excl-chevron');
        const routeSelect = document.getElementById('excl-route');
        const dirSelect = document.getElementById('excl-direction');
        const schedTypeSelect = document.getElementById('excl-schedule-type');
        const loadTrainsBtn = document.getElementById('excl-load-trains-btn');
        const trainGrid = document.getElementById('excl-train-grid');
        const pickerContainer = document.getElementById('excl-train-picker');
        const saveBtn = document.getElementById('excl-save-btn');
        const listDiv = document.getElementById('excl-list');
        const daysContainer = document.getElementById('excl-days-container');

        header.onclick = () => {
            body.classList.toggle('hidden');
            if (body.classList.contains('hidden')) {
                chevron.classList.add('-rotate-90');
                header.classList.remove('mb-4');
            } else {
                chevron.classList.remove('-rotate-90');
                header.classList.add('mb-4');
            }
        };

        // Populate Route Select
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

        // Update Direction Labels based on Route
        routeSelect.addEventListener('change', () => {
            const rId = routeSelect.value;
            if (rId && ROUTES[rId]) {
                const r = ROUTES[rId];
                dirSelect.options[0].textContent = `To ${r.destA.replace(' STATION','')}`;
                dirSelect.options[1].textContent = `To ${r.destB.replace(' STATION','')}`;
                // Trigger fetch existing exclusions
                fetchExclusions();
            } else {
                dirSelect.options[0].textContent = "To Dest A";
                dirSelect.options[1].textContent = "To Dest B";
            }
        });

        // Days Checkboxes
        const days = ['S','M','T','W','T','F','S'];
        days.forEach((d, idx) => {
            const label = document.createElement('label');
            label.className = "flex flex-col items-center cursor-pointer";
            label.innerHTML = `
                <input type="checkbox" value="${idx}" class="form-checkbox h-3 w-3 text-red-600 bg-white border-gray-300 rounded mb-1 focus:ring-0">
                <span class="text-[9px] font-bold text-gray-500">${d}</span>
            `;
            daysContainer.appendChild(label);
        });
        const getSelectedDays = () => Array.from(daysContainer.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

        // Load Trains Logic (With Direction Support)
        loadTrainsBtn.onclick = () => {
            const rId = routeSelect.value;
            const type = schedTypeSelect.value;
            const dir = dirSelect.value;

            if (!rId) { showToast("Select a route first", "error"); return; }
            const route = ROUTES[rId];
            if (!route) return;

            let sheetKey = null;
            if (type === 'weekday') {
                sheetKey = (dir === 'A') ? route.sheetKeys.weekday_to_a : route.sheetKeys.weekday_to_b;
            } else if (type === 'saturday') {
                sheetKey = (dir === 'A') ? route.sheetKeys.saturday_to_a : route.sheetKeys.saturday_to_b;
            } else if (type === 'sunday') {
                // Sunday usually uses Saturday key or separate, currently aliased to Saturday in logic but let's check
                sheetKey = (dir === 'A') ? route.sheetKeys.saturday_to_a : route.sheetKeys.saturday_to_b;
            }
            
            if (typeof fullDatabase === 'undefined' || !fullDatabase) {
                showToast("Database not ready. Refresh app.", "error");
                return;
            }

            const rawData = fullDatabase[sheetKey];
            if (!rawData) {
                showToast(`No data found for ${type}`, "error");
                return;
            }

            let trainNumbers = [];
            try {
                let headerRow = rawData.find(r => Object.values(r).some(v => String(v).includes('STATION')));
                if(!headerRow) headerRow = rawData[0]; 
                Object.keys(headerRow).forEach(k => {
                    if (k.match(/^\d{4}/)) trainNumbers.push(k);
                });
                // Fallback for messy data
                if (trainNumbers.length === 0 && rawData.length > 1) {
                    const sample = rawData[1];
                    Object.keys(sample).forEach(k => { if (k.match(/^\d{4}[a-zA-Z]*/)) trainNumbers.push(k); });
                }
            } catch(e) { console.log(e); }

            trainNumbers.sort();
            trainGrid.innerHTML = '';
            if (trainNumbers.length === 0) {
                trainGrid.innerHTML = '<div class="col-span-4 text-gray-400">No trains found.</div>';
            } else {
                trainNumbers.forEach(tNum => {
                    const div = document.createElement('div');
                    div.className = "flex items-center space-x-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer";
                    div.onclick = (e) => {
                        if (e.target.tagName !== 'INPUT') {
                            const cb = div.querySelector('input');
                            cb.checked = !cb.checked;
                        }
                    };
                    div.innerHTML = `
                        <input type="checkbox" value="${tNum}" class="rounded text-red-600 focus:ring-0 w-3 h-3 cursor-pointer">
                        <span class="font-mono text-gray-700 dark:text-gray-300">${tNum}</span>
                    `;
                    trainGrid.appendChild(div);
                });
            }
            pickerContainer.classList.remove('hidden');
        };

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
                    const dayLabels = item.days.map(d => days[d]).join('');
                    const row = document.createElement('div');
                    row.className = "flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs border border-gray-100 dark:border-gray-700";
                    row.innerHTML = `
                        <div>
                            <span class="font-bold text-red-600">#${trainNum}</span>
                            <span class="text-gray-400 mx-1">|</span>
                            <span class="text-gray-700 dark:text-gray-300 font-mono tracking-widest">[${dayLabels}]</span>
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

        saveBtn.onclick = async () => {
            const rId = routeSelect.value;
            const reason = document.getElementById('excl-reason').value.trim() || "Service Adjustment";
            const selectedDays = getSelectedDays();
            const secret = localStorage.getItem('admin_firebase_key') || document.getElementById('alert-key').value.trim();
            const selectedTrains = Array.from(trainGrid.querySelectorAll('input:checked')).map(cb => cb.value);
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

            const updates = {};
            selectedTrains.forEach(tNum => {
                updates[`${tNum}`] = {
                    days: selectedDays,
                    reason: reason,
                    updatedAt: Date.now()
                };
            });

            try {
                saveBtn.textContent = `Banning ${selectedTrains.length} trains...`;
                saveBtn.disabled = true;
                const promises = selectedTrains.map(tNum => {
                    const url = `https://metrorail-next-train-default-rtdb.firebaseio.com/exclusions/${rId}/${tNum}.json?auth=${secret}`;
                    return fetch(url, { method: 'PUT', body: JSON.stringify(updates[tNum]) });
                });
                await Promise.all(promises);
                showToast(`Updated ${selectedTrains.length} exclusions!`, "success");
                trainGrid.querySelectorAll('input').forEach(cb => cb.checked = false);
                document.getElementById('excl-train-manual').value = '';
                fetchExclusions();
                if (typeof loadAllSchedules === 'function') loadAllSchedules();
            } catch (e) {
                showToast("Network Error: " + e.message, "error");
            } finally {
                saveBtn.textContent = "Ban Selected Trains";
                saveBtn.disabled = false;
            }
        };

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
                } else { showToast("Delete failed.", "error"); }
            } catch(e) { showToast(e.message, "error"); }
        };
    },

    // --- 6. MAINTENANCE MODE MANAGER (GUARDIAN CARD STYLE) ---
    setupMaintenanceManager: () => {
        const exclusionPanel = document.getElementById('exclusion-panel');
        if (!exclusionPanel || !exclusionPanel.parentNode) return;

        let maintPanel = document.getElementById('maint-panel');
        if (!maintPanel) {
            maintPanel = document.createElement('div');
            maintPanel.id = 'maint-panel';
            exclusionPanel.parentNode.appendChild(maintPanel);
        }

        if (maintPanel.dataset.loaded === "true") return;
        maintPanel.dataset.loaded = "true";

        // Apply Guardian Card Classes
        maintPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        maintPanel.innerHTML = `
            <button id="maint-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">🛠️</span> System Controls</span>
                <svg id="maint-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="maint-body" class="hidden mt-4">
                <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="font-bold text-orange-800 dark:text-orange-200 text-sm">Maintenance Mode</span>
                            <p class="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5">Shows yellow warning banner to online users.</p>
                        </div>
                        <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" name="toggle" id="maint-toggle" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer outline-none"/>
                            <label for="maint-toggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .toggle-checkbox:checked { right: 0; border-color: #f97316; }
                .toggle-checkbox:checked + .toggle-label { background-color: #f97316; }
                .toggle-checkbox { right: 16px; transition: all 0.3s; }
            </style>
        `;

        const header = document.getElementById('maint-header-btn');
        const body = document.getElementById('maint-body');
        const chevron = document.getElementById('maint-chevron');
        const toggle = document.getElementById('maint-toggle');

        header.onclick = () => {
            body.classList.toggle('hidden');
            if (body.classList.contains('hidden')) {
                chevron.classList.add('-rotate-90');
                header.classList.remove('mb-4');
            } else {
                chevron.classList.remove('-rotate-90');
                header.classList.add('mb-4');
            }
        };
        
        // 1. Check Current Status
        const checkStatus = async () => {
            try {
                const res = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/config/maintenance.json`);
                const isActive = await res.json();
                toggle.checked = !!isActive;
            } catch(e) { console.warn("Failed to check maintenance status"); }
        };
        checkStatus();

        // 2. Toggle Handler
        toggle.addEventListener('change', async () => {
            const secret = localStorage.getItem('admin_firebase_key') || document.getElementById('alert-key').value.trim();
            if (!secret) {
                showToast("Admin Key required to change system status.", "error");
                toggle.checked = !toggle.checked; // Revert UI
                return;
            }

            const newState = toggle.checked;
            try {
                const res = await fetch(`https://metrorail-next-train-default-rtdb.firebaseio.com/config/maintenance.json?auth=${secret}`, {
                    method: 'PUT',
                    body: JSON.stringify(newState)
                });
                if(res.ok) {
                    showToast(`Maintenance Mode: ${newState ? "ON" : "OFF"}`, newState ? "warning" : "success");
                } else {
                    throw new Error("Auth failed");
                }
            } catch(e) {
                showToast("Failed to update status.", "error");
                toggle.checked = !toggle.checked; // Revert
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});