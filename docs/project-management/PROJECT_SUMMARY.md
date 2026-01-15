# ShiftX Project Summary

**Last Updated:** January 2026

## Architecture Overview

**Monorepo Structure:**
```
shiftx/
├── packages/
│   ├── customer-app/     # React customer web app (Vite + TypeScript)
│   ├── driver-app/       # React driver web app (Vite + TypeScript)
│   ├── driver-client/    # Shared Firebase client utilities
│   └── rules-tests/      # Firestore rules testing
├── functions/            # Firebase Cloud Functions (Node.js/TypeScript)
├── firestore.rules       # Firestore security rules
├── docs/                 # Documentation
└── .vscode/              # VS Code tasks and launch configs
```

**Tech Stack:**
- **Frontend:** React 18.3 + TypeScript 5.3.3 + Vite 5.0
- **Maps:** React Leaflet 4.x + Leaflet + OSRM routing API
- **Backend:** Firebase Cloud Functions (Node.js 18+) + Firestore
- **Auth:** Firebase Auth (anonymous mode for MVP)
- **Scheduling:** Cloud Scheduler (Pub/Sub cron)
- **State:** React Hooks (useState, useEffect, useRef, useCallback, useMemo)

**Key Constants:**
```typescript
// Emulator Ports
FIRESTORE_PORT = 8081
AUTH_PORT = 9099
FUNCTIONS_PORT = 5002

// Customer App Dev Server
CUSTOMER_PORT = 5173

// Driver App Dev Server  
DRIVER_PORT = 4173

// GPS Throttling
HEARTBEAT_INTERVAL = 5000ms        // 5 seconds
MOVEMENT_THRESHOLD = 20            // 20 meters

// Route Fetching
ROUTE_DEBOUNCE = 250ms             // 250ms debounce
```

---

## Core Features Implemented

### Customer App (`packages/customer-app`)

**Component Structure:**
```
src/
├── components/
│   ├── RequestRide.tsx          # Tap-to-set ride requests + route preview
│   ├── RideStatus.tsx           # Real-time ride tracking
│   ├── RouteLine.tsx            # Unified route polyline renderer
│   ├── Toast.tsx                # Toast notifications
│   └── AuthGate.tsx             # Anonymous auth wrapper
├── hooks/
│   └── useRoutePolyline.ts      # OSRM route fetching hook
├── lib/
│   └── routing.ts               # OSRM API client
├── utils/
│   └── mapIcons.ts              # Leaflet divIcon definitions
├── firebase.ts                  # HMR-safe Firebase singleton
└── App.tsx                      # Main routing
```

**Key Features:**
- Tap map to set pickup/dropoff (no manual coordinate input)
- Road-following routes via OSRM with auto-fit bounds
- Distance display in miles
- Real-time ride status updates (Firestore snapshots)
- Scheduled rides with timezone validation
- Preferred driver QR code scanning
- Route status: "Calculating route…" / "Route unavailable"

### Driver App (`packages/driver-app`)

**Component Structure:**
```
src/
├── components/
│   ├── Availability.tsx         # Hourly availability (12-hour format)
│   ├── ActiveRide.tsx           # Live trip map + controls
│   ├── RouteLine.tsx            # Unified route polyline renderer
│   ├── BottomNav.tsx            # 3-tab navigation
│   └── AuthGate.tsx             # Anonymous auth wrapper
├── hooks/
│   ├── useRoutePolyline.ts      # OSRM route fetching hook
│   └── useHeartbeat.ts          # GPS throttling + driverHeartbeat calls
├── lib/
│   └── routing.ts               # OSRM API client
├── utils/
│   └── mapIcons.ts              # Leaflet divIcon definitions
└── App.tsx                      # Main routing
```

**Key Features:**
- Bottom navigation: Home (availability) / Active Ride / Settings
- Hourly availability checkboxes (12-hour format, 4 columns)
- Live GPS tracking with intelligent throttling
- Road-following route map with driver/pickup/dropoff markers
- Apple Maps navigation integration
- Trip workflow: Accept → Start Ride → Begin Trip → Complete
- QR code generation for preferred driver invites (Web Share API)

---

## Maps & Routing Implementation

### Unified Route Polyline System

**Problem Solved:** 
- Customer RequestRide, RideStatus, and Driver ActiveRide had different polyline styles
- Chrome froze after "Start Ride" due to repeated fitBounds calls
- Route refetched unnecessarily on GPS updates

**Architecture:**

```typescript
// Shared Hook: packages/{customer,driver}-app/src/hooks/useRoutePolyline.ts
interface RoutePolylineResult {
  coords: [number, number][] | null;
  loading: boolean;
  error?: string;
  distanceMeters?: number;
}

export function useRoutePolyline(
  pickup?: LatLng | null,
  dropoff?: LatLng | null
): RoutePolylineResult
```

**Key Features:**
- **Memoization:** Stable key `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`
- **Debounce:** 250ms timeout before fetching
- **Abort Control:** Cancels previous requests
- **Depends ONLY on pickup/dropoff** (not ride object or driverLocation)
- **Fallback:** Straight line if OSRM fails
- **Console Logging:** `console.log('OSRM route points', count)` on success

```typescript
// Shared Component: packages/{customer,driver}-app/src/components/RouteLine.tsx
export function RouteLine({ coords }: { coords: [number, number][] | null }) {
  return (
    <>
      {/* Glow layer */}
      <Polyline positions={coords} pathOptions={{ 
        color: '#60a5fa', weight: 10, opacity: 0.3, 
        lineCap: 'round', lineJoin: 'round' 
      }} />
      {/* Core line */}
      <Polyline positions={coords} pathOptions={{ 
        color: '#60a5fa', weight: 6, opacity: 0.95, 
        lineCap: 'round', lineJoin: 'round',
        className: 'route-glow'
      }} />
    </>
  );
}
```

**CSS Glow Effect:**
```css
/* packages/{customer,driver}-app/src/styles.css */
.route-glow {
  filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.8)) 
          drop-shadow(0 0 16px rgba(96, 165, 250, 0.4));
}
```

### FitBounds Guard (Chrome Freeze Fix)

**Problem:** `map.fitBounds()` called on every render/GPS update caused 30s UI lock.

**Solution:**

```typescript
// FitBounds component with guard
function FitBounds({ 
  bounds, 
  shouldFit, 
  onFit 
}: { 
  bounds: LatLngBounds | null; 
  shouldFit: boolean; 
  onFit: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (bounds && shouldFit) {
      map.fitBounds(bounds, { padding: [50, 50] });
      onFit();
    }
  }, [bounds, map, shouldFit, onFit]);
  return null;
}

// Usage in ActiveRide/RequestRide
const didFitRef = useRef(false);
const lastRouteKeyRef = useRef<string>('');

// Stable callback (prevents infinite loop)
const handleFit = useCallback(() => {
  didFitRef.current = true;
}, []);

// Reset flag only when route changes
useEffect(() => {
  const routeKey = `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`;
  if (routeKey !== lastRouteKeyRef.current) {
    didFitRef.current = false;
    lastRouteKeyRef.current = routeKey;
  }
  // Calculate bounds...
}, [pickup, dropoff, routeLatLngs]);

// Render
<FitBounds 
  bounds={mapBounds} 
  shouldFit={!didFitRef.current} 
  onFit={handleFit} 
/>
```

**Critical:** `onFit` uses `useCallback` to prevent dependency change on every render.

### OSRM Integration

**API:** `https://router.project-osrm.org/route/v1/driving/{lng},{lat};{lng},{lat}?overview=full&geometries=geojson`

**Coordinate Conversion:**
- OSRM returns: `[lng, lat]` (GeoJSON format)
- Leaflet needs: `[lat, lng]`
- Conversion in `fetchOsrmRoute()`:
  ```typescript
  const latlngs: [number, number][] = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );
  ```

### Map Icons (Vite-Friendly)

```typescript
// packages/{customer,driver}-app/src/utils/mapIcons.ts
import L from 'leaflet';

export const driverCarIcon = L.divIcon({
  html: '<div style="...">🚗</div>',
  className: 'custom-icon',
  iconSize: [32, 32],
});

export const pickupCircleIcon = L.divIcon({
  html: '<div style="background: rgba(0,255,140,0.3); border: 2px solid rgb(0,255,140); width: 20px; height: 20px; border-radius: 50%;"></div>',
  className: 'custom-icon',
  iconSize: [20, 20],
});
```

**Why divIcon:** Vite asset imports caused path issues. CSS-based icons work everywhere.

### Map Tiles

**Provider:** CARTO Dark (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`)

**Brightness Adjustment:**
```css
.map-tiles-enhanced {
  filter: brightness(1.5) contrast(1.15);
}
```

---

## GPS Tracking & Throttling

### useHeartbeat Hook

**Location:** `packages/driver-app/src/hooks/useHeartbeat.ts`

**Strategy:** Send updates when **5 seconds elapsed OR moved >20 meters**

**Why Throttling:**
- Prevents excessive Firestore writes
- Reduces backend costs  
- Improves battery life
- Still provides near-real-time tracking

**Haversine Distance:** Calculates great-circle distance between GPS coordinates in meters.

---

## Firebase Singleton Pattern

**Problem:** Multiple Firebase instances caused "INTERNAL ASSERTION FAILED" errors due to Vite HMR creating duplicate connections.

**Solution:** Singleton pattern with HMR-safe emulator connections in `customer-app/src/firebase.ts`:

```typescript
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'demo',
  authDomain: 'demo-no-project.firebaseapp.com',
  projectId: 'demo-no-project',
};

// Singleton - only initialize once
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig, 'shiftx-customer-app');

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect emulators ONCE (global flag prevents duplicate connections)
const g = globalThis as any;
if (import.meta.env.DEV && !g.__CUSTOMER_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
  connectFunctionsEmulator(functions, '127.0.0.1', 5002);
  g.__CUSTOMER_EMULATORS_CONNECTED__ = true;
}
```

**Key Benefits:**
- ✅ No duplicate Firebase instances
- ✅ HMR-safe (Vite hot reload won't break connections)
- ✅ Auth-gated Firestore listeners (wait for auth before subscribing)
- ✅ Eliminates "Unexpected state" errors

---

## Completed Features

### 1. ✅ No Drivers Available Flow

**Backend Logic** (`functions/src/index.ts`):

The `runMatching()` function handles ride-driver matching with automatic cancellation:

```typescript
async function runMatching(rideId: string) {
  const dispatchAttempts = (ride.dispatchAttempts || 0) + 1;
  const driversSnap = await findEligibleDrivers(firestoreDb);
  
  if (driversSnap.empty) {
    if (dispatchAttempts >= MAX_DISPATCH_ATTEMPTS) {
      // TERMINAL STATE: Cancel after max attempts
      await rejectPendingOffers(rideId, firestoreDb);
      await rideRef.update({
        status: 'cancelled',
        cancelReason: 'no_drivers',
        cancelledAtMs: now,
      });
      return { matched: false, cancelled: true };
    }
    // Still have attempts - retry
    await rideRef.update({ 
      status: 'requested',
      dispatchAttempts: dispatchAttempts 
    });
    return { matched: false };
  }
  // Create offers for eligible drivers...
}
```

**Customer UI** (`customer-app/src/components/RideStatus.tsx`):

Shows clear message with retry button when `status === 'cancelled' && cancelReason === 'no_drivers'`:

```typescript
{ride.status === 'cancelled' && ride.cancelReason === 'no_drivers' && (
  <div className="no-drivers-message">
    <div className="error-icon">⚠️</div>
    <h3>No Drivers Available</h3>
    <p>We couldn't find any available drivers right now. Please try again in a few moments.</p>
    <button 
      onClick={handleRetryRide}
      disabled={isRetrying}
      className="btn-retry"
    >
      {isRetrying ? 'Requesting...' : 'Request Again'}
    </button>
  </div>
)}
```

**Retry Logic:**
```typescript
const handleRetryRide = async () => {
  setIsRetrying(true);
  const tripRequestFn = httpsCallable(functions, 'tripRequest');
  const result = await tripRequestFn({
    pickup: ride.pickup,
    dropoff: ride.dropoff,
    priceCents: ride.priceCents,
  });
  const rideId = (result.data as any).rideId;
  localStorage.setItem('rideId', rideId);
  onRideRetry(rideId); // Navigates to new ride
};
```

**Flow Diagram:**
```
Customer requests ride
  ↓
Backend creates ride (status: 'requested')
  ↓
runMatching() attempts #1
  ↓
No eligible drivers found
  ↓
Increment dispatchAttempts (now 1)
  ↓
runMatching() attempts #2
  ↓
Still no drivers
  ↓
Increment dispatchAttempts (now 2)
  ↓
runMatching() attempts #3
  ↓
Still no drivers
  ↓
dispatchAttempts >= MAX_DISPATCH_ATTEMPTS (3)
  ↓
Set status='cancelled', cancelReason='no_drivers'
  ↓
Customer sees "No Drivers Available" + "Request Again" button
  ↓
Customer clicks "Request Again"
  ↓
Creates NEW ride with same coordinates
  ↓
Cycle repeats
```

### 2. ✅ Driver Offer Modal - Price Display Fix

**Problem:** OfferModal showed $0 and blank pickup/dropoff because offer documents don't contain ride details.

**Solution:** Added `watchRide()` helper in driver-client to fetch full ride document:

```typescript
// driver-client/src/index.ts
export function watchRide(
  rideId: string,
  onChange: (ride: any | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { firestore } = ensureClients();
  return onSnapshot(doc(firestore, 'rides', rideId), 
    (snap) => onChange(snap.exists() ? snap.data() : null),
    onError
  );
}
```

**Driver OfferModal** now subscribes to `rides/{rideId}` and displays:
- `ride.priceCents` → "$25.00"
- `ride.pickup` → Coordinates
- `ride.dropoff` → Coordinates

### 3. ✅ Toast Spam Fix

**Problem:** Driver UI spammed "Offer expired" toasts repeatedly when an offer expired.

**Root Cause:** 
- onSnapshot fires multiple times for the same document
- Modal component remounts on each state change
- No deduplication of toast messages

**Solution:**

**App.tsx Deduplication:**
```typescript
const lastOfferStatusRef = useRef<Map<string, string>>(new Map());

// In offers listener:
const previousStatus = lastOfferStatusRef.current.get(rideId);
const currentStatus = offerSnap.data()?.status;

if (previousStatus !== currentStatus) {
  lastOfferStatusRef.current.set(rideId, currentStatus);
}

if (currentStatus === 'pending') {
  pendingMap.set(rideId, offer);
}

// Stable key prevents remounts:
<OfferModal key={firstPendingOffer[0]} rideId={...} />
```

**OfferModal Single Toast:**
```typescript
const hasShownExpiredToastRef = useRef(false);

const handleOfferExpired = () => {
  if (!hasShownExpiredToastRef.current) {
    show('Offer expired', 'error');
    hasShownExpiredToastRef.current = true;
  }
  onClose();
};
```

### 4. ✅ Demo Coordinates Button

**Feature:** Quick-fill button for DC area coordinates in RequestRide form.

```typescript
const handleUseDemoCoordinates = () => {
  setPickupLat('38.8976');   // DC - Union Station area
  setPickupLng('-77.0369');
  setDropoffLat('38.9072');  // DC - Georgetown area
  setDropoffLng('-77.0589');
};

// Button with purple gradient styling
<button onClick={handleUseDemoCoordinates} className="btn-demo">
  Use Demo Coordinates (DC Area)
</button>
```

Default price: $25 (2500 cents)

---

## Data Models

### Ride Document (`rides/{rideId}`)
```typescript
interface Ride {
  riderId: string;
  status: 'requested' | 'dispatching' | 'offered' | 'accepted' | 'started' | 'in_progress' | 'completed' | 'cancelled';
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  priceCents: number;
  driverId?: string;
  dispatchAttempts?: number;        // Tracks matching attempts
  cancelReason?: string;            // 'no_drivers' when max attempts reached
  createdAtMs: number;
  acceptedAtMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
}
```

### Offer Document (`rides/{rideId}/offers/{driverId}`)
```typescript
interface Offer {
  driverId: string;
  rideId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAtMs: number;
  expiresAtMs: number;              // createdAtMs + OFFER_TTL_MS
  respondedAtMs?: number;
}
```

### Driver Document (`drivers/{driverId}`)
```typescript
interface Driver {
  isOnline: boolean;
  isBusy: boolean;
  currentRideId?: string;
  currentRideStatus?: string;
  lastHeartbeatMs: number;
  location?: { lat: number; lng: number };
  updatedAtMs: number;
}
```

---

## Cloud Functions

### Customer-Facing
- **tripRequest**: Create new ride, trigger matching
- **tripCancel**: Cancel ride (if in cancellable state)

### Driver-Facing
- **driverSetOnline**: Set driver online/offline status
- **tripAccept**: Accept pending offer
- **declineOffer**: Decline pending offer
- **startRide**: Mark ride as started
- **completeRide**: Mark ride as completed

### Background
- **runMatching**: Core matching engine (called after ride creation and offer expiration)
- **offerTimeoutJob**: Scheduled function to expire old offers (requires PubSub emulator)

---

## Security Rules Highlights

```javascript
// Customers can only read their own rides
match /rides/{rideId} {
  allow read: if signedIn()
    && (
      request.auth.uid == resource.data.riderId
      || request.auth.uid == resource.data.driverId
      || hasOfferForDriver(rideId)
    );
  allow write: if false; // Only Cloud Functions write
}

// Drivers can only see their own offers
match /rides/{rideId}/offers/{driverId} {
  allow get, list: if isOwner(driverId);
  allow write: if false;
}
```

---

## Key Workflows

### Customer Request Ride Flow
```
1. Customer fills form (or uses demo coordinates)
2. Click "Request Ride" → tripRequest()
3. Backend creates ride doc (status: 'requested')
4. runMatching() fires immediately
5. Customer sees RideStatus with real-time updates
6. If no drivers after 3 attempts → "No Drivers Available" UI
```

### Driver Accept Ride Flow
```
1. Driver clicks "Go Online"
2. watchDriverOffers() subscribes to offers collection
3. Offer appears → OfferModal shows with countdown
4. Driver clicks "Accept" → tripAccept()
5. Backend updates ride.status = 'accepted', offer.status = 'accepted'
6. Driver sees active ride UI
```

### No Drivers Flow
```
1. runMatching() finds 0 eligible drivers
2. Increments dispatchAttempts
3. If attempts >= 3 → Cancel with cancelReason='no_drivers'
4. Customer sees retry UI
5. Click "Request Again" → Creates new ride with fresh dispatchAttempts
```

---

## Auth-Gated Listeners (Critical Pattern)

**Problem:** Firestore listeners started before auth ready → permission errors

**Solution:** Wait for `authReady` before subscribing:

```typescript
// RideStatus.tsx
const [authReady, setAuthReady] = useState(false);
const [user, setUser] = useState<any>(null);

// First: wait for auth
useEffect(() => {
  return onAuthStateChanged(auth, (u) => {
    setUser(u);
    setAuthReady(true);
  });
}, []);

// Then: subscribe to Firestore (only when auth ready)
useEffect(() => {
  if (!authReady) return;
  if (!user) {
    setRide(null);
    return;
  }
  
  const rideRef = doc(db, 'rides', rideId);
  const unsubscribe = onSnapshot(rideRef, ...);
  return unsubscribe;
}, [authReady, user, rideId]);
```

---

## Development Setup

### Start Emulators
```bash
cd /Users/papadev/dev/apps/shiftx
firebase emulators:start --only auth,functions,firestore
```

### Start Customer App
```bash
cd packages/customer-app
npm run dev
# → http://localhost:5173
```

### Start Driver App
```bash
cd packages/driver-app
npm run dev
# → http://localhost:4173
```

### Clear Site Data (When Debugging)
```javascript
// In browser console:
localStorage.clear();
location.reload();
```

---

## Known Issues & Workarounds

### Issue: Firestore "INTERNAL ASSERTION FAILED" errors
**Cause:** Multiple Firebase instances or emulator reconnections
**Fix:** Use singleton pattern (see firebase.ts above)

### Issue: "Error loading ride" toasts when signed out
**Cause:** localStorage has old rideId but user is signed out
**Fix:** Clear localStorage on sign out (already implemented in App.tsx)

### Issue: Offer expired toast spam
**Fix:** Deduplication with refs (already implemented)

---

## Testing Scenarios

### Test No Drivers Flow
1. Start emulators and customer app (no drivers running)
2. Sign in to customer app
3. Click "Use Demo Coordinates"
4. Click "Request Ride"
5. Wait ~3-5 seconds for 3 failed matching attempts
6. Should see "No Drivers Available" message
7. Click "Request Again" → Creates new ride

### Test Driver Accept Flow
1. Start both customer and driver apps
2. Customer: Request ride
3. Driver: Go online
4. Driver: See offer modal with price and locations
5. Driver: Click "Accept"
6. Customer: Should see "Driver Accepted" status

---

## Next Steps (Potential Enhancements)

### Not Yet Implemented
- [ ] Search timeout (2 minutes max search time)
- [ ] `searchStartedAtMs` timestamp tracking
- [ ] Real-time driver location tracking
- [ ] Distance-based driver filtering
- [ ] Driver rating system
- [ ] Push notifications
- [ ] Payment integration
- [ ] Trip history

### MVP is Complete ✅
- [x] Ride request and matching
- [x] Driver offer system with TTL
- [x] No drivers cancellation after max attempts
- [x] Customer retry flow
- [x] Real-time status updates
- [x] Toast notifications
- [x] Demo coordinates
- [x] Firebase singleton pattern
- [x] Auth-gated listeners

---

## File Structure Reference

### Customer App Key Files
```
customer-app/src/
├── firebase.ts              # Singleton Firebase initialization
├── App.tsx                  # Main app, auth, ride state
├── components/
│   ├── RequestRide.tsx      # Ride request form
│   ├── RideStatus.tsx       # Real-time ride status + retry
│   ├── AuthGate.tsx         # Auth UI wrapper
│   └── Toast.tsx            # Toast notification context
└── styles.css
```

### Driver App Key Files
```
driver-app/src/
├── App.tsx                  # Main app, online status, offer listener
├── components/
│   ├── OfferModal.tsx       # Incoming ride offer with countdown
│   ├── ActiveRide.tsx       # Current ride management
│   └── Toast.tsx
└── styles.css
```

### Shared Driver Client
```
driver-client/src/
├── index.ts                 # Firebase init, watchRide, callable functions
└── types.ts                 # Shared TypeScript interfaces
```

### Backend Functions
```
functions/src/
└── index.ts                 # All Cloud Functions + runMatching logic
```

---

## Command Quick Reference

```bash
# Start everything
firebase emulators:start --only auth,functions,firestore

# Customer app
cd packages/customer-app && npm run dev

# Driver app  
cd packages/driver-app && npm run dev

# Clear Vite cache (if HMR breaks)
rm -rf packages/customer-app/node_modules/.vite
rm -rf packages/driver-app/node_modules/.vite

# View emulator UI
open http://127.0.0.1:4000
```

---

## Summary

**ShiftX MVP is a working ride-sharing platform with:**
- ✅ Real-time ride matching
- ✅ Driver offer system with 60-second TTL
- ✅ Automatic cancellation after 3 failed attempts
- ✅ Clean "No Drivers Available" UX with retry
- ✅ Firebase singleton pattern (HMR-safe)
- ✅ Auth-gated Firestore listeners
- ✅ Toast notification system
- ✅ Demo coordinates for quick testing

**Architecture is production-ready for:**
- Firebase deployment
- Real-time state synchronization
- Security rules enforcement
- Scalable Cloud Functions

**Ready for next phase:**
- Add search timeout (2 min max)
- Real-time location tracking
- Payment integration
- Push notifications
