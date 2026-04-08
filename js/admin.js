/**
 * METRORAIL NEXT TRAIN - ADMIN TOOLS (V6.04.08 - Guardian Enterprise Edition)
 * --------------------------------------------
 * This module handles Developer Mode features:
 * 1. Service Alerts Manager (Tiered & Regional - Restored)
 * 2. Maintenance Mode Toggle
 * 3. Enterprise Login Logic & Token Mgmt (Phase 9)
 * 4. Simulation Controls
 * 5. Exceptions Manager (Deep Scan + Banned/Special Types)
 * 6. Special Event Route Manager
 * 7. System Health / Diagnostics Scanner (Phase 2 - New)
 * 8. Nuclear Cache Wipe (Killswitch - New)
 * 9. Live Telemetry Bridge (Cloudflare Path B - New)
 * 10. User Feedback Manager (In-House Pipeline)
 * * * GUARDIAN PHASE 12: Added SPL (Special) tagging to exclusions manager and live sync timestamps.
 */

const Admin = {
    
    // --- 0.1 GLOBAL AUTH KEY HELPER (GUARDIAN PHASE 9) ---
    getAuthKey: async () => {
        if (window.firebaseAuth && window.firebaseAuth.currentUser) {
            try {
                // Force token refresh to ensure it's valid for database rules
                return await window.firebaseGetIdToken(window.firebaseAuth.currentUser, true);
            } catch(e) {
                console.warn("🛡️ Guardian: Failed to securely fetch ID Token", e);
                return null;
            }
        }
        return null;
    },

    currentUser: null,
    telemetryInterval: null, // GUARDIAN: Polling tracker for analytics

    // --- 0.2 TELEMETRY REFRESH ENGINE ---
    refreshTelemetry: async () => {
        const stat5m = document.getElementById('stat-5m');
        const stat30m = document.getElementById('stat-30m');
        const statToday = document.getElementById('stat-today');
        const statAllTime = document.getElementById('stat-alltime');
        const statErrors = document.getElementById('stat-errors');
        const syncEl = document.getElementById('telemetry-last-sync'); // GUARDIAN: Live Sync Timestamp
        
        // Guard: Only fetch if the modal is currently open to save bandwidth
        const devModal = document.getElementById('dev-modal');
        if (devModal && devModal.classList.contains('hidden')) {
            // GUARDIAN FIX: Kill the interval entirely to prevent background data drain
            if (Admin.telemetryInterval) {
                clearInterval(Admin.telemetryInterval);
                Admin.telemetryInterval = null;
                console.log("🛡️ Guardian: Dev Modal closed. Telemetry polling suspended.");
            }
            return;
        }

        // Secure validation: Worker will reject queries without a valid Admin Auth token
        const secret = await Admin.getAuthKey();
        if (!secret) return;

        // Visual feedback that a fresh pull is happening (Instantly on 5-tap)
        [stat5m, stat30m, statToday, statAllTime, statErrors].forEach(el => {
            if (el && !el.classList.contains('animate-pulse')) el.classList.add('animate-pulse');
        });

        // GUARDIAN: Updated to the live production worker URL
        const CLOUDFLARE_WORKER_URL = 'https://nexttrain-telemetry.enock.workers.dev/';
        
        try {
            const res = await fetch(CLOUDFLARE_WORKER_URL, {
                headers: { 'Authorization': `Bearer ${secret}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                
                if(stat5m) stat5m.textContent = data.active5m !== undefined ? data.active5m : '--';
                if(stat30m) stat30m.textContent = data.active30m !== undefined ? data.active30m : '--';
                if(statToday) statToday.textContent = data.todayUsers !== undefined ? data.todayUsers : '--';
                if(statAllTime) statAllTime.textContent = data.allTimeUsers !== undefined ? data.allTimeUsers : '--';
                if(statErrors) statErrors.textContent = data.todayErrors !== undefined ? data.todayErrors : '--';
                
                // GUARDIAN: Inject explicit last updated timestamp into the UI
                if (syncEl) {
                    syncEl.classList.remove('hidden');
                    const now = new Date();
                    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                    syncEl.textContent = `synced: ${timeStr}`;
                }

                // Kill pulse animations once data streams successfully
                [stat5m, stat30m, statToday, statAllTime, statErrors].forEach(el => {
                    if(el) el.classList.remove('animate-pulse');
                });
            } else {
                throw new Error("Worker returned status: " + res.status);
            }
        } catch(e) {
            console.warn("🛡️ Telemetry Fetch Failed (Expected until Backend Worker is deployed):", e.message);
            
            if(stat5m && stat5m.textContent === '--') stat5m.textContent = "Wait";
            if(stat30m && stat30m.textContent === '--') stat30m.textContent = "Wait";
            if(statToday && statToday.textContent === '--') statToday.textContent = "Wait";
            if(statAllTime && statAllTime.textContent === '--') statAllTime.textContent = "Wait";
            if(statErrors && statErrors.textContent === '--') statErrors.textContent = "Wait";

            // Cleanup animations on fail
            [stat5m, stat30m, statToday, statAllTime, statErrors].forEach(el => {
                if(el) el.classList.remove('animate-pulse');
            });
        }
    },

    // --- 1. INITIALIZATION ---
    init: () => {
        // Listen for Firebase initialization from index.html
        window.addEventListener('firebase-auth-ready', () => {
            Admin.setupAuthListener();
            Admin.setupLoginAccess();
            Admin.setupSimulationControls();
        });
        
        // Fallback in case the event fired before this script parsed
        if (window.firebaseAuth) {
            Admin.setupAuthListener();
            Admin.setupLoginAccess();
            Admin.setupSimulationControls();
        }
    },

    // --- 2. AUTH LISTENER (PHASE 9) ---
    setupAuthListener: () => {
        // 🛡️ GUARDIAN FIX: Crash Immunity. Stop execution immediately if Firebase failed to initialize
        if (typeof window.firebaseOnAuthStateChanged !== 'function') {
            console.warn("🛡️ Guardian: Firebase Auth not loaded. Skipping auth listener to prevent crash.");
            return;
        }

        window.firebaseOnAuthStateChanged(window.firebaseAuth, (user) => {
            const signoutContainer = document.getElementById('admin-signout-container');
            
            if (user) {
                console.log("🛡️ Guardian: Admin Authenticated. Analytics blocked.");
                localStorage.setItem('analytics_ignore', 'true');
                Admin.currentUser = user;
                
                // Inject Sign Out button into the Dev Modal
                if (signoutContainer) {
                    signoutContainer.innerHTML = `
                        <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <p class="text-xs text-gray-500 mb-2 text-center">Logged in as: ${user.email}</p>
                            <button id="admin-signout-btn" class="w-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold py-3 rounded-lg shadow-sm transition-colors text-sm focus:outline-none">
                                Secure Sign Out
                            </button>
                        </div>
                    `;
                    document.getElementById('admin-signout-btn').addEventListener('click', () => {
                        window.firebaseSignOut(window.firebaseAuth).then(() => {
                            showToast("Signed out successfully.", "success");
                            closeSmoothModal('dev-modal');
                        });
                    });
                }
            } else {
                console.log("🛡️ Guardian: Admin Logged Out. Analytics restored.");
                localStorage.removeItem('analytics_ignore');
                Admin.currentUser = null;
                if (signoutContainer) signoutContainer.innerHTML = '';
            }
        });
    },

    // --- 2.5 ENTERPRISE LOGIN ACCESS ---
    setupLoginAccess: () => {
        const appTitle = document.getElementById('app-title');
        const loginModal = document.getElementById('login-modal');
        const emailInput = document.getElementById('admin-email');
        const passInput = document.getElementById('admin-password');
        const loginBtn = document.getElementById('admin-login-btn');
        const cancelBtn = document.getElementById('admin-cancel-btn');
        const spinner = document.getElementById('admin-login-spinner');
        const devModal = document.getElementById('dev-modal');

        if (!appTitle) return;

        let clickCount = 0;
        let clickTimer = null;

        appTitle.style.cursor = 'pointer'; 
        appTitle.title = "Developer Access";

        // 5-Tap Trigger
        appTitle.addEventListener('click', (e) => {
            e.preventDefault(); 
            clickCount++;
            
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 2000); 
            
            if (clickCount >= 5) {
                clickCount = 0;
                
                // If already logged in via Firebase Auth, bypass modal directly to hub
                if (Admin.currentUser || window.isSimMode) {
                    if (devModal) {
                        devModal.classList.remove('hidden');
                        Admin.renderAdminModules(); 
                        Admin.initAutoSim(); 
                    }
                    showToast("Developer Session Active", "info");
                } else {
                    if (loginModal) {
                        loginModal.classList.remove('hidden');
                        if(emailInput) emailInput.focus();
                    }
                }
            }
        });

        // Form Logic
        if (cancelBtn) cancelBtn.addEventListener('click', () => { loginModal.classList.add('hidden'); });
        
        if (passInput) {
            passInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && loginBtn) loginBtn.click();
            });
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                const email = emailInput.value.trim();
                const password = passInput.value;

                if (!email || !password) {
                    showToast("Enter email and password", "error");
                    return;
                }

                if (spinner) spinner.classList.remove('hidden');
                loginBtn.disabled = true;

                window.firebaseSignIn(window.firebaseAuth, email, password)
                    .then((userCredential) => {
                        loginModal.classList.add('hidden');
                        passInput.value = ''; // Clean up password field
                        if (devModal) {
                            devModal.classList.remove('hidden');
                            Admin.renderAdminModules();
                            Admin.initAutoSim(); 
                        }
                        showToast(`Welcome back!`, "success");
                    })
                    .catch((error) => {
                        showToast("Authentication Failed", "error");
                        console.error("🛡️ Guardian Login Error:", error);
                    })
                    .finally(() => {
                        if (spinner) spinner.classList.add('hidden');
                        loginBtn.disabled = false;
                    });
            });
        }
    },

    // --- 2.8 AUTO-SIM INITIALIZATION (GUARDIAN UPGRADE) ---
    initAutoSim: () => {
        const simEnabledCheckbox = document.getElementById('sim-enabled');
        const simTimeInput = document.getElementById('sim-time');
        const dayDropdown = document.getElementById('sim-day');
        const dateContainer = document.getElementById('sim-date-container');
        const dateInput = document.getElementById('sim-date');

        const now = new Date();
        
        // 1. Enable Checkbox
        if (simEnabledCheckbox) simEnabledCheckbox.checked = true;
        
        // 2. Set Exact Current Time
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const timeString = `${h}:${m}:${s}`;
        
        if (simTimeInput) simTimeInput.value = timeString;
        
        // 3. Set Specific Date Dropdown & Inputs
        if (dayDropdown) {
            dayDropdown.value = 'specific';
            if (dateContainer) dateContainer.classList.remove('hidden');
        }
        
        if (dateInput) {
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        }

        // 4. Activate Simulation Globally Instantly
        window.isSimMode = true;
        window.simTimeStr = timeString;
        window.simDayIndex = now.getDay();
        
        if (typeof updateTime === 'function') updateTime(); 
        if (typeof findNextTrains === 'function') findNextTrains();
    },

    // --- 2.9 LIVE TELEMETRY (CLOUD WORKER BRIDGE - NEW) ---
    setupTelemetry: () => {
        const telPanel = document.getElementById('telemetry-panel');
        if (!telPanel) return;

        // If the Dev modal is opened again during the same session, bypass complete re-initialization
        // and instantly force a visual data refresh.
        if (telPanel.dataset.adminLoaded === "true") {
            // GUARDIAN FIX: Ensure the interval restarts if it was previously killed by closing the modal
            if (!Admin.telemetryInterval) {
                Admin.telemetryInterval = setInterval(Admin.refreshTelemetry, 10000);
            }
            Admin.refreshTelemetry();
            return;
        }
        telPanel.dataset.adminLoaded = "true";

        // Fire instantly upon absolute first setup
        Admin.refreshTelemetry();

        // Auto-refresh every 10 seconds (Down from 30s)
        if (Admin.telemetryInterval) clearInterval(Admin.telemetryInterval);
        Admin.telemetryInterval = setInterval(Admin.refreshTelemetry, 10000);
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
        Admin.setupTelemetry();
        Admin.setupFeedbackManager(); // NEW: In-House Feedback Hub
        Admin.setupServiceAlertsManager();
        Admin.setupExclusionManager();
        Admin.setupMaintenanceManager();
        Admin.setupSpecialEventManager(); 
        Admin.setupDiagnosticsManager(); 
        Admin.setupNuclearManager(); 
    },

    // --- 3.5 FEEDBACK MANAGER (NEW: IN-HOUSE PIPELINE) ---
    setupFeedbackManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        // Ensure we find the simulation panel to inject feedback above/below cleanly
        const simPanel = document.getElementById('simulation-panel');
        if (!alertPanel || !alertPanel.parentNode) return;

        let fbPanel = document.getElementById('feedback-panel');
        if (!fbPanel) {
            fbPanel = document.createElement('div');
            fbPanel.id = 'feedback-panel';
            alertPanel.parentNode.insertBefore(fbPanel, alertPanel); // Place right above alerts
        }

        if (fbPanel.dataset.adminLoaded === "true") return;
        fbPanel.dataset.adminLoaded = "true";

        fbPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        fbPanel.innerHTML = `
            <button id="fb-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">💬</span> Commuter Feedback</span>
                <svg id="fb-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="fb-body" class="hidden mt-4 space-y-4">
                <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700 shadow-inner">
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1" id="fb-count-display">Inbox: Loading...</span>
                    <button id="fb-refresh-btn" class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 border border-blue-200 dark:border-blue-800 rounded px-2 py-1 text-[10px] font-bold transition-colors shadow-sm focus:outline-none">
                        Refresh Inbox
                    </button>
                </div>
                
                <div id="fb-list" class="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar"></div>
            </div>
        `;

        const header = document.getElementById('fb-header-btn');
        const body = document.getElementById('fb-body');
        const chevron = document.getElementById('fb-chevron');
        const refreshBtn = document.getElementById('fb-refresh-btn');
        const listContainer = document.getElementById('fb-list');
        const countDisplay = document.getElementById('fb-count-display');

        header.onclick = () => {
            body.classList.toggle('hidden');
            if (body.classList.contains('hidden')) {
                chevron.classList.add('-rotate-90');
                header.classList.remove('mb-4');
            } else {
                chevron.classList.remove('-rotate-90');
                header.classList.add('mb-4');
                Admin.fetchFeedback(); // Auto-fetch on open
            }
        };

        refreshBtn.onclick = () => Admin.fetchFeedback();

        Admin.fetchFeedback = async () => {
            const secret = await Admin.getAuthKey();
            if (!secret) return;

            listContainer.innerHTML = '<div class="text-xs text-gray-500 italic text-center py-4">Checking database...</div>';
            countDisplay.textContent = "Inbox: Syncing...";

            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}feedback.json?auth=${secret}&orderBy="$key"`);
                
                if (!res.ok) throw new Error("Failed to fetch feedback");
                
                const data = await res.json();
                listContainer.innerHTML = '';

                if (!data) {
                    listContainer.innerHTML = '<div class="text-xs text-gray-500 italic text-center py-4">Inbox is completely clean! ✨</div>';
                    countDisplay.textContent = "Inbox: 0";
                    return;
                }

                // Convert object to array and sort newest first
                const feedbackArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                feedbackArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                countDisplay.textContent = `Inbox: ${feedbackArray.length}`;

                feedbackArray.forEach(item => {
                    const date = new Date(item.timestamp || Date.now());
                    const dateStr = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                    
                    let badgeClass = "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600";
                    let typeLabel = "General";
                    
                    if (item.type === 'schedule_error') { badgeClass = "bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"; typeLabel = "⏱️ Schedule Error"; }
                    else if (item.type === 'bug') { badgeClass = "bg-orange-50 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"; typeLabel = "🐛 App Bug"; }
                    else if (item.type === 'suggestion') { badgeClass = "bg-purple-50 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"; typeLabel = "💡 Suggestion"; }

                    const emailDisplay = item.email ? `<a href="mailto:${item.email}" class="text-blue-500 dark:text-blue-400 hover:underline">${item.email}</a>` : "Anonymous User";
                    const attachmentHtml = item.attachmentUrl 
                        ? `<a href="${item.attachmentUrl}" target="_blank" class="flex items-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors text-[10px] font-bold"><span class="mr-1">📎</span> View File</a>`
                        : `<div></div>`;

                    // Escape HTML for text to prevent XSS in admin panel
                    const safeText = item.text ? item.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") : "No content";

                    const card = document.createElement('div');
                    card.className = "bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col";
                    card.innerHTML = `
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${badgeClass}">${typeLabel}</span>
                            <span class="text-[9px] text-gray-400 dark:text-gray-500 font-mono">${dateStr}</span>
                        </div>
                        
                        <p class="text-xs text-gray-700 dark:text-gray-200 mb-3 leading-relaxed">${safeText}</p>
                        
                        <div class="flex justify-between items-end border-t border-gray-200 dark:border-gray-800 pt-2 mt-auto">
                            <div class="flex flex-col">
                                <span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium mb-0.5">${emailDisplay}</span>
                                <span class="text-[8px] text-gray-400 dark:text-gray-600 font-mono">App: ${item.appVersion || 'Unknown'} | Route: ${item.routeId || 'None'}</span>
                            </div>
                            <div class="flex items-center space-x-2">
                                ${attachmentHtml}
                                <button class="text-green-600 dark:text-green-500 hover:text-white hover:bg-green-600 text-[10px] font-bold bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-2 py-1 rounded transition-colors focus:outline-none" onclick="Admin.resolveFeedback('${item.id}')">
                                    Resolve
                                </button>
                            </div>
                        </div>
                    `;
                    listContainer.appendChild(card);
                });

            } catch (e) {
                console.error(e);
                listContainer.innerHTML = '<div class="text-xs text-red-500 text-center py-4">Failed to load feedback.</div>';
            }
        };

        Admin.resolveFeedback = async (id) => {
            if (!confirm("Mark this feedback as resolved and archive it?")) return;
            
            const secret = await Admin.getAuthKey();
            if (!secret) return;

            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                
                // Delete from active queue
                const res = await fetch(`${dynamicEndpoint}feedback/${id}.json?auth=${secret}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    if (typeof showToast === 'function') showToast("Feedback resolved!", "success");
                    Admin.fetchFeedback(); // Refresh list
                } else {
                    throw new Error("Failed to delete");
                }
            } catch (e) {
                if (typeof showToast === 'function') showToast("Error resolving feedback.", "error");
            }
        };
    },

    // --- 4. SERVICE ALERTS MANAGER (GUARDIAN CARD STYLE + REGION SYNC) ---
    setupServiceAlertsManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel) return;
        
        // Ensure strictly one initialization
        if (alertPanel.dataset.adminLoaded === "true") return;
        alertPanel.dataset.adminLoaded = "true";

        // Apply Guardian Card Classes to the container
        alertPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        // GUARDIAN Phase 10: Injected Privacy Sign-off & Force Popup controls
        alertPanel.innerHTML = `
            <button id="alert-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">📢</span> Service Alerts Manager</span>
                <svg id="alert-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="alert-body" class="hidden mt-4 space-y-4">
                
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Target Region</label>
                    <select id="alert-region" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="GP">Gauteng</option>
                        <option value="WC">Western Cape</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Target Route</label>
                    <select id="alert-target" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                        </select>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Severity</label>
                        <select id="alert-severity" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="info" selected>🔵 Info (General)</option>
                            <option value="warning">🟡 Warning (Delays)</option>
                            <option value="critical">🔴 Critical (Suspended)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Sign-off Name</label>
                        <input type="text" id="alert-signoff" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Next Train Ops" value="Next Train Ops">
                    </div>
                </div>

                <div class="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div>
                        <span class="font-bold text-blue-800 dark:text-blue-200 text-sm">Force Popup Alert</span>
                        <p class="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Auto-opens modal on user screen</p>
                    </div>
                    <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id="alert-force-popup" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer outline-none"/>
                        <label for="alert-force-popup" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Message</label>
                    <textarea id="alert-msg" rows="3" class="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="e.g. Delays of 45min due to cable theft..."></textarea>
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Expiry Time</label>
                    <input type="datetime-local" id="alert-duration-custom" class="w-full h-10 px-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                </div>

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
        const regionSelect = document.getElementById('alert-region');
        const alertTarget = document.getElementById('alert-target');
        const dateInput = document.getElementById('alert-duration-custom');
        const alertMsg = document.getElementById('alert-msg');
        const sendBtn = document.getElementById('alert-send-btn');
        const clearBtn = document.getElementById('alert-clear-btn');
        const severitySelect = document.getElementById('alert-severity');
        
        // NEW: Privacy Controls
        const signoffInput = document.getElementById('alert-signoff');
        const forcePopupToggle = document.getElementById('alert-force-popup');

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

        // Fetch Current Alert
        async function fetchCurrentAlert(target) {
            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}notices/${target}.json?t=${Date.now()}`);
                const data = await res.json();
                
                if (data && data.message) {
                    // GUARDIAN PHASE 1: Aggressive Regex Cleanup
                    let cleanedMsg = data.message;
                    // Strip out the appended signature (e.g., <br><br><span class="opacity-75...">— Ops</span>) from the absolute end
                    cleanedMsg = cleanedMsg.replace(/(<br\s*\/?>\s*){1,2}<span[^>]*>.*?<\/span>\s*$/i, '');
                    // Fallback catch if there are no line breaks before the span
                    cleanedMsg = cleanedMsg.replace(/<span[^>]*>.*?<\/span>\s*$/i, '');
                    
                    // Convert remaining HTML back to editing text
                    cleanedMsg = cleanedMsg.replace(/<br\s*\/?>/gi, "\n").replace(/<b>/gi, "*").replace(/<\/b>/gi, "*");
                    alertMsg.value = cleanedMsg.trim();
                    
                    if(data.expiresAt && dateInput) {
                        const expiryDate = new Date(data.expiresAt);
                        expiryDate.setMinutes(expiryDate.getMinutes() - expiryDate.getTimezoneOffset()); 
                        dateInput.value = expiryDate.toISOString().slice(0, 16);
                    }
                    if (severitySelect && data.severity) severitySelect.value = data.severity;
                    else if (severitySelect) severitySelect.value = 'info';

                    // Parse saved preferences
                    if (data.authorName) signoffInput.value = data.authorName;
                    else signoffInput.value = "Next Train Ops";

                    if (data.forcePopup !== undefined) forcePopupToggle.checked = data.forcePopup;
                    else forcePopupToggle.checked = (data.severity === 'critical'); // Backwards compatibility for old alerts

                    sendBtn.textContent = "Update Alert"; 
                } else {
                    alertMsg.value = "";
                    if(severitySelect) severitySelect.value = 'info';
                    signoffInput.value = "Next Train Ops";
                    forcePopupToggle.checked = false;
                    sendBtn.textContent = "Post Alert";
                }
            } catch (e) { console.log("No active alert."); }
        }

        // Populate Targets Based on Region
        if (typeof currentRegion !== 'undefined') regionSelect.value = currentRegion;

        function populateTargets() {
            alertTarget.innerHTML = '';
            const reg = regionSelect.value;
            const globalOpt = document.createElement('option');
            globalOpt.value = `all_${reg}`;
            globalOpt.textContent = `🌐 Global Alert (${reg === 'GP' ? 'Gauteng' : 'Western Cape'})`;
            globalOpt.style.fontWeight = 'bold';
            alertTarget.appendChild(globalOpt);

            if (typeof ROUTES !== 'undefined') {
                Object.values(ROUTES).forEach(r => {
                    if (r.isActive && r.region === reg) {
                        const opt = document.createElement('option');
                        opt.value = r.id;
                        opt.textContent = `📍 ${r.name}`;
                        alertTarget.appendChild(opt);
                    }
                });
            }
            fetchCurrentAlert(alertTarget.value);
        }

        regionSelect.addEventListener('change', populateTargets);
        alertTarget.addEventListener('change', () => fetchCurrentAlert(alertTarget.value));
        
        // Initial Population
        populateTargets();

        const now = new Date();
        now.setHours(23, 59, 59, 999);
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); 
        if(dateInput) dateInput.value = now.toISOString().slice(0, 16);

        // Actions
        sendBtn.onclick = async () => {
            let msg = alertMsg.value.trim();
            const target = alertTarget.value;
            const severity = severitySelect.value;
            
            const signoff = signoffInput.value.trim() || "Next Train Ops";
            const isForcePopup = forcePopupToggle.checked;
            
            const secret = await Admin.getAuthKey();
            
            if (!msg) { showToast("Message required!", "error"); return; }
            if (!secret) { showToast("Authentication required! Sign in again.", "error"); return; }

            msg = msg.replace(/\n/g, "<br>").replace(/\*(.*?)\*/g, "<b>$1</b>");
            
            // GUARDIAN: Injecting the generic/safe sign-off
            msg += `<br><br><span class="opacity-75 text-[10px] uppercase font-bold tracking-wider">— ${signoff}</span>`;

            let expiresAtVal = dateInput && dateInput.value ? new Date(dateInput.value).getTime() : Date.now() + (2 * 3600 * 1000);

            const payload = {
                id: Date.now().toString(), 
                message: msg,
                authorName: signoff,       // Save to database
                forcePopup: isForcePopup,  // Save to database
                postedAt: Date.now(),
                expiresAt: expiresAtVal,
                severity: severity
            };

            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const url = `${dynamicEndpoint}notices/${target}.json?auth=${secret}`;

            try {
                sendBtn.textContent = "Posting...";
                sendBtn.disabled = true;
                const res = await fetch(url, { method: 'PUT', body: JSON.stringify(payload) });
                if (res.ok) {
                    showToast("Alert Posted!", "success");
                    if (typeof checkServiceAlerts === 'function') checkServiceAlerts(); 
                } else {
                    showToast("Failed. Check Session.", "error");
                }
            } catch (e) { showToast("Error: " + e.message, "error"); } 
            finally { sendBtn.textContent = "Update Alert"; sendBtn.disabled = false; }
        };

        // GUARDIAN PHASE 1: Archive Protocol Injection
        clearBtn.onclick = async () => {
            const target = alertTarget.value;
            const secret = await Admin.getAuthKey();
            if (!secret) { showToast("Authentication required.", "error"); return; }
            if(!confirm(`Delete alert for: ${target}?`)) return;

            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const url = `${dynamicEndpoint}notices/${target}.json?auth=${secret}`;
            
            try {
                // 1. Fetch exact payload before deletion for the Archive
                const fetchRes = await fetch(`${dynamicEndpoint}notices/${target}.json`);
                if (fetchRes.ok) {
                    const alertData = await fetchRes.json();
                    if (alertData && alertData.id) {
                        alertData.archivedAt = Date.now();
                        alertData.clearedFrom = target;
                        // 2. Save it to notices_archive node safely
                        const archiveUrl = `${dynamicEndpoint}notices_archive/${alertData.id}_${Date.now()}.json?auth=${secret}`;
                        await fetch(archiveUrl, { method: 'PUT', body: JSON.stringify(alertData) });
                    }
                }

                // 3. Proceed with deletion from active node
                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    showToast("Cleared & Archived!", "info");
                    alertMsg.value = "";
                    signoffInput.value = "Next Train Ops";
                    forcePopupToggle.checked = false;
                    sendBtn.textContent = "Post Alert";
                    if (typeof checkServiceAlerts === 'function') setTimeout(checkServiceAlerts, 500); 
                } else { showToast("Failed to clear alert.", "error"); }
            } catch (e) { showToast(e.message, "error"); }
        };
    },

    // --- 5. EXCLUSION MANAGER (GUARDIAN CARD + DEEP ROW SCANNER + SPL TAGS) ---
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
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Select Trains:</p>
                    <div id="excl-train-grid" class="grid grid-cols-4 gap-2 text-xs max-h-40 overflow-y-auto"></div>
                </div>

                <input id="excl-train-manual" type="text" placeholder="Or type manually (e.g. 4401)" class="w-full h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white outline-none hidden">
                
                <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span class="text-xs font-bold text-gray-500 mr-2">Apply To:</span>
                    <div class="flex space-x-1" id="excl-days-container"></div>
                </div>

                <!-- GUARDIAN PHASE 12: Banned vs Special Tag Toggle -->
                <div class="flex space-x-2 mt-2 mb-2">
                    <label class="flex-1 flex items-center justify-center p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg cursor-pointer transition-colors">
                        <input type="radio" name="excl-type" value="banned" checked class="form-radio h-3 w-3 text-red-600 bg-white border-gray-300 focus:ring-0">
                        <span class="text-[10px] font-bold text-red-700 dark:text-red-300 ml-1.5 uppercase tracking-wide">Ban Train</span>
                    </label>
                    <label class="flex-1 flex items-center justify-center p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg cursor-pointer transition-colors">
                        <input type="radio" name="excl-type" value="special" class="form-radio h-3 w-3 text-green-600 bg-white border-gray-300 focus:ring-0">
                        <span class="text-[10px] font-bold text-green-700 dark:text-green-300 ml-1.5 uppercase tracking-wide">Mark Special</span>
                    </label>
                </div>

                <input id="excl-reason" type="text" placeholder="Reason (e.g. Testing, Easter)" class="w-full h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white outline-none">
                
                <button id="excl-save-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors text-xs uppercase tracking-wide">
                    Apply Exceptions
                </button>

                <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Active Exceptions:</p>
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
                if (r.isActive && r.region === currentRegion) {
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
                <input type="checkbox" value="${idx}" class="form-checkbox h-3 w-3 text-blue-600 bg-white border-gray-300 rounded mb-1 focus:ring-0">
                <span class="text-[9px] font-bold text-gray-500">${d}</span>
            `;
            daysContainer.appendChild(label);
        });
        
        function getSelectedDays() { return Array.from(daysContainer.querySelectorAll('input:checked')).map(cb => parseInt(cb.value)); }

        // 🛡️ GUARDIAN V6.1 FIX: Deep Row Scanner for mid-line originating trains
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

            let trainNumbersSet = new Set();
            try {
                // Scan EVERY row to find all train columns
                rawData.forEach(row => {
                    Object.keys(row).forEach(k => {
                        if (k.match(/^\d{4}[a-zA-Z]*$/)) trainNumbersSet.add(k);
                    });
                });
            } catch(e) { console.log(e); }
            
            let trainNumbers = Array.from(trainNumbersSet).sort();

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
                        <input type="checkbox" value="${tNum}" class="rounded text-blue-600 focus:ring-0 w-3 h-3 cursor-pointer">
                        <span class="font-mono text-gray-700 dark:text-gray-300">${tNum}</span>
                    `;
                    trainGrid.appendChild(div);
                });
            }
            pickerContainer.classList.remove('hidden');
        };

        async function fetchExclusions() {
            const rId = routeSelect.value;
            listDiv.innerHTML = '<div class="text-xs text-gray-400 italic">Loading...</div>';
            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}exclusions/${rId}.json?t=${Date.now()}`);
                const data = await res.json();
                listDiv.innerHTML = '';
                if (!data) {
                    listDiv.innerHTML = '<div class="text-xs text-gray-400 italic">No active exceptions.</div>';
                    return;
                }
                Object.keys(data).forEach(trainNum => {
                    const item = data[trainNum];
                    const dayLabels = item.days.map(d => days[d]).join('');
                    
                    // GUARDIAN PHASE 12: Identify SPL vs BANNED
                    const isSpecial = item.type === 'special';
                    const badgeHtml = isSpecial 
                        ? '<span class="bg-green-100 text-green-700 px-1 rounded text-[9px] font-black tracking-widest mr-1">SPL</span>'
                        : '<span class="bg-red-100 text-red-700 px-1 rounded text-[9px] font-black tracking-widest mr-1">BAN</span>';

                    const row = document.createElement('div');
                    row.className = "flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs border border-gray-100 dark:border-gray-700 mt-1";
                    row.innerHTML = `
                        <div>
                            ${badgeHtml}
                            <span class="font-bold ${isSpecial ? 'text-green-600' : 'text-red-600'}">#${trainNum}</span>
                            <span class="text-gray-400 mx-1">|</span>
                            <span class="text-gray-700 dark:text-gray-300 font-mono tracking-widest">[${dayLabels}]</span>
                            <div class="text-[9px] text-gray-400 mt-0.5">${item.reason || 'No reason specified'}</div>
                        </div>
                        <button class="text-gray-400 hover:text-white hover:bg-red-500 rounded px-1.5 py-0.5 transition-colors font-bold" onclick="Admin.deleteExclusion('${rId}', '${trainNum}')">✕</button>
                    `;
                    listDiv.appendChild(row);
                });
            } catch(e) {
                listDiv.innerHTML = `<div class="text-xs text-red-500">Error loading list.</div>`;
            }
        }

        saveBtn.onclick = async () => {
            const rId = routeSelect.value;
            const reason = document.getElementById('excl-reason').value.trim() || "Service Adjustment";
            const selectedDays = getSelectedDays();
            
            // GUARDIAN: Capture the selected type (banned vs special)
            const typeSelect = document.querySelector('input[name="excl-type"]:checked');
            const exceptionType = typeSelect ? typeSelect.value : 'banned';
            
            // GUARDIAN: Secure Token Fetch
            const secret = await Admin.getAuthKey(); 
            
            const selectedTrains = Array.from(trainGrid.querySelectorAll('input:checked')).map(cb => cb.value);
            const manualTrain = document.getElementById('excl-train-manual').value.trim();
            if (manualTrain) selectedTrains.push(manualTrain);

            if (selectedTrains.length === 0 || selectedDays.length === 0) {
                showToast("Select trains and days.", "error");
                return;
            }
            if (!secret) {
                showToast("Authentication required.", "error");
                return;
            }

            const updates = {};
            selectedTrains.forEach(tNum => {
                updates[`${tNum}`] = {
                    days: selectedDays,
                    reason: reason,
                    type: exceptionType, // Guaranteed payload persistence
                    updatedAt: Date.now()
                };
            });

            try {
                saveBtn.textContent = `Applying...`;
                saveBtn.disabled = true;
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                
                const promises = selectedTrains.map(tNum => {
                    const url = `${dynamicEndpoint}exclusions/${rId}/${tNum}.json?auth=${secret}`;
                    return fetch(url, { method: 'PUT', body: JSON.stringify(updates[tNum]) });
                });
                await Promise.all(promises);

                // --- 🛡️ GUARDIAN PHASE 4: CLOUDFLARE EDGE CACHE DETONATION ---
                try {
                    const purgeRes = await fetch('https://nexttrain-cache.enock.workers.dev/admin/purge', { 
                        method: 'POST', 
                        headers: {'X-Admin-Purge-Key': 'NEXT_TRAIN_GUARDIAN_2026'} 
                    });
                    if (purgeRes.ok) console.log("🛡️ Cloudflare Edge Cache Purged.");
                } catch(pe) { console.warn("Purge failed", pe); }

                showToast(`Updated ${selectedTrains.length} exceptions!`, "success");
                trainGrid.querySelectorAll('input').forEach(cb => cb.checked = false);
                document.getElementById('excl-train-manual').value = '';
                fetchExclusions();
                if (typeof loadAllSchedules === 'function') loadAllSchedules();
            } catch (e) {
                showToast("Network Error: " + e.message, "error");
            } finally {
                saveBtn.textContent = "Apply Exceptions";
                saveBtn.disabled = false;
            }
        };

        Admin.deleteExclusion = async function(rId, trainNum) {
            if(!confirm(`Remove exception for Train #${trainNum}?`)) return;
            // GUARDIAN: Secure Token Fetch
            const secret = await Admin.getAuthKey(); 
            if (!secret) { showToast("Authentication required.", "error"); return; }
            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const url = `${dynamicEndpoint}exclusions/${rId}/${trainNum}.json?auth=${secret}`;
            try {
                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    
                    // --- 🛡️ GUARDIAN PHASE 4: CLOUDFLARE EDGE CACHE DETONATION ---
                    try {
                        const purgeRes = await fetch('https://nexttrain-cache.enock.workers.dev/admin/purge', { 
                            method: 'POST', 
                            headers: {'X-Admin-Purge-Key': 'NEXT_TRAIN_GUARDIAN_2026'} 
                        });
                        if (purgeRes.ok) console.log("🛡️ Cloudflare Edge Cache Purged.");
                    } catch(pe) { console.warn("Purge failed", pe); }

                    showToast("Exception removed.", "success");
                    fetchExclusions();
                    if (typeof loadAllSchedules === 'function') loadAllSchedules();
                } else { showToast("Delete failed.", "error"); }
            } catch(e) { showToast(e.message, "error"); }
        };
    },

    // --- 6. SPECIAL EVENT MANAGER ---
    setupSpecialEventManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel || !alertPanel.parentNode) return;
        
        let eventPanel = document.getElementById('event-panel');
        if (!eventPanel) {
            eventPanel = document.createElement('div');
            eventPanel.id = 'event-panel';
            alertPanel.parentNode.appendChild(eventPanel);
        }

        if (eventPanel.dataset.loaded === "true") return;
        eventPanel.dataset.loaded = "true";

        eventPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        eventPanel.innerHTML = `
            <button id="event-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">⭐</span> Special Event Route</span>
                <svg id="event-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            <div id="event-body" class="hidden mt-4 space-y-4">
                <div class="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div>
                        <span class="font-bold text-yellow-800 dark:text-yellow-200 text-sm">Enable Event Route</span>
                    </div>
                    <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id="event-toggle" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer outline-none"/>
                        <label for="event-toggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                    </div>
                </div>
                
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Event Name</label>
                    <input type="text" id="event-name" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-xs text-gray-900 dark:text-white outline-none" placeholder="e.g., Loftus Rugby Special">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Destination A</label>
                        <input type="text" id="event-dest-a" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-xs text-gray-900 dark:text-white outline-none" placeholder="e.g., PRETORIA STATION">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Destination B</label>
                        <input type="text" id="event-dest-b" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-xs text-gray-900 dark:text-white outline-none" placeholder="e.g., LOFTUS STATION">
                    </div>
                </div>
                
                <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button id="event-save-btn" class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg shadow-md transition-colors text-xs uppercase tracking-wide">
                        Publish Event
                    </button>
                </div>
            </div>
        `;

        const header = document.getElementById('event-header-btn');
        const body = document.getElementById('event-body');
        const chevron = document.getElementById('event-chevron');
        const toggle = document.getElementById('event-toggle');
        const nameInput = document.getElementById('event-name');
        const destAInput = document.getElementById('event-dest-a');
        const destBInput = document.getElementById('event-dest-b');
        const saveBtn = document.getElementById('event-save-btn');

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

        // Populate with current state (from memory)
        if (typeof ROUTES !== 'undefined' && ROUTES['special_event']) {
            const ev = ROUTES['special_event'];
            toggle.checked = ev.isActive;
            nameInput.value = ev.name !== "Special Event Route" ? ev.name : "";
            destAInput.value = ev.destA !== "EVENT A STATION" ? ev.destA : "";
            destBInput.value = ev.destB !== "EVENT B STATION" ? ev.destB : "";
        }

        saveBtn.onclick = async () => {
            // GUARDIAN: Secure Token Fetch
            const secret = await Admin.getAuthKey();
            if (!secret) { showToast("Authentication required", "error"); return; }
            
            const payload = {
                isActive: toggle.checked,
                name: nameInput.value.trim() || "Special Event Route",
                destA: destAInput.value.trim().toUpperCase() || "EVENT A STATION",
                destB: destBInput.value.trim().toUpperCase() || "EVENT B STATION"
            };

            saveBtn.textContent = "Publishing...";
            saveBtn.disabled = true;

            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}config/special_event.json?auth=${secret}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    showToast("Special Event Updated!", "success");
                    // Instantly sync local memory & UI without hard reload
                    if (typeof ROUTES !== 'undefined' && ROUTES['special_event']) {
                        ROUTES['special_event'].isActive = payload.isActive;
                        ROUTES['special_event'].name = payload.name;
                        ROUTES['special_event'].destA = payload.destA;
                        ROUTES['special_event'].destB = payload.destB;
                        if (typeof Renderer !== 'undefined') {
                            Renderer.renderRouteMenu('route-list', ROUTES, typeof currentRouteId !== 'undefined' ? currentRouteId : null);
                        }
                    }
                } else {
                    showToast("Failed. Check Admin Key.", "error");
                }
            } catch(e) {
                showToast("Network Error", "error");
            } finally {
                saveBtn.textContent = "Publish Event";
                saveBtn.disabled = false;
            }
        };
    },

    // --- 7. SYSTEM HEALTH / DIAGNOSTICS SCANNER (GUARDIAN Phase 2) ---
    setupDiagnosticsManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel || !alertPanel.parentNode) return;

        let diagPanel = document.getElementById('diag-panel');
        if (!diagPanel) {
            diagPanel = document.createElement('div');
            diagPanel.id = 'diag-panel';
            alertPanel.parentNode.appendChild(diagPanel);
        }

        if (diagPanel.dataset.loaded === "true") return;
        diagPanel.dataset.loaded = "true";

        diagPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        diagPanel.innerHTML = `
            <button id="diag-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">🩺</span> System Health Diagnostics</span>
                <svg id="diag-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            <div id="diag-body" class="hidden mt-4 space-y-4">
                <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p class="text-[10px] text-blue-800 dark:text-blue-300 font-medium leading-snug">Scans the active local database to verify if all configured routes have successfully downloaded their train schedules.</p>
                </div>
                <button id="diag-run-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors text-xs uppercase tracking-wide focus:outline-none">
                    Run Network Scan
                </button>
                <div id="diag-results" class="space-y-1 max-h-60 overflow-y-auto custom-scrollbar"></div>
            </div>
        `;

        const header = document.getElementById('diag-header-btn');
        const body = document.getElementById('diag-body');
        const chevron = document.getElementById('diag-chevron');
        const runBtn = document.getElementById('diag-run-btn');
        const resultsDiv = document.getElementById('diag-results');

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

        runBtn.onclick = () => {
            resultsDiv.innerHTML = '<div class="text-xs text-gray-500 text-center py-4 flex flex-col items-center"><svg class="animate-spin h-5 w-5 text-blue-600 mb-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Scanning database...</div>';
            
            setTimeout(() => {
                if (typeof fullDatabase === 'undefined' || !fullDatabase) {
                    resultsDiv.innerHTML = '<div class="text-xs text-red-500 font-bold bg-red-50 p-2 rounded">Error: Offline Cache is missing or not fully loaded.</div>';
                    return;
                }

                let html = '';
                let healthyCount = 0;
                let brokenCount = 0;
                let totalRoutes = 0;

                if (typeof ROUTES !== 'undefined') {
                    Object.values(ROUTES).forEach(route => {
                        if (!route.isActive || route.id === 'special_event') return;
                        
                        totalRoutes++;
                        let routeHealthy = true;
                        let missingSheets = [];

                        if (route.sheetKeys) {
                            Object.entries(route.sheetKeys).forEach(([dayDir, key]) => {
                                if (!fullDatabase[key] || !Array.isArray(fullDatabase[key]) || fullDatabase[key].length === 0) {
                                    routeHealthy = false;
                                    missingSheets.push(dayDir);
                                }
                            });
                        } else {
                            routeHealthy = false;
                            missingSheets.push("Configuration Error");
                        }

                        if (routeHealthy) {
                            healthyCount++;
                            html += `
                                <div class="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-2.5 rounded-lg text-xs border border-green-100 dark:border-green-800/50 mt-1.5">
                                    <span class="font-bold text-green-800 dark:text-green-300">${route.name}</span>
                                    <span class="bg-green-500 text-white px-2 py-0.5 rounded shadow-sm text-[9px] uppercase tracking-wider font-bold">Online</span>
                                </div>
                            `;
                        } else {
                            brokenCount++;
                            html += `
                                <div class="flex flex-col bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg text-xs border border-red-100 dark:border-red-800/50 mt-1.5">
                                    <div class="flex justify-between items-center mb-1.5">
                                        <span class="font-bold text-red-800 dark:text-red-300">${route.name}</span>
                                        <span class="bg-red-500 text-white px-2 py-0.5 rounded shadow-sm text-[9px] uppercase tracking-wider font-bold">Missing Data</span>
                                    </div>
                                    <div class="text-[10px] text-red-600 dark:text-red-400 font-mono bg-red-100/50 dark:bg-red-900/40 p-1.5 rounded">Failed: ${missingSheets.join(', ')}</div>
                                </div>
                            `;
                        }
                    });
                }

                const summary = `
                    <div class="flex justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl mb-4 border border-gray-100 dark:border-gray-600">
                        <div class="text-center flex-1 border-r border-gray-200 dark:border-gray-600"><span class="block text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-0.5">Active</span><span class="text-lg font-black text-gray-800 dark:text-gray-200 leading-none">${totalRoutes}</span></div>
                        <div class="text-center flex-1 border-r border-gray-200 dark:border-gray-600"><span class="block text-[9px] text-green-600 uppercase font-bold tracking-widest mb-0.5">Healthy</span><span class="text-lg font-black text-green-600 leading-none">${healthyCount}</span></div>
                        <div class="text-center flex-1"><span class="block text-[9px] text-red-600 uppercase font-bold tracking-widest mb-0.5">Errors</span><span class="text-lg font-black text-red-600 leading-none">${brokenCount}</span></div>
                    </div>
                `;

                resultsDiv.innerHTML = summary + html;
            }, 400); // Artificial slight delay for UX feedback
        };
    },

    // --- 8. MAINTENANCE MODE MANAGER (GUARDIAN CARD STYLE) ---
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
        async function checkStatus() {
            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}config/maintenance.json`);
                const isActive = await res.json();
                toggle.checked = !!isActive;
            } catch(e) { console.warn("Failed to check maintenance status"); }
        }
        checkStatus();

        // 2. Toggle Handler
        toggle.addEventListener('change', async () => {
            // GUARDIAN: Secure Token Fetch
            const secret = await Admin.getAuthKey(); 
            if (!secret) {
                showToast("Authentication required to change system status.", "error");
                toggle.checked = !toggle.checked; // Revert UI
                return;
            }

            const newState = toggle.checked;
            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}config/maintenance.json?auth=${secret}`, {
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
    },

    // --- 9. NUCLEAR CACHE WIPE (GUARDIAN KILLSWITCH RESTORE) ---
    setupNuclearManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel || !alertPanel.parentNode) return;

        let nukePanel = document.getElementById('nuke-panel');
        if (!nukePanel) {
            nukePanel = document.createElement('div');
            nukePanel.id = 'nuke-panel';
            alertPanel.parentNode.appendChild(nukePanel);
        }

        if (nukePanel.dataset.loaded === "true") return;
        nukePanel.dataset.loaded = "true";

        nukePanel.className = "bg-red-50 dark:bg-red-900/20 rounded-xl shadow-md border border-red-200 dark:border-red-800 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        nukePanel.innerHTML = `
            <button id="nuke-header-btn" class="w-full text-left text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">☢️</span> Nuclear Cache Wipe</span>
                <svg id="nuke-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div id="nuke-body" class="hidden mt-4 space-y-3">
                <p class="text-[11px] text-red-600 dark:text-red-300 font-bold leading-snug">WARNING: This will instantly force ALL users globally to wipe their caches and hard-reload the app on their next boot.</p>
                <p class="text-[10px] text-red-500 dark:text-red-400 mb-2">Use only for catastrophic data corruption to force an update immediately without waiting for Service Worker lifecycles.</p>
                <button id="nuke-fire-btn" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors text-xs uppercase tracking-wide focus:outline-none">
                    Fire Killswitch
                </button>
            </div>
        `;

        const header = document.getElementById('nuke-header-btn');
        const body = document.getElementById('nuke-body');
        const chevron = document.getElementById('nuke-chevron');
        const fireBtn = document.getElementById('nuke-fire-btn');

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

        fireBtn.onclick = async () => {
            // GUARDIAN: Secure Token Fetch
            const secret = await Admin.getAuthKey(); 
            if (!secret) { showToast("Authentication required.", "error"); return; }
            
            const p1 = prompt("Type 'NUKE' to confirm mass cache wipe:");
            if (p1 !== 'NUKE') return;
            
            fireBtn.textContent = "Firing...";
            fireBtn.disabled = true;

            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const url = `${dynamicEndpoint}config/killswitch.json?auth=${secret}`;
                const payload = { timestamp: Date.now(), triggeredBy: Admin.currentUser ? Admin.currentUser.email : 'Admin' };
                
                const res = await fetch(url, { method: 'PUT', body: JSON.stringify(payload) });
                if (res.ok) {
                    // --- 🛡️ GUARDIAN PHASE 4: CLOUDFLARE EDGE CACHE DETONATION ---
                    try {
                        const purgeRes = await fetch('https://nexttrain-cache.enock.workers.dev/admin/purge', { 
                            method: 'POST', 
                            headers: {'X-Admin-Purge-Key': 'NEXT_TRAIN_GUARDIAN_2026'} 
                        });
                        if (purgeRes.ok) console.log("🛡️ Cloudflare Edge Cache Purged.");
                    } catch(pe) { console.warn("Purge failed", pe); }

                    showToast("Nuclear Wipe Triggered Globally!", "success", 5000);
                } else {
                    showToast("Auth failed.", "error");
                }
            } catch(e) {
                showToast("Network Error", "error");
            } finally {
                fireBtn.textContent = "Fire Killswitch";
                fireBtn.disabled = false;
            }
        };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});