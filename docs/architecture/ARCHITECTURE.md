# ShiftX Architecture

**Last Updated:** January 2026

## System Overview

```
┌─────────────────┐         ┌─────────────────┐
│  Customer App   │         │   Driver App    │
│   (React SPA)   │         │   (React SPA)   │
│   Port: 5173    │         │   Port: 4173    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │     Firebase SDK          │
         └──────────┬────────────────┘
                    │
         ┌──────────▼────────────┐
         │  Firebase Emulators   │
         │  ├─ Auth: 9099        │
         │  ├─ Firestore: 8081   │
         │  └─ Functions: 5002   │
         └──────────┬────────────┘
                    │
         ┌──────────▼────────────┐
         │  Cloud Functions      │
         │  (TypeScript/Node.js) │
         └──────────┬────────────┘
                    │
         ┌──────────▼────────────┐
         │  External Services    │
         │  ├─ OSRM (routing)    │
         │  └─ Cloud Scheduler   │
         └───────────────────────┘
```

---

## Data Flow

### Ride Request Flow

```
1. Customer App
   ↓
   - Tap map → set pickup/dropoff
   - OSRM fetches route (250ms debounce)
   - Display route preview + distance
   - Submit createRide callable
   ↓
2. Cloud Functions (createRide)
   ↓
   - Validate coordinates
   - Create ride document (status: 'requested')
   - Trigger dispatcher
   ↓
3. Dispatcher (Firestore trigger)
   ↓
   - Query available drivers
   - Check preferred driver first
   - Create offer documents
   ↓
4. Driver App
   ↓
   - Firestore snapshot → see offer
   - Accept offer via acceptRide callable
   ↓
5. Cloud Functions (acceptRide)
   ↓
   - Update ride status → 'accepted'
   - Write to ride document
   ↓
6. Both Apps
   ↓
   - Firestore snapshots update UI in real-time
```

### GPS Tracking Flow

```
1. Driver App (useHeartbeat)
   ↓
   - watchPosition (high accuracy)
   - Calculate Haversine distance from last update
   - IF moved >20m OR 5s elapsed:
     → Call driverHeartbeat callable
   ↓
2. Cloud Functions (driverHeartbeat)
   ↓
   - Update driver profile (location + timestamp)
   - IF active ride:
     → Update ride.driverLocation
   ↓
3. Customer App (RideStatus)
   ↓
   - Firestore snapshot → ride.driverLocation
   - Update driver marker on map
   - Map does NOT refetch route (only on pickup/dropoff change)
```

---

## Component Hierarchy

### Customer App

```
App
├── AuthGate (anonymous auth wrapper)
│   └── ToastProvider
│       ├── RequestRide
│       │   ├── MapContainer
│       │   │   ├── MapClickHandler (tap to set coords)
│       │   │   ├── RouteLine (unified polyline)
│       │   │   ├── Marker (pickup)
│       │   │   ├── Marker (dropoff)
│       │   │   └── FitBounds (with guard)
│       │   └── Form (price, schedule, etc)
│       └── RideStatus
│           ├── MapContainer
│           │   ├── RouteLine (unified polyline)
│           │   ├── Marker (pickup)
│           │   ├── Marker (dropoff)
│           │   └── Marker (driver location)
│           └── Timeline (visual status)
```

### Driver App

```
App
├── AuthGate (anonymous auth wrapper)
│   └── ToastProvider
│       ├── BottomNav (3 tabs)
│       ├── Availability
│       │   └── Hourly checkboxes (12-hour format)
│       ├── ActiveRide
│       │   ├── MapContainer
│       │   │   ├── RouteLine (unified polyline)
│       │   │   ├── Marker (pickup)
│       │   │   ├── Marker (dropoff)
│       │   │   ├── Marker (driver - live GPS)
│       │   │   └── FitBounds (with guard)
│       │   └── Controls (Accept/Start/Complete)
│       └── Settings
│           └── QR Code Generator
```

---

## Hooks Architecture

### useRoutePolyline

**Purpose:** Fetch and cache OSRM routes

**Dependencies:** `[pickup, dropoff]` (NOT ride or driverLocation)

**Memoization:** 
```typescript
const routeKey = `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`;
if (routeKey === lastKeyRef.current) return; // Skip refetch
```

**Returns:**
```typescript
{
  coords: [number, number][] | null,
  loading: boolean,
  error?: string,
  distanceMeters?: number
}
```

### useHeartbeat

**Purpose:** Throttled GPS tracking for drivers

**Strategy:** Send update when:
- 5 seconds elapsed since last send, OR
- Moved >20 meters from last sent location

**Cleanup:** Clears `watchPosition` on unmount or when disabled

**Returns:** `LatLng | null` (current location)

---

## State Management

### Firestore Real-Time Snapshots

**Ride Status Updates:**
```typescript
// Customer & Driver apps
useEffect(() => {
  const unsubscribe = onSnapshot(
    doc(db, 'rides', rideId),
    (snapshot) => {
      if (snapshot.exists()) {
        setRide(snapshot.data());
      }
    }
  );
  return () => unsubscribe();
}, [rideId]);
```

**Why Snapshots vs Polling:**
- Lower latency (real-time updates)
- Automatic reconnection on network issues
- Better battery efficiency
- Less backend load

### Local State (React Hooks)

**Route State:**
- Managed by `useRoutePolyline` hook
- Cached by coordinate key
- Shared across RequestRide, RideStatus, ActiveRide

**Map Bounds:**
- Calculated in useEffect when route changes
- `didFitRef` prevents repeated fitBounds
- `lastRouteKeyRef` detects coordinate changes

**GPS Location:**
- Managed by `useHeartbeat` hook
- Only used for display (not in dependencies)

---

## Performance Optimizations

### 1. Route Memoization
- Cache routes by `${pickup}-${dropoff}` key
- Prevents refetch on re-render
- 250ms debounce reduces API calls

### 2. FitBounds Guard
- `didFitRef` tracks if bounds fitted
- `shouldFit` prop prevents infinite loops
- `onFit` uses `useCallback` for stable reference

### 3. GPS Throttling
- 5s/20m threshold reduces writes by ~80%
- Haversine distance calculation is O(1)
- Still feels real-time to users

### 4. Firebase Singleton
- Single instance across HMR reloads
- Global flag prevents duplicate emulator connections
- Fixes INTERNAL ASSERTION FAILED errors

### 5. Component Splitting
- RouteLine shared across 3 screens
- Hooks isolate side effects
- Reduces bundle size via tree-shaking

---

## Security Model

### Firestore Rules

**Principle:** User can only read/write their own data

```javascript
// Rides
allow read: if isRider() || isAssignedDriver();
allow create: if isRider() && validRideData();
allow update: if isAssignedDriver() && validStateTransition();

// Drivers
allow read: if request.auth != null;
allow write: if isOwner();
```

### Cloud Functions

**All state transitions server-side:**
- `acceptRide` - validates driver availability
- `startRide` - checks ride status
- `completeRide` - prevents duplicate completions
- `cancelRide` - enforces cancellation rules

**Why Server-Side:**
- Prevents race conditions
- Enforces business logic
- Can't be bypassed by malicious clients

---

## Deployment Architecture

### Development (Local)

```
Firebase Emulators (localhost)
├── Auth: 9099
├── Firestore: 8081
└── Functions: 5002

Vite Dev Servers
├── Customer: 5173
└── Driver: 4173
```

### Production (Planned)

```
Firebase Hosting
├── customer.shiftx.app
└── driver.shiftx.app

Firebase Services
├── Cloud Functions (us-central1)
├── Firestore (multi-region)
├── Cloud Scheduler (cron jobs)
└── Authentication
```

---

## Key Design Decisions

### 1. React Leaflet 4.x (not 5.x)
**Why:** Version 5 incompatible with React 18 at time of implementation

### 2. divIcon (not ImageIcon)
**Why:** Vite asset imports caused path resolution issues

### 3. OSRM Public API (not Google/Mapbox)
**Why:** Free, no API key, good enough for MVP

### 4. Anonymous Auth (not email/phone)
**Why:** Faster MVP iteration, add real auth later

### 5. CARTO Dark Tiles
**Why:** Better contrast with UI, free tier

### 6. Monorepo (not separate repos)
**Why:** Shared types, single deploy, easier refactoring

### 7. TypeScript (not JavaScript)
**Why:** Catch errors at compile time, better DX

### 8. Vite (not Create React App)
**Why:** Faster HMR, better DX, modern tooling

---

## Future Enhancements

### Short Term
- [ ] Add error boundaries
- [ ] Implement retry logic for failed requests
- [ ] Add loading skeletons
- [ ] Improve mobile responsiveness

### Medium Term
- [ ] Real authentication (phone/email)
- [ ] Payment integration (Stripe)
- [ ] Push notifications
- [ ] Trip history
- [ ] Ratings system

### Long Term
- [ ] Native mobile apps (React Native)
- [ ] Multi-driver support
- [ ] Analytics dashboard
- [ ] Admin panel
- [ ] Surge pricing

---

## Troubleshooting Guide

### Chrome Freezes
**Symptoms:** UI locks for 30s after "Start Ride"
**Cause:** Infinite fitBounds loop
**Fix:** Ensure `onFit` uses `useCallback`

### Route Not Showing
**Symptoms:** No blue line on map
**Cause:** OSRM error or null coordinates
**Fix:** Check console for "OSRM route failed", verify coords not null

### Duplicate Firebase Instances
**Symptoms:** "INTERNAL ASSERTION FAILED"
**Cause:** HMR creating multiple instances
**Fix:** Use singleton pattern with global flag

### GPS Not Updating
**Symptoms:** Driver pin doesn't move
**Cause:** Location permission denied or heartbeat disabled
**Fix:** Check browser permissions, verify `useHeartbeat(true)`

### Map Tiles Too Dark
**Symptoms:** Can't see roads
**Cause:** CARTO dark tiles without brightness filter
**Fix:** Add `.map-tiles-enhanced` class with `brightness(1.5)`

---

## Testing Strategy

### Unit Tests
- Hook logic (useRoutePolyline, useHeartbeat)
- Utility functions (Haversine, time formatting)
- Component rendering (snapshot tests)

### Integration Tests
- Firebase callable functions
- Firestore rules (rules-tests package)
- End-to-end ride flow

### Manual Testing Checklist
- [ ] Customer can request ride with map tap
- [ ] Route follows roads (not straight line)
- [ ] Driver receives ride offer
- [ ] Live GPS updates without freeze
- [ ] Accept → Start → Complete workflow
- [ ] Scheduled rides activate correctly
- [ ] QR code generation and scanning
- [ ] Map auto-fits bounds on route load

---

## References

- [React Leaflet Docs](https://react-leaflet.js.org/)
- [OSRM API Docs](http://project-osrm.org/docs/v5.24.0/api/)
- [Firebase Web SDK](https://firebase.google.com/docs/web/setup)
- [Haversine Formula](https://en.wikipedia.org/wiki/Haversine_formula)
- [Leaflet divIcon](https://leafletjs.com/reference.html#divicon)
