/**
 * METRORAIL NEXT TRAIN - ADMIN TOOLS (V4.60.50)
 * --------------------------------------------
 * This module handles Developer Mode features:
 * 1. Service Alerts Manager (Write Access)
 * 2. PIN Unlock Logic & Signature Mgmt
 * 3. Simulation Controls
 * * * PART OF PHASE 1: MODULARIZATION
 */

const Admin = {
    
    // --- 1. INITIALIZATION ---
    init: () => {
        Admin.setupPinAccess();
        Admin.setupSimulationControls();
        // Service Alerts Manager is lazy-loaded when the modal opens
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

    // --- 4. SERVICE ALERTS MANAGER (The Complex Part) ---
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
            // 1. Convert Newlines to <br>
            msg = msg.replace(/\n/g, "<br>");
            // 2. Convert *bold* to <b>bold</b>
            msg = msg.replace(/\*(.*?)\*/g, "<b>$1</b>");
            
            // 3. Append Signature
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
                    // Assuming checkServiceAlerts is global (read-only version in ui.js)
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
                    showToast("Failed to clear.", "error");
                }
            } catch (e) {
                showToast("Error: " + e.message, "error");
            }
        };
    }
};

// Auto-Init when DOM is ready (if script is loaded)
document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});