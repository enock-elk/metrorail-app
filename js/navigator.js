// --- NAVIGATOR MODULE (V1.1 - Smart Delay Edition) ---
// Handles "Trip Mode", GPS tracking, and Dynamic Schedule Adjustments.
// Depends on: utils.js (for distance calc), logic.js (for station coordinates)

const Navigator = {
    activeTrip: null,
    stops: [],           // Flattened list of stops (Origin -> Intermediates -> Dest)
    currentStopIndex: 0, // Index of the *next* station we are approaching
    watchId: null,
    wakeLock: null,
    userDelayMinutes: 0,
    isGuiActive: false,

    // --- MAIN ENTRY POINT ---
    start: async function(tripData) {
        if (!tripData) {
            showToast("Invalid trip data.", "error");
            return;
        }

        console.log("Navigator: Starting Trip Mode...", tripData);
        
        this.activeTrip = tripData;
        this.userDelayMinutes = 0; // Reset delay on new trip
        this.stops = this.flattenTripStops(tripData);
        this.currentStopIndex = 0; 

        // Auto-advance logic: If we are AT the origin, target the NEXT stop
        if (this.stops.length > 1) {
            this.currentStopIndex = 1; // Target the first intermediate or destination
        }

        this.isGuiActive = true;
        this.toggleUI(true);
        this.requestWakeLock();
        this.startGPS();
        this.updateDisplay();
        
        showToast("Trip Mode Active", "success");
    },

    stop: function() {
        console.log("Navigator: Stopping...");
        this.isGuiActive = false;
        
        // 1. Stop GPS
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // 2. Release Screen
        if (this.wakeLock) {
            this.wakeLock.release().then(() => {
                this.wakeLock = null;
            });
        }

        // 3. Hide UI
        this.toggleUI(false);
    },

    // --- DATA PREP ---
    flattenTripStops: function(trip) {
        let flatList = [];

        if (trip.type === 'DIRECT') {
            flatList.push({ name: trip.from, time: trip.depTime, type: 'ORIGIN' });
            if (trip.stops && trip.stops.length > 0) {
                trip.stops.forEach(s => flatList.push({ name: s.station, time: s.time, type: 'STOP' }));
            }
            flatList.push({ name: trip.to, time: trip.arrTime, type: 'DESTINATION' });
        } 
        else if (trip.type === 'TRANSFER') {
            flatList.push({ name: trip.from, time: trip.leg1.depTime, type: 'ORIGIN' });
            // Transfer Arrival
            flatList.push({ name: trip.transferStation, time: trip.leg1.arrTime, type: 'TRANSFER_ARR' });
            // Transfer Departure (Target for Leg 2)
            flatList.push({ name: trip.transferStation, time: trip.leg2.depTime, type: 'TRANSFER_DEP' });
            flatList.push({ name: trip.to, time: trip.leg2.arrTime, type: 'DESTINATION' });
        }

        return flatList;
    },

    // --- HARDWARE APIS ---
    requestWakeLock: async function() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Navigator: Screen Wake Lock active.');
            }
        } catch (err) {
            console.warn('Navigator: Wake Lock failed.', err);
        }
    },

    startGPS: function() {
        if (!navigator.geolocation) {
            showToast("GPS not supported.", "error");
            this.updateDistanceDisplay(null);
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.handleLocationUpdate(position.coords.latitude, position.coords.longitude);
            },
            (err) => {
                console.warn("Navigator: GPS Error", err);
                this.updateDistanceDisplay(null);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 20000
            }
        );
    },

    // --- CORE LOGIC ---
    handleLocationUpdate: function(userLat, userLon) {
        if (!this.isGuiActive || this.stops.length === 0) return;

        // Safety check: index bounds
        if (this.currentStopIndex >= this.stops.length) {
            // Trip complete?
            this.updateDistanceDisplay(0);
            return;
        }

        let targetStop = this.stops[this.currentStopIndex];
        const targetName = normalizeStationName(targetStop.name);
        const targetCoords = globalStationIndex[targetName];

        if (targetCoords) {
            const distKm = getDistanceFromLatLonInKm(userLat, userLon, targetCoords.lat, targetCoords.lon);
            this.updateDistanceDisplay(distKm);

            // AUTO-ADVANCE LOGIC (Geofence: < 0.5km)
            // If we are arriving at an intermediate stop, advance to next.
            // If destination, we stay there.
            if (distKm < 0.5) {
                if (this.currentStopIndex < this.stops.length - 1) {
                    // ARRIVED AT INTERMEDIATE
                    // TODO: Here is where we could AUTO-CALCULATE delay based on current time vs scheduled time!
                    // For V1.1, we'll keep it manual but advance the "Target" to the next station.
                    
                    // Simple debounce/timeout needed in real world, but for now:
                    // this.currentStopIndex++; 
                    // this.updateDisplay();
                } else {
                    // ARRIVED AT DESTINATION
                    // Trigger Arrival State (Sound/Vibration in future)
                }
            }
        } else {
            this.updateDistanceDisplay(null);
        }
    },

    addDelay: function(minutes) {
        this.userDelayMinutes += minutes;
        this.updateDisplay();
        const sign = this.userDelayMinutes >= 0 ? '+' : '';
        showToast(`Schedule adjusted: ${sign}${this.userDelayMinutes} min`, "info");
    },
    
    resetDelay: function() {
        this.userDelayMinutes = 0;
        this.updateDisplay();
        showToast("Schedule reset to original.", "info");
    },

    // --- UI UPDATES ---
    toggleUI: function(show) {
        const overlay = document.getElementById('live-mode-view');
        if (show) {
            overlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },

    updateDisplay: function() {
        if (this.stops.length === 0) return;
        
        // 1. Identification
        // We show the FINAL DESTINATION at the top, but maybe subtitle the NEXT STOP?
        // User Requirement: "wants to know about the next station"
        // Let's modify the display to show NEXT STOP primarily, or Destination with Next Stop below.
        
        const finalStop = this.stops[this.stops.length - 1];
        
        // Logic: If we are at the start, next stop is stop[1].
        let displayTarget = finalStop; 
        // Future refinement: Show "Next: [Station]" in a smaller subtitle if it differs from Destination.

        const destNameEl = document.getElementById('live-dest-name');
        const arrivalTimeEl = document.getElementById('live-arrival-time');
        const delayIndicatorEl = document.getElementById('live-delay-indicator');
        
        if (destNameEl) destNameEl.textContent = displayTarget.name.replace(' STATION', '');
        
        // 2. Time Calculation
        const baseSeconds = timeToSeconds(displayTarget.time);
        const adjustedSeconds = baseSeconds + (this.userDelayMinutes * 60);
        const adjustedTimeStr = this.secondsToTime(adjustedSeconds);
        
        if (arrivalTimeEl) {
            arrivalTimeEl.textContent = this.format12h(adjustedTimeStr);
        }

        // 3. Delay State Colors
        if (delayIndicatorEl) {
            if (this.userDelayMinutes !== 0) {
                const sign = this.userDelayMinutes > 0 ? '+' : ''; // Negative has implicit minus
                const colorClass = this.userDelayMinutes > 0 ? 'text-yellow-500' : 'text-green-400';
                const borderColor = this.userDelayMinutes > 0 ? 'border-yellow-700/50' : 'border-green-700/50';
                const bgColor = this.userDelayMinutes > 0 ? 'bg-yellow-900/30' : 'bg-green-900/30';
                
                delayIndicatorEl.className = `text-sm font-bold ${colorClass} ${bgColor} px-3 py-1 rounded-full mb-8 border ${borderColor}`;
                delayIndicatorEl.textContent = `(${sign}${this.userDelayMinutes} min adjust)`;
                delayIndicatorEl.classList.remove('hidden');
                
                arrivalTimeEl.className = `text-5xl font-black tracking-tight mb-2 ${this.userDelayMinutes > 0 ? 'text-yellow-400' : 'text-green-400'}`;
            } else {
                delayIndicatorEl.classList.add('hidden');
                arrivalTimeEl.className = "text-5xl font-black text-white tracking-tight mb-2";
            }
        }
    },

    updateDistanceDisplay: function(km) {
        const el = document.getElementById('live-distance');
        const statusEl = document.getElementById('live-status-text'); // Need to add ID in HTML if we want dynamic status
        
        if (el) {
            if (km === null) {
                el.textContent = "--";
            } else {
                if (km < 1.0) {
                    el.textContent = (km * 1000).toFixed(0) + " m"; // Switch to meters
                    // Future: Trigger "Arriving" sound
                } else {
                    el.textContent = km.toFixed(1) + " km";
                }
            }
        }
    },

    // --- HELPERS ---
    secondsToTime: function(totalSeconds) {
        // Handle negative time or overflow (next day)
        // Simple modulo 24h for now
        let h = Math.floor(totalSeconds / 3600) % 24;
        let m = Math.floor((totalSeconds % 3600) / 60);
        if (h < 0) h += 24;
        if (m < 0) m += 60;
        return `${pad(h)}:${pad(m)}:00`;
    },

    format12h: function(timeStr) {
        if (!timeStr) return "--:--";
        const [h, m] = timeStr.split(':');
        let hour = parseInt(h, 10);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${m} ${suffix}`;
    }
};