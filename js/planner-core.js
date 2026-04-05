/**
 * METRORAIL NEXT TRAIN - PLANNER CORE (V7.00.03 - Guardian Hybrid Edition)
 * ----------------------------------------------------------------
 * THE "SOUS-CHEF" (Brain)
 * * This module contains PURE LOGIC for route calculation.
 * It does NOT access the DOM (HTML). 
 * It relies on data provided by config.js and logic.js (fullDatabase, ROUTES).
 * * PHASE 5: Layover Buffers relaxed to 0 mins to catch internal platform transfers.
 * * STRIKE 1: Macro Corridor Engine extracted from CPU short-circuit block.
 * * STRIKE 3: Un-boomeranged Composite Relays & Curved Leaflet Map Vectors.
 * * PHASE 1 (GUARDIAN): Path-Diversity Signature Engine injected. Trips on different physical paths no longer delete each other.
 * * V7.00.02 (GUARDIAN HYBRID): True Time-Dependent Dijkstra Engine Injected with Train-Bound State Tracking, Penalty Buffers, and Hub-Banning Template Diversity.
 * * PHASE 2 (GUARDIAN BUGFIX): Easter Holiday Midnight Rollover patched via Calendar Sync. Dominance Filter upgraded to purge useless early-transfers.
 */

// GUARDIAN V6.2: Midnight Rollover State Tracker
let _rolloverDayIdx = null;

function getNextTransitDay(baseDayType, dayIdx) {
    // GUARDIAN PHASE 2: Smart Calendar Sync
    // Look ahead using the physical calendar to bypass public holidays seamlessly.
    let daysAhead = 1;
    if (dayIdx === 6) daysAhead = 2; // Saturday -> skip Sunday -> Monday
    // Note: Sunday (0) natively steps 1 day ahead to Monday.

    if (typeof window.getLookaheadDayInfo === 'function') {
        const info = window.getLookaheadDayInfo(daysAhead);
        return { type: info.type, name: info.name, idx: info.idx };
    }
    
    // Legacy Fallback (If logic.js somehow failed to load)
    if (baseDayType === 'weekday') {
        // If today is Friday (5), tomorrow is Saturday (6). Otherwise, it's just the next weekday.
        if (dayIdx === 5) return { type: 'saturday', name: 'Saturday', idx: 6 };
        return { type: 'weekday', name: 'Tomorrow', idx: (dayIdx + 1) % 7 };
    } else if (baseDayType === 'saturday') {
        // Assuming no Sunday service, jump straight to Monday (1)
        return { type: 'weekday', name: 'Monday', idx: 1 };
    } else if (baseDayType === 'sunday') {
        return { type: 'weekday', name: 'Monday', idx: 1 };
    }
    return { type: 'weekday', name: 'Tomorrow', idx: 1 };
}

// --- 1. LEGACY CORE ALGORITHMS (Preserved for Safety & Exhaustive Fallbacks) ---

function planDirectTrip(origin, dest, dayType, isRollover = false) {
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
                    // GUARDIAN: Pass routeId for exclusion checks
                    const upcomingTrains = findUpcomingTrainsForLeg(schedule, originRow, destRow, dayType, true, routeId); 
                    if (upcomingTrains.length > 0) {
                        bestTrips = [...bestTrips, ...upcomingTrains.map(info => 
                            createTripObject(routeConfig, info, schedule, originIdx, destIdx, origin, dest)
                        )];
                    }
                }
            }
        }
    }

    // GUARDIAN V6.2: Universal Midnight Rollover Protocol
    if (!isRollover && dayType === currentDayType) {
        const nowSec = timeToSeconds(currentTime);
        if (bestTrips.length > 0) {
            const latestDep = Math.max(...bestTrips.map(t => timeToSeconds(t.depTime)));
            if (nowSec > latestDep) {
                // All trains have departed today. Roll over to tomorrow.
                const nextTransit = getNextTransitDay(dayType, currentDayIndex);
                _rolloverDayIdx = nextTransit.idx;
                const rolloverResult = planDirectTrip(origin, dest, nextTransit.type, true);
                _rolloverDayIdx = null; // Clean up
                if (rolloverResult && rolloverResult.trips && rolloverResult.trips.length > 0) {
                    rolloverResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                    return rolloverResult;
                }
            }
        } else {
            // No scheduled service for today at all (e.g., a Sunday). Jump to next transit day.
            const nextTransit = getNextTransitDay(dayType, currentDayIndex);
            _rolloverDayIdx = nextTransit.idx;
            const nextResult = planDirectTrip(origin, dest, nextTransit.type, true);
            _rolloverDayIdx = null;
            if (nextResult && nextResult.trips && nextResult.trips.length > 0) {
                nextResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                return { status: pathFoundToday ? 'NO_MORE_TODAY' : 'NO_SERVICE_TODAY_FUTURE_FOUND', trips: nextResult.trips };
            }
        }
    }

    if (bestTrips.length > 0) return { status: 'FOUND', trips: bestTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime)) };
    return { status: (pathExistsGenerally || pathFoundToday) ? 'NO_SERVICE' : 'NO_PATH', trips: [] };
}

function planHubTransferTrip(origin, dest, dayType, isRollover = false) {
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
        const leg1Options = findAllLegsWithRelayExpansion(origin, hub, originRoutes, dayType);
        if (leg1Options.length === 0) continue;
        
        // LEG 2: Hub -> Dest (STANDARD + RELAY RECURSION)
        const leg2Options = findAllLegsWithRelayExpansion(hub, dest, destRoutes, dayType); 
        if (leg2Options.length === 0) continue;

        const TRANSFER_BUFFER_SEC = 0; // GUARDIAN Phase 5: Dropped to 0 to catch instant platform transfers
        const MAX_HUB_WAIT_SEC = 180 * 60; // 3 hours (Metrorail reality)

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

                if (waitTime >= TRANSFER_BUFFER_SEC && waitTime <= MAX_HUB_WAIT_SEC) {
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

    // GUARDIAN V6.2: Universal Midnight Rollover Protocol
    if (!isRollover && dayType === currentDayType) {
        const nowSec = timeToSeconds(currentTime);
        if (unique.length > 0) {
            const latestDep = Math.max(...unique.map(t => timeToSeconds(t.depTime)));
            if (nowSec > latestDep) {
                const nextTransit = getNextTransitDay(dayType, currentDayIndex);
                _rolloverDayIdx = nextTransit.idx;
                const rolloverResult = planHubTransferTrip(origin, dest, nextTransit.type, true);
                _rolloverDayIdx = null;
                if (rolloverResult && rolloverResult.trips && rolloverResult.trips.length > 0) {
                    rolloverResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                    return rolloverResult;
                }
            }
        } else {
            const nextTransit = getNextTransitDay(dayType, currentDayIndex);
            _rolloverDayIdx = nextTransit.idx;
            const nextResult = planHubTransferTrip(origin, dest, nextTransit.type, true);
            _rolloverDayIdx = null;
            if (nextResult && nextResult.trips && nextResult.trips.length > 0) {
                nextResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                return nextResult;
            }
        }
    }

    if (unique.length > 0) return { status: 'FOUND', trips: unique };
    return { status: 'NO_PATH', trips: [] };
}

function planRelayTransferTrip(origin, dest, dayType, isRollover = false) {
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
            const legs1 = findAllLegsBetween(origin, relayStationName, new Set([routeId]), dayType);
            if (legs1.length === 0) return;

            // 4. Find Legs: Relay -> Dest
            const legs2 = findAllLegsBetween(relayStationName, dest, new Set([routeId]), dayType);
            if (legs2.length === 0) return;

            const TRANSFER_BUFFER_SEC = 0; // GUARDIAN Phase 5: Dropped to 0 to catch instant platform transfers
            const MAX_WAIT_SEC = 180 * 60; // 3 hours

            legs1.forEach(l1 => {
                const arr1 = timeToSeconds(l1.arrTime);
                
                legs2.forEach(l2 => {
                    const dep2 = timeToSeconds(l2.depTime);
                    const wait = dep2 - arr1;

                    if (wait >= TRANSFER_BUFFER_SEC && wait <= MAX_WAIT_SEC) {
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
                });
            });
        });
    }

    // GUARDIAN V6.2: Universal Midnight Rollover Protocol
    if (!isRollover && dayType === currentDayType) {
        const nowSec = timeToSeconds(currentTime);
        if (allRelayTrips.length > 0) {
            const latestDep = Math.max(...allRelayTrips.map(t => timeToSeconds(t.depTime)));
            if (nowSec > latestDep) {
                const nextTransit = getNextTransitDay(dayType, currentDayIndex);
                _rolloverDayIdx = nextTransit.idx;
                const rolloverResult = planRelayTransferTrip(origin, dest, nextTransit.type, true);
                _rolloverDayIdx = null;
                if (rolloverResult && rolloverResult.trips && rolloverResult.trips.length > 0) {
                    rolloverResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                    return rolloverResult;
                }
            }
        } else {
            const nextTransit = getNextTransitDay(dayType, currentDayIndex);
            _rolloverDayIdx = nextTransit.idx;
            const nextResult = planRelayTransferTrip(origin, dest, nextTransit.type, true);
            _rolloverDayIdx = null;
            if (nextResult && nextResult.trips && nextResult.trips.length > 0) {
                nextResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                return nextResult;
            }
        }
    }

    return { trips: allRelayTrips };
}

// GUARDIAN PHASE 2 & 5: The Hardcoded Multi-Corridor Engine
function planMacroCorridorTrip(origin, dest, dayType, isRollover = false) {
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
                        dayType
                    );
                    trips = [...trips, ...newTrips];
                }
            }
        }
    }
    
    if (!matchedAny || trips.length === 0) return { trips: [] };
    
    // GUARDIAN: Handle Universal Midnight Rollover Protocol for Macro Corridor
    if (!isRollover && dayType === currentDayType) {
        const nowSec = timeToSeconds(currentTime);
        if (trips.length > 0) {
            const latestDep = Math.max(...trips.map(t => timeToSeconds(t.depTime)));
            if (nowSec > latestDep) {
                const nextTransit = getNextTransitDay(dayType, currentDayIndex);
                _rolloverDayIdx = nextTransit.idx;
                const rolloverResult = planMacroCorridorTrip(origin, dest, nextTransit.type, true);
                _rolloverDayIdx = null;
                if (rolloverResult && rolloverResult.trips && rolloverResult.trips.length > 0) {
                    rolloverResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                    return rolloverResult;
                }
            }
        }
    }

    if (trips.length > 0) trips.sort((a,b) => timeToSeconds(a.arrTime) - timeToSeconds(b.arrTime));
    return { trips };
}

function planDoubleTransferTrip(origin, dest, dayType, isRollover = false) {
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
                            dayType
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

    // GUARDIAN V6.2: Universal Midnight Rollover Protocol
    if (!isRollover && dayType === currentDayType) {
        const nowSec = timeToSeconds(currentTime);
        if (potentialTrips.length > 0) {
            const latestDep = Math.max(...potentialTrips.map(t => timeToSeconds(t.depTime)));
            if (nowSec > latestDep) {
                const nextTransit = getNextTransitDay(dayType, currentDayIndex);
                _rolloverDayIdx = nextTransit.idx;
                const rolloverResult = planDoubleTransferTrip(origin, dest, nextTransit.type, true);
                _rolloverDayIdx = null;
                if (rolloverResult && rolloverResult.trips && rolloverResult.trips.length > 0) {
                    rolloverResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                    return rolloverResult;
                }
            }
        } else {
            const nextTransit = getNextTransitDay(dayType, currentDayIndex);
            _rolloverDayIdx = nextTransit.idx;
            const nextResult = planDoubleTransferTrip(origin, dest, nextTransit.type, true);
            _rolloverDayIdx = null;
            if (nextResult && nextResult.trips && nextResult.trips.length > 0) {
                nextResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                return nextResult;
            }
        }
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

function findAllLegsWithRelayExpansion(stationA, stationB, routeSet, dayType) {
    let allLegs = [];
    const routesToCheck = routeSet ? [...routeSet] : Object.keys(ROUTES);

    for (const rId of routesToCheck) {
        const routeConfig = ROUTES[rId];
        
        // 1. Find Direct Legs (Standard)
        let directLegs = findAllLegsBetween(stationA, stationB, new Set([rId]), dayType);
        allLegs = [...allLegs, ...directLegs];

        // 2. Find Relay Composite Legs
        if (routeConfig.relayStation) {
            const relay = normalizeStationName(routeConfig.relayStation);
            
            // Cannot use relay if start/end IS the relay (avoid loops)
            if (normalizeStationName(stationA) === relay || normalizeStationName(stationB) === relay) continue;

            const legsToRelay = findAllLegsBetween(stationA, relay, new Set([rId]), dayType);
            if (legsToRelay.length > 0) {
                const legsFromRelay = findAllLegsBetween(relay, stationB, new Set([rId]), dayType);
                
                if (legsFromRelay.length > 0) {
                    const TRANSFER_BUFFER_SEC = 0; // GUARDIAN Phase 5: Dropped to 0 to catch instant platform transfers
                    const MAX_RELAY_WAIT = 180 * 60; // 3 hours

                    legsToRelay.forEach(l1 => {
                        const arr1 = timeToSeconds(l1.arrTime);
                        
                        legsFromRelay.forEach(l2 => {
                            const dep2 = timeToSeconds(l2.depTime);
                            const wait = dep2 - arr1;
                            
                            if (wait >= TRANSFER_BUFFER_SEC && wait <= MAX_RELAY_WAIT) {
                                // Create Composite Leg
                                allLegs.push({
                                    ...l1, // Inherit basic props from first leg
                                    to: stationB, // GUARDIAN STRIKE 3: Un-boomerang! Overwrite the relay destination with the true leg destination.
                                    arrTime: l2.arrTime, // Arrival is final dest
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

function calculateThreeLegTrip(origin, hub1, hub2, dest, route1, route2, route3, dayType) {
    const TRANSFER_BUFFER_SEC = 0; // GUARDIAN Phase 5: Dropped to 0 minutes

    // 1. Get All Leg Options ONCE
    const legs1 = findAllLegsBetween(origin, hub1, new Set([route1.id]), dayType);
    if (legs1.length === 0) return [];

    const legs2 = findAllLegsBetween(hub1, hub2, new Set([route2.id]), dayType);
    if (legs2.length === 0) return [];

    const legs3 = findAllLegsBetween(hub2, dest, new Set([route3.id]), dayType);
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
        const validLegs2 = legs2.filter(l2 => timeToSeconds(l2.depTime) >= arr1 + TRANSFER_BUFFER_SEC);

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
            const validLegs3 = legs3.filter(l3 => timeToSeconds(l3.depTime) >= arr2 + TRANSFER_BUFFER_SEC);

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

function findAllLegsBetween(stationA, stationB, routeSet, dayType) {
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
                    findUpcomingTrainsForLeg(schedule, rowA, rowB, dayType, true, rId).forEach(t => {
                        legs.push(createTripObject(routeConfig, t, schedule, idxA, idxB, stationA, stationB));
                    });
                }
            }
        }
    }
    return legs;
}

// GUARDIAN: Legacy function preserved to prevent silent deletions and maintain external API contracts.
function findNextDayTrips(routeConfig, origin, dest, baseDay) {
    let dayName = 'Tomorrow', nextDayType = 'weekday';
    
    // GUARDIAN GHOST PROTOCOL (V4.60.82): 
    let nextDayIdx = (currentDayIndex + 1) % 7; 

    if (baseDay === 'weekday') { 
        nextDayType = 'weekday'; 
        dayName = 'Tomorrow'; 
    } else if (baseDay === 'saturday') { 
        nextDayType = 'weekday'; 
        dayName = 'Monday'; 
        nextDayIdx = 1; // Force check against Monday rules
    } else if (baseDay === 'sunday') { 
        nextDayType = 'weekday'; 
        dayName = 'Monday'; 
        nextDayIdx = 1; // Force check against Monday rules
    }

    let allNextDayTrains = [];
    getDirectionsForRoute(routeConfig, nextDayType).forEach(dir => {
         if (!fullDatabase || !fullDatabase[dir.key]) return;
         const schedule = parseJSONSchedule(fullDatabase[dir.key]);
         const originRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(origin));
         const destRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(dest));
         if (originRow && destRow && schedule.rows.indexOf(originRow) < schedule.rows.indexOf(destRow)) {
             schedule.headers.slice(1).forEach(tName => {
                 
                 // GUARDIAN: Check Exclusions for the *Next* Day
                 if (isTrainExcluded(tName, routeConfig.id, nextDayIdx)) return;

                 const dTime = originRow[tName], aTime = destRow[tName];
                 if(dTime && aTime) {
                     allNextDayTrains.push({ 
                        trainName: tName, 
                        depTime: dTime, 
                        arrTime: aTime,
                        schedule: schedule, 
                        originIdx: schedule.rows.indexOf(originRow),
                        destIdx: schedule.rows.indexOf(destRow)
                     });
                 }
             });
         }
    });
    
    return allNextDayTrains.map(info => {
        const trip = createTripObject(
            routeConfig, info, info.schedule, info.originIdx, info.destIdx, origin, dest
        ); 
        trip.dayLabel = dayName;
        return trip;
    });
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

function findUpcomingTrainsForLeg(schedule, originRow, destRow, dayType, allowPast = false, routeId = null) {
    // Only check current time if we are planning for the CURRENT day type
    const isToday = (dayType === currentDayType && _rolloverDayIdx === null);
    const nowSeconds = (isToday && !allowPast) ? timeToSeconds(currentTime) : 0; 
    
    // GUARDIAN GHOST PROTOCOL (V4.60.82): Determine Day Index
    // If _rolloverDayIdx is set, use it. Otherwise default to currentDayIndex if it's today.
    let exclusionDayIdx = 1; // Default Monday
    if (_rolloverDayIdx !== null) {
        exclusionDayIdx = _rolloverDayIdx;
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

            for (const trainName of schedule.headers.slice(1)) {
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
function dijkstraPlanCore(normOrigin, normDest, graph, startSec, bannedEdges = new Set()) {
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
 * Merges consecutive single-hop legs that share the same train and route
 * into single "ride-through" legs.
 */
function mergeConsecutiveLegs(legs) {
    if (!legs || legs.length === 0) return [];
    const out = [{ ...legs[0], stops: [...(legs[0].stops || [])] }];
    for (let i = 1; i < legs.length; i++) {
        const prev = out[out.length - 1];
        const curr = legs[i];
        if (prev.train === curr.train && prev.route.id === curr.route.id) {
            out[out.length - 1] = {
                ...prev,
                to: curr.to,
                arrTime: curr.arrTime,
                stops: [...(prev.stops || []), ...(curr.stops || []).slice(1)]
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
            routePath: legs.map(l => l.route.name)
        };
    }
    return {
        ...base, type: 'MULTI_TRANSFER', route: legs[0].route,
        hub1: legs[0].to, hub2: legs[1].to, hub3: legs[2]?.to || null,
        leg1: legs[0], leg2: legs[1], leg3: legs[2] || null,
        routePath: legs.map(l => l.route.name),
        transferCount: n
    };
}

/**
 * Enumerates ALL valid departure times along a Dijkstra-discovered path template.
 */
function enumerateTripsByTemplate(mergedLegs, origin, dest, dayType, startSec) {
    if (!mergedLegs || mergedLegs.length === 0) return [];

    const TRANSFER_BUFFER_SEC = 0;
    const MAX_WAIT_SEC        = 10800; // 3 hours

    const waypoints = [origin, ...mergedLegs.map(l => l.to)];
    const routeIds  = mergedLegs.map(l => l.route.id);

    const legOptionSets = routeIds.map((routeId, idx) =>
        findAllLegsBetween(waypoints[idx], waypoints[idx + 1], new Set([routeId]), dayType)
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
                return depSec >= prevArrSec + TRANSFER_BUFFER_SEC &&
                       depSec <= prevArrSec + MAX_WAIT_SEC;
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
function planDijkstraTrip(origin, dest, dayType, isRollover = false) {
    const normOrigin = normalizeStationName(origin);
    const normDest   = normalizeStationName(dest);

    if (normOrigin === normDest || !fullDatabase) return { status: 'NO_PATH', trips: [] };

    const dayIdx = _rolloverDayIdx !== null ? _rolloverDayIdx
                 : (dayType === currentDayType ? currentDayIndex
                 : (dayType === 'saturday' ? 6 : 1));

    const startSec = (!isRollover && dayType === currentDayType && _rolloverDayIdx === null)
                   ? timeToSeconds(currentTime) : 0;

    const baseGraph       = buildTransitGraph(dayType, dayIdx);
    const bannedEdges     = new Set();
    const seenTemplates   = new Set();
    const allTrips        = [];

    for (let run = 0; run < _DIJKSTRA_MAX_RUNS; run++) {
        const rawLegs = dijkstraPlanCore(normOrigin, normDest, baseGraph, startSec, bannedEdges);
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
        const templatedTrips = enumerateTripsByTemplate(mergedLegs, origin, dest, dayType, 0);
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

    if (!isRollover && dayType === currentDayType) {
        const nowSec = timeToSeconds(currentTime);
        if (allTrips.length > 0) {
            const latestDep = Math.max(...allTrips.map(t => timeToSeconds(t.depTime)));
            if (nowSec > latestDep) {
                const nextTransit = getNextTransitDay(dayType, currentDayIndex);
                _rolloverDayIdx = nextTransit.idx;
                const rollover = planDijkstraTrip(origin, dest, nextTransit.type, true);
                _rolloverDayIdx = null;
                if (rollover?.trips?.length > 0) {
                    rollover.trips.forEach(t => t.dayLabel = nextTransit.name);
                    return rollover;
                }
            }
        } else {
            const nextTransit = getNextTransitDay(dayType, currentDayIndex);
            _rolloverDayIdx = nextTransit.idx;
            const nextResult = planDijkstraTrip(origin, dest, nextTransit.type, true);
            _rolloverDayIdx = null;
            if (nextResult?.trips?.length > 0) {
                nextResult.trips.forEach(t => t.dayLabel = nextTransit.name);
                return nextResult;
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

function planUnifiedTrip(origin, dest, dayType) {
    console.log(`[GUARDIAN] Running Unified Trip Planner for ${origin} -> ${dest}`);

    // GUARDIAN V7 HYBRID: The Dijkstra Engine goes first, fortified by Template Diversity bans
    const dijkstraResult = typeof planDijkstraTrip === 'function'
        ? planDijkstraTrip(origin, dest, dayType) : { trips: [] };

    let allRawTrips = [...(dijkstraResult.trips || [])];

    // GUARDIAN V7 HYBRID: If Dijkstra found absolutely nothing (e.g. graph not ready or network too sparse), 
    // fall back to legacy exhaust loops to ensure 100% routing uptime
    if (allRawTrips.length === 0) {
        const directResult = typeof planDirectTrip === 'function' ? planDirectTrip(origin, dest, dayType) : { trips: [] };
        const macroResult = typeof planMacroCorridorTrip === 'function' ? planMacroCorridorTrip(origin, dest, dayType) : { trips: [] };
        const relayResult = typeof planRelayTransferTrip === 'function' ? planRelayTransferTrip(origin, dest, dayType) : { trips: [] };
        const hubResult   = typeof planHubTransferTrip === 'function' ? planHubTransferTrip(origin, dest, dayType) : { trips: [] };
        
        allRawTrips = [
            ...(directResult.trips || []),
            ...(macroResult.trips || []),
            ...(relayResult.trips || []),
            ...(hubResult.trips || [])
        ];

        const todayCount = allRawTrips.filter(t => !t.dayLabel).length;
        if (todayCount < 3 && (macroResult.trips || []).length === 0) {
            const doubleResult = typeof planDoubleTransferTrip === 'function' ? planDoubleTransferTrip(origin, dest, dayType) : { trips: [] };
            allRawTrips = [...allRawTrips, ...(doubleResult.trips || [])];
        }
    }

    let rawTrips = [], rawNextDayTrips = [];
    allRawTrips.forEach(t => (t.dayLabel ? rawNextDayTrips : rawTrips).push(t));

    // Enforce strict layover guardrails
    const hasValidLayovers = (trip) => {
        if (trip.type === 'DIRECT') return true;

        const checkLayover = (arrTime, depTime) => {
            let layover = timeToSeconds(depTime) - timeToSeconds(arrTime);
            if (layover < 0) layover += 86400; 
            return layover >= 0 && layover <= 10800;
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

    rawTrips        = rawTrips.filter(hasValidLayovers);
    rawNextDayTrips = rawNextDayTrips.filter(hasValidLayovers);

    // Apply Pareto Dominance Filter (V6 Signature-Restored)
    const optimalTrips        = filterDominatedTrips(rawTrips);
    const optimalNextDayTrips = filterDominatedTrips(rawNextDayTrips);

    const masterSort = (a, b) => {
        const getDep   = t => timeToSeconds(t.depTime || (t.leg1?.depTime  || "00:00"));
        const getArr   = t => timeToSeconds(t.arrTime || (t.leg3?.arrTime  || (t.leg2?.arrTime || "00:00")));
        const getTrans = t => t.type === 'MULTI_TRANSFER' ? (t.transferCount || 3)
                            : t.type === 'DOUBLE_TRANSFER' ? 2
                            : t.type === 'TRANSFER' ? 1 : 0;
        const depDiff = getDep(a) - getDep(b); if (depDiff !== 0) return depDiff;
        const arrDiff = getArr(a) - getArr(b); if (arrDiff !== 0) return arrDiff;
        return getTrans(a) - getTrans(b);
    };

    optimalTrips.sort(masterSort);
    optimalNextDayTrips.sort(masterSort);

    const finalStatus = optimalTrips.length > 0        ? 'FOUND'
                      : optimalNextDayTrips.length > 0 ? 'NO_MORE_TODAY'
                      : 'NO_PATH';

    return {
        status: finalStatus,
        trips: optimalTrips.length > 0 ? optimalTrips : optimalNextDayTrips
    };
}