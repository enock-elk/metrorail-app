/**
 * 🚅 METRORAIL NEXT TRAIN - GRID ORDER EXTRACTOR (GUARDIAN V3.2 - AUTO-SEEKER)
 * --------------------------------------------------------------
 * USAGE: node extract-grid.js
 * * UPDATES (V3.2):
 * 1. Auto-Seeker Logic: Scans the first 5 rows to automatically find the Train Numbers, ignoring the manual config row number.
 * 2. Batch Processing: Scans for BOTH 'GP' and 'WC' schedule files simultaneously.
 * 3. Smart Parsing: Automatically handles data pasted into Column A as comma-separated strings (no need for Text-to-Columns).
 * 4. Merges extracted data from all regions into a single config.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// --- CONSTANTS ---
const CONFIG_SHEET_NAME = 'Config_GridOrder';
const OUTPUT_FILENAME = 'grid-order.js';

// --- CONFIG: Where to look for the output folder? ---
const TARGET_DIRECTORIES = [
    '../../Source Code/js',      // 1. Your specific structure
    '../../js',                  // 2. Standard sibling structure
    './js',                      // 3. Current folder sub-directory
    './'                         // 4. Fallback (Current folder)
];

// --- HELPER: Find ALL latest Schedule Files (GP & WC) ---
function findAllScheduleFiles() {
    const files = fs.readdirSync(process.cwd());
    
    // Match any variation of NextTrain Schedules (GP, WC, or generic)
    const scheduleFiles = files.filter(file => 
        /^(Next)?Train\s*(GP|WC)?-?Schedules.*\.xlsx$/i.test(file) && !file.startsWith('~$')
    );

    if (scheduleFiles.length === 0) return [];

    const latestFiles = {};
    
    scheduleFiles.forEach(file => {
        // Group by region prefix to ensure we get the NEWEST of EACH region
        let region = 'GENERAL';
        if (file.toLowerCase().includes('gp-')) region = 'GP';
        if (file.toLowerCase().includes('wc-')) region = 'WC';
        
        const stats = fs.statSync(file);
        
        if (!latestFiles[region] || stats.mtimeMs > latestFiles[region].mtimeMs) {
            latestFiles[region] = { file, mtimeMs: stats.mtimeMs };
        }
    });

    return Object.values(latestFiles).map(item => item.file);
}

// --- HELPER: Excel Column to Index (e.g., 'C' -> 2) ---
function colToIndex(colStr) {
    let index = 0;
    for (let i = 0; i < colStr.length; i++) {
        index = index * 26 + (colStr.charCodeAt(i) - 64);
    }
    return index - 1;
}

// --- MAIN EXECUTION ---
function run() {
    console.log("==============================================");
    console.log(" 🚅 NEXT TRAIN GRID EXTRACTOR (AUTO-SEEKER V3.2)");
    console.log("==============================================");

    const sourceFiles = findAllScheduleFiles();

    if (sourceFiles.length === 0) {
        console.error("❌ ERROR: No schedule files found.");
        console.error("   Please ensure files are named like 'NextTrain GP-Schedules - [Date].xlsx'");
        process.exit(1);
    }

    console.log(`\n🔍 Found ${sourceFiles.length} latest regional file(s) to process:`);
    sourceFiles.forEach(f => console.log(`   - ${f}`));

    let masterExtractedData = {};
    let totalRouteCount = 0;

    // Process each file sequentially
    sourceFiles.forEach(sourceFile => {
        console.log(`\n📂 Processing File: ${sourceFile}`);
        
        const workbook = XLSX.readFile(sourceFile);
        
        if (!workbook.Sheets[CONFIG_SHEET_NAME]) {
            console.warn(`   ⚠️ WARNING: Sheet '${CONFIG_SHEET_NAME}' not found. Skipping file.`);
            return; 
        }

        // Read as raw 2D array to bypass header mapping issues
        const rawConfigData = XLSX.utils.sheet_to_json(workbook.Sheets[CONFIG_SHEET_NAME], { header: 1 });
        let fileRouteCount = 0;

        for (let i = 0; i < rawConfigData.length; i++) {
            const row = rawConfigData[i];
            if (!row || row.length === 0) continue;

            let key, sheetName, startColStr;

            // SMART PARSE: Check if data is clumped into Column A as a CSV string
            if (row.length === 1 && typeof row[0] === 'string' && row[0].includes(',')) {
                // Split by comma and strip any surrounding quotes Excel added
                const parts = row[0].split(',').map(s => s.replace(/(^"|"$)/g, '').trim());
                key = parts[0];
                sheetName = parts[1];
                // We ignore parts[2] (RowNumber) entirely now
                startColStr = parts[3] || 'C';
            } else {
                // STANDARD PARSE: Data is already in separate columns
                key = String(row[0] || '').trim();
                sheetName = String(row[1] || '').trim();
                startColStr = String(row[3] || 'C').trim();
            }

            // Skip invalid rows and header row
            if (!key || key.toLowerCase() === 'key' || !sheetName) continue;

            const sheet = workbook.Sheets[sheetName];
            
            if (!sheet) {
                if (!sheetName.toLowerCase().includes('sun')) {
                    console.log(`   ⚠️  Missing sheet: ${sheetName}`);
                }
                continue;
            }

            // Decode range
            const range = XLSX.utils.decode_range(sheet['!ref']);
            const startColIdx = colToIndex(startColStr);

            let trainNumbers = [];
            let foundRow = -1;

            // GUARDIAN V3.2: AUTO-SEEKER LOGIC
            // Scan the first 5 rows (0 to 4) to find the row containing train numbers
            for (let r = 0; r <= Math.min(4, range.e.r); r++) {
                let tempNumbers = [];
                let matchCount = 0;

                for (let C = startColIdx; C <= range.e.c; ++C) {
                    const cellAddress = {c: C, r: r};
                    const cellRef = XLSX.utils.encode_cell(cellAddress);
                    const cell = sheet[cellRef];

                    if (cell && cell.v) {
                        const val = String(cell.v).trim();
                        // Match train number format (e.g., "0604", "9121b")
                        if (/^\d{4}[a-zA-Z]*$/.test(val)) {
                            tempNumbers.push(val);
                            matchCount++;
                        }
                    }
                }

                // If we found at least 2 train numbers in this row, we assume this is the header row
                if (matchCount >= 2) {
                    trainNumbers = tempNumbers;
                    foundRow = r;
                    break; // Stop searching once found
                }
            }

            if (trainNumbers.length > 0) {
                masterExtractedData[key] = trainNumbers;
                fileRouteCount++;
                totalRouteCount++;
            } else {
                 console.log(`   ℹ️  ${key}: No trains found on tab '${sheetName}' (Scanned rows 1-5)`);
            }
        }
        
        console.log(`   ✅ Extracted ${fileRouteCount} grid configs from this file.`);
    });

    // Generate output content
    const today = new Date().toISOString().split('T')[0];
    const sourceNames = sourceFiles.join(', ');
    
    const fileContent = `/**
 * METRORAIL NEXT TRAIN - GRID ORDER CONFIG
 * ---------------------------------------------------
 * This file defines the explicit column order for the Full Schedule Grid.
 * Generated from: ${sourceNames}
 * Date: ${today}
 */

const MANUAL_GRID_ORDER = ${JSON.stringify(masterExtractedData, null, 4)};
`;

    // --- SMART PATH DETECTION ---
    let savedPath = null;
    
    for (const relativePath of TARGET_DIRECTORIES) {
        const absolutePath = path.resolve(process.cwd(), relativePath);
        if (fs.existsSync(absolutePath)) {
            if (fs.lstatSync(absolutePath).isDirectory()) {
                savedPath = path.join(absolutePath, OUTPUT_FILENAME);
                break;
            }
        }
    }

    if (savedPath) {
        fs.writeFileSync(savedPath, fileContent);
        console.log(`\n🎉 SUCCESS! Processed ${totalRouteCount} total routes across all files.`);
        console.log(`💾 Master File Saved to: ${savedPath}`);
    } else {
        console.error("\n❌ ERROR: Could not find target directory to save grid-order.js.");
        console.error("   Searched in:", TARGET_DIRECTORIES);
    }
}

run();