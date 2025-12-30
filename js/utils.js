// --- METRORAIL NEXT TRAIN UTILITIES (V4.07) ---
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
    const s = String(timeStr);
    const parts = s.split(':');
    if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
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
        const parts = timeStr.split(':').map(Number);
        const h = parts[0] || 0; const m = parts[1] || 0; const s = parts[2] || 0;
        return (h * 3600) + (m * 60) + s;
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