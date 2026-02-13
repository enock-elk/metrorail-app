// --- CONFIGURATION & CONSTANTS ---

// 0. Version Control
const APP_VERSION = "V5.00.02 13 FEB"; // Added Hercules Route

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
        <p>We use Google Analytics and Microsoft Clarity to understand how the app is used. This helps us fix bugs and improve the design.</p>
        <p class="mt-2 text-xs text-gray-500">Note: All data is anonymous. We never see your personal details.</p>
        
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
const ROUTES = {
    'pta-pien': { 
        id: 'pta-pien', 
        name: "Pretoria <-> Pienaarspoort", 
        corridorId: "EAST_LINE",
        colorClass: "text-green-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'PIENAARSPOORT STATION', 
        transferStation: 'KOEDOESPOORT STATION', 
        relayStation: 'KOEDOESPOORT STATION', 
        sheetKeys: { weekday_to_a: 'pien_to_pta_weekday', weekday_to_b: 'pta_to_pien_weekday', saturday_to_a: 'pien_to_pta_sat', saturday_to_b: 'pta_to_pien_sat' } 
    },
    'pta-mabopane': { 
        id: 'pta-mabopane', 
        name: "Pretoria <-> Mabopane", 
        corridorId: "NORTH_LINE", 
        colorClass: "text-orange-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'MABOPANE STATION', 
        transferStation: null, 
        sheetKeys: { weekday_to_a: 'mab_to_pta_weekday', weekday_to_b: 'pta_to_mab_weekday', saturday_to_a: 'mab_to_pta_sat', saturday_to_b: 'pta_to_mab_sat' } 
    },
    'mab-belle': { 
        id: 'mab-belle', 
        name: "Mabopane <-> Belle Ombre", 
        corridorId: "NORTH_LINE",
        colorClass: "text-orange-500", 
        isActive: true, 
        destA: 'MABOPANE STATION', 
        destB: 'BELLE OMBRE STATION', 
        transferStation: null, 
        sheetKeys: { 
            weekday_to_a: 'belle_to_mab_weekday', 
            weekday_to_b: 'mab_to_belle_weekday', 
            saturday_to_a: 'belle_to_mab_sat', 
            saturday_to_b: 'mab_to_belle_sat' 
        } 
    },
    'pta-dewildt': { 
        id: 'pta-dewildt', 
        name: "Pretoria <-> De Wildt", 
        corridorId: "NORTH_LINE", 
        colorClass: "text-purple-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'DE WILDT STATION', 
        transferStation: 'ROSSLYN STATION', 
        relayStation: 'ROSSLYN STATION', 
        sheetKeys: { 
            weekday_to_a: 'dewil_to_pta_weekday', 
            weekday_to_b: 'pta_to_dewil_weekday',
            saturday_to_a: 'dewil_to_pta_sat', 
            saturday_to_b: 'pta_to_dewil_sat'
        } 
    },
    'herc-koed': { 
        id: 'herc-koed', 
        name: "Hercules <-> Koedoespoort", 
        corridorId: "NORTH_LINE", 
        colorClass: "text-indigo-500", 
        isActive: true, 
        destA: 'HERCULES STATION', 
        destB: 'KOEDOESPOORT STATION', 
        transferStation: null, // Acts as a bridge itself
        sheetKeys: { 
            weekday_to_a: 'koed_to_herc_weekday', 
            weekday_to_b: 'herc_to_koed_weekday',
            saturday_to_a: 'koed_to_herc_sat', 
            saturday_to_b: 'herc_to_koed_sat'
        } 
    },
    'pta-saul': { 
        id: 'pta-saul', 
        name: "Pretoria <-> Saulsville", 
        corridorId: "SAUL_LINE", 
        colorClass: "text-green-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'SAULSVILLE STATION', 
        transferStation: null, 
        sheetKeys: {
            weekday_to_a: 'saul_to_pta_weekday', 
            weekday_to_b: 'pta_to_saul_weekday',
            saturday_to_a: 'saul_to_pta_sat', 
            saturday_to_b: 'pta_to_saul_sat'
        } 
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
    'germ-kwesine': { 
        id: 'germ-kwesine', 
        name: "Germiston <-> Kwesine", 
        corridorId: "JHB_EAST",
        colorClass: "text-yellow-500", 
        isActive: true, 
        destA: 'GERMISTON STATION', 
        destB: 'KWESINE STATION', 
        transferStation: null, 
        sheetKeys: { 
            weekday_to_a: 'kwesi_to_germ_weekday', 
            weekday_to_b: 'germ_to_kwesi_weekday', 
            saturday_to_a: 'kwesi_to_germ_sat', 
            saturday_to_b: 'germ_to_kwesi_sat' 
        } 
    },
    'pta-irene': { 
        id: 'pta-irene', 
        name: "Pretoria <-> Irene", 
        corridorId: "SOUTH_LINE", 
        colorClass: "text-blue-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'IRENE STATION', 
        transferStation: null, 
        sheetKeys: { 
            weekday_to_a: 'irene_to_pta_weekday', 
            weekday_to_b: 'pta_to_irene_weekday', 
            saturday_to_a: 'irene_to_pta_sat', 
            saturday_to_b: 'pta_to_irene_sat' 
        } 
    },
    'jhb-germiston': { 
        id: 'jhb-germiston', 
        name: "JHB <-> Germiston", 
        corridorId: "JHB_CORE", 
        colorClass: "text-red-500", 
        isActive: true, 
        destA: 'JOHANNESBURG STATION', 
        destB: 'GERMISTON STATION', 
        transferStation: null, 
        sheetKeys: { 
            weekday_to_a: 'germ_to_jhb_weekday', 
            weekday_to_b: 'jhb_to_germ_weekday',
            saturday_to_a: 'germ_to_jhb_sat', 
            saturday_to_b: 'jhb_to_germ_sat'
        } 
    },
    'pta-kempton': { 
        id: 'pta-kempton', 
        name: "Pretoria <-> Kempton Park", 
        corridorId: "SOUTH_LINE", 
        colorClass: "text-blue-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'KEMPTON PARK STATION', 
        transferStation: null, 
        sheetKeys: {
            weekday_to_a: 'kemp_to_pta_weekday', 
            weekday_to_b: 'pta_to_kemp_weekday',
            saturday_to_a: 'kemp_to_pta_sat', 
            saturday_to_b: 'pta_to_kemp_sat'
        } 
    },
    'jhb-rand': { 
        id: 'jhb-rand', 
        name: "JHB <-> Randfontein", 
        corridorId: "JHB_WEST", 
        colorClass: "text-yellow-500", 
        isActive: true, 
        destA: 'JOHANNESBURG STATION', 
        destB: 'RANDFONTEIN STATION', 
        transferStation: 'ROODEPOORT STATION', 
        relayStation: 'ROODEPOORT STATION', 
        sheetKeys: {
            weekday_to_a: 'rand_to_jhb_weekday', 
            weekday_to_b: 'jhb_to_rand_weekday',
            saturday_to_a: 'rand_to_jhb_sat', 
            saturday_to_b: 'jhb_to_rand_sat'
        } 
    },
    'jhb-soweto': { 
        id: 'jhb-soweto', 
        name: "JHB <-> Naledi (Soweto)", 
        corridorId: "JHB_WEST", 
        colorClass: "text-yellow-500", 
        isActive: true, 
        destA: 'JOHANNESBURG STATION', 
        destB: 'NALEDI STATION', 
        transferStation: null, 
        sheetKeys: {
            weekday_to_a: 'nald_to_jhb_weekday', 
            weekday_to_b: 'jhb_to_nald_weekday',
            saturday_to_a: 'nald_to_jhb_sat', 
            saturday_to_b: 'jhb_to_nald_sat'
        } 
    },
    'jhb-midway': { 
        id: 'jhb-midway', 
        name: "JHB <-> Midway", 
        corridorId: "JHB_SOUTH", 
        colorClass: "text-yellow-500", 
        isActive: true, 
        destA: 'JOHANNESBURG STATION', 
        destB: 'MIDWAY STATION', 
        transferStation: null, 
        sheetKeys: {
            weekday_to_a: 'midwy_to_jhb_weekday', 
            weekday_to_b: 'jhb_to_midwy_weekday',
            saturday_to_a: 'midwy_to_jhb_sat', 
            saturday_to_b: 'jhb_to_midwy_sat'
        } 
    },
    'jhb-vereeniging': { id: 'jhb-vereeniging', name: "JHB <-> Vereeniging", corridorId: "JHB_SOUTH", colorClass: "text-purple-500", isActive: false, destA: 'JOHANNESBURG STATION', destB: 'VEREENIGING STATION', transferStation: null, sheetKeys: {} },
    'jhb-springs': { id: 'jhb-springs', name: "JHB <-> Springs", corridorId: "JHB_EAST", colorClass: "text-red-500", isActive: false, destA: 'JOHANNESBURG STATION', destB: 'SPRINGS STATION', transferStation: null, sheetKeys: {} }
};

// 4. Refresh Settings
const REFRESH_CONFIG = { standardInterval: 5 * 60 * 1000, activeInterval: 60 * 1000, nightModeStart: 21, nightModeEnd: 4 };

// 5. Smart Pricing Configuration
const FARE_CONFIG = {
    offPeakStart: 9.5,  // 09:30
    offPeakEnd: 14.5,   // 14:30
    
    // Legacy support for logic.js (keeps existing code working)
    zones: {
        "Z1": 10.00,
        "Z2": 12.00,
        "Z3": 14.00,
        "Z4": 15.00
    },

    // NEW V4.60.42: Detailed Pricing Table
    zones_detailed: {
        "Z1": { single: 10.00, return: 20.00, weekly_mon_fri: 60.00, weekly_mon_sat: 75.00, monthly: 180.00 },
        "Z2": { single: 12.00, return: 24.00, weekly_mon_fri: 70.00, weekly_mon_sat: 80.00, monthly: 220.00 },
        "Z3": { single: 14.00, return: 28.00, weekly_mon_fri: 80.00, weekly_mon_sat: 100.00, monthly: 250.00 },
        "Z4": { single: 15.00, return: 30.00, weekly_mon_fri: 90.00, weekly_mon_sat: 120.00, monthly: 280.00 }
    },

    profiles: {
        "Adult":     { base: 1.0, offPeak: 0.6 }, // 40% Discount
        "Scholar":   { base: 0.5, offPeak: 0.5 }, // Flat 50%
        "Pensioner": { base: 1.0, offPeak: 0.5 }, // 50% Off-Peak Discount
        "Military":  { base: 1.0, offPeak: 0.5 }  // 50% Off-Peak Discount
    }
};

// 6. GHOST TRAIN PROTOCOL (Default Exclusions)
// Fallback rules if Firebase is unreachable.
// Day Index: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const DEFAULT_EXCLUSIONS = {
    'pta-dewildt': {
        // High Speed Testing on Thu(4) / Fri(5) - Specific Trains Only
        "4511": { days: [4, 5], reason: "Testing" },
        "4409": { days: [4, 5], reason: "Testing" },
        "4513": { days: [4, 5], reason: "Testing" },
        "4411": { days: [4, 5], reason: "Testing" },
        "4515": { days: [4, 5], reason: "Testing" },
        "4413": { days: [4, 5], reason: "Testing" },
        "4517": { days: [4, 5], reason: "Testing" },
        "4415": { days: [4, 5], reason: "Testing" },
        "4519": { days: [4, 5], reason: "Testing" },
        "4417": { days: [4, 5], reason: "Testing" },
        // Return trips
        "4512": { days: [4, 5], reason: "Testing" },
        "4412": { days: [4, 5], reason: "Testing" },
        "4514": { days: [4, 5], reason: "Testing" },
        "4414": { days: [4, 5], reason: "Testing" },
        "4516": { days: [4, 5], reason: "Testing" },
        "4416": { days: [4, 5], reason: "Testing" },
        "4518": { days: [4, 5], reason: "Testing" },
        "4418": { days: [4, 5], reason: "Testing" },
        "4520": { days: [4, 5], reason: "Testing" }
    },
    'pta-kempton': {
        // Runs Tue, Wed, Thu only. Exclude Mon (1) and Fri (5).
        "0618": { days: [1, 5], reason: "Runs Tue-Thu Only" },
        "0619": { days: [1, 5], reason: "Runs Tue-Thu Only" }
    }
};

// 7. CHANGELOG (NEW V5.00.00)
// This drives the "What's New" modal.
const CHANGELOG_DATA = [
    {
        version: "V5.01.00",
        date: "13 Feb 2026",
        features: [
            "🛤 <b>New Route:</b> Hercules <-> Koedoespoort now available (Weekday Service).",
            "🚀 <b>Trip Planner:</b> Now supports Bridge Trips (2 Transfers) for long-distance travel.",
            "🛠 <b>Maintenance Mode:</b> Added real-time status banner for service upgrades.",
            "👻 <b>Ghost Train Protocol:</b> Smarter filtering of testing/inactive trains."
        ]
    },
    {
        version: "V4.60.40",
        date: "01 Feb 2026",
        features: [
            "🗺 <b>Network Map:</b> Added high-res zoomable map.",
            "💰 <b>Smart Fares:</b> Detailed pricing tables for Weekly/Monthly tickets.",
            "🔗 <b>Deep Linking:</b> Share specific routes or trip plans with one click."
        ]
    },
    {
        version: "V4.50.00",
        date: "15 Jan 2026",
        features: [
            "⚡ <b>Performance:</b> Faster load times and reduced data usage.",
            "📱 <b>Install Prompts:</b> Improved PWA installation guide for iOS users."
        ]
    }
];