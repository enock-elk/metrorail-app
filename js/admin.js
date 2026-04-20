/**
 * METRORAIL NEXT TRAIN - ADMIN TOOLS (V6.04.20 - Guardian Enterprise Edition)
 * --------------------------------------------
 * This module handles Developer Mode features:
 * 1. Service Alerts Manager (God-Mode Regional Sync + Rich Text Formatting + Live Preview)
 * 2. Maintenance Mode Toggle
 * 3. Enterprise Login Logic & Token Mgmt (Phase 9)
 * 4. Simulation Controls (Disarmed on Entry, Triggered on Apply)
 * 5. Exceptions Manager (God-Mode + Banned/Special Types + EXPIRY)
 * 6. Special Event Route Manager
 * 7. System Health / Diagnostics Scanner
 * 8. Nuclear Cache Wipe (Killswitch)
 * 9. Live Telemetry Bridge & Snapshot Export
 * 10. User Feedback Manager (Inbox & Archive Protocol Tabs)
 * 11. Growth & Promo Manager (QR Codes)
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

    // --- 0.15 SECURE ASYNC CONFIRMATION MODAL (PWA SANDBOX SAFE) ---
    secureConfirm: function(title, message, requirePromptText = null) {
        return new Promise((resolve) => {
            const modalId = 'admin-secure-confirm';
            let modal = document.getElementById(modalId);
            
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.className = 'fixed inset-0 bg-black/80 z-[200] hidden flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300';
                document.body.appendChild(modal);
            }
            
            const promptHtml = requirePromptText ? `
                <input type="text" id="admin-prompt-input" class="w-full h-10 px-3 mt-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none font-mono" placeholder="Type '${requirePromptText}' to confirm">
            ` : '';

            modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-95 border border-gray-200 dark:border-gray-700">
                    <div class="text-center">
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4 shadow-inner">
                            <svg class="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <h3 class="text-lg font-black text-gray-900 dark:text-white mb-2 tracking-tight">${title}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2 leading-relaxed">${message}</p>
                        ${promptHtml}
                        <div class="flex space-x-3 mt-6">
                            <button id="asc-cancel" class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-colors focus:outline-none text-sm">Cancel</button>
                            <button id="asc-confirm" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors focus:outline-none text-sm">Confirm</button>
                        </div>
                    </div>
                </div>
            `;

            modal.classList.remove('hidden');
            void modal.offsetWidth; // force reflow
            modal.firstElementChild.classList.remove('scale-95');
            modal.firstElementChild.classList.add('scale-100');

            const btnCancel = document.getElementById('asc-cancel');
            const btnConfirm = document.getElementById('asc-confirm');
            const inputPrompt = document.getElementById('admin-prompt-input');

            if (inputPrompt) inputPrompt.focus();

            const cleanup = (result) => {
                modal.classList.add('hidden');
                modal.firstElementChild.classList.remove('scale-100');
                modal.firstElementChild.classList.add('scale-95');
                resolve(result);
            };

            btnCancel.onclick = () => cleanup(false);
            btnConfirm.onclick = () => {
                if (requirePromptText) {
                    if (inputPrompt && inputPrompt.value === requirePromptText) {
                        cleanup(true);
                    } else {
                        if (typeof showToast === 'function') showToast(`Must type exactly '${requirePromptText}'`, 'error');
                    }
                } else {
                    cleanup(true);
                }
            };
        });
    },

    currentUser: null,
    telemetryInterval: null, 
    clockInterval: null,

    // --- 0.2 TELEMETRY REFRESH ENGINE & EXPORT ---
    refreshTelemetry: async () => {
        const stat5m = document.getElementById('stat-5m');
        const stat30m = document.getElementById('stat-30m');
        const statToday = document.getElementById('stat-today');
        const statAllTime = document.getElementById('stat-alltime');
        const statErrors = document.getElementById('stat-errors');
        const syncEl = document.getElementById('telemetry-last-sync');
        
        const devModal = document.getElementById('dev-modal');
        if (devModal && devModal.classList.contains('hidden')) {
            if (Admin.telemetryInterval) {
                clearInterval(Admin.telemetryInterval);
                Admin.telemetryInterval = null;
                console.log("🛡️ Guardian: Dev Modal closed. Telemetry polling suspended.");
            }
            return;
        }

        const secret = await Admin.getAuthKey();
        if (!secret) return;

        [stat5m, stat30m, statToday, statAllTime, statErrors].forEach(el => {
            if (el && !el.classList.contains('animate-pulse')) el.classList.add('animate-pulse');
        });

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
                
                if (syncEl) {
                    syncEl.classList.remove('hidden');
                    const now = new Date();
                    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                    syncEl.textContent = `synced: ${timeStr}`;
                }

                [stat5m, stat30m, statToday, statAllTime, statErrors].forEach(el => {
                    if(el) el.classList.remove('animate-pulse');
                });
            } else {
                throw new Error("Worker returned status: " + res.status);
            }
        } catch(e) {
            console.warn("🛡️ Telemetry Fetch Failed:", e.message);
            
            if(stat5m && stat5m.textContent === '--') stat5m.textContent = "Wait";
            if(stat30m && stat30m.textContent === '--') stat30m.textContent = "Wait";
            if(statToday && statToday.textContent === '--') statToday.textContent = "Wait";
            if(statAllTime && statAllTime.textContent === '--') statAllTime.textContent = "Wait";
            if(statErrors && statErrors.textContent === '--') statErrors.textContent = "Wait";

            [stat5m, stat30m, statToday, statAllTime, statErrors].forEach(el => {
                if(el) el.classList.remove('animate-pulse');
            });
        }
    },

    exportTelemetry: async () => {
        if (typeof showToast === 'function') showToast("Generating Snapshot...", "info", 2000);
        
        if (typeof html2canvas === 'undefined') {
            try {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            } catch(e) {
                if (typeof showToast === 'function') showToast("Failed to load snapshot engine.", "error");
                return;
            }
        }

        // Grab current stats from the DOM
        const stat5m = document.getElementById('stat-5m')?.textContent || '--';
        const stat30m = document.getElementById('stat-30m')?.textContent || '--';
        const statToday = document.getElementById('stat-today')?.textContent || '--';
        const statAllTime = document.getElementById('stat-alltime')?.textContent || '--';
        const statErrors = document.getElementById('stat-errors')?.textContent || '--';
        const syncTime = document.getElementById('telemetry-last-sync')?.textContent || '';
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'fixed';
        exportContainer.style.left = '-9999px';
        exportContainer.style.top = '0';
        exportContainer.style.width = '600px';
        exportContainer.style.backgroundColor = '#ffffff'; 
        exportContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        exportContainer.style.padding = '30px';
        exportContainer.style.color = '#1f2937';
        exportContainer.style.borderRadius = '16px';
        
        exportContainer.innerHTML = `
            <div style="border-bottom: 3px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <h1 style="font-size: 26px; font-weight: 900; margin: 0; color: #1e3a8a; text-transform: uppercase; letter-spacing: -0.5px;">Live Telemetry Snapshot</h1>
                    <p style="font-size: 13px; font-weight: 700; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Metrorail Next Train</p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${dateStr}</div>
                    <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-top: 2px;">${timeStr}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Active (Last 5 Mins)</div>
                    <div style="font-size: 36px; font-weight: 900; color: #15803d; line-height: 1;">${stat5m}</div>
                </div>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Active (Last 30 Mins)</div>
                    <div style="font-size: 36px; font-weight: 900; color: #1d4ed8; line-height: 1;">${stat30m}</div>
                </div>
                <div style="background: #eef2ff; border: 1px solid #c7d2fe; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 800; color: #3730a3; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Unique Users Today</div>
                    <div style="font-size: 36px; font-weight: 900; color: #4338ca; line-height: 1;">${statToday}</div>
                </div>
                <div style="background: #faf5ff; border: 1px solid #e9d5ff; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 800; color: #5b21b6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Total Users (All-Time)</div>
                    <div style="font-size: 36px; font-weight: 900; color: #6d28d9; line-height: 1;">${statAllTime}</div>
                </div>
            </div>

            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <div style="font-size: 13px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center;">
                    <span style="font-size: 16px; margin-right: 8px;">🚨</span> System Errors (Today)
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #b91c1c;">${statErrors}</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 12px; font-weight: 800; color: #334155; margin-bottom: 2px;">Exported by System Admin</div>
                    <div style="font-size: 10px; font-weight: 600; color: #64748b;">nexttrain.co.za | ${syncTime}</div>
                </div>
                <div style="display: flex; align-items: center; background: #ffffff; padding: 6px 12px; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <svg style="width: 14px; height: 14px; color: #f59e0b; margin-right: 6px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                    <span style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Verified by Google Analytics</span>
                </div>
            </div>
        `;

        document.body.appendChild(exportContainer);

        try {
            await new Promise(r => setTimeout(r, 150)); 

            const canvas = await html2canvas(exportContainer, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });

            canvas.toBlob(async (blob) => {
                const timestampStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 12); 
                const fileName = `NextTrain_Telemetry_${timestampStr}.png`;
                const file = new File([blob], fileName, { type: "image/png" });
                const blobUrl = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.download = fileName;
                link.href = blobUrl;
                link.click();
                
                if (typeof showToast === 'function') showToast("Snapshot saved to device!", "success", 4000);
                
                document.body.removeChild(exportContainer);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60000); 
            });
        } catch (e) {
            console.error(e);
            if (typeof showToast === 'function') showToast("Snapshot failed.", "error");
            if(document.body.contains(exportContainer)) document.body.removeChild(exportContainer);
        }
    },

    // --- 1. INITIALIZATION ---
    init: () => {
        window.addEventListener('firebase-auth-ready', () => {
            Admin.setupAuthListener();
            Admin.setupLoginAccess();
            Admin.setupSimulationControls();
        });
        
        if (window.firebaseAuth) {
            Admin.setupAuthListener();
            Admin.setupLoginAccess();
            Admin.setupSimulationControls();
        }
    },

    // --- 2. AUTH LISTENER (PHASE 9) ---
    setupAuthListener: () => {
        if (typeof window.firebaseOnAuthStateChanged !== 'function') {
            console.warn("🛡️ Guardian: Firebase Auth not loaded. Skipping auth listener.");
            return;
        }

        window.firebaseOnAuthStateChanged(window.firebaseAuth, (user) => {
            const signoutContainer = document.getElementById('admin-signout-container');
            
            if (user) {
                console.log("🛡️ Guardian: Admin Authenticated. Analytics blocked.");
                try { localStorage.setItem('analytics_ignore', 'true'); } catch(e){}
                Admin.currentUser = user;
                
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
                            if (typeof showToast === 'function') showToast("Signed out successfully.", "success");
                            if (location.hash === '#dev') history.back();
                            else if (typeof closeSmoothModal === 'function') closeSmoothModal('dev-modal');
                        });
                    });
                }

                if (Admin.checkUnreadFeedback) {
                    Admin.checkUnreadFeedback();
                }

            } else {
                console.log("🛡️ Guardian: Admin Logged Out. Analytics restored.");
                try { localStorage.removeItem('analytics_ignore'); } catch(e){}
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

        appTitle.addEventListener('click', (e) => {
            e.preventDefault(); 
            clickCount++;
            
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 2000); 
            
            if (clickCount >= 5) {
                clickCount = 0;
                
                if (Admin.currentUser || window.isSimMode) {
                    if (devModal) {
                        // GUARDIAN FIX: Route-aware modal opening prevents router bleed on back-button
                        if (location.hash !== '#dev') history.pushState({ modal: 'dev' }, '', '#dev');
                        if (typeof openSmoothModal === 'function') openSmoothModal('dev-modal');
                        else devModal.classList.remove('hidden');
                        
                        Admin.renderAdminModules(); 
                        Admin.initAutoSim(); 
                    }
                    if (typeof showToast === 'function') showToast("Developer Session Active", "info");
                } else {
                    if (loginModal) {
                        loginModal.classList.remove('hidden');
                        if(emailInput) emailInput.focus();
                    }
                }
            }
        });

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
                    if (typeof showToast === 'function') showToast("Enter email and password", "error");
                    return;
                }

                if (spinner) spinner.classList.remove('hidden');
                loginBtn.disabled = true;

                window.firebaseSignIn(window.firebaseAuth, email, password)
                    .then((userCredential) => {
                        loginModal.classList.add('hidden');
                        passInput.value = ''; 
                        if (devModal) {
                            if (location.hash !== '#dev') history.pushState({ modal: 'dev' }, '', '#dev');
                            if (typeof openSmoothModal === 'function') openSmoothModal('dev-modal');
                            else devModal.classList.remove('hidden');
                            
                            Admin.renderAdminModules();
                            Admin.initAutoSim(); 
                        }
                        if (typeof showToast === 'function') showToast(`Welcome back!`, "success");
                    })
                    .catch((error) => {
                        if (typeof showToast === 'function') showToast("Authentication Failed", "error");
                        console.error("🛡️ Guardian Login Error:", error);
                    })
                    .finally(() => {
                        if (spinner) spinner.classList.add('hidden');
                        loginBtn.disabled = false;
                    });
            });
        }
    },

    // --- 2.8 AUTO-SIM PREPARATION (GUARDIAN UPGRADE) ---
    initAutoSim: () => {
        const simEnabledCheckbox = document.getElementById('sim-enabled');
        const simTimeInput = document.getElementById('sim-time');
        const dayDropdown = document.getElementById('sim-day');
        const dateContainer = document.getElementById('sim-date-container');
        const dateInput = document.getElementById('sim-date');

        const now = new Date();
        
        // 1. Prepare Checkbox (Leave disabled unless they explicitly applied it before)
        if (simEnabledCheckbox) simEnabledCheckbox.checked = !!window.isSimMode;
        
        // 2. Prepare Time Input (Only overwrite if not already simulating)
        if (!window.isSimMode) {
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            if (simTimeInput) simTimeInput.value = `${h}:${m}:${s}`;
            
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
        }
        
        // Note: We NO LONGER activate the simulation globally just by opening the hub!
        // The user must press 'Apply' to hijack the system clock.
    },

    // --- 2.9 LIVE TELEMETRY (CLOUD WORKER BRIDGE) ---
    setupTelemetry: () => {
        const telPanel = document.getElementById('telemetry-panel');
        if (!telPanel) return;

        // GUARDIAN: Inject Export Button dynamically if it doesn't exist
        const telBody = document.getElementById('telemetry-body');
        if (telBody && !document.getElementById('tel-export-btn')) {
            const exportBtn = document.createElement('button');
            exportBtn.id = 'tel-export-btn';
            exportBtn.className = "w-full mt-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-800/50 border border-indigo-200 dark:border-indigo-800 font-bold py-2.5 rounded-lg transition-colors text-xs flex items-center justify-center focus:outline-none";
            exportBtn.innerHTML = `<span class="mr-2 text-base">📸</span> Export Telemetry Snapshot`;
            exportBtn.onclick = Admin.exportTelemetry;
            telBody.appendChild(exportBtn);
        }

        if (telPanel.dataset.adminLoaded === "true") {
            if (!Admin.telemetryInterval) {
                Admin.telemetryInterval = setInterval(Admin.refreshTelemetry, 10000);
            }
            Admin.refreshTelemetry();
            return;
        }
        telPanel.dataset.adminLoaded = "true";

        Admin.refreshTelemetry();
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
                if (!simTimeInput || !simEnabledCheckbox) return;
                
                // If they hit apply, we assume they want to turn it ON
                simEnabledCheckbox.checked = true;

                window.isSimMode = true;
                window.simTimeStr = simTimeInput.value + (simTimeInput.value.length === 5 ? ":00" : "");
                
                if (dayDropdown && dayDropdown.value === 'specific') {
                    if (dateInput && dateInput.value) {
                        const d = new Date(dateInput.value);
                        window.simDayIndex = d.getDay(); 
                    } else {
                        if (typeof showToast === 'function') showToast("Please select a valid date.", "error");
                        return;
                    }
                } else if (dayDropdown) {
                    window.simDayIndex = parseInt(dayDropdown.value);
                } else {
                    window.simDayIndex = 1;
                }

                if (typeof showToast === 'function') showToast("Dev Simulation Active!", "success");
                
                // GUARDIAN FIX: Proper Router-aware Exit. Closes Hub, lets you see the result.
                if (location.hash === '#dev') history.back();
                else if (typeof closeSmoothModal === 'function') closeSmoothModal('dev-modal');
                
                if (typeof updateTime === 'function') updateTime(); 
                if (typeof findNextTrains === 'function') findNextTrains();
            });
        }

        if (simExitBtn) {
            simExitBtn.addEventListener('click', () => {
                window.isSimMode = false;
                if(simEnabledCheckbox) simEnabledCheckbox.checked = false;
                
                if (typeof showToast === 'function') showToast("Exited Developer Mode", "info");
                
                if (location.hash === '#dev') history.back();
                else if (typeof closeSmoothModal === 'function') closeSmoothModal('dev-modal');

                if (typeof updateTime === 'function') updateTime(); 
                if (typeof findNextTrains === 'function') findNextTrains();
            });
        }
    },

    // --- HELPER: RENDER ALL DYNAMIC MODULES ---
    renderAdminModules: () => {
        // 1. Inject Live Clock (Guardian UX Upgrade) precisely above Telemetry
        let clockContainer = document.getElementById('admin-live-clock');
        if (!clockContainer) {
            const telPanel = document.getElementById('telemetry-panel');
            if (telPanel) {
                clockContainer = document.createElement('div');
                clockContainer.id = 'admin-live-clock';
                clockContainer.className = 'text-center mb-4';
                clockContainer.innerHTML = `<span class="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-3.5 py-1.5 rounded-full shadow-inner border border-gray-200 dark:border-gray-700"></span>`;
                telPanel.parentNode.insertBefore(clockContainer, telPanel);
            }
        }

        if (!Admin.clockInterval) {
            Admin.clockInterval = setInterval(() => {
                const devModal = document.getElementById('dev-modal');
                if (devModal && !devModal.classList.contains('hidden') && clockContainer) {
                    const now = new Date();
                    clockContainer.querySelector('span').textContent = now.toLocaleString('en-ZA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                }
            }, 1000);
        }

        // Setup Execution Order
        Admin.setupTelemetry();
        Admin.setupFeedbackManager(); 
        Admin.setupServiceAlertsManager();
        Admin.setupExclusionManager();
        Admin.setupMaintenanceManager();
        Admin.setupSpecialEventManager(); 
        Admin.setupDiagnosticsManager(); 
        
        // 2. Setup Growth Panel (Injected precisely after Diagnostics, before Nuclear)
        Admin.setupGrowthManager(); 
        
        Admin.setupNuclearManager(); 
    },

    // --- 2.9 GROWTH & PROMO MANAGER (QR CODE) ---
    setupGrowthManager: () => {
        const adminContainer = document.getElementById('admin-modules-container');
        if (!adminContainer) return;

        let growthPanel = document.getElementById('growth-panel');
        if (!growthPanel) {
            growthPanel = document.createElement('div');
            growthPanel.id = 'growth-panel';
            
            // GUARDIAN: Insert strictly before Nuclear Cache Wipe
            const nukePanel = document.getElementById('nuke-panel');
            if (nukePanel) {
                adminContainer.insertBefore(growthPanel, nukePanel);
            } else {
                adminContainer.appendChild(growthPanel);
            }
        }

        if (growthPanel.dataset.adminLoaded === "true") return;
        growthPanel.dataset.adminLoaded = "true";

        growthPanel.className = "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-md border border-blue-200 dark:border-indigo-800 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        growthPanel.innerHTML = `
            <button id="growth-header-btn" class="w-full text-left text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">🚀</span> Growth & Promo</span>
                <svg id="growth-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="growth-body" class="hidden mt-4">
                <p class="text-[10px] text-indigo-800 dark:text-indigo-300 font-medium leading-snug mb-4 text-center px-2">Let commuters scan this to instantly open and install the app without typing the URL.</p>
                <div class="flex flex-col items-center justify-center bg-white p-3 rounded-2xl shadow-sm border border-indigo-100 dark:border-gray-800 w-max mx-auto">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://nexttrain.co.za&color=1e3a8a&bgcolor=ffffff" alt="Next Train QR Code" class="w-40 h-40 object-contain rounded-lg">
                </div>
                <div class="text-center mt-4 mb-1">
                    <span class="text-xs font-bold text-indigo-900 dark:text-indigo-100 bg-white/60 dark:bg-black/20 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 shadow-sm">nexttrain.co.za</span>
                </div>
            </div>
        `;

        const header = document.getElementById('growth-header-btn');
        const body = document.getElementById('growth-body');
        const chevron = document.getElementById('growth-chevron');

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
    },

    // --- GUARDIAN UX: UNREAD FEEDBACK BADGE CHECKER ---
    checkUnreadFeedback: async () => {
        const secret = await Admin.getAuthKey();
        if (!secret) return;

        try {
            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const fullRes = await fetch(`${dynamicEndpoint}feedback.json?auth=${secret}`);
            if (!fullRes.ok) return;
            const fullData = await fullRes.json();
            
            let unreadCount = 0;
            if (fullData) {
                Object.values(fullData).forEach(item => {
                    if (item.status !== 'resolved') unreadCount++;
                });
            }

            const badge = document.getElementById('fb-unread-badge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = `${unreadCount} New`;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        } catch (e) {
            console.warn("🛡️ Could not sync unread feedback count.");
        }
    },

    // --- 3.5 FEEDBACK MANAGER (GUARDIAN INBOX & ARCHIVE PROTOCOL) ---
    setupFeedbackManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel || !alertPanel.parentNode) return;

        let fbPanel = document.getElementById('feedback-panel');
        if (!fbPanel) {
            fbPanel = document.createElement('div');
            fbPanel.id = 'feedback-panel';
            alertPanel.parentNode.insertBefore(fbPanel, alertPanel);
        }

        if (fbPanel.dataset.adminLoaded === "true") return;
        fbPanel.dataset.adminLoaded = "true";

        // Local state config
        Admin.currentFeedbackTab = 'inbox';
        Admin.cachedFeedbackData = [];

        fbPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        fbPanel.innerHTML = `
            <button id="fb-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center">
                    <span class="mr-2">💬</span> Commuter Feedback
                    <span id="fb-unread-badge" class="hidden bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-2 shadow-sm font-black tracking-normal animate-pulse">New</span>
                </span>
                <svg id="fb-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="fb-body" class="hidden mt-4 space-y-3">
                <div class="flex border-b border-gray-200 dark:border-gray-700 mb-2">
                    <button id="fb-tab-inbox" class="flex-1 py-2 text-[10px] uppercase font-black border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 transition-colors focus:outline-none tracking-wider">Inbox (<span id="fb-inbox-count">0</span>)</button>
                    <button id="fb-tab-archive" class="flex-1 py-2 text-[10px] uppercase font-black border-b-2 border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none tracking-wider">Archive</button>
                </div>
                
                <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700 shadow-inner">
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1" id="fb-status-display">Syncing Data...</span>
                    <button id="fb-refresh-btn" class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 border border-blue-200 dark:border-blue-800 rounded px-2 py-1 text-[10px] font-bold transition-colors shadow-sm focus:outline-none">
                        Refresh Network
                    </button>
                </div>
                
                <div id="fb-list" class="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar"></div>
            </div>
        `;

        const header = document.getElementById('fb-header-btn');
        const body = document.getElementById('fb-body');
        const chevron = document.getElementById('fb-chevron');
        const refreshBtn = document.getElementById('fb-refresh-btn');
        const listContainer = document.getElementById('fb-list');
        const statusDisplay = document.getElementById('fb-status-display');
        const tabInbox = document.getElementById('fb-tab-inbox');
        const tabArchive = document.getElementById('fb-tab-archive');
        const inboxCountSpan = document.getElementById('fb-inbox-count');

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

        // Dual-Tab Switcher Logic
        const switchTab = (tab) => {
            Admin.currentFeedbackTab = tab;
            if (tab === 'inbox') {
                tabInbox.classList.replace('border-transparent', 'border-blue-500');
                tabInbox.classList.replace('text-gray-400', 'text-blue-600');
                tabInbox.classList.replace('dark:text-gray-400', 'dark:text-blue-400');
                
                tabArchive.classList.replace('border-blue-500', 'border-transparent');
                tabArchive.classList.replace('text-blue-600', 'text-gray-400');
                tabArchive.classList.replace('dark:text-blue-400', 'dark:text-gray-400');
            } else {
                tabArchive.classList.replace('border-transparent', 'border-blue-500');
                tabArchive.classList.replace('text-gray-400', 'text-blue-600');
                tabArchive.classList.replace('dark:text-gray-400', 'dark:text-blue-400');
                
                tabInbox.classList.replace('border-blue-500', 'border-transparent');
                tabInbox.classList.replace('text-blue-600', 'text-gray-400');
                tabInbox.classList.replace('dark:text-blue-400', 'dark:text-gray-400');
            }
            Admin.renderFeedbackList();
        };

        tabInbox.onclick = () => switchTab('inbox');
        tabArchive.onclick = () => switchTab('archive');

        // Render purely from RAM state based on Active Tab
        Admin.renderFeedbackList = () => {
            listContainer.innerHTML = '';
            const isInbox = Admin.currentFeedbackTab === 'inbox';
            const targetData = Admin.cachedFeedbackData.filter(f => isInbox ? f.status !== 'resolved' : f.status === 'resolved');
            
            statusDisplay.textContent = isInbox ? `Active Items: ${targetData.length}` : `Archived Items: ${targetData.length}`;

            if (targetData.length === 0) {
                listContainer.innerHTML = `<div class="text-xs text-gray-500 italic text-center py-6">${isInbox ? 'Inbox is completely clean! ✨' : 'No archived feedback yet.'}</div>`;
                return;
            }

            // GUARDIAN FIX: Global secure fallback for sanitization
            const secureEscape = (str) => {
                if (!str) return '';
                if (typeof escapeHTML === 'function') return escapeHTML(str);
                return String(str).replace(/[&<>"']/g, function(m) {
                    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
                });
            };

            targetData.forEach(item => {
                const date = new Date(item.timestamp || Date.now());
                const dateStr = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                
                let badgeClass = "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600";
                let typeLabel = "General";
                
                if (item.type === 'schedule_error') { badgeClass = "bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"; typeLabel = "⏱️ Schedule Error"; }
                else if (item.type === 'bug') { badgeClass = "bg-orange-50 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"; typeLabel = "🐛 App Bug"; }
                else if (item.type === 'suggestion') { badgeClass = "bg-purple-50 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"; typeLabel = "💡 Suggestion"; }

                // 🛡️ GUARDIAN FIX: XSS Sanitization injected
                const safeEmail = secureEscape(item.email);
                const safeText = item.text ? secureEscape(item.text).replace(/\n/g, "<br>") : "No content";
                const safeAppVersion = secureEscape(item.appVersion || 'Unknown');
                const safeRouteId = secureEscape(item.routeId || 'None');
                const safeAttachUrl = item.attachmentUrl ? secureEscape(item.attachmentUrl) : null;

                const emailDisplay = safeEmail ? `<a href="mailto:${safeEmail}" class="text-blue-500 dark:text-blue-400 hover:underline">${safeEmail}</a>` : "Anonymous User";
                const attachmentHtml = safeAttachUrl 
                    ? `<a href="${safeAttachUrl}" target="_blank" class="flex items-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors text-[10px] font-bold"><span class="mr-1">📎</span> View File</a>`
                    : `<div></div>`;

                const actionHtml = isInbox 
                    ? `<button class="text-green-600 dark:text-green-400 hover:text-white hover:bg-green-600 text-[10px] font-bold bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-1 rounded transition-colors focus:outline-none uppercase tracking-wide shadow-sm" onclick="Admin.resolveFeedback('${item.id}')">Resolve</button>`
                    : `<span class="text-[9px] font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded uppercase tracking-wider">Archived</span>`;

                const card = document.createElement('div');
                card.className = "bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col transition-all hover:border-blue-300 dark:hover:border-blue-500";
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${badgeClass}">${typeLabel}</span>
                        <span class="text-[9px] text-gray-400 dark:text-gray-500 font-mono">${dateStr}</span>
                    </div>
                    
                    <p class="text-xs text-gray-800 dark:text-gray-200 mb-3 leading-relaxed whitespace-pre-wrap">${safeText}</p>
                    
                    <div class="flex justify-between items-end border-t border-gray-100 dark:border-gray-800 pt-2 mt-auto">
                        <div class="flex flex-col">
                            <span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium mb-0.5">${emailDisplay}</span>
                            <span class="text-[8px] text-gray-400 dark:text-gray-600 font-mono">App: ${safeAppVersion} | Route: ${safeRouteId}</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            ${attachmentHtml}
                            ${actionHtml}
                        </div>
                    </div>
                `;
                listContainer.appendChild(card);
            });
        };

        Admin.fetchFeedback = async () => {
            const secret = await Admin.getAuthKey();
            if (!secret) return;

            listContainer.innerHTML = '<div class="text-xs text-gray-500 italic text-center py-4">Synchronizing database...</div>';
            statusDisplay.textContent = "Syncing Network...";

            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}feedback.json?auth=${secret}&orderBy="$key"`);
                
                if (!res.ok) throw new Error("Failed to fetch feedback");
                const data = await res.json();

                Admin.cachedFeedbackData = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
                Admin.cachedFeedbackData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                const activeCount = Admin.cachedFeedbackData.filter(f => f.status !== 'resolved').length;
                if(inboxCountSpan) inboxCountSpan.textContent = activeCount;

                const badge = document.getElementById('fb-unread-badge');
                if (badge) {
                    if (activeCount > 0) {
                        badge.textContent = `${activeCount} New`;
                        badge.classList.remove('hidden');
                    } else {
                        badge.classList.add('hidden');
                    }
                }

                Admin.renderFeedbackList();

            } catch (e) {
                console.error(e);
                listContainer.innerHTML = '<div class="text-xs text-red-500 text-center py-4">Failed to load feedback.</div>';
                statusDisplay.textContent = "Network Error";
            }
        };

        // GUARDIAN: The Archive Protocol
        Admin.resolveFeedback = async (id) => {
            const confirmed = await Admin.secureConfirm("Resolve Feedback", "Mark this feedback as resolved and sweep it to the Archive Tab?");
            if (!confirmed) return;
            
            const secret = await Admin.getAuthKey();
            if (!secret) return;

            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                
                const payload = { status: 'resolved', resolvedAt: Date.now() };
                const res = await fetch(`${dynamicEndpoint}feedback/${id}.json?auth=${secret}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    if (typeof showToast === 'function') showToast("Feedback resolved and archived!", "success");
                    Admin.fetchFeedback(); 
                } else {
                    throw new Error("Failed to archive feedback");
                }
            } catch (e) {
                if (typeof showToast === 'function') showToast("Error resolving feedback.", "error");
            }
        };
        
        Admin.checkUnreadFeedback();
    },

    // --- RICH TEXT FORMATTING HELPER ---
    formatAlertText: (tag) => {
        const textarea = document.getElementById('alert-msg');
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        let prefix = '', suffix = '';
        
        if (tag === 'bold') { 
            prefix = '*'; suffix = '*'; 
        } else if (tag === 'italic') { 
            prefix = '<i>'; suffix = '</i>'; 
        } else if (tag === 'link') { 
            prefix = '<a href="https://example.com" target="_blank" class="text-blue-500 dark:text-blue-400 underline underline-offset-2">'; suffix = '</a>'; 
        } else if (tag === 'image') {
            prefix = '<img src="https://example.com/image.jpg" class="w-full rounded-lg my-2 shadow-sm border border-gray-200 dark:border-gray-700" alt="Alert Image">'; suffix = '';
        }

        textarea.value = text.substring(0, start) + prefix + text.substring(start, end) + suffix + text.substring(end);
        textarea.focus();
        
        if (start === end && suffix) {
            textarea.selectionStart = start + prefix.length;
            textarea.selectionEnd = end + prefix.length;
        } else {
            textarea.selectionStart = end + prefix.length + suffix.length;
            textarea.selectionEnd = end + prefix.length + suffix.length;
        }
    },

    // --- 4. SERVICE ALERTS MANAGER ---
    setupServiceAlertsManager: () => {
        const alertPanel = document.getElementById('alert-panel');
        if (!alertPanel) return;
        
        if (alertPanel.dataset.adminLoaded === "true") return;
        alertPanel.dataset.adminLoaded = "true";

        alertPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        alertPanel.innerHTML = `
            <button id="alert-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">📢</span> Service Alerts Manager</span>
                <svg id="alert-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="alert-body" class="hidden mt-4 space-y-4">
                
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Target Audience (God-Mode)</label>
                    <select id="alert-target" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                        <!-- Populated dynamically with optgroups -->
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
                    <div class="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                        <div class="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 p-1 border-b border-gray-300 dark:border-gray-600">
                            <button type="button" onclick="Admin.formatAlertText('bold')" class="px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded focus:outline-none" title="Bold">B</button>
                            <button type="button" onclick="Admin.formatAlertText('italic')" class="px-2 py-1 text-xs italic text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded focus:outline-none" title="Italic">I</button>
                            <div class="w-px h-4 bg-gray-300 dark:bg-gray-600 my-auto mx-1"></div>
                            <button type="button" onclick="Admin.formatAlertText('link')" class="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex items-center focus:outline-none" title="Add Custom Link">🔗 Link</button>
                            <button type="button" onclick="Admin.formatAlertText('image')" class="px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex items-center focus:outline-none" title="Insert Image via HTML tag">📸 Img Tag</button>
                        </div>
                        <textarea id="alert-msg" rows="6" class="w-full p-3 bg-gray-50 dark:bg-gray-900 border-0 text-gray-900 dark:text-white text-xs focus:ring-0 outline-none resize-y" placeholder="e.g. Delays of 45min due to cable theft..."></textarea>
                    </div>
                </div>

                <!-- 🛡️ SUPERCHARGED: Rich Media Inputs with Live Preview -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div class="sm:col-span-2">
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Hero Image URL (Optional)</label>
                        <input type="text" id="alert-image-url" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://...">
                        
                        <div id="alert-image-preview-container" class="hidden mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-800 shadow-inner text-center">
                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Live Image Preview</p>
                            <img id="alert-image-preview" src="" class="max-h-32 w-auto mx-auto rounded-md object-contain border border-gray-100 dark:border-gray-700 shadow-sm" onerror="this.parentElement.classList.add('hidden')">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">CTA Button Text</label>
                        <input type="text" id="alert-cta-text" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Read Statement">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">CTA Button Link</label>
                        <input type="text" id="alert-cta-url" class="w-full h-10 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://...">
                    </div>
                </div>

                <!-- 🛡️ SUPERCHARGED: Interactive Poll Manager -->
                <div class="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800 mt-2">
                    <div>
                        <span class="font-bold text-purple-800 dark:text-purple-200 text-sm">Interactive Poll Mode</span>
                        <p class="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">Add commuter voting buttons</p>
                    </div>
                    <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id="alert-poll-toggle" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer outline-none"/>
                        <label for="alert-poll-toggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                    </div>
                </div>

                <div id="alert-poll-container" class="hidden space-y-3 bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800/50 mt-2">
                    <div>
                        <label class="block text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Poll Question</label>
                        <input type="text" id="alert-poll-question" class="w-full h-10 px-3 rounded-lg bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. Would you use a Dark Mode feature?">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Option A</label>
                            <input type="text" id="alert-poll-opt-a" class="w-full h-10 px-3 rounded-lg bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. Yes">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Option B</label>
                            <input type="text" id="alert-poll-opt-b" class="w-full h-10 px-3 rounded-lg bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-700 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. No">
                        </div>
                    </div>
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
        const alertTarget = document.getElementById('alert-target');
        const dateInput = document.getElementById('alert-duration-custom');
        const alertMsg = document.getElementById('alert-msg');
        const sendBtn = document.getElementById('alert-send-btn');
        const clearBtn = document.getElementById('alert-clear-btn');
        const severitySelect = document.getElementById('alert-severity');
        
        const signoffInput = document.getElementById('alert-signoff');
        const forcePopupToggle = document.getElementById('alert-force-popup');

        const imageUrlInput = document.getElementById('alert-image-url');
        const imagePreviewContainer = document.getElementById('alert-image-preview-container');
        const imagePreview = document.getElementById('alert-image-preview');
        const ctaUrlInput = document.getElementById('alert-cta-url');
        const ctaTextInput = document.getElementById('alert-cta-text');
        const pollToggle = document.getElementById('alert-poll-toggle');
        const pollContainer = document.getElementById('alert-poll-container');
        const pollQuestion = document.getElementById('alert-poll-question');
        const pollOptA = document.getElementById('alert-poll-opt-a');
        const pollOptB = document.getElementById('alert-poll-opt-b');

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

        if (imageUrlInput) {
            imageUrlInput.addEventListener('input', () => {
                const url = imageUrlInput.value.trim();
                if (url && url.startsWith('http')) {
                    imagePreview.src = url;
                    imagePreview.onload = () => imagePreviewContainer.classList.remove('hidden');
                } else {
                    imagePreviewContainer.classList.add('hidden');
                }
            });
        }

        pollToggle.addEventListener('change', () => {
            if (pollToggle.checked) {
                pollContainer.classList.remove('hidden');
            } else {
                pollContainer.classList.add('hidden');
            }
        });

        async function fetchCurrentAlert(target) {
            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}notices/${target}.json?t=${Date.now()}`);
                const data = await res.json();
                
                if (data && data.message) {
                    let cleanedMsg = data.message;
                    cleanedMsg = cleanedMsg.replace(/(<br\s*\/?>\s*){1,2}<span[^>]*>.*?<\/span>\s*$/i, '');
                    cleanedMsg = cleanedMsg.replace(/<span[^>]*>.*?<\/span>\s*$/i, '');
                    cleanedMsg = cleanedMsg.replace(/<br\s*\/?>/gi, "\n").replace(/<b>/gi, "*").replace(/<\/b>/gi, "*");
                    
                    alertMsg.value = cleanedMsg.trim();
                    
                    if(data.expiresAt && dateInput) {
                        const expiryDate = new Date(data.expiresAt);
                        expiryDate.setMinutes(expiryDate.getMinutes() - expiryDate.getTimezoneOffset()); 
                        dateInput.value = expiryDate.toISOString().slice(0, 16);
                    }
                    if (severitySelect && data.severity) severitySelect.value = data.severity;
                    else if (severitySelect) severitySelect.value = 'info';

                    if (data.authorName) signoffInput.value = data.authorName;
                    else signoffInput.value = "Next Train Ops";

                    if (data.forcePopup !== undefined) forcePopupToggle.checked = data.forcePopup;
                    else forcePopupToggle.checked = (data.severity === 'critical');

                    if (data.imageUrl) {
                        imageUrlInput.value = data.imageUrl;
                        imageUrlInput.dispatchEvent(new Event('input')); 
                    } else {
                        imageUrlInput.value = "";
                        if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
                    }

                    if (data.ctaUrl) ctaUrlInput.value = data.ctaUrl; else ctaUrlInput.value = "";
                    if (data.ctaText) ctaTextInput.value = data.ctaText; else ctaTextInput.value = "";
                    
                    if (data.poll && data.poll.active) {
                        pollToggle.checked = true;
                        pollContainer.classList.remove('hidden');
                        pollQuestion.value = data.poll.question || "";
                        pollOptA.value = data.poll.optionA || "";
                        pollOptB.value = data.poll.optionB || "";
                    } else {
                        pollToggle.checked = false;
                        pollContainer.classList.add('hidden');
                        pollQuestion.value = "";
                        pollOptA.value = "";
                        pollOptB.value = "";
                    }

                    sendBtn.textContent = "Update Alert"; 
                } else {
                    alertMsg.value = "";
                    if(severitySelect) severitySelect.value = 'info';
                    signoffInput.value = "Next Train Ops";
                    forcePopupToggle.checked = false;
                    
                    imageUrlInput.value = "";
                    if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
                    ctaUrlInput.value = "";
                    ctaTextInput.value = "";
                    pollToggle.checked = false;
                    pollContainer.classList.add('hidden');
                    pollQuestion.value = "";
                    pollOptA.value = "";
                    pollOptB.value = "";

                    sendBtn.textContent = "Post Alert";
                }
            } catch (e) { console.log("No active alert."); }
        }

        function populateTargets() {
            alertTarget.innerHTML = '';
            
            const globalGroup = document.createElement('optgroup');
            globalGroup.label = "Global Alerts";
            globalGroup.innerHTML = `
                <option value="all">🌍 Entire Network (All Regions)</option>
                <option value="all_GP">📍 Gauteng Only</option>
                <option value="all_WC">📍 Western Cape Only</option>
            `;
            alertTarget.appendChild(globalGroup);

            const gpGroup = document.createElement('optgroup');
            gpGroup.label = "Gauteng Routes";
            
            const wcGroup = document.createElement('optgroup');
            wcGroup.label = "Western Cape Routes";

            if (typeof ROUTES !== 'undefined') {
                Object.values(ROUTES).forEach(r => {
                    if (r.isActive && r.id !== 'special_event') {
                        const opt = document.createElement('option');
                        opt.value = r.id;
                        opt.textContent = `🚂 ${r.name}`;
                        if (r.region === 'GP') gpGroup.appendChild(opt);
                        if (r.region === 'WC') wcGroup.appendChild(opt);
                    }
                });
            }

            alertTarget.appendChild(gpGroup);
            alertTarget.appendChild(wcGroup);
            
            const defOpt = typeof currentRegion !== 'undefined' ? `all_${currentRegion}` : 'all_GP';
            const optionToSelect = alertTarget.querySelector(`option[value="${defOpt}"]`);
            if (optionToSelect) optionToSelect.selected = true;

            fetchCurrentAlert(alertTarget.value);
        }

        alertTarget.addEventListener('change', () => fetchCurrentAlert(alertTarget.value));
        populateTargets();

        const now = new Date();
        now.setHours(23, 59, 59, 999);
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); 
        if(dateInput) dateInput.value = now.toISOString().slice(0, 16);

        sendBtn.onclick = async () => {
            let msg = alertMsg.value.trim();
            const target = alertTarget.value;
            const severity = severitySelect.value;
            
            const signoff = signoffInput.value.trim() || "Next Train Ops";
            const isForcePopup = forcePopupToggle.checked;
            
            const secret = await Admin.getAuthKey();
            
            if (!msg) { if (typeof showToast === 'function') showToast("Message required!", "error"); return; }
            if (!secret) { if (typeof showToast === 'function') showToast("Authentication required! Sign in again.", "error"); return; }

            msg = msg.replace(/\n/g, "<br>").replace(/\*(.*?)\*/g, "<b>$1</b>");
            msg += `<br><br><span class="opacity-75 text-[10px] uppercase font-bold tracking-wider">— ${signoff}</span>`;

            let expiresAtVal = dateInput && dateInput.value ? new Date(dateInput.value).getTime() : Date.now() + (2 * 3600 * 1000);

            const payload = {
                id: Date.now().toString(), 
                message: msg,
                authorName: signoff,
                forcePopup: isForcePopup,
                postedAt: Date.now(),
                expiresAt: expiresAtVal,
                severity: severity,
                imageUrl: imageUrlInput.value.trim() || null,
                ctaUrl: ctaUrlInput.value.trim() || null,
                ctaText: ctaTextInput.value.trim() || null,
                poll: {
                    active: pollToggle.checked,
                    question: pollToggle.checked ? pollQuestion.value.trim() : null,
                    optionA: pollToggle.checked ? pollOptA.value.trim() : null,
                    optionB: pollToggle.checked ? pollOptB.value.trim() : null
                }
            };

            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const url = `${dynamicEndpoint}notices/${target}.json?auth=${secret}`;

            try {
                sendBtn.textContent = "Posting...";
                sendBtn.disabled = true;
                const res = await fetch(url, { method: 'PUT', body: JSON.stringify(payload) });
                if (res.ok) {
                    if (typeof showToast === 'function') showToast("Alert Posted!", "success");
                    if (typeof checkServiceAlerts === 'function') checkServiceAlerts(); 
                } else {
                    if (typeof showToast === 'function') showToast("Failed. Check Session.", "error");
                }
            } catch (e) { if (typeof showToast === 'function') showToast("Error: " + e.message, "error"); } 
            finally { sendBtn.textContent = "Update Alert"; sendBtn.disabled = false; }
        };

        clearBtn.onclick = async () => {
            const target = alertTarget.value;
            const secret = await Admin.getAuthKey();
            if (!secret) { if (typeof showToast === 'function') showToast("Authentication required.", "error"); return; }
            
            const confirmed = await Admin.secureConfirm("Clear Alert", `Delete alert for: ${target}?`);
            if (!confirmed) return;

            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const url = `${dynamicEndpoint}notices/${target}.json?auth=${secret}`;
            
            try {
                const fetchRes = await fetch(`${dynamicEndpoint}notices/${target}.json`);
                if (fetchRes.ok) {
                    const alertData = await fetchRes.json();
                    if (alertData && alertData.id) {
                        alertData.archivedAt = Date.now();
                        alertData.clearedFrom = target;
                        const archiveUrl = `${dynamicEndpoint}notices_archive/${alertData.id}_${Date.now()}.json?auth=${secret}`;
                        await fetch(archiveUrl, { method: 'PUT', body: JSON.stringify(alertData) });
                    }
                }

                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    // 🛡️ GUARDIAN FIX: Removed Hardcoded Cloudflare Cache Purge Key
                    try {
                        const purgeRes = await fetch('https://nexttrain-cache.enock.workers.dev/admin/purge', { 
                            method: 'POST', 
                            headers: {'Authorization': `Bearer ${secret}`} 
                        });
                    } catch(pe) { console.warn("Purge failed", pe); }

                    if (typeof showToast === 'function') showToast("Cleared & Archived!", "info");
                    
                    alertMsg.value = "";
                    signoffInput.value = "Next Train Ops";
                    forcePopupToggle.checked = false;
                    imageUrlInput.value = "";
                    if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
                    ctaUrlInput.value = "";
                    ctaTextInput.value = "";
                    pollToggle.checked = false;
                    pollContainer.classList.add('hidden');
                    pollQuestion.value = "";
                    pollOptA.value = "";
                    pollOptB.value = "";
                    
                    sendBtn.textContent = "Post Alert";
                    if (typeof checkServiceAlerts === 'function') setTimeout(checkServiceAlerts, 500); 
                } else { if (typeof showToast === 'function') showToast("Failed to clear alert.", "error"); }
            } catch (e) { if (typeof showToast === 'function') showToast(e.message, "error"); }
        };
    },

    // --- 5. EXCLUSION MANAGER ---
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

        exclPanel.className = "bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 mb-4 relative overflow-hidden transition-all duration-300";

        exclPanel.innerHTML = `
            <button id="excl-header-btn" class="w-full text-left text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between focus:outline-none">
                <span class="flex items-center"><span class="mr-2">⛔</span> Schedule Exceptions</span>
                <svg id="excl-chevron" class="w-4 h-4 transform transition-transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="excl-body" class="hidden mt-4 space-y-3">
                <div class="flex space-x-2">
                    <select id="excl-route" class="w-2/3 h-10 px-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white outline-none">
                        <!-- Populated dynamically with optgroups -->
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
                
                <div class="mt-2 mb-3">
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Expiry Date & Time (Optional)</label>
                    <input type="datetime-local" id="excl-expiry" class="w-full h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white outline-none">
                    <p class="text-[9px] text-gray-400 mt-1">If set, the train will automatically reappear on the schedule after this date.</p>
                </div>
                
                <button id="excl-save-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition-colors text-xs uppercase tracking-wide">
                    Apply Exceptions
                </button>

                <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Active Exceptions:</p>
                    <div id="excl-list" class="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar"></div>
                </div>
            </div>
        `;

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

        if (typeof ROUTES !== 'undefined') {
            const gpGroup = document.createElement('optgroup');
            gpGroup.label = "Gauteng Routes";
            
            const wcGroup = document.createElement('optgroup');
            wcGroup.label = "Western Cape Routes";

            Object.values(ROUTES).forEach(r => {
                if (r.isActive && r.id !== 'special_event') {
                    const opt = document.createElement('option');
                    opt.value = r.id;
                    opt.textContent = r.name;
                    if (r.region === 'GP') gpGroup.appendChild(opt);
                    if (r.region === 'WC') wcGroup.appendChild(opt);
                }
            });
            
            routeSelect.appendChild(gpGroup);
            routeSelect.appendChild(wcGroup);
            
            if (typeof currentRouteId !== 'undefined' && currentRouteId) {
                routeSelect.value = currentRouteId;
            }
        }

        routeSelect.addEventListener('change', () => {
            const rId = routeSelect.value;
            if (rId && ROUTES[rId]) {
                const r = ROUTES[rId];
                dirSelect.options[0].textContent = `To ${r.destA.replace(' STATION','')}`;
                dirSelect.options[1].textContent = `To ${r.destB.replace(' STATION','')}`;
                fetchExclusions();
            } else {
                dirSelect.options[0].textContent = "To Dest A";
                dirSelect.options[1].textContent = "To Dest B";
            }
        });
        
        routeSelect.dispatchEvent(new Event('change'));

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

        loadTrainsBtn.onclick = () => {
            const rId = routeSelect.value;
            const type = schedTypeSelect.value;
            const dir = dirSelect.value;

            if (!rId) { if (typeof showToast === 'function') showToast("Select a route first", "error"); return; }
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
                if (typeof showToast === 'function') showToast("Database not ready. Refresh app.", "error");
                return;
            }

            const rawData = fullDatabase[sheetKey];
            if (!rawData) {
                if (typeof showToast === 'function') showToast(`No data found for ${type}`, "error");
                return;
            }

            let trainNumbersSet = new Set();
            try {
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
                    
                    const isSpecial = item.type === 'special';
                    
                    let expiryHtml = '';
                    let rowOpacityClass = '';
                    if (item.expiresAt) {
                        const expDate = new Date(item.expiresAt);
                        const isExpired = Date.now() > item.expiresAt;
                        const expStr = `${expDate.toLocaleDateString()} ${expDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                        
                        if (isExpired) {
                            expiryHtml = `<div class="text-[9px] text-red-500 font-bold mt-0.5">⚠️ EXPIRED: ${expStr}</div>`;
                            rowOpacityClass = 'opacity-60 grayscale';
                        } else {
                            expiryHtml = `<div class="text-[9px] text-blue-500 font-medium mt-0.5">⏳ Expires: ${expStr}</div>`;
                        }
                    }

                    const badgeHtml = isSpecial 
                        ? '<span class="bg-green-100 text-green-700 px-1 rounded text-[9px] font-black tracking-widest mr-1">SPL</span>'
                        : '<span class="bg-red-100 text-red-700 px-1 rounded text-[9px] font-black tracking-widest mr-1">BAN</span>';

                    const row = document.createElement('div');
                    row.className = `flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs border border-gray-100 dark:border-gray-700 mt-1 ${rowOpacityClass}`;
                    row.innerHTML = `
                        <div>
                            ${badgeHtml}
                            <span class="font-bold ${isSpecial ? 'text-green-600' : 'text-red-600'}">#${trainNum}</span>
                            <span class="text-gray-400 mx-1">|</span>
                            <span class="text-gray-700 dark:text-gray-300 font-mono tracking-widest">[${dayLabels}]</span>
                            <div class="text-[9px] text-gray-400 mt-0.5">${item.reason || 'No reason specified'}</div>
                            ${expiryHtml}
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
            
            const typeSelect = document.querySelector('input[name="excl-type"]:checked');
            const exceptionType = typeSelect ? typeSelect.value : 'banned';
            
            const expiryInput = document.getElementById('excl-expiry').value;
            const expiryTs = expiryInput ? new Date(expiryInput).getTime() : null;
            
            const secret = await Admin.getAuthKey(); 
            
            const selectedTrains = Array.from(trainGrid.querySelectorAll('input:checked')).map(cb => cb.value);
            const manualTrain = document.getElementById('excl-train-manual').value.trim();
            if (manualTrain) selectedTrains.push(manualTrain);

            if (selectedTrains.length === 0 || selectedDays.length === 0) {
                if (typeof showToast === 'function') showToast("Select trains and days.", "error");
                return;
            }
            if (!secret) {
                if (typeof showToast === 'function') showToast("Authentication required.", "error");
                return;
            }

            const updates = {};
            selectedTrains.forEach(tNum => {
                updates[`${tNum}`] = {
                    days: selectedDays,
                    reason: reason,
                    type: exceptionType, 
                    expiresAt: expiryTs, 
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

                // 🛡️ GUARDIAN FIX: Removed Hardcoded Cloudflare Cache Purge Key
                try {
                    const purgeRes = await fetch('https://nexttrain-cache.enock.workers.dev/admin/purge', { 
                        method: 'POST', 
                        headers: {'Authorization': `Bearer ${secret}`} 
                    });
                } catch(pe) { console.warn("Purge failed", pe); }

                if (typeof showToast === 'function') showToast(`Updated ${selectedTrains.length} exceptions!`, "success");
                trainGrid.querySelectorAll('input').forEach(cb => cb.checked = false);
                document.getElementById('excl-train-manual').value = '';
                document.getElementById('excl-expiry').value = ''; 
                fetchExclusions();
                if (typeof loadAllSchedules === 'function') loadAllSchedules();
            } catch (e) {
                if (typeof showToast === 'function') showToast("Network Error: " + e.message, "error");
            } finally {
                saveBtn.textContent = "Apply Exceptions";
                saveBtn.disabled = false;
            }
        };

        Admin.deleteExclusion = async function(rId, trainNum) {
            const confirmed = await Admin.secureConfirm("Remove Exception", `Remove exception for Train #${trainNum}?`);
            if (!confirmed) return;

            const secret = await Admin.getAuthKey(); 
            if (!secret) { if (typeof showToast === 'function') showToast("Authentication required.", "error"); return; }
            const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
            const url = `${dynamicEndpoint}exclusions/${rId}/${trainNum}.json?auth=${secret}`;
            try {
                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    // 🛡️ GUARDIAN FIX: Removed Hardcoded Cloudflare Cache Purge Key
                    try {
                        const purgeRes = await fetch('https://nexttrain-cache.enock.workers.dev/admin/purge', { 
                            method: 'POST', 
                            headers: {'Authorization': `Bearer ${secret}`} 
                        });
                    } catch(pe) { console.warn("Purge failed", pe); }

                    if (typeof showToast === 'function') showToast("Exception removed.", "success");
                    fetchExclusions();
                    if (typeof loadAllSchedules === 'function') loadAllSchedules();
                } else { if (typeof showToast === 'function') showToast("Delete failed.", "error"); }
            } catch(e) { if (typeof showToast === 'function') showToast(e.message, "error"); }
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

        if (typeof ROUTES !== 'undefined' && ROUTES['special_event']) {
            const ev = ROUTES['special_event'];
            toggle.checked = ev.isActive;
            nameInput.value = ev.name !== "Special Event Route" ? ev.name : "";
            destAInput.value = ev.destA !== "EVENT A STATION" ? ev.destA : "";
            destBInput.value = ev.destB !== "EVENT B STATION" ? ev.destB : "";
        }

        saveBtn.onclick = async () => {
            const secret = await Admin.getAuthKey();
            if (!secret) { if (typeof showToast === 'function') showToast("Authentication required", "error"); return; }
            
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
                    if (typeof showToast === 'function') showToast("Special Event Updated!", "success");
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
                    if (typeof showToast === 'function') showToast("Failed. Check Admin Key.", "error");
                }
            } catch(e) {
                if (typeof showToast === 'function') showToast("Network Error", "error");
            } finally {
                saveBtn.textContent = "Publish Event";
                saveBtn.disabled = false;
            }
        };
    },

    // --- 7. SYSTEM HEALTH / DIAGNOSTICS SCANNER ---
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
            }, 400);
        };
    },

    // --- 8. MAINTENANCE MODE MANAGER ---
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
        
        async function checkStatus() {
            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const res = await fetch(`${dynamicEndpoint}config/maintenance.json`);
                const isActive = await res.json();
                toggle.checked = !!isActive;
            } catch(e) { console.warn("Failed to check maintenance status"); }
        }
        checkStatus();

        toggle.addEventListener('change', async () => {
            const secret = await Admin.getAuthKey(); 
            if (!secret) {
                if (typeof showToast === 'function') showToast("Authentication required to change system status.", "error");
                toggle.checked = !toggle.checked; 
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
                    if (typeof showToast === 'function') showToast(`Maintenance Mode: ${newState ? "ON" : "OFF"}`, newState ? "warning" : "success");
                } else {
                    throw new Error("Auth failed");
                }
            } catch(e) {
                if (typeof showToast === 'function') showToast("Failed to update status.", "error");
                toggle.checked = !toggle.checked; 
            }
        });
    },

    // --- 9. NUCLEAR CACHE WIPE ---
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
            const secret = await Admin.getAuthKey(); 
            if (!secret) { if (typeof showToast === 'function') showToast("Authentication required.", "error"); return; }
            
            const confirmed = await Admin.secureConfirm("Nuclear Cache Wipe", "Type 'NUKE' to confirm mass cache wipe:", "NUKE");
            if (!confirmed) return;
            
            fireBtn.textContent = "Firing...";
            fireBtn.disabled = true;

            try {
                const dynamicEndpoint = typeof DYNAMIC_BASE_URL !== 'undefined' ? DYNAMIC_BASE_URL : 'https://metrorail-next-train-default-rtdb.firebaseio.com/';
                const url = `${dynamicEndpoint}config/killswitch.json?auth=${secret}`;
                const payload = { timestamp: Date.now(), triggeredBy: Admin.currentUser ? Admin.currentUser.email : 'Admin' };
                
                const res = await fetch(url, { method: 'PUT', body: JSON.stringify(payload) });
                if (res.ok) {
                    // 🛡️ GUARDIAN FIX: Removed Hardcoded Cloudflare Cache Purge Key
                    try {
                        const purgeRes = await fetch('https://nexttrain-cache.enock.workers.dev/admin/purge', { 
                            method: 'POST', 
                            headers: {'Authorization': `Bearer ${secret}`} 
                        });
                        if (purgeRes.ok) console.log("🛡️ Cloudflare Edge Cache Purged.");
                    } catch(pe) { console.warn("Purge failed", pe); }

                    if (typeof showToast === 'function') showToast("Nuclear Wipe Triggered Globally!", "success", 5000);
                } else {
                    if (typeof showToast === 'function') showToast("Auth failed.", "error");
                }
            } catch(e) {
                if (typeof showToast === 'function') showToast("Network Error", "error");
            } finally {
                fireBtn.textContent = "Fire Killswitch";
                fireBtn.disabled = false;
            }
        };
    }
};

window.Admin = Admin;

document.addEventListener('DOMContentLoaded', () => {
    Admin.init();
});