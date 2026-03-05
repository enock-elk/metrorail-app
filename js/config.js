// --- CONFIGURATION & CONSTANTS ---

// 0. Version Control
const APP_VERSION = "V5.10.22 - 05 MAR"; 
// GUARDIAN: Set to 'true' to force an immediate hard reload on startup. 
// Set to 'false' for silent background updates (Stale-While-Revalidate).
const FORCE_UPDATE_REQUIRED = true;

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

// 2. API Endpoints
const DATABASE_URL = "https://metrorail-next-train-default-rtdb.firebaseio.com/schedules.json";
const MAX_RADIUS_KM = 6; 

// 3. Route Definitions
const ROUTES = {
    // NEW V5.01: Dynamic Special Event Scaffold (Hidden by Default)
    'special_event': { 
        id: 'special_event', 
        name: "Special Event Route", 
        corridorId: "SPECIAL",
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
        version: "V5.10.20",
        date: "27 Feb 2026",
        features: [
            "✨ <b>Light/Dark Mode on Start:</b> Toggle your preferred theme directly from the Welcome Screen.",
            "🕒 <b>Smarter Time Formats:</b> Wait times are now easier to read at a glance (e.g., '1 hr 15 min').",
            "📅 <b>Planner Upgrades:</b> Swap your travel days instantly with the new clickable badge in your search results.",
            "🚉 <b>Station Name Polish:</b> Improved naming for hubs like Kempton Park to make searching faster.",
            "🚀 <b>Smoother Sharing:</b> We've improved trip sharing so sending a route to friends or employers is now 100% accurate."
        ]
    },
    {
        version: "V5.00.10",
        date: "15 Feb 2026",
        features: [
            "✨ <b>Adaptive Export:</b> 'Save Image' now respects your Light/Dark theme preference.",
            "📸 <b>Export Polish:</b> Compact layouts, professional metadata, and clearer typography for sharing schedules.",
            "👻 <b>Maintenance Mode:</b> Floating banner bug fixed; now correctly contained within the app card.",
            "👆 <b>Smart Defaults:</b> Grid view now anticipates Monday planning when viewed on Sundays."
        ]
    },
    {
        version: "V5.00.04",
        date: "14 Feb 2026",
        features: [
            "🛤 <b>New Route:</b> Hercules <-> Koedoespoort now available (Weekday Service).",
            "🚀 <b>Trip Planner:</b> Now supports Bridge Trips (2 Transfers) for long-distance travel."
        ]
    }
];