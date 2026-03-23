/**
 * METRORAIL NEXT TRAIN - PLANNER CORE (V6.00.33 - Guardian Unified Edition)
 * ----------------------------------------------------------------
 * THE "SOUS-CHEF" (Brain)
 * * This module contains PURE LOGIC for route calculation.
 * It does NOT access the DOM (HTML). 
 * It relies on data provided by config.js and logic.js (fullDatabase, ROUTES).
 * * Inputs: Origin, Destination, DayType
 * Outputs: Array of Trip Objects
 */

// GUARDIAN V6.2: Midnight Rollover State Tracker
let _rolloverDayIdx = null;

function getNextTransitDay(baseDayType, dayIdx) {
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

// --- 1. CORE ALGORITHMS ---

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

        const TRANSFER_BUFFER_SEC = 2 * 60; // 2 min minimum (sprint)
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
        const seenDepTimes = new Set();
        allTransferOptions.forEach(opt => {
            if(!seenDepTimes.has(opt.depTime)) { seenDepTimes.add(opt.depTime); unique.push(opt); }
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
            // 1. Check if this route has a configured Relay Station
            if (!routeConfig.relayStation) return;

            const relayStationName = normalizeStationName(routeConfig.relayStation);
            
            // 3. Find Legs: Origin -> Relay
            const legs1 = findAllLegsBetween(origin, relayStationName, new Set([routeId]), dayType);
            if (legs1.length === 0) return;

            // 4. Find Legs: Relay -> Dest
            const legs2 = findAllLegsBetween(relayStationName, dest, new Set([routeId]), dayType);
            if (legs2.length === 0) return;

            const TRANSFER_BUFFER_SEC = 2 * 60; 
            const MAX_WAIT_SEC = 180 * 60; // 3 hours

            legs1.forEach(l1 => {
                const arr1 = timeToSeconds(l1.arrTime);
                
                legs2.forEach(l2 => {
                    const dep2 = timeToSeconds(l2.depTime);
                    const wait = dep2 - arr1;

                    // GUARDIAN FIX V5.00.02: Corrected variable name from TRANSFER_BUFFER to TRANSFER_BUFFER_SEC
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

// --- 2. LOGIC HELPERS ---

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
                    const TRANSFER_BUFFER_SEC = 2 * 60;
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
    const TRANSFER_BUFFER_SEC = 5 * 60; // 5 minutes safe buffer

    // 1. Get All Leg Options ONCE
    const legs1 = findAllLegsBetween(origin, hub1, new Set([route1.id]), dayType);
    if (legs1.length === 0) return [];

    const legs2 = findAllLegsBetween(hub1, hub2, new Set([route2.id]), dayType);
    if (legs2.length === 0) return [];

    const legs3 = findAllLegsBetween(hub2, dest, new Set([route3.id]), dayType);
    if (legs3.length === 0) return [];

    const trips = [];

    for (const l1 of legs1) {
        
        // PRUNE: If Leg 1 goes straight to Hub 2 faster...
        if (isTrainFasterDirect(l1.route, l1.train, hub2, dayType, null)) {
            continue; 
        }

        const arr1 = timeToSeconds(l1.arrTime);
        const validLegs2 = legs2.filter(l2 => timeToSeconds(l2.depTime) >= arr1 + TRANSFER_BUFFER_SEC);

        for (const l2 of validLegs2) {
            
            // PRUNE: If Leg 2 goes straight to Dest faster...
            if (isTrainFasterDirect(l2.route, l2.train, dest, dayType, null)) {
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
        if (row[trainName]) stops.push({ station: row.STATION, time: row[trainName] });
    }
    return stops;
}

// --- 3. DATA UTILS ---

function ensureScheduleLoaded(routeId, dayType) {
    if (!fullDatabase) return null; 
    const route = ROUTES[routeId];
    if (!route) return null;

    let sheetKeys = [];

    if (dayType === 'weekday') {
        sheetKeys = [route.sheetKeys.weekday_to_a, route.sheetKeys.weekday_to_b];
    } else if (dayType === 'saturday' || dayType === 'sunday') {
        sheetKeys = [route.sheetKeys.saturday_to_a, route.sheetKeys.saturday_to_b];
    }

    return sheetKeys.map(key => {
        if (!fullDatabase[key]) return null;
        return parseJSONSchedule(fullDatabase[key], fullDatabase[key + "_meta"]);
    }).filter(s => s !== null);
}

// --- GUARDIAN V6.2: MASTER UNIFICATION & DOMINANCE FILTER ---

/**
 * Evaluates an array of trips and mercilessly deletes "Dominated" trips.
 * A trip is dominated if another trip gets you there at the same time (or earlier),
 * leaves at the same time (or later), and requires the same (or fewer) transfers.
 * GUARDIAN PATCH: Explicitly uses leg1, leg2, leg3 data contracts.
 */
function filterDominatedTrips(trips) {
    if (!trips || trips.length === 0) return [];
    
    const optimalTrips = [];
    
    const getDep = t => timeToSeconds(t.depTime || (t.leg1 ? t.leg1.depTime : "00:00"));
    const getArr = t => timeToSeconds(t.arrTime || (t.leg3 ? t.leg3.arrTime : (t.leg2 ? t.leg2.arrTime : "00:00")));
    const getTrans = t => t.type === 'DOUBLE_TRANSFER' ? 2 : (t.type === 'TRANSFER' ? 1 : 0);
    
    for (let i = 0; i < trips.length; i++) {
        const tripX = trips[i];
        let isDominated = false;
        
        const xDep = getDep(tripX);
        const xArr = getArr(tripX);
        const xTransfers = getTrans(tripX);
        
        for (let j = 0; j < trips.length; j++) {
            if (i === j) continue;
            const tripY = trips[j];
            
            const yDep = getDep(tripY);
            const yArr = getArr(tripY);
            const yTransfers = getTrans(tripY);
            
            // DOMINANCE RULE:
            // Trip Y dominates Trip X if Y departs same/later, arrives same/earlier, and has same/fewer transfers.
            if (yDep >= xDep && yArr <= xArr && yTransfers <= xTransfers) {
                
                // Tie-breaker for mathematically identical trips
                if (yDep === xDep && yArr === xArr && yTransfers === xTransfers) {
                    // Keep the one that appears first in the array to prevent mutual deletion
                    if (j < i) {
                        isDominated = true;
                        break;
                    }
                } else {
                    // Trip Y is strictly better. Trip X is mathematically useless.
                    isDominated = true;
                    break;
                }
            }
        }
        
        if (!isDominated) {
            optimalTrips.push(tripX);
        }
    }
    
    return optimalTrips;
}

/**
 * The New Master Orchestrator for the Core Logic.
 * Fires search depths, applies the 5-min/3-hour guardrails, 
 * filters dominated trips, and returns a perfectly sorted chronological array.
 */
function planUnifiedTrip(origin, dest, dayType) {
    console.log(`[GUARDIAN] Running Unified Trip Planner for ${origin} -> ${dest}`);
    
    // 1. Gather trips
    const directResult = typeof planDirectTrip === 'function' ? planDirectTrip(origin, dest, dayType) : { trips: [] };
    const relayResult = typeof planRelayTransferTrip === 'function' ? planRelayTransferTrip(origin, dest, dayType) : { trips: [] };
    const hubResult = typeof planHubTransferTrip === 'function' ? planHubTransferTrip(origin, dest, dayType) : { trips: [] };
    
    let allRawTrips = [
        ...(directResult.trips || []),
        ...(relayResult.trips || []),
        ...(hubResult.trips || [])
    ];
    
    // SMART SHORT-CIRCUIT: CPU Protection
    // If we found ample direct/single-transfer routes for TODAY, skip massive double-transfer calculations.
    const todayCount = allRawTrips.filter(t => !t.dayLabel).length;
    if (todayCount < 3) {
        const doubleResult = typeof planDoubleTransferTrip === 'function' ? planDoubleTransferTrip(origin, dest, dayType) : { trips: [] };
        allRawTrips = [...allRawTrips, ...(doubleResult.trips || [])];
    }

    // 2. Separate Today from Tomorrow (Fixing the Black Hole)
    let rawTrips = [];
    let rawNextDayTrips = [];
    allRawTrips.forEach(t => {
        if (t.dayLabel) rawNextDayTrips.push(t);
        else rawTrips.push(t);
    });

    // 3. Enforce strict layover guardrails (5 mins to 3 hours)
    const hasValidLayovers = (trip) => {
        if (trip.type === 'DIRECT') return true;
        
        const checkLayover = (arrTime, depTime) => {
            const arrSec = timeToSeconds(arrTime);
            const depSec = timeToSeconds(depTime);
            let layover = depSec - arrSec;
            if (layover < 0) layover += 86400; // Handle midnight crossover
            return layover >= 300 && layover <= 10800;
        };

        if (trip.type === 'TRANSFER') {
            return checkLayover(trip.leg1.arrTime, trip.leg2.depTime);
        }
        if (trip.type === 'DOUBLE_TRANSFER') {
            return checkLayover(trip.leg1.arrTime, trip.leg2.depTime) && 
                   checkLayover(trip.leg2.arrTime, trip.leg3.depTime);
        }
        return true;
    };

    rawTrips = rawTrips.filter(hasValidLayovers);
    rawNextDayTrips = rawNextDayTrips.filter(hasValidLayovers);

    // 4. Apply Pareto Dominance Filter
    const optimalTrips = filterDominatedTrips(rawTrips);
    const optimalNextDayTrips = filterDominatedTrips(rawNextDayTrips);

    // 5. Master Sort (Chronological by Departure Time, then Arrival Time, then Transfers)
    const masterSort = (a, b) => {
        const getDep = t => timeToSeconds(t.depTime || (t.leg1 ? t.leg1.depTime : "00:00"));
        const getArr = t => timeToSeconds(t.arrTime || (t.leg3 ? t.leg3.arrTime : (t.leg2 ? t.leg2.arrTime : "00:00")));
        const getTrans = t => t.type === 'DOUBLE_TRANSFER' ? 2 : (t.type === 'TRANSFER' ? 1 : 0);

        const aDep = getDep(a);
        const bDep = getDep(b);
        if (aDep !== bDep) return aDep - bDep;
        
        const aArr = getArr(a);
        const bArr = getArr(b);
        if (aArr !== bArr) return aArr - bArr;

        return getTrans(a) - getTrans(b);
    };

    optimalTrips.sort(masterSort);
    optimalNextDayTrips.sort(masterSort);

    // 6. Return Unified Result (Matching UI expectations for `logic.js`)
    let finalStatus = 'NO_PATH';
    if (optimalTrips.length > 0) {
        finalStatus = 'FOUND';
    } else if (optimalNextDayTrips.length > 0) {
        finalStatus = 'NO_MORE_TODAY';
    }

    return {
        status: finalStatus,
        trips: optimalTrips.length > 0 ? optimalTrips : optimalNextDayTrips
    };
}