/**
 * METRORAIL NEXT TRAIN - PLANNER CORE (V7_07.12 - Performance Polish Edition)
 * -----------------------------------------------------------------------------
 * THE "SOUS-CHEF" (Brain)
 * This module contains PURE LOGIC for route calculation.
 * It does NOT access the DOM (HTML). 
 * It relies on data provided by config.js and logic.js (fullDatabase, ROUTES).
 *
 * CHRONOLOGICAL CHANGE LOG:
 * * GUARDIAN PHASE 1 [18 Nov 2025]: Injected the Path-Diversity Signature Engine so trips on different physical paths do not delete each other.
 * * GUARDIAN PHASE 1 [18 Nov 2025]: Embedded tracking analytics for complex (3+ transfer) route rendering.
 * * GUARDIAN PHASE 2 [04 Dec 2025]: Patched Easter Holiday Midnight Rollover via Calendar Sync, and upgraded the Dominance Filter to purge useless, late-arriving early transfers.
 * * GUARDIAN PHASE 2 [12 Dec 2025]: Extracted the Macro Corridor Engine from the CPU short-circuit block to allow multi-segment bypass routings (Strike 1).
 * * GUARDIAN PHASE 3 [24 Dec 2025]: Merged un-boomeranged Composite Relays and curved map vector coordinate calculation (Strike 3).
 * * GUARDIAN PHASE 4 [02 Jan 2026]: Reverted Transit Incident Graph Severance to allow visual UI fracturing on compromised segments.
 * * GUARDIAN PHASE 5 [22 Jan 2026]: Relaxed layover buffers to 0 minutes to safely catch instant cross-platform transfers.
 * * GUARDIAN PHASE 5 [22 Jan 2026]: Upgraded ERR_ACTIVE_SUSPENSION heuristic results to bubble up rich disruption objects for active commuter cards.
 * * GUARDIAN FIX 3 [12 Feb 2026]: Developed the Leg Compactor to merge phantom boundary transfers sharing the same Train ID.
 * * GUARDIAN PHASE 13 [04 Mar 2026]: Designed the Zero-Hour Probe to mathematically analyze impossible holiday/weekend routes to distinguish them from standard missed trains.
 * * GUARDIAN PHASE D [26 Mar 2026]: Injected dayOffset mathematical payloads into the rollover triggers to resolve 24-hour UI countdown hallucinations.
 * * GUARDIAN PHASE 14 [10 Apr 2026]: Replaced blind NO_PATH failures with precise analytical heuristic probes (Cross-Region, Graph Severance, Schedule Desert) for exact UI rendering.
 * * GUARDIAN PHASE 15 [24 Apr 2026]: Eradicated recursive loop vulnerabilities by deploying flat, outer 7-day loop structures to protect the call stack.
 * * GROWTH MODE PHASE 2 [12 May 2026]: Injected the Infinite Rollover and Smart Calendar Sync Engine to resolve 'Sunday No Route' and 'Impossible Today' UI dead-ends.
 * * GROWTH MODE PHASE 3 [20 May 2026]: Added the Explicit Override Fix so static day dropdown selections bypass 7-day physical calendar sync checks.
 * * GROWTH MODE PHASE 7 [17 Jun 2026]: Expanded core transfer waiting tolerance from 3 hours to 4 hours to accommodate sparse holiday timetables.
 * * GROWTH MODE PHASE 10 [29 Jun 2026]: Stripped departure time filtering constraints to expose departed trains to the UI dropdown, and hardened rollover checks via hasUpcoming.
 * * GUARDIAN PHASE 18 [05 Jul 2026]: Hardened the engine against global state pollution via Context threading and fixed falsy transfer matrix evaluations.
 * * V7.00.02 [10 Jul 2026]: Deployed the True Time - Dependent Dijkstra Engine with train-bound state tracking, penalty buffers, and hub-banning diversity matrices.
 */

// --- 1. LEGACY CORE ALGORITHMS (Preserved for Safety & Exhaustive Fallbacks) ---

function planDirectTrip(origin, dest, dayType, isRollover = false, context = {}) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    const commonRoutes = [...originRoutes].filter(x => destRoutes.has(x));

    if (commonRoutes.length === 0) return { status: 'NO_PATH', trips: [] };

    let bestTrips = [];
    let pathFoundToday = false;
    let pathExistsGenerally = false;

    for (const routeId of commonRoutes) {
        const routeConfig = ROUTES[routeId];
        const directions = getDirectionsForRoute(routeConfig, dayType);
        
        for (let dir of directions) {
            if (!fullDatabase || !fullDatabase[dir.key]) continue;
            const schedule = parseJSONSchedule(fullDatabase[dir.key]);
            const originRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(origin));
            const destRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(dest));

            if (originRow && destRow) {
                const originIdx = schedule.rows.indexOf(originRow);
                const destIdx = schedule.rows.indexOf(destRow);
                // Direction Check: Origin must come BEFORE Destination
                if (originIdx < destIdx) {
                    pathFoundToday = true; 
                    pathExistsGenerally = true;
                    // GUARDIAN: Pass routeId and isolated context for exclusion checks
                    const upcomingTrains = findUpcomingTrainsForLeg(schedule, originRow, destRow, dayType, true, routeId, context); 
                    if (upcomingTrains.length > 0) {
                        bestTrips = [...bestTrips, ...upcomingTrains.map(info => 
                            createTripObject(routeConfig, info, schedule, originIdx, destIdx, origin, dest)
                        )];
                    }
                }
            }
        }
    }

    if (bestTrips.length > 0) return { status: 'FOUND', trips: bestTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime)) };
    return { status: (pathExistsGenerally || pathFoundToday) ? 'NO_SERVICE' : 'NO_PATH', trips: [] };
}

function planHubTransferTrip(origin, dest, dayType, isRollover = false, context = {}) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    
    const allKnownHubs = getDynamicHubs(); 
    
    // Filter hubs that are actually RELEVANT
    const potentialHubs = allKnownHubs.filter(hub => {
        const hubData = globalStationIndex[normalizeStationName(hub)];
        if (!hubData) return false;
        
        // Basic Connectivity Check
        const toHub = [...originRoutes].some(rId => hubData.routes.has(rId));
        const fromHub = [...destRoutes].some(rId => hubData.routes.has(rId));
        const isTrivial = (normalizeStationName(hub) === normalizeStationName(origin)) || (normalizeStationName(hub) === normalizeStationName(dest));
        
        if (!toHub || !fromHub || isTrivial) return false;
        return true;
    });

    if (potentialHubs.length === 0) return { status: 'NO_PATH', trips: [] };

    let allTransferOptions = [];
    
    for (const hub of potentialHubs) {
        // LEG 1: Origin -> Hub (FIX: ENABLED RELAY EXPANSION)
        const leg1Options = findAllLegsWithRelayExpansion(origin, hub, originRoutes, dayType, context);
        if (leg1Options.length === 0) continue;
        
        // LEG 2: Hub -> Dest (STANDARD + RELAY RECURSION)
        const leg2Options = findAllLegsWithRelayExpansion(hub, dest, destRoutes, dayType, context); 
        if (leg2Options.length === 0) continue;

        const TRANSFER_BUFFER_SEC = 0; // GUARDIAN Phase 5: Dropped to 0 to catch instant platform transfers

        leg1Options.forEach(leg1 => {
            const arrivalSec = timeToSeconds(leg1.arrTime);
            
            leg2Options.forEach(leg2 => {
                // No Loopbacks (Route ID check, simple)
                if (leg1.route.id === leg2.route.id && !leg2.isRelayComposite && !leg1.isRelayComposite) {
                    return; 
                }

                // SMART PRUNING CHECK (V4.58 Feature)
                if (isTrainFasterDirect(leg1.route, leg1.train, dest, dayType, leg2.arrTime)) {
                    return; 
                }

                // LOGICAL PATH CHECK (V4.59 Feature)
                if (!isPathLogical(leg1, leg2, dest)) {
                    return;
                }

                const departSec = timeToSeconds(leg2.depTime);
                const waitTime = departSec - arrivalSec;

                // 🛡️ GUARDIAN PHASE 1: The Midnight Barrier (Blocks cross-day stitching)
                if (waitTime < 0) return;

                if (waitTime >= TRANSFER_BUFFER_SEC) {
                    allTransferOptions.push({
                        type: 'TRANSFER',
                        route: leg1.route, 
                        from: origin, to: dest,
                        transferStation: hub,
                        depTime: leg1.depTime, arrTime: leg2.arrTime,
                        train: leg1.train, leg1: leg1, leg2: leg2,
                        totalDuration: (timeToSeconds(leg2.arrTime) - timeToSeconds(leg1.depTime))
                    });
                }
            });
        });
    }

    let unique = [];
    if (allTransferOptions.length > 0) {
        allTransferOptions.sort((a,b) => {
            const depDiff = timeToSeconds(a.depTime) - timeToSeconds(b.depTime);
            return depDiff !== 0 ? depDiff : a.totalDuration - b.totalDuration;
        });
        // BUG FIX: The old key was depTime alone, which silently discarded valid options
        // that share a departure time but use a completely different hub or arrive much later.
        // The key must be (depTime + transferStation) so each physical path is preserved.
        const seenKeys = new Set();
        allTransferOptions.forEach(opt => {
            const key = `${opt.depTime}|${normalizeStationName(opt.transferStation)}`;
            if (!seenKeys.has(key)) { seenKeys.add(key); unique.push(opt); }
        });
    }

    if (unique.length > 0) return { status: 'FOUND', trips: unique };
    return { status: 'NO_PATH', trips: [] };
}

function planRelayTransferTrip(origin, dest, dayType, isRollover = false, context = {}) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    // Intersection: Same route for Start and End (but logic forces a split)
    const commonRoutes = [...originRoutes].filter(x => destRoutes.has(x));
    
    let allRelayTrips = [];

    if (commonRoutes.length > 0) {
        commonRoutes.forEach(routeId => {
            const routeConfig = ROUTES[routeId];
            // 1. Check if this route has a configured Relay Station (e.g. Koedoespoort, Roodepoort, Rosslyn)
            if (!routeConfig.relayStation) return;

            const relayStationName = normalizeStationName(routeConfig.relayStation);
            
            // 3. Find Legs: Origin -> Relay
            const legs1 = findAllLegsBetween(origin, relayStationName, new Set([routeId]), dayType, context);
            if (legs1.length === 0) return;

            // 4. Find Legs: Relay -> Dest
            const legs2 = findAllLegsBetween(relayStationName, dest, new Set([routeId]), dayType, context);
            if (legs2.length === 0) return;

            const TRANSFER_BUFFER_SEC = 0; // GUARDIAN Phase 5: Dropped to 0 to catch instant platform transfers

            legs1.forEach(l1 => {
                const arr1 = timeToSeconds(l1.arrTime);
                
                legs2.forEach(l2 => {
                    const dep2 = timeToSeconds(l2.depTime);
                    const wait = dep2 - arr1;

                    // 🛡️ GUARDIAN PHASE 1: The Midnight Barrier (Blocks cross-day stitching)
                    if (wait < 0) return;

                    if (wait >= TRANSFER_BUFFER_SEC) {
                        // GUARDIAN V6.24 BUGFIX: If the same train number continues through the
                        // relay station (e.g. train 9116 runs Waltoo->Koedoespoort->Pretoria
                        // as one service), no passenger transfer is needed. Present as DIRECT.
                        if (l1.train === l2.train) {
                            allRelayTrips.push({
                                type: 'DIRECT',
                                route: routeConfig,
                                from: origin, to: dest,
                                depTime: l1.depTime,
                                arrTime: l2.arrTime,
                                train: l1.train,
                                stops: [...(l1.stops || []), ...(l2.stops || []).slice(1)],
                                totalDuration: (timeToSeconds(l2.arrTime) - timeToSeconds(l1.depTime))
                            });
                        } else {
                            allRelayTrips.push({
                                type: 'TRANSFER', // Reuse existing UI type
                                route: routeConfig, // Main Route
                                from: origin, to: dest,
                                transferStation: routeConfig.relayStation,
                                depTime: l1.depTime,
                                arrTime: l2.arrTime,
                                train: l1.train,
                                leg1: l1,
                                leg2: l2,
                                totalDuration: (timeToSeconds(l2.arrTime) - timeToSeconds(l1.depTime))
                            });
                        }
                    }
                });
            });
        });
    }

    return { trips: allRelayTrips };
}

// GUARDIAN PHASE 2 & 5: The Hardcoded Multi-Corridor Engine
function planMacroCorridorTrip(origin, dest, dayType, isRollover = false, context = {}) {
    // 🛡️ GUARDIAN PHASE 2 (CPU Optimizer): This engine is highly specialized for Gauteng hub geometries.
    if (typeof currentRegion !== 'undefined' && currentRegion !== 'GP') return { trips: [] };

    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    
    // Line categorizations based on the Network Map
    const jhbLines = ['JHB_CORE', 'JHB_EAST', 'JHB_WEST', 'JHB_SOUTH'];
    const ptaLines = ['SOUTH_LINE', 'NORTH_LINE', 'EAST_LINE', 'SAUL_LINE', 'SPECIAL'];
    const eastLines = ['EAST_LINE'];
    const northLines = ['NORTH_LINE'];

    const hasLine = (routes, linesArray) => {
        for (const rId of routes) {
            if (ROUTES[rId] && linesArray.includes(ROUTES[rId].corridorId)) return true;
        }
        return false;
    };

    let trips = [];

    // GUARDIAN Phase 2: Array of explicitly defined heavy-bridge corridors
    const macros = [
        { // JHB to PTA
            condition: hasLine(originRoutes, jhbLines) && hasLine(destRoutes, ptaLines),
            h1: 'GERMISTON', h2: 'KEMPTON PARK', bridgeId: 'germ-leralla'
        },
        { // PTA to JHB
            condition: hasLine(originRoutes, ptaLines) && hasLine(destRoutes, jhbLines),
            h1: 'KEMPTON PARK', h2: 'GERMISTON', bridgeId: 'germ-leralla'
        },
        { // EAST to NORTH (e.g., Waltoo -> Koedoespoort -> Hercules -> Mabopane)
            condition: hasLine(originRoutes, eastLines) && hasLine(destRoutes, northLines) && !originRoutes.has('herc-koed') && !destRoutes.has('herc-koed'),
            h1: 'KOEDOESPOORT', h2: 'HERCULES', bridgeId: 'herc-koed'
        },
        { // NORTH to EAST (e.g., Mabopane -> Hercules -> Koedoespoort -> Waltoo)
            condition: hasLine(originRoutes, northLines) && hasLine(destRoutes, eastLines) && !originRoutes.has('herc-koed') && !destRoutes.has('herc-koed'),
            h1: 'HERCULES', h2: 'KOEDOESPOORT', bridgeId: 'herc-koed'
        }
    ];

    let matchedAny = false;

    // Evaluate targeted origin/dest route combinations that hit these hubs perfectly
    for (const macro of macros) {
        if (macro.condition) {
            matchedAny = true;
            const bridgeRoute = ROUTES[macro.bridgeId];
            if (!bridgeRoute || !bridgeRoute.isActive) continue;

            for (const r1 of originRoutes) {
                if (!globalStationIndex[macro.h1]?.routes.has(r1)) continue;
                for (const r3 of destRoutes) {
                    if (!globalStationIndex[macro.h2]?.routes.has(r3)) continue;
                    
                    const newTrips = calculateThreeLegTrip(
                        origin, macro.h1, macro.h2, dest,
                        ROUTES[r1], bridgeRoute, ROUTES[r3],
                        dayType, context
                    );
                    trips = [...trips, ...newTrips];
                }
            }
        }
    }
    
    if (!matchedAny || trips.length === 0) return { trips: [] };

    if (trips.length > 0) trips.sort((a,b) => timeToSeconds(a.arrTime) - timeToSeconds(b.arrTime));
    return { trips };
}

function planDoubleTransferTrip(origin, dest, dayType, isRollover = false, context = {}) {
    // 🛡️ GUARDIAN PHASE 2 (CPU Optimizer): Deep double-bridge traversal is currently only viable/necessary in the dense GP network.
    if (typeof currentRegion !== 'undefined' && currentRegion !== 'GP') return { status: 'NO_PATH', trips: [] };

    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    
    const allRouteIds = Object.keys(ROUTES).filter(id => ROUTES[id].isActive);
    let potentialTrips = [];

    // 1. Find Valid Path: OriginRoute -> BridgeRoute -> DestRoute
    for (const startRouteId of originRoutes) {
        for (const endRouteId of destRoutes) {
            if (startRouteId === endRouteId) continue;
            
            for (const bridgeRouteId of allRouteIds) {
                if (bridgeRouteId === startRouteId || bridgeRouteId === endRouteId) continue;

                const hubs1 = findIntersections(startRouteId, bridgeRouteId);
                if (hubs1.length === 0) continue;

                const hubs2 = findIntersections(bridgeRouteId, endRouteId);
                if (hubs2.length === 0) continue;

                // Nested Loop to check ALL Hub Combinations
                for (const hub1 of hubs1) {
                    for (const hub2 of hubs2) {
                        // Hubs must be different to form a bridge
                        if (normalizeStationName(hub1) === normalizeStationName(hub2)) continue;

                        const trips = calculateThreeLegTrip(
                            origin, hub1, hub2, dest,
                            ROUTES[startRouteId], ROUTES[bridgeRouteId], ROUTES[endRouteId],
                            dayType, context
                        );
                        potentialTrips = [...potentialTrips, ...trips];
                    }
                }
            }
        }
    }

    if (potentialTrips.length > 0) {
        potentialTrips.sort((a,b) => timeToSeconds(a.arrTime) - timeToSeconds(b.arrTime));
    }

    if (potentialTrips.length > 0) return { status: 'FOUND', trips: potentialTrips };
    return { status: 'NO_PATH', trips: [] };
}

// --- 2. LOGIC HELPERS (Preserved) ---

function getDynamicHubs() {
    if (typeof globalStationIndex === 'undefined') return [];
    
    // 1. Start with known Configured Transfer Stations
    const explicitHubs = new Set();
    Object.values(ROUTES).forEach(r => {
        if(r.isActive && r.transferStation) {
            explicitHubs.add(normalizeStationName(r.transferStation));
        }
    });

    // 2. Add stations with > 1 Active Routes
    const dynamicHubs = [];
    Object.entries(globalStationIndex).forEach(([stationName, data]) => {
        if (data.routes && data.routes.size > 1) {
            dynamicHubs.push(stationName);
        } else if (explicitHubs.has(stationName)) {
            dynamicHubs.push(stationName);
        }
    });

    return dynamicHubs;
}

function isTrainFasterDirect(route, trainName, targetStation, dayType, limitTime) {
    if (!route || !trainName || !targetStation) return false;
    
    const directions = getDirectionsForRoute(route, dayType);
    
    for (let dir of directions) {
        if (!fullDatabase || !fullDatabase[dir.key]) continue;
        const schedule = parseJSONSchedule(fullDatabase[dir.key]);
        const targetRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(targetStation));
        
        if (targetRow && targetRow[trainName]) {
            // Train goes to destination!
            // If limitTime is null, we just confirm connectivity (fastest possible)
            if (limitTime === null) return true;

            const directArr = timeToSeconds(targetRow[trainName]);
            const limitArr = timeToSeconds(limitTime);
            
            if (directArr <= limitArr) {
                return true; 
            }
        }
    }
    return false;
}

function isPathLogical(leg1, leg2, finalDest) {
    if (!leg1.stops || !leg2.stops) return true; // Can't validate without stops, allow.

    const normDest = normalizeStationName(finalDest);
    const hubName = normalizeStationName(leg1.to); // The Transfer Hub

    // RULE 1: OVERSHOOT CHECK
    const leg1Stations = new Set();
    for (const stop of leg1.stops) {
        const sName = normalizeStationName(stop.station);
        if (sName === normDest && sName !== hubName) {
            return false; 
        }
        leg1Stations.add(sName);
    }

    // RULE 2: BOOMERANG CHECK
    for (const stop of leg2.stops) {
        const sName = normalizeStationName(stop.station);
        if (sName !== hubName && leg1Stations.has(sName)) {
            return false; 
        }
    }

    return true;
}

function findAllLegsWithRelayExpansion(stationA, stationB, routeSet, dayType, context = {}) {
    let allLegs = [];
    const routesToCheck = routeSet ? [...routeSet] : Object.keys(ROUTES);

    for (const rId of routesToCheck) {
        const routeConfig = ROUTES[rId];
        
        // 1. Find Direct Legs (Standard)
        let directLegs = findAllLegsBetween(stationA, stationB, new Set([rId]), dayType, context);
        allLegs = [...allLegs, ...directLegs];

        // 2. Find Relay Composite Legs
        if (routeConfig.relayStation) {
            const relay = normalizeStationName(routeConfig.relayStation);
            
            // Cannot use relay if start/end IS the relay (avoid loops)
            if (normalizeStationName(stationA) === relay || normalizeStationName(stationB) === relay) continue;

            const legsToRelay = findAllLegsBetween(stationA, relay, new Set([rId]), dayType, context);
            if (legsToRelay.length > 0) {
                const legsFromRelay = findAllLegsBetween(relay, stationB, new Set([rId]), dayType, context);
                
                if (legsFromRelay.length > 0) {
                    const TRANSFER_BUFFER_SEC = 0; // GUARDIAN Phase 5: Dropped to 0 to catch instant platform transfers

                    legsToRelay.forEach(l1 => {
                        const arr1 = timeToSeconds(l1.arrTime);
                        
                        legsFromRelay.forEach(l2 => {
                            const dep2 = timeToSeconds(l2.depTime);
                            const wait = dep2 - arr1;
                            
                            // 🛡️ GUARDIAN PHASE 1: The Midnight Barrier (Blocks cross-day stitching)
                            if (wait < 0) return;

                            if (wait >= TRANSFER_BUFFER_SEC) {
                                if (l1.train === l2.train) {
                                    // GUARDIAN V6.24 BUGFIX: Same train number continues through
                                    // the relay station — the passenger stays seated, this is a
                                    // pure through-running service. Emit as a plain leg with NO
                                    // relay flags so it is never counted as a transfer anywhere
                                    // in the rendering or counting pipeline.
                                    allLegs.push({
                                        ...l1,
                                        to: stationB,
                                        arrTime: l2.arrTime,
                                        actualDestination: l2.actualDestination,
                                        stops: [...l1.stops, ...l2.stops.slice(1)]
                                    });
                                } else {
                                    // Different train numbers — a real platform transfer is needed.
                                    allLegs.push({
                                        ...l1,
                                        to: stationB,
                                        arrTime: l2.arrTime,
                                        actualDestination: l2.actualDestination,
                                        isRelayComposite: true,
                                        stops: [...l1.stops, ...l2.stops],
                                        internalTransfer: {
                                            station: relay,
                                            train1: l1.train,
                                            train2: l2.train,
                                            wait: wait
                                        }
                                    });
                                }
                            }
                        });
                    });
                }
            }
        }
    }
    return allLegs;
}

function findIntersections(routeAId, routeBId) {
    const intersections = [];
    for (const [stationName, data] of Object.entries(globalStationIndex)) {
        if (data.routes.has(routeAId) && data.routes.has(routeBId)) {
            intersections.push(stationName);
        }
    }
    return intersections;
}

function calculateThreeLegTrip(origin, hub1, hub2, dest, route1, route2, route3, dayType, context = {}) {
    const TRANSFER_BUFFER_SEC = 0; // GUARDIAN Phase 5: Dropped to 0 minutes

    // 1. Get All Leg Options ONCE for each segment to avoid redundant calculations in nested loops
    const legs1 = findAllLegsBetween(origin, hub1, new Set([route1.id]), dayType, context);
    if (legs1.length === 0) return [];

    const legs2 = findAllLegsBetween(hub1, hub2, new Set([route2.id]), dayType, context);
    if (legs2.length === 0) return [];

    const legs3 = findAllLegsBetween(hub2, dest, new Set([route3.id]), dayType, context);
    if (legs3.length === 0) return [];

    const trips = [];

    for (const l1 of legs1) {
        
        // PRUNE FIX: We used to pass `null` as limitTime, which made isTrainFasterDirect return
        // true whenever the train reached hub2 AT ALL — even hours after the connection window.
        // We now pass the departure time of the earliest available leg2 as the deadline.
        // This way we only skip Leg 1 if the same train genuinely beats the transfer connection.
        const earliestLeg2Dep = legs2.length > 0 
            ? legs2.reduce((min, l) => Math.min(min, timeToSeconds(l.depTime)), Infinity) 
            : Infinity;
        const leg2DepTimeStr = earliestLeg2Dep !== Infinity
            ? legs2.find(l => timeToSeconds(l.depTime) === earliestLeg2Dep)?.depTime
            : null;

        if (leg2DepTimeStr && isTrainFasterDirect(l1.route, l1.train, hub2, dayType, leg2DepTimeStr)) {
            continue; 
        }

        const arr1 = timeToSeconds(l1.arrTime);
        const validLegs2 = legs2.filter(l2 => {
            const dep2 = timeToSeconds(l2.depTime);
            const wait = dep2 - arr1;
            // 🛡️ GUARDIAN PHASE 1: The Midnight Barrier (Blocks cross-day stitching)
            if (wait < 0) return false;
            return wait >= TRANSFER_BUFFER_SEC;
        });

        for (const l2 of validLegs2) {
            
            // PRUNE FIX: Same correction — use earliest leg3 departure as the deadline.
            const earliestLeg3Dep = legs3.length > 0
                ? legs3.reduce((min, l) => Math.min(min, timeToSeconds(l.depTime)), Infinity)
                : Infinity;
            const leg3DepTimeStr = earliestLeg3Dep !== Infinity
                ? legs3.find(l => timeToSeconds(l.depTime) === earliestLeg3Dep)?.depTime
                : null;

            if (leg3DepTimeStr && isTrainFasterDirect(l2.route, l2.train, dest, dayType, leg3DepTimeStr)) {
                continue;
            }

            const arr2 = timeToSeconds(l2.arrTime);
            const validLegs3 = legs3.filter(l3 => {
                const dep3 = timeToSeconds(l3.depTime);
                const wait = dep3 - arr2;
                // 🛡️ GUARDIAN PHASE 1: The Midnight Barrier (Blocks cross-day stitching)
                if (wait < 0) return false;
                return wait >= TRANSFER_BUFFER_SEC;
            });

            for (const l3 of validLegs3) {
                trips.push({
                    type: 'DOUBLE_TRANSFER',
                    from: origin, to: dest,
                    depTime: l1.depTime,
                    arrTime: l3.arrTime,
                    totalDuration: timeToSeconds(l3.arrTime) - timeToSeconds(l1.depTime),
                    train: l1.train, 
                    leg1: l1, hub1: hub1,
                    leg2: l2, hub2: hub2,
                    leg3: l3,
                    routePath: [route1.name, route2.name, route3.name]
                });
            }
        }
    }
    return trips;
}

function findAllLegsBetween(stationA, stationB, routeSet, dayType, context = {}) {
    let legs = [];
    const routesToCheck = routeSet ? [...routeSet] : Object.keys(ROUTES);
    for (const rId of routesToCheck) {
        const routeConfig = ROUTES[rId];
        let directions = getDirectionsForRoute(routeConfig, dayType);
        for (let dir of directions) {
            if (!fullDatabase || !fullDatabase[dir.key]) continue;
            const schedule = parseJSONSchedule(fullDatabase[dir.key]);
            const rowA = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(stationA));
            const rowB = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(stationB));
            if (rowA && rowB) {
                const idxA = schedule.rows.indexOf(rowA);
                const idxB = schedule.rows.indexOf(rowB);
                if (idxA < idxB) {
                    findUpcomingTrainsForLeg(schedule, rowA, rowB, dayType, true, rId, context).forEach(t => {
                        legs.push(createTripObject(routeConfig, t, schedule, idxA, idxB, stationA, stationB));
                    });
                }
            }
        }
    }
    return legs;
}

function getDirectionsForRoute(route, dayType) {
    if (dayType === 'weekday') return [{ key: route.sheetKeys.weekday_to_a }, { key: route.sheetKeys.weekday_to_b }];
    if (dayType === 'saturday') return [{ key: route.sheetKeys.saturday_to_a }, { key: route.sheetKeys.saturday_to_b }];
    return []; 
}

function createTripObject(route, trainInfo, schedule, startIdx, endIdx, origin, dest) {
    let actualDest = dest;
    if (schedule && schedule.rows && schedule.rows.length > 0) {
        // Try to get the last station in this direction from schedule
        const lastRow = schedule.rows[schedule.rows.length - 1];
        if (lastRow && lastRow.STATION) actualDest = lastRow.STATION;
    }

    return {
        type: 'DIRECT', route: route, from: origin, to: dest,
        train: trainInfo.trainName, depTime: trainInfo.depTime, arrTime: trainInfo.arrTime,
        actualDestination: actualDest,
        stops: (schedule && startIdx !== undefined) ? getIntermediateStops(schedule, startIdx, endIdx, trainInfo.trainName) : []
    };
}

function findUpcomingTrainsForLeg(schedule, originRow, destRow, dayType, allowPast = false, routeId = null, context = {}) {
    const isToday = (dayType === currentDayType);
    
    // GUARDIAN P13: Zero-Hour Probe explicitly bypasses `currentTime` constraints, simulating a 00:00 start
    const nowSeconds = (isToday && !allowPast && !context.zeroHourProbeActive) ? timeToSeconds(currentTime) : 0; 
    
    let exclusionDayIdx = 1; // Default Monday
    if (context.targetDayIdx !== undefined) {
        exclusionDayIdx = context.targetDayIdx;
    } else if (isToday) {
        exclusionDayIdx = currentDayIndex;
    } else {
        if (dayType === 'saturday') exclusionDayIdx = 6;
        if (dayType === 'sunday') exclusionDayIdx = 0;
    }

    let upcomingTrains = [];
    schedule.headers.slice(1).forEach(trainName => {
        
        // GUARDIAN: The Excluder
        if (routeId && isTrainExcluded(trainName, routeId, exclusionDayIdx)) return;

        const depTime = originRow[trainName], arrTime = destRow[trainName];
        if (depTime && arrTime) {
            const depSeconds = timeToSeconds(depTime);
            if (depSeconds >= nowSeconds) upcomingTrains.push({ trainName, depTime, arrTime, seconds: depSeconds });
        }
    });
    return upcomingTrains.sort((a, b) => a.seconds - b.seconds);
}

function getIntermediateStops(schedule, startIndex, endIndex, trainName) {
    let stops = [];
    for (let i = startIndex; i <= endIndex; i++) {
        const row = schedule.rows[i];
        let t = row[trainName];
        // GUARDIAN STRIKE 3: Force inclusion of empty stations so Leaflet maps draw the curved tracks correctly!
        if (!t || String(t).trim() === "" || String(t).trim() === "-") {
            t = "---";
        }
        stops.push({ station: row.STATION, time: t });
    }
    return stops;
}


// -----------------------------------------------------------------------------
// SECTION 3: TRUE TIME-DEPENDENT DIJKSTRA ENGINE (WITH TRAIN-BOUND STATE)
// -----------------------------------------------------------------------------

/**
 * Lightweight binary min-heap priority queue.
 * Items are [priority: number, payload: any].
 * O(log n) push and pop.
 */
class TransitMinHeap {
    constructor() { this._h = []; }
    push(p, v) { this._h.push([p, v]); this._up(this._h.length - 1); }
    pop() {
        if (this._h.length === 0) return null;
        const top  = this._h[0];
        const last = this._h.pop();
        if (this._h.length > 0) { this._h[0] = last; this._down(0); }
        return top;
    }
    get size() { return this._h.length; }
    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this._h[p][0] <= this._h[i][0]) break;
            [this._h[p], this._h[i]] = [this._h[i], this._h[p]];
            i = p;
        }
    }
    _down(i) {
        const n = this._h.length;
        for (;;) {
            let s = i, l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && this._h[l][0] < this._h[s][0]) s = l;
            if (r < n && this._h[r][0] < this._h[s][0]) s = r;
            if (s === i) break;
            [this._h[s], this._h[i]] = [this._h[i], this._h[s]];
            i = s;
        }
    }
}

/**
 * Converts fullDatabase schedules into a transit event graph.
 * Edge model — "next-stop-only":
 */
function buildTransitGraph(dayType, dayIdx) {
    const graph = new Map();

    for (const [routeId, routeConfig] of Object.entries(ROUTES)) {
        if (!routeConfig.isActive) continue;
        const directions = getDirectionsForRoute(routeConfig, dayType);

        for (const dir of directions) {
            if (!fullDatabase || !fullDatabase[dir.key]) continue;
            const schedule = parseJSONSchedule(fullDatabase[dir.key]);
            const rows     = schedule.rows;

            // 🛡️ PHASE 1: Data Pre-Processing (Graph Pruning)
            // If the schedule array contains station data but no train columns,
            // we prune this branch and do not create edges for this specific day.
            const trainHeaders = schedule.headers.slice(1);
            if (trainHeaders.length === 0) continue;

            for (const trainName of trainHeaders) {
                if (isTrainExcluded(trainName, routeId, dayIdx)) continue;

                for (let i = 0; i < rows.length - 1; i++) {
                    const rawDep = rows[i][trainName];
                    if (!rawDep || String(rawDep).trim() === '' || String(rawDep).trim() === '-') continue;

                    const fromStation = normalizeStationName(rows[i].STATION);
                    const depTime     = String(rawDep).trim();
                    const depSec      = timeToSeconds(depTime);

                    // Walk forward to find the very next stop this train calls at
                    for (let j = i + 1; j < rows.length; j++) {
                        const rawArr = rows[j][trainName];
                        if (!rawArr || String(rawArr).trim() === '' || String(rawArr).trim() === '-') continue;

                        const toStation = normalizeStationName(rows[j].STATION);
                        const arrTime   = String(rawArr).trim();
                        const arrSec    = timeToSeconds(arrTime);

                        if (!graph.has(fromStation)) graph.set(fromStation, []);
                        graph.get(fromStation).push({
                            to: toStation,
                            depSec, arrSec, depTime, arrTime,
                            train: trainName,
                            routeId, routeConfig,
                            schedule,
                            fromIdx: i, toIdx: j
                        });

                        break; // Next stop only
                    }
                }
            }
        }
    }
    return graph;
}

/**
 * Core Time-Dependent Dijkstra.
 * GUARDIAN HYBRID FIX: State tracks `currentTrain` to enforce real-world transfer penalties,
 * prevents overshoot boomerangs using `visited` sets, and blocks hub-templates explicitly.
 */
function dijkstraPlanCore(normOrigin, normDest, graph, startSec, bannedEdges = new Set(), isRolloverLoop = false) {
    const INF = Infinity;
    const dist = new Map(); // "station|train" -> score
    const prev = new Map();

    const pq = new TransitMinHeap();
    pq.push(startSec, { station: normOrigin, train: null, transfers: 0, curSec: startSec, visited: new Set([normOrigin]) });
    dist.set(`${normOrigin}|null`, startSec);

    let bestDestScore = INF;
    let bestDestState = null;

    while (pq.size > 0) {
        const [score, state] = pq.pop();
        const { station, train, transfers, curSec, visited } = state;

        if (station === normDest) {
            if (score < bestDestScore) {
                bestDestScore = score;
                bestDestState = state;
            }
            continue; 
        }

        if (score > bestDestScore) break;

        const edges = graph.get(station);
        if (!edges) continue;

        for (const edge of edges) {
            // Diversity Engine: Template Hub Bans
            if (bannedEdges.has(`ROUTE:${edge.routeId}`)) continue;
            if (station !== normOrigin && edge.to !== normDest && bannedEdges.has(`HUB:${edge.to}`)) continue;

            if (edge.depSec < curSec) continue;

            const isTransfer = (train !== null && train !== edge.train);
            const TRANSFER_BUFFER_SEC = 0; // Metrorail zero-minute cross-platform logic
            
            if (isTransfer && (edge.depSec - curSec) < TRANSFER_BUFFER_SEC) continue;
            
            // GUARDIAN isPathLogical Injection: prevent boomerangs and visiting same station twice
            if (isTransfer && visited.has(edge.to)) continue;

            const newTransfers = transfers + (isTransfer ? 1 : 0);
            const penalty = newTransfers * 60; // 1 min penalty per transfer strictly for heap sorting tie-breakers
            const newScore = edge.arrSec + penalty;
            const stateKey = `${edge.to}|${edge.train}`;

            if (newScore < (dist.get(stateKey) ?? INF)) {
                dist.set(stateKey, newScore);
                prev.set(stateKey, { edge, fromStation: station, fromTrain: train });
                
                const newVisited = new Set(visited);
                newVisited.add(edge.to);
                
                pq.push(newScore, { 
                    station: edge.to, 
                    train: edge.train, 
                    transfers: newTransfers, 
                    curSec: edge.arrSec,
                    visited: newVisited
                });
            }
        }
    }

    if (!bestDestState) return null;

    // Reconstruct path
    const legs = [];
    let curKey = `${normDest}|${bestDestState.train}`;
    while (prev.has(curKey)) {
        const { edge, fromStation, fromTrain } = prev.get(curKey);
        legs.unshift({
            type: 'DIRECT',
            route: edge.routeConfig,
            from: fromStation,
            to: edge.to,
            train: edge.train,
            depTime: edge.depTime,
            arrTime: edge.arrTime,
            stops: getIntermediateStops(edge.schedule, edge.fromIdx, edge.toIdx, edge.train)
        });
        curKey = `${fromStation}|${fromTrain}`;
    }
    return legs;
}

/**
 * Merges consecutive single-hop legs that share the same train ID into single "ride-through" legs.
 * GUARDIAN BUGFIX 3: Removed route constraint to merge boundary-hub phantom transfers.
 */
function mergeConsecutiveLegs(legs) {
    if (!legs || legs.length === 0) return [];
    const out = [{ ...legs[0], stops: [...(legs[0].stops || [])] }];
    for (let i = 1; i < legs.length; i++) {
        const prev = out[out.length - 1];
        const curr = legs[i];
        
        // Account for Relay composite legs which change train IDs midway
        const prevEndTrain = (prev.isRelayComposite && prev.internalTransfer) ? prev.internalTransfer.train2 : prev.train;
        const currStartTrain = curr.train;
        
        // Calculate wait time between arrival of previous leg and departure of current leg
        let waitSec = timeToSeconds(curr.depTime) - timeToSeconds(prev.arrTime);
        if (waitSec < 0) waitSec += 86400; // Handle midnight rollover safely
        
        // THE GOLDEN RULE: If Train IDs match exactly, IT IS THE SAME TRAIN (uncapped same-day layover allowed).
        if (prevEndTrain === currStartTrain && waitSec >= 0) {
            out[out.length - 1] = {
                ...prev,
                to: curr.to,
                arrTime: curr.arrTime,
                // Stitch stops cleanly by omitting the duplicated hub station at index 0 of current
                stops: [...(prev.stops || []), ...(curr.stops || []).slice(1)],
                // Optional: Maintain UI metadata for routing display
                routePath: prev.routePath ? [...prev.routePath, curr.route?.name] : [prev.route?.name, curr.route?.name]
            };
        } else {
            out.push({ ...curr, stops: [...(curr.stops || [])] });
        }
    }
    return out;
}

/**
 * Converts a merged legs array into a UI-compatible trip object.
 */
function legsToTripObject(legs, origin, dest) {
    if (!legs || legs.length === 0) return null;
    const n             = legs.length - 1; // number of transfers
    const depTime       = legs[0].depTime;
    const arrTime       = legs[legs.length - 1].arrTime;
    const totalDuration = timeToSeconds(arrTime) - timeToSeconds(depTime);

    const base = {
        from: origin, to: dest,
        depTime, arrTime, totalDuration,
        train: legs[0].train,
        legs   
    };

    if (n === 0) {
        return {
            ...base, type: 'DIRECT', route: legs[0].route, stops: legs[0].stops,
            actualDestination: legs[0].stops?.[legs[0].stops.length - 1]?.station || dest
        };
    }
    if (n === 1) {
        return {
            ...base, type: 'TRANSFER', route: legs[0].route,
            transferStation: legs[0].to, leg1: legs[0], leg2: legs[1]
        };
    }
    if (n === 2) {
        return {
            ...base, type: 'DOUBLE_TRANSFER', route: legs[0].route,
            hub1: legs[0].to, hub2: legs[1].to,
            leg1: legs[0], leg2: legs[1], leg3: legs[2],
            routePath: legs.map(l => l.route?.name || 'Unknown Route')
        };
    }
    return {
        ...base, type: 'MULTI_TRANSFER', route: legs[0].route,
        hub1: legs[0].to, hub2: legs[1].to, hub3: legs[2]?.to || null,
        leg1: legs[0], leg2: legs[1], leg3: legs[2] || null,
        routePath: legs.map(l => l.route?.name || 'Unknown Route'),
        transferCount: n
    };
}

/**
 * GUARDIAN FIX 3: Universal Leg Compactor
 * Intercepts trips from all engines and forcefully merges artificial boundary legs
 * that share the same train ID into continuous legs before the UI renders them.
 * GUARDIAN PHASE D: Preserves the Mathematical Offset payload through the compactor pipeline.
 */
function compactTrip(trip) {
    if (trip.type === 'DIRECT') return trip;
    
    let legs = [];
    if (trip.type === 'TRANSFER' && trip.leg1 && trip.leg2) {
        legs = [trip.leg1, trip.leg2];
    } else if (trip.type === 'DOUBLE_TRANSFER' && trip.leg1 && trip.leg2 && trip.leg3) {
        legs = [trip.leg1, trip.leg2, trip.leg3];
    } else if (trip.type === 'MULTI_TRANSFER' && trip.legs) {
        legs = trip.legs;
    } else {
        return trip;
    }

    const mergedLegs = mergeConsecutiveLegs(legs);
    
    // If the compactor didn't find any phantom transfers to merge, return original payload untouched.
    if (mergedLegs.length === legs.length) return trip;
    
    const newTrip = legsToTripObject(mergedLegs, trip.from, trip.to);
    
    // GUARDIAN PHASE D: Preserve Offset Metadata!
    if (newTrip) {
        if (trip.dayLabel) newTrip.dayLabel = trip.dayLabel;
        if (trip.dayOffset) newTrip.dayOffset = trip.dayOffset; 
    }
    
    return newTrip || trip;
}

/**
 * Enumerates ALL valid departure times along a Dijkstra-discovered path template.
 */
function enumerateTripsByTemplate(mergedLegs, origin, dest, dayType, startSec, context = {}) {
    if (!mergedLegs || mergedLegs.length === 0) return [];

    const TRANSFER_BUFFER_SEC = 0;

    const waypoints = [origin, ...mergedLegs.map(l => l.to)];
    const routeIds  = mergedLegs.map(l => l.route.id);

    // GUARDIAN V6.24 BUGFIX: Use relay-aware leg finder so that journeys crossing a relay
    // station boundary (e.g. WALTOO->PRETORIA via KOEDOESPOORT on a single train) are found
    // correctly. findAllLegsBetween only searches within a single schedule sheet and returns
    // empty for cross-sheet legs, causing Dijkstra to report no results and the legacy relay
    // engine to mislabel the trip as a TRANSFER.
    const legOptionSets = routeIds.map((routeId, idx) =>
        findAllLegsWithRelayExpansion(waypoints[idx], waypoints[idx + 1], new Set([routeId]), dayType, context)
            .filter(l => idx === 0 ? timeToSeconds(l.depTime) >= startSec : true)
    );

    if (legOptionSets.some(opts => opts.length === 0)) return [];

    let validPaths = legOptionSets[0].map(l => [l]);

    for (let idx = 1; idx < legOptionSets.length; idx++) {
        const nextOptions = legOptionSets[idx];
        const nextPaths   = [];

        for (const path of validPaths) {
            const prevArrSec = timeToSeconds(path[path.length - 1].arrTime);
            const bestNext = nextOptions.find(l => {
                const depSec = timeToSeconds(l.depTime);
                const wait = depSec - prevArrSec;
                // 🛡️ GUARDIAN PHASE 1: The Midnight Barrier (Blocks cross-day stitching)
                if (wait < 0) return false;
                return wait >= TRANSFER_BUFFER_SEC;
            });
            if (bestNext) nextPaths.push([...path, bestNext]);
        }
        validPaths = nextPaths;
        if (validPaths.length === 0) break;
    }

    return validPaths.map(path => legsToTripObject(path, origin, dest)).filter(Boolean);
}

const _DIJKSTRA_MAX_RUNS = 3;

/**
 * Time-Dependent Dijkstra Trip Planner Orchestrator
 * GUARDIAN HYBRID: Banning physical hubs forces Dijkstra to find alternative backup corridors.
 */
function planDijkstraTrip(origin, dest, dayType, isRolloverLoop = false, context = {}) {
    const normOrigin = normalizeStationName(origin);
    const normDest   = normalizeStationName(dest);

    if (normOrigin === normDest || !fullDatabase) return { status: 'NO_PATH', trips: [] };

    const dayIdx = context.targetDayIdx !== undefined ? context.targetDayIdx
                 : (dayType === currentDayType ? currentDayIndex
                 : (dayType === 'saturday' ? 6 : 1));

    // GUARDIAN PHASE 1 (Growth Update): Always map full day templates (startSec = 0) so departed trips are preserved in UI dropdown.
    const startSec = 0;

    // 🛡️ GUARDIAN PHASE 16: Transit Graph Memoization (The CPU Saver)
    // Caches the heavily parsed Transit Graph for the entire lifecycle of the Unified Trip calculation.
    const cacheKey = `graph_${dayType}_${dayIdx}`;
    if (!context.graphCache) context.graphCache = {};
    if (!context.graphCache[cacheKey]) {
        context.graphCache[cacheKey] = buildTransitGraph(dayType, dayIdx);
    }
    const baseGraph = context.graphCache[cacheKey];

    const bannedEdges     = new Set();
    const seenTemplates   = new Set();
    const allTrips        = [];

    for (let run = 0; run < _DIJKSTRA_MAX_RUNS; run++) {
        const rawLegs = dijkstraPlanCore(normOrigin, normDest, baseGraph, startSec, bannedEdges, isRolloverLoop);
        if (!rawLegs || rawLegs.length === 0) break;

        const mergedLegs = mergeConsecutiveLegs(rawLegs);
        if (!mergedLegs || mergedLegs.length === 0) break;

        const templateSig = mergedLegs.map(
            l => `${l.route.id}:${normalizeStationName(l.from)}->${normalizeStationName(l.to)}`
        ).join('|');
        if (seenTemplates.has(templateSig)) break;
        seenTemplates.add(templateSig);

        // Enumerate ALL trips for this exact physical path (Template)
        // startSec is 0 because we want to grab all backup shuttles that match this template for the whole day.
        const templatedTrips = enumerateTripsByTemplate(mergedLegs, origin, dest, dayType, 0, context);
        allTrips.push(...templatedTrips);

        // Ban the key defining edge of this template to force Dijkstra to find a diverse physical path on the next run
        if (mergedLegs.length === 1) {
            bannedEdges.add(`ROUTE:${mergedLegs[0].route.id}`);
        } else {
            for (let i = 0; i < mergedLegs.length - 1; i++) {
                bannedEdges.add(`HUB:${normalizeStationName(mergedLegs[i].to)}`);
            }
        }
    }

    if (allTrips.length > 0) return { status: 'FOUND', trips: allTrips };
    return { status: 'NO_PATH', trips: [] };
}

// -----------------------------------------------------------------------------
// SECTION 4: DOMINANCE FILTER AND UNIFIED ORCHESTRATOR
// -----------------------------------------------------------------------------

/**
 * Evaluates an array of trips and mercilessly deletes "Dominated" trips.
 * GUARDIAN PHASE 1 PATCH: Path-Diversity Signature Engine Restored.
 * We now ONLY allow trips to dominate each other if they share the exact same physical path.
 * A Direct Train will no longer delete a Transfer backup shuttle on a different line.
 * GUARDIAN PHASE 2 UPGRADE: Cross-Path Dominance activated to eliminate useless, early-departure transfers that arrive at the same time as simpler direct trains.
 */
function filterDominatedTrips(trips) {
    if (!trips || trips.length === 0) return [];
    
    const optimalTrips = [];
    
    const getDep = t => timeToSeconds(t.depTime || (t.leg1 ? t.leg1.depTime : "00:00"));
    const getArr = t => timeToSeconds(t.arrTime || (t.leg3 ? t.leg3.arrTime : (t.leg2 ? t.leg2.arrTime : "00:00")));
    
    const getTrans = t => {
        // Handle V7 MULTI_TRANSFER recursively and safely
        if (t.type === 'MULTI_TRANSFER') return t.transferCount ?? (t.legs ? t.legs.length - 1 : 3);
        let base = t.type === 'DOUBLE_TRANSFER' ? 2 : (t.type === 'TRANSFER' ? 1 : 0);
        if (t.leg1 && t.leg1.isRelayComposite) base += 1;
        if (t.leg2 && t.leg2.isRelayComposite) base += 1;
        if (t.leg3 && t.leg3.isRelayComposite) base += 1;
        return base;
    };

    // GUARDIAN PHASE 1: PATH-DIVERSITY SIGNATURE GENERATOR
    const getPathSig = t => {
        if (t.type === 'MULTI_TRANSFER') {
            const hubs   = t.legs ? t.legs.slice(0, -1).map(l => normalizeStationName(l.to)).join('_') : '';
            const routes = t.routePath ? t.routePath.join(',') : '';
            return `MULTI_${hubs}_[${routes}]`;
        }
        let sig = t.type;
        if (t.type === 'TRANSFER') sig += `_${t.transferStation}`;
        if (t.type === 'DOUBLE_TRANSFER') sig += `_${t.hub1}_${t.hub2}`;
        if (t.routePath) sig += `_[${t.routePath.join(',')}]`;
        else if (t.route) sig += `_[${t.route.id}]`;
        return sig;
    };
    
    for (let i = 0; i < trips.length; i++) {
        const tripX = trips[i];
        let isDominated = false;
        
        const xDep = getDep(tripX);
        const xArr = getArr(tripX);
        const xTransfers = getTrans(tripX);
        const xSig = getPathSig(tripX);
        
        for (let j = 0; j < trips.length; j++) {
            if (i === j) continue;
            const tripY = trips[j];
            
            const yDep = getDep(tripY);
            const yArr = getArr(tripY);
            const yTransfers = getTrans(tripY);
            const ySig = getPathSig(tripY);
            
            const samePath = (xSig === ySig);

            // CONDITION 1: EXACT SAME PHYSICAL PATH
            if (samePath) {
                // Y strictly dominates X if Y departs later (or same time) AND arrives strictly earlier (or same time).
                const isStrictlyBetterTime = (yDep > xDep && yArr <= xArr) || (yDep >= xDep && yArr < xArr);
                const isDuplicate = (yDep === xDep && yArr === xArr && yTransfers === xTransfers && j < i);
                if (isStrictlyBetterTime || isDuplicate) {
                    isDominated = true;
                    break;
                }
            } 
            // CONDITION 2: DIFFERENT PHYSICAL PATH (Cross-Path Dominance)
            // GUARDIAN PHASE 2 UPGRADE: Eliminate inferior early-departure transfers
            else {
                const departsLaterOrSame = (yDep >= xDep);
                const arrivesEarlierOrSame = (yArr <= xArr);
                const strictlyFewerTransfers = (yTransfers < xTransfers);
                const sameTransfers = (yTransfers === xTransfers);
                const isStrictlyBetterTime = (yDep > xDep && yArr <= xArr) || (yDep >= xDep && yArr < xArr);

                // If Y lets you wait at the origin instead of on a train, AND arrives at the same time or earlier:
                if (departsLaterOrSame && arrivesEarlierOrSame) {
                    // Absolute upgrade: It's faster AND has fewer connections
                    if (strictlyFewerTransfers) {
                        isDominated = true;
                        break;
                    }
                    // Speed upgrade: Same amount of transfers, but Y leaves strictly later or arrives strictly earlier
                    if (sameTransfers && isStrictlyBetterTime) {
                        isDominated = true;
                        break;
                    }
                }
            }
        }
        if (!isDominated) optimalTrips.push(tripX);
    }
    return optimalTrips;
}

/**
 * GUARDIAN PHASE 14: THE HEURISTIC FAILURE PROBE
 * Diagnoses exactly WHY a route failed if the 7-day loop yields 0 trips.
 * GUARDIAN PHASE 5: Upgraded to capture the specific disruption payload on ERR_ACTIVE_SUSPENSION.
 */
function runHeuristicFailureProbe(origin, dest, dayType) {
    const normOrigin = typeof normalizeStationName === 'function' ? normalizeStationName(origin) : origin;
    const normDest = typeof normalizeStationName === 'function' ? normalizeStationName(dest) : dest;
    
    if (typeof globalStationIndex === 'undefined' || !globalStationIndex[normOrigin] || !globalStationIndex[normDest]) {
        return 'ERR_DISCONNECTED_GRAPH';
    }

    const oData = globalStationIndex[normOrigin];
    const dData = globalStationIndex[normDest];

    // 1. Check Region Mismatch
    let regO = null, regD = null;
    for (const r of oData.routes) { if (typeof ROUTES !== 'undefined' && ROUTES[r]) { regO = ROUTES[r].region; break; } }
    for (const r of dData.routes) { if (typeof ROUTES !== 'undefined' && ROUTES[r]) { regD = ROUTES[r].region; break; } }
    
    if (regO && regD && regO !== regD) return 'ERR_CROSS_REGION';

    // 2. Physical Connectivity (Route-Level BFS)
    let blockingDisruption = null;

    const getRouteSuspension = (rId) => {
        if (typeof globalDisruptions !== 'undefined' && globalDisruptions[rId]) {
            return globalDisruptions[rId].find(d => d.tier === 'CRITICAL');
        }
        return null;
    };

    const checkConnectivity = (ignoreSuspended, checkSchedule = false) => {
        const queue = [];
        const visited = new Set();
        
        const startRoutes = Array.from(oData.routes).filter(r => ROUTES[r] && ROUTES[r].isActive);
        const endRoutes = new Set(Array.from(dData.routes).filter(r => ROUTES[r] && ROUTES[r].isActive));
        
        for (const r of startRoutes) {
            // 🛡️ PHASE 2: Check if route is pruned for this specific day
            if (checkSchedule && dayType) {
                const directions = getDirectionsForRoute(ROUTES[r], dayType);
                const hasTrains = directions.some(dir => {
                    if (!fullDatabase || !fullDatabase[dir.key]) return false;
                    const sched = parseJSONSchedule(fullDatabase[dir.key]);
                    return sched.headers.slice(1).length > 0;
                });
                if (!hasTrains) continue;
            }

            if (ignoreSuspended) {
                const susp = getRouteSuspension(r);
                if (susp) {
                    if (!blockingDisruption) blockingDisruption = susp;
                    continue; // Route is blocked by incident, do not traverse
                }
            }
            queue.push({ route: r, depth: 0 });
            visited.add(r);
        }

        while (queue.length > 0) {
            const curr = queue.shift();
            if (endRoutes.has(curr.route)) return true;
            if (curr.depth >= 4) continue; // Max transfers threshold

            for (const otherRoute of Object.keys(ROUTES)) {
                if (otherRoute !== curr.route && ROUTES[otherRoute].isActive) {
                    if (!visited.has(otherRoute)) {
                        if (typeof findIntersections === 'function' && findIntersections(curr.route, otherRoute).length > 0) {
                            // 🛡️ PHASE 2: Check if adjacent route is pruned
                            if (checkSchedule && dayType) {
                                const directions = getDirectionsForRoute(ROUTES[otherRoute], dayType);
                                const hasTrains = directions.some(dir => {
                                    if (!fullDatabase || !fullDatabase[dir.key]) return false;
                                    const sched = parseJSONSchedule(fullDatabase[dir.key]);
                                    return sched.headers.slice(1).length > 0;
                                });
                                if (!hasTrains) continue;
                            }

                            if (ignoreSuspended) {
                                const susp = getRouteSuspension(otherRoute);
                                if (susp) {
                                    if (!blockingDisruption) blockingDisruption = susp;
                                    continue; // Route is blocked by incident
                                }
                            }
                            visited.add(otherRoute);
                            queue.push({ route: otherRoute, depth: curr.depth + 1 });
                        }
                    }
                }
            }
        }
        return false;
    };

    // 2. Is there ANY physical path? (Ignoring daily schedule)
    if (!checkConnectivity(false, false)) return 'ERR_DISCONNECTED_GRAPH';

    // 3. 🛡️ PHASE 2: Is there a physical path TODAY? (Checking pruned edges)
    if (!checkConnectivity(false, true)) return 'ERR_NO_SERVICE_TODAY';

    // 4. Check for active suspensions blocking the physical path today.
    // We explicitly elevate this to an ERR_ACTIVE_SUSPENSION to ensure telemetry
    // logs the failure as a Line Severance rather than a sparse timetable mismatch.
    const isSevered = !checkConnectivity(true, true); // Populates blockingDisruption

    if (isSevered && blockingDisruption) {
        return {
            code: 'ERR_ACTIVE_SUSPENSION',
            disruptionId: blockingDisruption.id,
            buttonText: blockingDisruption.buttonText || 'Line Severed',
            hasIncident: true
        };
    }

    // 5. No physical issues, just sparse timetables
    return 'ERR_TIMETABLE_MISMATCH';
}

async function planUnifiedTrip(origin, dest, dayType, externalContext = {}) {
    console.log(`[GUARDIAN] Running Unified Trip Planner for ${origin} -> ${dest} (Requested: ${dayType})`);

    // 🛡️ GUARDIAN PHASE 2.1: The Core Boomerang Lock
    // Instantly intercepts identical Origin/Dest queries bypassing the UI (e.g. Deep Links / History)
    const normOrigin = typeof normalizeStationName === 'function' ? normalizeStationName(origin) : String(origin).trim().toUpperCase();
    const normDest = typeof normalizeStationName === 'function' ? normalizeStationName(dest) : String(dest).trim().toUpperCase();
    
    if (normOrigin === normDest) {
        console.warn("[GUARDIAN] Boomerang trip detected. Aborting unified calculation.");
        return { status: 'SAME_STATION', errorPayload: null, trips: [] };
    }

    // 🛡️ GUARDIAN PHASE 15: Removed internal recursive state objects and replaced with flat target day metadata
    // 🛡️ GUARDIAN PHASE 2 (Core): Accepts externalContext to decouple DOM queries
    const context = { zeroHourProbeActive: false, targetDayIdx: undefined, ...externalContext };

    // GUARDIAN PHASE 13: Universal Raw Fetch Helper
    // Refactored to seamlessly supply both the live engine and the Zero-Hour Probe.
    // GROWTH MODE PHASE 2: Accepts isRolloverLoop to disable internal 1-day rollovers during the 7-day scan.
    const fetchRawTrips = (o, d, dt, isRolloverLoop, ctx) => {
        const dijkstraResult = typeof planDijkstraTrip === 'function'
            ? planDijkstraTrip(o, d, dt, isRolloverLoop, ctx) : { trips: [] };

        let raw = [...(dijkstraResult.trips || [])];

        // Fallback to legacy exhaust loops if Dijkstra returns nothing
        if (raw.length === 0) {
            const directResult = typeof planDirectTrip === 'function' ? planDirectTrip(o, d, dt, isRolloverLoop, ctx) : { trips: [] };
            const macroResult = typeof planMacroCorridorTrip === 'function' ? planMacroCorridorTrip(o, d, dt, isRolloverLoop, ctx) : { trips: [] };
            const relayResult = typeof planRelayTransferTrip === 'function' ? planRelayTransferTrip(o, d, dt, isRolloverLoop, ctx) : { trips: [] };
            const hubResult   = typeof planHubTransferTrip === 'function' ? planHubTransferTrip(o, d, dt, isRolloverLoop, ctx) : { trips: [] };
            
            raw = [
                ...(directResult.trips || []),
                ...(macroResult.trips || []),
                ...(relayResult.trips || []),
                ...(hubResult.trips || [])
            ];

            const todayCount = raw.filter(t => !t.dayLabel).length;
            if (todayCount < 3 && (macroResult.trips || []).length === 0) {
                const doubleResult = typeof planDoubleTransferTrip === 'function' ? planDoubleTransferTrip(o, d, dt, isRolloverLoop, ctx) : { trips: [] };
                raw = [...raw, ...(doubleResult.trips || [])];
            }
        }
        return raw.map(compactTrip).filter(Boolean);
    };

    // --- GUARDIAN GROWTH MODE PHASE 2 & 3: INFINITE ROLLOVER & SMART CALENDAR SYNC ---
    
    let startOffset = 0;

    // 🛡️ GUARDIAN GROWTH MODE PHASE 4: Manual Rollover Interceptor
    // Intercepts the UI trigger to skip today's departed trains and instantly start scanning from tomorrow.
    if (typeof window !== 'undefined' && window._forceManualRollover) {
        console.log("[GUARDIAN] Manual Rollover Intercepted. Pushing startOffset to 1.");
        startOffset = 1;
        window._forceManualRollover = false; // Immediately consume and reset the flag to prevent permanent future-routing
    }

    const isExplicitOverride = (dayType === 'weekday' || dayType === 'saturday') && dayType !== currentDayType;

    // Only hunt the physical calendar if it's NOT an explicit manual override, 
    // AND it's not Sunday (which we handle natively via SUNDAY_SKIP),
    // AND the dayType differs from today.
    if (!isExplicitOverride && dayType !== 'sunday' && dayType !== currentDayType) {
        let baseDate = new Date();
        // 🛡️ GUARDIAN PHASE 2: Decoupled DOM Query. Base date is now passed purely via Context
        if (typeof window.isSimMode !== 'undefined' && window.isSimMode && context.simBaseDate) {
            const parts = context.simBaseDate.split('-');
            if(parts.length === 3) baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
        }
        
        for (let i = 1; i <= 7; i++) {
            let checkDate = new Date(baseDate);
            checkDate.setDate(checkDate.getDate() + i);
            let dayOfWeek = checkDate.getDay();
            let type = (dayOfWeek === 0) ? 'sunday' : (dayOfWeek === 6 ? 'saturday' : 'weekday');
            
            // Check for Public Holidays natively
            const m = String(checkDate.getMonth() + 1).padStart(2, '0');
            const d = String(checkDate.getDate()).padStart(2, '0');
            if (typeof SPECIAL_DATES !== 'undefined' && SPECIAL_DATES[`${m}-${d}`]) {
                type = SPECIAL_DATES[`${m}-${d}`];
            }
            
            if (type === dayType) {
                startOffset = i;
                break;
            }
        }
    }

    // Helper to evaluate a specific day offset in the physical calendar
    const evaluateDay = (offset, evalDest = dest) => {
        let targetDayType = dayType;
        let targetDayLabel = null;
        let targetDayIdx = currentDayIndex;
        let isFutureOffset = offset > startOffset; // Anything past the requested day is a "future" rollover
        
        if (isExplicitOverride) {
            // BLIND OVERRIDE: Do not interrogate the calendar.
            targetDayType = dayType;
            targetDayLabel = null; // Let UI handle it.
            targetDayIdx = (dayType === 'saturday') ? 6 : (dayType === 'sunday' ? 0 : 1);
        } else if (offset > 0) {
            if (typeof window.getLookaheadDayInfo === 'function') {
                const info = window.getLookaheadDayInfo(offset);
                targetDayType = info.type;
                targetDayLabel = info.name;
                targetDayIdx = info.idx;
            } else {
                targetDayType = 'weekday';
                targetDayLabel = 'Future Day';
                targetDayIdx = 1;
            }
        }

        // 🛡️ GUARDIAN PHASE 2 AUDIT: Custom Holiday Recursion Guard
        // Metrorail has zero service on Sundays natively. However, if an Admin explicitly deployed
        // a custom holiday override, or we are specifically evaluating a Sunday template,
        // we must NOT blindly skip it, otherwise the offset jumps infinitely in a loop trying to find a non-Sunday.
        if (targetDayType === 'sunday' && !isExplicitOverride) {
            return { status: 'SUNDAY_SKIP', trips: [] };
        }

        context.targetDayIdx = targetDayIdx; // Propagate exact day geometry to the Ghost Train filtering engine

        let allRawTrips = fetchRawTrips(origin, evalDest, targetDayType, isFutureOffset, context);

        // 🛡️ GUARDIAN TIME FILTER REMOVED 
        // We no longer strip past trains here. We want them in the UI dropdown so they can be greyed out.
        // allRawTrips remains untouched, holding the full day's schedule from 00:00.

        let capturedTerminus = null;

        const isTripSevered = (trip) => {
            if (typeof window.getTripDisruptions !== 'function') return false;
            
            const checkLeg = (routeId, stops) => {
                if (!stops || stops.length === 0) return false;
                const disr = window.getTripDisruptions(routeId, stops);
                const crit = disr.find(d => d.tier === 'CRITICAL');
                
                if (crit) {
                    // 🛡️ GUARDIAN REFINEMENT: Only sever if traveling PAST the disruption boundary.
                    if (crit.triggerStopIndex !== undefined) {
                        // If the disruption triggers at the passenger's exact final stop on this leg,
                        // they are alighting before the danger zone. The trip is safe!
                        if (crit.triggerStopIndex === stops.length - 1) {
                            return false; 
                        }
                        
                        if (!capturedTerminus && stops[crit.triggerStopIndex]) {
                            capturedTerminus = normalizeStationName(stops[crit.triggerStopIndex].station);
                        }
                        return true;
                    }
                    return true;
                }
                return false;
            };
            
            if (trip.type === 'DIRECT') return checkLeg(trip.route.id, trip.stops);
            if (trip.type === 'TRANSFER') return checkLeg(trip.leg1.route.id, trip.leg1.stops) || checkLeg(trip.leg2.route.id, trip.leg2.stops);
            if (trip.type === 'DOUBLE_TRANSFER') return checkLeg(trip.leg1.route.id, trip.leg1.stops) || checkLeg(trip.leg2.route.id, trip.leg2.stops) || checkLeg(trip.leg3.route.id, trip.leg3.stops);
            if (trip.type === 'MULTI_TRANSFER' && trip.legs) {
                for (const leg of trip.legs) {
                    if (checkLeg(leg.route.id, leg.stops)) return true;
                }
            }
            return false;
        };

        // Enforce strict layover guardrails
        const hasValidLayovers = (trip) => {
            if (trip.type === 'DIRECT') return true;

            const checkLayover = (arrTime, depTime) => {
                let layover = timeToSeconds(depTime) - timeToSeconds(arrTime);
                // 🛡️ GUARDIAN PHASE 1: Strictly block layovers that cross midnight (layover < 0)
                if (layover < 0) return false; 
                return layover >= 0; // Uncapped wait time for same-day survival routes
            };

            if (trip.type === 'TRANSFER')
                return checkLayover(trip.leg1.arrTime, trip.leg2.depTime);

            if (trip.type === 'DOUBLE_TRANSFER')
                return checkLayover(trip.leg1.arrTime, trip.leg2.depTime) &&
                       checkLayover(trip.leg2.arrTime, trip.leg3.depTime);

            if (trip.type === 'MULTI_TRANSFER') {
                const legs = trip.legs || [trip.leg1, trip.leg2, trip.leg3].filter(Boolean);
                for (let i = 0; i < legs.length - 1; i++) {
                    if (!checkLayover(legs[i].arrTime, legs[i + 1].depTime)) return false;
                }
                return true;
            }
            return true;
        };

        const validTrips = allRawTrips.filter(t => {
            if (!hasValidLayovers(t)) return false;
            if (isTripSevered(t)) return false; // 🛡️ GUARDIAN PHASE 14: Disruption Severance Guard
            return true;
        });

        // Apply Pareto Dominance Filter
        const optimalTrips = filterDominatedTrips(validTrips);

        const masterSort = (a, b) => {
            const getDep   = t => timeToSeconds(t.depTime || (t.leg1?.depTime  || "00:00"));
            const getArr   = t => timeToSeconds(t.arrTime || (t.leg3?.arrTime  || (t.leg2?.arrTime || "00:00")));
            const getTrans = t => t.type === 'MULTI_TRANSFER' ? (t.transferCount ?? (t.legs ? t.legs.length - 1 : 3))
                                : t.type === 'DOUBLE_TRANSFER' ? 2
                                : t.type === 'TRANSFER' ? 1 : 0;
            const depDiff = getDep(a) - getDep(b); if (depDiff !== 0) return depDiff;
            const arrDiff = getArr(a) - getArr(b); if (arrDiff !== 0) return arrDiff;
            return getTrans(a) - getTrans(b);
        };

        optimalTrips.sort(masterSort);

        let finalStatus = optimalTrips.length > 0 ? 'FOUND' : 'NO_PATH';

        // 🛡️ GUARDIAN PHASE 1: NO_PATH ROLLOVER LOGIC (Dropdown Preservation)
        // We preserve all departed trips in optimalTrips so the UI dropdown can render them.
        // Instead of mathematically forcing a rollover to tomorrow, we flag it as ALL_DEPARTED
        // so the UI can display the grayed-out schedule and offer a manual rollover button.
        if (finalStatus === 'FOUND' && offset === 0 && !isExplicitOverride && !context.zeroHourProbeActive) {
            const nowSec = timeToSeconds(currentTime);
            const hasUpcoming = optimalTrips.some(t => {
                const dep = timeToSeconds(t.depTime || (t.leg1 ? t.leg1.depTime : "00:00"));
                return dep >= nowSec;
            });
            
            if (!hasUpcoming) {
                console.log("[GUARDIAN] All trips today have departed. Flagging as ALL_DEPARTED to await user instruction.");
                finalStatus = 'ALL_DEPARTED';
            }
        }

        // --- GUARDIAN PHASE 13: THE ZERO-HOUR PROBE ---
        // Probe ONLY if it's the natively requested day (not a future rollover) and we missed the trains.
        if (finalStatus === 'NO_PATH' && !isFutureOffset && !isExplicitOverride) {
            console.log("[GUARDIAN] Commencing Zero-Hour Probe...");
            
            // 🛡️ GUARDIAN PHASE 1: Execution state guard to block infinite recursive probe triggering
            if (context.zeroHourProbeActive) {
                console.warn("🛡️ Guardian: Zero-Hour Probe already active! Aborting recursive call.");
                return { status: 'IMPOSSIBLE_TODAY', trips: [], targetDayLabel };
            }

            context.zeroHourProbeActive = true;
            try {
                const probeTripsRaw = fetchRawTrips(origin, evalDest, targetDayType, false, context);
                const validProbeTrips = probeTripsRaw.filter(hasValidLayovers);
                if (validProbeTrips.length === 0) {
                    console.log("[GUARDIAN] Zero-Hour Probe verified 0 valid trips exist from 00:00. Route is IMPOSSIBLE today.");
                    finalStatus = 'IMPOSSIBLE_TODAY';
                }
            } finally {
                // 🛡️ GUARDIAN PHASE 1: Guarantee lock release even if the fetcher crashes
                context.zeroHourProbeActive = false;
            }
        }

        // Inject the manual offset label if we calculated a trip on a future day
        // This includes offset === startOffset if the user searched for a future day from the dropdown
        if (offset > 0 && optimalTrips.length > 0) {
            optimalTrips.forEach(t => {
                if (!t.dayLabel) t.dayLabel = targetDayLabel;
                
                // We only apply dayOffset to physical time math.
                // For UI rendering, we tell it exactly how many days from 'now' this trip occurs.
                if (!t.dayOffset) t.dayOffset = offset;
            });
        }

        return { status: finalStatus, trips: optimalTrips, targetDayLabel, severedTerminus: capturedTerminus };
    };

    // THE 7-DAY INFINITE ROLLOVER LOOP
    let loopStatus = 'NO_PATH';
    let loopTrips = [];
    let initialStatus = null;
    let errorPayload = null; // GUARDIAN PHASE 5: Rich Error Payload Container
    
    // If it's a strict manual override, we DO NOT loop. We query exactly once.
    // 🛡️ GUARDIAN PHASE 1 (Hard Execution Ceiling): Constrain the max offset securely.
    const MAX_SAFE_ROLLOVER_DAYS = 7;
    let maxOffset = isExplicitOverride ? startOffset : startOffset + MAX_SAFE_ROLLOVER_DAYS;
    
    // 🛡️ GUARDIAN PHASE 3: Strict Loop Iteration Counter (Recursion Guard)
    let cycleCount = 0;

    // --- GUARDIAN PHASE 16 (UPGRADE): Eager Partial Journey Evaluator ---
    // Pre-compute the backward station sequence ONCE outside the loop to optimize CPU overhead.
    const getBackwardStationSequence = (dst, targetDay) => {
        const dNorm = normalizeStationName(dst);
        let possibleStations = [];
        for (const route of Object.values(ROUTES)) {
            if (!route.isActive || route.id === 'special_event') continue;
            for (const dir of getDirectionsForRoute(route, targetDay)) {
                if (!fullDatabase || !fullDatabase[dir.key]) continue;
                const sched = parseJSONSchedule(fullDatabase[dir.key]);
                
                // 🛡️ PHASE 1: Data Pre-Processing (Graph Pruning)
                // Skip backward path mapping if this route has zero scheduled trains today
                if (sched.headers.slice(1).length === 0) continue;

                const rows = sched.rows;
                if (!rows) continue;
                const stationsNorm = rows.map(r => normalizeStationName(r.STATION));
                const idxD = stationsNorm.indexOf(dNorm);
                if (idxD > 0) {
                    // GUARDIAN BUGFIX: Removed 10-station limit. Scan the entire physical route backwards
                    // to ensure distant partial terminus points (like Centurion) are caught.
                    const seq = rows.slice(0, idxD).map(r => r.STATION).reverse();
                    possibleStations.push(...seq);
                }
            }
        }
        return [...new Set(possibleStations)];
    };
    const testStations = getBackwardStationSequence(dest, dayType);

    // We scan up to 7 days ahead from the natively requested start offset
    for (let offset = startOffset; offset <= maxOffset; offset++) {
        
        // 🛡️ GUARDIAN PHASE 3: Hard circuit breaker at the top of the offset loop
        if (cycleCount > 10) {
            console.error("🛡️ Guardian: Unified Trip loop threshold critically exceeded (>10). Triggering failsafe abort to protect Call Stack.");
            loopStatus = 'ERR_TIMETABLE_MISMATCH'; // Graceful UI fallback
            break;
        }
        cycleCount++;

        // 🛡️ GUARDIAN PHASE 16: Event Loop Yielding (Anti-Freeze)
        // Forces JavaScript to take a 1ms breath per day evaluated, unblocking the UI spinner thread.
        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            // 1. Evaluate for the FULL intended trip
            const evalResult = evaluateDay(offset, dest);
            
            // Capture the exact reason why the route failed on the very first attempted day
            if (offset === startOffset) {
                initialStatus = evalResult.status;
                if (dayType === 'sunday' || evalResult.status === 'SUNDAY_SKIP') {
                    initialStatus = 'SUNDAY_ROLLOVER';
                }
                
                // 🛡️ GUARDIAN PHASE 10: ALGORITHM SHORT-CIRCUIT (The 13-Second Loop Fix)
                // If the very first day yields no path, do a rapid pre-probe.
                // If it's a hard physical severance (sinkhole, cross-region), there is NO 
                // mathematical reason to scan the next 6 days. Abort the future scan.
                if (evalResult.status === 'NO_PATH' && !isExplicitOverride) {
                    const earlyProbe = runHeuristicFailureProbe(origin, dest, targetDayType);
                    if (typeof earlyProbe === 'object' || earlyProbe === 'ERR_CROSS_REGION' || earlyProbe === 'ERR_DISCONNECTED_GRAPH' || earlyProbe === 'ERR_NO_SERVICE_TODAY') {
                        console.log("🛡️ Guardian: Hard physical block detected on Day 1. Short-circuiting 7-day loop.");
                        // Force the loop to terminate after today's iteration (allowing today's partial journey check to finish)
                        maxOffset = offset;
                    }
                }
            }

            // The moment we find a valid full trip block, we capture and break
            if (evalResult.status === 'FOUND' || evalResult.status === 'ALL_DEPARTED') {
                // If we found it on a subsequent day loop, the commuters missed all trains for the origin day.
                loopStatus = (offset > startOffset) ? 'NO_MORE_TODAY' : evalResult.status;
                loopTrips = evalResult.trips;
                break; 
            }

            // 2. 🛡️ EAGER PARTIAL EVALUATION
            let targetsToTest = [...testStations];
            if (evalResult.severedTerminus && !targetsToTest.includes(evalResult.severedTerminus)) {
                // 🛡️ GUARDIAN FIX: Prepend the mathematically proven forward terminus so it's tested first!
                targetsToTest.unshift(evalResult.severedTerminus);
            }

            // If the full route failed, check for a partial journey ON THIS EXACT DAY
            // before we blindly allow the loop to roll over to tomorrow.
            if ((evalResult.status === 'NO_PATH' || evalResult.status === 'IMPOSSIBLE_TODAY') && targetsToTest.length > 0) {
                let partialSuccess = false;
                
                for (const testDest of targetsToTest) {
                    if (normalizeStationName(testDest) === normalizeStationName(origin)) continue;
                    
                    // 🛡️ GUARDIAN PHASE 16: Event Loop Yielding (The N+1 Anti-Freeze)
                    // Breathes between every backward station checked to prevent total ANR freezes
                    await new Promise(resolve => setTimeout(resolve, 0));

                    const partialResult = evaluateDay(offset, testDest);
                    if (partialResult.status === 'FOUND' || partialResult.status === 'ALL_DEPARTED') {
                        console.log(`[GUARDIAN] Partial Journey Found to ${testDest} on offset ${offset}!`);
                        loopTrips = partialResult.trips;
                        loopStatus = 'PARTIAL_JOURNEY';
                        
                        const formatTitle = (s) => {
                            if (!s) return '';
                            return s.replace(' STATION', '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                        };
                        
                        errorPayload = { 
                            intendedDest: formatTitle(dest), 
                            partialDest: formatTitle(testDest) 
                        };
                        partialSuccess = true;
                        break; // Stop testing other partial destinations
                    }
                }
                
                if (partialSuccess) {
                    break; // Break outer 7-day loop! We found a partial trip today, stop looking at tomorrow.
                }
            }

        } catch (e) {
            // 🛡️ GUARDIAN PHASE 1: Catch Maximum Call Stack Exceeded or arbitrary execution failures cleanly
            console.error("🛡️ Guardian: Fatal execution error during rollover evaluation. Aborting loop.", e);
            loopStatus = 'ERR_TIMETABLE_MISMATCH';
            break;
        }
    }

    if (loopTrips.length === 0) {
        // GUARDIAN PHASE 14: THE HEURISTIC FAILURE PROBE
        console.log("[GUARDIAN] Zero trips found after 7-day scan (including partials). Initiating Heuristic Failure Probe...");
        const probeResult = runHeuristicFailureProbe(origin, dest, dayType);
        
        // GUARDIAN PHASE 5: Unwrap rich payload
        if (typeof probeResult === 'object' && probeResult !== null) {
            loopStatus = probeResult.code;
            errorPayload = probeResult;
        } else {
            loopStatus = probeResult;
        }
    } else {
        // Adjust the final payload status so the UI knows EXACTLY why we rolled over
        // BUT do not overwrite a successful PARTIAL_JOURNEY.
        if (loopStatus !== 'PARTIAL_JOURNEY') {
            if (initialStatus === 'IMPOSSIBLE_TODAY') {
                loopStatus = 'IMPOSSIBLE_TODAY'; 
            } else if (initialStatus === 'SUNDAY_ROLLOVER') {
                loopStatus = 'SUNDAY_ROLLOVER';
            }
        }
    }

    // --- GUARDIAN PHASE 1 (ANALYTICS): Track Complex Routes ---
    if (loopTrips.length > 0) {
        const topTrip = loopTrips[0];
        let tCount = 0;
        if (topTrip.type === 'MULTI_TRANSFER') tCount = topTrip.transferCount || (topTrip.legs ? topTrip.legs.length - 1 : 3);
        else if (topTrip.type === 'DOUBLE_TRANSFER') tCount = 2;
        else if (topTrip.type === 'TRANSFER') tCount = 1;
        
        // Include internal relays in UI-level transfer count
        if (topTrip.leg1 && topTrip.leg1.isRelayComposite) tCount += 1;
        if (topTrip.leg2 && topTrip.leg2.isRelayComposite) tCount += 1;
        if (topTrip.leg3 && topTrip.leg3.isRelayComposite) tCount += 1;

        if (tCount >= 3) {
            if (typeof trackAnalyticsEvent === 'function') {
                trackAnalyticsEvent('complex_route_rendered', {
                    origin: topTrip.from.replace(/ STATION/gi, ''),
                    destination: topTrip.to.replace(/ STATION/gi, ''),
                    transfers: tCount,
                    day_type: dayType
                });
            }
        }
    }

    return {
        status: loopStatus,
        errorPayload: errorPayload, // GUARDIAN PHASE 5: Secure object transit
        trips: loopTrips
    };
}