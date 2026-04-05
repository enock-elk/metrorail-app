// --- CONFIGURATION & CONSTANTS ---

// 0. Version Control
const APP_VERSION = "V6.04.05 - 05 APR"; // BUMPED: To force cache clear on clients
// GUARDIAN: Set to 'true' to force an immediate hard reload on startup. 
// Set to 'false' for silent background updates (Stale-While-Revalidate).
// V6.00.10: Set to false to prevent infinite reload loops if SW caching fails.
const FORCE_UPDATE_REQUIRED = true;

// --- 🛡️ GUARDIAN PHASE 5: INFRASTRUCTURE PIVOT & DATA ROUTING ---
// Toggle this to instantly switch where the heavy schedule data comes from.
const DATA_SOURCE_MODE = 'FIREBASE'; // 'GITHUB' or 'FIREBASE'

// 🛡️ GUARDIAN: GitHub via jsDelivr CDN (100% Free, Unlimited Bandwidth)
// Connected securely to enock-elk/metrorail-app
const GITHUB_BASE_URL = "https://cdn.jsdelivr.net/gh/enock-elk/metrorail-app@main/data/";
const FIREBASE_BASE_URL = "https://metrorail-next-train-default-rtdb.firebaseio.com/";

// Heavy Data (Schedules) respects the toggle.
const SCHEDULE_BASE_URL = DATA_SOURCE_MODE === 'GITHUB' ? GITHUB_BASE_URL : FIREBASE_BASE_URL;

// Dynamic Data (Admin Bans, Alerts, Maintenance) ALWAYS uses Firebase for real-time capability.
const DYNAMIC_BASE_URL = "https://metrorail-next-train-default-rtdb.firebaseio.com/";

const REGIONS = {
    'GP': { 
        dbNode: DATA_SOURCE_MODE === 'GITHUB' ? 'full-database.json' : 'schedules.json', 
        name: 'Gauteng' 
    },
    'WC': { 
        dbNode: DATA_SOURCE_MODE === 'GITHUB' ? 'full-database.json' : 'schedules/westerncape.json', 
        name: 'Western Cape' 
    }
};
const MAX_RADIUS_KM = 6; 

// 1. Legal Text Definitions (GUARDIAN V5.01: TWA Compliance & Opaque Infrastructure)
const LEGAL_TEXTS = {
    terms: `
        <h4 class="font-bold text-lg mb-2">1. Independent Service & Disclaimer</h4>
        <p class="mb-3"><strong>Metrorail Next Train</strong> is an independent digital tool developed by Kazembe CodeWorks. This application is <strong>not affiliated with, endorsed by, or directly associated with PRASA or Metrorail</strong>. The service is provided "as is" without warranties of any kind.</p>
        
        <h4 class="font-bold text-lg mb-2 mt-4">2. Schedule Accuracy & Liability</h4>
        <p class="mb-3">All transit schedules, fares, and routing information presented within this application are aggregated estimations based on publicly available data. We do not guarantee absolute real-time accuracy. Kazembe CodeWorks and its developers shall not be held liable for any missed transit connections, financial losses, disciplinary actions at places of employment, or personal damages arising from the use of this information.</p>
        
        <h4 class="font-bold text-lg mb-2 mt-4">3. Acceptable Use</h4>
        <p class="mb-3">By accessing this application, you agree to use it strictly for personal, non-commercial transit planning. Automated data scraping, reverse-engineering of the application's secure endpoints, or malicious interference with our cloud infrastructure is strictly prohibited and will result in immediate service denial.</p>
    `,
    privacy: `
        <h4 class="font-bold text-lg mb-2">1. Data Collection & Analytics</h4>
        <p class="mb-3">To continuously improve the commuter experience, we utilize industry-standard analytics tools (including Google Analytics and Microsoft Clarity) to monitor application performance and user engagement. This tracking measures generic usage patterns, origin-destination planning flows, and crash reports. <strong>All data collected is strictly anonymized.</strong> We do not request, process, or store personally identifiable information (PII) such as names or contact details.</p>
        
        <h4 class="font-bold text-lg mb-2 mt-4">2. Location Services</h4>
        <p class="mb-3">Our "Find Nearest Station" feature requires access to your device's GPS coordinates. This location data is processed locally on your device in real-time to calculate distances to nearby stations. <strong>Your exact GPS location is never transmitted to, or stored on, our backend servers for tracking.</strong></p>
        
        <h4 class="font-bold text-lg mb-2 mt-4">3. Third-Party Infrastructure</h4>
        <p class="mb-3">Schedule data and application states are distributed via secure, globally recognized cloud infrastructure providers. While your device downloads data from these secure endpoints, your individual connection metrics are governed by the strict privacy frameworks of those enterprise cloud providers. We do not broker your individual device fingerprints to external marketing agencies.</p>
    `
};

// 3. Route Definitions
const ROUTES = {
    // NEW V5.01: Dynamic Special Event Scaffold (Hidden by Default)
    'special_event': { 
        id: 'special_event', 
        name: "Special Event Route", 
        corridorId: "SPECIAL",
        region: "GP",
        colorClass: "text-yellow-500", // Will be styled uniquely in UI
        isActive: false, // Activated via Admin Panel
        destA: 'EVENT A STATION', 
        destB: 'EVENT B STATION', 
        transferStation: null, 
        relayStation: null,
        sheetKeys: { weekday_to_a: 'event_to_a_weekday', weekday_to_b: 'event_to_b_weekday', saturday_to_a: 'event_to_a_sat', saturday_to_b: 'event_to_b_sat' } 
    },
    'pta-pien': { 
        id: 'pta-pien', 
        name: "Pretoria <-> Pienaarspoort", 
        corridorId: "EAST_LINE",
        region: "GP",
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
        region: "GP",
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
        region: "GP",
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
        region: "GP",
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
        region: "GP",
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
        region: "GP",
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
        region: "GP",
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
        region: "GP",
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
        region: "GP",
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
        region: "GP",
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
        region: "GP",
        colorClass: "text-blue-500", 
        isActive: true, 
        destA: 'PRETORIA STATION', 
        destB: 'KEMPTON PARK STATION', 
        transferStation: null, 
        sheetKeys: {
            weekday_to_a: 'kemp_to_pta_weekday', 
            weekday_to_b: 'pta_to_kemp_weekday', // GUARDIAN: FIXED KEY
            saturday_to_a: 'kemp_to_pta_sat', 
            saturday_to_b: 'pta_to_kemp_sat'     // GUARDIAN: FIXED KEY
        } 
    },
    'jhb-rand': { 
        id: 'jhb-rand', 
        name: "JHB <-> Randfontein", 
        corridorId: "JHB_WEST", 
        region: "GP",
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
        name: "JHB <-> Naledi", 
        corridorId: "JHB_WEST", 
        region: "GP",
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
        region: "GP",
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

    // WESTERN CAPE REGION
    'ct-chrishani': { 
        id: 'ct-chrishani', 
        name: "Cape Town <-> Chris Hani", 
        corridorId: "WC_CENTRAL",
        region: "WC",
        colorClass: "text-orange-500", 
        isActive: true, 
        destA: 'CAPE TOWN STATION', 
        destB: 'CHRIS HANI STATION', 
        transferStation: null, 
        sheetKeys: { weekday_to_a: 'hani_to_ct_weekday', weekday_to_b: 'ct_to_hani_weekday', saturday_to_a: 'hani_to_ct_sat', saturday_to_b: 'ct_to_hani_sat' } 
    },
    'ct-kapteinsklip': { 
        id: 'ct-kapteinsklip', 
        name: "Cape Town <-> Kapteinsklip", 
        corridorId: "WC_CENTRAL",
        region: "WC",
        colorClass: "text-purple-500", 
        isActive: true, 
        destA: 'CAPE TOWN STATION', 
        destB: 'KAPTEINSKLIP STATION', 
        transferStation: null, 
        sheetKeys: { weekday_to_a: 'kap_to_ct_weekday', weekday_to_b: 'ct_to_kap_weekday', saturday_to_a: 'kap_to_ct_sat', saturday_to_b: 'ct_to_kap_sat' } 
    },
    'bellville-mutual': { 
        id: 'bellville-mutual', 
        name: "Bellville <-> Mutual", 
        corridorId: "WC_NORTHERN",
        region: "WC",
        colorClass: "text-green-500", 
        isActive: true, 
        destA: 'BELLVILLE STATION', 
        destB: 'MUTUAL STATION', 
        transferStation: null, 
        sheetKeys: { weekday_to_a: 'bellv_to_mutul_weekday', weekday_to_b: 'mutul_to_bellv_weekday', saturday_to_a: 'bellv_to_mutul_sat', saturday_to_b: 'mutul_to_bellv_sat' } 
    }
};

// 4. Refresh Settings
const REFRESH_CONFIG = { standardInterval: 5 * 60 * 1000, activeInterval: 60 * 1000, nightModeStart: 21, nightModeEnd: 4 };

// 5. Smart Pricing Configuration (RESTORED TO AUTHENTIC V5 LOGIC)
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

    'pta-kempton': {
        // Runs Tue, Wed, Thu only. Exclude Mon (1) and Fri (5).
        "0618": { days: [1, 5], reason: "Runs Tue-Thu Only" },
        "0619": { days: [1, 5], reason: "Runs Tue-Thu Only" }
    }
};

// 7. CHANGELOG 
// This drives the "What's New" modal.
const CHANGELOG_DATA = [
    {
        version: "Version 6.2 — Advanced Routing & Stability",
        date: "",
        features: [
            "<b>Smart Routing:</b> The Trip Planner now maps the absolute fastest connections across the network with boundless multi-transfer capabilities.",
            "<b>Optimized Connections:</b> Eliminated unnecessary early-departure transfers if a more convenient direct train arrives at the same time.",
            "<b>Seamless Navigation:</b> Resolved visual glitches on the Live Route Map and improved the accuracy of next-day schedule rollovers."
        ]
    },
    {
        version: "Version 6.1 — The Commuter Update",
        date: "",
        features: [
            "<b>Live GPS Maps:</b> View your real-time location on the interactive network map.",
            "<b>Smart Fares:</b> Prices now dynamically calculate your 40% Off-Peak and Pensioner discounts.",
            "<b>Fluid Navigation:</b> Eliminated accidental exits and smoothed out the App Router."
        ]
    },
    {
        version: "Version 6.0 — Regional Expansion & Fluid UX",
        date: "",
        features: [
            "<b>Western Cape Integration:</b> The Next Train network now officially supports the Western Cape, bringing offline-first schedules to Cape Town corridors.",
            "<b>The App Hub:</b> Settings, preferences, and offline syncing have been consolidated into a unified, swipeable navigation drawer for a premium native feel.",
            "<b>State Preservation:</b> Modals and routing now respect native Android/iOS back-button gestures, eliminating accidental app exits."
        ]
    },
    {
        version: "Version 5.0 — The Resilience Engine",
        date: "",
        features: [
            "<b>Full Timetable Grid:</b> Introduced the comprehensive schedule matrix, allowing commuters to visualize the entire day's train flow at a glance.",
            "<b>Deep Linking:</b> Trip Planner routes and schedules can now be shared seamlessly via WhatsApp or SMS, opening directly in-app for the recipient.",
            "<b>Offline Telemetry:</b> The app now intelligently caches your session history while underground, ensuring your recent searches are always available."
        ]
    },
    {
        version: "Version 4.0 — Intelligent Routing",
        date: "",
        features: [
            "<b>The Trip Planner:</b> Launched the core routing engine, automatically calculating direct trips, hub transfers, and complex bridge connections.",
            "<b>Smart Fares:</b> Integrated a dynamic fare calculator that adapts to off-peak hours and selected passenger profiles."
        ]
    }
];