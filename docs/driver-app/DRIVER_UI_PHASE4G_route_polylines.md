# Phase 4G: Driver Route Polylines (Dual-Leg Routing)

**Version**: Phase 4G  
**Date**: January 19, 2026  
**Status**: ✅ Implementation Complete

---

## Overview

Phase 4G adds **Uber-style route visualization** to the driver MapShell by reusing the existing polyline routing system. The driver sees their route drawn on the map with two legs:
- **Leg A** (bright/solid): driver → pickup (or driver → dropoff if in-progress)
- **Leg B** (dim/dashed): pickup → dropoff (preview)

### Key Features

✅ **Dual-Leg Visualization**: Shows current route (bright) + next segment (dim preview)  
✅ **Auto-Switching**: Leg highlights switch when ride status changes (accepted → in_progress)  
✅ **Throttled Updates**: GPS-based route refresh with 10m distance + 3s time threshold  
✅ **Camera Fit**: Auto-fit bounds once per state change (not nauseating)  
✅ **Event Logging**: All route changes logged to DiagnosticsPanel  
✅ **Reuses Existing Code**: No new libraries, uses OSRM routing from customer app  

---

## Why This Matters (Even with Native Navigation)

**Phase 4B** (Native Nav) = Full turn-by-turn when you tap "Navigate"  
**Phase 4G** (Route Polyline) = "Uber feel" while in MapShell overview

They **work together**:
1. Driver sees route polyline on map → knows where to go
2. Driver taps "Navigate" → opens native turn-by-turn
3. Driver dismisses nav → back to MapShell with route polyline still visible

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   DriverHome                        │
│                                                     │
│  useDriverRoutes() hook                            │
│    ├─ Watches: driver GPS, pickup, dropoff, status│
│    ├─ Fetches: OSRM route via fetchOsrmRoute()    │
│    ├─ Throttles: 3s + 10m distance threshold      │
│    └─ Returns: legA, legB, activeLeg               │
│         ↓                                           │
│  SharedMap component                               │
│    ├─ Renders: DualRouteLine                       │
│    └─ FitBoundsOnce: Camera fit per state change  │
└─────────────────────────────────────────────────────┘
```

### Routing Flow

```
Offer appears → Fetch legA (driver→pickup) + legB (pickup→dropoff)
                         ↓
               Render both: legA=bright, legB=dim/dashed
                         ↓
Driver accepts → Routes stay visible
                         ↓
Start ride → Leg switches: legA=dim, legB=bright
                         ↓
Driver moves > 10m → Refresh legA (throttled 3s)
                         ↓
Complete/cancel → Routes clear
```

---

## Files Created (2 files)

### 1. Driver Routes Hook
**`packages/driver-app/src/hooks/useDriverRoutes.ts`** (270 lines)
- Manages two-leg routing with throttling
- Fetches OSRM routes for both legs
- Throttles updates: 10m distance + 3s time
- Auto-switches active leg based on ride status
- Logs all route changes

**Key Parameters**:
```typescript
useDriverRoutes({
  driverLocation: LatLng | null,
  pickup: LatLng | null,
  dropoff: LatLng | null,
  rideStatus: 'accepted' | 'started' | 'in_progress' | null,
  updateThresholdMeters: 10, // Optional, default 10m
  throttleMs: 3000, // Optional, default 3000ms
})
```

**Returns**:
```typescript
{
  legA: [lat, lng][] | null,        // Driver → destination
  legB: [lat, lng][] | null,        // Pickup → dropoff preview
  allCoords: [lat, lng][] | null,   // Combined for camera bounds
  loading: boolean,
  error?: string,
  legADistanceMeters?: number,
  legBDistanceMeters?: number,
  activeLeg: 'A' | 'B' | null,      // Which leg is highlighted
}
```

### 2. Dual Route Line Component
**`packages/driver-app/src/components/DualRouteLine.tsx`** (120 lines)
- Renders two route legs with different styling
- Active leg: bright blue, solid (#3b82f6)
- Preview leg: gray, dashed (#6b7280)
- Glow effect on both legs

**Styling**:
```typescript
ACTIVE_STYLE = {
  color: '#3b82f6',  // Bright blue
  glow: { weight: 12, opacity: 0.4 },
  core: { weight: 7, opacity: 1 },
}

PREVIEW_STYLE = {
  color: '#6b7280',  // Gray
  glow: { weight: 10, opacity: 0.2 },
  core: { weight: 5, opacity: 0.6, dashArray: '10, 10' },
}
```

---

## Files Modified (2 files)

### 3. SharedMap Component
**`packages/driver-app/src/components/map/SharedMap.tsx`** (+30 lines)
- Added props: `legA`, `legB`, `activeLeg`
- Updated bounds calculation to include dual-leg coords
- Renders DualRouteLine when legs available
- Falls back to legacy RouteLine for backward compatibility

**New Props**:
```typescript
interface SharedMapProps {
  // ... existing props
  legA?: [number, number][] | null;
  legB?: [number, number][] | null;
  activeLeg?: 'A' | 'B' | null;
}
```

### 4. DriverHome Component
**`packages/driver-app/src/components/DriverHome.tsx`** (+90 lines)
- Added `useDriverRoutes` import and hook call
- Watches active ride for pickup/dropoff/status
- Passes `legA`, `legB`, `activeLeg` to SharedMap
- Generates `fitKey` for camera bounds (changes on state transitions)
- Updates `hasActiveRoute` for CameraToggle

**Key Changes**:
- Lines 295-327: Watch active ride document for pickup/dropoff/status
- Lines 329-366: Compute ride pickup/dropoff/status from offer or active ride
- Lines 368-377: Call `useDriverRoutes()` hook
- Lines 395-398: Compute `hasActiveRoute` and `fitKey`
- Lines 403-410: Pass dual-leg props to SharedMap

---

## How It Works

### Step 1: Offer Appears
1. DriverHome receives `pendingOffers` with new offer
2. `useDriverRoutes` fetches:
   - **Leg A**: driver → pickup (via OSRM)
   - **Leg B**: pickup → dropoff (via OSRM)
3. DualRouteLine renders both:
   - Leg A: bright blue, solid
   - Leg B: gray, dashed (preview)
4. Camera fits to show all route points

**Event Log**:
```
🧭 NAVIGATION: Route polyline set (driver→pickup)
🧭 NAVIGATION: Route polyline set (pickup→dropoff preview)
```

### Step 2: Driver Accepts Offer
1. Offer accepted, now `activeRideId` set
2. Routes **stay visible** (no re-fetch needed)
3. Ride status = 'accepted', so `activeLeg` = 'A'

### Step 3: Driver Moves Toward Pickup
1. GPS updates trigger `useDriverRoutes` hook
2. **Throttle check**: Has driver moved > 10m AND elapsed > 3s?
   - ✅ Yes: Re-fetch leg A (driver → pickup)
   - ❌ No: Skip update (prevent spam)
3. New route rendered smoothly

**Console Log**:
```
[useDriverRoutes] Leg A updated: 523m, 87s
```

### Step 4: Driver Starts Ride
1. Ride status → 'in_progress'
2. `activeLeg` switches from 'A' to 'B'
3. DualRouteLine updates styling:
   - Leg A: becomes dim/dashed (or hidden)
   - Leg B: becomes bright/solid
4. Camera does NOT re-fit (avoid nausea)

**Event Log**:
```
🧭 NAVIGATION: Route switched (pickup→dropoff)
```

### Step 5: Driver Completes/Cancels Ride
1. Ride ends, `activeRideId` cleared
2. `useDriverRoutes` hook detects no pickup/dropoff
3. Routes clear from map
4. Driver returns to idle state

---

## Throttling Logic

### Why Throttling?
Without throttling, route would re-fetch **every GPS update** (~1-2x per second):
- ❌ Spams OSRM API
- ❌ Wastes bandwidth
- ❌ Causes flickering
- ❌ Drains battery

### How It Works
```typescript
// Check if driver moved enough
const distanceMoved = haversine(lastLocation, currentLocation);
const timeSinceLastUpdate = now - lastUpdateTime;

if (distanceMoved < 10 || timeSinceLastUpdate < 3000) {
  // Skip update
  return;
}

// Fetch new route
fetchOsrmRoute(driver, destination);
```

**Parameters**:
- `updateThresholdMeters`: 10m (driver must move at least 10m)
- `throttleMs`: 3000ms (3 seconds minimum between updates)

**Result**: Route updates ~every 3-5 seconds while driving, not every GPS tick

---

## Camera Behavior

### Auto-Fit (Once Per State)
Camera automatically fits to show all route points when:
- ✅ New offer appears
- ✅ Route legs change (new ride)
- ✅ Active leg switches (accepted → in_progress)

Camera does NOT re-fit when:
- ❌ Driver moves (follows GPS instead)
- ❌ Route refreshes due to GPS update
- ❌ Minor state changes

### Implementation
```typescript
const fitKey = useMemo(() => {
  if (!hasActiveRoute) return '';
  return `${rideId}-${rideStatus}-${activeLeg}`;
}, [rideId, rideStatus, activeLeg, hasActiveRoute]);

// In SharedMap:
<FitBoundsOnce bounds={mapBounds} fitKey={fitKey} />
```

**FitBoundsOnce**: Only fits camera when `fitKey` changes (not on every render)

---

## Event Logging

Phase 4G adds route polyline events:

### Route Set (Leg A)
```typescript
logEvent('navigation', 'Route polyline set (driver→pickup)', {
  driverLocation: { lat, lng },
  destination: { lat, lng },
  destinationType: 'pickup',
  distance: 1234,  // meters
  duration: 98,    // seconds
});
```

### Route Set (Leg B Preview)
```typescript
logEvent('navigation', 'Route polyline set (pickup→dropoff preview)', {
  pickup: { lat, lng },
  dropoff: { lat, lng },
  distance: 3456,
  duration: 234,
});
```

### Route Switched
```typescript
logEvent('navigation', 'Route switched (pickup→dropoff)', {
  pickup: { lat, lng },
  dropoff: { lat, lng },
});
```

**View in DiagnosticsPanel**: Filter by "🧭 Navigation" category

---

## Testing Guide

### Test 1: Route Appears on Offer

**Steps**:
1. Sign in as driver, go online
2. Create test ride (admin app)
3. Wait for offer to appear

**Expected**:
- [ ] Route polyline appears on map
- [ ] Bright blue line: driver → pickup
- [ ] Gray dashed line: pickup → dropoff (preview)
- [ ] Camera fits to show both legs
- [ ] Event log shows: "Route polyline set (driver→pickup)"
- [ ] Event log shows: "Route polyline set (pickup→dropoff preview)"

**Result**: ❌ FAIL | ✅ PASS

---

### Test 2: Route Persists After Accept

**Steps**:
1. Get offer (Test 1)
2. Accept ride
3. Check map

**Expected**:
- [ ] Route stays visible after accept
- [ ] Leg A still bright (driver → pickup)
- [ ] Leg B still dim/dashed (preview)
- [ ] Camera does NOT re-fit
- [ ] No duplicate route fetches

**Result**: ❌ FAIL | ✅ PASS

---

### Test 3: Route Updates on Driver Movement

**Steps**:
1. Accept ride
2. Move >10m in emulator (or drive in real device)
3. Wait 3 seconds
4. Check console logs

**Expected**:
- [ ] Console shows: "[useDriverRoutes] Leg A updated: XXXm, XXs"
- [ ] Route polyline updates to new driver position
- [ ] Update happens **after** 3 seconds, not immediately
- [ ] No update if driver moves <10m

**Console Example**:
```
[useDriverRoutes] Skipping leg A update: moved 5.2m, elapsed 1234ms
... (driver moves more)
[useDriverRoutes] Leg A updated: 523m, 87s
```

**Result**: ❌ FAIL | ✅ PASS

---

### Test 4: Leg Switching (Accept → Start)

**Steps**:
1. Accept ride (leg A bright, leg B dim)
2. Arrive at pickup
3. Tap "Start Ride"
4. Check map

**Expected**:
- [ ] Leg B becomes bright/solid (driver → dropoff)
- [ ] Leg A becomes dim/dashed (or hidden)
- [ ] Event log shows: "Route switched (pickup→dropoff)"
- [ ] Camera does NOT re-fit (stays in current view)

**Result**: ❌ FAIL | ✅ PASS

---

### Test 5: Route Clears on Completion

**Steps**:
1. Complete ride (or cancel)
2. Check map

**Expected**:
- [ ] Route polyline disappears
- [ ] Map shows only driver marker
- [ ] No pickup/dropoff markers
- [ ] Driver returns to idle state

**Result**: ❌ FAIL | ✅ PASS

---

## Integration with Phase 4B (Native Navigation)

Phase 4G (route polyline) and Phase 4B (native navigation) work together:

### Scenario: Driver Navigates to Pickup

1. **Offer appears**:
   - Phase 4G: Route polyline shows driver → pickup (bright blue)
   
2. **Driver taps "Navigate"**:
   - Phase 4B: Native Mapbox navigation opens (full screen)
   - Turn-by-turn instructions start
   
3. **Driver dismisses navigation**:
   - Returns to MapShell
   - Phase 4G: Route polyline still visible
   - Driver can see overview while not in active navigation
   
4. **Driver taps "Navigate" again**:
   - Phase 4B: Navigation resumes from current location

### Benefits of Dual System

| Feature | Phase 4G (Polyline) | Phase 4B (Native Nav) |
|---------|---------------------|------------------------|
| **View** | MapShell overview | Full-screen turn-by-turn |
| **When** | Always visible during ride | Only when navigating |
| **Use Case** | See route at a glance | Active navigation |
| **Performance** | Lightweight (just line) | Heavy (voice, routing) |
| **Dismissable** | Always on | Can exit anytime |

**Result**: Best of both worlds - Uber-like experience

---

## Performance Optimizations

### 1. Throttling
- **Distance threshold**: 10m
- **Time threshold**: 3s
- **Result**: ~10-20 route updates per ride (not 1000s)

### 2. Abort Previous Requests
```typescript
const abortControllerRef = useRef<AbortController | null>(null);

// Abort previous fetch
if (abortControllerRef.current) {
  abortControllerRef.current.abort();
}
```
- Prevents race conditions
- Cancels stale requests

### 3. Stable Key Check
```typescript
const key = `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`;
if (key === lastKeyRef.current) {
  return; // Already fetched
}
```
- Prevents duplicate fetches on re-renders
- Only fetches when locations actually change

### 4. Camera Fit Once
```typescript
<FitBoundsOnce bounds={mapBounds} fitKey={fitKey} />
```
- Only fits camera on major state changes
- Not on every GPS update or render

---

## Troubleshooting

### Route doesn't appear

**Check**:
1. Is there an active offer or ride?
2. Does ride have pickup/dropoff locations?
3. Check console for OSRM errors

**Console**:
```
[useDriverRoutes] Starting route fetch for: {lat, lng} -> {lat, lng}
[useDriverRoutes] Leg A updated: 523m, 87s
```

**Fix**: Verify pickup/dropoff are set in ride document

---

### Route not updating when driving

**Check**:
1. Has driver moved > 10m?
2. Has 3 seconds elapsed since last update?

**Console**:
```
[useDriverRoutes] Skipping leg A update: moved 5.2m, elapsed 1234ms
```

**Fix**: This is expected behavior (throttling). Wait for 3s + 10m movement.

---

### Route appears as straight line

**Reason**: OSRM fetch failed, fallback to straight line

**Check**:
```
[useDriverRoutes] Leg A route failed, using straight line: Error: ...
```

**Fix**: 
- Check network connection
- Verify OSRM API is reachable (https://router.project-osrm.org)
- Fallback is intentional (better than no route)

---

### Camera constantly re-fitting (nauseating)

**Check**: Is `fitKey` changing on every render?

**Debug**:
```typescript
console.log('[DriverHome] fitKey:', fitKey);
```

**Fix**: Verify `fitKey` only changes on major state transitions:
- New ride ID
- Status change (accepted → in_progress)
- Active leg change (A → B)

---

## Code Walkthrough

### Hook: useDriverRoutes

**Purpose**: Manage two-leg routing with throttling

**Key Logic**:
```typescript
// Leg B: pickup → dropoff (static, only changes when locations change)
useEffect(() => {
  if (!pickup || !dropoff) return;
  fetchOsrmRoute(pickup, dropoff).then(route => {
    setLegB(route.latlngs);
  });
}, [pickup, dropoff]);

// Leg A: driver → destination (throttled by GPS movement)
useEffect(() => {
  const destination = rideStatus === 'in_progress' ? dropoff : pickup;
  if (!driverLocation || !destination) return;

  // Throttle check
  if (distanceMoved < 10m || timeSinceLastUpdate < 3s) {
    return; // Skip
  }

  fetchOsrmRoute(driverLocation, destination).then(route => {
    setLegA(route.latlngs);
    lastDriverLocationRef.current = driverLocation;
    lastUpdateTimeRef.current = Date.now();
  });
}, [driverLocation, pickup, dropoff, rideStatus]);
```

---

### Component: DualRouteLine

**Purpose**: Render two route legs with different styling

**Key Logic**:
```typescript
// Active leg: bright, solid
const ACTIVE_STYLE = { color: '#3b82f6', weight: 7, opacity: 1 };

// Preview leg: dim, dashed
const PREVIEW_STYLE = { color: '#6b7280', weight: 5, opacity: 0.6, dashArray: '10, 10' };

// Render
{legA && <RouteLeg coords={legA} isActive={activeLeg === 'A'} />}
{legB && <RouteLeg coords={legB} isActive={activeLeg === 'B'} />}
```

---

## Next Steps

### Phase 4H (Future): Enhanced Routing

- [ ] **ETA Display**: Show estimated time to pickup/dropoff
- [ ] **Traffic Overlay**: Real-time traffic on route
- [ ] **Alternative Routes**: Show 2-3 route options
- [ ] **Route Optimization**: Suggest faster routes mid-trip
- [ ] **Multi-Stop Support**: Handle waypoints for multiple pickups

### Phase 4I (Future): Route Analytics

- [ ] **Route Adherence**: Track if driver follows suggested route
- [ ] **Off-Route Events**: Log when driver deviates >50m
- [ ] **ETA Accuracy**: Measure actual arrival vs. predicted
- [ ] **Route Efficiency**: Compare distance driven vs. optimal route

---

## Summary

Phase 4G provides **Uber-style route visualization** in the driver MapShell by reusing the existing OSRM routing system. The driver sees a bright route to their current destination (pickup or dropoff) plus a dim preview of the next leg. Routes update intelligently (throttled by GPS movement) and the camera auto-fits once per major state change (not nauseating).

**Key Win**: This works **alongside** Phase 4B native navigation - driver gets overview route polyline in MapShell, then can tap "Navigate" for full turn-by-turn when needed.

---

**Status**: ✅ Ready for Testing (iOS Simulator + Devices)  
**Testing Time**: ~15 minutes (5 tests)  
**Blocking**: None (uses existing OSRM routing)

---

**End of Phase 4G Documentation**
