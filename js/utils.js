// --- METRORAIL NEXT TRAIN UTILITIES (V4.60.29) ---
// Pure, stateless helper functions shared across the application.

function pad(num) {
    var s = "00" + num;
    return s.substr(s.length - 2);
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

function formatTimeDisplay(timeStr) {
    if (!timeStr) return "--:--";
    
    // 1. Sanitize & Normalize
    let s = String(timeStr).trim();
    
    // Handle "HHMM" format (e.g. 530 -> 5:30)
    if (/^\d{3,4}$/.test(s)) {
        const len = s.length;
        const m = s.slice(len - 2);
        const h = s.slice(0, len - 2);
        s = `${h}:${m}`;
    }
    
    // Handle dot separator
    s = s.replace('.', ':');
    
    const parts = s.split(':');
    if (parts.length >= 2) {
        // Return standard HH:MM
        return `${pad(parts[0])}:${pad(parts[1])}`;
    }
    return s;
}

function normalizeStationName(name) {
    if (!name) return "";
    return String(name)
        .toUpperCase()
        .replace(/ STATION/g, '')  
        .replace(/-/g, ' ')        
        .replace(/\s+/g, ' ')      
        .trim();
}

function timeToSeconds(timeStr) {
    try {
        if (!timeStr) return 0;
        let s = String(timeStr).trim();
        if (!s) return 0;

        // 1. Normalize Separators (Dot/Space to Colon)
        s = s.replace(/[. ]/g, ':');

        // 2. Handle "HHMM" format (e.g. "530" or "1430")
        if (/^\d{3,4}$/.test(s)) {
            const len = s.length;
            const m = s.slice(len - 2);
            const h = s.slice(0, len - 2);
            s = `${h}:${m}`;
        }

        // 3. Parse
        const parts = s.split(':').map(val => parseInt(val, 10));
        
        // 4. Validate (Must have at least Hours and Minutes)
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;

        const h = parts[0];
        const m = parts[1];
        const sec = parts[2] || 0;

        return (h * 3600) + (m * 60) + sec;
    } catch (e) { return 0; }
}

// --- GEOSPATIAL HELPERS ---

function deg2rad(deg) { 
    return deg * (Math.PI/180); 
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
}