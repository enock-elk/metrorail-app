// --- CONFIGURATION & CONSTANTS ---

// 1. Legal Text Definitions
const LEGAL_TEXTS = {
    terms: `
        <h4 class="font-bold text-lg mb-2">1. Independent Service</h4>
        <p><strong>Metrorail Next Train</strong> is an independent project by Kazembe CodeWorks. We are <strong>not affiliated</strong> with PRASA or Metrorail.</p>
        <h4 class="font-bold text-lg mb-2 mt-4">2. Accuracy</h4>
        <p>Schedules are estimated. We are not liable for missed trains or schedule changes.</p>
        <h4 class="font-bold text-lg mb-2 mt-4">3. Usage</h4>
        <p>By using this app, you agree not to misuse the service or scrape data maliciously.</p>
    `,
    privacy: `
        <h4 class="font-bold text-lg mb-2">1. Data Collection</h4>
        <p>We use Google Analytics to understand app usage anonymously.</p>
        <h4 class="font-bold text-lg mb-2 mt-4">2. Location Services</h4>
        <p>We may request your Location permission to identify your nearest station. This data is processed on your device and is not stored on our servers for tracking.</p>
        <h4 class="font-bold text-lg mb-2 mt-4">3. Third Parties</h4>
        <p>We use Firebase and Google Sheets to store schedule data.</p>
    `
};

// 2. API Endpoints
const DATABASE_URL = "https://metrorail-next-train-default-rtdb.firebaseio.com/schedules.json";
const MAX_RADIUS_KM = 6; 

// 3. Route Definitions
// ADDED: 'corridorId' to group relevant lines together.
// Routes with DIFFERENT corridorIds will NEVER merge, even if they share a station.
const ROUTES = {
    'pta-pien': { 
        id: 'pta-pien', 
        name: "Pretoria <-> Pienaarspoort", 
        corridorId: "EAST_LINE", // Unique to Pienaarspoort
        colorClass: "text-green-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'PIENAARSPOORT STATION', 
        transferStation: 'KOEDOESPOORT STATION', 
        sheetKeys: { weekday_to_a: 'pien_to_pta_weekday', weekday_to_b: 'pta_to_pien_weekday', saturday_to_a: 'pien_to_pta_sat', saturday_to_b: 'pta_to_pien_sat' } 
    },
    'pta-mabopane': { 
        id: 'pta-mabopane', 
        name: "Pretoria <-> Mabopane", 
        corridorId: "NORTH_LINE", // Shares corridor with De Wildt
        colorClass: "text-orange-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'MABOPANE STATION', 
        transferStation: null, 
        sheetKeys: { weekday_to_a: 'mab_to_pta_weekday', weekday_to_b: 'pta_to_mab_weekday', saturday_to_a: 'mab_to_pta_sat', saturday_to_b: 'pta_to_mab_sat' } 
    },
    'pta-dewildt': { 
        id: 'pta-dewildt', 
        name: "Pretoria <-> De Wildt", 
        corridorId: "NORTH_LINE", // Shares corridor with Mabopane
        colorClass: "text-purple-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'DE WILDT STATION', 
        transferStation: null, 
        sheetKeys: { 
            weekday_to_a: 'dewil_to_pta_weekday', 
            weekday_to_b: 'pta_to_dewil_weekday',
            saturday_to_a: 'dewil_to_pta_sat', 
            saturday_to_b: 'pta_to_dewil_sat'
        } 
    },
    'pta-saul': { 
        id: 'pta-saul', 
        name: "Pretoria <-> Saulsville", 
        corridorId: "SAUL_LINE",
        colorClass: "text-green-500", 
        isActive: false, 
        destA: 'PRETORIA STATION', 
        destB: 'SAULSVILLE STATION', 
        transferStation: null, 
        sheetKeys: {} 
    },
    'germ-leralla': { 
        id: 'germ-leralla', 
        name: "Germiston <-> Leralla", 
        corridorId: "JHB_EAST",
        colorClass: "text-blue-500", 
        isActive: true, 
        destA: 'GERMISTON STATION', 
        destB: 'LERALLA STATION', 
        transferStation: null, 
        sheetKeys: { 
            weekday_to_a: 'lerl_to_germ_weekday', 
            weekday_to_b: 'germ_to_lerl_weekday', 
            saturday_to_a: 'lerl_to_germ_sat', 
            saturday_to_b: 'germ_to_lerl_sat' 
        } 
    },
    'pta-irene': { id: 'pta-irene', name: "Pretoria <-> Irene", corridorId: "SOUTH_LINE", colorClass: "text-blue-500", isActive: false, destA: 'PRETORIA STATION', destB: 'IRENE STATION', transferStation: null, sheetKeys: {} },
    'pta-kempton': { id: 'pta-kempton', name: "Pretoria <-> Kempton Park", corridorId: "SOUTH_LINE", colorClass: "text-blue-500", isActive: false, destA: 'PRETORIA STATION', destB: 'KEMPTON PARK STATION', transferStation: null, sheetKeys: {} },
    'pta-germiston': { id: 'pta-germiston', name: "Pretoria <-> Germiston", corridorId: "SOUTH_LINE", colorClass: "text-blue-500", isActive: false, destA: 'PRETORIA STATION', destB: 'GERMISTON STATION', transferStation: null, sheetKeys: {} },
    'jhb-vereeniging': { id: 'jhb-vereeniging', name: "JHB <-> Vereeniging", corridorId: "JHB_SOUTH", colorClass: "text-purple-500", isActive: false, destA: 'JOHANNESBURG STATION', destB: 'VEREENIGING STATION', transferStation: null, sheetKeys: {} },
    'jhb-springs': { id: 'jhb-springs', name: "JHB <-> Springs", corridorId: "JHB_EAST", colorClass: "text-red-500", isActive: false, destA: 'JOHANNESBURG STATION', destB: 'SPRINGS STATION', transferStation: null, sheetKeys: {} },
    'jhb-soweto': { id: 'jhb-soweto', name: "JHB <-> Naledi", corridorId: "JHB_WEST", colorClass: "text-yellow-500", isActive: false, destA: 'JOHANNESBURG STATION', destB: 'NALEDI STATION', transferStation: null, sheetKeys: {} }
};

// 4. Refresh Settings
const REFRESH_CONFIG = { standardInterval: 5 * 60 * 1000, activeInterval: 60 * 1000, nightModeStart: 21, nightModeEnd: 4 };

// 5. Smart Pricing Configuration (V3.26)
// Source: 2025 Fare Adjustment Notice
const FARE_CONFIG = {
    offPeakStart: 9,  // 09:00
    offPeakEnd: 14,   // 14:00
    zones: {
        "Z1": 10.00,
        "Z2": 12.00,
        "Z3": 14.00,
        "Z4": 15.00
    },
    // New Profile Logic based on User Text:
    // 'base' = Multiplier during PEAK hours
    // 'offPeak' = Multiplier during OFF-PEAK (09:00-14:00)
    profiles: {
        "Adult":     { base: 1.0, offPeak: 0.6 }, // 40% discount off-peak
        "Scholar":   { base: 0.5, offPeak: 0.5 }, // 50% discount ALL HOURS
        "Pensioner": { base: 1.0, offPeak: 0.5 }, // 50% discount off-peak ONLY
        "Military":  { base: 1.0, offPeak: 0.5 }  // 50% discount off-peak ONLY
    }
};