// --- CONFIGURATION & CONSTANTS ---

// 0. Version Control
const APP_VERSION = "V4.43.0"; // Updated for Soweto Expansion (Naledi)

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
        transferStation: null, 
        sheetKeys: {
            weekday_to_a: 'rand_to_jhb_weekday', 
            weekday_to_b: 'jhb_to_rand_weekday',
            saturday_to_a: 'rand_to_jhb_sat', 
            saturday_to_b: 'jhb_to_rand_sat'
        } 
    },
    // --- NEW: SOWETO EXPANSION ---
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
    'jhb-vereeniging': { id: 'jhb-vereeniging', name: "JHB <-> Vereeniging", corridorId: "JHB_SOUTH", colorClass: "text-purple-500", isActive: false, destA: 'JOHANNESBURG STATION', destB: 'VEREENIGING STATION', transferStation: null, sheetKeys: {} },
    'jhb-springs': { id: 'jhb-springs', name: "JHB <-> Springs", corridorId: "JHB_EAST", colorClass: "text-red-500", isActive: false, destA: 'JOHANNESBURG STATION', destB: 'SPRINGS STATION', transferStation: null, sheetKeys: {} }
};

// 4. Refresh Settings
const REFRESH_CONFIG = { standardInterval: 5 * 60 * 1000, activeInterval: 60 * 1000, nightModeStart: 21, nightModeEnd: 4 };

// 5. Smart Pricing Configuration (V4.39.1)
const FARE_CONFIG = {
    offPeakStart: 9.5,  // 09:30
    offPeakEnd: 14.5,   // 14:30
    zones: {
        "Z1": 10.00,
        "Z2": 12.00,
        "Z3": 14.00,
        "Z4": 15.00
    },
    profiles: {
        "Adult":     { base: 1.0, offPeak: 0.6 }, 
        "Scholar":   { base: 0.5, offPeak: 0.5 }, 
        "Pensioner": { base: 1.0, offPeak: 0.5 }, 
        "Military":  { base: 1.0, offPeak: 0.5 }  
    }
};