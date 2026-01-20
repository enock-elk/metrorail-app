/**
 * METRORAIL NEXT TRAIN - PLANNER CORE (V4.60.16 - Guardian Edition)
 * ----------------------------------------------------------------
 * THE "SOUS-CHEF" (Brain)
 * * This module contains PURE LOGIC for route calculation.
 * It does NOT access the DOM (HTML). 
 * It relies on data provided by config.js and logic.js (fullDatabase, ROUTES).
 * * Inputs: Origin, Destination, DayType
 * Outputs: Array of Trip Objects
 */

// --- 1. CORE ALGORITHMS ---

function planDirectTrip(origin, dest, dayType) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    const commonRoutes = [...originRoutes].filter(x => destRoutes.has(x));

    if (commonRoutes.length === 0) return { status: 'NO_PATH' };

    let bestTrips = [];
    let nextDayTrips = [];
    let pathFoundToday = false;
    let pathExistsGenerally = false;
    
    // Rule: Sunday trains are scarce. If no service found, check Monday (next working day).
    if (dayType === 'sunday') {
        for (const routeId of commonRoutes) {
            const routeConfig = ROUTES[routeId];
            const next = findNextDayTrips(routeConfig, origin, dest, 'sunday');
            if (next && next.length > 0) {
                nextDayTrips = [...nextDayTrips, ...next];
            }
        }
        if (nextDayTrips.length > 0) {
            return { status: 'SUNDAY_NO_SERVICE', trips: nextDayTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime)) };
        }
        return { status: 'NO_SERVICE' };
    }

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
                    const upcomingTrains = findUpcomingTrainsForLeg(schedule, originRow, destRow, dayType, true); 
                    if (upcomingTrains.length > 0) {
                        bestTrips = [...bestTrips, ...upcomingTrains.map(info => 
                            createTripObject(routeConfig, info, schedule, originIdx, destIdx, origin, dest)
                        )];
                    }
                }
            }
        }
        // If no trains found TODAY, check TOMORROW
        if (bestTrips.length === 0) {
             const next = findNextDayTrips(routeConfig, origin, dest, dayType);
             if (next && next.length > 0) {
                 nextDayTrips = [...nextDayTrips, ...next];
                 pathExistsGenerally = true;
             }
        }
    }

    if (bestTrips.length > 0) return { status: 'FOUND', trips: bestTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime)) };
    if (nextDayTrips.length > 0) return { status: pathFoundToday ? 'NO_MORE_TODAY' : 'NO_SERVICE_TODAY_FUTURE_FOUND', trips: nextDayTrips.sort((a,b) => timeToSeconds(a.depTime) - timeToSeconds(b.depTime)) };
    return { status: (pathExistsGenerally || pathFoundToday) ? 'NO_SERVICE' : 'NO_PATH' };
}

function planHubTransferTrip(origin, dest, dayType) {
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

    if (potentialHubs.length === 0) return { status: 'NO_PATH' };

    let allTransferOptions = [];
    
    for (const hub of potentialHubs) {
        // LEG 1: Origin -> Hub
        const leg1Options = findAllLegsBetween(origin, hub, originRoutes, dayType);
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
                if (leg1.route.id === leg2.route.id && !leg2.isRelayComposite) {
                    return; 
                }

                // SMART PRUNING CHECK (V4.58 Feature)
                if (isTrainFasterDirect(leg1.route, leg1.train, dest, dayType, leg2.arrTime)) {
                    // This train goes to the destination directly and arrives earlier/same time.
                    return; 
                }

                // LOGICAL PATH CHECK (V4.59 Feature)
                if (!isPathLogical(leg1, leg2, dest)) {
                    // This path overshoots or loops back.
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

    if (allTransferOptions.length > 0) {
        allTransferOptions.sort((a,b) => {
            const depDiff = timeToSeconds(a.depTime) - timeToSeconds(b.depTime);
            return depDiff !== 0 ? depDiff : a.totalDuration - b.totalDuration;
        });
        const unique = [];
        const seenDepTimes = new Set();
        allTransferOptions.forEach(opt => {
            if(!seenDepTimes.has(opt.depTime)) { seenDepTimes.add(opt.depTime); unique.push(opt); }
        });
        return { status: 'FOUND', trips: unique };
    }
    return { status: 'NO_PATH' };
}

function planRelayTransferTrip(origin, dest, dayType) {
    const originRoutes = globalStationIndex[normalizeStationName(origin)]?.routes || new Set();
    const destRoutes = globalStationIndex[normalizeStationName(dest)]?.routes || new Set();
    // Intersection: Same route for Start and End (but logic forces a split)
    const commonRoutes = [...originRoutes].filter(x => destRoutes.has(x));
    
    if (commonRoutes.length === 0) return { trips: [] };

    let allRelayTrips = [];

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

    return { trips: allRelayTrips };
}

function planDoubleTransferTrip(origin, dest, dayType) {
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
        return { status: 'FOUND', trips: potentialTrips };
    }
    return { status: 'NO_PATH' };
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
            
            const legsToRelay = findAllLegsBetween(stationA, relay, new Set([rId]), dayType);
            if (legsToRelay.length > 0) {
                const legsFromRelay = findAllLegsBetween(relay, stationB, new Set([rId]), dayType);
                
                if (legsFromRelay.length > 0) {
                    const TRANSFER_BUFFER = 2 * 60;
                    const MAX_RELAY_WAIT = 180 * 60; // 3 hours

                    legsToRelay.forEach(l1 => {
                        const arr1 = timeToSeconds(l1.arrTime);
                        
                        legsFromRelay.forEach(l2 => {
                            const dep2 = timeToSeconds(l2.depTime);
                            const wait = dep2 - arr1;
                            
                            if (wait >= TRANSFER_BUFFER && wait <= MAX_RELAY_WAIT) {
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
    const TRANSFER_BUFFER = 5 * 60; // 5 minutes safe buffer

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
        const validLegs2 = legs2.filter(l2 => timeToSeconds(l2.depTime) >= arr1 + TRANSFER_BUFFER);

        for (const l2 of validLegs2) {
            
            // PRUNE: If Leg 2 goes straight to Dest faster...
            if (isTrainFasterDirect(l2.route, l2.train, dest, dayType, null)) {
                continue;
            }

            const arr2 = timeToSeconds(l2.arrTime);
            const validLegs3 = legs3.filter(l3 => timeToSeconds(l3.depTime) >= arr2 + TRANSFER_BUFFER);

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
                    findUpcomingTrainsForLeg(schedule, rowA, rowB, dayType, true).forEach(t => {
                        legs.push(createTripObject(routeConfig, t, schedule, idxA, idxB, stationA, stationB));
                    });
                }
            }
        }
    }
    return legs;
}

function findNextDayTrips(routeConfig, origin, dest, baseDay) {
    let dayName = 'Tomorrow', nextDayType = 'weekday';
    
    if (baseDay === 'weekday') { 
        nextDayType = 'weekday'; 
        dayName = 'Tomorrow'; 
    } else if (baseDay === 'saturday') { 
        nextDayType = 'weekday'; 
        dayName = 'Monday'; 
    } else if (baseDay === 'sunday') { 
        nextDayType = 'weekday'; 
        dayName = 'Monday'; 
    }

    let allNextDayTrains = [];
    getDirectionsForRoute(routeConfig, nextDayType).forEach(dir => {
         if (!fullDatabase || !fullDatabase[dir.key]) return;
         const schedule = parseJSONSchedule(fullDatabase[dir.key]);
         const originRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(origin));
         const destRow = schedule.rows.find(r => normalizeStationName(r.STATION) === normalizeStationName(dest));
         if (originRow && destRow && schedule.rows.indexOf(originRow) < schedule.rows.indexOf(destRow)) {
             schedule.headers.slice(1).forEach(tName => {
                 const dTime = originRow[tName], aTime = destRow[tName];
                 if(dTime && aTime) {
                     // FIXED (V4.60.6): Capture full context so stops can be generated
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
        // FIXED (V4.60.6): Pass the captured schedule & indices instead of null/0
        const trip = createTripObject(
            routeConfig, 
            info, 
            info.schedule, 
            info.originIdx, 
            info.destIdx, 
            origin, 
            dest
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

function findUpcomingTrainsForLeg(schedule, originRow, destRow, dayType, allowPast = false) {
    // Only check current time if we are planning for the CURRENT day type
    const isToday = (dayType === currentDayType);
    const nowSeconds = (isToday && !allowPast) ? timeToSeconds(currentTime) : 0; 
    
    let upcomingTrains = [];
    schedule.headers.slice(1).forEach(trainName => {
        const depTime = originRow[trainName], arrTime = destRow[trainName];
        if (depTime && arrTime) {
            const depSeconds = timeToSeconds(depTime);
            if (depSeconds >= 0) upcomingTrains.push({ trainName, depTime, arrTime, seconds: depSeconds });
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